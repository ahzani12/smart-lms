package models

import (
	"fmt"
	"log"
	"math/rand"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// SeedDemo — bikin sekolah demo lengkap utk showcase calon customer.
// Idempotent: cek berdasarkan NPSN khusus "DEMO00000001".
//
// Login demo:
//   - admin@demo.lms.id / demo123 (admin sekolah, full akses)
//   - guru.demo@demo.lms.id / demo123 (guru, akses input nilai)
//   - 100100 / demo123 (siswa, akses leaderboard + nilai sendiri)
func SeedDemo(db *gorm.DB) {
	// Idempotent check
	var existing School
	if err := db.Where("npsn = ?", "DEMO00000001").First(&existing).Error; err == nil {
		log.Println("📦 Demo school already exists (NPSN DEMO00000001)")
		return
	}

	log.Println("🎬 Creating demo school for showcase...")

	// 1) Sekolah demo
	demo := School{
		Name:        "SMA Demo Smart-LMS",
		Address:     "Jl. Contoh Demo No. 1",
		Kabupaten:   "Bandung",
		KodePos:     "40115",
		Phone:       "(022) 555-0100",
		Email:       "info@demo.lms.id",
		NPSN:        "DEMO00000001",
		Level:       "SMA",
		HeaderText:  "YAYASAN PENDIDIKAN DEMO\nSMA SMART-LMS\nTERAKREDITASI A",
		HeaderColor: "#1e40af",
		YayasanName: "YAYASAN PENDIDIKAN DEMO",
		KepalaName:  "Drs. H. Demo Santoso, M.Pd",
		KepalaNIP:   "196501012001011001",
	}
	if err := db.Create(&demo).Error; err != nil {
		log.Printf("❌ Demo school create failed: %v", err)
		return
	}

	hashAdmin, _ := bcrypt.GenerateFromPassword([]byte("demo123"), bcrypt.DefaultCost)

	// 2) Admin demo
	adminUser := User{
		Name: "Admin Demo", Email: "admin@demo.lms.id", Password: string(hashAdmin),
		Role: "admin_pusat", Active: true, SchoolID: &demo.ID,
	}
	db.Create(&adminUser)

	// 3) Guru demo (5 wali kelas)
	guruNames := []string{
		"Ust. Hendra Wijaya, S.Pd",
		"Ustz. Siti Maemunah, S.Pd",
		"Ust. Budi Hartono, S.Si",
		"Ustz. Ratna Sari, M.Pd",
		"Ust. Joko Susilo, S.Kom",
	}
	teachers := make([]Teacher, len(guruNames))
	for i, nm := range guruNames {
		email := fmt.Sprintf("guru%d.demo@demo.lms.id", i+1)
		if i == 0 {
			email = "guru.demo@demo.lms.id"
		}
		u := User{Name: nm, Email: email, Password: string(hashAdmin), Role: "guru", Active: true, SchoolID: &demo.ID}
		db.Create(&u)
		t := Teacher{UserID: u.ID, NIP: fmt.Sprintf("19850101201%03d11001", i), SchoolID: demo.ID}
		db.Create(&t)
		teachers[i] = t
	}

	// 4) Subjects (6 mapel inti)
	subjectData := []struct {
		Code, Name string
	}{
		{"MTK", "Matematika"},
		{"BIN", "Bahasa Indonesia"},
		{"BIG", "Bahasa Inggris"},
		{"FIS", "Fisika"},
		{"KIM", "Kimia"},
		{"BIO", "Biologi"},
	}
	subjects := make([]Subject, 0, len(subjectData)*3)
	for _, lvl := range []string{"X", "XI", "XII"} {
		for _, sd := range subjectData {
			subjects = append(subjects, Subject{
				Code: sd.Code, Name: sd.Name, Level: lvl, SchoolID: demo.ID,
			})
		}
	}
	db.Create(&subjects)

	// 5) Kelas: 3 jenjang (X, XI, XII) × 1 kelas IPA = 3 kelas
	classData := []struct {
		Name, Level string
		Wali        uint
	}{
		{"X IPA 1", "X", teachers[0].ID},
		{"XI IPA 1", "XI", teachers[1].ID},
		{"XII IPA 1", "XII", teachers[2].ID},
	}
	classes := make([]Class, len(classData))
	for i, cd := range classData {
		c := Class{Name: cd.Name, Level: cd.Level, Major: "IPA", Capacity: 36, SchoolID: demo.ID, TeacherID: &cd.Wali}
		db.Create(&c)
		classes[i] = c
	}

	// 6) Semester aktif
	now := time.Now()
	sem := Semester{
		Name: "Ganjil 2025/2026", Year: "2025/2026", Period: "ganjil",
		StartDate: now.AddDate(0, -3, 0), EndDate: now.AddDate(0, 3, 0),
		Active: true, SchoolID: demo.ID,
	}
	db.Create(&sem)

	// 7) Siswa: 30 per kelas = 90 siswa total
	rng := rand.New(rand.NewSource(20260524))
	firstNames := []string{
		"Ahmad", "Aisyah", "Budi", "Citra", "Dewi", "Eko", "Fadhil", "Gita", "Hadi", "Indah",
		"Joko", "Kartika", "Lukman", "Maya", "Nur", "Omar", "Putri", "Qori", "Rizki", "Sari",
		"Taufik", "Umar", "Vina", "Wahyu", "Xena", "Yuni", "Zaki", "Anisa", "Bayu", "Cinta",
	}
	lastNames := []string{
		"Saputra", "Wijaya", "Permana", "Lestari", "Hidayat", "Pratama", "Anggraini", "Setiawan",
		"Putra", "Putri", "Kurniawan", "Maulana", "Rahman", "Sari", "Hartono",
	}

	studentIdx := 100100 // NIS demo prefix
	for ci, cls := range classes {
		for i := 0; i < 30; i++ {
			gender := "L"
			if rng.Intn(2) == 0 {
				gender = "P"
			}
			fullName := firstNames[rng.Intn(len(firstNames))] + " " + lastNames[rng.Intn(len(lastNames))]

			email := fmt.Sprintf("siswa%d.demo@demo.lms.id", studentIdx)
			u := User{
				Name: fullName, Email: email, StudentID: fmt.Sprintf("%d", studentIdx),
				Password: string(hashAdmin), Role: "siswa", Active: true, SchoolID: &demo.ID,
			}
			db.Create(&u)

			s := Student{
				UserID: u.ID, NIS: fmt.Sprintf("%d", studentIdx),
				NISN:    fmt.Sprintf("00%08d", studentIdx),
				ClassID: &cls.ID, SchoolID: demo.ID, Gender: gender,
			}
			db.Create(&s)
			_ = ci
			studentIdx++
		}
	}

	// 8) Jenis tagihan demo (SPP + uang gedung + seragam)
	jenisTagihan := []JenisTagihan{
		{Nama: "SPP Bulanan", Kode: "SPP", Periode: "bulanan", NominalDefault: 350000, Aktif: true, SchoolID: demo.ID},
		{Nama: "Uang Gedung", Kode: "UG", Periode: "tahunan", NominalDefault: 2500000, Aktif: true, SchoolID: demo.ID},
		{Nama: "Seragam", Kode: "SRG", Periode: "sekali", NominalDefault: 750000, Aktif: true, SchoolID: demo.ID},
	}
	db.Create(&jenisTagihan)

	// 9) Tagihan SPP utk semua siswa demo (3 bulan terakhir)
	var allStudents []Student
	db.Where("school_id = ?", demo.ID).Find(&allStudents)

	for _, st := range allStudents {
		for monthsAgo := 2; monthsAgo >= 0; monthsAgo-- {
			due := now.AddDate(0, -monthsAgo, 5)
			t := Tagihan{
				StudentID:      st.ID,
				JenisTagihanID: jenisTagihan[0].ID,
				Nominal:        jenisTagihan[0].NominalDefault,
				Periode:        due.Format("2006-01"),
				JatuhTempo:     due,
				Status:         "belum_bayar",
				SchoolID:       demo.ID,
			}
			// 70% siswa udh bayar bulan -2 dan -1, bulan ini masih nunggak
			if monthsAgo >= 1 && rng.Intn(100) < 70 {
				t.Status = "lunas"
				t.Terbayar = t.Nominal
			} else if monthsAgo == 0 && rng.Intn(100) < 30 {
				t.Status = "lunas"
				t.Terbayar = t.Nominal
			}
			db.Create(&t)
		}
	}

	log.Printf("✅ Demo school created: %s (id=%d)", demo.Name, demo.ID)
	log.Printf("   Login admin: admin@demo.lms.id / demo123")
	log.Printf("   Login guru:  guru.demo@demo.lms.id / demo123")
	log.Printf("   Login siswa: 100100 / demo123")
	log.Printf("   Statistik: %d siswa, %d kelas, %d guru, %d tagihan SPP",
		len(allStudents), len(classes), len(teachers), len(allStudents)*3)
}
