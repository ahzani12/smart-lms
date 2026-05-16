package models

import (
	"time"

	"gorm.io/gorm"
)

// ─── Schedule (Jadwal Pelajaran) ───────────────────────────
// Dibuat sekali di awal semester. Jadi acuan "hari ini, kelas X, jam 1-2 Matematika".

type Schedule struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID   uint           `json:"school_id" gorm:"index;not null"`
	SemesterID uint           `json:"semester_id" gorm:"index;not null"`
	ClassID    uint           `json:"class_id" gorm:"index;not null"`
	Class      *Class         `json:"class,omitempty" gorm:"foreignKey:ClassID"`
	SubjectID  uint           `json:"subject_id" gorm:"index;not null"`
	Subject    *Subject       `json:"subject,omitempty" gorm:"foreignKey:SubjectID"`
	TeacherID  uint           `json:"teacher_id" gorm:"index;not null"`
	Teacher    *Teacher       `json:"teacher,omitempty" gorm:"foreignKey:TeacherID"`
	DayOfWeek  int            `json:"day_of_week" gorm:"not null;index"` // 1=Senin, 7=Minggu
	StartTime  string         `json:"start_time" gorm:"size:5;not null"` // "07:00"
	EndTime    string         `json:"end_time" gorm:"size:5;not null"`   // "08:30"
	Room       string         `json:"room" gorm:"size:50"`
	Kind       string         `json:"kind" gorm:"size:20;default:'mapel'"` // mapel | harian (absen pagi wali kelas)
}

// ─── Attendance Session ────────────────────────────────────
// Instance dari jadwal pada tanggal tertentu. Guru buka sesi → generate QR token.
// Unique (schedule_id, date) cegah duplikat.

type AttendanceSession struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID   uint           `json:"school_id" gorm:"index;not null"`
	ScheduleID uint           `json:"schedule_id" gorm:"index;not null;uniqueIndex:idx_session_schedule_date"`
	Schedule   *Schedule      `json:"schedule,omitempty" gorm:"foreignKey:ScheduleID"`
	Date       time.Time      `json:"date" gorm:"type:date;not null;index;uniqueIndex:idx_session_schedule_date"`
	OpenedBy   uint           `json:"opened_by" gorm:"index"` // user_id guru yang buka
	OpenedAt   time.Time      `json:"opened_at"`
	ClosedAt   *time.Time     `json:"closed_at"`
	Status     string         `json:"status" gorm:"size:20;default:'open'"` // open | closed
	QRToken    string         `json:"qr_token" gorm:"size:100;uniqueIndex"`
	QRExpires  *time.Time     `json:"qr_expires"`
	Method     string         `json:"method" gorm:"size:20;default:'manual'"` // manual | qr | mixed
	Note       string         `json:"note" gorm:"type:text"`
	Presences  []Presence     `json:"presences,omitempty" gorm:"foreignKey:SessionID"`
}

// ─── Presence (kehadiran per siswa per sesi) ────────────────

type Presence struct {
	ID         uint       `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	SessionID  uint       `json:"session_id" gorm:"index;not null;uniqueIndex:idx_presence_session_student"`
	StudentID  uint       `json:"student_id" gorm:"index;not null;uniqueIndex:idx_presence_session_student"`
	Student    *Student   `json:"student,omitempty" gorm:"foreignKey:StudentID"`
	Status     string     `json:"status" gorm:"size:20;not null"` // hadir | izin | sakit | alfa | terlambat
	MarkedAt   time.Time  `json:"marked_at"`
	MarkedBy   string     `json:"marked_by" gorm:"size:20"` // self | teacher
	MarkedByID *uint      `json:"marked_by_id"`              // user_id yang nandain
	Note       string     `json:"note" gorm:"size:255"`
	IPAddress  string     `json:"ip_address" gorm:"size:45"`
	Device     string     `json:"device" gorm:"size:255"`
	PhotoURL   string     `json:"photo_url" gorm:"size:500"` // opsional
	LateMin    int        `json:"late_min" gorm:"default:0"` // menit keterlambatan
}
