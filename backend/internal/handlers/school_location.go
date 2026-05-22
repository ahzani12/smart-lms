package handlers

import (
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

// GetSchoolLocation — admin/guru lihat config lokasi sekolah.
// Public ke semua user yang login (frontend butuh untuk ngecek apakah GPSRequired).
func GetSchoolLocation(c *fiber.Ctx) error {
	var school models.School
	if err := config.DB.First(&school, schoolID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Sekolah tidak ditemukan"})
	}
	return c.JSON(fiber.Map{
		"latitude":               school.Latitude,
		"longitude":              school.Longitude,
		"attendance_radius_m":    school.AttendanceRadiusM,
		"gps_required":           school.GPSRequired,
		"gps_max_accuracy_m":     school.GPSMaxAccuracyM,
		"gps_max_location_age_s": school.GPSMaxLocationAgeS,
	})
}

// UpdateSchoolLocation — admin set koordinat sekolah & toggle GPS.
func UpdateSchoolLocation(c *fiber.Ctx) error {
	var req struct {
		Latitude            *float64 `json:"latitude"`
		Longitude           *float64 `json:"longitude"`
		AttendanceRadiusM   *int     `json:"attendance_radius_m"`
		GPSRequired         *bool    `json:"gps_required"`
		GPSMaxAccuracyM     *int     `json:"gps_max_accuracy_m"`
		GPSMaxLocationAgeS  *int     `json:"gps_max_location_age_s"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	updates := map[string]interface{}{}
	if req.Latitude != nil {
		updates["latitude"] = *req.Latitude
	}
	if req.Longitude != nil {
		updates["longitude"] = *req.Longitude
	}
	if req.AttendanceRadiusM != nil {
		r := *req.AttendanceRadiusM
		if r < 20 {
			r = 20
		}
		if r > 1000 {
			r = 1000
		}
		updates["attendance_radius_m"] = r
	}
	if req.GPSRequired != nil {
		updates["gps_required"] = *req.GPSRequired
	}
	if req.GPSMaxAccuracyM != nil {
		v := *req.GPSMaxAccuracyM
		if v < 20 {
			v = 20
		}
		if v > 500 {
			v = 500
		}
		updates["gps_max_accuracy_m"] = v
	}
	if req.GPSMaxLocationAgeS != nil {
		v := *req.GPSMaxLocationAgeS
		if v < 10 {
			v = 10
		}
		if v > 300 {
			v = 300
		}
		updates["gps_max_location_age_s"] = v
	}

	// Validasi: kalau GPSRequired = true, lat/lng harus sudah di-set
	if v, ok := updates["gps_required"].(bool); ok && v {
		var school models.School
		config.DB.First(&school, schoolID(c))
		hasLat := school.Latitude != nil
		hasLng := school.Longitude != nil
		if newLat, ok := updates["latitude"].(float64); ok {
			hasLat = true
			_ = newLat
		}
		if newLng, ok := updates["longitude"].(float64); ok {
			hasLng = true
			_ = newLng
		}
		if !hasLat || !hasLng {
			return c.Status(400).JSON(fiber.Map{
				"error": "Set koordinat sekolah dulu sebelum mengaktifkan GPS wajib",
			})
		}
	}

	if err := config.DB.Model(&models.School{}).Where("id = ?", schoolID(c)).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal update: " + err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Lokasi sekolah berhasil diupdate"})
}

// GetTeacherLocationLogs — admin lihat audit trail (suspect fake GPS).
// Query: ?days=7 (default 7 hari)
func GetTeacherLocationLogs(c *fiber.Ctx) error {
	days := c.QueryInt("days", 7)
	if days < 1 || days > 365 {
		days = 7
	}

	var logs []models.TeacherLocationLog
	q := config.DB.Where("school_id = ?", schoolID(c)).
		Where("created_at > ?", time.Now().AddDate(0, 0, -days)).
		Order("created_at desc").
		Limit(500)

	if onlyRejected := c.Query("only_rejected"); onlyRejected == "true" {
		q = q.Where("allowed = ?", false)
	}
	if userID := c.Query("user_id"); userID != "" {
		q = q.Where("user_id = ?", userID)
	}

	q.Find(&logs)

	// Enrich dengan nama user
	type enrichedLog struct {
		models.TeacherLocationLog
		UserName string `json:"user_name"`
	}
	result := make([]enrichedLog, 0, len(logs))
	for _, l := range logs {
		var user models.User
		config.DB.Select("name").First(&user, l.UserID)
		result = append(result, enrichedLog{TeacherLocationLog: l, UserName: user.Name})
	}

	// Stats summary
	since := time.Now().AddDate(0, 0, -days)
	var totalAllowed, totalRejected int64
	config.DB.Model(&models.TeacherLocationLog{}).
		Where("school_id = ? AND created_at > ? AND allowed = ?", schoolID(c), since, true).
		Count(&totalAllowed)
	config.DB.Model(&models.TeacherLocationLog{}).
		Where("school_id = ? AND created_at > ? AND allowed = ?", schoolID(c), since, false).
		Count(&totalRejected)

	return c.JSON(fiber.Map{
		"logs":           result,
		"total_allowed":  totalAllowed,
		"total_rejected": totalRejected,
		"days":           days,
	})
}
