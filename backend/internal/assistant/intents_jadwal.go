package assistant

import (
	"regexp"
	"strings"
	"time"
)

// ─── Intent JADWAL.* ─────────────────────────────────────────
//
// 4 sub-intent:
//   JADWAL.TODAY         "jadwal hari ini" / "jadwal kemarin"
//   JADWAL.KELAS         "jadwal X IPA 1" / "jadwal kelas 7A"
//   JADWAL.KELAS_HARI    "jadwal X IPA 1 senin" / "jadwal 7A hari rabu"
//   JADWAL.GURU          "jadwal saya" / "jadwal pak budi" / "jadwal bu ani hari kamis"
//
// Output slot: ParsedJadwal (di-attach ke Intent.Slots["jadwal"]).

// ParsedJadwal — slot khusus utk intent JADWAL.*
type ParsedJadwal struct {
	Scope     string    `json:"scope"`         // "today" / "kelas" / "kelas_hari" / "guru" / "guru_hari" / "saya"
	KelasRaw  string    `json:"kelas_raw,omitempty"`
	GuruRaw   string    `json:"guru_raw,omitempty"`   // "pak budi" / "ani"
	HariRaw   string    `json:"hari_raw,omitempty"`   // "senin" / "rabu" → 1..7
	DayOfWeek int       `json:"day_of_week,omitempty"` // 0 = semua hari
	Tanggal   time.Time `json:"tanggal,omitempty"`     // utk JADWAL.TODAY
}

// dayMap — Indonesia → ISO day-of-week (1=Senin, 7=Minggu)
var dayMap = map[string]int{
	"senin": 1, "sen": 1,
	"selasa": 2, "sel": 2,
	"rabu": 3, "rab": 3, "rbo": 3,
	"kamis": 4, "kam": 4, "kms": 4,
	"jumat": 5, "jum": 5, "jumaat": 5, "jumah": 5,
	"sabtu": 6, "sab": 6, "sbt": 6,
	"minggu": 7, "min": 7, "mgg": 7, "ahad": 7,
}

// ─── Patterns ────────────────────────────────────────────────

// "jadwal hari ini" / "jadwal kemarin" / "jadwal besok" / "jadwal lusa"
// Tanpa keyword kelas/guru, default ke konteks user (admin = semua, guru = saya).
var reJadwalToday = regexp.MustCompile(`^jadwal\s+(?P<tgl>hari ini|skrg|sekarang|kemarin|kmrn|besok|lusa)\s*$`)

// "jadwal saya" / "jadwal saya hari senin"
var reJadwalSaya = regexp.MustCompile(`^jadwal\s+saya(?:\s+(?:hari\s+)?(?P<hari>[a-z]+))?\s*$`)

// "jadwal pak budi" / "jadwal bu ani" / "jadwal pak budi hari rabu"
var reJadwalGuru = regexp.MustCompile(`^jadwal\s+(?:pak|bu|bpk|ibu|ustadz|ustadzah|ust)\s+(?P<nama>[a-z][a-z\s]+?)(?:\s+(?:hari\s+)?(?P<hari>[a-z]+))?\s*$`)

// "jadwal X IPA 1" / "jadwal kelas 7A" / "jadwal X IPA 1 senin" / "jadwal 7A hari rabu"
var reJadwalKelas = regexp.MustCompile(`^jadwal\s+(?:kelas\s+)?(?P<kelas>[a-z0-9][a-z0-9\s]+?)(?:\s+(?:hari\s+)?(?P<hari>senin|selasa|rabu|kamis|jumat|jumaat|sabtu|minggu|ahad))?\s*$`)

// ─── Matchers ────────────────────────────────────────────────

func matchJadwalToday(input string) *Intent {
	m := reJadwalToday.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reJadwalToday, m)
	tgl := parseTanggal(g["tgl"])
	return &Intent{
		ID: "JADWAL.TODAY", Confidence: 0.95,
		Slots: map[string]interface{}{
			"jadwal": ParsedJadwal{
				Scope:     "today",
				Tanggal:   tgl,
				DayOfWeek: isoDOW(tgl),
			},
		},
	}
}

func matchJadwalSaya(input string) *Intent {
	m := reJadwalSaya.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reJadwalSaya, m)
	dow := dayMap[g["hari"]] // 0 kalau gak ada
	return &Intent{
		ID: "JADWAL.GURU", Confidence: 0.9,
		Slots: map[string]interface{}{
			"jadwal": ParsedJadwal{
				Scope:     "saya",
				GuruRaw:   "saya",
				HariRaw:   g["hari"],
				DayOfWeek: dow,
			},
		},
	}
}

func matchJadwalGuru(input string) *Intent {
	m := reJadwalGuru.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reJadwalGuru, m)
	nama := strings.TrimSpace(g["nama"])
	hari := g["hari"]
	// Kalau "hari" sebenarnya bukan hari valid, masukin balik ke nama
	dow := 0
	if hari != "" {
		if d, ok := dayMap[hari]; ok {
			dow = d
		} else {
			nama = strings.TrimSpace(nama + " " + hari)
			hari = ""
		}
	}
	if !validNamaRaw(nama) {
		return nil
	}
	return &Intent{
		ID: "JADWAL.GURU", Confidence: 0.85,
		Slots: map[string]interface{}{
			"jadwal": ParsedJadwal{
				Scope:     "guru",
				GuruRaw:   nama,
				HariRaw:   hari,
				DayOfWeek: dow,
			},
		},
	}
}

func matchJadwalKelas(input string) *Intent {
	// Skip kalau diawali "jadwal saya" / "jadwal pak/bu" — biar matcher lain tangani
	if strings.HasPrefix(input, "jadwal saya") {
		return nil
	}
	if regexp.MustCompile(`^jadwal\s+(pak|bu|bpk|ibu|ustadz|ust)\b`).MatchString(input) {
		return nil
	}
	m := reJadwalKelas.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reJadwalKelas, m)
	kelas := strings.TrimSpace(g["kelas"])
	hari := g["hari"]
	dow := dayMap[hari]

	// Skip false positives: "jadwal hari ini" sudah ditangani matchJadwalToday;
	// kalau lolos kesini berarti pattern khusus (e.g. "jadwal 7a hari ini")
	if kelas == "hari" || kelas == "" {
		return nil
	}
	scope := "kelas"
	if dow > 0 {
		scope = "kelas_hari"
	}
	return &Intent{
		ID: "JADWAL.KELAS", Confidence: 0.88,
		Slots: map[string]interface{}{
			"jadwal": ParsedJadwal{
				Scope:     scope,
				KelasRaw:  kelas,
				HariRaw:   hari,
				DayOfWeek: dow,
			},
		},
	}
}

// ─── Helpers ─────────────────────────────────────────────────

func isoDOW(t time.Time) int {
	d := int(t.Weekday())
	if d == 0 {
		return 7 // Sunday → 7
	}
	return d
}

// namedGroups — extract named groups dari hasil regex match.
// (helper sama yg dipake di intents_absensi.go — di-define di sana)
