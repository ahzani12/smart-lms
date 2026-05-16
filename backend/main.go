package main

import (
	"log"
	"os"

	"smart-lms/internal/config"
	"smart-lms/internal/middleware"
	"smart-lms/internal/models"
	"smart-lms/internal/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
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

	// Static files for uploads
	app.Static("/uploads", "./uploads")

	// API routes
	routes.Setup(app)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}
	log.Printf("🎓 Smart LMS running on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
