package models

import (
	"log"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func SeedData(db *gorm.DB) {
	// Check if already seeded
	var count int64
	db.Model(&User{}).Count(&count)
	if count > 0 {
		log.Println("📦 Data already seeded")
		return
	}

	log.Println("🌱 Seeding initial data...")

	// Create superadmin (no school)
	hashSuper, _ := bcrypt.GenerateFromPassword([]byte("super123"), bcrypt.DefaultCost)
	superadmin := User{
		Name: "Super Admin", Email: "super@lms.id", Password: string(hashSuper),
		Role: "superadmin", Active: true,
	}
	db.Create(&superadmin)

	// Create default school
	school := School{
		Name:        "SMA Negeri 1 Contoh",
		Address:     "Jl. Pendidikan No. 1, Jakarta",
		Phone:       "021-1234567",
		Email:       "info@sman1contoh.sch.id",
		NPSN:        "12345678",
		Level:       "SMA",
		HeaderText:  "REPUBLIK INDONESIA\nPEMERINTAH DAERAH\nDINAS PENDIDIKAN",
		HeaderColor: "#1e40af",
	}
	db.Create(&school)

	// Hash password
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	hashGuru, _ := bcrypt.GenerateFromPassword([]byte("guru123"), bcrypt.DefaultCost)
	hashSiswa, _ := bcrypt.GenerateFromPassword([]byte("siswa123"), bcrypt.DefaultCost)

	// Create users
	users := []User{
		{Name: "Admin Pusat", Email: "admin@lms.id", Password: string(hash), Role: "admin_pusat", Active: true, SchoolID: &school.ID},
		{Name: "Admin Cabang", Email: "admincabang@lms.id", Password: string(hash), Role: "admin_cabang", Active: true, SchoolID: &school.ID},
		{Name: "Budi Santoso", Email: "guru@lms.id", Password: string(hashGuru), Role: "guru", Active: true, SchoolID: &school.ID},
		{Name: "Siti Aminah", Email: "guru2@lms.id", Password: string(hashGuru), Role: "guru", Active: true, SchoolID: &school.ID},
		{Name: "Ahmad Rizki", Email: "siswa@lms.id", StudentID: "100001", Password: string(hashSiswa), Role: "siswa", Active: true, SchoolID: &school.ID},
		{Name: "Dewi Lestari", Email: "siswa2@lms.id", StudentID: "100002", Password: string(hashSiswa), Role: "siswa", Active: true, SchoolID: &school.ID},
	}
	db.Create(&users)

	// Create teachers
	teacher1 := Teacher{UserID: users[2].ID, NIP: "198501012010011001", SchoolID: school.ID}
	teacher2 := Teacher{UserID: users[3].ID, NIP: "198602022011012002", SchoolID: school.ID}
	db.Create(&teacher1)
	db.Create(&teacher2)

	// Create subjects
	subjects := []Subject{
		{Code: "MTK", Name: "Matematika", Level: "X", SchoolID: school.ID},
		{Code: "BID", Name: "Bahasa Indonesia", Level: "X", SchoolID: school.ID},
		{Code: "BING", Name: "Bahasa Inggris", Level: "X", SchoolID: school.ID},
		{Code: "FIS", Name: "Fisika", Level: "X", SchoolID: school.ID},
		{Code: "BIO", Name: "Biologi", Level: "X", SchoolID: school.ID},
		{Code: "IPS", Name: "Ilmu Pengetahuan Sosial", Level: "X", SchoolID: school.ID},
	}
	db.Create(&subjects)

	// Assign subjects to teachers
	db.Model(&teacher1).Association("Subjects").Append(&subjects[0])
	db.Model(&teacher2).Association("Subjects").Append(&subjects[1])

	// Create classes
	classes := []Class{
		{Name: "X IPA 1", Level: "X", Major: "IPA", Capacity: 36, SchoolID: school.ID, TeacherID: &teacher1.ID},
		{Name: "X IPA 2", Level: "X", Major: "IPA", Capacity: 36, SchoolID: school.ID, TeacherID: &teacher2.ID},
		{Name: "X IPS 1", Level: "X", Major: "IPS", Capacity: 36, SchoolID: school.ID},
	}
	db.Create(&classes)

	// Create semester
	now := time.Now()
	semester := Semester{
		Name:      "Ganjil 2025/2026",
		Year:      "2025/2026",
		Period:    "ganjil",
		StartDate: now.AddDate(0, -3, 0),
		EndDate:   now.AddDate(0, 3, 0),
		Active:    true,
		SchoolID:  school.ID,
	}
	db.Create(&semester)

	// Create students
	students := []Student{
		{UserID: users[4].ID, NIS: "2025001", NISN: "0012345678", ClassID: &classes[0].ID, SchoolID: school.ID, Gender: "L"},
		{UserID: users[5].ID, NIS: "2025002", NISN: "0012345679", ClassID: &classes[0].ID, SchoolID: school.ID, Gender: "P"},
	}
	db.Create(&students)

	// Create AI config placeholder
	aiCfg := AIConfig{
		Name:     "Default AI",
		BaseURL:  "https://api.openai.com/v1",
		APIKey:   "sk-your-api-key-here",
		Model:    "gpt-4o",
		Active:   true,
		SchoolID: school.ID,
	}
	db.Create(&aiCfg)

	log.Println("✅ Seed data created")
	log.Println("   Superadmin: super@lms.id / super123")
	log.Println("   Admin: admin@lms.id / admin123")
	log.Println("   Guru:  guru@lms.id / guru123 (NIP: 198501012010011001)")
	log.Println("   Siswa: 100001 / siswa123")
}
