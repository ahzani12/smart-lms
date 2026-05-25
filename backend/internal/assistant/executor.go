package assistant

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"smart-lms/internal/models"

	"gorm.io/gorm"
)

// Executor — eksekusi action yang sudah di-resolve & di-confirm user.
//
// Flow:
//   1. Validate (semua slot resolved, no ambiguous)
//   2. Buat AttendanceSession (kalo belum ada utk schedule+date)
//   3. Bulk update Presence per siswa
//   4. Trigger notif untuk alfa/terlambat (delegate ke handler attendance.go)
//   5. Save undo data ke AssistantLog

// ExecuteResult — hasil eksekusi.
type ExecuteResult struct {
	Success    bool                   `json:"success"`
	Message    string                 `json:"message"`
	SessionID  uint                   `json:"session_id,omitempty"`
	Counts     map[string]int         `json:"counts,omitempty"` // {hadir:30, sakit:1, izin:1}
	UndoToken  string                 `json:"undo_token,omitempty"`
	UndoUntil  *time.Time             `json:"undo_until,omitempty"`
	NextActions []NextActionSuggestion `json:"next_actions,omitempty"`
	Errors     []string               `json:"errors,omitempty"`
}

// NextActionSuggestion — chip yg muncul setelah sukses.
type NextActionSuggestion struct {
	Label  string `json:"label"`  // "WA wali Andi"
	Hint   string `json:"hint"`   // "kirim wa wali andi tentang sakit"
	Icon   string `json:"icon"`   // emoji / icon name
}

// Executor — pemegang DB + context.
type Executor struct {
	DB       *gorm.DB
	SchoolID uint
	UserID   uint
}

func NewExecutor(db *gorm.DB, schoolID, userID uint) *Executor {
	return &Executor{DB: db, SchoolID: schoolID, UserID: userID}
}

// ExecuteAbsen — eksekusi ResolvedAbsen.
func (e *Executor) ExecuteAbsen(r *ResolvedAbsen) (*ExecuteResult, error) {
	// ── Validate ──
	if len(r.Errors) > 0 {
		return &ExecuteResult{Success: false, Errors: r.Errors}, errors.New("validation failed")
	}
	if len(r.Ambiguous) > 0 {
		return &ExecuteResult{Success: false, Message: "Masih ada slot ambigu, perlu user pilih dulu"},
			errors.New("ambiguous slots remaining")
	}
	if r.Schedule == nil {
		return &ExecuteResult{Success: false, Message: "Schedule belum dipilih"},
			errors.New("schedule not selected")
	}
	if r.Kelas == nil {
		return &ExecuteResult{Success: false, Message: "Kelas tidak ter-resolve"},
			errors.New("class not resolved")
	}

	// ── Find or create AttendanceSession ──
	var sess models.AttendanceSession
	dateOnly := time.Date(r.Tanggal.Year(), r.Tanggal.Month(), r.Tanggal.Day(), 0, 0, 0, 0, r.Tanggal.Location())
	err := e.DB.Where("school_id = ? AND schedule_id = ? AND date = ?",
		e.SchoolID, r.Schedule.ID, dateOnly).First(&sess).Error
	if err == gorm.ErrRecordNotFound {
		// QRToken wajib unik (constraint DB) — generate random meski kita gak pake QR.
		tokenBytes := make([]byte, 16)
		_, _ = rand.Read(tokenBytes)
		sess = models.AttendanceSession{
			SchoolID:   e.SchoolID,
			ScheduleID: r.Schedule.ID,
			Date:       dateOnly,
			OpenedBy:   e.UserID,
			OpenedAt:   time.Now(),
			Status:     "open",
			Method:     "manual",
			Note:       "via Asisten",
			QRToken:    "asst-" + hex.EncodeToString(tokenBytes),
		}
		if err := e.DB.Create(&sess).Error; err != nil {
			return &ExecuteResult{Success: false, Errors: []string{err.Error()}}, err
		}

		// Auto-create Presence row utk semua siswa di kelas
		var students []models.Student
		e.DB.Where("school_id = ? AND class_id = ?", e.SchoolID, r.Kelas.ID).Find(&students)
		now := time.Now()
		presences := make([]models.Presence, 0, len(students))
		for _, s := range students {
			presences = append(presences, models.Presence{
				SessionID: sess.ID,
				StudentID: s.ID,
				Status:    "alfa", // default sebelum di-update
				MarkedAt:  now,
				MarkedBy:  "system",
			})
		}
		if len(presences) > 0 {
			if err := e.DB.Create(&presences).Error; err != nil {
				return &ExecuteResult{Success: false, Errors: []string{err.Error()}}, err
			}
		}
	} else if err != nil {
		return &ExecuteResult{Success: false, Errors: []string{err.Error()}}, err
	}
	if sess.Status == "closed" {
		return &ExecuteResult{Success: false, Message: "Sesi sudah ditutup, gak bisa diubah"},
			errors.New("session closed")
	}

	// ── Build update plan ──
	// Default status untuk semua siswa
	defaultStatus := r.Default
	if defaultStatus == "" {
		defaultStatus = "alfa" // fallback
	}

	// Map student_id → status
	plan := map[uint]ResolvedKecuali{}
	if defaultStatus != "" && r.StudentCount > 0 {
		// Apply default ke semua siswa di kelas
		var students []models.Student
		e.DB.Where("school_id = ? AND class_id = ?", e.SchoolID, r.Kelas.ID).
			Preload("User").Find(&students)
		for _, s := range students {
			plan[s.ID] = ResolvedKecuali{
				StudentID: s.ID,
				Name:      s.User.Name,
				Status:    defaultStatus,
			}
		}
	}
	// Override dengan kecuali
	for _, k := range r.Kecuali {
		plan[k.StudentID] = k
	}

	// ── Capture undo data SEBELUM update ──
	undoSnapshot, err := e.captureUndoSnapshot(sess.ID, plan)
	if err != nil {
		return &ExecuteResult{Success: false, Errors: []string{err.Error()}}, err
	}

	// ── Bulk update Presence ──
	now := time.Now()
	counts := map[string]int{}
	updated := 0
	for studentID, k := range plan {
		res := e.DB.Model(&models.Presence{}).
			Where("session_id = ? AND student_id = ?", sess.ID, studentID).
			Updates(map[string]interface{}{
				"status":       k.Status,
				"note":         k.Note,
				"marked_at":    now,
				"marked_by":    "assistant",
				"marked_by_id": e.UserID,
			})
		if res.Error == nil && res.RowsAffected > 0 {
			counts[k.Status]++
			updated++
		}
	}

	// ── Save log dgn undo data ──
	undoUntil := time.Now().Add(5 * time.Minute)
	undoBytes, _ := json.Marshal(undoSnapshot)
	resultBytes, _ := json.Marshal(map[string]interface{}{
		"session_id": sess.ID,
		"counts":     counts,
		"updated":    updated,
	})
	logEntry := models.AssistantLog{
		SchoolID:  e.SchoolID,
		UserID:    e.UserID,
		Status:    "executed",
		Slots:     "{}", // empty JSON object — kolom JSONB butuh valid JSON
		Result:    string(resultBytes),
		UndoData:  string(undoBytes),
		UndoUntil: &undoUntil,
	}
	e.DB.Create(&logEntry)

	// ── Build response ──
	result := &ExecuteResult{
		Success:   true,
		Message:   buildSuccessMessage(counts, r.Kelas.Name, r.Mapel),
		SessionID: sess.ID,
		Counts:    counts,
		UndoToken: fmt.Sprintf("%d", logEntry.ID),
		UndoUntil: &undoUntil,
	}

	// Suggest WA notif kalau ada alfa/terlambat
	for _, k := range r.Kecuali {
		if k.Status == "alfa" || k.Status == "terlambat" {
			result.NextActions = append(result.NextActions, NextActionSuggestion{
				Label: "WA wali " + firstName(k.Name),
				Hint:  fmt.Sprintf("kirim wa wali %s", firstName(k.Name)),
				Icon:  "message-circle",
			})
		}
	}
	if len(result.NextActions) > 3 {
		result.NextActions = result.NextActions[:3]
	}

	return result, nil
}

// captureUndoSnapshot — simpan status presence SEBELUM update untuk rollback.
func (e *Executor) captureUndoSnapshot(sessionID uint, plan map[uint]ResolvedKecuali) (map[string]interface{}, error) {
	studentIDs := make([]uint, 0, len(plan))
	for id := range plan {
		studentIDs = append(studentIDs, id)
	}
	var presences []models.Presence
	e.DB.Where("session_id = ? AND student_id IN ?", sessionID, studentIDs).Find(&presences)

	prev := []map[string]interface{}{}
	for _, p := range presences {
		prev = append(prev, map[string]interface{}{
			"id":         p.ID,
			"student_id": p.StudentID,
			"status":     p.Status,
			"note":       p.Note,
			"late_min":   p.LateMin,
		})
	}
	return map[string]interface{}{
		"session_id": sessionID,
		"prev":       prev,
	}, nil
}

// UndoLastAbsen — rollback action di log_id, kalo masih dalam window.
func (e *Executor) UndoLastAbsen(logID uint) (*ExecuteResult, error) {
	var log models.AssistantLog
	if err := e.DB.First(&log, logID).Error; err != nil {
		return &ExecuteResult{Success: false, Message: "Aksi gak ketemu"}, err
	}
	if log.UserID != e.UserID {
		return &ExecuteResult{Success: false, Message: "Bukan aksi Anda"}, errors.New("not owner")
	}
	if log.UndoUntil == nil || time.Now().After(*log.UndoUntil) {
		return &ExecuteResult{Success: false, Message: "Window undo habis (5 menit)"}, errors.New("undo expired")
	}
	if log.Status == "undone" {
		return &ExecuteResult{Success: false, Message: "Sudah di-undo sebelumnya"}, errors.New("already undone")
	}

	var snapshot struct {
		SessionID uint                     `json:"session_id"`
		Prev      []map[string]interface{} `json:"prev"`
	}
	if err := json.Unmarshal([]byte(log.UndoData), &snapshot); err != nil {
		return &ExecuteResult{Success: false, Message: "Data undo rusak"}, err
	}

	// Restore each presence
	for _, p := range snapshot.Prev {
		updates := map[string]interface{}{
			"status":   p["status"],
			"note":     p["note"],
			"late_min": p["late_min"],
		}
		e.DB.Model(&models.Presence{}).Where("id = ?", uint(p["id"].(float64))).Updates(updates)
	}

	log.Status = "undone"
	e.DB.Save(&log)

	return &ExecuteResult{
		Success: true,
		Message: fmt.Sprintf("Aksi tadi sudah dibatalkan (%d siswa)", len(snapshot.Prev)),
	}, nil
}

// ─── helpers ────────────────────────────────────────────────

func buildSuccessMessage(counts map[string]int, className string, mapel *EntityRef) string {
	parts := []string{}
	if counts["hadir"] > 0 {
		parts = append(parts, fmt.Sprintf("%d hadir", counts["hadir"]))
	}
	if counts["sakit"] > 0 {
		parts = append(parts, fmt.Sprintf("%d sakit", counts["sakit"]))
	}
	if counts["izin"] > 0 {
		parts = append(parts, fmt.Sprintf("%d izin", counts["izin"]))
	}
	if counts["alfa"] > 0 {
		parts = append(parts, fmt.Sprintf("%d alfa", counts["alfa"]))
	}
	if counts["terlambat"] > 0 {
		parts = append(parts, fmt.Sprintf("%d terlambat", counts["terlambat"]))
	}
	mapelStr := ""
	if mapel != nil {
		mapelStr = " " + mapel.Name
	}
	return fmt.Sprintf("Tersimpan absen %s%s: %s",
		className, mapelStr, strings.Join(parts, ", "))
}

func firstName(full string) string {
	parts := strings.Fields(full)
	if len(parts) == 0 {
		return full
	}
	return parts[0]
}
