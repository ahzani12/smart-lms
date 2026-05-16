package config

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Load() {
	required := []string{"DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"}
	for _, k := range required {
		if os.Getenv(k) == "" {
			log.Printf("⚠️  %s not set, using defaults", k)
		}
	}
}

func ConnectDB() {
	host := getEnv("DB_HOST", "localhost")
	user := getEnv("DB_USER", "smart_lms_admin")
	pass := getEnv("DB_PASSWORD", "smart123")
	name := getEnv("DB_NAME", "smart_lms")
	port := getEnv("DB_PORT", "5432")
	sslmode := getEnv("DB_SSLMODE", "disable")

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=Asia/Jakarta",
		host, user, pass, name, port, sslmode,
	)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("❌ Failed to connect database: %v", err)
	}

	log.Println("✅ Database connected")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
