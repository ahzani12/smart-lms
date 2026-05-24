package notifications

import (
	"context"
	"log"
	"math"
	"time"

	"smart-lms/internal/models"

	"gorm.io/gorm"
)

// ─── Worker ────────────────────────────────────────────────────
//
// Worker adalah goroutine background yang:
//   1. Setiap PollInterval (default 30s) ambil notifikasi pending dari queue
//   2. Status -> "sending", coba kirim via provider (per-school config)
//   3. Sukses → status "sent", catat sent_at + provider_id
//   4. Gagal → retries++, hitung backoff (30s, 2m, 8m), reschedule next_try_at
//   5. Setelah MaxRetries (default 3) → status "failed", kasih alasan terakhir
//
// Worker bersifat per-process (1 backend = 1 worker). Kalau scaling horizontal,
// pakai SELECT ... FOR UPDATE SKIP LOCKED (PostgreSQL) biar worker lain gak
// double-process row yang sama. Untuk skala SSD (per sekolah ratusan-ribuan
// notif/bulan), 1 worker cukup.

type Worker struct {
	DB           *gorm.DB
	PollInterval time.Duration // default 30s
	BatchSize    int           // default 25 row per tick
	MaxRetries   int           // default 3
}

func NewWorker(db *gorm.DB) *Worker {
	return &Worker{
		DB:           db,
		PollInterval: 30 * time.Second,
		BatchSize:    25,
		MaxRetries:   3,
	}
}

// Start launches the worker as a goroutine. Cancel ctx to stop gracefully.
func (w *Worker) Start(ctx context.Context) {
	go func() {
		log.Printf("📨 Notification worker started (interval=%s, batch=%d, max_retries=%d)",
			w.PollInterval, w.BatchSize, w.MaxRetries)

		ticker := time.NewTicker(w.PollInterval)
		defer ticker.Stop()

		// Run once immediately on startup so existing queue gets drained
		w.tick()

		for {
			select {
			case <-ctx.Done():
				log.Println("📨 Notification worker stopped")
				return
			case <-ticker.C:
				w.tick()
			}
		}
	}()
}

// tick processes one batch of pending notifications.
func (w *Worker) tick() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("⚠️  notification worker panic: %v", r)
		}
	}()

	var batch []models.NotificationQueue
	now := time.Now()

	// Ambil pending atau retry yang udah lewat next_try_at
	err := w.DB.
		Where("status = ? AND (next_try_at IS NULL OR next_try_at <= ?)", "pending", now).
		Order("created_at ASC").
		Limit(w.BatchSize).
		Find(&batch).Error
	if err != nil {
		log.Printf("⚠️  notification worker query error: %v", err)
		return
	}

	if len(batch) == 0 {
		return
	}

	for i := range batch {
		w.sendOne(&batch[i])
	}
}

func (w *Worker) sendOne(q *models.NotificationQueue) {
	// Mark as sending (lightweight optimistic locking — pakai UPDATE WHERE status='pending')
	res := w.DB.Model(&models.NotificationQueue{}).
		Where("id = ? AND status = ?", q.ID, "pending").
		Update("status", "sending")
	if res.Error != nil || res.RowsAffected == 0 {
		// Worker lain sudah ambil, atau status berubah — skip
		return
	}

	notifier := GetNotifier(w.DB, q.SchoolID)
	providerID, err := notifier.Send(q.Recipient, q.Message)

	if err != nil {
		w.handleFailure(q, err.Error())
		return
	}

	// Sukses
	now := time.Now()
	w.DB.Model(q).Updates(map[string]interface{}{
		"status":      "sent",
		"sent_at":     now,
		"provider_id": providerID,
		"last_error":  "",
	})
	log.Printf("✅ notif sent id=%d school=%d event=%s to=%s provider=%s",
		q.ID, q.SchoolID, q.Event, q.Recipient, notifier.Name())
}

func (w *Worker) handleFailure(q *models.NotificationQueue, errMsg string) {
	q.Retries++
	q.LastError = errMsg

	if q.Retries >= w.MaxRetries {
		w.DB.Model(q).Updates(map[string]interface{}{
			"status":     "failed",
			"retries":    q.Retries,
			"last_error": errMsg,
		})
		log.Printf("❌ notif failed permanently id=%d school=%d retries=%d err=%s",
			q.ID, q.SchoolID, q.Retries, errMsg)
		return
	}

	// Exponential backoff: 30s, 2m, 8m
	backoff := time.Duration(math.Pow(4, float64(q.Retries))) * 30 * time.Second
	nextTry := time.Now().Add(backoff)

	w.DB.Model(q).Updates(map[string]interface{}{
		"status":      "pending",
		"retries":     q.Retries,
		"last_error":  errMsg,
		"next_try_at": nextTry,
	})
	log.Printf("⏳ notif retry id=%d school=%d retries=%d next_try=%s err=%s",
		q.ID, q.SchoolID, q.Retries, nextTry.Format(time.RFC3339), errMsg)
}
