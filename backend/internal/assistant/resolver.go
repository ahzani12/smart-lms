package assistant

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"smart-lms/internal/models"

	"gorm.io/gorm"
)

// Resolver — convert raw text ("7A", "Andi") menjadi entitas DB ID.
// Output bisa: resolved (1 match), ambiguous (>1 match), not_found.

// EntityRef — referensi ke entity dengan info display.
type EntityRef struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Extra string `json:"extra,omitempty"` // e.g. "7A · NIS 12345"
}

// AmbiguousSlot — slot yang gak unik, butuh user pilih.
type AmbiguousSlot struct {
	SlotName  string      `json:"slot_name"`  // "kelas" / "siswa[0]"
	RawInput  string      `json:"raw_input"`  // "Andi"
	Question  string      `json:"question"`   // "Andi yang mana?"
	Choices   []EntityRef `json:"choices"`
	StatusRef string      `json:"status_ref,omitempty"` // utk siswa: status yg di-assign
}

// ResolvedAbsen — hasil resolve dari ParsedAbsen.
type ResolvedAbsen struct {
	SchoolID  uint           `json:"school_id"`
	Kelas     *EntityRef     `json:"kelas,omitempty"`
	Mapel     *EntityRef     `json:"mapel,omitempty"`         // nil = belum dipilih
	Schedule  *EntityRef     `json:"schedule,omitempty"`      // jadwal yg dipilih
	JadwalChoices []EntityRef `json:"jadwal_choices,omitempty"` // kalau mapel kosong, kasih pilihan
	Tanggal   time.Time      `json:"tanggal"`
	Default   string         `json:"default"`
	Kecuali   []ResolvedKecuali `json:"kecuali,omitempty"`
	StudentCount int          `json:"student_count"`
	Ambiguous []AmbiguousSlot `json:"ambiguous,omitempty"`
	Errors    []string        `json:"errors,omitempty"`
}

// ResolvedKecuali — siswa yg sudah ter-resolve.
type ResolvedKecuali struct {
	StudentID uint   `json:"student_id"`
	Name      string `json:"name"`
	NIS       string `json:"nis,omitempty"`
	ClassName string `json:"class_name,omitempty"`
	Status    string `json:"status"`
	Note      string `json:"note,omitempty"`
}

// Resolver — handle semua entity resolution dgn DB.
type Resolver struct {
	DB       *gorm.DB
	SchoolID uint
}

func NewResolver(db *gorm.DB, schoolID uint) *Resolver {
	return &Resolver{DB: db, SchoolID: schoolID}
}

// ─── Class resolution ───────────────────────────────────────

// FindClasses — search class by raw text. Aturan:
//   - exact match (case-insensitive) → 1 hit
//   - normalized "7a" → match "7A" / "VII A" / "kelas 7A"
//   - "7 ipa 1" → match "7 IPA 1" / "VII IPA 1"
func (r *Resolver) FindClasses(raw string) []models.Class {
	raw = strings.ToLower(strings.TrimSpace(raw))
	raw = regexp.MustCompile(`\s+`).ReplaceAllString(raw, " ")
	raw = strings.TrimPrefix(raw, "kelas ")

	var classes []models.Class
	r.DB.Where("school_id = ?", r.SchoolID).Find(&classes)

	exact := []models.Class{}
	prefix := []models.Class{}
	contains := []models.Class{}
	for _, c := range classes {
		lname := strings.ToLower(c.Name)
		lnorm := normalizeClassName(lname)
		if lname == raw || lnorm == raw {
			exact = append(exact, c)
		} else if strings.HasPrefix(lname, raw) || strings.HasPrefix(lnorm, raw) {
			prefix = append(prefix, c)
		} else if strings.Contains(lname, raw) || strings.Contains(lnorm, raw) {
			contains = append(contains, c)
		}
	}
	if len(exact) > 0 {
		return exact
	}
	if len(prefix) > 0 {
		return prefix
	}
	return contains
}

// normalizeClassName — "VII A" → "7a", "VIII IPA 1" → "8 ipa 1"
func normalizeClassName(s string) string {
	romanMap := map[string]string{
		"vii": "7", "viii": "8", "ix": "9",
		"x": "10", "xi": "11", "xii": "12",
		"i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6",
	}
	tokens := strings.Fields(s)
	for i, t := range tokens {
		if v, ok := romanMap[t]; ok {
			tokens[i] = v
		}
	}
	return strings.Join(tokens, " ")
}

// ─── Subject (Mapel) resolution ─────────────────────────────

func (r *Resolver) FindSubjects(raw string) []models.Subject {
	raw = strings.ToLower(strings.TrimSpace(raw))
	if raw == "" {
		return nil
	}
	var subjects []models.Subject
	r.DB.Where("school_id = ?", r.SchoolID).Find(&subjects)

	// Common abbreviations
	alias := map[string]string{
		"mtk":  "matematika",
		"ipa":  "ipa",
		"ips":  "ips",
		"bind": "bahasa indonesia",
		"bing": "bahasa inggris",
		"pkn":  "pendidikan kewarganegaraan",
		"pjok": "pendidikan jasmani",
		"agama": "pendidikan agama",
	}
	if v, ok := alias[raw]; ok {
		raw = v
	}

	hits := []models.Subject{}
	for _, s := range subjects {
		lname := strings.ToLower(s.Name)
		if lname == raw || strings.Contains(lname, raw) || strings.HasPrefix(lname, raw) {
			hits = append(hits, s)
		}
	}
	return hits
}

// ─── Schedule lookup ────────────────────────────────────────

// FindSchedulesForClassDate — semua jadwal kelas X pada hari/tanggal Y.
func (r *Resolver) FindSchedulesForClassDate(classID uint, date time.Time) []models.Schedule {
	dow := int(date.Weekday())
	if dow == 0 {
		dow = 7
	}
	var schedules []models.Schedule
	r.DB.Where("school_id = ? AND class_id = ? AND day_of_week = ?", r.SchoolID, classID, dow).
		Preload("Class").Preload("Subject").Preload("Teacher.User").
		Order("start_time ASC").
		Find(&schedules)
	return schedules
}

// ─── Student resolution ─────────────────────────────────────

// FindStudents — fuzzy by name, optional restrict ke kelas tertentu.
// Match strategy:
//  1. Exact full name (case-insensitive) → 1 hit
//  2. First name exact / last name exact
//  3. Substring contains
func (r *Resolver) FindStudents(raw string, classID *uint) []models.Student {
	raw = strings.ToLower(strings.TrimSpace(raw))
	if raw == "" {
		return nil
	}
	q := r.DB.Joins("JOIN users ON users.id = students.user_id").
		Preload("User").Preload("Class").
		Where("students.school_id = ?", r.SchoolID)
	if classID != nil {
		q = q.Where("students.class_id = ?", *classID)
	}
	var students []models.Student
	q.Where("LOWER(users.name) LIKE ?", "%"+raw+"%").Find(&students)

	exact := []models.Student{}
	firstMatch := []models.Student{}
	other := []models.Student{}
	for _, s := range students {
		lname := strings.ToLower(s.User.Name)
		if lname == raw {
			exact = append(exact, s)
			continue
		}
		fname := strings.Fields(lname)
		if len(fname) > 0 && fname[0] == raw {
			firstMatch = append(firstMatch, s)
			continue
		}
		other = append(other, s)
	}
	if len(exact) > 0 {
		return exact
	}
	if len(firstMatch) > 0 {
		return firstMatch
	}
	return other
}

// ─── Resolve full Absen intent ──────────────────────────────

// ResolveAbsen — full resolve untuk ParsedAbsen, return ResolvedAbsen.
// Hasil bisa "executable" atau "needs clarification".
func (r *Resolver) ResolveAbsen(parsed ParsedAbsen) *ResolvedAbsen {
	out := &ResolvedAbsen{
		SchoolID: r.SchoolID,
		Tanggal:  parsed.Tanggal,
		Default:  parsed.Default,
	}

	// 1. Resolve kelas (kalau kelasRaw kosong → ambiguous TANPA pilihan, perlu user input baru)
	var resolvedClass *models.Class
	if parsed.KelasRaw != "" {
		classes := r.FindClasses(parsed.KelasRaw)
		switch len(classes) {
		case 0:
			out.Errors = append(out.Errors, fmt.Sprintf("Kelas %q gak ketemu", parsed.KelasRaw))
		case 1:
			resolvedClass = &classes[0]
			out.Kelas = &EntityRef{ID: classes[0].ID, Name: classes[0].Name}
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
		}
	}

	// Untuk ABSEN.SINGLE — gak ada kelasRaw. Kelas akan di-detect dari student.
	// Kita lewati schedule resolution dan langsung ke student.
	if parsed.Default == "" && len(parsed.Kecuali) == 1 {
		// SINGLE mode
		entry := parsed.Kecuali[0]
		students := r.FindStudents(entry.NamaRaw, nil)
		switch len(students) {
		case 0:
			out.Errors = append(out.Errors, fmt.Sprintf("Siswa %q gak ketemu", entry.NamaRaw))
		case 1:
			s := students[0]
			out.Kecuali = append(out.Kecuali, ResolvedKecuali{
				StudentID: s.ID, Name: s.User.Name, NIS: s.NIS,
				ClassName: classNameOf(&s),
				Status:    entry.Status, Note: entry.Note,
			})
		default:
			choices := make([]EntityRef, 0, len(students))
			for _, s := range students {
				choices = append(choices, EntityRef{
					ID: s.ID, Name: s.User.Name,
					Extra: classNameOf(&s) + " · NIS " + s.NIS,
				})
			}
			out.Ambiguous = append(out.Ambiguous, AmbiguousSlot{
				SlotName: "siswa[0]", RawInput: entry.NamaRaw,
				Question:  fmt.Sprintf("%s yang mana?", entry.NamaRaw),
				Choices:   choices,
				StatusRef: entry.Status,
			})
		}
		return out
	}

	// 2. Cari jadwal hari ini utk kelas tsb
	if resolvedClass != nil {
		schedules := r.FindSchedulesForClassDate(resolvedClass.ID, parsed.Tanggal)

		// 2a. Filter by mapel kalau disebut
		if parsed.MapelRaw != "" {
			subjects := r.FindSubjects(parsed.MapelRaw)
			if len(subjects) == 0 {
				out.Errors = append(out.Errors, fmt.Sprintf("Mapel %q gak ketemu", parsed.MapelRaw))
			} else {
				// Filter schedules to subjects
				subIDs := map[uint]bool{}
				for _, s := range subjects {
					subIDs[s.ID] = true
				}
				filtered := []models.Schedule{}
				for _, s := range schedules {
					if subIDs[s.SubjectID] {
						filtered = append(filtered, s)
					}
				}
				schedules = filtered
				if len(schedules) == 0 {
					out.Errors = append(out.Errors,
						fmt.Sprintf("Mapel %q gak ada di jadwal kelas %s tanggal tsb", parsed.MapelRaw, resolvedClass.Name))
				}
			}
		}

		// 2b. Pilih jadwal
		switch len(schedules) {
		case 0:
			if len(out.Errors) == 0 {
				out.Errors = append(out.Errors,
					fmt.Sprintf("Gak ada jadwal kelas %s di tanggal %s",
						resolvedClass.Name, parsed.Tanggal.Format("02 Jan 2006")))
			}
		case 1:
			out.Schedule = scheduleRef(&schedules[0])
			if schedules[0].Subject != nil {
				out.Mapel = &EntityRef{ID: schedules[0].SubjectID, Name: schedules[0].Subject.Name}
			}
		default:
			// Banyak pilihan → tampilkan grid
			choices := make([]EntityRef, 0, len(schedules))
			for _, sc := range schedules {
				choices = append(choices, *scheduleRef(&sc))
			}
			out.JadwalChoices = choices
			out.Ambiguous = append(out.Ambiguous, AmbiguousSlot{
				SlotName: "schedule", RawInput: parsed.MapelRaw,
				Question: fmt.Sprintf("Pilih jadwal kelas %s di %s", resolvedClass.Name, parsed.Tanggal.Format("02 Jan 2006")),
				Choices:  choices,
			})
		}
	}

	// 3. Resolve "kecuali" siswa (BULK_HADIR atau MARK_KECUALI)
	for i, entry := range parsed.Kecuali {
		var classID *uint
		if resolvedClass != nil {
			id := resolvedClass.ID
			classID = &id
		}
		students := r.FindStudents(entry.NamaRaw, classID)
		switch len(students) {
		case 0:
			out.Errors = append(out.Errors, fmt.Sprintf("Siswa %q gak ketemu", entry.NamaRaw))
		case 1:
			s := students[0]
			out.Kecuali = append(out.Kecuali, ResolvedKecuali{
				StudentID: s.ID, Name: s.User.Name, NIS: s.NIS,
				ClassName: classNameOf(&s),
				Status:    entry.Status, Note: entry.Note,
			})
		default:
			choices := make([]EntityRef, 0, len(students))
			for _, s := range students {
				choices = append(choices, EntityRef{
					ID: s.ID, Name: s.User.Name,
					Extra: classNameOf(&s) + " · NIS " + s.NIS,
				})
			}
			out.Ambiguous = append(out.Ambiguous, AmbiguousSlot{
				SlotName:  fmt.Sprintf("siswa[%d]", i),
				RawInput:  entry.NamaRaw,
				Question:  fmt.Sprintf("%s yang mana?", entry.NamaRaw),
				Choices:   choices,
				StatusRef: entry.Status,
			})
		}
	}

	// 4. Hitung total siswa di kelas (utk preview "30 hadir, 1 sakit, 1 izin")
	if resolvedClass != nil {
		var count int64
		r.DB.Model(&models.Student{}).
			Where("school_id = ? AND class_id = ?", r.SchoolID, resolvedClass.ID).
			Count(&count)
		out.StudentCount = int(count)
	}

	return out
}

// classNameOf — safe access ke s.Class.Name (Class adalah pointer, bisa nil).
func classNameOf(s *models.Student) string {
	if s == nil || s.Class == nil {
		return ""
	}
	return s.Class.Name
}

// scheduleRef — render Schedule as EntityRef yang informatif.
func scheduleRef(s *models.Schedule) *EntityRef {
	subName := ""
	if s.Subject != nil {
		subName = s.Subject.Name
	}
	teacherName := ""
	if s.Teacher != nil {
		teacherName = s.Teacher.User.Name
	}
	extra := fmt.Sprintf("%s-%s", s.StartTime, s.EndTime)
	if teacherName != "" {
		extra += " · " + teacherName
	}
	return &EntityRef{
		ID:    s.ID,
		Name:  subName,
		Extra: extra,
	}
}
