package handlers

import (
	"crypto/rand"
	"encoding/csv"
	"fmt"
	"math/big"
	"os"
	"smart-lms/internal/config"
	"smart-lms/internal/models"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// BulkGenerateParentAccess generates access codes for all students in a class (or all)
func BulkGenerateParentAccess(c *fiber.Ctx) error {
	sid := schoolID(c)

	var body struct {
		ClassID uint `json:"class_id"`
	}
	c.BodyParser(&body)

	query := config.DB.Where("school_id = ?", sid)
	if body.ClassID > 0 {
		query = query.Where("class_id = ?", body.ClassID)
	}

	var students []models.Student
	query.Preload("User").Find(&students)

	if len(students) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Tidak ada siswa ditemukan"})
	}

	var generated int
	for _, student := range students {
		// Check if already has access code
		var existing models.ParentAccess
		if config.DB.Where("student_id = ? AND school_id = ?", student.ID, sid).First(&existing).Error == nil {
			continue // already has code
		}

		code := generateCode()
		pa := models.ParentAccess{
			StudentID:  student.ID,
			AccessCode: code,
			SchoolID:   sid,
		}
		config.DB.Create(&pa)
		generated++
	}

	return c.JSON(fiber.Map{
		"message":   fmt.Sprintf("Berhasil generate %d kode akses", generated),
		"generated": generated,
		"total":     len(students),
	})
}

// GetParentAccessList returns all parent access codes (admin view)
func GetParentAccessList(c *fiber.Ctx) error {
	sid := schoolID(c)

	var accesses []models.ParentAccess
	query := config.DB.Where("parent_accesses.school_id = ?", sid).
		Joins("Student").
		Joins("Student.User").
		Preload("Student.User").
		Preload("Student.Class")

	// Filter by class
	classID := c.QueryInt("class_id", 0)
	if classID > 0 {
		query = query.Where("\"Student\".class_id = ?", classID)
	}

	query.Find(&accesses)

	type AccessItem struct {
		ID          uint   `json:"id"`
		StudentID   uint   `json:"student_id"`
		StudentName string `json:"student_name"`
		NIS         string `json:"nis"`
		ClassName   string `json:"class_name"`
		AccessCode  string `json:"access_code"`
		ParentName  string `json:"parent_name"`
		Phone       string `json:"phone"`
		Relation    string `json:"relation"`
	}

	var items []AccessItem
	for _, a := range accesses {
		className := ""
		if a.Student.Class != nil {
			className = a.Student.Class.Name
		}
		items = append(items, AccessItem{
			ID:          a.ID,
			StudentID:   a.StudentID,
			StudentName: a.Student.User.Name,
			NIS:         a.Student.NIS,
			ClassName:   className,
			AccessCode:  a.AccessCode,
			ParentName:  a.ParentName,
			Phone:       a.Phone,
			Relation:    a.Relation,
		})
	}

	return c.JSON(items)
}

// ExportParentAccessCSV exports access codes as CSV
func ExportParentAccessCSV(c *fiber.Ctx) error {
	sid := schoolID(c)

	var accesses []models.ParentAccess
	config.DB.Where("parent_accesses.school_id = ?", sid).
		Preload("Student.User").
		Preload("Student.Class").
		Find(&accesses)

	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", "attachment; filename=kode_akses_ortu.csv")

	writer := csv.NewWriter(c.Response().BodyWriter())
	writer.Write([]string{"NIS", "Nama Siswa", "Kelas", "Kode Akses", "Nama Ortu", "No HP"})

	for _, a := range accesses {
		className := ""
		if a.Student.Class != nil {
			className = a.Student.Class.Name
		}
		writer.Write([]string{
			a.Student.NIS,
			a.Student.User.Name,
			className,
			a.AccessCode,
			a.ParentName,
			a.Phone,
		})
	}
	writer.Flush()
	return nil
}

// UpdateParentAccess updates parent name/phone/relation
func UpdateParentAccess(c *fiber.Ctx) error {
	sid := schoolID(c)
	id := c.Params("id")

	var pa models.ParentAccess
	if err := config.DB.Where("id = ? AND school_id = ?", id, sid).First(&pa).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Data tidak ditemukan"})
	}

	var body struct {
		ParentName string `json:"parent_name"`
		Phone      string `json:"phone"`
		Relation   string `json:"relation"`
	}
	c.BodyParser(&body)

	pa.ParentName = body.ParentName
	pa.Phone = body.Phone
	pa.Relation = body.Relation
	config.DB.Save(&pa)

	return c.JSON(pa)
}

// RegenerateCode regenerates access code for a specific student
func RegenerateCode(c *fiber.Ctx) error {
	sid := schoolID(c)
	id := c.Params("id")

	var pa models.ParentAccess
	if err := config.DB.Where("id = ? AND school_id = ?", id, sid).First(&pa).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Data tidak ditemukan"})
	}

	pa.AccessCode = generateCode()
	config.DB.Save(&pa)

	return c.JSON(pa)
}

// ParentLogin handles login via NIS + access code
func ParentLogin(c *fiber.Ctx) error {
	var body struct {
		NIS        string `json:"nis"`
		AccessCode string `json:"access_code"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Data tidak valid"})
	}

	if body.NIS == "" || body.AccessCode == "" {
		return c.Status(400).JSON(fiber.Map{"error": "NIS dan kode akses wajib diisi"})
	}

	// Find student by NIS
	var student models.Student
	if err := config.DB.Where("nis = ?", body.NIS).Preload("User").First(&student).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "NIS atau kode akses salah"})
	}

	// Check access code
	var pa models.ParentAccess
	if err := config.DB.Where("student_id = ? AND access_code = ?", student.ID, body.AccessCode).First(&pa).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "NIS atau kode akses salah"})
	}

	// Generate JWT with parent role
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":    0,
		"role":       "orang_tua",
		"school_id":  pa.SchoolID,
		"student_id": student.ID,
		"parent_id":  pa.ID,
		"exp":        time.Now().Add(24 * time.Hour).Unix(),
	})

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "smart-lms-jwt-secret-key-2025"
	}
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal generate token"})
	}

	return c.JSON(fiber.Map{
		"token": tokenString,
		"user": fiber.Map{
			"role":         "orang_tua",
			"name":         pa.ParentName,
			"student_name": student.User.Name,
			"student_nis":  student.NIS,
			"school_id":    pa.SchoolID,
		},
	})
}

// ParentPortalData returns child's data for parent portal
func ParentPortalData(c *fiber.Ctx) error {
	studentID := c.Locals("student_id")

	if studentID == nil {
		return c.Status(403).JSON(fiber.Map{"error": "Akses ditolak"})
	}

	sid, ok := studentID.(uint)
	if !ok || sid == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Akses ditolak"})
	}

	// Get student info
	var student models.Student
	config.DB.Where("id = ?", sid).Preload("User").Preload("Class").First(&student)

	// Get attendance summary
	var totalPresent, totalAbsent, totalLate int64
	config.DB.Model(&models.Presence{}).Where("student_id = ? AND status = 'hadir'", sid).Count(&totalPresent)
	config.DB.Model(&models.Presence{}).Where("student_id = ? AND status = 'alfa'", sid).Count(&totalAbsent)
	config.DB.Model(&models.Presence{}).Where("student_id = ? AND status = 'terlambat'", sid).Count(&totalLate)

	// Get latest raport
	var raport models.Raport
	var raportItems []models.RaportItem
	if config.DB.Where("student_id = ?", sid).Order("semester_id DESC").First(&raport).Error == nil {
		config.DB.Where("raport_id = ?", raport.ID).Preload("Subject").Find(&raportItems)
	}

	type RaportEntry struct {
		Subject string  `json:"subject"`
		Score   float64 `json:"score"`
		Grade   string  `json:"grade"`
	}
	var raportData []RaportEntry
	for _, ri := range raportItems {
		subjectName := ""
		if ri.Subject.ID > 0 {
			subjectName = ri.Subject.Name
		}
		raportData = append(raportData, RaportEntry{
			Subject: subjectName,
			Score:   ri.Score,
			Grade:   ri.Grade,
		})
	}

	return c.JSON(fiber.Map{
		"student": fiber.Map{
			"name":  student.User.Name,
			"nis":   student.NIS,
			"class": student.Class,
		},
		"attendance": fiber.Map{
			"hadir":     totalPresent,
			"alpha":     totalAbsent,
			"terlambat": totalLate,
		},
		"raport": raportData,
	})
}

func generateCode() string {
	const digits = "0123456789"
	code := make([]byte, 6)
	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		code[i] = digits[n.Int64()]
	}
	return string(code)
}
