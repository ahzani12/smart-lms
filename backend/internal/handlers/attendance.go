package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"
	"smart-lms/internal/notifications"
	"smart-lms/internal/utils"

	"github.com/gofiber/fiber/v2"
)

// ═══════════════════════════════════════════════════════════
// SCHEDULE (Jadwal Pelajaran) — dibuat sekali di awal semester
// ═══════════════════════════════════════════════════════════

func GetSchedules(c *fiber.Ctx) error {
	var schedules []models.Schedule
	q := config.DB.Where("school_id = ?", schoolID(c))
	if classID := c.Query("class_id"); classID != "" {
		q = q.Where("class_id = ?", classID)
	}
	if teacherID := c.Query("teacher_id"); teacherID != "" {
		q = q.Where("teacher_id = ?", teacherID)
	}
	if day := c.Query("day"); day != "" {
		q = q.Where("day_of_week = ?", day)
	}
	if semID := c.Query("semester_id"); semID != "" {
		q = q.Where("semester_id = ?", semID)
	}
	q.Preload("Class").Preload("Subject").Preload("Teacher.User").
		Order("day_of_week ASC, start_time ASC").Find(&schedules)
	return c.JSON(schedules)
}

func CreateSchedule(c *fiber.Ctx) error {
	var req models.Schedule
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	req.SchoolID = schoolID(c)
	if req.DayOfWeek < 1 || req.DayOfWeek > 7 {
		return c.Status(400).JSON(fiber.Map{"error": "day_of_week harus 1-7"})
	}
	if req.StartTime == "" || req.EndTime == "" {
		return c.Status(400).JSON(fiber.Map{"error": "start_time & end_time wajib"})
	}
	// Cek bentrok: guru yang sama, jam overlap, hari sama, semester sama
	var conflict int64
	config.DB.Model(&models.Schedule{}).
		Where("school_id = ? AND semester_id = ? AND day_of_week = ? AND teacher_id = ? AND NOT (end_time <= ? OR start_time >= ?)",
			req.SchoolID, req.SemesterID, req.DayOfWeek, req.TeacherID, req.StartTime, req.EndTime).
		Count(&conflict)
	if conflict > 0 {
		return c.Status(409).JSON(fiber.Map{"error": "Jadwal guru bentrok dengan yang ada"})
	}
	if err := config.DB.Create(&req).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(201).JSON(req)
}

func UpdateSchedule(c *fiber.Ctx) error {
	var s models.Schedule
	if err := config.DB.First(&s, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Jadwal tidak ditemukan"})
	}
	if err := c.BodyParser(&s); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	config.DB.Save(&s)
	return c.JSON(s)
}

func DeleteSchedule(c *fiber.Ctx) error {
	config.DB.Delete(&models.Schedule{}, paramID(c))
	return c.JSON(fiber.Map{"message": "Jadwal dihapus"})
}

// Ambil jadwal hari ini untuk guru login → tombol "Buka Absensi"
func GetMyTodaySchedules(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(uint)
	var teacher models.Teacher
	if err := config.DB.Where("user_id = ?", userID).First(&teacher).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Guru tidak ditemukan"})
	}
	today := time.Now()
	dow := int(today.Weekday())
	if dow == 0 {
		dow = 7
	}

	var schedules []models.Schedule
	config.DB.Where("school_id = ? AND teacher_id = ? AND day_of_week = ?", schoolID(c), teacher.ID, dow).
		Preload("Class").Preload("Subject").
		Order("start_time ASC").Find(&schedules)

	// Join dengan session yang udah dibuka hari ini
	type ScheduleWithSession struct {
		models.Schedule
		Session *models.AttendanceSession `json:"session"`
	}
	dateStr := today.Format("2006-01-02")
	result := make([]ScheduleWithSession, 0, len(schedules))
	for _, s := range schedules {
		sws := ScheduleWithSession{Schedule: s}
		var sess models.AttendanceSession
		if err := config.DB.Where("schedule_id = ? AND date = ?", s.ID, dateStr).First(&sess).Error; err == nil {
			sws.Session = &sess
		}
		result = append(result, sws)
	}
	return c.JSON(result)
}

// ═══════════════════════════════════════════════════════════
// ATTENDANCE SESSION — instance dari Schedule pada tanggal
// ═══════════════════════════════════════════════════════════

func OpenAttendanceSession(c *fiber.Ctx) error {
	var req struct {
		ScheduleID uint   `json:"schedule_id"`
		Date       string `json:"date"`   // "2026-05-11"
		Method     string `json:"method"` // manual | qr
		QRDuration int    `json:"qr_duration_minutes"`
		// Anti fake-GPS payload
		GPS *utils.GPSReading `json:"gps"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Method == "" {
		req.Method = "manual"
	}
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		date = time.Now().Truncate(24 * time.Hour)
	}

	// Cek hari libur
	sid := schoolID(c)
	if isHoliday, title := IsHoliday(sid, date); isHoliday {
		return c.Status(400).JSON(fiber.Map{"error": "Tidak bisa buka absensi — hari libur: " + title, "is_holiday": true, "holiday_title": title})
	}

	// Validasi: guru yang login harus pemilik jadwal
	userID := c.Locals("user_id").(uint)
	var teacher models.Teacher
	config.DB.Where("user_id = ?", userID).First(&teacher)

	var schedule models.Schedule
	if err := config.DB.First(&schedule, req.ScheduleID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Jadwal tidak ditemukan"})
	}
	if isGuru(c) && schedule.TeacherID != teacher.ID {
		return c.Status(403).JSON(fiber.Map{"error": "Jadwal ini bukan milik Anda"})
	}

	// ─── ANTI FAKE-GPS CHECK ───────────────────────────────────
	// Cuma di-enforce kalau:
	//   1. Sekolah set GPSRequired = true
	//   2. User adalah guru (admin bypass — bisa buka manual)
	var school models.School
	config.DB.First(&school, sid)

	if school.GPSRequired && isGuru(c) {
		if req.GPS == nil {
			return c.Status(400).JSON(fiber.Map{
				"error":  "Lokasi GPS wajib. Aktifkan GPS dan izinkan akses lokasi.",
				"gps_required": true,
				"reject_reason": "no_gps",
			})
		}

		radius := school.AttendanceRadiusM
		if radius <= 0 {
			radius = 150
		}
		maxAcc := school.GPSMaxAccuracyM
		if maxAcc <= 0 {
			maxAcc = 100
		}
		maxAge := school.GPSMaxLocationAgeS
		if maxAge <= 0 {
			maxAge = 60
		}

		validation := utils.ValidateGPS(*req.GPS, school.Latitude, school.Longitude, radius, maxAcc, maxAge)

		// Speed anomaly: bandingkan dengan log terakhir guru ini (last 1 jam)
		var lastLog models.TeacherLocationLog
		hourAgo := time.Now().Add(-1 * time.Hour)
		if err := config.DB.Where("user_id = ? AND created_at > ? AND allowed = ?", userID, hourAgo, true).
			Order("created_at desc").First(&lastLog).Error; err == nil {
			isAnomaly, speedKmh := utils.CheckSpeed(
				lastLog.Latitude, lastLog.Longitude, lastLog.CreatedAt,
				req.GPS.Latitude, req.GPS.Longitude, time.Now(), 200.0,
			)
			if isAnomaly {
				validation.Allowed = false
				validation.RejectReason = "speed"
				validation.Message = fmt.Sprintf("Pergerakan tidak wajar (%.0f km/jam). Coba lagi dalam beberapa menit.", speedKmh)
			}
		}

		// Audit log — selalu disimpan, baik allowed maupun reject
		_ = config.DB.Create(&models.TeacherLocationLog{
			SchoolID:     sid,
			UserID:       userID,
			ScheduleID:   &req.ScheduleID,
			Latitude:     req.GPS.Latitude,
			Longitude:    req.GPS.Longitude,
			AccuracyM:    req.GPS.AccuracyM,
			DistanceM:    validation.DistanceM,
			LocationAge:  validation.LocationAge,
			IPAddress:    c.IP(),
			UserAgent:    c.Get("User-Agent"),
			Action:       "open_session",
			Allowed:      validation.Allowed,
			RejectReason: validation.RejectReason,
		}).Error

		if !validation.Allowed {
			return c.Status(403).JSON(fiber.Map{
				"error":         validation.Message,
				"reject_reason": validation.RejectReason,
				"distance_m":    int(validation.DistanceM),
				"radius_m":      radius,
				"gps_required":  true,
			})
		}
	}
	// ─── END GPS CHECK ──────────────────────────────────────────

	// Cek sesi sudah pernah dibuka hari itu
	var existing models.AttendanceSession
	if err := config.DB.Where("schedule_id = ? AND date = ?", req.ScheduleID, date).First(&existing).Error; err == nil {
		return c.Status(200).JSON(existing)
	}

	sess := models.AttendanceSession{
		SchoolID:   schoolID(c),
		ScheduleID: req.ScheduleID,
		Date:       date,
		OpenedBy:   userID,
		OpenedAt:   time.Now(),
		Status:     "open",
		Method:     req.Method,
		QRToken:    generateToken(16), // always unique to avoid unique-index conflict
	}
	if req.Method == "qr" {
		minutes := req.QRDuration
		if minutes <= 0 {
			minutes = 10
		}
		exp := time.Now().Add(time.Duration(minutes) * time.Minute)
		sess.QRExpires = &exp
	}
	if err := config.DB.Create(&sess).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat sesi: " + err.Error()})
	}

	// Auto-generate Presence row "alfa" untuk semua siswa di kelas
	// (nanti di-update jadi hadir saat ditandai)
	defaultStatus := "hadir"
	if sess.Method == "qr" {
		defaultStatus = "alfa"
	}
	var students []models.Student
	config.DB.Where("class_id = ?", schedule.ClassID).Find(&students)
	for _, s := range students {
		if err := config.DB.Create(&models.Presence{
			SessionID: sess.ID,
			StudentID: s.ID,
			Status:    defaultStatus,
			MarkedBy:  "auto",
			MarkedAt:  time.Now(),
		}).Error; err != nil {
			fmt.Println("warn: create presence alfa:", err)
		}
	}

	config.DB.Preload("Schedule.Class").Preload("Schedule.Subject").First(&sess, sess.ID)
	return c.Status(201).JSON(sess)
}

func CloseAttendanceSession(c *fiber.Ctx) error {
	var sess models.AttendanceSession
	if err := config.DB.First(&sess, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Sesi tidak ditemukan"})
	}
	now := time.Now()
	sess.Status = "closed"
	sess.ClosedAt = &now
	config.DB.Save(&sess)
	return c.JSON(sess)
}

func GetAttendanceSession(c *fiber.Ctx) error {
	var sess models.AttendanceSession
	if err := config.DB.
		Preload("Schedule.Class").
		Preload("Schedule.Subject").
		Preload("Schedule.Teacher.User").
		Preload("Presences.Student.User").
		First(&sess, paramID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Sesi tidak ditemukan"})
	}
	return c.JSON(sess)
}

func ListAttendanceSessions(c *fiber.Ctx) error {
	var sessions []models.AttendanceSession
	q := config.DB.Where("school_id = ?", schoolID(c))
	if classID := c.Query("class_id"); classID != "" {
		q = q.Joins("JOIN schedules ON schedules.id = attendance_sessions.schedule_id").
			Where("schedules.class_id = ?", classID)
	}
	if date := c.Query("date"); date != "" {
		q = q.Where("date = ?", date)
	}
	if from := c.Query("from"); from != "" {
		q = q.Where("date >= ?", from)
	}
	if to := c.Query("to"); to != "" {
		q = q.Where("date <= ?", to)
	}
	q.Preload("Schedule.Class").Preload("Schedule.Subject").
		Order("date DESC, opened_at DESC").Limit(200).Find(&sessions)
	return c.JSON(sessions)
}

// ═══════════════════════════════════════════════════════════
// PRESENCE — tandai kehadiran siswa
// ═══════════════════════════════════════════════════════════

// Guru tandai manual: bulk update presences dalam 1 sesi
func MarkPresenceManual(c *fiber.Ctx) error {
	sessionID := paramID(c)
	var sess models.AttendanceSession
	if err := config.DB.First(&sess, sessionID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Sesi tidak ditemukan"})
	}
	if sess.Status == "closed" {
		return c.Status(400).JSON(fiber.Map{"error": "Sesi sudah ditutup"})
	}

	var req struct {
		Items []struct {
			StudentID uint   `json:"student_id"`
			Status    string `json:"status"`
			Note      string `json:"note"`
			LateMin   int    `json:"late_min"`
		} `json:"items"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	userID := c.Locals("user_id").(uint)
	validStatus := map[string]bool{"hadir": true, "izin": true, "sakit": true, "alfa": true, "terlambat": true}
	updated := 0
	for _, it := range req.Items {
		if !validStatus[it.Status] {
			continue
		}
		res := config.DB.Model(&models.Presence{}).
			Where("session_id = ? AND student_id = ?", sessionID, it.StudentID).
			Updates(map[string]interface{}{
				"status":        it.Status,
				"note":          it.Note,
				"late_min":      it.LateMin,
				"marked_at":     time.Now(),
				"marked_by":     "teacher",
				"marked_by_id":  userID,
				"ip_address":    c.IP(),
				"device":        string(c.Request().Header.UserAgent()),
			})
		if res.RowsAffected > 0 {
			updated++
			// Trigger notif ortu untuk alfa / terlambat (opsional, sekolah aktifkan sendiri)
			notifyAttendance(sess.SchoolID, it.StudentID, it.Status, it.LateMin)
		}
	}
	return c.JSON(fiber.Map{"updated": updated, "total": len(req.Items)})
}

// notifyAttendance — kirim notif WA ke ortu kalau status=alfa atau terlambat.
// No-op kalau:
//   - Sekolah belum aktifkan notifikasi
//   - Event "alfa"/"terlambat" toggle = false
//   - Ortu belum punya phone/chat_id di ParentAccess
//
// Pattern: silent fail. Notifikasi bukan critical path absensi.
func notifyAttendance(schoolID, studentID uint, status string, lateMin int) {
	var event string
	switch status {
	case "alfa":
		event = "alfa"
	case "terlambat":
		event = "terlambat"
	default:
		return // hadir/izin/sakit gak perlu notif
	}

	if !notifications.IsEventEnabled(config.DB, schoolID, event) {
		return
	}

	// Ambil data siswa + ortu
	var student models.Student
	if err := config.DB.Preload("User").Preload("Class").First(&student, studentID).Error; err != nil {
		return
	}

	// Cari ortu via ParentAccess (yang paling reliable — phone disimpan disitu)
	var pa models.ParentAccess
	if err := config.DB.Where("student_id = ? AND school_id = ?", studentID, schoolID).First(&pa).Error; err != nil || pa.Phone == "" {
		return
	}

	tanggal := time.Now().Format("02 Jan 2006")
	className := ""
	if student.Class.ID > 0 {
		className = student.Class.Name
	}

	var msg string
	if event == "alfa" {
		msg = "🔔 *Notifikasi Absensi*\n\n" +
			"Yth. Bapak/Ibu Wali " + pa.ParentName + ",\n\n" +
			"Putra/putri Anda *" + student.User.Name + "*"
		if className != "" {
			msg += " (" + className + ")"
		}
		msg += " hari ini *" + tanggal + "* tercatat *TIDAK HADIR (Alfa)*.\n\nMohon konfirmasi ke pihak sekolah."
	} else {
		msg = "⏰ *Notifikasi Keterlambatan*\n\n" +
			"Yth. Bapak/Ibu Wali " + pa.ParentName + ",\n\n" +
			"Putra/putri Anda *" + student.User.Name + "*"
		if className != "" {
			msg += " (" + className + ")"
		}
		msg += " hari ini *" + tanggal + "* terlambat masuk sekolah"
		if lateMin > 0 {
			msg += " (" + fmt.Sprintf("%d menit", lateMin) + ")"
		}
		msg += "."
	}

	_, _ = notifications.Enqueue(config.DB, notifications.Outbox{
		SchoolID:  schoolID,
		Event:     event,
		Recipient: pa.Phone,
		StudentID: &studentID,
		Message:   msg,
	})
}

// Siswa scan QR — self-mark hadir
func MarkPresenceSelfQR(c *fiber.Ctx) error {
	var req struct {
		Token string `json:"token"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var sess models.AttendanceSession
	if err := config.DB.Where("qr_token = ?", req.Token).First(&sess).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "QR tidak valid"})
	}
	if sess.Status == "closed" {
		return c.Status(400).JSON(fiber.Map{"error": "Sesi sudah ditutup"})
	}
	if sess.QRExpires != nil && time.Now().After(*sess.QRExpires) {
		return c.Status(400).JSON(fiber.Map{"error": "QR kadaluarsa"})
	}

	userID := c.Locals("user_id").(uint)
	var student models.Student
	if err := config.DB.Where("user_id = ?", userID).First(&student).Error; err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Hanya siswa yang bisa scan"})
	}

	// Cek student beneran di kelas jadwal ini
	var schedule models.Schedule
	config.DB.First(&schedule, sess.ScheduleID)
	if student.ClassID == nil || *student.ClassID != schedule.ClassID {
		return c.Status(403).JSON(fiber.Map{"error": "Anda bukan siswa kelas ini"})
	}

	// Hitung keterlambatan
	lateMin := 0
	status := "hadir"
	now := time.Now()
	jkStartStr := fmt.Sprintf("%s %s:00", sess.Date.Format("2006-01-02"), schedule.StartTime)
	if jkStart, err := time.ParseInLocation("2006-01-02 15:04:05", jkStartStr, time.Local); err == nil {
		if now.After(jkStart) {
			diff := int(now.Sub(jkStart).Minutes())
			if diff > 10 {
				status = "terlambat"
				lateMin = diff
			}
		}
	}

	res := config.DB.Model(&models.Presence{}).
		Where("session_id = ? AND student_id = ?", sess.ID, student.ID).
		Updates(map[string]interface{}{
			"status":       status,
			"marked_at":    now,
			"marked_by":    "self",
			"marked_by_id": userID,
			"late_min":     lateMin,
			"ip_address":   c.IP(),
			"device":       string(c.Request().Header.UserAgent()),
		})
	if res.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Anda tidak terdaftar di sesi ini"})
	}
	return c.JSON(fiber.Map{"status": status, "late_min": lateMin, "message": "Absensi tercatat"})
}

// ═══════════════════════════════════════════════════════════
// SUMMARY — 1 query GROUP BY (bukan N+1)
// ═══════════════════════════════════════════════════════════

func GetAttendanceSummary(c *fiber.Ctx) error {
	classID := c.Query("class_id")
	month := c.Query("month") // "2026-05"
	year := c.Query("year")
	subjectID := c.Query("subject_id")

	type Summary struct {
		StudentID  uint    `json:"student_id"`
		Name       string  `json:"name"`
		NIS        string  `json:"nis"`
		Hadir      int     `json:"hadir"`
		Terlambat  int     `json:"terlambat"`
		Sakit      int     `json:"sakit"`
		Izin       int     `json:"izin"`
		Alfa       int     `json:"alfa"`
		Total      int     `json:"total"`
		Persentase float64 `json:"persentase"`
	}

	q := config.DB.Table("presences p").
		Select(`p.student_id,
			users.name, students.nis,
			SUM(CASE WHEN p.status = 'hadir' THEN 1 ELSE 0 END) AS hadir,
			SUM(CASE WHEN p.status = 'terlambat' THEN 1 ELSE 0 END) AS terlambat,
			SUM(CASE WHEN p.status = 'sakit' THEN 1 ELSE 0 END) AS sakit,
			SUM(CASE WHEN p.status = 'izin' THEN 1 ELSE 0 END) AS izin,
			SUM(CASE WHEN p.status = 'alfa' THEN 1 ELSE 0 END) AS alfa,
			COUNT(*) AS total`).
		Joins("JOIN students ON students.id = p.student_id").
		Joins("JOIN users ON users.id = students.user_id").
		Joins("JOIN attendance_sessions s ON s.id = p.session_id").
		Joins("JOIN schedules sc ON sc.id = s.schedule_id").
		Where("s.school_id = ?", schoolID(c)).
		Group("p.student_id, users.name, students.nis").
		Order("users.name ASC")

	if classID != "" {
		q = q.Where("sc.class_id = ?", classID)
	}
	if subjectID != "" {
		q = q.Where("sc.subject_id = ?", subjectID)
	}
	if month != "" {
		q = q.Where("TO_CHAR(s.date, 'YYYY-MM') = ?", month)
	} else if year != "" {
		q = q.Where("EXTRACT(YEAR FROM s.date) = ?", year)
	}

	var rows []Summary
	q.Scan(&rows)
	for i := range rows {
		if rows[i].Total > 0 {
			rows[i].Persentase = float64(rows[i].Hadir+rows[i].Terlambat) / float64(rows[i].Total) * 100
		}
	}
	return c.JSON(rows)
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

func generateToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func isGuru(c *fiber.Ctx) bool {
	role, ok := c.Locals("role").(string)
	return ok && role == "guru"
}

// ═══════════════════════════════════════════════════════════
// TEACHER ATTENDANCE SUMMARY — derived from sessions opened
// ═══════════════════════════════════════════════════════════

func GetTeacherAttendanceSummary(c *fiber.Ctx) error {
	month := c.Query("month") // "2026-05"
	teacherID := c.Query("teacher_id")

	if month == "" {
		month = time.Now().Format("2006-01")
	}

	startDate, err := time.Parse("2006-01", month)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format bulan salah (YYYY-MM)"})
	}
	endDate := startDate.AddDate(0, 1, 0)

	type TeacherRow struct {
		TeacherID   uint    `json:"teacher_id"`
		TeacherName string  `json:"teacher_name"`
		NIP         string  `json:"nip"`
		TotalJadwal int     `json:"total_jadwal"`
		Hadir       int     `json:"hadir"`
		TidakHadir  int     `json:"tidak_hadir"`
		Persentase  float64 `json:"persentase"`
	}

	sid := schoolID(c)

	var teachers []models.Teacher
	q := config.DB.Where("school_id = ?", sid).Preload("User")
	if teacherID != "" {
		q = q.Where("id = ?", teacherID)
	}
	q.Find(&teachers)

	var results []TeacherRow
	for _, t := range teachers {
		var schedules []models.Schedule
		config.DB.Where("school_id = ? AND teacher_id = ?", sid, t.ID).Find(&schedules)

		if len(schedules) == 0 {
			continue
		}

		totalDays := 0
		hadirDays := 0

		for d := startDate; d.Before(endDate) && d.Before(time.Now().AddDate(0, 0, 1)); d = d.AddDate(0, 0, 1) {
			dow := int(d.Weekday())
			if dow == 0 {
				dow = 7
			}

			// Skip hari libur
			if isHol, _ := IsHoliday(sid, d); isHol {
				continue
			}

			hasSchedule := false
			var scheduleIDs []uint
			for _, s := range schedules {
				if s.DayOfWeek == dow {
					hasSchedule = true
					scheduleIDs = append(scheduleIDs, s.ID)
				}
			}

			if !hasSchedule {
				continue
			}

			totalDays++

			dateStr := d.Format("2006-01-02")
			var count int64
			config.DB.Model(&models.AttendanceSession{}).
				Where("schedule_id IN ? AND date = ?", scheduleIDs, dateStr).
				Count(&count)

			if count > 0 {
				hadirDays++
			}
		}

		persen := float64(0)
		if totalDays > 0 {
			persen = float64(hadirDays) / float64(totalDays) * 100
		}

		results = append(results, TeacherRow{
			TeacherID:   t.ID,
			TeacherName: t.User.Name,
			NIP:         t.NIP,
			TotalJadwal: totalDays,
			Hadir:       hadirDays,
			TidakHadir:  totalDays - hadirDays,
			Persentase:  persen,
		})
	}

	return c.JSON(results)
}
