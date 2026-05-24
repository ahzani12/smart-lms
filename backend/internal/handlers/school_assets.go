package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/imageproc"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

// uploadAssetHandler — generic uploader untuk image asset sekolah.
//
//	formField : nama field di form-data ("logo" / "ttd" / "stempel")
//	subdir    : folder relatif ("logos" / "ttd" / "stempel")
//	column    : nama kolom DB di School ("logo_url" / "kepala_ttd" / dst)
//	transparent: kalau true, image diproses jadi PNG transparan (utk TTD & stempel scan)
func uploadAssetHandler(formField, subdir, column string, transparent bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		file, err := c.FormFile(formField)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "File tidak ditemukan: " + err.Error()})
		}

		// Validasi ekstensi
		ext := strings.ToLower(filepath.Ext(file.Filename))
		if ext != ".png" && ext != ".jpg" && ext != ".jpeg" {
			return c.Status(400).JSON(fiber.Map{"error": "Format harus PNG/JPG"})
		}
		// Max 5MB
		if file.Size > 5*1024*1024 {
			return c.Status(400).JSON(fiber.Map{"error": "Ukuran maks 5MB"})
		}

		sid := schoolID(c)
		dir := fmt.Sprintf("uploads/%s", subdir)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat folder: " + err.Error()})
		}

		ts := time.Now().Unix()
		rawPath := fmt.Sprintf("%s/%d_%d_raw%s", dir, sid, ts, ext)
		if err := c.SaveFile(file, rawPath); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan file: " + err.Error()})
		}

		finalPath := rawPath
		if transparent {
			// Hasil PNG transparan
			finalPath = fmt.Sprintf("%s/%d_%d.png", dir, sid, ts)
			// threshold 230 = pixel rata-rata RGB >= 230 dianggap putih → alpha 0
			// feather 35 = transisi halus di tepi
			if err := imageproc.MakeTransparent(rawPath, finalPath, 230, 35); err != nil {
				// Kalau gagal proses, fallback ke file asli (jangan blok user)
				finalPath = rawPath
			} else {
				// Hapus file raw kalau berhasil di-process
				_ = os.Remove(rawPath)
			}
		}

		// Update kolom School yg sesuai
		webPath := "/" + finalPath
		if err := config.DB.Model(&models.School{}).
			Where("id = ?", sid).
			Update(column, webPath).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal update DB: " + err.Error()})
		}

		return c.JSON(fiber.Map{
			"message":     "Upload berhasil",
			"path":        webPath,
			"transparent": transparent,
		})
	}
}

// UploadLogoSekolah → kop dokumen (PNG transparan auto-process)
func UploadLogoSekolah(c *fiber.Ctx) error {
	return uploadAssetHandler("logo", "logos", "logo_url", true)(c)
}

// UploadStempel → stempel sekolah (PNG transparan auto-process)
func UploadStempel(c *fiber.Ctx) error {
	return uploadAssetHandler("file", "stempel", "stempel_url", true)(c)
}

// UploadTTDKepala → tandatangan kepala sekolah
func UploadTTDKepala(c *fiber.Ctx) error {
	return uploadAssetHandler("file", "ttd", "kepala_ttd", true)(c)
}

// UploadTTDBendahara → tandatangan bendahara
func UploadTTDBendahara(c *fiber.Ctx) error {
	return uploadAssetHandler("file", "ttd", "bendahara_ttd", true)(c)
}

// GetSchoolDocAssets — return semua asset path untuk preview di FE
func GetSchoolDocAssets(c *fiber.Ctx) error {
	var s models.School
	if err := config.DB.First(&s, schoolID(c)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "School tidak ditemukan"})
	}
	return c.JSON(fiber.Map{
		"logo_url":         s.LogoURL,
		"stempel_url":      s.StempelURL,
		"kepala_ttd":       s.KepalaTTD,
		"kepala_name":      s.KepalaName,
		"kepala_nip":       s.KepalaNIP,
		"bendahara_ttd":    s.BendaharaTTD,
		"bendahara_name":   s.BendaharaName,
		"bendahara_nip":    s.BendaharaNIP,
		"yayasan_name":     s.YayasanName,
		"kabupaten":        s.Kabupaten,
		"kode_pos":         s.KodePos,
	})
}
