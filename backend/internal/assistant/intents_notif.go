package assistant

import (
	"regexp"
	"strings"
)

// ─── Intent NOTIF.* ─────────────────────────────────────────────
//
// NOTIF.WA_SISWA — "kirim wa ke ortu Ahmad: anak sakit"
//                  "kabari ortu Dewi anaknya hari ini sakit"
//                  "wa ortu Ahmad: anak ga masuk hari ini"
//
// Output slot: ParsedNotif di Intent.Slots["notif"]

type ParsedNotif struct {
	Scope      string `json:"scope"`        // "wa_ortu" / "wa_guru"
	StudentRaw string `json:"student_raw"`
	Pesan      string `json:"pesan"`        // raw msg dari user (kalau kosong → template)
	Template   string `json:"template,omitempty"` // "alfa", "sakit", "izin", "" (custom)
}

// ─── Patterns ────────────────────────────────────────────────

// "kirim wa ke ortu Ahmad: anak sakit"
// "wa ortu Dewi: anaknya tidak masuk"
// "kabari ortu Sari, anaknya hari ini sakit"
// "kirim notif ke ortu Ahmad: anak ga masuk"
var reNotifWaOrtu = regexp.MustCompile(
	`^(?:kirim\s+(?:wa|notif|notifikasi|pesan|sms)\s+(?:ke\s+)?(?:ortu|orangtua|wali)|` +
		`wa\s+(?:ke\s+)?(?:ortu|orangtua|wali)|` +
		`kabari\s+(?:ortu|orangtua|wali))` +
		`\s+(?P<nama>[a-z][a-z' ]{1,40}?)\s*(?:[:,]|\s+)` +
		`(?P<pesan>.+)$`)

// "kabari ortu Ahmad anaknya sakit" (tanpa colon)
var reNotifWaOrtuShort = regexp.MustCompile(
	`^(?:kabari|wa|hubungi)\s+(?:ortu|orangtua|wali)\s+(?P<nama>[a-z][a-z']+)\s+` +
		`(?P<pesan>(?:anak|anaknya|hari ini|tdk|tidak|gak|nggak).+)$`)

// ─── Matchers ────────────────────────────────────────────────

func matchNotifWaOrtu(input string) *Intent {
	if m := reNotifWaOrtu.FindStringSubmatch(input); m != nil {
		g := namedGroups(reNotifWaOrtu, m)
		nama := strings.TrimSpace(g["nama"])
		pesan := strings.TrimSpace(g["pesan"])
		if nama == "" || pesan == "" {
			return nil
		}
		template := detectNotifTemplate(pesan)
		return &Intent{
			ID: "NOTIF.WA_ORTU", Confidence: 0.9,
			Slots: map[string]interface{}{
				"notif": ParsedNotif{
					Scope:      "wa_ortu",
					StudentRaw: nama,
					Pesan:      pesan,
					Template:   template,
				},
			},
		}
	}
	if m := reNotifWaOrtuShort.FindStringSubmatch(input); m != nil {
		g := namedGroups(reNotifWaOrtuShort, m)
		nama := strings.TrimSpace(g["nama"])
		pesan := strings.TrimSpace(g["pesan"])
		if nama == "" || pesan == "" {
			return nil
		}
		template := detectNotifTemplate(pesan)
		return &Intent{
			ID: "NOTIF.WA_ORTU", Confidence: 0.85,
			Slots: map[string]interface{}{
				"notif": ParsedNotif{
					Scope:      "wa_ortu",
					StudentRaw: nama,
					Pesan:      pesan,
					Template:   template,
				},
			},
		}
	}
	return nil
}

// detectNotifTemplate — heuristik buat klasifikasi pesan
func detectNotifTemplate(s string) string {
	s = strings.ToLower(s)
	switch {
	case strings.Contains(s, "sakit") || strings.Contains(s, "demam") || strings.Contains(s, "opname"):
		return "sakit"
	case strings.Contains(s, "izin") || strings.Contains(s, "ijin"):
		return "izin"
	case strings.Contains(s, "alfa") || strings.Contains(s, "bolos") || strings.Contains(s, "tidak masuk") ||
		strings.Contains(s, "tdk masuk") || strings.Contains(s, "ga masuk") || strings.Contains(s, "gak masuk"):
		return "alfa"
	case strings.Contains(s, "telat") || strings.Contains(s, "terlambat"):
		return "terlambat"
	}
	return ""
}
