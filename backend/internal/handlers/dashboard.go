package handlers

import (
	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

func GetDashboard(c *fiber.Ctx) error {
	schoolID := c.Locals("school_id").(uint)

	var totalStudents, totalTeachers, totalClasses, totalSubjects int64
	var activeExams, totalQuestions, totalBanks, totalTopics int64

	config.DB.Model(&models.Student{}).Where("school_id = ?", schoolID).Count(&totalStudents)
	config.DB.Model(&models.Teacher{}).Where("school_id = ?", schoolID).Count(&totalTeachers)
	config.DB.Model(&models.Class{}).Where("school_id = ?", schoolID).Count(&totalClasses)
	config.DB.Model(&models.Subject{}).Where("school_id = ?", schoolID).Count(&totalSubjects)
	config.DB.Model(&models.Exam{}).Where("school_id = ? AND status = 'active'", schoolID).Count(&activeExams)
	config.DB.Model(&models.Question{}).Where("school_id = ?", schoolID).Count(&totalQuestions)
	config.DB.Model(&models.QuestionBank{}).Where("school_id = ?", schoolID).Count(&totalBanks)
	config.DB.Model(&models.Topic{}).Where("school_id = ?", schoolID).Count(&totalTopics)

	// Recent exams
	var recentExams []models.Exam
	config.DB.Where("school_id = ?", schoolID).Order("created_at DESC").Limit(5).
		Preload("Subject").Preload("Class").Find(&recentExams)

	// Absensi hari ini — pake Presence JOIN AttendanceSession (school_id ada di session)
	var todayPresent, todayAbsent, todaySick, todayPermit, todayLate int64

	base := func() interface{} {
		return config.DB.Model(&models.Presence{}).
			Joins("JOIN attendance_sessions s ON s.id = presences.session_id").
			Where("s.school_id = ? AND s.date = CURRENT_DATE", schoolID)
	}

	// Pake raw builder per-status supaya gak duplikat JOIN
	cnt := func(status string) int64 {
		var n int64
		config.DB.Model(&models.Presence{}).
			Joins("JOIN attendance_sessions s ON s.id = presences.session_id").
			Where("s.school_id = ? AND s.date = CURRENT_DATE AND presences.status = ?", schoolID, status).
			Count(&n)
		return n
	}
	_ = base
	todayPresent = cnt("hadir")
	todayAbsent = cnt("alfa")
	todaySick = cnt("sakit")
	todayPermit = cnt("izin")
	todayLate = cnt("terlambat")

	// Sesi hari ini (jumlah kelas yang sudah buka absen)
	var todaySessions int64
	config.DB.Model(&models.AttendanceSession{}).
		Where("school_id = ? AND date = CURRENT_DATE", schoolID).Count(&todaySessions)

	return c.JSON(fiber.Map{
		"stats": fiber.Map{
			"students":      totalStudents,
			"teachers":      totalTeachers,
			"classes":       totalClasses,
			"subjects":      totalSubjects,
			"exams":         activeExams,
			"questions":     totalQuestions,
			"question_banks": totalBanks,
			"topics":        totalTopics,
		},
		"attendance_today": fiber.Map{
			"hadir":     todayPresent,
			"alfa":      todayAbsent,
			"sakit":     todaySick,
			"izin":      todayPermit,
			"terlambat": todayLate,
			"sessions":  todaySessions,
		},
		"recent_exams": recentExams,
	})
}
