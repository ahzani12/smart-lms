package handlers

import (
	"fmt"
	"math"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// ─── Exams ────────────────────────────────────────────────

func GetExams(c *fiber.Ctx) error {
	var exams []models.Exam
	q := config.DB.Where("school_id = ?", schoolID(c))

	// Students only see active exams for their own class
	role, _ := c.Locals("role").(string)
	if role == "siswa" {
		userID := c.Locals("user_id").(uint)
		var student models.Student
		if err := config.DB.Where("user_id = ?", userID).First(&student).Error; err != nil {
			return c.JSON([]models.Exam{})
		}
		if student.ClassID == nil {
			return c.JSON([]models.Exam{})
		}
		q = q.Where("class_id = ?", *student.ClassID).Where("status = ?", "active")
	} else {
		if status := c.Query("status"); status != "" {
			q = q.Where("status = ?", status)
		}
		if classID := c.Query("class_id"); classID != "" {
			q = q.Where("class_id = ?", classID)
		}
	}

	q.Preload("Subject").Preload("Class").Preload("Teacher.User").Order("created_at DESC").Find(&exams)
	return c.JSON(exams)
}

// GetMyAttempts returns the logged-in student's attempts across all exams
func GetMyAttempts(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	var student models.Student
	if err := config.DB.Where("user_id = ?", userID).First(&student).Error; err != nil {
		return c.JSON([]models.ExamAttempt{})
	}
	var attempts []models.ExamAttempt
	config.DB.Where("student_id = ?", student.ID).Order("created_at DESC").Find(&attempts)
	return c.JSON(attempts)
}

func GetExam(c *fiber.Ctx) error {
	var exam models.Exam
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).
		Preload("Subject").Preload("Class").Preload("Teacher.User").
		Preload("QuestionBank").First(&exam).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ujian tidak ditemukan"})
	}
	return c.JSON(exam)
}

func CreateExam(c *fiber.Ctx) error {
	var exam models.Exam
	if err := c.BodyParser(&exam); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// If teacher_id not provided in body, fall back to the logged-in user's teacher record.
	// Admins (admin_pusat/admin_cabang) don't have a Teacher row, so they MUST send teacher_id.
	if exam.TeacherID == 0 {
		userID := c.Locals("user_id").(uint)
		var teacher models.Teacher
		if err := config.DB.Where("user_id = ?", userID).First(&teacher).Error; err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Guru pengampu wajib dipilih"})
		}
		exam.TeacherID = teacher.ID
	} else {
		// Validate teacher exists and belongs to this school
		var t models.Teacher
		if err := config.DB.Where("id = ?", exam.TeacherID).First(&t).Error; err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Guru tidak ditemukan"})
		}
	}

	// Validate required foreign keys
	if exam.SubjectID == 0 || exam.ClassID == 0 || exam.SemesterID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Mapel, kelas, dan semester wajib diisi"})
	}
	if exam.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Judul wajib diisi"})
	}

	exam.SchoolID = schoolID(c)
	exam.Status = "draft"

	if err := config.DB.Create(&exam).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan ujian: " + err.Error()})
	}
	return c.Status(201).JSON(fiber.Map{"message": "Ujian dibuat", "id": exam.ID})
}

func UpdateExam(c *fiber.Ctx) error {
	var exam models.Exam
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&exam).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ujian tidak ditemukan"})
	}
	if err := c.BodyParser(&exam); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	exam.ID = paramID(c)
	exam.SchoolID = schoolID(c)
	config.DB.Save(&exam)
	return c.JSON(fiber.Map{"message": "Ujian diupdate"})
}

func DeleteExam(c *fiber.Ctx) error {
	var exam models.Exam
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&exam).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ujian tidak ditemukan"})
	}
	config.DB.Where("exam_id = ?", exam.ID).Delete(&models.ExamAttempt{})
	config.DB.Delete(&exam)
	return c.JSON(fiber.Map{"message": "Ujian dihapus"})
}

// validateExamReadiness returns an error message if the exam can't be started
// or taken. Empty string means OK. Checks duration, total_questions, and that
// the linked question bank actually has enough published items.
func validateExamReadiness(exam *models.Exam) string {
	if exam.Duration <= 0 {
		return "Durasi ujian belum diisi (harus > 0 menit)"
	}
	if exam.TotalQuestions <= 0 {
		return "Jumlah soal belum diisi (harus > 0)"
	}
	if exam.QuestionBankID == nil || *exam.QuestionBankID == 0 {
		return "Bank soal belum dipilih"
	}
	var itemCount int64
	config.DB.Table("question_bank_items").
		Where("question_bank_id = ?", *exam.QuestionBankID).
		Count(&itemCount)
	if itemCount == 0 {
		return "Bank soal kosong, tambahkan soal terlebih dahulu"
	}
	if int64(exam.TotalQuestions) > itemCount {
		return fmt.Sprintf("Jumlah soal ujian (%d) melebihi soal tersedia di bank (%d)", exam.TotalQuestions, itemCount)
	}
	return ""
}

func StartExam(c *fiber.Ctx) error {
	var exam models.Exam
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&exam).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ujian tidak ditemukan"})
	}
	if msg := validateExamReadiness(&exam); msg != "" {
		return c.Status(400).JSON(fiber.Map{"error": msg})
	}
	exam.Status = "active"
	if err := config.DB.Save(&exam).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan status ujian"})
	}
	return c.JSON(fiber.Map{"message": "Ujian dimulai"})
}

func EndExam(c *fiber.Ctx) error {
	var exam models.Exam
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&exam).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ujian tidak ditemukan"})
	}
	exam.Status = "finished"
	config.DB.Save(&exam)

	// Auto-grade all attempts
	autoGradeExam(exam.ID)

	return c.JSON(fiber.Map{"message": "Ujian selesai, semua jawaban dinilai"})
}

// ─── Exam Attempts (Siswa) ────────────────────────────────

func GetExamQuestions(c *fiber.Ctx) error {
	examID := paramID(c)
	var exam models.Exam
	if err := config.DB.Where("id = ? AND school_id = ?", examID, schoolID(c)).First(&exam).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ujian tidak ditemukan"})
	}

	// Guard: only active exams can be taken
	if exam.Status != "active" {
		return c.Status(400).JSON(fiber.Map{"error": "Ujian belum aktif atau sudah berakhir"})
	}

	// Guard: exam must be fully configured before any attempt is created.
	// Prevents the "instant-submit" bug where duration=0 makes the client
	// timer expire immediately and auto-submit an empty attempt.
	if msg := validateExamReadiness(&exam); msg != "" {
		return c.Status(400).JSON(fiber.Map{"error": msg})
	}

	// Check if student already has attempt
	userID := c.Locals("user_id").(uint)
	var student models.Student
	config.DB.Where("user_id = ?", userID).First(&student)

	var attempt models.ExamAttempt
	result := config.DB.Where("exam_id = ? AND student_id = ?", examID, student.ID).First(&attempt)
	if result.Error == nil && attempt.Status != "in_progress" {
		return c.Status(400).JSON(fiber.Map{"error": "Anda sudah mengerjakan ujian ini"})
	}

	// Create attempt if not exists
	if result.Error != nil {
		attempt = models.ExamAttempt{
			ExamID:    examID,
			StudentID: student.ID,
			StartTime: time.Now(),
			Status:    "in_progress",
		}
		if err := config.DB.Create(&attempt).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat attempt"})
		}
	}

	// Get questions from bank via BankItems (m2m)
	var questions []models.Question
	if exam.QuestionBankID != nil {
		config.DB.
			Joins("JOIN question_bank_items qbi ON qbi.question_id = questions.id").
			Where("qbi.question_bank_id = ?", *exam.QuestionBankID).
			Order(`qbi."order" ASC`).
			Find(&questions)
	}

	// Shuffle if enabled
	if exam.ShuffleQuestions {
		// Simple shuffle
		for i := len(questions) - 1; i > 0; i-- {
			j := int(time.Now().UnixNano()) % (i + 1)
			questions[i], questions[j] = questions[j], questions[i]
		}
	}

	// Remove answers from response
	type QuestionView struct {
		ID      uint   `json:"id"`
		Number  int    `json:"number"`
		Type    string `json:"type"`
		Content string `json:"content"`
		Options string `json:"options"`
		Points  int    `json:"points"`
	}
	var views []QuestionView
	for _, q := range questions {
		views = append(views, QuestionView{
			ID: q.ID, Number: q.Number, Type: q.Type,
			Content: q.Content, Options: q.Options, Points: q.Points,
		})
	}

	return c.JSON(fiber.Map{
		"attempt":    attempt,
		"exam":       exam,
		"questions":  views,
	})
}

func SubmitExam(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)

	var req struct {
		AttemptID uint `json:"attempt_id"`
		Answers   []struct {
			QuestionID uint   `json:"question_id"`
			Answer     string `json:"answer"`
		} `json:"answers"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var attempt models.ExamAttempt
	config.DB.First(&attempt, req.AttemptID)

	// Check ownership
	var student models.Student
	config.DB.Where("user_id = ?", userID).First(&student)
	if attempt.StudentID != student.ID {
		return c.Status(403).JSON(fiber.Map{"error": "Bukan ujian Anda"})
	}

	// Save answers
	for _, a := range req.Answers {
		answer := models.ExamAnswer{
			ExamAttemptID: attempt.ID,
			QuestionID:    a.QuestionID,
			Answer:        a.Answer,
		}
		config.DB.Create(&answer)
	}

	// Update attempt
	now := time.Now()
	attempt.EndTime = &now
	attempt.Status = "submitted"
	config.DB.Save(&attempt)

	// Auto-grade
	autoGradeAttempt(attempt.ID)

	config.DB.First(&attempt, attempt.ID)
	return c.JSON(fiber.Map{"message": "Ujian disubmit", "score": attempt.Score, "status": attempt.Status})
}

func ReportTabSwitch(c *fiber.Ctx) error {
	examID := paramID(c)

	// Verify exam belongs to this school
	var exam models.Exam
	if err := config.DB.Where("id = ? AND school_id = ?", examID, schoolID(c)).First(&exam).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ujian tidak ditemukan"})
	}

	userID := c.Locals("user_id").(uint)

	var student models.Student
	config.DB.Where("user_id = ?", userID).First(&student)

	var attempt models.ExamAttempt
	config.DB.Where("exam_id = ? AND student_id = ? AND status = 'in_progress'", examID, student.ID).First(&attempt)

	attempt.TabSwitches++
	config.DB.Save(&attempt)

	// Check if exceeded limit
	if attempt.TabSwitches >= exam.MaxTabSwitches {
		attempt.Flagged = true
		config.DB.Save(&attempt)
		return c.JSON(fiber.Map{"warning": "Batas perpindahan tab terlampaui", "flagged": true, "switches": attempt.TabSwitches})
	}

	return c.JSON(fiber.Map{"switches": attempt.TabSwitches, "max": exam.MaxTabSwitches})
}

// ─── Exam Monitoring ──────────────────────────────────────

func GetExamMonitoring(c *fiber.Ctx) error {
	examID := paramID(c)

	var exam models.Exam
	if err := config.DB.Where("id = ? AND school_id = ?", examID, schoolID(c)).First(&exam).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ujian tidak ditemukan"})
	}

	var attempts []models.ExamAttempt
	config.DB.Where("exam_id = ?", examID).Preload("Student.User").Find(&attempts)

	type MonitoringData struct {
		StudentName  string     `json:"student_name"`
		StudentNIS   string     `json:"student_nis"`
		Status       string     `json:"status"`
		StartTime    time.Time  `json:"start_time"`
		EndTime      *time.Time `json:"end_time"`
		Score        *float64   `json:"score"`
		TabSwitches  int        `json:"tab_switches"`
		Flagged      bool       `json:"flagged"`
		Progress     float64    `json:"progress"`
	}

	var totalQuestions int64
	if exam.QuestionBankID != nil {
		config.DB.Model(&models.QuestionBankItem{}).Where("question_bank_id = ?", *exam.QuestionBankID).Count(&totalQuestions)
	}

	var data []MonitoringData
	for _, a := range attempts {
		var answeredCount int64
		config.DB.Model(&models.ExamAnswer{}).Where("exam_attempt_id = ?", a.ID).Count(&answeredCount)

		progress := float64(0)
		if totalQuestions > 0 {
			progress = math.Round(float64(answeredCount)/float64(totalQuestions)*100*100) / 100
		}

		data = append(data, MonitoringData{
			StudentName: a.Student.User.Name,
			StudentNIS:  a.Student.NIS,
			Status:      a.Status,
			StartTime:   a.StartTime,
			EndTime:     a.EndTime,
			Score:       a.Score,
			TabSwitches: a.TabSwitches,
			Flagged:     a.Flagged,
			Progress:    progress,
		})
	}

	return c.JSON(fiber.Map{
		"exam":            exam,
		"total_students":  len(attempts),
		"total_questions": totalQuestions,
		"monitoring":      data,
	})
}

// ─── Auto-grading ─────────────────────────────────────────

func autoGradeExam(examID uint) {
	var attempts []models.ExamAttempt
	config.DB.Where("exam_id = ? AND status = 'submitted'", examID).Find(&attempts)
	for _, a := range attempts {
		autoGradeAttempt(a.ID)
	}
}

func autoGradeAttempt(attemptID uint) {
	var attempt models.ExamAttempt
	config.DB.First(&attempt, attemptID)

	var exam models.Exam
	config.DB.First(&exam, attempt.ExamID)

	var answers []models.ExamAnswer
	config.DB.Where("exam_attempt_id = ?", attemptID).Find(&answers)

	var totalScore float64
	var totalPoints float64

	for _, ans := range answers {
		var question models.Question
		config.DB.First(&question, ans.QuestionID)

		totalPoints += float64(question.Points)

		score, correct, graded := scoreAnswer(question, ans.Answer)
		if !graded {
			continue // essay tanpa keyword → manual grading
		}

		ans.IsCorrect = &correct
		ans.Score = &score
		totalScore += score

		// Update item statistics
		if correct {
			config.DB.Model(&question).Updates(map[string]interface{}{
				"correct_count":  gorm.Expr("correct_count + 1"),
				"total_attempts": gorm.Expr("total_attempts + 1"),
			})
		} else {
			config.DB.Model(&question).Update("total_attempts", gorm.Expr("total_attempts + 1"))
		}
		config.DB.Save(&ans)
	}

	if totalPoints > 0 {
		finalScore := math.Round(totalScore/totalPoints*100*100) / 100
		attempt.Score = &finalScore
		attempt.Status = "graded"
		config.DB.Save(&attempt)
	}
}

// ─── Analisis Butir Soal ──────────────────────────────────

func GetItemAnalysis(c *fiber.Ctx) error {
	examID := paramID(c)

	var exam models.Exam
	if err := config.DB.Where("id = ? AND school_id = ?", examID, schoolID(c)).First(&exam).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ujian tidak ditemukan"})
	}

	var questions []models.Question
	if exam.QuestionBankID != nil {
		config.DB.
			Joins("JOIN question_bank_items qbi ON qbi.question_id = questions.id").
			Where("qbi.question_bank_id = ?", *exam.QuestionBankID).
			Find(&questions)
	}

	type ItemAnalysis struct {
		QuestionID    uint    `json:"question_id"`
		Number        int     `json:"number"`
		Content       string  `json:"content"`
		CorrectCount  int     `json:"correct_count"`
		TotalAttempts int     `json:"total_attempts"`
		Difficulty    float64 `json:"difficulty_index"` // P = correct / total
		Discrimination float64 `json:"discrimination"`
		Quality       string  `json:"quality"`
	}

	var results []ItemAnalysis
	for _, q := range questions {
		diff := float64(0)
		if q.TotalAttempts > 0 {
			diff = float64(q.CorrectCount) / float64(q.TotalAttempts)
		}

		quality := "Baik"
		if diff < 0.2 {
			quality = "Terlalu Sulit"
		} else if diff > 0.8 {
			quality = "Terlalu Mudah"
		}

		results = append(results, ItemAnalysis{
			QuestionID:     q.ID,
			Number:         q.Number,
			Content:        q.Content,
			CorrectCount:   q.CorrectCount,
			TotalAttempts:  q.TotalAttempts,
			Difficulty:     math.Round(diff*100) / 100,
			Discrimination: q.Discrimination,
			Quality:        quality,
		})
	}

	return c.JSON(fiber.Map{
		"exam":    exam,
		"analysis": results,
	})
}

// GetAttemptsList returns a compact list of (attempt_id, student_nis, student_name)
// for every attempt on an exam. Used by the teacher monitor page so it can map a
// row back to an attempt id for grading / reset actions.
func GetAttemptsList(c *fiber.Ctx) error {
	examID := paramID(c)

	var exam models.Exam
	if err := config.DB.Where("id = ? AND school_id = ?", examID, schoolID(c)).First(&exam).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ujian tidak ditemukan"})
	}

	var attempts []models.ExamAttempt
	config.DB.Where("exam_id = ?", examID).Preload("Student.User").Find(&attempts)

	type Row struct {
		ID          uint   `json:"id"`
		StudentNIS  string `json:"student_nis"`
		StudentName string `json:"student_name"`
		Status      string `json:"status"`
	}
	out := make([]Row, 0, len(attempts))
	for _, a := range attempts {
		out = append(out, Row{
			ID: a.ID, StudentNIS: a.Student.NIS,
			StudentName: a.Student.User.Name, Status: a.Status,
		})
	}
	return c.JSON(out)
}

// ─── Grading / Attempt Admin ──────────────────────────────

// GetAttemptDetail returns a single attempt with every answer joined to
// its question, for the teacher grading + monitoring UI.
func GetAttemptDetail(c *fiber.Ctx) error {
	attemptID := paramID(c)

	var attempt models.ExamAttempt
	if err := config.DB.Preload("Student.User").Preload("Exam").
		First(&attempt, attemptID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Attempt tidak ditemukan"})
	}

	// Verify the exam belongs to this school
	if attempt.Exam.SchoolID != schoolID(c) {
		return c.Status(404).JSON(fiber.Map{"error": "Attempt tidak ditemukan"})
	}

	type AnswerView struct {
		ID            uint     `json:"id"`
		QuestionID    uint     `json:"question_id"`
		QuestionType  string   `json:"question_type"`
		QuestionText  string   `json:"question_content"`
		Options       string   `json:"options"`
		CorrectAnswer string   `json:"correct_answer"`
		Explanation   string   `json:"explanation"`
		Answer        string   `json:"answer"`
		IsCorrect     *bool    `json:"is_correct"`
		Score         *float64 `json:"score"`
		MaxPoints     int      `json:"max_points"`
	}

	var answers []models.ExamAnswer
	config.DB.Where("exam_attempt_id = ?", attempt.ID).Find(&answers)

	out := make([]AnswerView, 0, len(answers))
	for _, a := range answers {
		var q models.Question
		config.DB.First(&q, a.QuestionID)
		out = append(out, AnswerView{
			ID:            a.ID,
			QuestionID:    a.QuestionID,
			QuestionType:  q.Type,
			QuestionText:  q.Content,
			Options:       q.Options,
			CorrectAnswer: q.Answer,
			Explanation:   q.Explanation,
			Answer:        a.Answer,
			IsCorrect:     a.IsCorrect,
			Score:         a.Score,
			MaxPoints:     q.Points,
		})
	}

	return c.JSON(fiber.Map{
		"attempt": attempt,
		"answers": out,
	})
}

// GradeAnswer sets score + is_correct on a single ExamAnswer (used for essays).
// After each update, the parent attempt is re-aggregated.
func GradeAnswer(c *fiber.Ctx) error {
	answerID := paramID(c)
	var req struct {
		Score   *float64 `json:"score"`
		Comment string   `json:"comment"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Score == nil {
		return c.Status(400).JSON(fiber.Map{"error": "score wajib diisi"})
	}

	var ans models.ExamAnswer
	if err := config.DB.First(&ans, answerID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Jawaban tidak ditemukan"})
	}

	// Verify the answer's attempt belongs to an exam in this school
	var attempt models.ExamAttempt
	if err := config.DB.Preload("Exam").First(&attempt, ans.ExamAttemptID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Attempt tidak ditemukan"})
	}
	if attempt.Exam.SchoolID != schoolID(c) {
		return c.Status(404).JSON(fiber.Map{"error": "Jawaban tidak ditemukan"})
	}

	var q models.Question
	config.DB.First(&q, ans.QuestionID)

	maxPts := float64(q.Points)
	score := *req.Score
	if score < 0 {
		score = 0
	}
	if score > maxPts {
		score = maxPts
	}
	correct := score >= maxPts && maxPts > 0
	ans.Score = &score
	ans.IsCorrect = &correct
	if req.Comment != "" {
		ans.Feedback = req.Comment
	}
	if err := config.DB.Save(&ans).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan nilai"})
	}

	// Recompute total score on the parent attempt
	recomputeAttemptScore(ans.ExamAttemptID)

	return c.JSON(fiber.Map{"message": "Nilai disimpan", "score": score})
}

// ResetAttempt deletes a student's attempt (and their answers) so they can
// retake the exam. Used by guru/admin when an attempt is stuck or was
// submitted by mistake (e.g. the old duration=0 bug).
func ResetAttempt(c *fiber.Ctx) error {
	attemptID := paramID(c)
	var attempt models.ExamAttempt
	if err := config.DB.Preload("Exam").First(&attempt, attemptID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Attempt tidak ditemukan"})
	}

	// Verify the attempt belongs to an exam in this school
	if attempt.Exam.SchoolID != schoolID(c) {
		return c.Status(404).JSON(fiber.Map{"error": "Attempt tidak ditemukan"})
	}

	if err := config.DB.Where("exam_attempt_id = ?", attempt.ID).Delete(&models.ExamAnswer{}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal hapus jawaban"})
	}
	if err := config.DB.Delete(&attempt).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal hapus attempt"})
	}
	return c.JSON(fiber.Map{"message": "Attempt di-reset, siswa dapat mengerjakan ulang"})
}

// recomputeAttemptScore recalculates total score for an attempt based on the
// score field of each ExamAnswer. Called after manual essay grading.
func recomputeAttemptScore(attemptID uint) {
	var attempt models.ExamAttempt
	if err := config.DB.First(&attempt, attemptID).Error; err != nil {
		return
	}
	var answers []models.ExamAnswer
	config.DB.Where("exam_attempt_id = ?", attemptID).Find(&answers)

	var total, max float64
	allGraded := true
	for _, a := range answers {
		var q models.Question
		config.DB.First(&q, a.QuestionID)
		max += float64(q.Points)
		if a.Score != nil {
			total += *a.Score
		} else {
			allGraded = false
		}
	}
	if max > 0 {
		pct := math.Round(total/max*100*100) / 100
		attempt.Score = &pct
	}
	if allGraded && attempt.Status == "submitted" {
		attempt.Status = "graded"
	}
	config.DB.Save(&attempt)
}
