package models

import (
	"time"

	"gorm.io/gorm"
)

// ─── User & Auth ──────────────────────────────────────────

type User struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	Name      string         `json:"name" gorm:"size:255;not null"`
	Email     string         `json:"email" gorm:"size:255;uniqueIndex"`
	StudentID string         `json:"student_id" gorm:"size:6;index"`
	Password  string         `json:"-" gorm:"size:255;not null"`
	Role      string         `json:"role" gorm:"size:50;not null;index"` // admin_pusat, admin_cabang, guru, siswa, orang_tua
	Phone     string         `json:"phone" gorm:"size:20"`
	Avatar    string         `json:"avatar" gorm:"size:500"`
	Active    bool           `json:"active" gorm:"default:true"`
	SchoolID  *uint          `json:"school_id" gorm:"index"`
	School    *School        `json:"school,omitempty" gorm:"foreignKey:SchoolID"`
}

type School struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	Name        string         `json:"name" gorm:"size:255;not null"`
	Address     string         `json:"address" gorm:"type:text"`
	Phone       string         `json:"phone" gorm:"size:20"`
	Email       string         `json:"email" gorm:"size:255"`
	Website     string         `json:"website" gorm:"size:255"`
	NPSN        string         `json:"npsn" gorm:"size:20"`
	Level       string         `json:"level" gorm:"size:50"` // SD, SMP, SMA, SMK
	HeaderLogo  string         `json:"header_logo" gorm:"size:500"` // custom raport header
	HeaderText  string         `json:"header_text" gorm:"type:text"` // custom raport text
	HeaderColor string         `json:"header_color" gorm:"size:20;default:'#1e40af'"`
}

// ─── Academic ─────────────────────────────────────────────

type Semester struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	Name      string         `json:"name" gorm:"size:100;not null"` // "Ganjil 2025/2026"
	Year      string         `json:"year" gorm:"size:20;not null"`  // "2025/2026"
	Period    string         `json:"period" gorm:"size:20;not null"` // ganjil/genap
	StartDate time.Time      `json:"start_date"`
	EndDate   time.Time      `json:"end_date"`
	Active    bool           `json:"active" gorm:"default:false"`
	SchoolID  uint           `json:"school_id" gorm:"index"`
}

type Class struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	Name      string         `json:"name" gorm:"size:100;not null"`  // "X IPA 1"
	Level     string         `json:"level" gorm:"size:10;not null"`  // "X", "XI", "XII"
	Major     string         `json:"major" gorm:"size:50"`           // "IPA", "IPS", etc
	Capacity  int            `json:"capacity" gorm:"default:36"`
	SchoolID  uint           `json:"school_id" gorm:"index"`
	TeacherID *uint          `json:"teacher_id"` // wali kelas
	Teacher   *Teacher       `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
}

type Subject struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	Code      string         `json:"code" gorm:"size:20;uniqueIndex"`
	Name      string         `json:"name" gorm:"size:255;not null"`
	Level     string         `json:"level" gorm:"size:10"` // X, XI, XII or all
	SchoolID  uint           `json:"school_id" gorm:"index"`
}

// ─── People ───────────────────────────────────────────────

type Teacher struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
	UserID     uint           `json:"user_id" gorm:"uniqueIndex"`
	User       User           `json:"user,omitempty" gorm:"foreignKey:UserID"`
	NIP        string         `json:"nip" gorm:"column:nip;size:30;uniqueIndex"`
	SchoolID   uint           `json:"school_id" gorm:"index"`
	Subjects   []Subject      `json:"subjects,omitempty" gorm:"many2many:teacher_subjects;"`
}

type Student struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	UserID    uint           `json:"user_id" gorm:"uniqueIndex"`
	User      User           `json:"user,omitempty" gorm:"foreignKey:UserID"`
	NIS       string         `json:"nis" gorm:"size:30;index"`
	NISN      string         `json:"nisn" gorm:"size:20;uniqueIndex"`
	ClassID   *uint          `json:"class_id" gorm:"index"`
	Class     *Class         `json:"class,omitempty" gorm:"foreignKey:ClassID"`
	SchoolID  uint           `json:"school_id" gorm:"index"`
	Gender    string         `json:"gender" gorm:"size:10"`
	BirthDate *time.Time     `json:"birth_date"`
	Address   string         `json:"address" gorm:"type:text"`
}

// ─── Bank Soal ────────────────────────────────────────────
// Bank soal SEKARANG = playlist/koleksi. Soal hidup di pool (Question),
// bank soal ngumpulin referensi via QuestionBankItem (many-to-many).

type QuestionBank struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	Title       string         `json:"title" gorm:"size:255;not null"`
	Description string         `json:"description" gorm:"type:text"`
	SubjectID   uint           `json:"subject_id" gorm:"index"`
	Subject     Subject        `json:"subject,omitempty" gorm:"foreignKey:SubjectID"`
	TeacherID   *uint          `json:"teacher_id" gorm:"index"`
	Teacher     *Teacher       `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
	SchoolID    uint           `json:"school_id" gorm:"index"`
	Level       string         `json:"level" gorm:"size:10"`                     // X, XI, XII
	Visibility  string         `json:"visibility" gorm:"size:20;default:'private'"` // private | school | public
	Items       []QuestionBankItem `json:"items,omitempty" gorm:"foreignKey:QuestionBankID"`
}

// Question = soal di pool. Gak terikat ke 1 bank. Di-tag ke banyak Topic.
type Question struct {
	ID             uint           `json:"id" gorm:"primaryKey"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID       uint           `json:"school_id" gorm:"index;not null"`
	SubjectID      uint           `json:"subject_id" gorm:"index;not null"`
	Subject        *Subject       `json:"subject,omitempty" gorm:"foreignKey:SubjectID"`
	Level          string         `json:"level" gorm:"size:10;index"` // X, XI, XII
	AuthorID       uint           `json:"author_id" gorm:"index"`     // teacher_id pembuat
	Number         int            `json:"number" gorm:"default:0"`    // urutan opsional
	Type           string         `json:"type" gorm:"size:20;not null"` // pilihan_ganda, essay, true_false, matching, fill_blank, multi_answer, numeric, ordering
	Content        string         `json:"content" gorm:"type:text;not null"`
	Options        string         `json:"options" gorm:"type:jsonb"`   // JSON: [{"key":"A","text":"..."}, ...]
	Answer         string         `json:"answer" gorm:"type:text"`     // jawaban benar (utk multi-answer: CSV "A,C")
	Explanation    string         `json:"explanation" gorm:"type:text"`
	Difficulty     string         `json:"difficulty" gorm:"size:20;default:'sedang'"`
	Points         int            `json:"points" gorm:"default:10"`
	Visibility     string         `json:"visibility" gorm:"size:20;default:'private'"` // private | school | public
	CurrentVersion int            `json:"current_version" gorm:"default:1"`
	Topics         []Topic        `json:"topics,omitempty" gorm:"many2many:question_topics;"`
	// Analisis butir soal (recalculated from exam results)
	Discrimination float64        `json:"discrimination" gorm:"default:0"`
	DifficultyIdx  float64        `json:"difficulty_idx" gorm:"default:0"`
	CorrectCount   int            `json:"correct_count" gorm:"default:0"`
	TotalAttempts  int            `json:"total_attempts" gorm:"default:0"`
}

// ─── Ujian ────────────────────────────────────────────────

type Exam struct {
	ID              uint           `json:"id" gorm:"primaryKey"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`
	Title           string         `json:"title" gorm:"size:255;not null"`
	Description     string         `json:"description" gorm:"type:text"`
	SubjectID       uint           `json:"subject_id" gorm:"index"`
	Subject         Subject        `json:"subject,omitempty" gorm:"foreignKey:SubjectID"`
	ClassID         uint           `json:"class_id" gorm:"index"`
	Class           Class          `json:"class,omitempty" gorm:"foreignKey:ClassID"`
	TeacherID       uint           `json:"teacher_id" gorm:"index"`
	Teacher         Teacher        `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
	QuestionBankID  *uint          `json:"question_bank_id" gorm:"index"`
	QuestionBank    *QuestionBank  `json:"question_bank,omitempty" gorm:"foreignKey:QuestionBankID"`
	SchoolID        uint           `json:"school_id" gorm:"index"`
	SemesterID      uint           `json:"semester_id" gorm:"index"`
	StartTime       time.Time      `json:"start_time"`
	EndTime         time.Time      `json:"end_time"`
	Duration        int            `json:"duration"` // minutes
	TotalQuestions  int            `json:"total_questions"`
	ShuffleQuestions bool          `json:"shuffle_questions" gorm:"default:false"`
	ShowResults     bool           `json:"show_results" gorm:"default:false"`
	LockTab         bool           `json:"lock_tab" gorm:"default:true"`
	MaxTabSwitches  int            `json:"max_tab_switches" gorm:"default:3"`
	ExamType        string         `json:"exam_type" gorm:"size:30;index"` // ulangan_harian, uts, uas
	Status          string         `json:"status" gorm:"size:20;default:'draft'"` // draft, active, finished
}

type ExamAttempt struct {
	ID              uint           `json:"id" gorm:"primaryKey"`
	CreatedAt       time.Time      `json:"created_at"`
	ExamID          uint           `json:"exam_id" gorm:"index"`
	Exam            Exam           `json:"exam,omitempty" gorm:"foreignKey:ExamID"`
	StudentID       uint           `json:"student_id" gorm:"index"`
	Student         Student        `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	StartTime       time.Time      `json:"start_time"`
	EndTime         *time.Time     `json:"end_time"`
	Score           *float64       `json:"score"`
	Status          string         `json:"status" gorm:"size:20;default:'in_progress'"` // in_progress, submitted, graded
	TabSwitches     int            `json:"tab_switches" gorm:"default:0"`
	Flagged         bool           `json:"flagged" gorm:"default:false"` // curang
	Answers         []ExamAnswer   `json:"answers,omitempty" gorm:"foreignKey:ExamAttemptID"`
}

type ExamAnswer struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	ExamAttemptID uint           `json:"exam_attempt_id" gorm:"index"`
	QuestionID    uint           `json:"question_id" gorm:"index"`
	Question      Question       `json:"question,omitempty" gorm:"foreignKey:QuestionID"`
	Answer        string         `json:"answer" gorm:"type:text"`
	IsCorrect     *bool          `json:"is_correct"`
	Score         *float64       `json:"score"`
	AIScore       *float64       `json:"ai_score"` // AI essay grading
	AIFeedback    string         `json:"ai_feedback" gorm:"type:text"`
	Feedback      string         `json:"feedback" gorm:"type:text"` // Teacher manual grading comment
}

// ─── Absensi ──────────────────────────────────────────────
// Model absensi lama (Attendance, AttendanceItem) sudah di-deprecate.
// Sekarang pake Schedule + AttendanceSession + Presence (lihat attendance.go).
// Dua model berikut dibiarkan kosong agar migration auto drop tabelnya.

// ─── Raport ───────────────────────────────────────────────

type Raport struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
	StudentID  uint           `json:"student_id" gorm:"index"`
	Student    Student        `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	SemesterID uint           `json:"semester_id" gorm:"index"`
	Semester   Semester       `json:"semester,omitempty" gorm:"foreignKey:SemesterID"`
	SchoolID   uint           `json:"school_id" gorm:"index"`
	Items      []RaportItem   `json:"items,omitempty" gorm:"foreignKey:RaportID"`
	Notes      string         `json:"notes" gorm:"type:text"` // catatan wali kelas
	Rank       *int           `json:"rank"`
}

type RaportItem struct {
	ID         uint     `json:"id" gorm:"primaryKey"`
	RaportID   uint     `json:"raport_id" gorm:"index"`
	SubjectID  uint     `json:"subject_id" gorm:"index"`
	Subject    Subject  `json:"subject,omitempty" gorm:"foreignKey:SubjectID"`
	Score      float64  `json:"score"`
	Grade      string   `json:"grade" gorm:"size:5"` // A, B, C, D
	KB         string   `json:"kb" gorm:"type:text"` // Kompetensi Dasar
	TeacherID  uint     `json:"teacher_id" gorm:"index"`
	Teacher    Teacher  `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
}

// ─── AI Config ────────────────────────────────────────────

type AIConfig struct {
	ID           uint           `json:"id" gorm:"primaryKey"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
	Name         string         `json:"name" gorm:"size:100;not null"`          // "OpenAI", "Gemini", "xAI"
	AuthType     string         `json:"auth_type" gorm:"size:20;default:apikey"` // apikey | oauth
	BaseURL      string         `json:"base_url" gorm:"size:500"`
	APIKey       string         `json:"api_key" gorm:"size:500"`
	SessionToken string         `json:"session_token,omitempty" gorm:"size:5000"`
	Model        string         `json:"model" gorm:"size:100;not null"`
	Active       bool           `json:"active" gorm:"default:false"`
	IsGlobal     bool           `json:"is_global" gorm:"default:false;index"` // true = set by superadmin, available to all schools
	SchoolID     uint           `json:"school_id" gorm:"index"`               // 0 = global
	School       *School        `json:"school,omitempty" gorm:"foreignKey:SchoolID"`
}

// ─── AI Quota (per school monthly limit) ──────────────────

type AIQuota struct {
	ID           uint           `json:"id" gorm:"primaryKey"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID     uint           `json:"school_id" gorm:"uniqueIndex"`
	School       *School        `json:"school,omitempty" gorm:"foreignKey:SchoolID"`
	MonthlyLimit int            `json:"monthly_limit" gorm:"default:100"`  // max requests per month
	UsedThisMonth int           `json:"used_this_month" gorm:"default:0"`
	ResetAt      time.Time      `json:"reset_at"`                          // next reset date
}

// ─── AI Job (async background task) ───────────────────────

type AIJob struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID   uint           `json:"school_id" gorm:"index"`
	UserID     uint           `json:"user_id" gorm:"index"`
	Kind       string         `json:"kind" gorm:"size:40;index"`             // generate_questions | grade_essay | rpp | prota
	Status     string         `json:"status" gorm:"size:20;default:pending"` // pending | running | done | failed
	Progress   int            `json:"progress" gorm:"default:0"`             // 0..100
	Message    string         `json:"message" gorm:"type:text"`
	Input      string         `json:"input" gorm:"type:text"`  // JSON of request
	Result     string         `json:"result" gorm:"type:text"` // JSON of result
	Error      string         `json:"error" gorm:"type:text"`
	StartedAt  *time.Time     `json:"started_at"`
	FinishedAt *time.Time     `json:"finished_at"`
}

type CalendarEvent struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
	Title       string         `json:"title" gorm:"size:255;not null"`
	Description string         `json:"description" gorm:"type:text"`
	Type        string         `json:"type" gorm:"size:50"` // ujian, libur, kegiatan, pembelajaran
	StartDate   time.Time      `json:"start_date"`
	EndDate     time.Time      `json:"end_date"`
	Color       string         `json:"color" gorm:"size:20;default:'#3b82f6'"`
	SchoolID    uint           `json:"school_id" gorm:"index"`
	SemesterID  *uint          `json:"semester_id" gorm:"index"`
}

// ─── AutoMigrate ──────────────────────────────────────────

// ─── Parent (Orang Tua) ──────────────────────────────────

type Parent struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	UserID    uint           `json:"user_id" gorm:"uniqueIndex"`
	User      User           `json:"user,omitempty" gorm:"foreignKey:UserID"`
	StudentID uint           `json:"student_id" gorm:"index"`
	Student   Student        `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	Relation  string         `json:"relation" gorm:"size:20"` // ayah, ibu, wali
	SchoolID  uint           `json:"school_id" gorm:"index"`
}

// ─── Parent Access (Login Ortu via Kode) ─────────────────

type ParentAccess struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
	StudentID  uint           `json:"student_id" gorm:"index"`
	Student    Student        `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	AccessCode string         `json:"access_code" gorm:"size:6;index"`
	ParentName string         `json:"parent_name" gorm:"size:255"`
	Phone      string         `json:"phone" gorm:"size:20"`
	Relation   string         `json:"relation" gorm:"size:20"` // ayah, ibu, wali
	SchoolID   uint           `json:"school_id" gorm:"index"`
}

// ─── Report Components (Komponen Raport per Sekolah) ─────

type ReportComponent struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID   uint           `json:"school_id" gorm:"index;not null"`
	Name       string         `json:"name" gorm:"size:100;not null"`        // e.g. "Ulangan Harian", "UTS", "UAS", "Sikap"
	Weight     float64        `json:"weight" gorm:"not null"`               // bobot dalam persen, e.g. 30
	SourceType string         `json:"source_type" gorm:"size:20;not null"`  // "manual" atau "exam"
	ExamType   string         `json:"exam_type" gorm:"size:50"`             // jika source_type=exam: "uts", "uas", dll
	SortOrder  int            `json:"sort_order" gorm:"default:0"`
}

type StudentScore struct {
	ID           uint           `json:"id" gorm:"primaryKey"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID     uint           `json:"school_id" gorm:"index;not null"`
	StudentID    uint           `json:"student_id" gorm:"index;not null"`
	Student      Student        `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	SubjectID    uint           `json:"subject_id" gorm:"index;not null"`
	Subject      Subject        `json:"subject,omitempty" gorm:"foreignKey:SubjectID"`
	SemesterID   uint           `json:"semester_id" gorm:"index;not null"`
	Semester     Semester       `json:"semester,omitempty" gorm:"foreignKey:SemesterID"`
	ComponentID  uint           `json:"component_id" gorm:"index;not null"`
	Component    ReportComponent `json:"component,omitempty" gorm:"foreignKey:ComponentID"`
	Score        float64        `json:"score"`                               // nilai 0-100
}

func AutoMigrate(db *gorm.DB) {
	// Drop tabel lama yang struktur absensi & bank soalnya udah berubah total.
	// Data kosong (verified), aman drop.
	_ = db.Migrator().DropTable("attendance_items", "attendances")

	err := db.AutoMigrate(
		&School{},
		&User{},
		&Semester{},
		&Class{},
		&Subject{},
		&Teacher{},
		&Student{},
		// Bank Soal (struktur baru)
		&Topic{},
		&QuestionBank{},
		&Question{},
		&QuestionTopic{},
		&QuestionBankItem{},
		&QuestionVersion{},
		&ImportReport{},
		// Ujian
		&Exam{},
		&ExamAttempt{},
		&ExamAnswer{},
		// Absensi (struktur baru)
		&Schedule{},
		&AttendanceSession{},
		&Presence{},
		// Lain-lain
		&Raport{},
		&RaportItem{},
		&AIConfig{},
		&AIQuota{},
		&AIJob{},
		&CalendarEvent{},
		&Parent{},
		&ParentAccess{},
		&ReportComponent{},
		&StudentScore{},
	)
	if err != nil {
		panic("Failed to migrate: " + err.Error())
	}
}
