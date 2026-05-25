package assistant

import (
	"regexp"
	"strings"
	"time"
)

// ═══════════════════════════════════════════════════════════
// ABSEN.BULK_HADIR
//
// Trigger:
//   "absen 7A IPA semua hadir"
//   "absen 7A semua hadir"
//   "kelas 7A pelajaran IPA semua masuk"  (sudah jadi "semua hadir" via sinonim)
//   "absen 7A hari ini lengkap"           (sudah jadi "semua hadir" via sinonim)
// ═══════════════════════════════════════════════════════════

var reBulkHadir = []*regexp.Regexp{
	// "absen <kelas> [<mapel>] semua hadir"
	regexp.MustCompile(`^absen\s+(?P<kelas>[a-z0-9 ]+?)\s+(?:semua hadir)$`),
	regexp.MustCompile(`^absen\s+(?P<kelas>[a-z0-9 ]+?)\s+(?:pelajaran|mapel)?\s*(?P<mapel>[a-z ]+?)\s+(?:semua hadir)$`),
	// "kelas <kelas> [pelajaran <mapel>] semua hadir"
	regexp.MustCompile(`^kelas\s+(?P<kelas>[a-z0-9 ]+?)(?:\s+(?:pelajaran|mapel)\s+(?P<mapel>[a-z ]+?))?\s+semua hadir$`),
	// "absen <kelas> [<mapel>] hari ini" (tanpa kata "semua hadir" → asumsikan semua hadir kalau cuma kelas+tgl)
	// Disabled — terlalu agresif, bisa salah match.
}

func matchAbsenBulkHadir(input string) *Intent {
	for _, re := range reBulkHadir {
		if m := re.FindStringSubmatch(input); m != nil {
			groups := namedGroups(re, m)
			absen := ParsedAbsen{
				KelasRaw: strings.TrimSpace(groups["kelas"]),
				MapelRaw: strings.TrimSpace(groups["mapel"]),
				Tanggal:  parseTanggal(input),
				Default:  "hadir",
			}
			return &Intent{
				ID:         "ABSEN.BULK_HADIR",
				Confidence: 0.95,
				Slots: map[string]interface{}{
					"absen": absen,
				},
			}
		}
	}
	return nil
}

// ═══════════════════════════════════════════════════════════
// ABSEN.MARK_KECUALI
//
// Trigger:
//   "absen 7A IPA semua hadir kecuali Andi sakit"
//   "absen 7A semua hadir kecuali Andi sakit, Budi izin urusan keluarga"
//   "7A alfa: Andi, Budi"
//   "7A sakit Andi, izin Budi"
// ═══════════════════════════════════════════════════════════

// Pattern A: absen <kelas> [<mapel>] semua hadir kecuali <list>
var reMarkKecualiA = []*regexp.Regexp{
	regexp.MustCompile(`^absen\s+(?P<kelas>[a-z0-9 ]+?)(?:\s+(?:pelajaran|mapel)?\s*(?P<mapel>[a-z ]+?))?\s+semua hadir\s+kecuali\s+(?P<rest>.+)$`),
	regexp.MustCompile(`^kelas\s+(?P<kelas>[a-z0-9 ]+?)(?:\s+(?:pelajaran|mapel)\s+(?P<mapel>[a-z ]+?))?\s+semua hadir\s+kecuali\s+(?P<rest>.+)$`),
}

// Pattern B: <kelas> <status>: <names>[, <status>: <names>]+
//   "7A alfa: Andi, Budi"
//   "7A sakit: Andi, izin: Budi"
var reMarkKecualiB = regexp.MustCompile(`^(?P<kelas>[a-z0-9]+(?:\s+[a-z0-9]+)*?)\s+(?P<rest>(?:hadir|alfa|izin|sakit|terlambat)\s*[:\-].+)$`)

// Pattern C: <kelas> <status> <names>[, <status> <names>]+
//   "7A sakit Andi, izin Budi"
var reMarkKecualiC = regexp.MustCompile(`^(?P<kelas>[a-z0-9]+(?:\s+[a-z0-9]+)*?)\s+(?P<rest>(?:hadir|alfa|izin|sakit|terlambat)\s+\S.+)$`)

func matchAbsenMarkKecuali(input string) *Intent {
	// Try pattern A
	for _, re := range reMarkKecualiA {
		if m := re.FindStringSubmatch(input); m != nil {
			g := namedGroups(re, m)
			absen := ParsedAbsen{
				KelasRaw: strings.TrimSpace(g["kelas"]),
				MapelRaw: strings.TrimSpace(g["mapel"]),
				Tanggal:  parseTanggal(input),
				Default:  "hadir",
				Kecuali:  parseKecualiList(g["rest"]),
			}
			if len(absen.Kecuali) == 0 {
				continue
			}
			return &Intent{
				ID: "ABSEN.MARK_KECUALI", Confidence: 0.95,
				Slots: map[string]interface{}{"absen": absen},
			}
		}
	}
	// Pattern B (status: nama, nama)
	if m := reMarkKecualiB.FindStringSubmatch(input); m != nil {
		g := namedGroups(reMarkKecualiB, m)
		absen := ParsedAbsen{
			KelasRaw: strings.TrimSpace(g["kelas"]),
			Tanggal:  parseTanggal(input),
			Default:  "hadir",
			Kecuali:  parseStatusGroups(g["rest"]),
		}
		if len(absen.Kecuali) > 0 && validClassRaw(absen.KelasRaw) {
			return &Intent{
				ID: "ABSEN.MARK_KECUALI", Confidence: 0.85,
				Slots: map[string]interface{}{"absen": absen},
			}
		}
	}
	// Pattern C (status nama, status nama)
	if m := reMarkKecualiC.FindStringSubmatch(input); m != nil {
		g := namedGroups(reMarkKecualiC, m)
		absen := ParsedAbsen{
			KelasRaw: strings.TrimSpace(g["kelas"]),
			Tanggal:  parseTanggal(input),
			Default:  "hadir",
			Kecuali:  parseStatusInline(g["rest"]),
		}
		if len(absen.Kecuali) > 0 && validClassRaw(absen.KelasRaw) {
			return &Intent{
				ID: "ABSEN.MARK_KECUALI", Confidence: 0.80,
				Slots: map[string]interface{}{"absen": absen},
			}
		}
	}
	return nil
}

// parseKecualiList — input setelah "kecuali":
//   "Andi sakit, Budi izin urusan keluarga"
//   "Andi sakit dan Budi izin"
func parseKecualiList(s string) []KecualiEntry {
	out := []KecualiEntry{}
	// Split by koma atau " dan "
	s = strings.ReplaceAll(s, " dan ", ", ")
	parts := strings.Split(s, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		entry := parseSingleKecualiEntry(p)
		if entry.NamaRaw != "" && entry.Status != "" {
			out = append(out, entry)
		}
	}
	return out
}

// parseSingleKecualiEntry — "Andi sakit" / "Andi izin urusan keluarga"
// Cari status keyword di string, sisanya = nama.
func parseSingleKecualiEntry(s string) KecualiEntry {
	statusKeywords := []string{"hadir", "sakit", "izin", "alfa", "terlambat"}
	tokens := strings.Fields(s)
	statusIdx := -1
	for i, t := range tokens {
		for _, sk := range statusKeywords {
			if t == sk {
				statusIdx = i
				break
			}
		}
		if statusIdx >= 0 {
			break
		}
	}
	if statusIdx < 0 {
		return KecualiEntry{}
	}
	// Format paling umum: <nama> <status> [<note>]
	nama := strings.Join(tokens[:statusIdx], " ")
	status := tokens[statusIdx]
	note := ""
	if statusIdx+1 < len(tokens) {
		note = strings.Join(tokens[statusIdx+1:], " ")
	}
	if nama == "" {
		// "sakit Andi" — status di depan, nama di belakang
		if statusIdx == 0 && len(tokens) > 1 {
			nama = strings.Join(tokens[1:], " ")
			note = ""
		}
	}
	return KecualiEntry{
		NamaRaw: strings.TrimSpace(nama),
		Status:  status,
		Note:    strings.TrimSpace(note),
	}
}

// parseStatusGroups — "alfa: Andi, Budi" atau "sakit: Andi, izin: Budi"
func parseStatusGroups(s string) []KecualiEntry {
	out := []KecualiEntry{}
	// Split by status keyword + ":" or "-"
	re := regexp.MustCompile(`(hadir|sakit|izin|alfa|terlambat)\s*[:\-]\s*`)
	indexes := re.FindAllStringIndex(s, -1)
	if len(indexes) == 0 {
		return out
	}
	for i, idx := range indexes {
		status := re.FindStringSubmatch(s[idx[0]:idx[1]])[1]
		start := idx[1]
		end := len(s)
		if i+1 < len(indexes) {
			end = indexes[i+1][0]
		}
		segment := strings.TrimSpace(s[start:end])
		segment = strings.TrimRight(segment, ", ")
		for _, name := range strings.Split(segment, ",") {
			name = strings.TrimSpace(name)
			if name != "" {
				out = append(out, KecualiEntry{NamaRaw: name, Status: status})
			}
		}
	}
	return out
}

// parseStatusInline — "sakit Andi, izin Budi" (tanpa colon)
func parseStatusInline(s string) []KecualiEntry {
	out := []KecualiEntry{}
	parts := strings.Split(s, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		entry := parseSingleKecualiEntry(p)
		if entry.NamaRaw != "" && entry.Status != "" {
			out = append(out, entry)
		}
	}
	return out
}

// validClassRaw — naive check kalau kelas mirip nama kelas (gak terlalu panjang).
func validClassRaw(s string) bool {
	if len(s) == 0 || len(s) > 20 {
		return false
	}
	// Reject kalau gak mengandung digit atau roman
	hasDigit := regexp.MustCompile(`[0-9]`).MatchString(s)
	hasRoman := regexp.MustCompile(`\b(x|xi|xii|i|ii|iii|iv|v|vi|vii|viii|ix)\b`).MatchString(s)
	return hasDigit || hasRoman
}

// ═══════════════════════════════════════════════════════════
// ABSEN.SINGLE
//
// Trigger:
//   "Dimas hari ini sakit"
//   "Andi alfa"
//   "izin Rina kemarin urusan keluarga"
//   "sakit Dimas"
// ═══════════════════════════════════════════════════════════

// Pattern A: <nama> [tanggal] <status> [note]
var reSingleA = regexp.MustCompile(`^(?P<nama>[a-z][a-z\s]+?)\s+(?:hari ini|kemarin|besok|lusa|\d{4}-\d{2}-\d{2}\s+)?(?P<status>hadir|sakit|izin|alfa|terlambat)(?:\s+(?P<note>.+))?$`)

// Pattern B: <status> <nama> [tanggal] [karena <note>]
var reSingleB = regexp.MustCompile(`^(?P<status>hadir|sakit|izin|alfa|terlambat)\s+(?P<nama>[a-z][a-z\s]+?)(?:\s+(?:hari ini|kemarin|besok|lusa))?(?:\s+(?:karena|krn)\s+(?P<note>.+))?$`)

// stripDateMarkers — buang penanda tanggal dari note (sudah di-extract terpisah).
var dateMarkers = []string{"hari ini", "kemarin", "kmrn", "besok", "lusa", "tadi"}

func stripDateMarkers(s string) string {
	s = strings.TrimSpace(s)
	for _, m := range dateMarkers {
		s = strings.ReplaceAll(s, m, "")
	}
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

func matchAbsenSingle(input string) *Intent {
	// Filter: jangan match kalau masih ada keyword "absen" / "kelas" / "semua" → tabrakan dgn intent lain
	if strings.HasPrefix(input, "absen") || strings.HasPrefix(input, "kelas ") {
		return nil
	}
	if strings.Contains(input, "semua") {
		return nil
	}

	if m := reSingleA.FindStringSubmatch(input); m != nil {
		g := namedGroups(reSingleA, m)
		nama := strings.TrimSpace(g["nama"])
		status := g["status"]
		if !validNamaRaw(nama) {
			return nil
		}
		absen := ParsedAbsen{
			Tanggal: parseTanggal(input),
			Default: "",
			Kecuali: []KecualiEntry{
				{NamaRaw: nama, Status: status, Note: stripDateMarkers(g["note"])},
			},
		}
		return &Intent{
			ID: "ABSEN.SINGLE", Confidence: 0.85,
			Slots: map[string]interface{}{"absen": absen},
		}
	}
	if m := reSingleB.FindStringSubmatch(input); m != nil {
		g := namedGroups(reSingleB, m)
		nama := strings.TrimSpace(g["nama"])
		status := g["status"]
		if !validNamaRaw(nama) {
			return nil
		}
		absen := ParsedAbsen{
			Tanggal: parseTanggal(input),
			Default: "",
			Kecuali: []KecualiEntry{
				{NamaRaw: nama, Status: status, Note: stripDateMarkers(g["note"])},
			},
		}
		return &Intent{
			ID: "ABSEN.SINGLE", Confidence: 0.80,
			Slots: map[string]interface{}{"absen": absen},
		}
	}
	return nil
}

// validNamaRaw — skip false positives kaya "saya" "kamu" "dia"
// Termasuk juga kata kerja query yg suka dipake user pas nanya
// (misal "cek anak yg sering bolos" jangan ke-treat sebagai SINGLE).
var blockNama = map[string]bool{
	"saya": true, "kamu": true, "anda": true, "dia": true, "kita": true,
	"semua": true, "anak": true, "siswa": true, "murid": true,
	"hari": true, "tadi": true, "lalu": true,
	// Verb / question starters
	"cek": true, "lihat": true, "tampilkan": true, "tampil": true,
	"siapa": true, "berapa": true, "bagaimana": true, "kapan": true,
	"dimana": true, "mana": true, "buka": true, "tunjukkan": true,
	"buat": true, "tambah": true, "input": true, "catat": true,
	"hapus": true, "batal": true, "rekap": true, "laporan": true, "lapor": true,
	"kirim": true, "broadcast": true, "wa": true, "notif": true,
	"bayar": true, "tunggakan": true, "tunggak": true, "spp": true,
}

// Tambahan: hindari frasa multi-kata yg tipe-nya bukan nama (3+ token)
// dan tetap valid kalau nama orang umumnya 1-3 kata.
func validNamaRaw(s string) bool {
	if len(s) < 3 || len(s) > 50 {
		return false
	}
	tokens := strings.Fields(s)
	if len(tokens) > 3 {
		// Nama orang umumnya 1-3 kata; >3 mungkin frasa query
		return false
	}
	for _, t := range tokens {
		if blockNama[t] {
			return false
		}
	}
	return true
}

// ─── Helpers ────────────────────────────────────────────────

func namedGroups(re *regexp.Regexp, match []string) map[string]string {
	out := map[string]string{}
	for i, name := range re.SubexpNames() {
		if name != "" && i < len(match) {
			out[name] = match[i]
		}
	}
	return out
}

// _ — supaya `time` package ke-import (dipake parseTanggal di parser.go)
var _ = time.Time{}
