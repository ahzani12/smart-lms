package handlers

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/nguyenthenguyen/docx"
	"gorm.io/gorm"
)

// ═══════════════════════════════════════════════════════════
// QUESTION BANK — playlist/koleksi referensi ke pool
// ═══════════════════════════════════════════════════════════

func GetQuestionBanks(c *fiber.Ctx) error {
	var banks []models.QuestionBank
	q := config.DB.Where("school_id = ?", schoolID(c))
	if subjectID := c.Query("subject_id"); subjectID != "" {
		q = q.Where("subject_id = ?", subjectID)
	}
	if level := c.Query("level"); level != "" {
		q = q.Where("level = ?", level)
	}
	q.Preload("Subject").Preload("Teacher.User").Order("id DESC").Find(&banks)

	// Attach item count per bank
	type bankView struct {
		models.QuestionBank
		ItemCount int64 `json:"item_count"`
	}
	out := make([]bankView, 0, len(banks))
	for _, b := range banks {
		var cnt int64
		config.DB.Model(&models.QuestionBankItem{}).Where("question_bank_id = ?", b.ID).Count(&cnt)
		out = append(out, bankView{QuestionBank: b, ItemCount: cnt})
	}
	return c.JSON(out)
}

func GetQuestionBank(c *fiber.Ctx) error {
	var bank models.QuestionBank
	if err := config.DB.Preload("Subject").Preload("Teacher.User").
		First(&bank, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bank soal tidak ditemukan"})
	}

	// Ambil items + nested question + topics
	var items []models.QuestionBankItem
	config.DB.Where("question_bank_id = ?", bank.ID).
		Preload("Question.Topics").
		Order(`"order" ASC, id ASC`).
		Find(&items)

	return c.JSON(fiber.Map{
		"bank":  bank,
		"items": items,
	})
}

func CreateQuestionBank(c *fiber.Ctx) error {
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		SubjectID   uint   `json:"subject_id"`
		Level       string `json:"level"`
		Visibility  string `json:"visibility"`
		TeacherID   *uint  `json:"teacher_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Title == "" || req.SubjectID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Title dan subject_id wajib"})
	}
	if req.Visibility == "" {
		req.Visibility = "private"
	}

	// Validate subject exists
	var subj models.Subject
	if err := config.DB.First(&subj, req.SubjectID).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Subject tidak ditemukan"})
	}

	// Resolve teacher_id: if caller is teacher, use their profile; if admin, allow optional teacher_id or nil
	var teacherID *uint
	if req.TeacherID != nil && *req.TeacherID > 0 {
		var t models.Teacher
		if err := config.DB.First(&t, *req.TeacherID).Error; err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Teacher tidak ditemukan"})
		}
		teacherID = req.TeacherID
	} else {
		userID := c.Locals("user_id").(uint)
		var teacher models.Teacher
		if err := config.DB.Where("user_id = ?", userID).First(&teacher).Error; err == nil {
			tid := teacher.ID
			teacherID = &tid
		}
		// admin without teacher profile → teacherID stays nil (NULL in DB), which is fine
	}

	bank := models.QuestionBank{
		Title:       req.Title,
		Description: req.Description,
		SubjectID:   req.SubjectID,
		Level:       req.Level,
		TeacherID:   teacherID,
		SchoolID:    schoolID(c),
		Visibility:  req.Visibility,
	}
	if err := config.DB.Create(&bank).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan bank: " + err.Error()})
	}
	return c.Status(201).JSON(fiber.Map{"message": "Bank soal dibuat", "id": bank.ID})
}

func UpdateQuestionBank(c *fiber.Ctx) error {
	var bank models.QuestionBank
	if err := config.DB.First(&bank, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bank tidak ditemukan"})
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Level       string `json:"level"`
		Visibility  string `json:"visibility"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	updates := map[string]interface{}{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Level != "" {
		updates["level"] = req.Level
	}
	if req.Visibility != "" {
		updates["visibility"] = req.Visibility
	}
	config.DB.Model(&bank).Updates(updates)
	return c.JSON(fiber.Map{"message": "Bank soal diupdate"})
}

func DeleteQuestionBank(c *fiber.Ctx) error {
	bankID := paramID(c)
	// Hapus relasi item dulu (soal di pool tetap hidup)
	config.DB.Where("question_bank_id = ?", bankID).Delete(&models.QuestionBankItem{})
	config.DB.Delete(&models.QuestionBank{}, bankID)
	return c.JSON(fiber.Map{"message": "Bank soal dihapus"})
}

// ═══════════════════════════════════════════════════════════
// QUESTION POOL — soal hidup di sini, gak terikat 1 bank
// ═══════════════════════════════════════════════════════════

// GET /api/questions/pool — list soal pool dengan filter
func GetQuestionPool(c *fiber.Ctx) error {
	var questions []models.Question
	q := config.DB.Where("questions.school_id = ?", schoolID(c))

	if subjectID := c.Query("subject_id"); subjectID != "" {
		q = q.Where("subject_id = ?", subjectID)
	}
	if level := c.Query("level"); level != "" {
		q = q.Where("level = ?", level)
	}
	if difficulty := c.Query("difficulty"); difficulty != "" {
		q = q.Where("difficulty = ?", difficulty)
	}
	if qtype := c.Query("type"); qtype != "" {
		q = q.Where("type = ?", qtype)
	}
	if search := c.Query("search"); search != "" {
		q = q.Where("content ILIKE ?", "%"+search+"%")
	}
	if topicID := c.Query("topic_id"); topicID != "" {
		q = q.Joins("JOIN question_topics qt ON qt.question_id = questions.id").
			Where("qt.topic_id = ?", topicID)
	}

	// Pagination
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	if limit > 200 {
		limit = 200
	}
	offset := (page - 1) * limit

	var total int64
	// Count perlu Model+Session clone kalau ada JOIN topic, supaya GROUP BY gak beda
	if topicID := c.Query("topic_id"); topicID != "" {
		// JOIN sudah di-apply di q, jadi pakai Distinct count by question id
		q.Distinct("questions.id").Model(&models.Question{}).Count(&total)
	} else {
		q.Session(&gorm.Session{}).Model(&models.Question{}).Count(&total)
	}

	q.Preload("Subject").Preload("Topics").
		Order("questions.created_at DESC").
		Limit(limit).Offset(offset).
		Find(&questions)

	return c.JSON(fiber.Map{
		"data":  questions,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func GetQuestion(c *fiber.Ctx) error {
	var q models.Question
	if err := config.DB.Preload("Subject").Preload("Topics").
		First(&q, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Soal tidak ditemukan"})
	}
	return c.JSON(q)
}

// POST /api/questions — bikin 1 soal di pool
func CreateQuestion(c *fiber.Ctx) error {
	var req struct {
		SubjectID   uint   `json:"subject_id"`
		Level       string `json:"level"`
		Type        string `json:"type"`
		Content     string `json:"content"`
		Options     string `json:"options"`
		Answer      string `json:"answer"`
		Explanation string `json:"explanation"`
		Difficulty  string `json:"difficulty"`
		Points      int    `json:"points"`
		Visibility  string `json:"visibility"`
		TopicIDs    []uint `json:"topic_ids"`
		BankID      uint   `json:"bank_id"` // optional: langsung masuk ke bank ini
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.SubjectID == 0 || req.Content == "" || req.Type == "" {
		return c.Status(400).JSON(fiber.Map{"error": "subject_id, content, type wajib"})
	}
	if req.Points == 0 {
		req.Points = 10
	}
	if req.Difficulty == "" {
		req.Difficulty = "sedang"
	}
	if req.Visibility == "" {
		req.Visibility = "private"
	}

	userID := c.Locals("user_id").(uint)
	var teacher models.Teacher
	config.DB.Where("user_id = ?", userID).First(&teacher)

	q := models.Question{
		SchoolID:       schoolID(c),
		SubjectID:      req.SubjectID,
		Level:          req.Level,
		AuthorID:       teacher.ID,
		Type:           req.Type,
		Content:        req.Content,
		Options:        req.Options,
		Answer:         req.Answer,
		Explanation:    req.Explanation,
		Difficulty:     req.Difficulty,
		Points:         req.Points,
		Visibility:     req.Visibility,
		CurrentVersion: 1,
	}
	config.DB.Create(&q)

	// Attach topics
	if len(req.TopicIDs) > 0 {
		var topics []models.Topic
		config.DB.Where("id IN ? AND school_id = ?", req.TopicIDs, schoolID(c)).Find(&topics)
		config.DB.Model(&q).Association("Topics").Replace(topics)
	}

	// Auto-attach ke bank kalau disediakan
	if req.BankID > 0 {
		addQuestionToBank(req.BankID, q.ID, userID)
	}

	// Bikin version awal
	snapshotVersion(q, userID, "initial")

	return c.Status(201).JSON(fiber.Map{"message": "Soal dibuat", "id": q.ID})
}

// POST /api/questions/bulk — bikin banyak soal di pool sekaligus
func CreateQuestionsBulk(c *fiber.Ctx) error {
	var req struct {
		SubjectID uint               `json:"subject_id"`
		Level     string             `json:"level"`
		BankID    uint               `json:"bank_id"` // optional
		TopicIDs  []uint             `json:"topic_ids"`
		Questions []models.Question  `json:"questions"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if len(req.Questions) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Questions kosong"})
	}

	userID := c.Locals("user_id").(uint)
	var teacher models.Teacher
	config.DB.Where("user_id = ?", userID).First(&teacher)

	sid := schoolID(c)
	for i := range req.Questions {
		q := &req.Questions[i]
		q.SchoolID = sid
		if q.SubjectID == 0 {
			q.SubjectID = req.SubjectID
		}
		if q.Level == "" {
			q.Level = req.Level
		}
		q.AuthorID = teacher.ID
		if q.Points == 0 {
			q.Points = 10
		}
		if q.Difficulty == "" {
			q.Difficulty = "sedang"
		}
		if q.CurrentVersion == 0 {
			q.CurrentVersion = 1
		}
	}
	config.DB.Create(&req.Questions)

	// Attach topics & add to bank
	var topics []models.Topic
	if len(req.TopicIDs) > 0 {
		config.DB.Where("id IN ? AND school_id = ?", req.TopicIDs, sid).Find(&topics)
	}
	for _, q := range req.Questions {
		if len(topics) > 0 {
			config.DB.Model(&q).Association("Topics").Replace(topics)
		}
		if req.BankID > 0 {
			addQuestionToBank(req.BankID, q.ID, userID)
		}
		snapshotVersion(q, userID, "bulk import")
	}

	return c.Status(201).JSON(fiber.Map{
		"message": fmt.Sprintf("%d soal ditambahkan", len(req.Questions)),
		"count":   len(req.Questions),
	})
}

// PUT /api/questions/:id — update + bikin version baru
func UpdateQuestion(c *fiber.Ctx) error {
	var q models.Question
	if err := config.DB.First(&q, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Soal tidak ditemukan"})
	}

	var req struct {
		Content     string `json:"content"`
		Options     string `json:"options"`
		Answer      string `json:"answer"`
		Explanation string `json:"explanation"`
		Difficulty  string `json:"difficulty"`
		Points      int    `json:"points"`
		Type        string `json:"type"`
		Level       string `json:"level"`
		TopicIDs    []uint `json:"topic_ids"`
		Reason      string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	userID := c.Locals("user_id").(uint)

	updates := map[string]interface{}{}
	if req.Content != "" {
		updates["content"] = req.Content
	}
	if req.Options != "" {
		updates["options"] = req.Options
	}
	if req.Answer != "" {
		updates["answer"] = req.Answer
	}
	if req.Explanation != "" {
		updates["explanation"] = req.Explanation
	}
	if req.Difficulty != "" {
		updates["difficulty"] = req.Difficulty
	}
	if req.Points > 0 {
		updates["points"] = req.Points
	}
	if req.Type != "" {
		updates["type"] = req.Type
	}
	if req.Level != "" {
		updates["level"] = req.Level
	}
	updates["current_version"] = q.CurrentVersion + 1

	config.DB.Model(&q).Updates(updates)

	// Update topics
	if req.TopicIDs != nil {
		var topics []models.Topic
		config.DB.Where("id IN ? AND school_id = ?", req.TopicIDs, schoolID(c)).Find(&topics)
		config.DB.Model(&q).Association("Topics").Replace(topics)
	}

	// Snapshot version baru (pake data terbaru)
	config.DB.First(&q, q.ID)
	reason := req.Reason
	if reason == "" {
		reason = "edit"
	}
	snapshotVersion(q, userID, reason)

	return c.JSON(fiber.Map{"message": "Soal diupdate", "version": q.CurrentVersion})
}

// DELETE /api/questions/:id — soft delete + hapus dari semua bank
func DeleteQuestion(c *fiber.Ctx) error {
	id := paramID(c)
	config.DB.Where("question_id = ?", id).Delete(&models.QuestionBankItem{})
	config.DB.Where("question_id = ?", id).Delete(&models.QuestionTopic{})
	config.DB.Delete(&models.Question{}, id)
	return c.JSON(fiber.Map{"message": "Soal dihapus"})
}

// GET /api/questions/:id/versions — history versi
func GetQuestionVersions(c *fiber.Ctx) error {
	var versions []models.QuestionVersion
	config.DB.Where("question_id = ?", paramID(c)).
		Order("version DESC").Find(&versions)
	return c.JSON(versions)
}

// ═══════════════════════════════════════════════════════════
// BANK ITEMS — tambah/hapus soal dari bank (m2m)
// ═══════════════════════════════════════════════════════════

// GET /api/question-banks/:id/items — soal di bank ini
func GetBankItems(c *fiber.Ctx) error {
	bankID := paramID(c)
	var items []models.QuestionBankItem
	config.DB.Where("question_bank_id = ?", bankID).
		Preload("Question.Subject").Preload("Question.Topics").
		Order(`"order" ASC, id ASC`).Find(&items)
	return c.JSON(items)
}

// POST /api/question-banks/:id/items — add soal dari pool ke bank
func AddBankItems(c *fiber.Ctx) error {
	bankID := paramID(c)

	var bank models.QuestionBank
	if err := config.DB.First(&bank, bankID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bank tidak ditemukan"})
	}

	var req struct {
		QuestionIDs []uint `json:"question_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if len(req.QuestionIDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "question_ids kosong"})
	}

	userID := c.Locals("user_id").(uint)
	added := 0
	for _, qid := range req.QuestionIDs {
		if addQuestionToBank(bankID, qid, userID) {
			added++
		}
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("%d soal ditambahkan ke bank", added),
		"added":   added,
		"skipped": len(req.QuestionIDs) - added,
	})
}

// DELETE /api/question-banks/:id/items/:item_id — hapus soal dari bank (tetap ada di pool)
func RemoveBankItem(c *fiber.Ctx) error {
	bankID := paramID(c)
	itemID, _ := strconv.ParseUint(c.Params("item_id"), 10, 64)
	config.DB.Where("question_bank_id = ? AND id = ?", bankID, itemID).Delete(&models.QuestionBankItem{})
	return c.JSON(fiber.Map{"message": "Soal dihapus dari bank"})
}

// PUT /api/question-banks/:id/items/reorder — susun ulang
func ReorderBankItems(c *fiber.Ctx) error {
	bankID := paramID(c)
	var req struct {
		Order []uint `json:"order"` // slice of item IDs in desired order
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	for i, id := range req.Order {
		config.DB.Model(&models.QuestionBankItem{}).
			Where("id = ? AND question_bank_id = ?", id, bankID).
			Update("order", i+1)
	}
	return c.JSON(fiber.Map{"message": "Urutan soal disimpan"})
}

// Helper — add question to bank, return true kalau berhasil (false kalau duplikat)
func addQuestionToBank(bankID, questionID, userID uint) bool {
	var exists int64
	config.DB.Model(&models.QuestionBankItem{}).
		Where("question_bank_id = ? AND question_id = ?", bankID, questionID).
		Count(&exists)
	if exists > 0 {
		return false
	}

	var maxOrder int
	config.DB.Model(&models.QuestionBankItem{}).
		Where("question_bank_id = ?", bankID).
		Select(`COALESCE(MAX("order"), 0)`).Scan(&maxOrder)

	item := models.QuestionBankItem{
		QuestionBankID: bankID,
		QuestionID:     questionID,
		Order:          maxOrder + 1,
		AddedAt:        time.Now(),
		AddedBy:        userID,
	}
	return config.DB.Create(&item).Error == nil
}

// Helper — bikin snapshot version
func snapshotVersion(q models.Question, editedBy uint, reason string) {
	v := models.QuestionVersion{
		QuestionID:  q.ID,
		Version:     q.CurrentVersion,
		Content:     q.Content,
		Options:     q.Options,
		Answer:      q.Answer,
		Explanation: q.Explanation,
		Points:      q.Points,
		Difficulty:  q.Difficulty,
		EditedBy:    editedBy,
		Reason:      reason,
	}
	config.DB.Create(&v)
}

// ═══════════════════════════════════════════════════════════
// IMPORT SOAL DARI WORD (.docx) → masuk ke pool + optional bank
// ═══════════════════════════════════════════════════════════

func ImportQuestionsFromWord(c *fiber.Ctx) error {
	bankID, _ := strconv.ParseUint(c.Params("bank_id"), 10, 64)

	var bank models.QuestionBank
	if err := config.DB.First(&bank, bankID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bank tidak ditemukan"})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "File tidak ditemukan"})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".docx" && ext != ".doc" {
		return c.Status(400).JSON(fiber.Map{"error": "Format harus .doc atau .docx"})
	}

	tmpDir := "/tmp/smart-lms"
	os.MkdirAll(tmpDir, 0755)
	tmpPath := filepath.Join(tmpDir, file.Filename)
	if err := c.SaveFile(file, tmpPath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan file"})
	}
	defer os.Remove(tmpPath)

	r, err := docx.ReadDocxFile(tmpPath)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membaca file Word: " + err.Error()})
	}
	defer r.Close()

	content := r.Editable().GetContent()

	userID := c.Locals("user_id").(uint)
	var teacher models.Teacher
	config.DB.Where("user_id = ?", userID).First(&teacher)

	questions, parseErrors := parseQuestionsFromText(content, schoolID(c), bank.SubjectID, bank.Level, teacher.ID)

	if len(questions) == 0 {
		return c.Status(400).JSON(fiber.Map{
			"error":  "Tidak ada soal terdeteksi dalam file",
			"errors": parseErrors,
		})
	}

	// Insert semua soal ke pool
	config.DB.Create(&questions)

	// Attach semua ke bank
	successCount := 0
	for _, q := range questions {
		if addQuestionToBank(uint(bankID), q.ID, userID) {
			successCount++
		}
		snapshotVersion(q, userID, "import docx")
	}

	// Record import report
	errJSON, _ := json.Marshal(parseErrors)
	report := models.ImportReport{
		QuestionBankID: uint(bankID),
		FileName:       file.Filename,
		TotalParsed:    len(questions),
		SuccessCount:   successCount,
		FailCount:      len(parseErrors),
		Errors:         string(errJSON),
		UploadedBy:     userID,
	}
	config.DB.Create(&report)

	return c.Status(201).JSON(fiber.Map{
		"message":   fmt.Sprintf("%d soal berhasil diimport", successCount),
		"count":     successCount,
		"errors":    parseErrors,
		"report_id": report.ID,
	})
}

type parseError struct {
	Line   int    `json:"line"`
	Reason string `json:"reason"`
}

func parseQuestionsFromText(content string, schoolID, subjectID uint, level string, authorID uint) ([]models.Question, []parseError) {
	var questions []models.Question
	var errors []parseError
	lines := strings.Split(content, "\n")

	var current *models.Question
	options := []map[string]string{}

	flush := func() {
		if current == nil {
			return
		}
		if len(options) > 0 {
			optJSON, _ := json.Marshal(options)
			current.Options = string(optJSON)
		}
		if current.Content == "" {
			return
		}
		questions = append(questions, *current)
	}

	for idx, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		if isQuestionStart(line) {
			flush()
			current = &models.Question{
				SchoolID:       schoolID,
				SubjectID:      subjectID,
				Level:          level,
				AuthorID:       authorID,
				Type:           "pilihan_ganda",
				Points:         10,
				Difficulty:     "sedang",
				Visibility:     "private",
				CurrentVersion: 1,
			}
			options = []map[string]string{}
			current.Content = extractQuestionText(line)
			continue
		}

		if current == nil {
			errors = append(errors, parseError{Line: idx + 1, Reason: "Text sebelum soal pertama diabaikan"})
			continue
		}

		if isOption(line) {
			key := strings.ToUpper(string(line[0]))
			text := strings.TrimSpace(line[2:])
			options = append(options, map[string]string{"key": key, "text": text})
			continue
		}

		upper := strings.ToUpper(line)
		if strings.HasPrefix(upper, "JAWABAN:") ||
			strings.HasPrefix(upper, "KUNCI:") ||
			strings.HasPrefix(upper, "ANSWER:") {
			current.Answer = strings.TrimSpace(line[strings.Index(line, ":")+1:])
			continue
		}

		if strings.HasPrefix(upper, "PEMBAHASAN:") || strings.HasPrefix(upper, "PENJELASAN:") {
			current.Explanation = strings.TrimSpace(line[strings.Index(line, ":")+1:])
			continue
		}

		if strings.Contains(strings.ToLower(line), "[essay]") {
			current.Type = "essay"
			continue
		}

		// append as continuation
		if current.Content != "" {
			current.Content += "\n" + line
		}
	}

	flush()
	return questions, errors
}

func isQuestionStart(line string) bool {
	patterns := []string{"soal ", "no.", "no "}
	lower := strings.ToLower(line)
	for _, p := range patterns {
		if strings.HasPrefix(lower, p) {
			return true
		}
	}
	if len(line) > 2 {
		if (line[0] >= '0' && line[0] <= '9') && (line[1] == '.' || line[1] == ')') {
			return true
		}
		if len(line) > 3 && (line[0] >= '0' && line[0] <= '9') && (line[1] >= '0' && line[1] <= '9') && (line[2] == '.' || line[2] == ')') {
			return true
		}
	}
	return false
}

func isOption(line string) bool {
	if len(line) < 3 {
		return false
	}
	upper := strings.ToUpper(line)
	return (upper[0] >= 'A' && upper[0] <= 'E') && (upper[1] == '.' || upper[1] == ')')
}

func extractQuestionText(line string) string {
	for i, ch := range line {
		if ch == '.' || ch == ')' {
			return strings.TrimSpace(line[i+1:])
		}
	}
	return line
}

// ═══════════════════════════════════════════════════════════
// TOPIC (BAB/KD) CRUD
// ═══════════════════════════════════════════════════════════

func GetTopics(c *fiber.Ctx) error {
	var topics []models.Topic
	q := config.DB.Where("school_id = ?", schoolID(c))
	if sid := c.Query("subject_id"); sid != "" {
		q = q.Where("subject_id = ?", sid)
	}
	if level := c.Query("level"); level != "" {
		q = q.Where("level = ? OR level = 'all'", level)
	}
	// Tree root only bila ?tree=1
	if c.Query("tree") == "1" {
		q = q.Where("parent_id IS NULL")
		q.Preload("Children", func(db interface{}) interface{} { return db }).
			Order(`"order" ASC, code ASC`).Find(&topics)
	} else {
		q.Order(`"order" ASC, code ASC`).Find(&topics)
	}
	return c.JSON(topics)
}

func CreateTopic(c *fiber.Ctx) error {
	var req models.Topic
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Name == "" || req.SubjectID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "name dan subject_id wajib"})
	}
	req.SchoolID = schoolID(c)
	config.DB.Create(&req)
	return c.Status(201).JSON(fiber.Map{"message": "Topic dibuat", "id": req.ID})
}

func UpdateTopic(c *fiber.Ctx) error {
	var t models.Topic
	if err := config.DB.First(&t, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Topic tidak ditemukan"})
	}
	var req models.Topic
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	req.ID = t.ID
	req.SchoolID = t.SchoolID
	config.DB.Save(&req)
	return c.JSON(fiber.Map{"message": "Topic diupdate"})
}

func DeleteTopic(c *fiber.Ctx) error {
	id := paramID(c)
	// Unlink dari semua soal
	config.DB.Where("topic_id = ?", id).Delete(&models.QuestionTopic{})
	// Re-parent anak ke null
	config.DB.Model(&models.Topic{}).Where("parent_id = ?", id).Update("parent_id", nil)
	config.DB.Delete(&models.Topic{}, id)
	return c.JSON(fiber.Map{"message": "Topic dihapus"})
}
