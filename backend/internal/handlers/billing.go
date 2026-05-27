package handlers

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"
	"smart-lms/internal/notifications"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// ─── Helpers ──────────────────────────────────────────────

func userID(c *fiber.Ctx) uint {
	v := c.Locals("user_id")
	if v == nil {
		return 0
	}
	if id, ok := v.(uint); ok {
		return id
	}
	return 0
}

// formatRupiah: 1500000 → "Rp 1.500.000"
func formatRupiah(n float64) string {
	s := fmt.Sprintf("%.0f", n)
	// insert dot as thousand separator
	out := ""
	for i, c := range reverse(s) {
		if i > 0 && i%3 == 0 {
			out = "." + out
		}
		out = string(c) + out
	}
	return "Rp " + out
}

func reverse(s string) string {
	r := []rune(s)
	for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}

// generateNomorKuitansi: KW/2026/05/0001 (per-school sequence per month)
func generateNomorKuitansi(schoolID uint, t time.Time) string {
	year := t.Year()
	month := int(t.Month())
	// Count existing pembayaran for school in this month
	var count int64
	start := time.Date(year, t.Month(), 1, 0, 0, 0, 0, t.Location())
	end := start.AddDate(0, 1, 0)
	config.DB.Unscoped().Model(&models.Pembayaran{}).
		Where("school_id = ? AND created_at >= ? AND created_at < ?", schoolID, start, end).
		Count(&count)
	seq := count + 1
	return fmt.Sprintf("KW/%d/%02d/%04d", year, month, seq)
}

// recalcTagihan recomputes terbayar (sum non-void Pembayaran) + status
func recalcTagihan(tx *gorm.DB, tagihanID uint) error {
	var t models.Tagihan
	if err := tx.First(&t, tagihanID).Error; err != nil {
		return err
	}
	var total float64
	tx.Model(&models.Pembayaran{}).
		Where("tagihan_id = ? AND void = ?", tagihanID, false).
		Select("COALESCE(SUM(nominal_bayar), 0)").Scan(&total)
	t.Terbayar = total
	t.Status = t.HitungStatus()
	return tx.Save(&t).Error
}

// ─── JenisTagihan CRUD ────────────────────────────────────

func GetJenisTagihan(c *fiber.Ctx) error {
	var list []models.JenisTagihan
	q := config.DB.Where("school_id = ?", schoolID(c))
	if c.Query("aktif") == "true" {
		q = q.Where("aktif = ?", true)
	}
	q.Order("nama ASC").Find(&list)
	return c.JSON(list)
}

func CreateJenisTagihan(c *fiber.Ctx) error {
	var req models.JenisTagihan
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	req.ID = 0
	req.SchoolID = schoolID(c)
	if req.Nama == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nama wajib diisi"})
	}
	if req.Periode == "" {
		req.Periode = "sekali"
	}
	if err := config.DB.Create(&req).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(req)
}

func UpdateJenisTagihan(c *fiber.Ctx) error {
	var jt models.JenisTagihan
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&jt).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	c.BodyParser(&jt)
	jt.SchoolID = schoolID(c)
	config.DB.Save(&jt)
	return c.JSON(jt)
}

func DeleteJenisTagihan(c *fiber.Ctx) error {
	// Cek apakah masih ada Tagihan yang pakai jenis ini
	var count int64
	config.DB.Model(&models.Tagihan{}).
		Where("jenis_tagihan_id = ? AND school_id = ?", paramID(c), schoolID(c)).
		Count(&count)
	if count > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": fmt.Sprintf("Tidak bisa hapus: masih ada %d tagihan yang pakai jenis ini. Nonaktifkan saja.", count),
		})
	}
	config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).Delete(&models.JenisTagihan{})
	return c.JSON(fiber.Map{"message": "Jenis tagihan dihapus"})
}

// ─── Tagihan CRUD ─────────────────────────────────────────

// GET /api/billing/tagihan?class_id=&jenis=&periode=&status=&page=&limit=
func GetTagihanList(c *fiber.Ctx) error {
	sid := schoolID(c)
	q := config.DB.Model(&models.Tagihan{}).Where("tagihans.school_id = ?", sid)

	if classID := c.Query("class_id"); classID != "" {
		q = q.Joins("JOIN students ON students.id = tagihans.student_id").
			Where("students.class_id = ?", classID)
	}
	if jenis := c.Query("jenis_tagihan_id"); jenis != "" {
		q = q.Where("jenis_tagihan_id = ?", jenis)
	}
	if periode := c.Query("periode"); periode != "" {
		q = q.Where("periode = ?", periode)
	}
	if status := c.Query("status"); status != "" {
		q = q.Where("tagihans.status = ?", status)
	}
	if studentID := c.Query("student_id"); studentID != "" {
		q = q.Where("tagihans.student_id = ?", studentID)
	}

	var total int64
	q.Session(&gorm.Session{}).Count(&total)

	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if limit > 200 {
		limit = 200
	}

	var list []models.Tagihan
	q.Preload("Student").Preload("Student.Class").Preload("Student.User").
		Preload("JenisTagihan").
		Order("jatuh_tempo ASC, id DESC").
		Limit(limit).Offset(offset).Find(&list)

	// stats
	var stats struct {
		TotalTagihan   float64 `json:"total_tagihan"`
		TotalTerbayar  float64 `json:"total_terbayar"`
		TotalKeringanan float64 `json:"total_keringanan"`
		TotalSisa      float64 `json:"total_sisa"`
		CountLunas     int64   `json:"count_lunas"`
		CountSebagian  int64   `json:"count_sebagian"`
		CountBelum     int64   `json:"count_belum"`
	}
	statsQ := q.Session(&gorm.Session{})
	statsQ.Select("COALESCE(SUM(nominal),0)").Scan(&stats.TotalTagihan)
	statsQ.Select("COALESCE(SUM(terbayar),0)").Scan(&stats.TotalTerbayar)
	statsQ.Select("COALESCE(SUM(keringanan),0)").Scan(&stats.TotalKeringanan)
	stats.TotalSisa = stats.TotalTagihan - stats.TotalKeringanan - stats.TotalTerbayar
	statsQ.Where("tagihans.status = ?", "lunas").Count(&stats.CountLunas)
	statsQ.Where("tagihans.status = ?", "sebagian").Count(&stats.CountSebagian)
	statsQ.Where("tagihans.status = ?", "belum_bayar").Count(&stats.CountBelum)

	return c.JSON(fiber.Map{
		"data":  list,
		"total": total,
		"stats": stats,
	})
}

// GET /api/billing/tagihan/:id (with payments)
func GetTagihanDetail(c *fiber.Ctx) error {
	var t models.Tagihan
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).
		Preload("Student").Preload("Student.Class").Preload("Student.User").
		Preload("JenisTagihan").
		First(&t).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Tagihan not found"})
	}
	var payments []models.Pembayaran
	config.DB.Where("tagihan_id = ?", t.ID).Order("tanggal_bayar DESC, id DESC").Find(&payments)
	return c.JSON(fiber.Map{
		"tagihan":     t,
		"pembayaran":  payments,
		"total":       t.TotalTagihan(),
		"sisa":        t.Sisa(),
	})
}

// GetTagihanByStudent (alias for routes.go: GetTagihanSiswa)
func GetTagihanByStudent(c *fiber.Ctx) error {
	studentID := paramID(c)
	var list []models.Tagihan
	config.DB.Where("student_id = ? AND school_id = ?", studentID, schoolID(c)).
		Preload("JenisTagihan").
		Order("periode DESC, jatuh_tempo DESC").Find(&list)
	return c.JSON(list)
}

// GetTagihanSiswa is an alias used by routes.go
func GetTagihanSiswa(c *fiber.Ctx) error {
	return GetTagihanByStudent(c)
}

// POST /api/billing/tagihan (create single)
func CreateTagihan(c *fiber.Ctx) error {
	var req struct {
		StudentID      uint    `json:"student_id"`
		JenisTagihanID uint    `json:"jenis_tagihan_id"`
		Periode        string  `json:"periode"`
		Nominal        float64 `json:"nominal"`
		Keringanan     float64 `json:"keringanan"`
		KeringananNote string  `json:"keringanan_note"`
		JatuhTempo     string  `json:"jatuh_tempo"`
		Catatan        string  `json:"catatan"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.StudentID == 0 || req.JenisTagihanID == 0 || req.Nominal <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Siswa, jenis, dan nominal wajib diisi"})
	}

	jt, _ := time.Parse("2006-01-02", req.JatuhTempo)

	t := models.Tagihan{
		SchoolID:       schoolID(c),
		StudentID:      req.StudentID,
		JenisTagihanID: req.JenisTagihanID,
		Periode:        req.Periode,
		Nominal:        req.Nominal,
		Keringanan:     req.Keringanan,
		KeringananNote: req.KeringananNote,
		JatuhTempo:     jt,
		Status:         "belum_bayar",
		Catatan:        req.Catatan,
	}
	if err := config.DB.Create(&t).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Trigger notif (silent)
	go notifyTagihanBaru(schoolID(c), t.ID)

	return c.JSON(t)
}

// PUT /api/billing/tagihan/:id
func UpdateTagihan(c *fiber.Ctx) error {
	var t models.Tagihan
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&t).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	var req struct {
		Nominal        *float64 `json:"nominal"`
		Keringanan     *float64 `json:"keringanan"`
		KeringananNote *string  `json:"keringanan_note"`
		JatuhTempo     *string  `json:"jatuh_tempo"`
		Catatan        *string  `json:"catatan"`
		Status         *string  `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Nominal != nil {
		t.Nominal = *req.Nominal
	}
	if req.Keringanan != nil {
		t.Keringanan = *req.Keringanan
	}
	if req.KeringananNote != nil {
		t.KeringananNote = *req.KeringananNote
	}
	if req.JatuhTempo != nil && *req.JatuhTempo != "" {
		jt, _ := time.Parse("2006-01-02", *req.JatuhTempo)
		t.JatuhTempo = jt
	}
	if req.Catatan != nil {
		t.Catatan = *req.Catatan
	}
	if req.Status != nil {
		t.Status = *req.Status
	} else {
		t.Status = t.HitungStatus()
	}
	config.DB.Save(&t)
	return c.JSON(t)
}

// DeleteTagihan (alias CancelTagihan) — soft delete; if has pembayaran, set status=batal instead
func DeleteTagihan(c *fiber.Ctx) error {
	var t models.Tagihan
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&t).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	var count int64
	config.DB.Model(&models.Pembayaran{}).Where("tagihan_id = ? AND void = ?", t.ID, false).Count(&count)
	if count > 0 {
		// Punya pembayaran — set status=batal saja, jangan hapus
		t.Status = "batal"
		config.DB.Save(&t)
		return c.JSON(fiber.Map{"message": "Tagihan dibatalkan (status=batal). Pembayaran tetap tercatat."})
	}
	config.DB.Delete(&t)
	return c.JSON(fiber.Map{"message": "Tagihan dihapus"})
}

// CancelTagihan is an alias used by routes.go
func CancelTagihan(c *fiber.Ctx) error {
	return DeleteTagihan(c)
}

// PrintKuitansi: GET /api/billing/pembayaran/:id/kuitansi
// Returns HTML untuk struk thermal 80mm. Frontend akan window.print() langsung.
// (PDF generation server-side bisa ditambahkan kemudian via wkhtmltopdf.)
func PrintKuitansi(c *fiber.Ctx) error {
	sid := schoolID(c)
	var p models.Pembayaran
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), sid).
		Preload("Student").Preload("Student.User").Preload("Student.Class").
		Preload("Tagihan").Preload("Tagihan.JenisTagihan").
		First(&p).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Pembayaran not found"})
	}
	var school models.School
	config.DB.First(&school, sid)

	sisa := p.Tagihan.Sisa()
	statusBayar := "LUNAS"
	if sisa > 0.01 {
		statusBayar = "DP/CICILAN"
	}
	if p.Void {
		statusBayar = "VOID"
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Kuitansi %s</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 4mm; width: 72mm; color: #000; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .lg { font-size: 13px; }
  .xl { font-size: 14px; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 4px; }
  table { width: 100%%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .footer { margin-top: 8px; font-size: 10px; }
  .logo-kop { width: 18mm; height: 18mm; object-fit: contain; margin: 2px auto; display: block; }
  .ttd-wrap { position: relative; height: 22mm; margin-top: 4px; }
  .ttd-img { width: 18mm; max-height: 16mm; object-fit: contain; display: block; margin: 0 auto; }
  .stempel { position: absolute; top: -2mm; left: 50%%; transform: translateX(-65%%); width: 22mm; height: 22mm; object-fit: contain; opacity: 0.85; }
  @media print { body { padding: 0; } }
</style></head>
<body>
%s
<div class="center bold xl">%s</div>
<div class="center">%s</div>
<div class="center">Telp: %s</div>
<div class="sep"></div>
<div class="center bold lg">KUITANSI PEMBAYARAN</div>
<div class="sep"></div>
<table>
  <tr><td>No. Kuitansi</td><td class="right bold">%s</td></tr>
  <tr><td>Tanggal</td><td class="right">%s</td></tr>
  <tr><td>Petugas</td><td class="right">%s</td></tr>
</table>
<div class="sep"></div>
<table>
  <tr><td>Siswa</td><td class="right bold">%s</td></tr>
  <tr><td>Kelas</td><td class="right">%s</td></tr>
  <tr><td>NIS</td><td class="right">%s</td></tr>
</table>
<div class="sep"></div>
<table>
  <tr><td>Untuk</td><td class="right bold">%s</td></tr>
  <tr><td>Periode</td><td class="right">%s</td></tr>
  <tr><td>Tagihan</td><td class="right">%s</td></tr>
  %s
  <tr><td>Total</td><td class="right bold">%s</td></tr>
  <tr><td>Sebelumnya</td><td class="right">%s</td></tr>
</table>
<div class="sep"></div>
<table>
  <tr><td class="bold lg">DIBAYAR</td><td class="right bold lg">%s</td></tr>
  <tr><td>Metode</td><td class="right">%s</td></tr>
  <tr><td>Sisa</td><td class="right bold">%s</td></tr>
  <tr><td>Status</td><td class="right bold">%s</td></tr>
</table>
<div class="sep"></div>
%s
<div class="center footer">Simpan kuitansi ini sebagai bukti pembayaran sah.</div>
%s
<script>window.onload=function(){window.print();}</script>
</body></html>`,
		p.NomorKuitansi,
		// Logo kop (kalau ada)
		func() string {
			if school.LogoURL != "" {
				return fmt.Sprintf(`<img src="%s" class="logo-kop" alt="Logo">`, school.LogoURL)
			}
			return ""
		}(),
		school.Name,
		school.Address,
		school.Phone,
		p.NomorKuitansi,
		p.TanggalBayar.Format("02 Jan 2006 15:04"),
		p.PetugasNama,
		p.Student.User.Name,
		p.Student.Class.Name,
		p.Student.User.StudentID,
		p.Tagihan.JenisTagihan.Nama,
		p.Tagihan.Periode,
		formatRupiah(p.Tagihan.Nominal),
		func() string {
			if p.Tagihan.Keringanan > 0 {
				return fmt.Sprintf(`<tr><td>Keringanan</td><td class="right">- %s</td></tr>`, formatRupiah(p.Tagihan.Keringanan))
			}
			return ""
		}(),
		formatRupiah(p.Tagihan.TotalTagihan()),
		formatRupiah(p.Tagihan.Terbayar-p.NominalBayar),
		formatRupiah(p.NominalBayar),
		strings.ToUpper(p.Metode),
		formatRupiah(sisa),
		statusBayar,
		// Block TTD + stempel bendahara
		func() string {
			if p.Void {
				return `<div class="center bold">~ DIBATALKAN ~</div>`
			}
			tgl := p.TanggalBayar.Format("02 Jan 2006")
			kab := school.Kabupaten
			if kab == "" {
				kab = ""
			} else {
				kab += ", "
			}
			ttdImg := ""
			if school.BendaharaTTD != "" {
				ttdImg = fmt.Sprintf(`<img src="%s" class="ttd-img">`, school.BendaharaTTD)
			}
			stempelImg := ""
			if school.StempelURL != "" {
				stempelImg = fmt.Sprintf(`<img src="%s" class="stempel">`, school.StempelURL)
			}
			nm := school.BendaharaName
			if nm == "" {
				nm = p.PetugasNama
			}
			nip := ""
			if school.BendaharaNIP != "" {
				nip = "NIP. " + school.BendaharaNIP
			}
			return fmt.Sprintf(`<div class="center" style="font-size:10px">%s%s</div>
<div class="center" style="font-size:10px">Bendahara,</div>
<div class="ttd-wrap">%s%s</div>
<div class="center bold" style="text-decoration:underline">%s</div>
<div class="center" style="font-size:9px">%s</div>`, kab, tgl, stempelImg, ttdImg, nm, nip)
		}(),
		func() string {
			if p.Void {
				return `<div class="sep"></div><div class="center bold" style="color:#a00">*** PEMBAYARAN INI DIBATALKAN ***</div>`
			}
			return ""
		}(),
	)

	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.SendString(html)
}

// ─── Bulk Generate ────────────────────────────────────────

// POST /api/billing/generate
// Body: {jenis_tagihan_id, class_ids:[], student_ids:[], periode, nominal_override, jatuh_tempo, keringanan_map:{student_id: amount}}
func GenerateTagihan(c *fiber.Ctx) error {
	sid := schoolID(c)
	var req struct {
		JenisTagihanID  uint               `json:"jenis_tagihan_id"`
		ClassIDs        []uint             `json:"class_ids"`         // empty = all classes
		StudentIDs      []uint             `json:"student_ids"`       // optional override
		Periode         string             `json:"periode"`           // mis. "2026-05" atau "Ganjil 2025/2026"
		NominalOverride *float64           `json:"nominal_override"`  // override default JenisTagihan.NominalDefault
		JatuhTempo      string             `json:"jatuh_tempo"`       // ISO date
		KeringananMap   map[string]float64 `json:"keringanan_map"`    // {"123": 100000} keringanan rupiah per student
		KeringananNote  string             `json:"keringanan_note"`
		Catatan         string             `json:"catatan"`
		SkipExisting    bool               `json:"skip_existing"`     // true = skip kalau sudah ada (jenis+student+periode)
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.JenisTagihanID == 0 || req.Periode == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Jenis tagihan dan periode wajib diisi"})
	}

	var jt models.JenisTagihan
	if err := config.DB.Where("id = ? AND school_id = ?", req.JenisTagihanID, sid).First(&jt).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Jenis tagihan not found"})
	}

	nominal := jt.NominalDefault
	if req.NominalOverride != nil && *req.NominalOverride > 0 {
		nominal = *req.NominalOverride
	}

	jatuhTempo, _ := time.Parse("2006-01-02", req.JatuhTempo)

	// Resolve target students
	var students []models.Student
	q := config.DB.Where("school_id = ?", sid)
	if len(req.StudentIDs) > 0 {
		q = q.Where("id IN ?", req.StudentIDs)
	} else if len(req.ClassIDs) > 0 {
		q = q.Where("class_id IN ?", req.ClassIDs)
	}
	q.Find(&students)

	if len(students) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Tidak ada siswa yang cocok"})
	}

	created := 0
	skipped := 0
	var newIDs []uint

	for _, s := range students {
		// Skip if exists
		if req.SkipExisting {
			var exist int64
			config.DB.Model(&models.Tagihan{}).
				Where("school_id = ? AND student_id = ? AND jenis_tagihan_id = ? AND periode = ?",
					sid, s.ID, req.JenisTagihanID, req.Periode).
				Count(&exist)
			if exist > 0 {
				skipped++
				continue
			}
		}

		keringanan := float64(0)
		keringananNote := req.KeringananNote
		if v, ok := req.KeringananMap[strconv.Itoa(int(s.ID))]; ok {
			keringanan = v
		}
		// Auto-apply potongan kalau jenis tagihan ApplyPotongan=true
		// Manual keringanan (KeringananMap) override auto-potongan
		if jt.ApplyPotongan && keringanan == 0 {
			autoNominal, autoNote := CalcPotonganForStudent(sid, s.ID)
			if autoNominal > 0 {
				keringanan = autoNominal
				if autoNote != "" {
					keringananNote = "Potongan: " + autoNote
				}
			}
		}

		t := models.Tagihan{
			SchoolID:       sid,
			StudentID:      s.ID,
			JenisTagihanID: req.JenisTagihanID,
			Periode:        req.Periode,
			Nominal:        nominal,
			Keringanan:     keringanan,
			KeringananNote: keringananNote,
			JatuhTempo:     jatuhTempo,
			Status:         "belum_bayar",
			Catatan:        req.Catatan,
		}
		if err := config.DB.Create(&t).Error; err == nil {
			created++
			newIDs = append(newIDs, t.ID)
		}
	}

	// Trigger notif untuk semua tagihan baru (background)
	go func(ids []uint) {
		for _, id := range ids {
			notifyTagihanBaru(sid, id)
		}
	}(newIDs)

	return c.JSON(fiber.Map{
		"message":       fmt.Sprintf("Generate selesai: %d dibuat, %d dilewati", created, skipped),
		"created":       created,
		"skipped":       skipped,
		"total_targets": len(students),
	})
}

// ─── Pembayaran ───────────────────────────────────────────

// POST /api/billing/bayar
// Body: {tagihan_id, nominal_bayar, tanggal_bayar, metode, bukti_url, catatan}
func CreatePembayaran(c *fiber.Ctx) error {
	sid := schoolID(c)
	uid := userID(c)

	var req struct {
		TagihanID    uint    `json:"tagihan_id"`
		NominalBayar float64 `json:"nominal_bayar"`
		TanggalBayar string  `json:"tanggal_bayar"`
		Metode       string  `json:"metode"`
		BuktiURL     string  `json:"bukti_url"`
		Catatan      string  `json:"catatan"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.TagihanID == 0 || req.NominalBayar <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Tagihan dan nominal wajib diisi"})
	}

	// Validate tagihan
	var t models.Tagihan
	if err := config.DB.Where("id = ? AND school_id = ?", req.TagihanID, sid).First(&t).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Tagihan not found"})
	}
	if t.Status == "batal" {
		return c.Status(400).JSON(fiber.Map{"error": "Tagihan sudah dibatalkan"})
	}

	// Get petugas name
	var petugas models.User
	config.DB.First(&petugas, uid)

	tanggal, _ := time.Parse("2006-01-02", req.TanggalBayar)
	if tanggal.IsZero() {
		tanggal = time.Now()
	}
	metode := req.Metode
	if metode == "" {
		metode = "cash"
	}

	p := models.Pembayaran{
		SchoolID:      sid,
		TagihanID:     t.ID,
		StudentID:     t.StudentID,
		NominalBayar:  req.NominalBayar,
		TanggalBayar:  tanggal,
		Metode:        metode,
		BuktiURL:      req.BuktiURL,
		PetugasID:     uid,
		PetugasNama:   petugas.Name,
		NomorKuitansi: generateNomorKuitansi(sid, time.Now()),
		Catatan:       req.Catatan,
	}

	tx := config.DB.Begin()
	if err := tx.Create(&p).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if err := recalcTagihan(tx, t.ID); err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	tx.Commit()

	// Notif lunas (kalau status jadi lunas)
	config.DB.First(&t, t.ID)
	if t.Status == "lunas" {
		go notifyTagihanLunas(sid, t.ID, p.ID)
	}

	return c.JSON(p)
}

// POST /api/billing/pembayaran/:id/void
func VoidPembayaran(c *fiber.Ctx) error {
	sid := schoolID(c)
	uid := userID(c)
	var p models.Pembayaran
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), sid).First(&p).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Pembayaran not found"})
	}
	if p.Void {
		return c.Status(400).JSON(fiber.Map{"error": "Pembayaran sudah di-void"})
	}
	var req struct {
		Reason string `json:"reason"`
	}
	c.BodyParser(&req)
	now := time.Now()
	p.Void = true
	p.VoidReason = req.Reason
	p.VoidAt = &now
	p.VoidBy = uid

	tx := config.DB.Begin()
	tx.Save(&p)
	recalcTagihan(tx, p.TagihanID)
	tx.Commit()

	return c.JSON(fiber.Map{"message": "Pembayaran dibatalkan", "pembayaran": p})
}

// GET /api/billing/pembayaran (list filter)
func GetPembayaranList(c *fiber.Ctx) error {
	sid := schoolID(c)
	q := config.DB.Model(&models.Pembayaran{}).Where("pembayarans.school_id = ?", sid)
	if studentID := c.Query("student_id"); studentID != "" {
		q = q.Where("pembayarans.student_id = ?", studentID)
	}
	if from := c.Query("from"); from != "" {
		q = q.Where("tanggal_bayar >= ?", from)
	}
	if to := c.Query("to"); to != "" {
		q = q.Where("tanggal_bayar <= ?", to)
	}
	if c.Query("include_void") != "true" {
		q = q.Where("void = ?", false)
	}

	var list []models.Pembayaran
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	q.Preload("Student").Preload("Student.User").
		Preload("Tagihan").Preload("Tagihan.JenisTagihan").
		Order("tanggal_bayar DESC, id DESC").
		Limit(limit).Offset(offset).Find(&list)

	var total int64
	q.Session(&gorm.Session{}).Count(&total)

	return c.JSON(fiber.Map{"data": list, "total": total})
}

// ─── Dashboard ────────────────────────────────────────────

// GET /api/billing/dashboard
func GetBillingDashboard(c *fiber.Ctx) error {
	sid := schoolID(c)
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	monthEnd := monthStart.AddDate(0, 1, 0)

	type Stats struct {
		TotalTagihan        float64 `json:"total_tagihan"`
		TotalTerbayar       float64 `json:"total_terbayar"`
		TotalKeringanan     float64 `json:"total_keringanan"`
		TotalTunggakan      float64 `json:"total_tunggakan"`
		TerbayarBulanIni    float64 `json:"terbayar_bulan_ini"`
		CountSiswaTunggakan int64   `json:"count_siswa_tunggakan"`
		CountTagihanLunas   int64   `json:"count_tagihan_lunas"`
		CountTagihanBelum   int64   `json:"count_tagihan_belum"`
		CountTagihanBagian  int64   `json:"count_tagihan_sebagian"`
	}
	var s Stats

	config.DB.Model(&models.Tagihan{}).Where("school_id = ? AND status != ?", sid, "batal").
		Select("COALESCE(SUM(nominal),0)").Scan(&s.TotalTagihan)
	config.DB.Model(&models.Tagihan{}).Where("school_id = ? AND status != ?", sid, "batal").
		Select("COALESCE(SUM(terbayar),0)").Scan(&s.TotalTerbayar)
	config.DB.Model(&models.Tagihan{}).Where("school_id = ? AND status != ?", sid, "batal").
		Select("COALESCE(SUM(keringanan),0)").Scan(&s.TotalKeringanan)
	s.TotalTunggakan = s.TotalTagihan - s.TotalKeringanan - s.TotalTerbayar

	config.DB.Model(&models.Pembayaran{}).
		Where("school_id = ? AND void = ? AND tanggal_bayar >= ? AND tanggal_bayar < ?", sid, false, monthStart, monthEnd).
		Select("COALESCE(SUM(nominal_bayar),0)").Scan(&s.TerbayarBulanIni)

	config.DB.Model(&models.Tagihan{}).Where("school_id = ? AND status = ?", sid, "lunas").Count(&s.CountTagihanLunas)
	config.DB.Model(&models.Tagihan{}).Where("school_id = ? AND status = ?", sid, "belum_bayar").Count(&s.CountTagihanBelum)
	config.DB.Model(&models.Tagihan{}).Where("school_id = ? AND status = ?", sid, "sebagian").Count(&s.CountTagihanBagian)

	config.DB.Model(&models.Tagihan{}).
		Where("school_id = ? AND status IN ?", sid, []string{"belum_bayar", "sebagian"}).
		Distinct("student_id").Count(&s.CountSiswaTunggakan)

	// Top defaulter — siswa dengan total tunggakan terbesar
	type Defaulter struct {
		StudentID    uint    `json:"student_id"`
		StudentName  string  `json:"student_name"`
		ClassName    string  `json:"class_name"`
		Tunggakan    float64 `json:"tunggakan"`
		CountTagihan int64   `json:"count_tagihan"`
	}
	var defaulters []Defaulter
	config.DB.Raw(`
		SELECT
			t.student_id,
			COALESCE(u.name, '-') AS student_name,
			COALESCE(c.name, '-') AS class_name,
			SUM(t.nominal - t.keringanan - t.terbayar) AS tunggakan,
			COUNT(t.id) AS count_tagihan
		FROM tagihans t
		LEFT JOIN students s ON s.id = t.student_id
		LEFT JOIN users u ON u.id = s.user_id
		LEFT JOIN classes c ON c.id = s.class_id
		WHERE t.school_id = ? AND t.status IN ('belum_bayar','sebagian') AND t.deleted_at IS NULL
		GROUP BY t.student_id, u.name, c.name
		HAVING SUM(t.nominal - t.keringanan - t.terbayar) > 0
		ORDER BY tunggakan DESC
		LIMIT 10
	`, sid).Scan(&defaulters)

	// Recent payments
	var recentPayments []models.Pembayaran
	config.DB.Where("school_id = ? AND void = ?", sid, false).
		Preload("Student").Preload("Student.User").
		Preload("Tagihan").Preload("Tagihan.JenisTagihan").
		Order("created_at DESC").Limit(5).Find(&recentPayments)

	return c.JSON(fiber.Map{
		"stats":           s,
		"top_defaulters":  defaulters,
		"recent_payments": recentPayments,
	})
}

// ─── Notif Triggers ───────────────────────────────────────

func notifyTagihanBaru(schoolID, tagihanID uint) {
	defer func() { _ = recover() }()

	if !notifications.IsEventEnabled(config.DB, schoolID, "tagihan") {
		return
	}
	var t models.Tagihan
	if err := config.DB.Preload("Student").Preload("Student.User").Preload("JenisTagihan").
		First(&t, tagihanID).Error; err != nil {
		return
	}
	// Get parent phone
	var pa models.ParentAccess
	if err := config.DB.Where("student_id = ?", t.StudentID).First(&pa).Error; err != nil {
		return
	}
	if pa.Phone == "" {
		return
	}

	total := t.TotalTagihan()
	keringananLine := ""
	if t.Keringanan > 0 {
		keringananLine = fmt.Sprintf("\nKeringanan: %s (%s)", formatRupiah(t.Keringanan), strings.TrimSpace(t.KeringananNote))
	}
	jatuh := "—"
	if !t.JatuhTempo.IsZero() {
		jatuh = t.JatuhTempo.Format("02 Jan 2006")
	}

	msg := fmt.Sprintf(
		"📋 *Tagihan Baru*\n\n"+
			"Untuk: %s\n"+
			"Jenis: %s\n"+
			"Periode: %s\n"+
			"Nominal: %s%s\n"+
			"*Total Bayar: %s*\n"+
			"Jatuh tempo: %s\n\n"+
			"Bisa cicil. Mohon dilunasi sebelum jatuh tempo. Terima kasih.",
		t.Student.User.Name, t.JenisTagihan.Nama, t.Periode,
		formatRupiah(t.Nominal), keringananLine,
		formatRupiah(total), jatuh,
	)

	studentID := t.StudentID
	notifications.Enqueue(config.DB, notifications.Outbox{
		SchoolID:  schoolID,
		Event:     "tagihan",
		Recipient: pa.Phone,
		StudentID: &studentID,
		Message:   msg,
	})
}

func notifyTagihanLunas(schoolID, tagihanID, pembayaranID uint) {
	defer func() { _ = recover() }()

	if !notifications.IsEventEnabled(config.DB, schoolID, "lunas") {
		return
	}
	var t models.Tagihan
	if err := config.DB.Preload("Student").Preload("Student.User").Preload("JenisTagihan").
		First(&t, tagihanID).Error; err != nil {
		return
	}
	var p models.Pembayaran
	if err := config.DB.First(&p, pembayaranID).Error; err != nil {
		return
	}
	var pa models.ParentAccess
	if err := config.DB.Where("student_id = ?", t.StudentID).First(&pa).Error; err != nil {
		return
	}
	if pa.Phone == "" {
		return
	}

	msg := fmt.Sprintf(
		"✅ *Pembayaran Lunas*\n\n"+
			"%s — %s (%s) telah LUNAS.\n"+
			"Total dibayar: %s\n"+
			"No. Kuitansi terakhir: %s\n\n"+
			"Terima kasih atas pembayarannya.",
		t.JenisTagihan.Nama, t.Student.User.Name, t.Periode,
		formatRupiah(t.Terbayar),
		p.NomorKuitansi,
	)
	studentID := t.StudentID
	notifications.Enqueue(config.DB, notifications.Outbox{
		SchoolID:  schoolID,
		Event:     "lunas",
		Recipient: pa.Phone,
		StudentID: &studentID,
		Message:   msg,
	})
}

// ─── Json marshaling helper for query strings (placeholder) ─

var _ = json.Marshal
