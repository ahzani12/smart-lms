package handlers

import (
	"fmt"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// ─── SCHOOLS (Tenant Management) ─────────────────────────

func SuperGetSchools(c *fiber.Ctx) error {
	var schools []models.School
	config.DB.Order("id DESC").Find(&schools)

	// Enrich with counts
	type SchoolInfo struct {
		models.School
		StudentCount int64 `json:"student_count"`
		TeacherCount int64 `json:"teacher_count"`
		AdminCount   int64 `json:"admin_count"`
	}
	var result []SchoolInfo
	for _, s := range schools {
		var sc, tc, ac int64
		config.DB.Model(&models.Student{}).Where("school_id = ?", s.ID).Count(&sc)
		config.DB.Model(&models.Teacher{}).Where("school_id = ?", s.ID).Count(&tc)
		config.DB.Model(&models.User{}).Where("school_id = ? AND role IN ?", s.ID, []string{"admin_pusat", "admin_cabang"}).Count(&ac)
		result = append(result, SchoolInfo{School: s, StudentCount: sc, TeacherCount: tc, AdminCount: ac})
	}
	return c.JSON(result)
}

func SuperGetSchool(c *fiber.Ctx) error {
	var school models.School
	if err := config.DB.First(&school, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Sekolah tidak ditemukan"})
	}
	return c.JSON(school)
}

func SuperCreateSchool(c *fiber.Ctx) error {
	var school models.School
	if err := c.BodyParser(&school); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	config.DB.Create(&school)
	return c.Status(201).JSON(fiber.Map{"message": "Sekolah berhasil dibuat", "id": school.ID})
}

func SuperUpdateSchool(c *fiber.Ctx) error {
	var school models.School
	if err := config.DB.First(&school, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Sekolah tidak ditemukan"})
	}
	if err := c.BodyParser(&school); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	config.DB.Save(&school)
	return c.JSON(fiber.Map{"message": "Sekolah berhasil diupdate"})
}

func SuperDeleteSchool(c *fiber.Ctx) error {
	id := paramID(c)
	// Check if school has data
	var userCount int64
	config.DB.Model(&models.User{}).Where("school_id = ?", id).Count(&userCount)
	if userCount > 0 {
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("Sekolah masih punya %d user. Hapus semua data dulu.", userCount)})
	}
	config.DB.Delete(&models.School{}, id)
	return c.JSON(fiber.Map{"message": "Sekolah berhasil dihapus"})
}

// ─── ADMIN PER SCHOOL ────────────────────────────────────

func SuperGetAdmins(c *fiber.Ctx) error {
	var users []models.User
	q := config.DB.Where("role IN ?", []string{"admin_pusat", "admin_cabang"})
	if schoolID := c.Query("school_id"); schoolID != "" {
		q = q.Where("school_id = ?", schoolID)
	}
	q.Preload("School").Order("id DESC").Find(&users)
	return c.JSON(users)
}

func SuperCreateAdmin(c *fiber.Ctx) error {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
		Phone    string `json:"phone"`
		SchoolID uint   `json:"school_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Role != "admin_pusat" && req.Role != "admin_cabang" {
		return c.Status(400).JSON(fiber.Map{"error": "Role harus admin_pusat atau admin_cabang"})
	}
	if req.SchoolID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "school_id wajib diisi"})
	}

	// Verify school exists
	var school models.School
	if err := config.DB.First(&school, req.SchoolID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Sekolah tidak ditemukan"})
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	user := models.User{
		Name: req.Name, Email: req.Email, Password: string(hash),
		Role: req.Role, Phone: req.Phone, Active: true, SchoolID: &req.SchoolID,
	}
	if err := config.DB.Create(&user).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Email sudah terdaftar"})
	}

	return c.Status(201).JSON(fiber.Map{"message": "Admin berhasil dibuat", "id": user.ID})
}

func SuperUpdateAdmin(c *fiber.Ctx) error {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Phone    string `json:"phone"`
		Role     string `json:"role"`
		Active   *bool  `json:"active"`
		SchoolID *uint  `json:"school_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var user models.User
	if err := config.DB.First(&user, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Admin tidak ditemukan"})
	}

	updates := map[string]interface{}{
		"name": req.Name, "email": req.Email, "phone": req.Phone,
	}
	if req.Role != "" {
		updates["role"] = req.Role
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}
	if req.SchoolID != nil {
		updates["school_id"] = *req.SchoolID
	}

	config.DB.Model(&user).Updates(updates)
	return c.JSON(fiber.Map{"message": "Admin berhasil diupdate"})
}

func SuperDeleteAdmin(c *fiber.Ctx) error {
	var user models.User
	if err := config.DB.First(&user, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Admin tidak ditemukan"})
	}
	if user.Role == "superadmin" {
		return c.Status(400).JSON(fiber.Map{"error": "Tidak bisa hapus superadmin"})
	}
	config.DB.Delete(&user)
	return c.JSON(fiber.Map{"message": "Admin berhasil dihapus"})
}

func SuperResetPassword(c *fiber.Ctx) error {
	var req struct {
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Password wajib diisi"})
	}

	var user models.User
	if err := config.DB.First(&user, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User tidak ditemukan"})
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	config.DB.Model(&user).Update("password", string(hash))
	return c.JSON(fiber.Map{"message": "Password berhasil direset"})
}

// ─── OVERVIEW / STATS ────────────────────────────────────

func SuperOverview(c *fiber.Ctx) error {
	var totalSchools, totalStudents, totalTeachers, totalExams int64
	config.DB.Model(&models.School{}).Count(&totalSchools)
	config.DB.Model(&models.Student{}).Count(&totalStudents)
	config.DB.Model(&models.Teacher{}).Count(&totalTeachers)
	config.DB.Model(&models.Exam{}).Count(&totalExams)

	// Recent schools
	var recentSchools []models.School
	config.DB.Order("created_at DESC").Limit(5).Find(&recentSchools)

	// Per-school stats
	type SchoolStat struct {
		ID       uint   `json:"id"`
		Name     string `json:"name"`
		Students int64  `json:"students"`
		Teachers int64  `json:"teachers"`
	}
	var stats []SchoolStat
	var schools []models.School
	config.DB.Find(&schools)
	for _, s := range schools {
		var sc, tc int64
		config.DB.Model(&models.Student{}).Where("school_id = ?", s.ID).Count(&sc)
		config.DB.Model(&models.Teacher{}).Where("school_id = ?", s.ID).Count(&tc)
		stats = append(stats, SchoolStat{ID: s.ID, Name: s.Name, Students: sc, Teachers: tc})
	}

	return c.JSON(fiber.Map{
		"total_schools":   totalSchools,
		"total_students":  totalStudents,
		"total_teachers":  totalTeachers,
		"total_exams":     totalExams,
		"recent_schools":  recentSchools,
		"school_stats":    stats,
	})
}
