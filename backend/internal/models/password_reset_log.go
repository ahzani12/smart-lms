package models

import (
	"time"

	"gorm.io/gorm"
)

// PasswordResetLog — audit trail untuk admin yang reset password user
type PasswordResetLog struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	CreatedAt     time.Time      `json:"created_at"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID      *uint          `json:"school_id" gorm:"index"`
	AdminID       uint           `json:"admin_id" gorm:"index"`     // siapa yang reset
	TargetUserID  uint           `json:"target_user_id" gorm:"index"` // password siapa di-reset
	Action        string         `json:"action" gorm:"size:50"`     // "reset_to_default", "manual_change", "self_change"
	IPAddress     string         `json:"ip_address" gorm:"size:45"`
	UserAgent     string         `json:"user_agent" gorm:"size:500"`
	Note          string         `json:"note" gorm:"type:text"`
}
