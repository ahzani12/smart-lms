package handlers

import (
	"math"
	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ─── Report Components (Admin Setting) ───────────────────

// GetReportComponents returns all components for a school
func GetReportComponents(c *fiber.Ctx) error {
	sid := schoolID(c)

	var components []models.ReportComponent
	config.DB.Where("school_id = ?", sid).Order("sort_order ASC, id ASC").Find(&components)

	return c.JSON(components)
}

// CreateReportComponent adds a new component
func CreateReportComponent(c *fiber.Ctx) error {
	sid := schoolID(c)

	var body struct {
		Name       string  `json:"name"`
		Weight     float64 `json:"weight"`
		SourceType string  `json:"source_type"` // manual, exam
		ExamType   string  `json:"exam_type"`   // uts, uas (if source_type=exam)
		SortOrder  int     `json:"sort_order"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if body.Name == "" || body.Weight <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Nama dan bobot wajib diisi"})
	}
	if body.SourceType == "" {
		body.SourceType = "manual"
	}

	comp := models.ReportComponent{
		SchoolID:   sid,
		Name:       body.Name,
		Weight:     body.Weight,
		SourceType: body.SourceType,
		ExamType:   body.ExamType,
		SortOrder:  body.SortOrder,
	}
	config.DB.Create(&comp)

	return c.JSON(comp)
}

// UpdateReportComponent updates a component
func UpdateReportComponent(c *fiber.Ctx) error {
	sid := schoolID(c)
	id := paramID(c)

	var comp models.ReportComponent
	if err := config.DB.Where("id = ? AND school_id = ?", id, sid).First(&comp).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Tidak ditemukan"})
	}

	var body struct {
		Name       string  `json:"name"`
		Weight     float64 `json:"weight"`
		SourceType string  `json:"source_type"`
		ExamType   string  `json:"exam_type"`
		SortOrder  int     `json:"sort_order"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if body.Name != "" {
		comp.Name = body.Name
	}
	if body.Weight > 0 {
		comp.Weight = body.Weight
	}
	if body.SourceType != "" {
		comp.SourceType = body.SourceType
	}
	comp.ExamType = body.ExamType
	comp.SortOrder = body.SortOrder

	config.DB.Save(&comp)
	return c.JSON(comp)
}

// DeleteReportComponent removes a component
func DeleteReportComponent(c *fiber.Ctx) error {
	sid := schoolID(c)
	id := paramID(c)

	var comp models.ReportComponent
	if err := config.DB.Where("id = ? AND school_id = ?", id, sid).First(&comp).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Tidak ditemukan"})
	}

	config.DB.Delete(&comp)
	return c.JSON(fiber.Map{"message": "Komponen dihapus"})
}

// ─── Student Scores (Guru Input) ─────────────────────────

// GetStudentScores returns scores for a class/subject/semester
func GetStudentScores(c *fiber.Ctx) error {
	sid := schoolID(c)
	subjectID := c.QueryInt("subject_id")
	semesterID := c.QueryInt("semester_id")
	classID := c.QueryInt("class_id")

	if subjectID == 0 || semesterID == 0 || classID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "subject_id, semester_id, class_id wajib"})
	}

	// Get students in class
	var students []models.Student
	config.DB.Where("class_id = ? AND school_id = ?", classID, sid).Preload("User").Find(&students)

	// Get components
	var components []models.ReportComponent
	config.DB.Where("school_id = ?", sid).Order("sort_order ASC").Find(&components)

	// Get existing scores
	var scores []models.StudentScore
	config.DB.Where("school_id = ? AND subject_id = ? AND semester_id = ?", sid, subjectID, semesterID).Find(&scores)

	// Build score map: student_id -> component_id -> score
	scoreMap := make(map[uint]map[uint]float64)
	for _, s := range scores {
		if scoreMap[s.StudentID] == nil {
			scoreMap[s.StudentID] = make(map[uint]float64)
		}
		scoreMap[s.StudentID][s.ComponentID] = s.Score
	}

	type StudentScoreRow struct {
		StudentID   uint               `json:"student_id"`
		StudentName string             `json:"student_name"`
		NIS         string             `json:"nis"`
		Scores      map[uint]float64   `json:"scores"`      // component_id -> score
		FinalScore  float64            `json:"final_score"`
	}

	var rows []StudentScoreRow
	for _, st := range students {
		row := StudentScoreRow{
			StudentID:   st.ID,
			StudentName: st.User.Name,
			NIS:         st.NIS,
			Scores:      scoreMap[st.ID],
		}
		if row.Scores == nil {
			row.Scores = make(map[uint]float64)
		}

		// Calculate final score
		var totalWeight float64
		var weightedSum float64
		for _, comp := range components {
			if score, ok := row.Scores[comp.ID]; ok {
				weightedSum += score * comp.Weight / 100
				totalWeight += comp.Weight
			}
		}
		if totalWeight > 0 {
			row.FinalScore = math.Round(weightedSum/totalWeight*100*100) / 100
		}

		rows = append(rows, row)
	}

	return c.JSON(fiber.Map{
		"components": components,
		"students":   rows,
	})
}

// SaveStudentScores bulk save scores (guru input)
func SaveStudentScores(c *fiber.Ctx) error {
	sid := schoolID(c)

	var body struct {
		SubjectID  uint `json:"subject_id"`
		SemesterID uint `json:"semester_id"`
		Scores     []struct {
			StudentID   uint    `json:"student_id"`
			ComponentID uint    `json:"component_id"`
			Score       float64 `json:"score"`
		} `json:"scores"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if body.SubjectID == 0 || body.SemesterID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "subject_id dan semester_id wajib"})
	}

	for _, s := range body.Scores {
		var existing models.StudentScore
		result := config.DB.Where(
			"school_id = ? AND student_id = ? AND subject_id = ? AND semester_id = ? AND component_id = ?",
			sid, s.StudentID, body.SubjectID, body.SemesterID, s.ComponentID,
		).First(&existing)

		if result.Error != nil {
			// Create new
			config.DB.Create(&models.StudentScore{
				SchoolID:    sid,
				StudentID:   s.StudentID,
				SubjectID:   body.SubjectID,
				SemesterID:  body.SemesterID,
				ComponentID: s.ComponentID,
				Score:       s.Score,
			})
		} else {
			// Update existing
			existing.Score = s.Score
			config.DB.Save(&existing)
		}
	}

	return c.JSON(fiber.Map{"message": "Nilai berhasil disimpan"})
}

// ─── Generate Raport ─────────────────────────────────────

// GenerateRaport calculates final scores and creates raport entries
func GenerateRaport(c *fiber.Ctx) error {
	sid := schoolID(c)

	var body struct {
		ClassID    uint `json:"class_id"`
		SemesterID uint `json:"semester_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if body.ClassID == 0 || body.SemesterID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "class_id dan semester_id wajib"})
	}

	// Get components
	var components []models.ReportComponent
	config.DB.Where("school_id = ?", sid).Find(&components)
	if len(components) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Belum ada komponen raport. Atur dulu di Setting."})
	}

	// Get students in class
	var students []models.Student
	config.DB.Where("class_id = ? AND school_id = ?", body.ClassID, sid).Find(&students)

	// Get subjects for this class
	var subjects []models.Subject
	config.DB.Where("school_id = ?", sid).Find(&subjects)

	// Get all scores for this class/semester
	studentIDs := make([]uint, len(students))
	for i, s := range students {
		studentIDs[i] = s.ID
	}

	var allScores []models.StudentScore
	config.DB.Where("school_id = ? AND semester_id = ? AND student_id IN ?", sid, body.SemesterID, studentIDs).Find(&allScores)

	// Build score map: student_id -> subject_id -> component_id -> score
	scoreMap := make(map[uint]map[uint]map[uint]float64)
	for _, s := range allScores {
		if scoreMap[s.StudentID] == nil {
			scoreMap[s.StudentID] = make(map[uint]map[uint]float64)
		}
		if scoreMap[s.StudentID][s.SubjectID] == nil {
			scoreMap[s.StudentID][s.SubjectID] = make(map[uint]float64)
		}
		scoreMap[s.StudentID][s.SubjectID][s.ComponentID] = s.Score
	}

	// Also fetch exam scores for exam-type components
	for _, comp := range components {
		if comp.SourceType == "exam" && comp.ExamType != "" {
			// Get average exam score per student per subject
			type ExamAvg struct {
				StudentID uint
				SubjectID uint
				AvgScore  float64
			}
			var avgs []ExamAvg
			config.DB.Table("exam_attempts ea").
				Select("ea.student_id, e.subject_id, AVG(ea.score) as avg_score").
				Joins("JOIN exams e ON e.id = ea.exam_id").
				Where("e.school_id = ? AND e.exam_type = ? AND e.semester_id = ? AND ea.student_id IN ? AND ea.status = 'graded'",
					sid, comp.ExamType, body.SemesterID, studentIDs).
				Group("ea.student_id, e.subject_id").
				Find(&avgs)

			for _, avg := range avgs {
				if scoreMap[avg.StudentID] == nil {
					scoreMap[avg.StudentID] = make(map[uint]map[uint]float64)
				}
				if scoreMap[avg.StudentID][avg.SubjectID] == nil {
					scoreMap[avg.StudentID][avg.SubjectID] = make(map[uint]float64)
				}
				scoreMap[avg.StudentID][avg.SubjectID][comp.ID] = avg.AvgScore
			}
		}
	}

	// Calculate final scores and create/update raport
	var generated int
	for _, student := range students {
		// Delete existing raport for this student/semester
		var oldRaports []models.Raport
		config.DB.Where("student_id = ? AND semester_id = ? AND school_id = ?", student.ID, body.SemesterID, sid).Find(&oldRaports)
		for _, old := range oldRaports {
			config.DB.Where("raport_id = ?", old.ID).Delete(&models.RaportItem{})
		}
		config.DB.Where("student_id = ? AND semester_id = ? AND school_id = ?", student.ID, body.SemesterID, sid).Delete(&models.Raport{})

		raport := models.Raport{
			StudentID:  student.ID,
			SemesterID: body.SemesterID,
			SchoolID:   sid,
		}
		config.DB.Create(&raport)

		for _, subj := range subjects {
			compScores := scoreMap[student.ID][subj.ID]
			if compScores == nil {
				continue
			}

			var weightedSum float64
			var totalWeight float64
			for _, comp := range components {
				if score, ok := compScores[comp.ID]; ok && score > 0 {
					weightedSum += score * comp.Weight / 100
					totalWeight += comp.Weight
				}
			}

			var finalScore float64
			if totalWeight > 0 {
				finalScore = math.Round(weightedSum / totalWeight * 100)
			}

			grade := "D"
			if finalScore >= 90 {
				grade = "A"
			} else if finalScore >= 80 {
				grade = "B"
			} else if finalScore >= 70 {
				grade = "C"
			}

			item := models.RaportItem{
				RaportID:  raport.ID,
				SubjectID: subj.ID,
				Score:     finalScore,
				Grade:     grade,
				TeacherID: 0,
			}
			if err := config.DB.Omit("TeacherID").Create(&item).Error; err != nil {
				continue
			}
		}
		generated++
	}

	return c.JSON(fiber.Map{
		"message":   "Raport berhasil digenerate",
		"generated": generated,
	})
}
