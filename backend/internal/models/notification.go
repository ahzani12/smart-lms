package models

import (
	"time"

	"gorm.io/gorm"
)

// ─── Notification Config (per sekolah) ────────────────────────
//
// Sekolah pilih provider WA + simpan API key.
// Provider: fonnte | wablas | telegram | none
// Provider "none" = system gak kirim WA sama sekali (fallback ke NoopNotifier).
type NotificationConfig struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	SchoolID uint    `json:"school_id" gorm:"uniqueIndex"`
	School   *School `json:"school,omitempty" gorm:"foreignKey:SchoolID"`

	Provider     string `json:"provider" gorm:"size:20;default:none"` // fonnte|wablas|telegram|none
	APIKey       string `json:"api_key" gorm:"size:500"`              // Fonnte token / Wablas token / Telegram bot token
	DeviceID     string `json:"device_id" gorm:"size:100"`            // Wablas only
	SenderNumber string `json:"sender_number" gorm:"size:30"`         // info display
	Enabled      bool   `json:"enabled" gorm:"default:false"`         // master switch

	// Per-event toggles (JSON map). Default semua false sampai sekolah aktifin manual.
	// Keys: alfa, terlambat, nilai_keluar, raport_siap, tagihan, pelanggaran, pengumuman
	EventsJSON string `json:"events_json" gorm:"type:text;default:'{}'"`
}

// ─── Notification Queue (outbox + retry) ──────────────────────
//
// Setiap notif dimasukin ke queue dulu. Worker (goroutine) baca queue tiap
// 30 detik, kirim ke provider, update status. Kalau gagal, retry max 3x
// dengan exponential backoff.
//
// Status: pending → sending → sent / failed
type NotificationQueue struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	SchoolID uint    `json:"school_id" gorm:"index"`
	School   *School `json:"school,omitempty" gorm:"foreignKey:SchoolID"`

	Event       string `json:"event" gorm:"size:40;index"` // alfa | nilai_keluar | tagihan | ...
	Recipient   string `json:"recipient" gorm:"size:30"`   // phone number (Fonnte/Wablas) or chat_id (Telegram)
	StudentID   *uint  `json:"student_id" gorm:"index"`    // optional, buat audit trail
	Message     string `json:"message" gorm:"type:text"`
	Provider    string `json:"provider" gorm:"size:20"` // snapshot waktu enqueue (kalau config berubah)

	Status     string     `json:"status" gorm:"size:20;default:pending;index"` // pending|sending|sent|failed
	Retries    int        `json:"retries" gorm:"default:0"`
	LastError  string     `json:"last_error" gorm:"type:text"`
	SentAt     *time.Time `json:"sent_at"`
	NextTryAt  *time.Time `json:"next_try_at" gorm:"index"` // exponential backoff
	ProviderID string     `json:"provider_id" gorm:"size:100"` // message ID dari provider (Fonnte returns ID)
}
