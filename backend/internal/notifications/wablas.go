package notifications

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// WablasNotifier — Wablas WA gateway.
// Docs: https://wablas.com/api
//
// Setup:
//   1. Daftar di wablas.com
//   2. Connect device (scan QR)
//   3. Copy Token + Domain (e.g. "tegal.wablas.com")
//   4. APIKey = "Token.Domain" format atau cuma token + simpan domain di SenderNumber
//
// Endpoint: POST https://{domain}/api/send-message
// Body (form-urlencoded): phone=628xxx&message=halo&token=xxxxx
type WablasNotifier struct {
	APIKey   string // token
	DeviceID string // domain (e.g. "tegal.wablas.com" atau full URL)
	Client   *http.Client
}

func NewWablasNotifier(apiKey, deviceID string) *WablasNotifier {
	return &WablasNotifier{
		APIKey:   apiKey,
		DeviceID: deviceID,
		Client:   &http.Client{Timeout: 15 * time.Second},
	}
}

func (w *WablasNotifier) Name() string { return "wablas" }

func (w *WablasNotifier) Send(to, message string) (string, error) {
	if w.APIKey == "" {
		return "", fmt.Errorf("wablas: api key kosong")
	}

	// Default ke wablas.com kalau device_id kosong
	domain := strings.TrimSpace(w.DeviceID)
	if domain == "" {
		domain = "wablas.com"
	}
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimSuffix(domain, "/")

	endpoint := "https://" + domain + "/api/send-message"

	form := url.Values{}
	form.Set("phone", normalizePhone(to))
	form.Set("message", message)

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("wablas: build request: %w", err)
	}
	req.Header.Set("Authorization", w.APIKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := w.Client.Do(req)
	if err != nil {
		return "", fmt.Errorf("wablas: http error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Status  bool   `json:"status"`
		Message string `json:"message"`
		Data    struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("wablas: parse response: %w (raw: %s)", err, string(body))
	}

	if !result.Status {
		return "", fmt.Errorf("wablas: %s", result.Message)
	}

	return result.Data.ID, nil
}
