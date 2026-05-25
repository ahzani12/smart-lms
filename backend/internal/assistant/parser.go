// Package assistant — rule-based command parser untuk SSD.
// Engine ini gak pake LLM. Pure regex + sinonim + fuzzy matching.
//
// Flow: input → normalize → match intent → extract slots → resolve entities → preview/execute.
package assistant

import (
	"regexp"
	"strings"
	"time"
)

// ─── Sinonim dictionary ─────────────────────────────────────
// Kata-kata yg di-canonicalize sebelum di-match ke pattern.
// Contoh: "alpa", "bolos", "ga masuk" semua → "alfa"

var synonyms = map[string]string{
	// Status absensi
	"alpa":       "alfa",
	"bolos":      "alfa",
	"ga masuk":   "alfa",
	"gak masuk":  "alfa",
	"tdk hadir":  "alfa",
	"tidak hadir": "alfa",
	"masuk":      "hadir",
	"datang":     "hadir",
	"hadir semua": "semua hadir",
	"masuk semua": "semua hadir",
	"hadir lengkap": "semua hadir",
	"lengkap":    "semua hadir",
	"ijin":       "izin",
	"telat":      "terlambat",
	"kesiangan":  "terlambat",
	"demam":      "sakit",
	"opname":     "sakit",
	"dirawat":    "sakit",

	// Quantifier
	"semuanya":   "semua",
	"seluruh":    "semua",
	"all":        "semua",
}

// applySynonyms — replace sinonim dgn canonical form.
// Pakai longest-match agar "ga masuk" diproses sebelum "masuk".
func applySynonyms(s string) string {
	// Sort by length desc supaya longest-match
	type kv struct {
		k, v string
	}
	pairs := make([]kv, 0, len(synonyms))
	for k, v := range synonyms {
		pairs = append(pairs, kv{k, v})
	}
	// Manual selection sort, deterministic
	for i := 0; i < len(pairs); i++ {
		for j := i + 1; j < len(pairs); j++ {
			if len(pairs[j].k) > len(pairs[i].k) {
				pairs[i], pairs[j] = pairs[j], pairs[i]
			}
		}
	}
	for _, p := range pairs {
		// word-boundary aware via regex
		re := regexp.MustCompile(`\b` + regexp.QuoteMeta(p.k) + `\b`)
		s = re.ReplaceAllString(s, p.v)
	}
	return s
}

// Normalize — lowercase, trim multi-space, expand sinonim.
func Normalize(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	// Hapus multi-space
	s = regexp.MustCompile(`\s+`).ReplaceAllString(s, " ")
	// Hapus tanda baca yg ngeganggu (kecuali koma — penting buat list nama)
	s = regexp.MustCompile(`[!?.;:]`).ReplaceAllString(s, "")
	s = applySynonyms(s)
	return s
}

// ─── Intent definitions ─────────────────────────────────────

// Intent — hasil dari parser, sebelum dieksekusi.
type Intent struct {
	ID         string                 `json:"id"`         // ABSEN.BULK_HADIR, dst
	Confidence float64                `json:"confidence"` // 0-1
	Slots      map[string]interface{} `json:"slots"`
	Suggestions []string              `json:"suggestions,omitempty"` // kalau gak match
}

// ParsedAbsen — slot khusus utk intent ABSEN.*
type ParsedAbsen struct {
	KelasRaw  string         `json:"kelas_raw"`            // "7A" / "7 ipa 1"
	MapelRaw  string         `json:"mapel_raw,omitempty"`  // "matematika" / "" → harus dipilih dari jadwal
	Tanggal   time.Time      `json:"tanggal"`              // default: hari ini
	Default   string         `json:"default"`              // hadir / izin / alfa / sakit (default state utk semua siswa)
	Kecuali   []KecualiEntry `json:"kecuali,omitempty"`    // exception per siswa
}

// KecualiEntry — siswa dgn status berbeda dari default.
type KecualiEntry struct {
	NamaRaw string `json:"nama_raw"`
	Status  string `json:"status"`
	Note    string `json:"note,omitempty"`
}

// ─── Parser entrypoint ──────────────────────────────────────

// Parse — entrypoint utama. Coba match input ke salah satu intent.
// Kalau gagal, kembalikan Intent.ID = "" + Suggestions.
func Parse(rawInput string) *Intent {
	norm := Normalize(rawInput)

	// Try each intent matcher
	matchers := []func(string) *Intent{
		matchAbsenBulkHadir,
		matchAbsenMarkKecuali,
		matchAbsenSingle,
		// Jadwal — order matters: today > saya > guru > kelas (most specific first)
		matchJadwalToday,
		matchJadwalSaya,
		matchJadwalGuru,
		matchJadwalKelas,
		// Rekap — order: status filter > "tidak masuk" > generic > "rekap absensi" > per-siswa
		matchRekapAbsenStatus,
		matchRekapAbsenTidakMasuk,
		matchRekapAbsenGeneric,
		matchRekapAbsenToday,
		matchRekapAbsenStudent,
		// Tagihan
		matchTagihanTunggakan,
		matchTagihanNunggak,
		matchTagihanStudent,
		// Notif
		matchNotifWaOrtu,
	}
	for _, m := range matchers {
		if intent := m(norm); intent != nil {
			return intent
		}
	}

	// Fallback — suggest top-3 berdasarkan keyword keberadaan
	return &Intent{
		ID:          "",
		Confidence:  0,
		Suggestions: suggestSimilar(norm),
	}
}

// suggestSimilar — top-3 intent based on keyword presence.
func suggestSimilar(s string) []string {
	suggestions := []string{}
	if strings.Contains(s, "absen") || strings.Contains(s, "hadir") || strings.Contains(s, "alfa") {
		suggestions = append(suggestions,
			`absen 7A IPA semua hadir`,
			`absen 7A semua hadir kecuali Andi sakit`,
			`Dimas hari ini sakit`,
		)
	} else if strings.Contains(s, "jadwal") {
		suggestions = append(suggestions,
			`jadwal hari ini`,
			`jadwal X IPA 1`,
			`jadwal saya senin`,
		)
	} else if strings.Contains(s, "spp") || strings.Contains(s, "bayar") || strings.Contains(s, "tunggak") {
		suggestions = append(suggestions,
			`siapa nunggak SPP lebih dari 2 bulan`,
			`Dimas bayar SPP Mei 350rb cash`,
		)
	} else {
		// Default suggestion
		suggestions = append(suggestions,
			`absen 7A semua hadir`,
			`siapa nunggak SPP lebih dari 2 bulan`,
			`laporan harian`,
		)
	}
	if len(suggestions) > 3 {
		suggestions = suggestions[:3]
	}
	return suggestions
}

// ─── Tanggal parser ─────────────────────────────────────────

// parseTanggal — "hari ini", "kemarin", "25 mei", "2026-05-25"
// default: hari ini.
func parseTanggal(s string) time.Time {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	if s == "" || strings.Contains(s, "hari ini") || strings.Contains(s, "skrg") || strings.Contains(s, "sekarang") {
		return today
	}
	if strings.Contains(s, "kemarin") || strings.Contains(s, "kmrn") {
		return today.AddDate(0, 0, -1)
	}
	if strings.Contains(s, "lusa") {
		return today.AddDate(0, 0, 2)
	}
	if strings.Contains(s, "besok") {
		return today.AddDate(0, 0, 1)
	}
	// Try ISO: 2026-05-25
	if re := regexp.MustCompile(`(\d{4}-\d{2}-\d{2})`).FindStringSubmatch(s); len(re) > 1 {
		if t, err := time.ParseInLocation("2006-01-02", re[1], now.Location()); err == nil {
			return t
		}
	}
	// Try "DD Bulan" e.g. "25 mei"
	bulanMap := map[string]int{
		"januari": 1, "jan": 1,
		"februari": 2, "feb": 2,
		"maret": 3, "mar": 3,
		"april": 4, "apr": 4,
		"mei": 5,
		"juni": 6, "jun": 6,
		"juli": 7, "jul": 7,
		"agustus": 8, "agu": 8, "ags": 8,
		"september": 9, "sep": 9, "sept": 9,
		"oktober": 10, "okt": 10,
		"november": 11, "nov": 11,
		"desember": 12, "des": 12,
	}
	re := regexp.MustCompile(`(\d{1,2})\s+([a-z]+)`)
	if m := re.FindStringSubmatch(s); len(m) == 3 {
		var day int
		_, _ = sscan(m[1], &day)
		if mo, ok := bulanMap[m[2]]; ok {
			year := now.Year()
			return time.Date(year, time.Month(mo), day, 0, 0, 0, 0, now.Location())
		}
	}
	return today
}

// sscan — wrapper utk avoid import fmt di file kecil ini.
func sscan(s string, out *int) (int, error) {
	*out = 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, nil
		}
		*out = *out*10 + int(c-'0')
	}
	return 1, nil
}
