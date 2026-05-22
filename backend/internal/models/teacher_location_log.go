package models

import (
	"time"

	"gorm.io/gorm"
)

// TeacherLocationLog — audit trail lokasi guru pas buka/tolak absensi.
// Admin bisa lihat siapa yang sering dapat reject (suspect fake GPS).
type TeacherLocationLog struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time      `json:"created_at" gorm:"index"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID   uint           `json:"school_id" gorm:"index;not null"`
	UserID     uint           `json:"user_id" gorm:"index;not null"`
	ScheduleID *uint          `json:"schedule_id" gorm:"index"`

	Latitude    float64 `json:"latitude" gorm:"type:double precision"`
	Longitude   float64 `json:"longitude" gorm:"type:double precision"`
	AccuracyM   float64 `json:"accuracy_m" gorm:"type:double precision"`
	DistanceM   float64 `json:"distance_m" gorm:"type:double precision"` // jarak ke sekolah
	LocationAge int     `json:"location_age_s"`                          // umur reading dalam detik

	IPAddress  string `json:"ip_address" gorm:"size:45"`
	UserAgent  string `json:"user_agent" gorm:"size:500"`

	Action       string `json:"action" gorm:"size:50;index"` // open_session | speed_check | reject
	Allowed      bool   `json:"allowed" gorm:"index"`
	RejectReason string `json:"reject_reason" gorm:"type:text"` // distance | accuracy | mock | speed | stale
}
