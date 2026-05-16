package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ─── ChatGPT OAuth (PKCE) ────────────────────────────────

const (
	openaiClientID = "app_EMoamEEZ73f0CkXaXp7hrann"
	openaiAuthURL  = "https://auth.openai.com/oauth/authorize"
	openaiTokenURL = "https://auth.openai.com/oauth/token"
	openaiScopes   = "openid profile email offline_access api.connectors.read api.connectors.invoke"
)

// In-memory PKCE state store (short-lived, keyed by state param)
type oauthState struct {
	CodeVerifier string
	SchoolID     uint
	CreatedAt    time.Time
}

var (
	oauthStates   = make(map[string]*oauthState)
	oauthStatesMu sync.Mutex
)

func generateRandomBase64URL(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func generatePKCE() (verifier, challenge string) {
	verifier = generateRandomBase64URL(32)
	h := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(h[:])
	return
}

// OAuthChatGPTStart initiates the OAuth flow — returns the authorize URL for the frontend to redirect to
func OAuthChatGPTStart(c *fiber.Ctx) error {
	sid := schoolID(c)

	verifier, challenge := generatePKCE()
	state := generateRandomBase64URL(32)

	oauthStatesMu.Lock()
	oauthStates[state] = &oauthState{
		CodeVerifier: verifier,
		SchoolID:     sid,
		CreatedAt:    time.Now(),
	}
	oauthStatesMu.Unlock()

	// Build callback URL based on request host
	scheme := "http"
	if c.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := c.Get("X-Forwarded-Host")
	if host == "" {
		host = c.Hostname()
	}
	callbackURL := fmt.Sprintf("%s://%s/api/ai/oauth/chatgpt/callback", scheme, host)

	params := url.Values{
		"client_id":             {openaiClientID},
		"response_type":        {"code"},
		"redirect_uri":         {callbackURL},
		"scope":                {openaiScopes},
		"state":                {state},
		"code_challenge":       {challenge},
		"code_challenge_method": {"S256"},
		"id_token_add_organizations": {"true"},
		"codex_cli_simplified_flow":  {"true"},
		"originator":           {"codex_cli_rs"},
	}

	authorizeURL := openaiAuthURL + "?" + params.Encode()
	return c.JSON(fiber.Map{"url": authorizeURL})
}

// OAuthChatGPTCallback handles the redirect from OpenAI after user authorizes
func OAuthChatGPTCallback(c *fiber.Ctx) error {
	code := c.Query("code")
	state := c.Query("state")

	if code == "" || state == "" {
		return c.Status(400).SendString("Missing code or state parameter")
	}

	// Lookup state
	oauthStatesMu.Lock()
	st, ok := oauthStates[state]
	if ok {
		delete(oauthStates, state)
	}
	oauthStatesMu.Unlock()

	if !ok {
		return c.Status(400).SendString("Invalid or expired state")
	}

	// Check expiry (5 min)
	if time.Since(st.CreatedAt) > 5*time.Minute {
		return c.Status(400).SendString("OAuth state expired")
	}

	// Build callback URL (same as start)
	scheme := "http"
	if c.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := c.Get("X-Forwarded-Host")
	if host == "" {
		host = c.Hostname()
	}
	callbackURL := fmt.Sprintf("%s://%s/api/ai/oauth/chatgpt/callback", scheme, host)

	// Exchange code for token
	data := url.Values{
		"grant_type":    {"authorization_code"},
		"client_id":     {openaiClientID},
		"code":          {code},
		"redirect_uri":  {callbackURL},
		"code_verifier": {st.CodeVerifier},
	}

	req, _ := http.NewRequest("POST", openaiTokenURL, strings.NewReader(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "codex-cli/1.0.18 (external, cli)")
	req.Header.Set("Originator", "codex_cli_rs")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.Status(502).SendString("Failed to exchange token: " + err.Error())
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		// Show error page
		return c.Status(resp.StatusCode).SendString(fmt.Sprintf(
			"<html><body><h2>OAuth Error</h2><p>OpenAI returned %d</p><pre>%s</pre><p><a href='/'>Kembali</a></p></body></html>",
			resp.StatusCode, string(body)))
	}

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		IDToken      string `json:"id_token"`
		Scope        string `json:"scope"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return c.Status(500).SendString("Failed to parse token response")
	}

	// Save or update AI config
	var existing models.AIConfig
	result := config.DB.Where("school_id = ? AND auth_type = ?", st.SchoolID, "chatgpt_session").First(&existing)
	if result.Error == nil {
		// Update existing
		existing.SessionToken = tokenResp.AccessToken
		existing.APIKey = tokenResp.RefreshToken // store refresh token in api_key field
		existing.UpdatedAt = time.Now()
		config.DB.Save(&existing)
	} else {
		// Create new
		cfg := models.AIConfig{
			Name:         "ChatGPT (OAuth)",
			AuthType:     "chatgpt_session",
			Model:        "auto",
			SessionToken: tokenResp.AccessToken,
			APIKey:       tokenResp.RefreshToken, // refresh token
			Active:       false,
			SchoolID:     st.SchoolID,
		}
		config.DB.Create(&cfg)
	}

	// Return success HTML page that auto-closes
	return c.Type("html").SendString(`
<!DOCTYPE html>
<html>
<head><title>ChatGPT Connected</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px">
  <h2 style="color:#10b981">✓ ChatGPT Berhasil Terhubung!</h2>
  <p>Token tersimpan. Anda bisa menutup tab ini.</p>
  <script>setTimeout(()=>window.close(), 2000)</script>
</body>
</html>`)
}

// RefreshChatGPTToken refreshes an expired ChatGPT OAuth token using the stored refresh_token
func RefreshChatGPTToken(cfgID uint) error {
	var cfg models.AIConfig
	if err := config.DB.First(&cfg, cfgID).Error; err != nil {
		return err
	}
	if cfg.APIKey == "" {
		return fmt.Errorf("no refresh token stored")
	}

	data := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {cfg.APIKey},
		"client_id":     {openaiClientID},
		"scope":         {openaiScopes},
	}

	req, _ := http.NewRequest("POST", openaiTokenURL, strings.NewReader(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "codex-cli/1.0.18 (external, cli)")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("refresh failed (%d): %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return err
	}

	cfg.SessionToken = tokenResp.AccessToken
	if tokenResp.RefreshToken != "" {
		cfg.APIKey = tokenResp.RefreshToken
	}
	cfg.UpdatedAt = time.Now()
	return config.DB.Save(&cfg).Error
}

// Cleanup expired states periodically (call from init or goroutine)
func init() {
	go func() {
		for {
			time.Sleep(10 * time.Minute)
			oauthStatesMu.Lock()
			for k, v := range oauthStates {
				if time.Since(v.CreatedAt) > 10*time.Minute {
					delete(oauthStates, k)
				}
			}
			oauthStatesMu.Unlock()
		}
	}()
}
