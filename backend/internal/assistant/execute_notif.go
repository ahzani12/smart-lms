package assistant

import (
	"errors"
	"fmt"

	"smart-lms/internal/models"

	"gorm.io/gorm"
)

// ExecuteNotif — eksekusi pengiriman notifikasi WA.
// Mengantrikan pesan ke notification_queues, worker yg ngirim aktualnya.
//
// Strategy:
//   - 1 enqueue per recipient
//   - Provider diisi otomatis di notifications.Enqueue (read NotificationConfig)
//   - Kalau provider=none, queue tetap dibuat (status=pending) tapi worker akan skip
func (e *Executor) ExecuteNotif(r *ResolvedNotif) (*ExecuteResult, error) {
	if len(r.Errors) > 0 {
		return &ExecuteResult{Success: false, Errors: r.Errors}, errors.New("validation failed")
	}
	if len(r.Recipients) == 0 {
		return &ExecuteResult{Success: false, Errors: []string{"Belum ada penerima"}},
			errors.New("no recipients")
	}
	if r.Pesan == "" {
		return &ExecuteResult{Success: false, Errors: []string{"Pesan kosong"}},
			errors.New("empty message")
	}
	if r.Student == nil {
		return &ExecuteResult{Success: false, Errors: []string{"Siswa tidak ter-resolve"}},
			errors.New("student not resolved")
	}

	// Cek provider lagi (defensive)
	provider := "none"
	var cfg models.NotificationConfig
	if err := e.DB.Where("school_id = ?", e.SchoolID).First(&cfg).Error; err == nil {
		if cfg.Enabled && cfg.Provider != "" && cfg.Provider != "none" {
			provider = cfg.Provider
		}
	}

	enqueued := 0
	skipped := 0
	for _, rcpt := range r.Recipients {
		if rcpt.Phone == "" {
			skipped++
			continue
		}
		studentID := r.Student.ID
		row := models.NotificationQueue{
			SchoolID:  e.SchoolID,
			Event:     eventFromTemplate(r.Template),
			Recipient: rcpt.Phone,
			StudentID: &studentID,
			Message:   r.Pesan,
			Provider:  provider,
			Status:    "pending",
		}
		if err := e.DB.Create(&row).Error; err != nil {
			return &ExecuteResult{Success: false, Errors: []string{err.Error()}}, err
		}
		enqueued++
	}

	msg := fmt.Sprintf("✅ %d pesan masuk antrian utk %s", enqueued, r.Student.Name)
	if provider == "none" {
		msg = fmt.Sprintf("📥 %d pesan masuk antrian utk %s — provider WA belum aktif, pesan tertunda sampai admin enable provider", enqueued, r.Student.Name)
	}
	if skipped > 0 {
		msg += fmt.Sprintf(" (%d skip — no phone)", skipped)
	}
	return &ExecuteResult{
		Success: true,
		Message: msg,
		Counts: map[string]int{
			"enqueued": enqueued,
			"skipped":  skipped,
		},
	}, nil
}

// eventFromTemplate — map template ke event key buat queue tracking.
func eventFromTemplate(template string) string {
	switch template {
	case "alfa", "sakit", "izin", "terlambat":
		return template
	}
	return "manual_wa"
}

// Defensive: ensure gorm/models imports are referenced if not used elsewhere.
var _ = gorm.ErrRecordNotFound
