package assistant

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// ResolvedRekap — output utk intent REKAP.*
type ResolvedRekap struct {
	Scope      string         `json:"scope"`                 // "absen_today" | "absen_student"
	Title      string         `json:"title"`
	Tanggal    time.Time      `json:"tanggal"`
	StatusFilt string         `json:"status_filt,omitempty"`
	KelasName  string         `json:"kelas_name,omitempty"`  // resolved kelas
	Total      int            `json:"total"`                 // total siswa absen (non-hadir) atau jml hari absen
	ByStatus   []StatusGroup  `json:"by_status,omitempty"`   // utk absen_today
	Student    *StudentInfo   `json:"student,omitempty"`     // utk absen_student
	Stats      *AbsenStats    `json:"stats,omitempty"`       // utk absen_student
	History    []AbsenHistory `json:"history,omitempty"`     // utk absen_student
	Errors     []string       `json:"errors,omitempty"`
}

type StatusGroup struct {
	Status string      `json:"status"`
	Label  string      `json:"label"`
	Count  int         `json:"count"`
	Items  []AbsenItem `json:"items"`
}

type AbsenItem struct {
	StudentID uint   `json:"student_id"`
	Name      string `json:"name"`
	NIS       string `json:"nis"`
	ClassName string `json:"class_name"`
	Subject   string `json:"subject"`
	StartTime string `json:"start_time"`
	Note      string `json:"note,omitempty"`
}

type StudentInfo struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	NIS       string `json:"nis"`
	ClassName string `json:"class_name"`
}

type AbsenStats struct {
	Hadir     int `json:"hadir"`
	Sakit     int `json:"sakit"`
	Izin      int `json:"izin"`
	Alfa      int `json:"alfa"`
	Terlambat int `json:"terlambat"`
	Total     int `json:"total"`
}

type AbsenHistory struct {
	Date      string `json:"date"`       // 2026-05-25
	DateLabel string `json:"date_label"` // "Sen, 25 Mei 2026"
	Status    string `json:"status"`
	StatusLbl string `json:"status_label"`
	Subject   string `json:"subject"`
	StartTime string `json:"start_time"`
	Note      string `json:"note,omitempty"`
}

var statusLabels = map[string]string{
	"hadir":     "Hadir",
	"sakit":     "Sakit",
	"izin":      "Izin",
	"alfa":      "Alfa",
	"terlambat": "Terlambat",
}

var statusOrder = []string{"sakit", "izin", "alfa", "terlambat"}

// ResolveRekap — dispatch berdasarkan scope.
func (r *Resolver) ResolveRekap(parsed ParsedRekap) *ResolvedRekap {
	switch parsed.Scope {
	case "absen_student":
		return r.resolveAbsenStudent(parsed)
	default:
		return r.resolveAbsenToday(parsed)
	}
}

// ─── absen_today (single hari, group by status) ────────────────
func (r *Resolver) resolveAbsenToday(parsed ParsedRekap) *ResolvedRekap {
	out := &ResolvedRekap{
		Scope:      parsed.Scope,
		Tanggal:    parsed.Tanggal,
		StatusFilt: parsed.StatusFilt,
	}

	tglStr := parsed.Tanggal.Format("02 Jan 2006")
	if isSameDay(parsed.Tanggal, time.Now()) {
		tglStr = "hari ini (" + parsed.Tanggal.Format("02 Jan 2006") + ")"
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
				"Kelas '%s' ambigu: ada %d kemungkinan. Coba spesifik, contoh: 'X IPA 1' bukan 'X IPA'", parsed.KelasRaw, len(matches)))
			return out
		} else {
			out.Errors = append(out.Errors, fmt.Sprintf("Kelas '%s' tidak ditemukan", parsed.KelasRaw))
			return out
		}
	}

	if parsed.StatusFilt != "" {
		if classLabel != "" {
			out.Title = fmt.Sprintf("Siswa %s di %s — %s", statusLabels[parsed.StatusFilt], classLabel, tglStr)
		} else {
			out.Title = fmt.Sprintf("Siswa %s — %s", statusLabels[parsed.StatusFilt], tglStr)
		}
	} else {
		if classLabel != "" {
			out.Title = fmt.Sprintf("Siswa absen di %s — %s", classLabel, tglStr)
		} else {
			out.Title = fmt.Sprintf("Siswa absen — %s", tglStr)
		}
	}

	type row struct {
		StudentID   uint
		Status      string
		Note        string
		StudentName string
		NIS         string
		ClassName   string
		Subject     string
		StartTime   string
	}

	var rows []row
	q := r.DB.Table("presences AS p").
		Select(`p.student_id, p.status, p.note,
		        u.name AS student_name, s.nis,
		        c.name AS class_name,
		        sub.name AS subject,
		        sch.start_time`).
		Joins("JOIN attendance_sessions sess ON sess.id = p.session_id").
		Joins("JOIN schedules sch ON sch.id = sess.schedule_id").
		Joins("JOIN classes c ON c.id = sch.class_id").
		Joins("LEFT JOIN subjects sub ON sub.id = sch.subject_id").
		Joins("JOIN students s ON s.id = p.student_id").
		Joins("JOIN users u ON u.id = s.user_id").
		Where("sess.school_id = ?", r.SchoolID).
		Where("DATE(sess.date) = DATE(?)", parsed.Tanggal).
		Where("p.status <> 'hadir'")

	if parsed.StatusFilt != "" {
		q = q.Where("p.status = ?", parsed.StatusFilt)
	}
	if classID != 0 {
		q = q.Where("sch.class_id = ?", classID)
	}

	q.Order("sch.start_time ASC, c.name ASC, u.name ASC").Scan(&rows)

	if len(rows) == 0 {
		ctx := tglStr
		if classLabel != "" {
			ctx = classLabel + " — " + tglStr
		}
		if parsed.StatusFilt != "" {
			out.Errors = append(out.Errors, fmt.Sprintf("Belum ada siswa berstatus %s pada %s", parsed.StatusFilt, ctx))
		} else {
			out.Errors = append(out.Errors, fmt.Sprintf("Belum ada siswa absen pada %s — kemungkinan absensi belum diinput", ctx))
		}
		return out
	}

	type studentKey struct {
		ID     uint
		Status string
	}
	seen := map[studentKey]bool{}
	groups := map[string][]AbsenItem{}

	for _, row := range rows {
		k := studentKey{row.StudentID, row.Status}
		if seen[k] {
			continue
		}
		seen[k] = true
		groups[row.Status] = append(groups[row.Status], AbsenItem{
			StudentID: row.StudentID,
			Name:      row.StudentName,
			NIS:       row.NIS,
			ClassName: row.ClassName,
			Subject:   row.Subject,
			StartTime: row.StartTime,
			Note:      row.Note,
		})
	}

	for _, st := range statusOrder {
		items, ok := groups[st]
		if !ok || len(items) == 0 {
			continue
		}
		sort.Slice(items, func(i, j int) bool {
			if items[i].ClassName != items[j].ClassName {
				return items[i].ClassName < items[j].ClassName
			}
			return items[i].Name < items[j].Name
		})
		out.ByStatus = append(out.ByStatus, StatusGroup{
			Status: st,
			Label:  statusLabels[st],
			Count:  len(items),
			Items:  items,
		})
		out.Total += len(items)
	}

	return out
}

// ─── absen_student (rekap 1 siswa dlm range) ─────────────────────
func (r *Resolver) resolveAbsenStudent(parsed ParsedRekap) *ResolvedRekap {
	out := &ResolvedRekap{
		Scope: parsed.Scope,
	}

	// Resolve siswa
	students := r.FindStudents(parsed.StudentRaw, nil)
	if len(students) == 0 {
		out.Errors = append(out.Errors, fmt.Sprintf("Siswa '%s' tidak ditemukan", parsed.StudentRaw))
		out.Title = fmt.Sprintf("Rekap absen %s — %s", parsed.StudentRaw, parsed.Periode)
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
		out.Errors = append(out.Errors, fmt.Sprintf("Siswa '%s' ambigu: %s. Coba pakai nama lengkap atau NIS",
			parsed.StudentRaw, strings.Join(names, ", ")))
		out.Title = fmt.Sprintf("Rekap absen %s — %s", parsed.StudentRaw, parsed.Periode)
		return out
	}

	st := students[0]
	className := ""
	if st.Class != nil {
		className = st.Class.Name
	}
	out.Student = &StudentInfo{
		ID:        st.ID,
		Name:      st.User.Name,
		NIS:       st.NIS,
		ClassName: className,
	}
	out.Title = fmt.Sprintf("Rekap absen %s — %s", st.User.Name, parsed.Periode)

	// Query semua presence siswa ini dlm range
	type row struct {
		Status    string
		Note      string
		Date      time.Time
		Subject   string
		StartTime string
	}
	var rows []row
	r.DB.Table("presences AS p").
		Select(`p.status, p.note, sess.date, sub.name AS subject, sch.start_time`).
		Joins("JOIN attendance_sessions sess ON sess.id = p.session_id").
		Joins("JOIN schedules sch ON sch.id = sess.schedule_id").
		Joins("LEFT JOIN subjects sub ON sub.id = sch.subject_id").
		Where("sess.school_id = ?", r.SchoolID).
		Where("p.student_id = ?", st.ID).
		Where("DATE(sess.date) >= DATE(?) AND DATE(sess.date) <= DATE(?)", parsed.From, parsed.To).
		Order("sess.date ASC, sch.start_time ASC").
		Scan(&rows)

	if len(rows) == 0 {
		out.Errors = append(out.Errors, fmt.Sprintf("Belum ada data absensi %s pada %s",
			st.User.Name, parsed.Periode))
		return out
	}

	stats := &AbsenStats{}
	dayHari := []string{"Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"}
	for _, r := range rows {
		switch r.Status {
		case "hadir":
			stats.Hadir++
		case "sakit":
			stats.Sakit++
		case "izin":
			stats.Izin++
		case "alfa":
			stats.Alfa++
		case "terlambat":
			stats.Terlambat++
		}
		stats.Total++
		out.History = append(out.History, AbsenHistory{
			Date:      r.Date.Format("2006-01-02"),
			DateLabel: fmt.Sprintf("%s, %s", dayHari[int(r.Date.Weekday())], r.Date.Format("02 Jan 2006")),
			Status:    r.Status,
			StatusLbl: statusLabels[r.Status],
			Subject:   r.Subject,
			StartTime: r.StartTime,
			Note:      r.Note,
		})
	}
	out.Stats = stats
	// Total = jml absen non-hadir
	out.Total = stats.Sakit + stats.Izin + stats.Alfa + stats.Terlambat

	return out
}

func isSameDay(a, b time.Time) bool {
	ay, am, ad := a.Date()
	by, bm, bd := b.Date()
	return ay == by && am == bm && ad == bd
}
