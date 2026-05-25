package assistant

import (
	"regexp"
	"strings"
	"time"
)

// ─── Intent TAGIHAN.* ───────────────────────────────────────────
//
// TAGIHAN.NUNGGAK   — "siapa nunggak SPP" / "tunggakan kelas X IPA 1"
// TAGIHAN.STUDENT   — "tagihan ahmad" / "spp ahmad" — single siswa
//
// Output slot: ParsedTagihan di Intent.Slots["tagihan"]

type ParsedTagihan struct {
	Scope      string `json:"scope"`               // "nunggak" | "student"
	JenisRaw   string `json:"jenis_raw,omitempty"` // "spp" / "" (semua)
	KelasRaw   string `json:"kelas_raw,omitempty"`
	StudentRaw string `json:"student_raw,omitempty"`
	MinBulan   int    `json:"min_bulan,omitempty"` // "lebih dari 2 bulan" → 2
}

// ─── Patterns ────────────────────────────────────────────────

// "siapa nunggak [SPP] [lebih dari 2 bulan]" / "tunggakan [SPP] [kelas X IPA 1]"
// "siapa belum bayar [SPP]"
var reTagihanNunggak = regexp.MustCompile(
	`^(?:siapa(?:\s+(?:yang|yg))?\s+(?:nunggak|belum\s+bayar|nunggak\s+spp|belum\s+lunas))` +
		`(?:\s+(?P<jenis>spp|iuran|sumbangan))?` +
		`(?:\s+(?:lebih\s+dari|dari|>=?|>)\s+(?P<bulan>\d+)\s+bulan)?` +
		`(?:\s+(?:di\s+)?(?:kelas\s+)?(?P<kelas>[a-z0-9 ]+?))??` +
		`\s*$`)

// "tunggakan [SPP] [kelas X IPA 1] [lebih dari 2 bulan]"
var reTagihanTunggakan = regexp.MustCompile(
	`^tunggakan` +
		`(?:\s+(?P<jenis>spp|iuran|sumbangan))?` +
		`(?:\s+(?:di\s+)?(?:kelas\s+)?(?P<kelas>[a-z0-9 ]+?))??` +
		`(?:\s+(?:lebih\s+dari|dari|>=?|>)\s+(?P<bulan>\d+)\s+bulan)?` +
		`\s*$`)

// "tagihan Ahmad" / "spp Ahmad" / "tagihan Dewi Lestari"
var reTagihanStudent = regexp.MustCompile(
	`^(?:tagihan|spp|iuran|pembayaran)\s+(?P<nama>[a-z][a-z' ]{1,40})\s*$`)

// ─── Matchers ────────────────────────────────────────────────

func matchTagihanNunggak(input string) *Intent {
	m := reTagihanNunggak.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reTagihanNunggak, m)
	bulan := 0
	if g["bulan"] != "" {
		_, _ = sscan(g["bulan"], &bulan)
	}
	return &Intent{
		ID: "TAGIHAN.NUNGGAK", Confidence: 0.92,
		Slots: map[string]interface{}{
			"tagihan": ParsedTagihan{
				Scope:    "nunggak",
				JenisRaw: strings.ToLower(g["jenis"]),
				KelasRaw: cleanKelasRaw(g["kelas"]),
				MinBulan: bulan,
			},
		},
	}
}

func matchTagihanTunggakan(input string) *Intent {
	m := reTagihanTunggakan.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reTagihanTunggakan, m)
	bulan := 0
	if g["bulan"] != "" {
		_, _ = sscan(g["bulan"], &bulan)
	}
	return &Intent{
		ID: "TAGIHAN.NUNGGAK", Confidence: 0.93,
		Slots: map[string]interface{}{
			"tagihan": ParsedTagihan{
				Scope:    "nunggak",
				JenisRaw: strings.ToLower(g["jenis"]),
				KelasRaw: cleanKelasRaw(g["kelas"]),
				MinBulan: bulan,
			},
		},
	}
}

func matchTagihanStudent(input string) *Intent {
	m := reTagihanStudent.FindStringSubmatch(input)
	if m == nil {
		return nil
	}
	g := namedGroups(reTagihanStudent, m)
	nama := strings.TrimSpace(g["nama"])
	if nama == "" {
		return nil
	}
	// Hindari false positive: "tagihan saya", "spp saya"
	if nama == "saya" || nama == "anak saya" {
		return nil
	}
	return &Intent{
		ID: "TAGIHAN.STUDENT", Confidence: 0.9,
		Slots: map[string]interface{}{
			"tagihan": ParsedTagihan{
				Scope:      "student",
				StudentRaw: nama,
			},
		},
	}
}

// _ — touch time/regexp untuk avoid unused import warnings.
var _ = time.Now
var _ = regexp.MustCompile
