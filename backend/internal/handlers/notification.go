package handlers

import (
	"encoding/json"
	"strings"

	"smart-lms/internal/config"
	"smart-lms/internal/models"
	"smart-lms/internal/notifications"

	"github.com/gofiber/fiber/v2"
)

// ─── NotificationConfig (per-sekolah) ─────────────────────────

// GetNotificationConfig: GET /api/notifications/config
// Mengembalikan config sekolah saat ini. Kalau belum ada, return template kosong
// (sehingga frontend bisa langsung edit + save tanpa perlu cek 404).
//
// API key dimasking: tampilkan 4 char depan + **** + 4 char belakang.
func GetNotificationConfig(c *fiber.Ctx) error {
	sid := schoolID(c)
	var cfg models.NotificationConfig
	err := config.DB.Where("school_id = ?", sid).First(&cfg).Error
	if err != nil {
		// Belum ada — kasih template default
		return c.JSON(fiber.Map{
			"school_id":     sid,
			"provider":      "none",
			"enabled":       false,
			"events":        defaultEventToggles(),
			"api_key_set":   false,
			"sender_number": "",
			"device_id":     "",
		})
	}

	events := map[string]bool{}
	if cfg.EventsJSON != "" {
		_ = json.Unmarshal([]byte(cfg.EventsJSON), &events)
	}
	// Merge dengan default keys biar frontend selalu dapet semua toggle
	for k, v := range defaultEventToggles() {
		if _, ok := events[k]; !ok {
			events[k] = v
		}
	}

	return c.JSON(fiber.Map{
		"id":            cfg.ID,
		"school_id":     cfg.SchoolID,
		"provider":      cfg.Provider,
		"enabled":       cfg.Enabled,
		"sender_number": cfg.SenderNumber,
		"device_id":     cfg.DeviceID,
		"api_key_set":   cfg.APIKey != "",
		"api_key_masked": maskKey(cfg.APIKey),
		"events":        events,
		"updated_at":    cfg.UpdatedAt,
	})
}

// UpsertNotificationConfig: PUT /api/notifications/config
// Body: { provider, api_key (optional, kosong = jangan ubah), device_id, sender_number, enabled, events: {alfa: true, ...} }
func UpsertNotificationConfig(c *fiber.Ctx) error {
	sid := schoolID(c)

	var in struct {
		Provider     string          `json:"provider"`
		APIKey       string          `json:"api_key"`
		DeviceID     string          `json:"device_id"`
		SenderNumber string          `json:"sender_number"`
		Enabled      bool            `json:"enabled"`
		Events       map[string]bool `json:"events"`
	}
	if err := c.BodyParser(&in); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	in.Provider = strings.ToLower(strings.TrimSpace(in.Provider))
	if !isValidProvider(in.Provider) {
		return c.Status(400).JSON(fiber.Map{"error": "Provider tidak valid (fonnte/wablas/telegram/none)"})
	}

	var cfg models.NotificationConfig
	err := config.DB.Where("school_id = ?", sid).First(&cfg).Error
	isNew := err != nil
	if isNew {
		cfg = models.NotificationConfig{SchoolID: sid}
	}

	cfg.Provider = in.Provider
	cfg.DeviceID = strings.TrimSpace(in.DeviceID)
	cfg.SenderNumber = strings.TrimSpace(in.SenderNumber)
	cfg.Enabled = in.Enabled

	// API key: hanya update kalau diisi (kosong = pertahankan yang lama)
	if strings.TrimSpace(in.APIKey) != "" {
		cfg.APIKey = strings.TrimSpace(in.APIKey)
	}

	// Events
	events := defaultEventToggles()
	for k, v := range in.Events {
		events[k] = v
	}
	if b, err := json.Marshal(events); err == nil {
		cfg.EventsJSON = string(b)
	}

	if isNew {
		if err := config.DB.Create(&cfg).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal simpan: " + err.Error()})
		}
	} else {
		if err := config.DB.Save(&cfg).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal update: " + err.Error()})
		}
	}

	return c.JSON(fiber.Map{
		"message":   "Konfigurasi notifikasi tersimpan",
		"id":        cfg.ID,
		"provider":  cfg.Provider,
		"enabled":   cfg.Enabled,
	})
}

// TestNotification: POST /api/notifications/test
// Body: { recipient: "08xxx" or chat_id, message: "..." }
// Kirim langsung (sync) untuk verifikasi credential bener atau enggak.
// BUKAN lewat queue — biar admin langsung tahu hasilnya.
func TestNotification(c *fiber.Ctx) error {
	sid := schoolID(c)

	var in struct {
		Recipient string `json:"recipient"`
		Message   string `json:"message"`
	}
	if err := c.BodyParser(&in); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}
	if in.Recipient == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Nomor/chat_id penerima wajib"})
	}
	if in.Message == "" {
		in.Message = "🔔 Test notifikasi dari SSD — kalau pesan ini sampai, konfigurasi sudah benar."
	}

	notifier := notifications.GetNotifier(config.DB, sid)
	if notifier.Name() == "none" {
		return c.Status(400).JSON(fiber.Map{
			"error": "Notifikasi belum diaktifkan atau provider 'none'. Aktifkan dulu di Settings.",
		})
	}

	providerID, err := notifier.Send(in.Recipient, in.Message)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"success":  false,
			"provider": notifier.Name(),
			"error":    err.Error(),
		})
	}
	return c.JSON(fiber.Map{
		"success":     true,
		"provider":    notifier.Name(),
		"provider_id": providerID,
		"message":     "Test notifikasi berhasil dikirim",
	})
}

// ─── Queue / Riwayat ──────────────────────────────────────────

// ListNotifications: GET /api/notifications/queue?status=&event=&limit=&offset=
// Riwayat notifikasi sekolah (paginated).
func ListNotifications(c *fiber.Ctx) error {
	sid := schoolID(c)
	status := c.Query("status", "")
	event := c.Query("event", "")
	limit := c.QueryInt("limit", 50)
	offset := c.QueryInt("offset", 0)
	if limit > 200 {
		limit = 200
	}

	q := config.DB.Model(&models.NotificationQueue{}).Where("school_id = ?", sid)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if event != "" {
		q = q.Where("event = ?", event)
	}

	var total int64
	q.Count(&total)

	var rows []models.NotificationQueue
	q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&rows)

	// Statistik singkat — count per status
	var stats struct {
		Pending int64 `json:"pending"`
		Sending int64 `json:"sending"`
		Sent    int64 `json:"sent"`
		Failed  int64 `json:"failed"`
	}
	config.DB.Model(&models.NotificationQueue{}).Where("school_id = ? AND status = ?", sid, "pending").Count(&stats.Pending)
	config.DB.Model(&models.NotificationQueue{}).Where("school_id = ? AND status = ?", sid, "sending").Count(&stats.Sending)
	config.DB.Model(&models.NotificationQueue{}).Where("school_id = ? AND status = ?", sid, "sent").Count(&stats.Sent)
	config.DB.Model(&models.NotificationQueue{}).Where("school_id = ? AND status = ?", sid, "failed").Count(&stats.Failed)

	return c.JSON(fiber.Map{
		"data":   rows,
		"total":  total,
		"limit":  limit,
		"offset": offset,
		"stats":  stats,
	})
}

// RetryNotification: POST /api/notifications/queue/:id/retry
// Reset ke pending biar worker pickup lagi (untuk row yang status=failed).
func RetryNotification(c *fiber.Ctx) error {
	sid := schoolID(c)
	id := paramID(c)

	var q models.NotificationQueue
	if err := config.DB.Where("id = ? AND school_id = ?", id, sid).First(&q).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Notifikasi tidak ditemukan"})
	}

	q.Status = "pending"
	q.Retries = 0
	q.LastError = ""
	q.NextTryAt = nil
	config.DB.Save(&q)

	return c.JSON(fiber.Map{"message": "Akan dikirim ulang oleh worker", "id": q.ID})
}

// DeleteNotification: DELETE /api/notifications/queue/:id
func DeleteNotification(c *fiber.Ctx) error {
	sid := schoolID(c)
	id := paramID(c)

	res := config.DB.Where("id = ? AND school_id = ?", id, sid).Delete(&models.NotificationQueue{})
	if res.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": res.Error.Error()})
	}
	if res.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Notifikasi tidak ditemukan"})
	}
	return c.JSON(fiber.Map{"message": "Dihapus"})
}

// ─── Helpers ──────────────────────────────────────────────────

func defaultEventToggles() map[string]bool {
	return map[string]bool{
		"alfa":         false,
		"terlambat":    false,
		"nilai_keluar": false,
		"raport_siap":  false,
		"tagihan":      false,
		"lunas":        false,
		"pelanggaran":  false,
		"pengumuman":   false,
	}
}

func isValidProvider(p string) bool {
	switch p {
	case "fonnte", "wablas", "telegram", "none", "":
		return true
	}
	return false
}

func maskKey(k string) string {
	if len(k) < 12 {
		return strings.Repeat("*", len(k))
	}
	return k[:4] + strings.Repeat("*", 8) + k[len(k)-4:]
}
