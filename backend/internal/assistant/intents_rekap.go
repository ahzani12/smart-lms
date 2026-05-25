package assistant

import (
	"regexp"
	"strings"
	"time"
)

// ─── Intent REKAP.* ─────────────────────────────────────────────
//
// REKAP.ABSEN_TODAY    — "siswa tidak masuk hari ini" / "siapa yg sakit hari ini"
//                        + opsional kelas: "siswa absen X IPA 1 hari ini"
// REKAP.ABSEN_STUDENT  — "rekap absen Ahmad bulan ini" / "absensi Dimas minggu ini"
//
// Output slot: ParsedRekap di Intent.Slots["rekap"]

type ParsedRekap struct {
	Scope      string    `json:"scope"`                  // "absen_today" | "absen_student"
	StatusFilt string    `json:"status_filt,omitempty"`  // "" / "sakit" / "izin" / "alfa" / "terlambat"
	KelasRaw   string    `json:"kelas_raw,omitempty"`    // utk absen_today filter kelas
	StudentRaw string    `json:"student_raw,omitempty"`  // utk absen_student
	Tanggal    time.Time `json:"tanggal"`                // tanggal acuan (utk absen_today: 1 hari, utk absen_student: dlm range)
	From       time.Time `json:"from,omitempty"`         // utk absen_student range
	To         time.Time `json:"to,omitempty"`           // utk absen_student range
	Periode    string    `json:"periode,omitempty"`      // label periode: "hari ini", "bulan ini", "minggu ini", "2026-05"
}

// ─── Patterns ────────────────────────────────────────────────

// "siswa tidak masuk [kelas X IPA 1] [hari ini]"
var reRekapAbsenTidakMasuk = regexp.MustCompile(`^(?:siswa\s+)?(?:siapa\s+(?:yang\s+|yg\s+)?)?(?:tidak|tdk|gak|nggak|ga)\s+(?:masuk|hadir|datang)(?:\s+(?:di\s+)?(?:kelas\s+)?(?P<kelas>[a-z0-9 ]+?))??(?:\s+(?P<tgl>hari ini|kemarin|kmrn))?\s*$`)

// "siapa yg sakit [di X IPA 1] [hari ini]"
var reRekapAbsenStatus = regexp.MustCompile(`^(?:siapa(?:\s+(?:yang|yg))?|siswa(?:\s+(?:yang|yg))?)\s+(?P<status>sakit|izin|alfa|alpa|alpha|bolos|terlambat|telat)(?:\s+(?:di\s+)?(?:kelas\s+)?(?P<kelas>[a-z0-9 ]+?))??(?:\s+(?P<tgl>hari ini|kemarin|kmrn))?\s*$`)

// "rekap absen [kelas X IPA 1] hari ini"
var reRekapAbsenToday = regexp.MustCompile(`^(?:rekap\s+)?absensi?(?:\s+(?:di\s+)?(?:kelas\s+)?(?P<kelas>[a-z0-9 ]+?))??\s+(?P<tgl>hari ini|kemarin|kmrn)\s*$`)

// "siapa absen hari ini" — generic ATAU "siswa absen [di kelas X IPA 1] [hari ini]"
var reRekapAbsenGeneric = regexp.MustCompile(`^(?:siapa(?:\s+(?:yang|yg))?|siswa(?:\s+(?:yang|yg))?)\s+(?:absen|abs|gak\s+masuk|tidak\s+masuk|tdk\s+masuk)(?:\s+(?:di\s+)?(?:kelas\s+)?(?P<kelas>[a-z0-9 ]+?))??(?:\s+(?P<tgl>hari ini|kemarin|kmrn))?\s*$`)

// "rekap absen Ahmad bulan ini" / "absensi Dimas minggu ini" / "absen Sari hari ini"
var reRekapAbsenStudent = regexp.MustCompile(`^(?:rekap\s+)?(?:absen|absensi)\s+(?P<nama>[a-z][a-z' ]{1,40}?)(?:\s+(?P<periode>bulan ini|minggu ini|hari ini|kemarin|bulan kemarin|bulan lalu|minggu lalu|\d{4}-\d{2}))\s*$`)

// ─── Matchers ────────────────────────────────────────────────

func matchRekapAbsenTidakMasuk(input string) *Intent {
	m := reRekapAbsenTidakMasuk.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reRekapAbsenTidakMasuk, m)
	tgl := parseTanggal(g["tgl"])
	if tgl.IsZero() {
		tgl = time.Now()
	}
	return &Intent{
		ID: "REKAP.ABSEN_TODAY", Confidence: 0.92,
		Slots: map[string]interface{}{
			"rekap": ParsedRekap{
				Scope:    "absen_today",
				KelasRaw: cleanKelasRaw(g["kelas"]),
				Tanggal:  tgl,
			},
		},
	}
}

func matchRekapAbsenStatus(input string) *Intent {
	m := reRekapAbsenStatus.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reRekapAbsenStatus, m)
	status := strings.ToLower(g["status"])
	switch status {
	case "alpa", "alpha", "bolos":
		status = "alfa"
	case "telat":
		status = "terlambat"
	}
	tgl := parseTanggal(g["tgl"])
	if tgl.IsZero() {
		tgl = time.Now()
	}
	return &Intent{
		ID: "REKAP.ABSEN_TODAY", Confidence: 0.9,
		Slots: map[string]interface{}{
			"rekap": ParsedRekap{
				Scope:      "absen_today",
				StatusFilt: status,
				KelasRaw:   cleanKelasRaw(g["kelas"]),
				Tanggal:    tgl,
			},
		},
	}
}

func matchRekapAbsenToday(input string) *Intent {
	m := reRekapAbsenToday.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reRekapAbsenToday, m)
	tgl := parseTanggal(g["tgl"])
	if tgl.IsZero() {
		tgl = time.Now()
	}
	return &Intent{
		ID: "REKAP.ABSEN_TODAY", Confidence: 0.93,
		Slots: map[string]interface{}{
			"rekap": ParsedRekap{
				Scope:    "absen_today",
				KelasRaw: cleanKelasRaw(g["kelas"]),
				Tanggal:  tgl,
			},
		},
	}
}

func matchRekapAbsenGeneric(input string) *Intent {
	m := reRekapAbsenGeneric.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reRekapAbsenGeneric, m)
	tgl := parseTanggal(g["tgl"])
	if tgl.IsZero() {
		tgl = time.Now()
	}
	return &Intent{
		ID: "REKAP.ABSEN_TODAY", Confidence: 0.88,
		Slots: map[string]interface{}{
			"rekap": ParsedRekap{
				Scope:    "absen_today",
				KelasRaw: cleanKelasRaw(g["kelas"]),
				Tanggal:  tgl,
			},
		},
	}
}

// matchRekapAbsenStudent — "rekap absen Ahmad bulan ini"
func matchRekapAbsenStudent(input string) *Intent {
	m := reRekapAbsenStudent.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reRekapAbsenStudent, m)
	nama := strings.TrimSpace(g["nama"])
	periode := strings.TrimSpace(g["periode"])
	if nama == "" || periode == "" {
		return nil
	}
	from, to, label := parsePeriode(periode)
	return &Intent{
		ID: "REKAP.ABSEN_STUDENT", Confidence: 0.91,
		Slots: map[string]interface{}{
			"rekap": ParsedRekap{
				Scope:      "absen_student",
				StudentRaw: nama,
				From:       from,
				To:         to,
				Periode:    label,
			},
		},
	}
}

// cleanKelasRaw — strip kata noise sebelum kelas dianggap valid.
// "" tetap "", "di hari ini" balik ke "" karena gak ada angka/format kelas.
func cleanKelasRaw(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	// Buang kata tanggal kalau masuk
	s = strings.TrimSpace(strings.ReplaceAll(s, "hari ini", ""))
	s = strings.TrimSpace(strings.ReplaceAll(s, "kemarin", ""))
	s = strings.TrimSpace(strings.ReplaceAll(s, "kmrn", ""))
	if s == "" {
		return ""
	}
	// Heuristik: kelas valid biasanya punya angka atau pattern roman
	if regexp.MustCompile(`\d|^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\b`).MatchString(s) {
		return s
	}
	return ""
}

// parsePeriode — "bulan ini", "minggu ini", "2026-05", dst → from, to, label
func parsePeriode(s string) (time.Time, time.Time, string) {
	now := time.Now()
	loc := now.Location()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	endToday := today.Add(24 * time.Hour).Add(-time.Second)

	switch s {
	case "hari ini":
		return today, endToday, "hari ini"
	case "kemarin":
		y := today.AddDate(0, 0, -1)
		return y, y.Add(24 * time.Hour).Add(-time.Second), "kemarin"
	case "minggu ini":
		// senin sd minggu
		offset := int(today.Weekday()) - 1
		if offset < 0 {
			offset = 6 // minggu → 7 hari sebelumnya
		}
		from := today.AddDate(0, 0, -offset)
		to := from.AddDate(0, 0, 6).Add(24 * time.Hour).Add(-time.Second)
		return from, to, "minggu ini"
	case "minggu lalu":
		offset := int(today.Weekday()) - 1
		if offset < 0 {
			offset = 6
		}
		thisMon := today.AddDate(0, 0, -offset)
		from := thisMon.AddDate(0, 0, -7)
		to := thisMon.Add(-time.Second)
		return from, to, "minggu lalu"
	case "bulan ini":
		from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
		to := from.AddDate(0, 1, 0).Add(-time.Second)
		return from, to, "bulan ini"
	case "bulan kemarin", "bulan lalu":
		thisMon := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
		from := thisMon.AddDate(0, -1, 0)
		to := thisMon.Add(-time.Second)
		return from, to, "bulan lalu"
	}
	// Format YYYY-MM
	if re := regexp.MustCompile(`^(\d{4})-(\d{2})$`).FindStringSubmatch(s); len(re) == 3 {
		var y, mo int
		_, _ = sscan(re[1], &y)
		_, _ = sscan(re[2], &mo)
		from := time.Date(y, time.Month(mo), 1, 0, 0, 0, 0, loc)
		to := from.AddDate(0, 1, 0).Add(-time.Second)
		return from, to, s
	}
	// fallback: bulan ini
	from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
	to := from.AddDate(0, 1, 0).Add(-time.Second)
	return from, to, "bulan ini"
}
