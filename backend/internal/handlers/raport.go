package handlers

import (
	"fmt"
	"math"
	"strconv"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

func GetRaports(c *fiber.Ctx) error {
	var raports []models.Raport
	q := config.DB.Where("school_id = ?", schoolID(c))
	if semesterID := c.Query("semester_id"); semesterID != "" {
		q = q.Where("semester_id = ?", semesterID)
	}
	if classID := c.Query("class_id"); classID != "" {
		q = q.Joins("JOIN students ON students.id = raports.student_id").
			Where("students.class_id = ?", classID)
	}
	q.Preload("Student.User").Preload("Student.Class").Preload("Semester").Find(&raports)
	return c.JSON(raports)
}

func GetRaport(c *fiber.Ctx) error {
	var raport models.Raport
	if err := config.DB.Preload("Student.User").Preload("Student.Class").Preload("Semester").
		Preload("Items.Subject").Preload("Items.Teacher.User").
		First(&raport, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Raport tidak ditemukan"})
	}

	// Load school for custom header
	var school models.School
	config.DB.First(&school, raport.Student.SchoolID)

	// Load attendance summary (pake Presence + AttendanceSession + Schedule → semester)
	var hadir, sakit, izin, alfa, terlambat int64
	presCount := func(status string) int64 {
		var n int64
		config.DB.Model(&models.Presence{}).
			Joins("JOIN attendance_sessions s ON s.id = presences.session_id").
			Joins("JOIN schedules sc ON sc.id = s.schedule_id").
			Where("presences.student_id = ? AND s.school_id = ? AND sc.semester_id = ? AND presences.status = ?",
				raport.StudentID, raport.Student.SchoolID, raport.SemesterID, status).
			Count(&n)
		return n
	}
	hadir = presCount("hadir")
	sakit = presCount("sakit")
	izin = presCount("izin")
	alfa = presCount("alfa")
	terlambat = presCount("terlambat")

	return c.JSON(fiber.Map{
		"raport": raport,
		"school": school,
		"attendance": fiber.Map{
			"hadir": hadir, "sakit": sakit, "izin": izin, "alfa": alfa, "terlambat": terlambat,
		},
	})
}

func CreateRaport(c *fiber.Ctx) error {
	var req struct {
		StudentID  uint `json:"student_id"`
		SemesterID uint `json:"semester_id"`
		Notes      string `json:"notes"`
		Items      []struct {
			SubjectID uint    `json:"subject_id"`
			Score     float64 `json:"score"`
			KB        string  `json:"kb"`
			TeacherID uint    `json:"teacher_id"`
		} `json:"items"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	raport := models.Raport{
		StudentID:  req.StudentID,
		SemesterID: req.SemesterID,
		SchoolID:   schoolID(c),
		Notes:      req.Notes,
	}
	config.DB.Create(&raport)

	for _, item := range req.Items {
		grade := scoreToGrade(item.Score)
		config.DB.Create(&models.RaportItem{
			RaportID:  raport.ID,
			SubjectID: item.SubjectID,
			Score:     item.Score,
			Grade:     grade,
			KB:        item.KB,
			TeacherID: item.TeacherID,
		})
	}

	// Calculate rank
	calculateRank(req.StudentID, req.SemesterID)

	return c.Status(201).JSON(fiber.Map{"message": "Raport dibuat", "id": raport.ID})
}

func UpdateRaport(c *fiber.Ctx) error {
	var req struct {
		Notes string `json:"notes"`
		Items []struct {
			ID        uint    `json:"id"`
			SubjectID uint    `json:"subject_id"`
			Score     float64 `json:"score"`
			KB        string  `json:"kb"`
		} `json:"items"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	raportID := paramID(c)
	config.DB.Model(&models.Raport{}).Where("id = ?", raportID).Update("notes", req.Notes)

	for _, item := range req.Items {
		grade := scoreToGrade(item.Score)
		config.DB.Model(&models.RaportItem{}).Where("id = ?", item.ID).Updates(map[string]interface{}{
			"score": item.Score,
			"grade": grade,
			"kb":    item.KB,
		})
	}

	return c.JSON(fiber.Map{"message": "Raport diupdate"})
}

func GenerateRaportFromExams(c *fiber.Ctx) error {
	semesterID, _ := strconv.ParseUint(c.Query("semester_id"), 10, 64)
	classID, _ := strconv.ParseUint(c.Query("class_id"), 10, 64)

	// Get all students in class
	var students []models.Student
	config.DB.Where("class_id = ?", classID).Preload("User").Find(&students)

	// Get all subjects
	var subjects []models.Subject
	config.DB.Where("school_id = ?", schoolID(c)).Find(&subjects)

	// Get active semester
	semester := models.Semester{}
	config.DB.Where("active = true AND school_id = ?", schoolID(c)).First(&semester)
	if semesterID > 0 {
		config.DB.First(&semester, semesterID)
	}

	created := 0
	for _, student := range students {
		// Check if raport already exists
		var existing models.Raport
		if config.DB.Where("student_id = ? AND semester_id = ?", student.ID, semester.ID).First(&existing).RowsAffected > 0 {
			continue
		}

		raport := models.Raport{
			StudentID:  student.ID,
			SemesterID: semester.ID,
			SchoolID:   schoolID(c),
		}
		config.DB.Create(&raport)

		for _, subject := range subjects {
			// Calculate average score from exams
			var avgScore float64
			config.DB.Model(&models.ExamAttempt{}).
				Joins("JOIN exams ON exams.id = exam_attempts.exam_id").
				Where("exam_attempts.student_id = ?", student.ID).
				Where("exams.subject_id = ?", subject.ID).
				Where("exams.semester_id = ?", semester.ID).
				Where("exam_attempts.status = 'graded'").
				Select("COALESCE(AVG(exam_attempts.score), 0)").Scan(&avgScore)

			if avgScore > 0 {
				// Find teacher for this subject
				var teacher models.Teacher
				config.DB.Joins("JOIN teacher_subjects ON teacher_subjects.teacher_id = teachers.id").
					Where("teacher_subjects.subject_id = ?", subject.ID).First(&teacher)

				config.DB.Create(&models.RaportItem{
					RaportID:  raport.ID,
					SubjectID: subject.ID,
					Score:     math.Round(avgScore*100) / 100,
					Grade:     scoreToGrade(avgScore),
					TeacherID: teacher.ID,
				})
			}
		}
		created++
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("%d raport berhasil digenerate dari nilai ujian", created),
		"count":   created,
	})
}

func scoreToGrade(score float64) string {
	switch {
	case score >= 90:
		return "A"
	case score >= 80:
		return "B"
	case score >= 70:
		return "C"
	case score >= 60:
		return "D"
	default:
		return "E"
	}
}

func calculateRank(studentID, semesterID uint) {
	type RankResult struct {
		StudentID uint
		AvgScore  float64
	}

	var results []RankResult
	config.DB.Raw(`
		SELECT student_id, AVG(score) as avg_score
		FROM raports
		WHERE semester_id = ?
		GROUP BY student_id
		ORDER BY avg_score DESC
	`, semesterID).Scan(&results)

	for i, r := range results {
		config.DB.Model(&models.Raport{}).
			Where("student_id = ? AND semester_id = ?", r.StudentID, semesterID).
			Update("rank", i+1)
	}
}

// ─── School Config (Custom Header) ────────────────────────

func GetSchool(c *fiber.Ctx) error {
	var school models.School
	config.DB.First(&school, schoolID(c))
	return c.JSON(school)
}

func UpdateSchool(c *fiber.Ctx) error {
	var school models.School
	config.DB.First(&school, schoolID(c))
	if err := c.BodyParser(&school); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	config.DB.Save(&school)
	return c.JSON(fiber.Map{"message": "Sekolah diupdate"})
}

func UploadSchoolLogo(c *fiber.Ctx) error {
	file, err := c.FormFile("logo")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "File tidak ditemukan"})
	}

	path := fmt.Sprintf("uploads/logos/%d_%s", time.Now().Unix(), file.Filename)
	if err := c.SaveFile(file, path); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan file"})
	}

	config.DB.Model(&models.School{}).Where("id = ?", schoolID(c)).Update("header_logo", path)
	return c.JSON(fiber.Map{"message": "Logo diupload", "path": "/" + path})
}

// ─── Calendar ─────────────────────────────────────────────

func GetEvents(c *fiber.Ctx) error {
	var events []models.CalendarEvent
	q := config.DB.Where("school_id = ?", schoolID(c))
	if month := c.Query("month"); month != "" {
		q = q.Where("TO_CHAR(start_date, 'YYYY-MM') = ?", month)
	}
	q.Order("start_date ASC").Find(&events)
	return c.JSON(events)
}

func CreateEvent(c *fiber.Ctx) error {
	var event models.CalendarEvent
	if err := c.BodyParser(&event); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	event.SchoolID = schoolID(c)
	config.DB.Create(&event)
	return c.Status(201).JSON(fiber.Map{"message": "Event dibuat", "id": event.ID})
}

func UpdateEvent(c *fiber.Ctx) error {
	var event models.CalendarEvent
	config.DB.First(&event, paramID(c))
	if err := c.BodyParser(&event); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	config.DB.Save(&event)
	return c.JSON(fiber.Map{"message": "Event diupdate"})
}

func DeleteEvent(c *fiber.Ctx) error {
	config.DB.Delete(&models.CalendarEvent{}, paramID(c))
	return c.JSON(fiber.Map{"message": "Event dihapus"})
}
