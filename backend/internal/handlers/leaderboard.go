package handlers

import (
	"math"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ─── Leaderboard ─────────────────────────────────────────

type LeaderboardEntry struct {
	Rank       int     `json:"rank"`
	StudentID  uint    `json:"student_id"`
	Name       string  `json:"name"`
	NIS        string  `json:"nis"`
	ClassName  string  `json:"class_name"`
	AvgScore   float64 `json:"avg_score"`
	TotalExams int     `json:"total_exams"`
	BestScore  float64 `json:"best_score"`
}

// GetLeaderboard returns ranked students by average exam score
// Query params: class_id, exam_id, limit
func GetLeaderboard(c *fiber.Ctx) error {
	sid := schoolID(c)
	classID := c.QueryInt("class_id", 0)
	examID := c.QueryInt("exam_id", 0)
	limit := c.QueryInt("limit", 50)

	if limit > 100 {
		limit = 100
	}

	type rawRow struct {
		StudentID uint
		Name      string
		NIS       string
		ClassName string
		AvgScore  float64
		TotalExams int64
		BestScore float64
	}

	query := config.DB.Table("exam_attempts ea").
		Select(`
			ea.student_id,
			u.name,
			s.nis,
			COALESCE(c.name, '-') as class_name,
			ROUND(AVG(ea.score)::numeric, 2) as avg_score,
			COUNT(ea.id) as total_exams,
			MAX(ea.score) as best_score
		`).
		Joins("JOIN students s ON s.id = ea.student_id").
		Joins("JOIN users u ON u.id = s.user_id").
		Joins("LEFT JOIN classes c ON c.id = s.class_id").
		Where("ea.status = 'graded' AND ea.score IS NOT NULL").
		Where("s.school_id = ?", sid)

	if classID > 0 {
		query = query.Where("s.class_id = ?", classID)
	}
	if examID > 0 {
		query = query.Where("ea.exam_id = ?", examID)
	}

	var rows []rawRow
	query.Group("ea.student_id, u.name, s.nis, c.name").
		Order("avg_score DESC").
		Limit(limit).
		Find(&rows)

	entries := make([]LeaderboardEntry, len(rows))
	for i, r := range rows {
		entries[i] = LeaderboardEntry{
			Rank:       i + 1,
			StudentID:  r.StudentID,
			Name:       r.Name,
			NIS:        r.NIS,
			ClassName:  r.ClassName,
			AvgScore:   math.Round(r.AvgScore*100) / 100,
			TotalExams: int(r.TotalExams),
			BestScore:  math.Round(r.BestScore*100) / 100,
		}
	}

	// Also get classes for filter dropdown
	var classes []models.Class
	config.DB.Where("school_id = ?", sid).Order("name").Find(&classes)

	// Get exams for filter
	var exams []models.Exam
	config.DB.Where("school_id = ?", sid).Order("title").Find(&exams)

	return c.JSON(fiber.Map{
		"leaderboard": entries,
		"classes":     classes,
		"exams":       exams,
	})
}
