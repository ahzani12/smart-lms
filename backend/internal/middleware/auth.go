package middleware

import (
	"os"
	"strings"
	"time"

	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret []byte

func init() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "smart-lms-jwt-secret-key-2025"
	}
	jwtSecret = []byte(secret)
}

type Claims struct {
	UserID   uint   `json:"user_id"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	SchoolID uint   `json:"school_id"`
	jwt.RegisteredClaims
}

func GenerateToken(user models.User) (string, error) {
	schoolID := uint(0)
	if user.SchoolID != nil {
		schoolID = *user.SchoolID
	}
	claims := Claims{
		UserID:   user.ID,
		Email:    user.Email,
		Role:     user.Role,
		SchoolID: schoolID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func AuthRequired(c *fiber.Ctx) error {
	auth := c.Get("Authorization")
	if auth == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Token required"})
	}

	tokenStr := strings.TrimPrefix(auth, "Bearer ")

	// Try structured claims first (normal user login)
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err == nil && token.Valid && claims.UserID > 0 {
		c.Locals("user_id", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("role", claims.Role)
		c.Locals("school_id", claims.SchoolID)
		return c.Next()
	}

	// Try map claims (parent access login)
	mapClaims := jwt.MapClaims{}
	token, err = jwt.ParseWithClaims(tokenStr, mapClaims, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
	}

	role, _ := mapClaims["role"].(string)
	schoolID := uint(0)
	if sid, ok := mapClaims["school_id"].(float64); ok {
		schoolID = uint(sid)
	}
	studentID := uint(0)
	if sid, ok := mapClaims["student_id"].(float64); ok {
		studentID = uint(sid)
	}

	c.Locals("user_id", uint(0))
	c.Locals("email", "")
	c.Locals("role", role)
	c.Locals("school_id", schoolID)
	c.Locals("student_id", studentID)
	return c.Next()
}

func RoleRequired(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role := c.Locals("role").(string)
		for _, r := range roles {
			if role == r {
				return c.Next()
			}
		}
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}
}

func ErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	return c.Status(code).JSON(fiber.Map{"error": err.Error()})
}
