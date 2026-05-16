package handlers

import (
	"smart-lms/internal/config"
	"smart-lms/internal/models"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ─── SUPERADMIN: Global AI Config ─────────────────────────

func SuperGetAIConfigs(c *fiber.Ctx) error {
	var configs []models.AIConfig
	config.DB.Where("is_global = ?", true).Order("id DESC").Find(&configs)
	// Mask API keys
	for i := range configs {
		if len(configs[i].APIKey) > 8 {
			configs[i].APIKey = configs[i].APIKey[:4] + "****" + configs[i].APIKey[len(configs[i].APIKey)-4:]
		}
	}
	return c.JSON(configs)
}

func SuperCreateAIConfig(c *fiber.Ctx) error {
	var ai models.AIConfig
	if err := c.BodyParser(&ai); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	ai.IsGlobal = true
	ai.SchoolID = 0
	config.DB.Create(&ai)
	return c.Status(201).JSON(fiber.Map{"message": "AI Config global berhasil dibuat", "id": ai.ID})
}

func SuperUpdateAIConfig(c *fiber.Ctx) error {
	id := paramID(c)
	var ai models.AIConfig
	if err := config.DB.First(&ai, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Config tidak ditemukan"})
	}
	var req struct {
		Name     string `json:"name"`
		AuthType string `json:"auth_type"`
		BaseURL  string `json:"base_url"`
		APIKey   string `json:"api_key"`
		Model    string `json:"model"`
		Active   *bool  `json:"active"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Name != "" {
		ai.Name = req.Name
	}
	if req.AuthType != "" {
		ai.AuthType = req.AuthType
	}
	if req.BaseURL != "" {
		ai.BaseURL = req.BaseURL
	}
	if req.APIKey != "" {
		ai.APIKey = req.APIKey
	}
	if req.Model != "" {
		ai.Model = req.Model
	}
	if req.Active != nil {
		ai.Active = *req.Active
	}
	config.DB.Save(&ai)
	return c.JSON(fiber.Map{"message": "AI Config diupdate"})
}

func SuperDeleteAIConfig(c *fiber.Ctx) error {
	config.DB.Delete(&models.AIConfig{}, paramID(c))
	return c.JSON(fiber.Map{"message": "AI Config dihapus"})
}

// ─── SUPERADMIN: AI Quota per School ──────────────────────

func SuperGetAIQuotas(c *fiber.Ctx) error {
	var quotas []models.AIQuota
	config.DB.Preload("School").Order("school_id").Find(&quotas)
	return c.JSON(quotas)
}

func SuperSetAIQuota(c *fiber.Ctx) error {
	var req struct {
		SchoolID     uint `json:"school_id"`
		MonthlyLimit int  `json:"monthly_limit"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.SchoolID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "school_id wajib"})
	}

	var quota models.AIQuota
	result := config.DB.Where("school_id = ?", req.SchoolID).First(&quota)
	if result.Error != nil {
		// Create new
		quota = models.AIQuota{
			SchoolID:     req.SchoolID,
			MonthlyLimit: req.MonthlyLimit,
			UsedThisMonth: 0,
			ResetAt:      nextMonthStart(),
		}
		config.DB.Create(&quota)
	} else {
		quota.MonthlyLimit = req.MonthlyLimit
		config.DB.Save(&quota)
	}
	return c.JSON(fiber.Map{"message": "Quota diupdate", "quota": quota})
}

func SuperResetQuota(c *fiber.Ctx) error {
	schoolID := paramID(c)
	config.DB.Model(&models.AIQuota{}).Where("school_id = ?", schoolID).Update("used_this_month", 0)
	return c.JSON(fiber.Map{"message": "Quota direset"})
}

// ─── SCHOOL: AI Config (override / view) ──────────────────

func GetSchoolAIConfig(c *fiber.Ctx) error {
	sid := schoolID(c)

	// Get school-specific config
	var schoolConfigs []models.AIConfig
	config.DB.Where("school_id = ? AND is_global = ?", sid, false).Find(&schoolConfigs)

	// Get global configs
	var globalConfigs []models.AIConfig
	config.DB.Where("is_global = ? AND active = ?", true, true).Find(&globalConfigs)

	// Get quota
	var quota models.AIQuota
	config.DB.Where("school_id = ?", sid).First(&quota)

	// Mask keys
	for i := range schoolConfigs {
		if len(schoolConfigs[i].APIKey) > 8 {
			schoolConfigs[i].APIKey = schoolConfigs[i].APIKey[:4] + "****" + schoolConfigs[i].APIKey[len(schoolConfigs[i].APIKey)-4:]
		}
	}
	for i := range globalConfigs {
		if len(globalConfigs[i].APIKey) > 8 {
			globalConfigs[i].APIKey = globalConfigs[i].APIKey[:4] + "****" + globalConfigs[i].APIKey[len(globalConfigs[i].APIKey)-4:]
		}
	}

	return c.JSON(fiber.Map{
		"school_configs": schoolConfigs,
		"global_configs": globalConfigs,
		"quota":          quota,
	})
}

func SaveSchoolAIConfig(c *fiber.Ctx) error {
	sid := schoolID(c)
	var ai models.AIConfig
	if err := c.BodyParser(&ai); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	ai.SchoolID = sid
	ai.IsGlobal = false

	if ai.ID != 0 {
		// Update existing
		var existing models.AIConfig
		if err := config.DB.Where("id = ? AND school_id = ?", ai.ID, sid).First(&existing).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Config tidak ditemukan"})
		}
		existing.Name = ai.Name
		existing.AuthType = ai.AuthType
		existing.BaseURL = ai.BaseURL
		if ai.APIKey != "" {
			existing.APIKey = ai.APIKey
		}
		existing.Model = ai.Model
		existing.Active = ai.Active
		config.DB.Save(&existing)
		return c.JSON(fiber.Map{"message": "Config diupdate"})
	}

	config.DB.Create(&ai)
	return c.Status(201).JSON(fiber.Map{"message": "Config ditambahkan", "id": ai.ID})
}

func DeleteSchoolAIConfig(c *fiber.Ctx) error {
	sid := schoolID(c)
	id := paramID(c)
	config.DB.Where("id = ? AND school_id = ? AND is_global = ?", id, sid, false).Delete(&models.AIConfig{})
	return c.JSON(fiber.Map{"message": "Config dihapus"})
}

// ─── Resolve AI Config (used by AI Hub) ───────────────────

func ResolveAIConfig(c *fiber.Ctx) error {
	sid := schoolID(c)

	// Check quota first
	var quota models.AIQuota
	if err := config.DB.Where("school_id = ?", sid).First(&quota).Error; err == nil {
		// Auto-reset if past reset date
		if time.Now().After(quota.ResetAt) {
			quota.UsedThisMonth = 0
			quota.ResetAt = nextMonthStart()
			config.DB.Save(&quota)
		}
		if quota.UsedThisMonth >= quota.MonthlyLimit {
			return c.Status(429).JSON(fiber.Map{"error": "Quota AI bulan ini habis", "used": quota.UsedThisMonth, "limit": quota.MonthlyLimit})
		}
	}

	// Priority: school active config > global active config
	var ai models.AIConfig
	result := config.DB.Where("school_id = ? AND active = ? AND is_global = ?", sid, true, false).First(&ai)
	if result.Error != nil {
		// Fallback to global
		result = config.DB.Where("is_global = ? AND active = ?", true, true).First(&ai)
		if result.Error != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Belum ada AI config aktif. Hubungi admin."})
		}
	}

	return c.JSON(fiber.Map{
		"provider": ai.Name,
		"base_url": ai.BaseURL,
		"model":    ai.Model,
		"auth_type": ai.AuthType,
	})
}

// Increment quota usage
func IncrementAIUsage(c *fiber.Ctx) error {
	sid := schoolID(c)
	config.DB.Model(&models.AIQuota{}).Where("school_id = ?", sid).Update("used_this_month", config.DB.Raw("used_this_month + 1"))
	return c.JSON(fiber.Map{"message": "OK"})
}

func nextMonthStart() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location())
}
