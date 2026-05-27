package handlers

import (
	"strconv"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ─── POTONGAN MASTER ────────────────────────────────────────

// GetPotongan returns list potongan untuk school aktif
func GetPotongan(c *fiber.Ctx) error {
	sid := schoolID(c)
	var items []models.Potongan
	config.DB.Where("school_id = ?", sid).Order("nama").Find(&items)

	// Hitung jumlah siswa per potongan
	type potonganOut struct {
		models.Potongan
		StudentCount int64 `json:"student_count"`
	}
	out := make([]potonganOut, 0, len(items))
	for _, p := range items {
		var cnt int64
		config.DB.Model(&models.StudentPotongan{}).
			Where("school_id = ? AND potongan_id = ?", sid, p.ID).
			Count(&cnt)
		out = append(out, potonganOut{Potongan: p, StudentCount: cnt})
	}
	return c.JSON(out)
}

func CreatePotongan(c *fiber.Ctx) error {
	var p models.Potongan
	if err := c.BodyParser(&p); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if p.Nama == "" || p.Nominal <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Nama dan nominal wajib diisi"})
	}
	p.SchoolID = schoolID(c)
	if err := config.DB.Create(&p).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(p)
}

func UpdatePotongan(c *fiber.Ctx) error {
	sid := schoolID(c)
	var p models.Potongan
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), sid).First(&p).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	var req struct {
		Nama      *string  `json:"nama"`
		Kode      *string  `json:"kode"`
		Deskripsi *string  `json:"deskripsi"`
		Nominal   *float64 `json:"nominal"`
		Aktif     *bool    `json:"aktif"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Nama != nil {
		p.Nama = *req.Nama
	}
	if req.Kode != nil {
		p.Kode = *req.Kode
	}
	if req.Deskripsi != nil {
		p.Deskripsi = *req.Deskripsi
	}
	if req.Nominal != nil {
		p.Nominal = *req.Nominal
	}
	if req.Aktif != nil {
		p.Aktif = *req.Aktif
	}
	config.DB.Save(&p)
	return c.JSON(p)
}

func DeletePotongan(c *fiber.Ctx) error {
	sid := schoolID(c)
	id := paramID(c)
	// Cek apakah masih dipakai siswa
	var cnt int64
	config.DB.Model(&models.StudentPotongan{}).Where("school_id = ? AND potongan_id = ?", sid, id).Count(&cnt)
	if cnt > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "Potongan ini masih dipakai " + strconv.FormatInt(cnt, 10) + " siswa. Lepas dulu dari siswa.",
		})
	}
	config.DB.Where("id = ? AND school_id = ?", id, sid).Delete(&models.Potongan{})
	return c.JSON(fiber.Map{"message": "Potongan dihapus"})
}

// ─── ASSIGN POTONGAN KE SISWA ───────────────────────────────

// GetPotonganStudents returns daftar siswa yang dapat potongan tertentu
func GetPotonganStudents(c *fiber.Ctx) error {
	sid := schoolID(c)
	pid := paramID(c)

	var items []models.StudentPotongan
	config.DB.Preload("Student").Preload("Student.Class").
		Where("school_id = ? AND potongan_id = ?", sid, pid).
		Order("created_at DESC").
		Find(&items)
	return c.JSON(items)
}

// AssignPotonganStudents — bulk assign list student_ids ke 1 potongan
func AssignPotonganStudents(c *fiber.Ctx) error {
	sid := schoolID(c)
	pid := paramID(c)

	// Verify potongan exists
	var p models.Potongan
	if err := config.DB.Where("id = ? AND school_id = ?", pid, sid).First(&p).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Potongan not found"})
	}

	var req struct {
		StudentIDs []uint `json:"student_ids"`
		Catatan    string `json:"catatan"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if len(req.StudentIDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Pilih minimal 1 siswa"})
	}

	added := 0
	skipped := 0
	for _, sid2 := range req.StudentIDs {
		// Skip kalau udah ada (unique index will reject anyway, tapi cek dulu biar gak noise)
		var exist int64
		config.DB.Model(&models.StudentPotongan{}).
			Where("school_id = ? AND student_id = ? AND potongan_id = ?", sid, sid2, pid).
			Count(&exist)
		if exist > 0 {
			skipped++
			continue
		}
		sp := models.StudentPotongan{
			SchoolID:   sid,
			StudentID:  sid2,
			PotonganID: p.ID,
			Catatan:    req.Catatan,
		}
		if err := config.DB.Create(&sp).Error; err == nil {
			added++
		}
	}
	return c.JSON(fiber.Map{
		"message": "Assignment selesai",
		"added":   added,
		"skipped": skipped,
	})
}

// UnassignPotonganStudent — lepas 1 siswa dari potongan
func UnassignPotonganStudent(c *fiber.Ctx) error {
	sid := schoolID(c)
	spid := paramID(c)
	res := config.DB.Where("id = ? AND school_id = ?", spid, sid).Delete(&models.StudentPotongan{})
	if res.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	return c.JSON(fiber.Map{"message": "Siswa dilepas dari potongan"})
}

// GetStudentPotongan — list potongan aktif untuk 1 siswa
func GetStudentPotongan(c *fiber.Ctx) error {
	sid := schoolID(c)
	studentID := paramID(c)
	var items []models.StudentPotongan
	config.DB.Preload("Potongan").
		Where("school_id = ? AND student_id = ?", sid, studentID).
		Find(&items)
	return c.JSON(items)
}

// CalcPotonganForStudent — sum nominal semua potongan aktif untuk 1 siswa
// Dipakai oleh GenerateTagihan saat ApplyPotongan=true.
func CalcPotonganForStudent(schoolID, studentID uint) (float64, string) {
	var items []models.StudentPotongan
	config.DB.Preload("Potongan").
		Where("school_id = ? AND student_id = ?", schoolID, studentID).
		Find(&items)

	total := float64(0)
	notes := ""
	for _, sp := range items {
		if !sp.Potongan.Aktif {
			continue
		}
		total += sp.Potongan.Nominal
		if notes != "" {
			notes += ", "
		}
		notes += sp.Potongan.Nama
	}
	return total, notes
}
