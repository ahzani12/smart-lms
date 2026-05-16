package handlers

import (
	"regexp"
	"strings"
	"smart-lms/internal/config"
	"smart-lms/internal/middleware"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

var sixDigitRe = regexp.MustCompile(`^\d{6}$`)

func Login(c *fiber.Ctx) error {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var user models.User
	identifier := strings.TrimSpace(req.Email)

	// 6 digits = student_id (siswa)
	if sixDigitRe.MatchString(identifier) {
		if err := config.DB.Preload("School").Where("student_id = ? AND active = true", identifier).First(&user).Error; err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "ID atau password salah"})
		}
	} else if !strings.Contains(identifier, "@") {
		// No @ = NIP (guru) — lookup teacher by NIP, then get user
		var teacher models.Teacher
		if err := config.DB.Where("nip = ?", identifier).First(&teacher).Error; err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "NIP atau password salah"})
		}
		if err := config.DB.Preload("School").Where("id = ? AND active = true", teacher.UserID).First(&user).Error; err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "NIP atau password salah"})
		}
	} else {
		// Email (admin)
		if err := config.DB.Preload("School").Where("email = ? AND active = true", identifier).First(&user).Error; err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "Email atau password salah"})
		}
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Email atau password salah"})
	}

	token, err := middleware.GenerateToken(user)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.JSON(fiber.Map{
		"token": token,
		"user":  user,
	})
}

func GetProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	var user models.User
	if err := config.DB.Preload("School").First(&user, userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// If guru, load teacher data
	if user.Role == "guru" {
		var teacher models.Teacher
		config.DB.Where("user_id = ?", userID).Preload("Subjects").First(&teacher)
		return c.JSON(fiber.Map{"user": user, "teacher": teacher})
	}

	// If siswa, load student data
	if user.Role == "siswa" {
		var student models.Student
		config.DB.Where("user_id = ?", userID).Preload("Class").First(&student)
		return c.JSON(fiber.Map{"user": user, "student": student})
	}

	return c.JSON(fiber.Map{"user": user})
}

func UpdateProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	var req struct {
		Name  string `json:"name"`
		Phone string `json:"phone"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	config.DB.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"name":  req.Name,
		"phone": req.Phone,
	})

	return c.JSON(fiber.Map{"message": "Profile updated"})
}

func ChangePassword(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var user models.User
	config.DB.First(&user, userID)

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.OldPassword)); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Password lama salah"})
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	config.DB.Model(&user).Update("password", string(hash))

	return c.JSON(fiber.Map{"message": "Password changed"})
}
