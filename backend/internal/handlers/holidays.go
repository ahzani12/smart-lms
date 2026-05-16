package handlers

import (
	"smart-lms/internal/config"
	"smart-lms/internal/models"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Data Libur Nasional Indonesia 2026 (berdasarkan SKB Menteri)
var liburNasional2026 = []struct {
	Title     string
	StartDate string
	EndDate   string
}{
	{"Tahun Baru Masehi", "2026-01-01", "2026-01-01"},
	{"Isra Mi'raj Nabi Muhammad SAW", "2026-02-08", "2026-02-08"},
	{"Tahun Baru Imlek", "2026-02-17", "2026-02-17"},
	{"Hari Raya Nyepi", "2026-03-19", "2026-03-19"},
	{"Wafat Isa Al-Masih", "2026-04-03", "2026-04-03"},
	{"Hari Raya Idul Fitri 1447H", "2026-03-20", "2026-03-21"},
	{"Cuti Bersama Idul Fitri", "2026-03-22", "2026-03-25"},
	{"Hari Buruh Internasional", "2026-05-01", "2026-05-01"},
	{"Kenaikan Isa Al-Masih", "2026-05-14", "2026-05-14"},
	{"Hari Raya Waisak", "2026-05-24", "2026-05-24"},
	{"Hari Lahir Pancasila", "2026-06-01", "2026-06-01"},
	{"Idul Adha 1447H", "2026-05-27", "2026-05-27"},
	{"Tahun Baru Islam 1448H", "2026-06-17", "2026-06-17"},
	{"Hari Kemerdekaan RI", "2026-08-17", "2026-08-17"},
	{"Maulid Nabi Muhammad SAW", "2026-08-27", "2026-08-27"},
	{"Hari Natal", "2026-12-25", "2026-12-25"},
}

// SyncLiburNasional — admin klik untuk import libur nasional ke kalender sekolah
func SyncLiburNasional(c *fiber.Ctx) error {
	sid := schoolID(c)
	year := c.Query("year", "2026")

	if year != "2026" {
		return c.Status(400).JSON(fiber.Map{"error": "Data libur nasional hanya tersedia untuk tahun 2026"})
	}

	added := 0
	skipped := 0

	for _, lib := range liburNasional2026 {
		startDate, _ := time.Parse("2006-01-02", lib.StartDate)
		endDate, _ := time.Parse("2006-01-02", lib.EndDate)

		// Cek apakah sudah ada event dengan judul & tanggal sama
		var count int64
		config.DB.Model(&models.CalendarEvent{}).
			Where("school_id = ? AND title = ? AND start_date = ?", sid, lib.Title, startDate).
			Count(&count)

		if count > 0 {
			skipped++
			continue
		}

		event := models.CalendarEvent{
			Title:     lib.Title,
			Type:      "libur",
			StartDate: startDate,
			EndDate:   endDate,
			Color:     "#10b981",
			SchoolID:  sid,
		}
		config.DB.Create(&event)
		added++
	}

	return c.JSON(fiber.Map{
		"message": "Sync libur nasional selesai",
		"added":   added,
		"skipped": skipped,
		"total":   len(liburNasional2026),
	})
}

// GetLiburNasional — return raw data libur nasional (tanpa perlu sync)
func GetLiburNasional(c *fiber.Ctx) error {
	type LiburItem struct {
		Title     string `json:"title"`
		StartDate string `json:"start_date"`
		EndDate   string `json:"end_date"`
	}
	var result []LiburItem
	for _, lib := range liburNasional2026 {
		result = append(result, LiburItem{
			Title:     lib.Title,
			StartDate: lib.StartDate,
			EndDate:   lib.EndDate,
		})
	}
	return c.JSON(result)
}
