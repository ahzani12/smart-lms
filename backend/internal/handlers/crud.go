package handlers

import (
	"fmt"
	"math/rand"
	"strconv"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// ─── Generic helpers ──────────────────────────────────────

func schoolID(c *fiber.Ctx) uint {
	return c.Locals("school_id").(uint)
}

func paramID(c *fiber.Ctx) uint {
	id, _ := strconv.ParseUint(c.Params("id"), 10, 64)
	return uint(id)
}

// ─── STUDENTS ─────────────────────────────────────────────

func GetStudents(c *fiber.Ctx) error {
	var students []models.Student
	q := config.DB.Where("school_id = ?", schoolID(c))
	if classID := c.Query("class_id"); classID != "" {
		q = q.Where("class_id = ?", classID)
	}
	q.Preload("User").Preload("Class").Order("id DESC").Find(&students)
	return c.JSON(students)
}

func GetStudent(c *fiber.Ctx) error {
	var student models.Student
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).Preload("User").Preload("Class").First(&student).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Student not found"})
	}
	return c.JSON(student)
}

func CreateStudent(c *fiber.Ctx) error {
	var req struct {
		Name      string `json:"name"`
		NIS       string `json:"nis"`
		NISN      string `json:"nisn"`
		ClassID   *uint  `json:"class_id"`
		Gender    string `json:"gender"`
		BirthDate string `json:"birth_date"`
		Address   string `json:"address"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	studentID := generateStudentID()
	sid := schoolID(c)
	hash, _ := bcrypt.GenerateFromPassword([]byte("siswa123"), bcrypt.DefaultCost)
	user := models.User{
		Name: req.Name, StudentID: studentID, Password: string(hash),
		Role: "siswa", Active: true, SchoolID: &sid,
	}
	config.DB.Create(&user)

	student := models.Student{
		UserID: user.ID, NIS: req.NIS, NISN: req.NISN,
		ClassID: req.ClassID, SchoolID: sid, Gender: req.Gender, Address: req.Address,
	}
	config.DB.Create(&student)

	return c.Status(201).JSON(fiber.Map{"message": "Student created", "id": student.ID, "student_id": studentID})
}

func UpdateStudent(c *fiber.Ctx) error {
	var req struct {
		Name    string `json:"name"`
		NIS     string `json:"nis"`
		NISN    string `json:"nisn"`
		ClassID *uint  `json:"class_id"`
		Gender  string `json:"gender"`
		Address string `json:"address"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var student models.Student
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&student).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}

	config.DB.Model(&models.User{}).Where("id = ?", student.UserID).Updates(map[string]interface{}{
		"name": req.Name,
	})
	config.DB.Model(&student).Updates(map[string]interface{}{
		"nis": req.NIS, "nisn": req.NISN, "class_id": req.ClassID,
		"gender": req.Gender, "address": req.Address,
	})

	return c.JSON(fiber.Map{"message": "Student updated"})
}

func DeleteStudent(c *fiber.Ctx) error {
	var student models.Student
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&student).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	config.DB.Delete(&student)
	config.DB.Delete(&models.User{}, student.UserID)
	return c.JSON(fiber.Map{"message": "Student deleted"})
}

// ─── TEACHERS ─────────────────────────────────────────────

func GetTeachers(c *fiber.Ctx) error {
	var teachers []models.Teacher
	config.DB.Where("school_id = ?", schoolID(c)).Preload("User").Preload("Subjects").Order("id DESC").Find(&teachers)
	return c.JSON(teachers)
}

func GetTeacher(c *fiber.Ctx) error {
	var teacher models.Teacher
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).Preload("User").Preload("Subjects").First(&teacher).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Teacher not found"})
	}
	return c.JSON(teacher)
}

func CreateTeacher(c *fiber.Ctx) error {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		NIP      string `json:"nip"`
		Phone    string `json:"phone"`
		Subjects []uint `json:"subjects"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	sid := schoolID(c)
	hash, _ := bcrypt.GenerateFromPassword([]byte("guru123"), bcrypt.DefaultCost)
	user := models.User{
		Name: req.Name, Email: req.Email, Password: string(hash),
		Role: "guru", Phone: req.Phone, Active: true, SchoolID: &sid,
	}
	config.DB.Create(&user)

	teacher := models.Teacher{UserID: user.ID, NIP: req.NIP, SchoolID: sid}
	config.DB.Create(&teacher)

	if len(req.Subjects) > 0 {
		var subjects []models.Subject
		config.DB.Where("id IN ?", req.Subjects).Find(&subjects)
		for i := range subjects {
			config.DB.Model(&teacher).Association("Subjects").Append(&subjects[i])
		}
	}

	return c.Status(201).JSON(fiber.Map{"message": "Teacher created", "id": teacher.ID})
}

func UpdateTeacher(c *fiber.Ctx) error {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		NIP      string `json:"nip"`
		Phone    string `json:"phone"`
		Subjects []uint `json:"subjects"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var teacher models.Teacher
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&teacher).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}

	config.DB.Model(&models.User{}).Where("id = ?", teacher.UserID).Updates(map[string]interface{}{
		"name": req.Name, "email": req.Email, "phone": req.Phone,
	})
	config.DB.Model(&teacher).Update("nip", req.NIP)

	if req.Subjects != nil {
		var subjects []models.Subject
		config.DB.Where("id IN ?", req.Subjects).Find(&subjects)
		config.DB.Model(&teacher).Association("Subjects").Clear()
		for i := range subjects {
			config.DB.Model(&teacher).Association("Subjects").Append(&subjects[i])
		}
	}

	return c.JSON(fiber.Map{"message": "Teacher updated"})
}

func DeleteTeacher(c *fiber.Ctx) error {
	var teacher models.Teacher
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&teacher).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	config.DB.Model(&teacher).Association("Subjects").Clear()
	config.DB.Delete(&teacher)
	config.DB.Delete(&models.User{}, teacher.UserID)
	return c.JSON(fiber.Map{"message": "Teacher deleted"})
}

// ─── CLASSES ──────────────────────────────────────────────

func GetClasses(c *fiber.Ctx) error {
	var classes []models.Class
	config.DB.Where("school_id = ?", schoolID(c)).Preload("Teacher.User").Order("name").Find(&classes)
	return c.JSON(classes)
}

func GetClass(c *fiber.Ctx) error {
	var class models.Class
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).Preload("Teacher.User").First(&class).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Class not found"})
	}
	// Count students
	var count int64
	config.DB.Model(&models.Student{}).Where("class_id = ?", class.ID).Count(&count)
	return c.JSON(fiber.Map{"class": class, "student_count": count})
}

func CreateClass(c *fiber.Ctx) error {
	var class models.Class
	if err := c.BodyParser(&class); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	class.SchoolID = schoolID(c)
	config.DB.Create(&class)
	return c.Status(201).JSON(fiber.Map{"message": "Class created", "id": class.ID})
}

func UpdateClass(c *fiber.Ctx) error {
	var class models.Class
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&class).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	if err := c.BodyParser(&class); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	class.SchoolID = schoolID(c)
	config.DB.Save(&class)
	return c.JSON(fiber.Map{"message": "Class updated"})
}

func DeleteClass(c *fiber.Ctx) error {
	config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).Delete(&models.Class{})
	return c.JSON(fiber.Map{"message": "Class deleted"})
}

// ─── SUBJECTS ─────────────────────────────────────────────

func GetSubjects(c *fiber.Ctx) error {
	var subjects []models.Subject
	config.DB.Where("school_id = ?", schoolID(c)).Order("name").Find(&subjects)
	return c.JSON(subjects)
}

func CreateSubject(c *fiber.Ctx) error {
	var subject models.Subject
	if err := c.BodyParser(&subject); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	subject.SchoolID = schoolID(c)
	config.DB.Create(&subject)
	return c.Status(201).JSON(fiber.Map{"message": "Subject created", "id": subject.ID})
}

func UpdateSubject(c *fiber.Ctx) error {
	var subject models.Subject
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&subject).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	if err := c.BodyParser(&subject); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	subject.SchoolID = schoolID(c)
	config.DB.Save(&subject)
	return c.JSON(fiber.Map{"message": "Subject updated"})
}

func DeleteSubject(c *fiber.Ctx) error {
	config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).Delete(&models.Subject{})
	return c.JSON(fiber.Map{"message": "Subject deleted"})
}

// ─── SEMESTERS ────────────────────────────────────────────

func GetSemesters(c *fiber.Ctx) error {
	var semesters []models.Semester
	config.DB.Where("school_id = ?", schoolID(c)).Order("start_date DESC").Find(&semesters)
	return c.JSON(semesters)
}

func CreateSemester(c *fiber.Ctx) error {
	var semester models.Semester
	if err := c.BodyParser(&semester); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	semester.SchoolID = schoolID(c)
	config.DB.Create(&semester)
	return c.Status(201).JSON(fiber.Map{"message": "Semester created", "id": semester.ID})
}

func UpdateSemester(c *fiber.Ctx) error {
	var semester models.Semester
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&semester).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	if err := c.BodyParser(&semester); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	semester.SchoolID = schoolID(c)
	config.DB.Save(&semester)
	return c.JSON(fiber.Map{"message": "Semester updated"})
}

func DeleteSemester(c *fiber.Ctx) error {
	config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).Delete(&models.Semester{})
	return c.JSON(fiber.Map{"message": "Semester deleted"})
}

// ─── USERS (Admin management) ─────────────────────────────

func GetUsers(c *fiber.Ctx) error {
	var users []models.User
	q := config.DB.Where("school_id = ?", schoolID(c))
	if role := c.Query("role"); role != "" {
		q = q.Where("role = ?", role)
	}
	q.Preload("School").Order("id DESC").Find(&users)
	return c.JSON(users)
}

func CreateUser(c *fiber.Ctx) error {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
		Phone    string `json:"phone"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	sid := schoolID(c)
	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	user := models.User{
		Name: req.Name, Email: req.Email, Password: string(hash),
		Role: req.Role, Phone: req.Phone, Active: true, SchoolID: &sid,
	}
	config.DB.Create(&user)
	return c.Status(201).JSON(fiber.Map{"message": "User created", "id": user.ID})
}

func UpdateUser(c *fiber.Ctx) error {
	var req struct {
		Name   string `json:"name"`
		Email  string `json:"email"`
		Role   string `json:"role"`
		Phone  string `json:"phone"`
		Active *bool  `json:"active"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	config.DB.Model(&models.User{}).Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).Updates(map[string]interface{}{
		"name": req.Name, "email": req.Email, "role": req.Role,
		"phone": req.Phone, "active": req.Active,
	})
	return c.JSON(fiber.Map{"message": "User updated"})
}

func DeleteUser(c *fiber.Ctx) error {
	config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).Delete(&models.User{})
	return c.JSON(fiber.Map{"message": "User deleted"})
}

// ─── BULK ASSIGN STUDENTS TO CLASS ────────────────────────

func AssignStudentsToClass(c *fiber.Ctx) error {
	classID := paramID(c)
	var class models.Class
	if err := config.DB.Where("id = ? AND school_id = ?", classID, schoolID(c)).First(&class).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Kelas tidak ditemukan"})
	}

	var req struct {
		StudentIDs []uint `json:"student_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if len(req.StudentIDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Pilih minimal 1 siswa"})
	}

	res := config.DB.Model(&models.Student{}).
		Where("id IN ? AND school_id = ?", req.StudentIDs, schoolID(c)).
		Update("class_id", classID)

	return c.JSON(fiber.Map{"message": "Siswa berhasil ditambahkan ke kelas", "updated": res.RowsAffected})
}

func UnassignStudentsFromClass(c *fiber.Ctx) error {
	classID := paramID(c)
	var class models.Class
	if err := config.DB.Where("id = ? AND school_id = ?", classID, schoolID(c)).First(&class).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}

	var req struct {
		StudentIDs []uint `json:"student_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	config.DB.Model(&models.Student{}).
		Where("id IN ? AND class_id = ?", req.StudentIDs, classID).
		Update("class_id", nil)

	return c.JSON(fiber.Map{"message": "Siswa dikeluarkan dari kelas"})
}

func GetClassStudents(c *fiber.Ctx) error {
	classID := paramID(c)
	var class models.Class
	if err := config.DB.Where("id = ? AND school_id = ?", classID, schoolID(c)).First(&class).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}
	var students []models.Student
	config.DB.Where("class_id = ?", classID).Preload("User").Order("id ASC").Find(&students)
	return c.JSON(students)
}

func GetUnassignedStudents(c *fiber.Ctx) error {
	var students []models.Student
	config.DB.Where("school_id = ? AND (class_id IS NULL OR class_id = 0)", schoolID(c)).
		Preload("User").Order("id ASC").Find(&students)
	return c.JSON(students)
}

// ─── GENERATE STUDENT ID ─────────────────────────────────

func generateStudentID() string {
	for i := 0; i < 100; i++ {
		id := fmt.Sprintf("%06d", rand.Intn(1000000))
		var count int64
		config.DB.Model(&models.User{}).Where("student_id = ?", id).Count(&count)
		if count == 0 {
			return id
		}
	}
	// Fallback: extremely unlikely to reach here
	return fmt.Sprintf("%06d", rand.Intn(1000000))
}

// ─── IMPORT STUDENTS (BULK) ──────────────────────────────

func ImportStudents(c *fiber.Ctx) error {
	var req struct {
		Students []struct {
			Name    string `json:"name"`
			NIS     string `json:"nis"`
			NISN    string `json:"nisn"`
			ClassID *uint  `json:"class_id"`
			Gender  string `json:"gender"`
			Address string `json:"address"`
		} `json:"students"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if len(req.Students) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Data siswa kosong"})
	}

	sid := schoolID(c)
	hash, _ := bcrypt.GenerateFromPassword([]byte("siswa123"), bcrypt.DefaultCost)

	type createdResult struct {
		Name      string `json:"name"`
		StudentID string `json:"student_id"`
		NIS       string `json:"nis"`
		ID        uint   `json:"id"`
	}
	var results []createdResult

	for _, s := range req.Students {
		studentID := generateStudentID()
		user := models.User{
			Name: s.Name, StudentID: studentID, Password: string(hash),
			Role: "siswa", Active: true, SchoolID: &sid,
		}
		config.DB.Create(&user)

		student := models.Student{
			UserID: user.ID, NIS: s.NIS, NISN: s.NISN,
			ClassID: s.ClassID, SchoolID: sid, Gender: s.Gender, Address: s.Address,
		}
		config.DB.Create(&student)

		results = append(results, createdResult{
			Name: s.Name, StudentID: studentID, NIS: s.NIS, ID: student.ID,
		})
	}

	return c.Status(201).JSON(fiber.Map{
		"message":  fmt.Sprintf("%d siswa berhasil diimport", len(results)),
		"students": results,
	})
}
