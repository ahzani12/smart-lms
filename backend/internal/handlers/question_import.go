package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ─── DOCX IMPORT ENDPOINTS ────────────────────────────────────────────

// GET /api/question-banks/template-docx
// Download template .docx untuk import bank soal.
func DownloadQuestionTemplate(c *fiber.Ctx) error {
	data, err := BuildTemplateDocx()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal generate template: " + err.Error()})
	}
	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	c.Set("Content-Disposition", `attachment; filename="template-bank-soal.docx"`)
	c.Set("Cache-Control", "no-cache")
	return c.Send(data)
}

// POST /api/question-banks/:id/import-docx-preview
// multipart: file=<docx>
// Returns parsed questions (no DB write) so user can preview before commit.
func ImportDocxPreview(c *fiber.Ctx) error {
	bankID := paramID(c)

	var bank models.QuestionBank
	if err := config.DB.Where("id = ? AND school_id = ?", bankID, schoolID(c)).First(&bank).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bank soal tidak ditemukan"})
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "File tidak ditemukan (field: file)"})
	}
	if !strings.HasSuffix(strings.ToLower(fh.Filename), ".docx") {
		return c.Status(400).JSON(fiber.Map{"error": "File harus berformat .docx"})
	}
	if fh.Size > 10*1024*1024 {
		return c.Status(400).JSON(fiber.Map{"error": "File terlalu besar (max 10MB)"})
	}

	f, err := fh.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal buka file: " + err.Error()})
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal baca file: " + err.Error()})
	}

	text, err := ExtractDocxText(data)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	questions := ParseDocxQuestions(text)
	if len(questions) == 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "Tidak ada soal terdeteksi. Pastikan tiap soal diawali baris '=== SOAL N ==='",
		})
	}

	// Counts for summary
	var validCount, errorCount int
	for _, q := range questions {
		if len(q.Errors) == 0 {
			validCount++
		} else {
			errorCount++
		}
	}

	return c.JSON(fiber.Map{
		"bank":          bank,
		"questions":     questions,
		"total":         len(questions),
		"valid":         validCount,
		"with_errors":   errorCount,
	})
}

// POST /api/question-banks/:id/import-docx-commit
// body: { "questions": [...ParsedQuestion] }
// Creates Question rows + QuestionBankItem links. Skips items with errors.
func ImportDocxCommit(c *fiber.Ctx) error {
	bankID := paramID(c)

	var bank models.QuestionBank
	if err := config.DB.Where("id = ? AND school_id = ?", bankID, schoolID(c)).First(&bank).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bank soal tidak ditemukan"})
	}

	var req struct {
		Questions []ParsedQuestion `json:"questions"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Body invalid"})
	}
	if len(req.Questions) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Tidak ada soal untuk disimpan"})
	}

	// Resolve author (teacher_id) — kalau guru pakai teacher.ID, kalau admin nil OK.
	var authorID uint
	uid := userID(c)
	if uid > 0 {
		var teacher models.Teacher
		if err := config.DB.Where("user_id = ?", uid).First(&teacher).Error; err == nil {
			authorID = teacher.ID
		}
	}

	sid := schoolID(c)
	created := 0
	skipped := 0
	var errors []string

	// Find current max order in bank
	var maxOrder int
	config.DB.Model(&models.QuestionBankItem{}).
		Where("question_bank_id = ?", bank.ID).
		Select("COALESCE(MAX(\"order\"), 0)").
		Scan(&maxOrder)

	tx := config.DB.Begin()
	for _, pq := range req.Questions {
		if len(pq.Errors) > 0 {
			skipped++
			continue
		}

		// Build Question row
		q := models.Question{
			SchoolID:        sid,
			SubjectID:       bank.SubjectID,
			Level:           bank.Level,
			AuthorID:        authorID,
			Number:          pq.Number,
			Type:            pq.Type,
			Content:         pq.Content,
			Answer:          pq.Answer,
			Explanation:     pq.Explanation,
			AcceptedAnswers: pq.AcceptedAnswers,
			Keywords:        pq.Keywords,
			Difficulty:      pq.Difficulty,
			Points:          pq.Points,
			Visibility:      "school",
			CurrentVersion:  1,
		}
		if len(pq.Options) > 0 {
			b, _ := json.Marshal(pq.Options)
			q.Options = string(b)
		} else {
			q.Options = "[]" // jsonb tidak boleh string kosong
		}

		if err := tx.Create(&q).Error; err != nil {
			errors = append(errors, fmt.Sprintf("Soal #%d: %s", pq.Number, err.Error()))
			skipped++
			continue
		}

		maxOrder++
		item := models.QuestionBankItem{
			QuestionBankID: bank.ID,
			QuestionID:     q.ID,
			Order:          maxOrder,
			AddedAt:        time.Now(),
			AddedBy:        uid,
		}
		if err := tx.Create(&item).Error; err != nil {
			errors = append(errors, fmt.Sprintf("Soal #%d: link bank gagal: %s", pq.Number, err.Error()))
			skipped++
			continue
		}
		created++
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Commit gagal: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"created": created,
		"skipped": skipped,
		"errors":  errors,
		"message": fmt.Sprintf("%d soal berhasil ditambahkan ke bank '%s'", created, bank.Title),
	})
}
