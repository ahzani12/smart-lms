package handlers

import (
	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// ─── Parent Portal ───────────────────────────────────────

// GetParentDashboard returns child's info, recent scores, attendance summary
func GetParentDashboard(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)

	var parent models.Parent
	if err := config.DB.Where("user_id = ?", userID).Preload("Student.User").Preload("Student.Class").First(&parent).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Data orang tua tidak ditemukan"})
	}

	// Recent exam scores
	type ExamScore struct {
		ExamTitle string   `json:"exam_title"`
		Score     *float64 `json:"score"`
		Status    string   `json:"status"`
		Date      string   `json:"date"`
	}
	var scores []ExamScore
	config.DB.Table("exam_attempts ea").
		Select("e.title as exam_title, ea.score, ea.status, TO_CHAR(ea.created_at, 'DD Mon YYYY') as date").
		Joins("JOIN exams e ON e.id = ea.exam_id").
		Where("ea.student_id = ?", parent.StudentID).
		Order("ea.created_at DESC").
		Limit(10).
		Find(&scores)

	// Attendance summary (last 30 days)
	type AttendanceSummary struct {
		Total   int64 `json:"total"`
		Hadir   int64 `json:"hadir"`
		Izin    int64 `json:"izin"`
		Sakit   int64 `json:"sakit"`
		Alpha   int64 `json:"alpha"`
	}
	var summary AttendanceSummary
	config.DB.Table("presences p").
		Select(`
			COUNT(*) as total,
			SUM(CASE WHEN p.status = 'hadir' THEN 1 ELSE 0 END) as hadir,
			SUM(CASE WHEN p.status = 'izin' THEN 1 ELSE 0 END) as izin,
			SUM(CASE WHEN p.status = 'sakit' THEN 1 ELSE 0 END) as sakit,
			SUM(CASE WHEN p.status = 'alpha' THEN 1 ELSE 0 END) as alpha
		`).
		Where("p.student_id = ? AND p.created_at >= NOW() - INTERVAL '30 days'", parent.StudentID).
		Scan(&summary)

	// Raport data
	var raports []models.Raport
	config.DB.Where("student_id = ?", parent.StudentID).
		Preload("Semester").Preload("Items.Subject").
		Order("created_at DESC").Limit(2).Find(&raports)

	return c.JSON(fiber.Map{
		"student": fiber.Map{
			"name":  parent.Student.User.Name,
			"nis":   parent.Student.NIS,
			"class": parent.Student.Class,
		},
		"relation":   parent.Relation,
		"scores":     scores,
		"attendance": summary,
		"raports":    raports,
	})
}

// GetParentChildren returns list of children linked to this parent (for future multi-child support)
func GetParentChildren(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)

	var parents []models.Parent
	config.DB.Where("user_id = ?", userID).Preload("Student.User").Preload("Student.Class").Find(&parents)

	return c.JSON(parents)
}

// ─── Admin: Manage Parents ───────────────────────────────

// CreateParent creates a parent account linked to a student
func CreateParent(c *fiber.Ctx) error {
	sid := schoolID(c)

	var body struct {
		Name      string `json:"name"`
		Email     string `json:"email"`
		Phone     string `json:"phone"`
		Password  string `json:"password"`
		StudentID uint   `json:"student_id"`
		Relation  string `json:"relation"` // ayah, ibu, wali
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if body.Name == "" || body.Email == "" || body.Password == "" || body.StudentID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Nama, email, password, dan siswa wajib diisi"})
	}

	// Check student exists
	var student models.Student
	if err := config.DB.Where("id = ? AND school_id = ?", body.StudentID, sid).First(&student).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Siswa tidak ditemukan"})
	}

	// Check email unique
	var existing models.User
	if config.DB.Where("email = ?", body.Email).First(&existing).Error == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Email sudah terdaftar"})
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	user := models.User{
		Name:     body.Name,
		Email:    body.Email,
		Phone:    body.Phone,
		Password: string(hash),
		Role:     "orang_tua",
		Active:   true,
		SchoolID: &sid,
	}
	config.DB.Create(&user)

	parent := models.Parent{
		UserID:    user.ID,
		StudentID: body.StudentID,
		Relation:  body.Relation,
		SchoolID:  sid,
	}
	config.DB.Create(&parent)

	return c.JSON(fiber.Map{"message": "Akun orang tua berhasil dibuat", "parent": parent})
}

// GetParents returns all parent accounts for admin
func GetParents(c *fiber.Ctx) error {
	sid := schoolID(c)

	var parents []models.Parent
	config.DB.Where("school_id = ?", sid).
		Preload("User").Preload("Student.User").Preload("Student.Class").
		Find(&parents)

	return c.JSON(parents)
}

// DeleteParent removes a parent account
func DeleteParent(c *fiber.Ctx) error {
	sid := schoolID(c)
	id := paramID(c)

	var parent models.Parent
	if err := config.DB.Where("id = ? AND school_id = ?", id, sid).First(&parent).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Tidak ditemukan"})
	}

	// Delete user and parent record
	config.DB.Delete(&models.User{}, parent.UserID)
	config.DB.Delete(&parent)

	return c.JSON(fiber.Map{"message": "Akun orang tua dihapus"})
}
