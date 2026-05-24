package main

import (
	"context"
	"log"
	"os"

	"smart-lms/internal/config"
	"smart-lms/internal/middleware"
	"smart-lms/internal/models"
	"smart-lms/internal/notifications"
	"smart-lms/internal/routes"

	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	// Set timezone to WIB
	os.Setenv("TZ", "Asia/Jakarta")

	// Load config
	config.Load()

	// Connect database
	config.ConnectDB()

	// Auto migrate
	models.AutoMigrate(config.DB)

	// Seed default data
	models.SeedData(config.DB)

	// Demo data — opt-in via env: SEED_DEMO=1
	if os.Getenv("SEED_DEMO") == "1" {
		models.SeedDemo(config.DB)
	}

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "Smart LMS",
		BodyLimit:    50 * 1024 * 1024, // 50MB for file uploads
		ErrorHandler: middleware.ErrorHandler,
	})

	// Middleware
	app.Use(logger.New())
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowMethods:     "GET,POST,PUT,DELETE,PATCH,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: false,
	}))

	// ─── Global rate limit: 200 req/menit per IP ───
	// Defense in depth: kalau attacker bypass nginx (lewat 127.0.0.1 atau langsung
	// hit :8085), tetap dibatasi di backend.
	// Key pakai X-Forwarded-For (set oleh nginx) → ke remote IP asli.
	app.Use(limiter.New(limiter.Config{
		Max:        200,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			if xff := c.Get("X-Forwarded-For"); xff != "" {
				return xff
			}
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(429).JSON(fiber.Map{
				"error":   "Terlalu banyak request. Coba lagi nanti.",
				"code":    "RATE_LIMIT_EXCEEDED",
				"retryIn": "60s",
			})
		},
		SkipFailedRequests:     false,
		SkipSuccessfulRequests: false,
	}))

	// ─── Strict rate limit untuk login/auth: 5 attempts per menit ───
	authLimiter := limiter.New(limiter.Config{
		Max:        5,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			if xff := c.Get("X-Forwarded-For"); xff != "" {
				return "auth:" + xff
			}
			return "auth:" + c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(429).JSON(fiber.Map{
				"error":   "Terlalu banyak percobaan login. Tunggu 1 menit.",
				"code":    "AUTH_RATE_LIMIT",
				"retryIn": "60s",
			})
		},
	})

	// Static files for uploads
	app.Static("/uploads", "./uploads")

	// Apply auth limiter ke endpoint login & register
	app.Post("/api/auth/login", authLimiter)
	app.Post("/api/auth/register", authLimiter)

	// API routes
	routes.Setup(app)


	// ─── Notification worker (background goroutine) ─────────────
	// Poll queue tiap 30s, kirim notif WA/Telegram per sekolah.
	// NoopNotifier dipakai kalau sekolah belum aktifkan (zero overhead).
	notifWorker := notifications.NewWorker(config.DB)
	notifWorker.Start(context.Background())

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}
	log.Printf("🎓 Smart LMS running on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
