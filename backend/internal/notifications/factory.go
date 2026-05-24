package notifications

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"smart-lms/internal/models"

	"gorm.io/gorm"
)

// ─── Factory ──────────────────────────────────────────────────

// GetNotifier returns the active Notifier for a school based on its
// NotificationConfig. If no config exists, school disabled it, or provider="none",
// returns NoopNotifier (silent success).
//
// Caller never needs to nil-check — there's always a valid Notifier.
//
// Hot-reload: factory queries DB every call, jadi sekolah toggle config dari UI
// langsung kepake tanpa restart backend.
func GetNotifier(db *gorm.DB, schoolID uint) Notifier {
	cfg, err := LoadConfig(db, schoolID)
	if err != nil || cfg == nil || !cfg.Enabled {
		return NoopNotifier{}
	}
	switch strings.ToLower(cfg.Provider) {
	case "fonnte":
		return NewFonnteNotifier(cfg.APIKey)
	case "wablas":
		return NewWablasNotifier(cfg.APIKey, cfg.DeviceID)
	case "telegram":
		return NewTelegramNotifier(cfg.APIKey)
	default:
		return NoopNotifier{}
	}
}

// LoadConfig fetches the notification config for a school. Returns nil (not error)
// when no config row exists yet.
func LoadConfig(db *gorm.DB, schoolID uint) (*models.NotificationConfig, error) {
	var cfg models.NotificationConfig
	err := db.Where("school_id = ?", schoolID).First(&cfg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// ─── Event toggles ────────────────────────────────────────────

// IsEventEnabled checks whether a specific event type should send notifications
// for a given school. Returns false when:
//   - No config row exists
//   - Master switch (Enabled) is false
//   - Provider is "none"
//   - Event key is missing or false in events_json
//
// Event keys (recommended set):
//   - alfa, terlambat       (absensi)
//   - nilai_keluar          (per-mapel scoring)
//   - raport_siap           (raport published)
//   - tagihan, lunas        (keuangan)
//   - pelanggaran           (poin tata tertib)
//   - pengumuman            (broadcast manual)
func IsEventEnabled(db *gorm.DB, schoolID uint, event string) bool {
	cfg, err := LoadConfig(db, schoolID)
	if err != nil || cfg == nil || !cfg.Enabled {
		return false
	}
	if cfg.Provider == "" || cfg.Provider == "none" {
		return false
	}
	events := parseEvents(cfg.EventsJSON)
	v, ok := events[event]
	return ok && v
}

func parseEvents(raw string) map[string]bool {
	out := map[string]bool{}
	if raw == "" {
		return out
	}
	_ = json.Unmarshal([]byte(raw), &out)
	return out
}

// ─── Enqueue (public API for handlers) ────────────────────────

// Enqueue creates a NotificationQueue row in pending state.
// The worker goroutine will pick it up within ~30s.
//
// Caller pattern:
//
//	if notifications.IsEventEnabled(db, schoolID, "alfa") {
//	    notifications.Enqueue(db, notifications.Outbox{
//	        SchoolID:  schoolID,
//	        Event:     "alfa",
//	        Recipient: parent.Phone,
//	        StudentID: &student.ID,
//	        Message:   "Anak Anda alfa hari ini.",
//	    })
//	}
//
// Returns the queue row ID on success.
type Outbox struct {
	SchoolID  uint
	Event     string
	Recipient string
	StudentID *uint
	Message   string
}

func Enqueue(db *gorm.DB, item Outbox) (uint, error) {
	if item.Recipient == "" || item.Message == "" {
		return 0, fmt.Errorf("enqueue: recipient/message kosong")
	}

	cfg, err := LoadConfig(db, item.SchoolID)
	if err != nil {
		return 0, err
	}
	provider := "none"
	if cfg != nil {
		provider = cfg.Provider
	}

	now := time.Now()
	row := models.NotificationQueue{
		SchoolID:  item.SchoolID,
		Event:     item.Event,
		Recipient: item.Recipient,
		StudentID: item.StudentID,
		Message:   item.Message,
		Provider:  provider,
		Status:    "pending",
		NextTryAt: &now,
	}
	if err := db.Create(&row).Error; err != nil {
		return 0, err
	}
	return row.ID, nil
}
