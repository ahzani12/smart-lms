package handlers

import (
	"archive/zip"
	"bytes"
	"fmt"
	"math"
	"os"
	"os/exec"
	"strconv"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

func GetRaports(c *fiber.Ctx) error {
	var raports []models.Raport
	q := config.DB.Model(&models.Raport{})
	sid := schoolID(c)
	if sid > 0 {
		q = q.Where("raports.school_id = ?", sid)
	}
	if semesterID := c.Query("semester_id"); semesterID != "" {
		q = q.Where("raports.semester_id = ?", semesterID)
	}
	if classID := c.Query("class_id"); classID != "" {
		q = q.Joins("JOIN students ON students.id = raports.student_id").
			Where("students.class_id = ?", classID)
	}
	q.Preload("Student.User").Preload("Student.Class").Preload("Semester").Find(&raports)
	return c.JSON(raports)
}

func GetRaport(c *fiber.Ctx) error {
	var raport models.Raport
	if err := config.DB.Preload("Student.User").Preload("Student.Class").Preload("Semester").
		Preload("Items.Subject").Preload("Items.Teacher.User").
		First(&raport, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Raport tidak ditemukan"})
	}

	// Load school for custom header
	var school models.School
	config.DB.First(&school, raport.Student.SchoolID)

	// Load attendance summary (pake Presence + AttendanceSession + Schedule → semester)
	var hadir, sakit, izin, alfa, terlambat int64
	presCount := func(status string) int64 {
		var n int64
		config.DB.Model(&models.Presence{}).
			Joins("JOIN attendance_sessions s ON s.id = presences.session_id").
			Joins("JOIN schedules sc ON sc.id = s.schedule_id").
			Where("presences.student_id = ? AND s.school_id = ? AND sc.semester_id = ? AND presences.status = ?",
				raport.StudentID, raport.Student.SchoolID, raport.SemesterID, status).
			Count(&n)
		return n
	}
	hadir = presCount("hadir")
	sakit = presCount("sakit")
	izin = presCount("izin")
	alfa = presCount("alfa")
	terlambat = presCount("terlambat")

	return c.JSON(fiber.Map{
		"raport": raport,
		"school": school,
		"attendance": fiber.Map{
			"hadir": hadir, "sakit": sakit, "izin": izin, "alfa": alfa, "terlambat": terlambat,
		},
	})
}

func CreateRaport(c *fiber.Ctx) error {
	var req struct {
		StudentID  uint `json:"student_id"`
		SemesterID uint `json:"semester_id"`
		Notes      string `json:"notes"`
		Items      []struct {
			SubjectID uint    `json:"subject_id"`
			Score     float64 `json:"score"`
			KB        string  `json:"kb"`
			TeacherID uint    `json:"teacher_id"`
		} `json:"items"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	raport := models.Raport{
		StudentID:  req.StudentID,
		SemesterID: req.SemesterID,
		SchoolID:   schoolID(c),
		Notes:      req.Notes,
	}
	config.DB.Create(&raport)

	for _, item := range req.Items {
		grade := scoreToGrade(item.Score)
		config.DB.Create(&models.RaportItem{
			RaportID:  raport.ID,
			SubjectID: item.SubjectID,
			Score:     item.Score,
			Grade:     grade,
			KB:        item.KB,
			TeacherID: item.TeacherID,
		})
	}

	// Calculate rank
	calculateRank(req.StudentID, req.SemesterID)

	return c.Status(201).JSON(fiber.Map{"message": "Raport dibuat", "id": raport.ID})
}

func UpdateRaport(c *fiber.Ctx) error {
	var req struct {
		Notes string `json:"notes"`
		Items []struct {
			ID        uint    `json:"id"`
			SubjectID uint    `json:"subject_id"`
			Score     float64 `json:"score"`
			KB        string  `json:"kb"`
		} `json:"items"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	raportID := paramID(c)
	config.DB.Model(&models.Raport{}).Where("id = ?", raportID).Update("notes", req.Notes)

	for _, item := range req.Items {
		grade := scoreToGrade(item.Score)
		config.DB.Model(&models.RaportItem{}).Where("id = ?", item.ID).Updates(map[string]interface{}{
			"score": item.Score,
			"grade": grade,
			"kb":    item.KB,
		})
	}

	return c.JSON(fiber.Map{"message": "Raport diupdate"})
}

func GenerateRaportFromExams(c *fiber.Ctx) error {
	semesterID, _ := strconv.ParseUint(c.Query("semester_id"), 10, 64)
	classID, _ := strconv.ParseUint(c.Query("class_id"), 10, 64)

	// Get all students in class
	var students []models.Student
	config.DB.Where("class_id = ?", classID).Preload("User").Find(&students)

	// Get all subjects
	var subjects []models.Subject
	config.DB.Where("school_id = ?", schoolID(c)).Find(&subjects)

	// Get active semester
	semester := models.Semester{}
	config.DB.Where("active = true AND school_id = ?", schoolID(c)).First(&semester)
	if semesterID > 0 {
		config.DB.First(&semester, semesterID)
	}

	created := 0
	for _, student := range students {
		// Check if raport already exists
		var existing models.Raport
		if config.DB.Where("student_id = ? AND semester_id = ?", student.ID, semester.ID).First(&existing).RowsAffected > 0 {
			continue
		}

		raport := models.Raport{
			StudentID:  student.ID,
			SemesterID: semester.ID,
			SchoolID:   schoolID(c),
		}
		config.DB.Create(&raport)

		for _, subject := range subjects {
			// Calculate average score from exams
			var avgScore float64
			config.DB.Model(&models.ExamAttempt{}).
				Joins("JOIN exams ON exams.id = exam_attempts.exam_id").
				Where("exam_attempts.student_id = ?", student.ID).
				Where("exams.subject_id = ?", subject.ID).
				Where("exams.semester_id = ?", semester.ID).
				Where("exam_attempts.status = 'graded'").
				Select("COALESCE(AVG(exam_attempts.score), 0)").Scan(&avgScore)

			if avgScore > 0 {
				// Find teacher for this subject
				var teacher models.Teacher
				config.DB.Joins("JOIN teacher_subjects ON teacher_subjects.teacher_id = teachers.id").
					Where("teacher_subjects.subject_id = ?", subject.ID).First(&teacher)

				config.DB.Create(&models.RaportItem{
					RaportID:  raport.ID,
					SubjectID: subject.ID,
					Score:     math.Round(avgScore*100) / 100,
					Grade:     scoreToGrade(avgScore),
					TeacherID: teacher.ID,
				})
			}
		}
		created++
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("%d raport berhasil digenerate dari nilai ujian", created),
		"count":   created,
	})
}

func scoreToGrade(score float64) string {
	switch {
	case score >= 90:
		return "A"
	case score >= 80:
		return "B"
	case score >= 70:
		return "C"
	case score >= 60:
		return "D"
	default:
		return "E"
	}
}

func calculateRank(studentID, semesterID uint) {
	type RankResult struct {
		StudentID uint
		AvgScore  float64
	}

	var results []RankResult
	config.DB.Raw(`
		SELECT student_id, AVG(score) as avg_score
		FROM raports
		WHERE semester_id = ?
		GROUP BY student_id
		ORDER BY avg_score DESC
	`, semesterID).Scan(&results)

	for i, r := range results {
		config.DB.Model(&models.Raport{}).
			Where("student_id = ? AND semester_id = ?", r.StudentID, semesterID).
			Update("rank", i+1)
	}
}

// ─── School Config (Custom Header) ────────────────────────

func GetSchool(c *fiber.Ctx) error {
	var school models.School
	config.DB.First(&school, schoolID(c))
	return c.JSON(school)
}

func UpdateSchool(c *fiber.Ctx) error {
	var school models.School
	config.DB.First(&school, schoolID(c))
	if err := c.BodyParser(&school); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	config.DB.Save(&school)
	return c.JSON(fiber.Map{"message": "Sekolah diupdate"})
}

func UploadSchoolLogo(c *fiber.Ctx) error {
	file, err := c.FormFile("logo")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "File tidak ditemukan"})
	}

	path := fmt.Sprintf("uploads/logos/%d_%s", time.Now().Unix(), file.Filename)
	if err := c.SaveFile(file, path); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan file"})
	}

	config.DB.Model(&models.School{}).Where("id = ?", schoolID(c)).Update("header_logo", path)
	return c.JSON(fiber.Map{"message": "Logo diupload", "path": "/" + path})
}

// ─── Calendar ─────────────────────────────────────────────

func GetEvents(c *fiber.Ctx) error {
	var events []models.CalendarEvent
	q := config.DB.Where("school_id = ?", schoolID(c))
	if month := c.Query("month"); month != "" {
		q = q.Where("TO_CHAR(start_date, 'YYYY-MM') = ?", month)
	}
	q.Order("start_date ASC").Find(&events)
	return c.JSON(events)
}

func CreateEvent(c *fiber.Ctx) error {
	var event models.CalendarEvent
	if err := c.BodyParser(&event); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	event.SchoolID = schoolID(c)
	config.DB.Create(&event)
	return c.Status(201).JSON(fiber.Map{"message": "Event dibuat", "id": event.ID})
}

func UpdateEvent(c *fiber.Ctx) error {
	var event models.CalendarEvent
	config.DB.First(&event, paramID(c))
	if err := c.BodyParser(&event); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	config.DB.Save(&event)
	return c.JSON(fiber.Map{"message": "Event diupdate"})
}

func DeleteEvent(c *fiber.Ctx) error {
	config.DB.Delete(&models.CalendarEvent{}, paramID(c))
	return c.JSON(fiber.Map{"message": "Event dihapus"})
}

// ─── Download Raport Per Kelas (ZIP PDF) ──────────────────

func DownloadRaportClass(c *fiber.Ctx) error {
	classID, _ := strconv.ParseUint(c.Query("class_id"), 10, 64)
	semesterID, _ := strconv.ParseUint(c.Query("semester_id"), 10, 64)
	if classID == 0 || semesterID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "class_id dan semester_id wajib diisi"})
	}

	sid := schoolID(c)

	// Get school info
	var school models.School
	if sid > 0 {
		config.DB.First(&school, sid)
	} else {
		// superadmin: get school from class
		var cls models.Class
		config.DB.First(&cls, classID)
		sid = cls.SchoolID
		config.DB.First(&school, sid)
	}

	// Get semester
	var semester models.Semester
	config.DB.First(&semester, semesterID)

	// Get class
	var class models.Class
	config.DB.First(&class, classID)

	// Get all raports for this class + semester
	var raports []models.Raport
	rq := config.DB.Joins("JOIN students ON students.id = raports.student_id").
		Where("students.class_id = ? AND raports.semester_id = ?", classID, semesterID)
	if sid > 0 {
		rq = rq.Where("raports.school_id = ?", sid)
	}
	rq.Preload("Student.User").Preload("Student.Class").Preload("Semester").
		Preload("Items.Subject").Preload("Items.Teacher.User").
		Find(&raports)

	if len(raports) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Tidak ada raport untuk kelas ini"})
	}

	// Create temp dir
	tmpDir := fmt.Sprintf("/tmp/raport_%d_%d_%d", sid, classID, time.Now().Unix())
	os.MkdirAll(tmpDir, 0755)
	defer os.RemoveAll(tmpDir)

	// Logo path
	logoPath := ""
	if school.HeaderLogo != "" {
		// Convert relative path to absolute
		absLogo := "/root/smart-lms/backend" + school.HeaderLogo
		if _, err := os.Stat(absLogo); err == nil {
			logoPath = absLogo
		}
	}

	var pdfFiles []string

	for _, raport := range raports {
		studentName := "siswa"
		if raport.Student.User.Name != "" {
			studentName = raport.Student.User.Name
		}

		// Build HTML
		html := buildRaportHTML(raport, school, semester, logoPath)

		// Write HTML to temp file
		htmlFile := fmt.Sprintf("%s/%s.html", tmpDir, sanitizeFilename(studentName))
		os.WriteFile(htmlFile, []byte(html), 0644)

		// Convert to PDF
		pdfFile := fmt.Sprintf("%s/%s.pdf", tmpDir, sanitizeFilename(studentName))
		cmd := exec.Command("wkhtmltopdf",
			"--page-size", "A4",
			"--margin-top", "15mm",
			"--margin-bottom", "15mm",
			"--margin-left", "20mm",
			"--margin-right", "20mm",
			"--encoding", "UTF-8",
			"--enable-local-file-access",
			htmlFile, pdfFile)
		output, err := cmd.CombinedOutput()
		if err != nil {
			fmt.Printf("[RAPORT PDF ERROR] %s: %v\nOutput: %s\n", studentName, err, string(output))
			continue // skip failed ones
		}
		pdfFiles = append(pdfFiles, pdfFile)
	}

	if len(pdfFiles) == 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal generate PDF"})
	}

	// Create ZIP
	var zipBuf bytes.Buffer
	zipWriter := zip.NewWriter(&zipBuf)

	for _, pdfFile := range pdfFiles {
		data, err := os.ReadFile(pdfFile)
		if err != nil {
			continue
		}
		filename := pdfFile[len(tmpDir)+1:]
		w, _ := zipWriter.Create(filename)
		w.Write(data)
	}
	zipWriter.Close()

	// Send ZIP
	zipName := fmt.Sprintf("Raport_%s_%s.zip", sanitizeFilename(class.Name), semester.Name)
	c.Set("Content-Type", "application/zip")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", zipName))
	return c.Send(zipBuf.Bytes())
}

func sanitizeFilename(name string) string {
	result := ""
	for _, ch := range name {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' || ch == ' ' {
			result += string(ch)
		}
	}
	return result
}

func buildRaportHTML(raport models.Raport, school models.School, semester models.Semester, logoPath string) string {
	items := raport.Items
	studentName := raport.Student.User.Name
	className := ""
	if raport.Student.Class.Name != "" {
		className = raport.Student.Class.Name
	}

	// Calculate average
	var totalScore float64
	for _, item := range items {
		totalScore += item.Score
	}
	avgScore := float64(0)
	if len(items) > 0 {
		avgScore = math.Round((totalScore/float64(len(items)))*10) / 10
	}

	// Logo img tag
	logoTag := "LOGO"
	if logoPath != "" {
		logoTag = fmt.Sprintf(`<img src="file://%s" style="width:100%%;height:100%%;object-fit:contain;" />`, logoPath)
	}

	// Build items rows
	itemsHTML := ""
	for i, item := range items {
		subjectName := ""
		if item.Subject.Name != "" {
			subjectName = item.Subject.Name
		}
		itemsHTML += fmt.Sprintf(`<tr><td class="no">%d</td><td>%s</td><td class="c">%.0f</td><td class="c">%s</td><td class="c">%s</td></tr>`,
			i+1, subjectName, item.Score, item.Grade, item.KB)
	}

	// Rank handling
	rank := 0
	if raport.Rank != nil {
		rank = *raport.Rank
	}

	// Attendance (simplified - just placeholders since we'd need extra queries)
	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Raport %s</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Times New Roman', serif; padding: 30px 40px; font-size: 11pt; color: #000; }
@page { size: A4; margin: 15mm 20mm; }
.kop { display: flex; align-items: center; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 5px; }
.kop-logo { width: 70px; height: 70px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #999; margin-right: 15px; flex-shrink: 0; }
.kop-logo img { width: 100%%; height: 100%%; object-fit: contain; }
.kop-text { text-align: center; flex: 1; }
.kop-text .instansi { font-size: 10pt; letter-spacing: 1px; }
.kop-text .sekolah { font-size: 16pt; font-weight: bold; letter-spacing: 2px; }
.kop-text .alamat { font-size: 9pt; margin-top: 2px; }
.kop-text .kontak { font-size: 9pt; }
.kop-line2 { border-top: 1px solid #000; margin-top: 2px; }
.judul { text-align: center; margin: 20px 0 15px; }
.judul h2 { font-size: 14pt; text-decoration: underline; letter-spacing: 1px; }
.judul p { font-size: 10pt; margin-top: 3px; }
.data-siswa { margin-bottom: 15px; }
.data-siswa table { width: 100%%; }
.data-siswa td { padding: 2px 0; vertical-align: top; }
.data-siswa .label { width: 130px; }
.data-siswa .sep { width: 15px; }
table.nilai { width: 100%%; border-collapse: collapse; margin-bottom: 15px; }
table.nilai th, table.nilai td { border: 1px solid #000; padding: 5px 8px; }
table.nilai th { background: #f5f5f5; font-weight: bold; text-align: center; font-size: 10pt; }
table.nilai td.c { text-align: center; }
table.nilai td.no { width: 35px; text-align: center; }
table.nilai tfoot td { font-weight: bold; }
.catatan { border: 1px solid #000; padding: 10px; min-height: 50px; margin-bottom: 20px; font-style: italic; }
</style></head><body>

<div class="kop">
  <div class="kop-logo">%s</div>
  <div class="kop-text">
    <div class="instansi">%s</div>
    <div class="sekolah">%s</div>
    <div class="alamat">%s</div>
    <div class="kontak">%s</div>
  </div>
</div>
<div class="kop-line2"></div>

<div class="judul">
  <h2>LAPORAN HASIL BELAJAR</h2>
  <p>Tahun Pelajaran %s — Semester %s</p>
</div>

<div class="data-siswa">
  <table>
    <tr><td class="label">Nama Peserta Didik</td><td class="sep">:</td><td><strong>%s</strong></td></tr>
    <tr><td class="label">Kelas</td><td class="sep">:</td><td>%s</td></tr>
    <tr><td class="label">NIS / NISN</td><td class="sep">:</td><td>%s / %s</td></tr>
    <tr><td class="label">Peringkat</td><td class="sep">:</td><td><strong>%d</strong></td></tr>
  </table>
</div>

<table class="nilai">
  <thead><tr><th>No</th><th>Mata Pelajaran</th><th>Nilai</th><th>Grade</th><th>KB</th></tr></thead>
  <tbody>%s</tbody>
  <tfoot><tr><td colspan="2" style="text-align:center">Rata-rata</td><td class="c">%.1f</td><td colspan="2"></td></tr></tfoot>
</table>

<div class="catatan">%s</div>

</body></html>`,
		studentName,
		logoTag,
		school.HeaderText,
		school.Name,
		school.Address,
		buildKontak(school),
		semester.Year,
		semesterPeriod(semester.Period),
		studentName,
		className,
		raport.Student.NIS,
		raport.Student.NISN,
		rank,
		itemsHTML,
		avgScore,
		raportNotes(raport.Notes),
	)

	return html
}

func buildKontak(school models.School) string {
	kontak := ""
	if school.Phone != "" {
		kontak += "Telp. " + school.Phone
	}
	if school.Email != "" {
		if kontak != "" {
			kontak += " | "
		}
		kontak += "Email: " + school.Email
	}
	return kontak
}

func semesterPeriod(period string) string {
	if period == "ganjil" {
		return "Ganjil (I)"
	}
	return "Genap (II)"
}

func raportNotes(notes string) string {
	if notes == "" {
		return "Terus tingkatkan prestasi belajar."
	}
	return notes
}
