package handlers

import (
	"strconv"
	"time"

	"smart-lms/internal/assistant"
	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ═══════════════════════════════════════════════════════════
// ASSISTANT — rule-based command parser
//
// Endpoint:
//   POST /api/assistant/parse              — parse + resolve, return preview
//   POST /api/assistant/resolve            — update slot setelah user pilih (klarifikasi)
//   POST /api/assistant/execute            — eksekusi action_id
//   POST /api/assistant/undo               — batalkan action terakhir
//   GET  /api/assistant/log                — riwayat aksi user
// ═══════════════════════════════════════════════════════════

// ParseRequest — body utk /parse.
type AssistantParseRequest struct {
	Input string `json:"input"`
}

// ParseResponse — return ke FE.
type AssistantParseResponse struct {
	ActionID    string                     `json:"action_id"`
	Intent      string                     `json:"intent"`
	Confidence  float64                    `json:"confidence"`
	Resolved    *assistant.ResolvedAbsen   `json:"resolved,omitempty"`
	Jadwal      *assistant.ResolvedJadwal  `json:"jadwal,omitempty"`
	Rekap       *assistant.ResolvedRekap   `json:"rekap,omitempty"`
	Tagihan     *assistant.ResolvedTagihan `json:"tagihan,omitempty"`
	Notif       *assistant.ResolvedNotif   `json:"notif,omitempty"`
	Suggestions []string                   `json:"suggestions,omitempty"`
	Errors      []string                   `json:"errors,omitempty"`
	Message     string                     `json:"message,omitempty"`
}

// AssistantParse — entrypoint utama: parse + resolve.
func AssistantParse(c *fiber.Ctx) error {
	startTime := time.Now()

	var req AssistantParseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	if len(req.Input) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "input kosong"})
	}
	if len(req.Input) > 500 {
		return c.Status(400).JSON(fiber.Map{"error": "input terlalu panjang (max 500 char)"})
	}

	sid := schoolID(c)
	userID := c.Locals("user_id").(uint)

	// Get user info utk log
	var user models.User
	config.DB.Select("id, name, role").First(&user, userID)

	// 1. Parse
	intent := assistant.Parse(req.Input)

	if intent.ID == "" {
		// Tidak match — log + return suggestions
		assistant.LogParseAttempt(config.DB, sid, userID, user.Name, user.Role,
			c.IP(), string(c.Request().Header.UserAgent()),
			req.Input, intent, "failed", int(time.Since(startTime).Milliseconds()))

		return c.JSON(AssistantParseResponse{
			Intent:      "",
			Suggestions: intent.Suggestions,
			Message:     "Hmm, aku belum ngerti. Coba pakai pola di bawah.",
		})
	}

	// 2. Resolve (untuk intent ABSEN.*)
	if intent.ID == "ABSEN.BULK_HADIR" || intent.ID == "ABSEN.MARK_KECUALI" || intent.ID == "ABSEN.SINGLE" {
		absenSlot, ok := intent.Slots["absen"].(assistant.ParsedAbsen)
		if !ok {
			return c.Status(500).JSON(fiber.Map{"error": "internal slot mismatch"})
		}
		resolver := assistant.NewResolver(config.DB, sid)
		resolved := resolver.ResolveAbsen(absenSlot)

		// Cache di preview store
		actionID := assistant.GetPreviewStore().Put(userID, sid, req.Input, intent, resolved)

		// Log
		status := "parsed"
		if len(resolved.Ambiguous) > 0 {
			status = "ambiguous"
		}
		if len(resolved.Errors) > 0 {
			status = "failed"
		}
		assistant.LogParseAttempt(config.DB, sid, userID, user.Name, user.Role,
			c.IP(), string(c.Request().Header.UserAgent()),
			req.Input, intent, status, int(time.Since(startTime).Milliseconds()))

		return c.JSON(AssistantParseResponse{
			ActionID:   actionID,
			Intent:     intent.ID,
			Confidence: intent.Confidence,
			Resolved:   resolved,
			Errors:     resolved.Errors,
		})
	}

	// 2b. Resolve (untuk intent JADWAL.*) — read-only, no execute
	if intent.ID == "JADWAL.TODAY" || intent.ID == "JADWAL.KELAS" || intent.ID == "JADWAL.GURU" {
		jadwalSlot, ok := intent.Slots["jadwal"].(assistant.ParsedJadwal)
		if !ok {
			return c.Status(500).JSON(fiber.Map{"error": "internal slot mismatch"})
		}
		resolver := assistant.NewResolver(config.DB, sid)
		jad := resolver.ResolveJadwal(jadwalSlot, userID)

		// No preview store needed (read-only)
		status := "parsed"
		if len(jad.Errors) > 0 {
			status = "failed"
		}
		assistant.LogParseAttempt(config.DB, sid, userID, user.Name, user.Role,
			c.IP(), string(c.Request().Header.UserAgent()),
			req.Input, intent, status, int(time.Since(startTime).Milliseconds()))

		return c.JSON(AssistantParseResponse{
			Intent:     intent.ID,
			Confidence: intent.Confidence,
			Jadwal:     jad,
			Errors:     jad.Errors,
		})
	}

	// 2c. Resolve (untuk intent REKAP.*) — read-only
	if intent.ID == "REKAP.ABSEN_TODAY" || intent.ID == "REKAP.ABSEN_STUDENT" {
		rekapSlot, ok := intent.Slots["rekap"].(assistant.ParsedRekap)
		if !ok {
			return c.Status(500).JSON(fiber.Map{"error": "internal slot mismatch"})
		}
		resolver := assistant.NewResolver(config.DB, sid)
		rek := resolver.ResolveRekap(rekapSlot)

		status := "parsed"
		if len(rek.Errors) > 0 {
			status = "failed"
		}
		assistant.LogParseAttempt(config.DB, sid, userID, user.Name, user.Role,
			c.IP(), string(c.Request().Header.UserAgent()),
			req.Input, intent, status, int(time.Since(startTime).Milliseconds()))

		return c.JSON(AssistantParseResponse{
			Intent:     intent.ID,
			Confidence: intent.Confidence,
			Rekap:      rek,
			Errors:     rek.Errors,
		})
	}

	// 2d. Resolve (untuk intent TAGIHAN.*) — read-only
	if intent.ID == "TAGIHAN.NUNGGAK" || intent.ID == "TAGIHAN.STUDENT" {
		tagSlot, ok := intent.Slots["tagihan"].(assistant.ParsedTagihan)
		if !ok {
			return c.Status(500).JSON(fiber.Map{"error": "internal slot mismatch"})
		}
		resolver := assistant.NewResolver(config.DB, sid)
		tag := resolver.ResolveTagihan(tagSlot)

		status := "parsed"
		if len(tag.Errors) > 0 {
			status = "failed"
		}
		assistant.LogParseAttempt(config.DB, sid, userID, user.Name, user.Role,
			c.IP(), string(c.Request().Header.UserAgent()),
			req.Input, intent, status, int(time.Since(startTime).Milliseconds()))

		return c.JSON(AssistantParseResponse{
			Intent:     intent.ID,
			Confidence: intent.Confidence,
			Tagihan:    tag,
			Errors:     tag.Errors,
		})
	}

	// 2e. Resolve (untuk intent NOTIF.*) — execute action (cache di store)
	if intent.ID == "NOTIF.WA_ORTU" {
		notifSlot, ok := intent.Slots["notif"].(assistant.ParsedNotif)
		if !ok {
			return c.Status(500).JSON(fiber.Map{"error": "internal slot mismatch"})
		}
		resolver := assistant.NewResolver(config.DB, sid)
		notif := resolver.ResolveNotif(notifSlot)

		// Cache utk eksekusi nanti
		actionID := assistant.GetPreviewStore().PutNotif(userID, sid, req.Input, intent, notif)

		status := "parsed"
		if len(notif.Errors) > 0 {
			status = "failed"
		}
		assistant.LogParseAttempt(config.DB, sid, userID, user.Name, user.Role,
			c.IP(), string(c.Request().Header.UserAgent()),
			req.Input, intent, status, int(time.Since(startTime).Milliseconds()))

		return c.JSON(AssistantParseResponse{
			ActionID:   actionID,
			Intent:     intent.ID,
			Confidence: intent.Confidence,
			Notif:      notif,
			Errors:     notif.Errors,
		})
	}

	// Intent dikenali tapi belum ada handler (fitur belum dibuat)
	return c.JSON(AssistantParseResponse{
		Intent:     intent.ID,
		Confidence: intent.Confidence,
		Message:    "Intent dikenali tapi fitur belum tersedia di Sprint 1.",
	})
}

// ─── Resolve (klarifikasi slot ambigu) ──────────────────────

type AssistantResolveRequest struct {
	ActionID string `json:"action_id"`
	// Pilihan user: slot_name → entity_id
	// Contoh: {"siswa[0]": 42, "schedule": 17}
	Picks map[string]uint `json:"picks"`
}

func AssistantResolve(c *fiber.Ctx) error {
	var req AssistantResolveRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	userID := c.Locals("user_id").(uint)
	sid := schoolID(c)

	entry, ok := assistant.GetPreviewStore().Get(req.ActionID, userID)
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "action expired or not found"})
	}

	// Apply picks ke entry.Resolved
	resolved := entry.Resolved
	resolver := assistant.NewResolver(config.DB, sid)

	for slotName, picked := range req.Picks {
		switch {
		case slotName == "kelas":
			// User pilih kelas dari ambiguous list
			var class models.Class
			if err := config.DB.Where("school_id = ? AND id = ?", sid, picked).First(&class).Error; err == nil {
				resolved.Kelas = &assistant.EntityRef{ID: class.ID, Name: class.Name}
			}
			// Hapus ambiguous "kelas"
			resolved.Ambiguous = removeAmbiguous(resolved.Ambiguous, "kelas")
			// Update student count
			var count int64
			config.DB.Model(&models.Student{}).
				Where("school_id = ? AND class_id = ?", sid, class.ID).Count(&count)
			resolved.StudentCount = int(count)
			// Reset & re-find schedules juga
			resolved.JadwalChoices = nil
			resolved.Schedule = nil

		case slotName == "schedule":
			var sc models.Schedule
			if err := config.DB.Preload("Subject").Preload("Teacher.User").
				Where("school_id = ? AND id = ?", sid, picked).First(&sc).Error; err == nil {
				resolved.Schedule = &assistant.EntityRef{
					ID: sc.ID, Name: subjectName(&sc),
					Extra: sc.StartTime + "-" + sc.EndTime,
				}
				if sc.Subject != nil {
					resolved.Mapel = &assistant.EntityRef{ID: sc.SubjectID, Name: sc.Subject.Name}
				}
			}
			resolved.JadwalChoices = nil
			resolved.Ambiguous = removeAmbiguous(resolved.Ambiguous, "schedule")

		case len(slotName) > 6 && slotName[:6] == "siswa[":
			// e.g. "siswa[0]"
			idxStr := slotName[6 : len(slotName)-1]
			_ = idxStr
			// Find original ambiguous entry untuk dapat status
			var amb *assistant.AmbiguousSlot
			for i := range resolved.Ambiguous {
				if resolved.Ambiguous[i].SlotName == slotName {
					amb = &resolved.Ambiguous[i]
					break
				}
			}
			if amb == nil {
				continue
			}
			// Find student
			var student models.Student
			if err := config.DB.Preload("User").Preload("Class").
				Where("school_id = ? AND id = ?", sid, picked).First(&student).Error; err == nil {
				resolved.Kecuali = append(resolved.Kecuali, assistant.ResolvedKecuali{
					StudentID: student.ID, Name: student.User.Name, NIS: student.NIS,
					ClassName: classNameOfStudent(&student),
					Status:    amb.StatusRef,
				})
			}
			resolved.Ambiguous = removeAmbiguous(resolved.Ambiguous, slotName)
		}
	}

	// Re-detect schedule kalau kelas baru saja di-pick & belum ada schedule
	if resolved.Kelas != nil && resolved.Schedule == nil && len(resolved.JadwalChoices) == 0 {
		schedules := resolver.FindSchedulesForClassDate(resolved.Kelas.ID, resolved.Tanggal)
		if len(schedules) == 1 {
			resolved.Schedule = &assistant.EntityRef{
				ID: schedules[0].ID, Name: subjectName(&schedules[0]),
				Extra: schedules[0].StartTime + "-" + schedules[0].EndTime,
			}
			if schedules[0].Subject != nil {
				resolved.Mapel = &assistant.EntityRef{ID: schedules[0].SubjectID, Name: schedules[0].Subject.Name}
			}
		} else if len(schedules) > 1 {
			choices := make([]assistant.EntityRef, 0, len(schedules))
			for _, s := range schedules {
				choices = append(choices, assistant.EntityRef{
					ID: s.ID, Name: subjectName(&s),
					Extra: s.StartTime + "-" + s.EndTime,
				})
			}
			resolved.JadwalChoices = choices
			resolved.Ambiguous = append(resolved.Ambiguous, assistant.AmbiguousSlot{
				SlotName: "schedule",
				Question: "Pilih jadwal " + resolved.Kelas.Name,
				Choices:  choices,
			})
		}
	}

	// Save back ke store
	assistant.GetPreviewStore().Update(req.ActionID, resolved)

	return c.JSON(AssistantParseResponse{
		ActionID: req.ActionID,
		Intent:   entry.Intent.ID,
		Resolved: resolved,
	})
}

func removeAmbiguous(arr []assistant.AmbiguousSlot, slotName string) []assistant.AmbiguousSlot {
	out := arr[:0]
	for _, a := range arr {
		if a.SlotName != slotName {
			out = append(out, a)
		}
	}
	return out
}

func subjectName(s *models.Schedule) string {
	if s.Subject != nil {
		return s.Subject.Name
	}
	return ""
}

func classNameOfStudent(s *models.Student) string {
	if s == nil || s.Class == nil {
		return ""
	}
	return s.Class.Name
}

// ─── Execute ────────────────────────────────────────────────

type AssistantExecuteRequest struct {
	ActionID string `json:"action_id"`
}

func AssistantExecute(c *fiber.Ctx) error {
	var req AssistantExecuteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	userID := c.Locals("user_id").(uint)
	sid := schoolID(c)

	entry, ok := assistant.GetPreviewStore().Get(req.ActionID, userID)
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "action expired or not found"})
	}
	// Path notif (validate before falling through to absen path)
	if entry.Notif != nil {
		executor := assistant.NewExecutor(config.DB, sid, userID)
		result, err := executor.ExecuteNotif(entry.Notif)
		if err != nil {
			return c.Status(400).JSON(result)
		}
		assistant.GetPreviewStore().Delete(req.ActionID)
		return c.JSON(result)
	}
	if entry.Resolved == nil {
		return c.Status(400).JSON(fiber.Map{"error": "tidak ada hasil resolve"})
	}
	if len(entry.Resolved.Ambiguous) > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error":     "masih ada slot ambigu",
			"ambiguous": entry.Resolved.Ambiguous,
		})
	}

	// Path absensi
	if isGuru(c) && !canTeacherAccessSchedule(userID, entry.Resolved.Schedule) {
		return c.Status(403).JSON(fiber.Map{"error": "Jadwal ini bukan milik Anda"})
	}

	executor := assistant.NewExecutor(config.DB, sid, userID)
	result, err := executor.ExecuteAbsen(entry.Resolved)
	if err != nil {
		return c.Status(400).JSON(result)
	}
	assistant.GetPreviewStore().Delete(req.ActionID)
	return c.JSON(result)
}

// canTeacherAccessSchedule — verify guru hanya bisa absen jadwalnya sendiri.
func canTeacherAccessSchedule(userID uint, schedRef *assistant.EntityRef) bool {
	if schedRef == nil {
		return false
	}
	var teacher models.Teacher
	if err := config.DB.Where("user_id = ?", userID).First(&teacher).Error; err != nil {
		return false
	}
	var sched models.Schedule
	if err := config.DB.First(&sched, schedRef.ID).Error; err != nil {
		return false
	}
	return sched.TeacherID == teacher.ID
}

// ─── Undo ───────────────────────────────────────────────────

type AssistantUndoRequest struct {
	UndoToken string `json:"undo_token"`
}

func AssistantUndo(c *fiber.Ctx) error {
	var req AssistantUndoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
	}
	userID := c.Locals("user_id").(uint)
	sid := schoolID(c)

	logID, err := strconv.ParseUint(req.UndoToken, 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid token"})
	}
	executor := assistant.NewExecutor(config.DB, sid, userID)
	result, err := executor.UndoLastAbsen(uint(logID))
	if err != nil {
		return c.Status(400).JSON(result)
	}
	return c.JSON(result)
}

// ─── Log (history) ──────────────────────────────────────────

func AssistantGetLog(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	sid := schoolID(c)

	limit := 50
	if l := c.QueryInt("limit", 50); l > 0 && l <= 200 {
		limit = l
	}

	var logs []models.AssistantLog
	q := config.DB.Where("school_id = ? AND user_id = ?", sid, userID).
		Order("created_at desc").Limit(limit)
	if intent := c.Query("intent"); intent != "" {
		q = q.Where("intent = ?", intent)
	}
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	q.Find(&logs)
	return c.JSON(logs)
}
