package models

import (
	"time"

	"gorm.io/gorm"
)

// AssistantLog — audit trail untuk setiap input parsing & eksekusi.
// Manfaat:
//   - Audit (siapa kasih perintah apa, kapan)
//   - Improve patterns (lihat input yg sering gagal match)
//   - Undo support (rollback aksi terakhir < 5 menit)
type AssistantLog struct {
	ID         uint           `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time      `json:"created_at" gorm:"index"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID   uint           `json:"school_id" gorm:"index;not null"`
	UserID     uint           `json:"user_id" gorm:"index;not null"`
	UserName   string         `json:"user_name" gorm:"size:100"` // denormalize buat audit easy
	UserRole   string         `json:"user_role" gorm:"size:30"`
	RawInput   string         `json:"raw_input" gorm:"type:text;not null"`
	Intent     string         `json:"intent" gorm:"size:50;index"`     // ABSEN.BULK_HADIR / ""
	Confidence float64        `json:"confidence" gorm:"default:0"`
	Slots      string         `json:"slots" gorm:"type:jsonb"`         // JSON parsed slots
	Status     string         `json:"status" gorm:"size:30;index"`     // parsed|ambiguous|failed|executed|undone
	Result     string         `json:"result" gorm:"type:jsonb"`        // JSON exec result
	UndoData   string         `json:"undo_data" gorm:"type:jsonb"`     // payload utk rollback
	UndoUntil  *time.Time     `json:"undo_until"`                       // batas waktu undo (5 menit)
	DurationMs int            `json:"duration_ms"`
	IPAddress  string         `json:"ip_address" gorm:"size:45"`
	UserAgent  string         `json:"user_agent" gorm:"size:255"`
}
