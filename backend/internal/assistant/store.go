package assistant

import (
	"encoding/json"
	"sync"
	"time"

	"smart-lms/internal/models"

	"gorm.io/gorm"
)

// PreviewStore — temporary cache untuk hasil parse+resolve.
// Setelah user klik "Simpan", FE kirim action_id, kita lookup dari sini & execute.
//
// Pakai in-memory map dgn mutex. TTL 10 menit.
// Alternatif: simpan ke DB / Redis. Untuk MVP, in-memory cukup.

type previewEntry struct {
	UserID    uint
	SchoolID  uint
	RawInput  string
	Intent    *Intent
	Resolved  *ResolvedAbsen
	Notif     *ResolvedNotif // utk NOTIF.* intent
	CreatedAt time.Time
}

type PreviewStore struct {
	mu       sync.RWMutex
	store    map[string]*previewEntry
	ttl      time.Duration
	stopCh   chan struct{}
}

var globalPreviewStore *PreviewStore
var initOnce sync.Once

// GetPreviewStore — singleton.
func GetPreviewStore() *PreviewStore {
	initOnce.Do(func() {
		globalPreviewStore = &PreviewStore{
			store:  make(map[string]*previewEntry),
			ttl:    10 * time.Minute,
			stopCh: make(chan struct{}),
		}
		go globalPreviewStore.gc()
	})
	return globalPreviewStore
}

// gc — periodic cleanup expired entries.
func (s *PreviewStore) gc() {
	t := time.NewTicker(2 * time.Minute)
	for {
		select {
		case <-s.stopCh:
			t.Stop()
			return
		case <-t.C:
			cutoff := time.Now().Add(-s.ttl)
			s.mu.Lock()
			for k, v := range s.store {
				if v.CreatedAt.Before(cutoff) {
					delete(s.store, k)
				}
			}
			s.mu.Unlock()
		}
	}
}

// Put — simpan hasil parse, return action_id.
func (s *PreviewStore) Put(userID, schoolID uint, raw string, intent *Intent, resolved *ResolvedAbsen) string {
	id := generateActionID()
	s.mu.Lock()
	s.store[id] = &previewEntry{
		UserID: userID, SchoolID: schoolID, RawInput: raw,
		Intent: intent, Resolved: resolved, CreatedAt: time.Now(),
	}
	s.mu.Unlock()
	return id
}

// PutNotif — simpan hasil parse utk NOTIF.* intent.
func (s *PreviewStore) PutNotif(userID, schoolID uint, raw string, intent *Intent, notif *ResolvedNotif) string {
	id := generateActionID()
	s.mu.Lock()
	s.store[id] = &previewEntry{
		UserID: userID, SchoolID: schoolID, RawInput: raw,
		Intent: intent, Notif: notif, CreatedAt: time.Now(),
	}
	s.mu.Unlock()
	return id
}

// Get — ambil entry, validate ownership.
func (s *PreviewStore) Get(actionID string, userID uint) (*previewEntry, bool) {
	s.mu.RLock()
	entry, ok := s.store[actionID]
	s.mu.RUnlock()
	if !ok {
		return nil, false
	}
	if entry.UserID != userID {
		return nil, false
	}
	if time.Since(entry.CreatedAt) > s.ttl {
		return nil, false
	}
	return entry, true
}

// Update — update resolved (dipake setelah user pilih ambiguous).
func (s *PreviewStore) Update(actionID string, resolved *ResolvedAbsen) {
	s.mu.Lock()
	if e, ok := s.store[actionID]; ok {
		e.Resolved = resolved
	}
	s.mu.Unlock()
}

// Delete — hapus setelah eksekusi sukses.
func (s *PreviewStore) Delete(actionID string) {
	s.mu.Lock()
	delete(s.store, actionID)
	s.mu.Unlock()
}

// generateActionID — random 12-char hex.
func generateActionID() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 12)
	now := time.Now().UnixNano()
	for i := range b {
		b[i] = chars[now%int64(len(chars))]
		now /= int64(len(chars))
		if now == 0 {
			now = time.Now().UnixNano() / int64(i+1)
		}
	}
	return string(b)
}

// ─── Logging helper ─────────────────────────────────────────

// LogParseAttempt — catat setiap input parsing, untuk audit & improvement.
func LogParseAttempt(db *gorm.DB, schoolID, userID uint, userName, userRole, ip, ua string,
	rawInput string, intent *Intent, status string, durationMs int) {

	intentID := ""
	confidence := 0.0
	if intent != nil {
		intentID = intent.ID
		confidence = intent.Confidence
	}
	slotsJSON := "{}"
	if intent != nil && intent.Slots != nil {
		if b, err := json.Marshal(intent.Slots); err == nil {
			slotsJSON = string(b)
		}
	}
	entry := models.AssistantLog{
		SchoolID:   schoolID,
		UserID:     userID,
		UserName:   userName,
		UserRole:   userRole,
		RawInput:   rawInput,
		Intent:     intentID,
		Confidence: confidence,
		Slots:      slotsJSON,
		Result:     "{}",
		UndoData:   "{}",
		Status:     status,
		DurationMs: durationMs,
		IPAddress:  ip,
		UserAgent:  ua,
	}
	db.Create(&entry)
}
