package assistant

import (
	"fmt"
	"strings"
	"time"

	"smart-lms/internal/models"
)

// ResolvedJadwal — output utk intent JADWAL.*
// Read-only — gak ada execute (cukup tampil).
type ResolvedJadwal struct {
	Scope      string         `json:"scope"`              // "today" / "kelas" / "kelas_hari" / "guru" / "saya"
	Title      string         `json:"title"`              // "Jadwal X IPA 1 — Senin"
	DayLabel   string         `json:"day_label,omitempty"` // "Senin"
	Tanggal    time.Time      `json:"tanggal,omitempty"`
	KelasName  string         `json:"kelas_name,omitempty"`
	GuruName   string         `json:"guru_name,omitempty"`
	Items      []JadwalItem   `json:"items"`
	Errors     []string       `json:"errors,omitempty"`
	Ambiguous  []AmbiguousSlot `json:"ambiguous,omitempty"`
}

// JadwalItem — 1 baris jadwal.
type JadwalItem struct {
	ScheduleID uint   `json:"schedule_id"`
	DayOfWeek  int    `json:"day_of_week"`
	DayLabel   string `json:"day_label"`
	StartTime  string `json:"start_time"`
	EndTime    string `json:"end_time"`
	Subject    string `json:"subject"`
	ClassName  string `json:"class_name"`
	TeacherName string `json:"teacher_name,omitempty"`
}

var dayLabels = []string{"", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"}

// ResolveJadwal — full resolve untuk ParsedJadwal.
// userID dipake utk JADWAL.SAYA (cari teacher_id dari user).
func (r *Resolver) ResolveJadwal(parsed ParsedJadwal, userID uint) *ResolvedJadwal {
	out := &ResolvedJadwal{
		Scope:    parsed.Scope,
		Tanggal:  parsed.Tanggal,
	}
	if parsed.DayOfWeek > 0 && parsed.DayOfWeek <= 7 {
		out.DayLabel = dayLabels[parsed.DayOfWeek]
	}

	switch parsed.Scope {
	case "today":
		// Semua jadwal yg jalan di hari tsb (untuk admin) — TODO filter by guru kalau role guru
		dow := parsed.DayOfWeek
		if dow == 0 {
			dow = isoDOW(parsed.Tanggal)
		}
		var schedules []models.Schedule
		r.DB.Where("school_id = ? AND day_of_week = ?", r.SchoolID, dow).
			Preload("Class").Preload("Subject").Preload("Teacher.User").
			Order("start_time ASC").
			Find(&schedules)
		out.DayLabel = dayLabels[dow]
		out.Title = fmt.Sprintf("Jadwal %s, %s", out.DayLabel, parsed.Tanggal.Format("02 Jan 2006"))
		out.Items = scheduleItems(schedules)
		if len(schedules) == 0 {
			out.Errors = append(out.Errors, fmt.Sprintf("Belum ada jadwal di hari %s", out.DayLabel))
		}

	case "kelas", "kelas_hari":
		classes := r.FindClasses(parsed.KelasRaw)
		switch len(classes) {
		case 0:
			out.Errors = append(out.Errors, fmt.Sprintf("Kelas %q gak ketemu", parsed.KelasRaw))
			return out
		case 1:
			// OK
		default:
			choices := make([]EntityRef, 0, len(classes))
			for _, c := range classes {
				choices = append(choices, EntityRef{ID: c.ID, Name: c.Name})
			}
			out.Ambiguous = append(out.Ambiguous, AmbiguousSlot{
				SlotName: "kelas", RawInput: parsed.KelasRaw,
				Question: fmt.Sprintf("Kelas %q yang mana?", parsed.KelasRaw),
				Choices:  choices,
			})
			return out
		}
		c := classes[0]
		out.KelasName = c.Name

		var schedules []models.Schedule
		q := r.DB.Where("school_id = ? AND class_id = ?", r.SchoolID, c.ID)
		if parsed.DayOfWeek > 0 {
			q = q.Where("day_of_week = ?", parsed.DayOfWeek)
		}
		q.Preload("Class").Preload("Subject").Preload("Teacher.User").
			Order("day_of_week ASC, start_time ASC").
			Find(&schedules)

		if parsed.DayOfWeek > 0 {
			out.Title = fmt.Sprintf("Jadwal %s — %s", c.Name, out.DayLabel)
		} else {
			out.Title = fmt.Sprintf("Jadwal %s (seminggu)", c.Name)
		}
		out.Items = scheduleItems(schedules)
		if len(schedules) == 0 {
			out.Errors = append(out.Errors, fmt.Sprintf("Belum ada jadwal untuk %s", c.Name))
		}

	case "saya":
		// Cari teacher dari userID
		var teacher models.Teacher
		err := r.DB.Where("school_id = ? AND user_id = ?", r.SchoolID, userID).First(&teacher).Error
		if err != nil {
			out.Errors = append(out.Errors, "Anda bukan guru — fitur 'jadwal saya' hanya utk guru")
			return out
		}
		var user models.User
		r.DB.Select("name").First(&user, userID)
		out.GuruName = user.Name
		out.Items = r.fetchSchedulesByTeacher(teacher.ID, parsed.DayOfWeek)
		if parsed.DayOfWeek > 0 {
			out.Title = fmt.Sprintf("Jadwal mengajar %s — %s", user.Name, out.DayLabel)
		} else {
			out.Title = fmt.Sprintf("Jadwal mengajar %s (seminggu)", user.Name)
		}
		if len(out.Items) == 0 {
			out.Errors = append(out.Errors, "Belum ada jadwal mengajar")
		}

	case "guru":
		// Cari teacher by name fuzzy
		teachers := r.findTeachersByName(parsed.GuruRaw)
		switch len(teachers) {
		case 0:
			out.Errors = append(out.Errors, fmt.Sprintf("Guru %q gak ketemu", parsed.GuruRaw))
			return out
		case 1:
			// OK
		default:
			choices := make([]EntityRef, 0, len(teachers))
			for _, t := range teachers {
				choices = append(choices, EntityRef{
					ID: t.ID, Name: t.User.Name,
					Extra: "NIP " + t.NIP,
				})
			}
			out.Ambiguous = append(out.Ambiguous, AmbiguousSlot{
				SlotName: "guru", RawInput: parsed.GuruRaw,
				Question: fmt.Sprintf("Guru %q yang mana?", parsed.GuruRaw),
				Choices:  choices,
			})
			return out
		}
		t := teachers[0]
		out.GuruName = t.User.Name
		out.Items = r.fetchSchedulesByTeacher(t.ID, parsed.DayOfWeek)
		if parsed.DayOfWeek > 0 {
			out.Title = fmt.Sprintf("Jadwal %s — %s", t.User.Name, out.DayLabel)
		} else {
			out.Title = fmt.Sprintf("Jadwal %s (seminggu)", t.User.Name)
		}
		if len(out.Items) == 0 {
			out.Errors = append(out.Errors, fmt.Sprintf("%s belum punya jadwal mengajar", t.User.Name))
		}
	}
	return out
}

func (r *Resolver) fetchSchedulesByTeacher(teacherID uint, dow int) []JadwalItem {
	var schedules []models.Schedule
	q := r.DB.Where("school_id = ? AND teacher_id = ?", r.SchoolID, teacherID)
	if dow > 0 {
		q = q.Where("day_of_week = ?", dow)
	}
	q.Preload("Class").Preload("Subject").Preload("Teacher.User").
		Order("day_of_week ASC, start_time ASC").
		Find(&schedules)
	return scheduleItems(schedules)
}

func (r *Resolver) findTeachersByName(raw string) []models.Teacher {
	raw = strings.ToLower(strings.TrimSpace(raw))
	if raw == "" {
		return nil
	}
	var teachers []models.Teacher
	r.DB.Joins("JOIN users ON users.id = teachers.user_id").
		Preload("User").
		Where("teachers.school_id = ?", r.SchoolID).
		Where("LOWER(users.name) LIKE ?", "%"+raw+"%").
		Find(&teachers)

	exact := []models.Teacher{}
	firstMatch := []models.Teacher{}
	other := []models.Teacher{}
	for _, t := range teachers {
		lname := strings.ToLower(t.User.Name)
		if lname == raw {
			exact = append(exact, t)
			continue
		}
		fields := strings.Fields(lname)
		if len(fields) > 0 && (fields[0] == raw || (len(fields) > 1 && fields[1] == raw)) {
			firstMatch = append(firstMatch, t)
			continue
		}
		other = append(other, t)
	}
	if len(exact) > 0 {
		return exact
	}
	if len(firstMatch) > 0 {
		return firstMatch
	}
	return other
}

func scheduleItems(schedules []models.Schedule) []JadwalItem {
	out := make([]JadwalItem, 0, len(schedules))
	for _, s := range schedules {
		item := JadwalItem{
			ScheduleID: s.ID,
			DayOfWeek:  s.DayOfWeek,
			StartTime:  s.StartTime,
			EndTime:    s.EndTime,
		}
		if s.DayOfWeek > 0 && s.DayOfWeek <= 7 {
			item.DayLabel = dayLabels[s.DayOfWeek]
		}
		if s.Subject != nil {
			item.Subject = s.Subject.Name
		}
		if s.Class != nil {
			item.ClassName = s.Class.Name
		}
		if s.Teacher != nil {
			item.TeacherName = s.Teacher.User.Name
		}
		out = append(out, item)
	}
	return out
}
