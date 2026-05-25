package assistant

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// ResolvedTagihan — output utk intent TAGIHAN.*
type ResolvedTagihan struct {
	Scope     string         `json:"scope"`            // "nunggak" | "student"
	Title     string         `json:"title"`
	JenisName string         `json:"jenis_name,omitempty"`
	KelasName string         `json:"kelas_name,omitempty"`
	MinBulan  int            `json:"min_bulan,omitempty"`
	Total     int            `json:"total"`            // jml siswa nunggak (atau jml tagihan utk student)
	TotalRp   int64          `json:"total_rp"`         // total nominal nunggak
	Items     []TagihanItem  `json:"items,omitempty"`  // utk nunggak: per-siswa
	Student   *StudentInfo   `json:"student,omitempty"`
	History   []TagihanRow   `json:"history,omitempty"` // utk student: list tagihan
	Errors    []string       `json:"errors,omitempty"`
}

type TagihanItem struct {
	StudentID    uint   `json:"student_id"`
	Name         string `json:"name"`
	NIS          string `json:"nis"`
	ClassName    string `json:"class_name"`
	BulanNunggak int    `json:"bulan_nunggak"`
	TotalRp      int64  `json:"total_rp"`
	Periode      string `json:"periode"` // ringkas: "Mar, Apr, Mei 2026"
}

type TagihanRow struct {
	ID          uint   `json:"id"`
	JenisName   string `json:"jenis_name"`
	Periode     string `json:"periode"`
	Nominal     int64  `json:"nominal"`
	Terbayar    int64  `json:"terbayar"`
	Sisa        int64  `json:"sisa"`
	Status      string `json:"status"`
	StatusLabel string `json:"status_label"`
	JatuhTempo  string `json:"jatuh_tempo,omitempty"`
}

var statusTagihanLabel = map[string]string{
	"belum_bayar":  "Belum bayar",
	"cicilan":      "Cicilan",
	"lunas":        "Lunas",
	"keringanan":   "Keringanan",
	"void":         "Dibatalkan",
}

// ResolveTagihan — dispatch berdasarkan scope.
func (r *Resolver) ResolveTagihan(parsed ParsedTagihan) *ResolvedTagihan {
	switch parsed.Scope {
	case "student":
		return r.resolveTagihanStudent(parsed)
	default:
		return r.resolveTagihanNunggak(parsed)
	}
}

// ─── nunggak: list siswa yg punya tagihan belum lunas ──────────
func (r *Resolver) resolveTagihanNunggak(parsed ParsedTagihan) *ResolvedTagihan {
	out := &ResolvedTagihan{
		Scope:    parsed.Scope,
		MinBulan: parsed.MinBulan,
	}

	// Resolve kelas opsional
	var classID uint
	var classLabel string
	if parsed.KelasRaw != "" {
		matches := r.FindClasses(parsed.KelasRaw)
		if len(matches) == 1 {
			classID = matches[0].ID
			classLabel = matches[0].Name
			out.KelasName = classLabel
		} else if len(matches) > 1 {
			out.Errors = append(out.Errors, fmt.Sprintf(
				"Kelas '%s' ambigu (%d kemungkinan)", parsed.KelasRaw, len(matches)))
			return out
		} else {
			out.Errors = append(out.Errors, fmt.Sprintf("Kelas '%s' tidak ditemukan", parsed.KelasRaw))
			return out
		}
	}

	// Resolve jenis tagihan (opsional)
	jenisLabel := ""
	jenisFilt := parsed.JenisRaw
	if jenisFilt != "" {
		out.JenisName = strings.ToUpper(jenisFilt)
		jenisLabel = " " + strings.ToUpper(jenisFilt)
	}

	// Build title
	titleParts := []string{"Siswa nunggak" + jenisLabel}
	if classLabel != "" {
		titleParts = append(titleParts, "di "+classLabel)
	}
	if parsed.MinBulan > 0 {
		titleParts = append(titleParts, fmt.Sprintf("> %d bulan", parsed.MinBulan))
	}
	out.Title = strings.Join(titleParts, " ")

	// Query: tagihan belum lunas (status != lunas/void), nominal - terbayar > 0
	type row struct {
		StudentID   uint
		StudentName string
		NIS         string
		ClassName   string
		Periode     string
		Sisa        int64
		JenisName   string
	}
	var rows []row

	q := r.DB.Table("tagihans AS t").
		Select(`t.student_id, u.name AS student_name, s.nis, c.name AS class_name,
		        t.periode, (t.nominal - COALESCE(t.terbayar,0))::bigint AS sisa,
		        jt.nama AS jenis_name`).
		Joins("JOIN students s ON s.id = t.student_id").
		Joins("JOIN users u ON u.id = s.user_id").
		Joins("LEFT JOIN classes c ON c.id = s.class_id").
		Joins("JOIN jenis_tagihans jt ON jt.id = t.jenis_tagihan_id").
		Where("t.school_id = ?", r.SchoolID).
		Where("t.deleted_at IS NULL").
		Where("t.status NOT IN ('lunas','void')").
		Where("(t.nominal - COALESCE(t.terbayar,0)) > 0")

	if classID != 0 {
		q = q.Where("s.class_id = ?", classID)
	}
	if jenisFilt != "" {
		q = q.Where("LOWER(jt.nama) LIKE ? OR LOWER(jt.kode) = ?",
			"%"+strings.ToLower(jenisFilt)+"%", strings.ToLower(jenisFilt))
	}

	q.Order("u.name ASC, t.periode ASC").Scan(&rows)

	if len(rows) == 0 {
		ctx := ""
		if classLabel != "" {
			ctx = " di " + classLabel
		}
		out.Errors = append(out.Errors, fmt.Sprintf(
			"✨ Tidak ada siswa nunggak%s%s — semua tertagih lunas", jenisLabel, ctx))
		return out
	}

	// Group by student
	type agg struct {
		Item     TagihanItem
		Periodes []string
	}
	byStudent := map[uint]*agg{}
	for _, r := range rows {
		a := byStudent[r.StudentID]
		if a == nil {
			a = &agg{
				Item: TagihanItem{
					StudentID: r.StudentID,
					Name:      r.StudentName,
					NIS:       r.NIS,
					ClassName: r.ClassName,
				},
			}
			byStudent[r.StudentID] = a
		}
		a.Item.BulanNunggak++
		a.Item.TotalRp += r.Sisa
		a.Periodes = append(a.Periodes, r.Periode)
	}

	for _, a := range byStudent {
		// Apply min_bulan filter
		if parsed.MinBulan > 0 && a.Item.BulanNunggak <= parsed.MinBulan {
			continue
		}
		a.Item.Periode = compactPeriodes(a.Periodes)
		out.Items = append(out.Items, a.Item)
		out.TotalRp += a.Item.TotalRp
	}
	out.Total = len(out.Items)

	if out.Total == 0 {
		ctx := ""
		if classLabel != "" {
			ctx = " di " + classLabel
		}
		out.Errors = append(out.Errors, fmt.Sprintf(
			"✨ Tidak ada siswa nunggak%s%s lebih dari %d bulan", jenisLabel, ctx, parsed.MinBulan))
		return out
	}

	// Sort: nunggak terbanyak duluan, kalo sama → nominal tertinggi
	sort.Slice(out.Items, func(i, j int) bool {
		if out.Items[i].BulanNunggak != out.Items[j].BulanNunggak {
			return out.Items[i].BulanNunggak > out.Items[j].BulanNunggak
		}
		return out.Items[i].TotalRp > out.Items[j].TotalRp
	})

	return out
}

// ─── student: list tagihan satu siswa ──────────────────────────
func (r *Resolver) resolveTagihanStudent(parsed ParsedTagihan) *ResolvedTagihan {
	out := &ResolvedTagihan{Scope: parsed.Scope}

	students := r.FindStudents(parsed.StudentRaw, nil)
	if len(students) == 0 {
		out.Errors = append(out.Errors, fmt.Sprintf("Siswa '%s' tidak ditemukan", parsed.StudentRaw))
		out.Title = fmt.Sprintf("Tagihan %s", parsed.StudentRaw)
		return out
	}
	if len(students) > 1 {
		names := []string{}
		for i, s := range students {
			if i >= 3 {
				names = append(names, "...")
				break
			}
			cls := ""
			if s.Class != nil {
				cls = s.Class.Name
			}
			names = append(names, fmt.Sprintf("%s (%s)", s.User.Name, cls))
		}
		out.Errors = append(out.Errors, fmt.Sprintf(
			"Siswa '%s' ambigu: %s", parsed.StudentRaw, strings.Join(names, ", ")))
		out.Title = fmt.Sprintf("Tagihan %s", parsed.StudentRaw)
		return out
	}

	st := students[0]
	className := ""
	if st.Class != nil {
		className = st.Class.Name
	}
	out.Student = &StudentInfo{
		ID: st.ID, Name: st.User.Name, NIS: st.NIS, ClassName: className,
	}
	out.Title = fmt.Sprintf("Tagihan %s", st.User.Name)

	type row struct {
		ID          uint
		Periode     string
		Nominal     int64
		Terbayar    int64
		Status      string
		JenisName   string
		JatuhTempo  *time.Time
	}
	var rows []row
	r.DB.Table("tagihans AS t").
		Select(`t.id, t.periode, t.nominal::bigint, COALESCE(t.terbayar,0)::bigint AS terbayar,
		        t.status, jt.nama AS jenis_name, t.jatuh_tempo`).
		Joins("JOIN jenis_tagihans jt ON jt.id = t.jenis_tagihan_id").
		Where("t.school_id = ?", r.SchoolID).
		Where("t.student_id = ?", st.ID).
		Where("t.deleted_at IS NULL").
		Order("t.periode DESC").
		Scan(&rows)

	if len(rows) == 0 {
		out.Errors = append(out.Errors, fmt.Sprintf("Belum ada tagihan utk %s", st.User.Name))
		return out
	}

	for _, r := range rows {
		jt := ""
		if r.JatuhTempo != nil {
			jt = r.JatuhTempo.Format("02 Jan 2006")
		}
		sisa := r.Nominal - r.Terbayar
		if sisa < 0 {
			sisa = 0
		}
		lbl := statusTagihanLabel[r.Status]
		if lbl == "" {
			lbl = r.Status
		}
		out.History = append(out.History, TagihanRow{
			ID:          r.ID,
			JenisName:   r.JenisName,
			Periode:     r.Periode,
			Nominal:     r.Nominal,
			Terbayar:    r.Terbayar,
			Sisa:        sisa,
			Status:      r.Status,
			StatusLabel: lbl,
			JatuhTempo:  jt,
		})
		if r.Status != "lunas" && r.Status != "void" {
			out.TotalRp += sisa
		}
	}
	out.Total = len(rows)

	return out
}

// compactPeriodes — list ["2026-03", "2026-04", "2026-05"] → "Mar-Mei 2026"
// untuk display ringkas. Kalau ada banyak tahun, fallback ke join.
func compactPeriodes(p []string) string {
	if len(p) == 0 {
		return ""
	}
	if len(p) <= 3 {
		// Kasih nama bulan singkat: "2026-03" → "Mar 2026"
		out := []string{}
		for _, x := range p {
			out = append(out, prettyPeriode(x))
		}
		return strings.Join(out, ", ")
	}
	// Lebih dari 3, ambil first & last
	return prettyPeriode(p[0]) + " — " + prettyPeriode(p[len(p)-1]) + fmt.Sprintf(" (%d bulan)", len(p))
}

func prettyPeriode(s string) string {
	// "2026-03" → "Mar 2026"
	bulanShort := []string{"", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"}
	if len(s) == 7 && s[4] == '-' {
		var y, mo int
		_, _ = sscan(s[:4], &y)
		_, _ = sscan(s[5:7], &mo)
		if mo >= 1 && mo <= 12 {
			return fmt.Sprintf("%s %d", bulanShort[mo], y)
		}
	}
	return s
}
