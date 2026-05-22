package handlers

import (
	"strconv"
	"strings"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// getDefaultPasswordForUser — tentukan password default user berdasarkan role
// guru: NIP (dari teachers.nip)
// siswa: student_id (NIS, di tabel users)
// orang_tua: student_id anak yang dia wakili
func getDefaultPasswordForUser(user *models.User) (string, string) {
	switch user.Role {
	case "siswa":
		if user.StudentID != "" {
			return user.StudentID, "NIS siswa"
		}
	case "guru":
		var teacher models.Teacher
		if err := config.DB.Where("user_id = ?", user.ID).First(&teacher).Error; err == nil {
			if teacher.NIP != "" {
				return teacher.NIP, "NIP guru"
			}
		}
	case "orang_tua":
		// Parent punya FK student_id langsung
		var parent models.Parent
		if err := config.DB.Where("user_id = ?", user.ID).First(&parent).Error; err == nil {
			var studentUser models.User
			var student models.Student
			if err := config.DB.First(&student, parent.StudentID).Error; err == nil {
				if err := config.DB.First(&studentUser, student.UserID).Error; err == nil {
					if studentUser.StudentID != "" {
						return studentUser.StudentID, "NIS anak"
					}
				}
			}
		}
	}
	return "", ""
}

// ResetUserPassword — admin reset password user ke default (NIS/NIP)
// User kemudian dipaksa ganti password saat login berikutnya.
//
// POST /api/users/:id/reset-password
// Body (optional): { "custom_password": "..." }
//   - Kalau custom_password diberikan, pakai itu (admin set manual)
//   - Kalau kosong, auto pakai NIS/NIP sesuai role user
func ResetUserPassword(c *fiber.Ctx) error {
	adminID := c.Locals("user_id").(uint)
	role := c.Locals("role").(string)

	if role != "admin_pusat" && role != "admin_cabang" {
		return c.Status(403).JSON(fiber.Map{"error": "Hanya admin yang bisa reset password"})
	}

	targetID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID tidak valid"})
	}

	var target models.User
	if err := config.DB.First(&target, targetID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User tidak ditemukan"})
	}

	// Multi-tenant guard: admin cabang hanya bisa reset user di sekolahnya
	if role == "admin_cabang" {
		var admin models.User
		config.DB.First(&admin, adminID)
		if admin.SchoolID == nil || target.SchoolID == nil || *admin.SchoolID != *target.SchoolID {
			return c.Status(403).JSON(fiber.Map{"error": "Tidak bisa reset user di sekolah lain"})
		}
	}

	// Tentukan password baru
	var req struct {
		CustomPassword string `json:"custom_password"`
	}
	c.BodyParser(&req)
	req.CustomPassword = strings.TrimSpace(req.CustomPassword)

	var newPassword string
	var passwordSource string

	if req.CustomPassword != "" {
		if len(req.CustomPassword) < 4 {
			return c.Status(400).JSON(fiber.Map{"error": "Password minimal 4 karakter"})
		}
		newPassword = req.CustomPassword
		passwordSource = "custom"
	} else {
		defaultPwd, source := getDefaultPasswordForUser(&target)
		if defaultPwd == "" {
			return c.Status(400).JSON(fiber.Map{
				"error": "User ini tidak punya kode default (NIS/NIP). Set custom_password manual.",
			})
		}
		newPassword = defaultPwd
		passwordSource = source
	}

	// Hash & save
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal hash password"})
	}

	if err := config.DB.Model(&target).Updates(map[string]interface{}{
		"password":             string(hash),
		"must_change_password": true,
		"password_changed_at":  nil,
	}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal update password"})
	}

	// Audit log
	config.DB.Create(&models.PasswordResetLog{
		SchoolID:     target.SchoolID,
		AdminID:      adminID,
		TargetUserID: target.ID,
		Action:       "reset_to_default",
		IPAddress:    c.IP(),
		UserAgent:    c.Get("User-Agent"),
		Note:         "Password direset (sumber: " + passwordSource + ")",
	})

	return c.JSON(fiber.Map{
		"message":         "Password berhasil direset",
		"new_password":    newPassword,
		"source":          passwordSource,
		"force_change":    true,
		"target_user_id":  target.ID,
		"target_name":     target.Name,
	})
}

// BulkResetPassword — reset banyak user sekaligus ke default kode masing-masing
// POST /api/users/bulk-reset-password
// Body: { "user_ids": [1, 2, 3] }
func BulkResetPassword(c *fiber.Ctx) error {
	adminID := c.Locals("user_id").(uint)
	role := c.Locals("role").(string)

	if role != "admin_pusat" && role != "admin_cabang" {
		return c.Status(403).JSON(fiber.Map{"error": "Hanya admin yang bisa bulk reset"})
	}

	var req struct {
		UserIDs []uint `json:"user_ids"`
	}
	if err := c.BodyParser(&req); err != nil || len(req.UserIDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "user_ids wajib"})
	}

	if len(req.UserIDs) > 500 {
		return c.Status(400).JSON(fiber.Map{"error": "Maksimal 500 user per batch"})
	}

	type result struct {
		UserID    uint   `json:"user_id"`
		Name      string `json:"name"`
		Success   bool   `json:"success"`
		Password  string `json:"password,omitempty"`
		Source    string `json:"source,omitempty"`
		Error     string `json:"error,omitempty"`
	}

	results := make([]result, 0, len(req.UserIDs))
	successCount := 0
	failCount := 0

	// Multi-tenant guard
	var admin models.User
	config.DB.First(&admin, adminID)

	for _, uid := range req.UserIDs {
		var target models.User
		if err := config.DB.First(&target, uid).Error; err != nil {
			results = append(results, result{UserID: uid, Success: false, Error: "User tidak ditemukan"})
			failCount++
			continue
		}

		if role == "admin_cabang" {
			if admin.SchoolID == nil || target.SchoolID == nil || *admin.SchoolID != *target.SchoolID {
				results = append(results, result{UserID: uid, Name: target.Name, Success: false, Error: "Beda sekolah"})
				failCount++
				continue
			}
		}

		defaultPwd, source := getDefaultPasswordForUser(&target)
		if defaultPwd == "" {
			results = append(results, result{UserID: uid, Name: target.Name, Success: false, Error: "Tidak ada kode default"})
			failCount++
			continue
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(defaultPwd), bcrypt.DefaultCost)
		if err != nil {
			results = append(results, result{UserID: uid, Name: target.Name, Success: false, Error: "Gagal hash"})
			failCount++
			continue
		}

		config.DB.Model(&target).Updates(map[string]interface{}{
			"password":             string(hash),
			"must_change_password": true,
			"password_changed_at":  nil,
		})

		config.DB.Create(&models.PasswordResetLog{
			SchoolID:     target.SchoolID,
			AdminID:      adminID,
			TargetUserID: target.ID,
			Action:       "bulk_reset",
			IPAddress:    c.IP(),
			UserAgent:    c.Get("User-Agent"),
			Note:         "Bulk reset (sumber: " + source + ")",
		})

		results = append(results, result{
			UserID:   uid,
			Name:     target.Name,
			Success:  true,
			Password: defaultPwd,
			Source:   source,
		})
		successCount++
	}

	return c.JSON(fiber.Map{
		"total":    len(req.UserIDs),
		"success":  successCount,
		"failed":   failCount,
		"results":  results,
	})
}

// ChangeMyPassword — DEPRECATED, dipakai handlers.ChangePassword di auth.go
// (yang sekarang juga handle force-change after reset)

// GetPasswordResetLogs — admin lihat audit log reset password
// GET /api/users/password-reset-logs?days=30&user_id=123
func GetPasswordResetLogs(c *fiber.Ctx) error {
	adminID := c.Locals("user_id").(uint)
	role := c.Locals("role").(string)

	if role != "admin_pusat" && role != "admin_cabang" {
		return c.Status(403).JSON(fiber.Map{"error": "Hanya admin"})
	}

	days, _ := strconv.Atoi(c.Query("days", "30"))
	if days < 1 || days > 365 {
		days = 30
	}

	since := time.Now().AddDate(0, 0, -days)
	q := config.DB.Where("created_at > ?", since).
		Order("created_at desc").
		Limit(500)

	// Multi-tenant filter
	if role == "admin_cabang" {
		var admin models.User
		config.DB.First(&admin, adminID)
		if admin.SchoolID != nil {
			q = q.Where("school_id = ?", *admin.SchoolID)
		}
	}

	if userID := c.Query("user_id"); userID != "" {
		q = q.Where("target_user_id = ? OR admin_id = ?", userID, userID)
	}

	var logs []models.PasswordResetLog
	q.Find(&logs)

	// Enrich names
	type enriched struct {
		models.PasswordResetLog
		AdminName  string `json:"admin_name"`
		TargetName string `json:"target_name"`
	}

	out := make([]enriched, 0, len(logs))
	for _, l := range logs {
		var admin, target models.User
		config.DB.Select("name").First(&admin, l.AdminID)
		config.DB.Select("name").First(&target, l.TargetUserID)
		out = append(out, enriched{
			PasswordResetLog: l,
			AdminName:        admin.Name,
			TargetName:       target.Name,
		})
	}

	return c.JSON(fiber.Map{
		"logs":  out,
		"total": len(out),
		"days":  days,
	})
}
