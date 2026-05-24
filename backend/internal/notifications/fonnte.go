package notifications

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// FonnteNotifier — Fonnte WA gateway.
// Docs: https://docs.fonnte.com/
//
// Setup:
//   1. Daftar di fonnte.com
//   2. Connect device (scan QR pakai HP)
//   3. Copy "Token" dari device → masukin ke NotificationConfig.APIKey
//
// Endpoint: POST https://api.fonnte.com/send
// Headers:  Authorization: <token>
// Body:     { target: "08xxx", message: "halo", countryCode: "62" }
type FonnteNotifier struct {
	APIKey string
	Client *http.Client
}

func NewFonnteNotifier(apiKey string) *FonnteNotifier {
	return &FonnteNotifier{
		APIKey: apiKey,
		Client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (f *FonnteNotifier) Name() string { return "fonnte" }

func (f *FonnteNotifier) Send(to, message string) (string, error) {
	if f.APIKey == "" {
		return "", fmt.Errorf("fonnte: api key kosong")
	}

	// Normalisasi nomor: 08xxx → 628xxx (Fonnte accepts both, tapi 62-prefix lebih reliable)
	target := normalizePhone(to)

	payload := map[string]string{
		"target":      target,
		"message":     message,
		"countryCode": "62",
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", "https://api.fonnte.com/send", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("fonnte: build request: %w", err)
	}
	req.Header.Set("Authorization", f.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := f.Client.Do(req)
	if err != nil {
		return "", fmt.Errorf("fonnte: http error: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var result struct {
		Status   bool        `json:"status"`
		Reason   string      `json:"reason"`
		ID       interface{} `json:"id"` // can be string or array
		Detail   string      `json:"detail"`
		Process  string      `json:"process"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("fonnte: parse response: %w (raw: %s)", err, string(respBody))
	}

	if !result.Status {
		reason := result.Reason
		if reason == "" {
			reason = result.Detail
		}
		if reason == "" {
			reason = string(respBody)
		}
		return "", fmt.Errorf("fonnte: %s", reason)
	}

	// ID could be string "abc" or array ["abc"]
	providerID := ""
	switch v := result.ID.(type) {
	case string:
		providerID = v
	case []interface{}:
		if len(v) > 0 {
			providerID = fmt.Sprintf("%v", v[0])
		}
	}
	return providerID, nil
}

// normalizePhone converts Indonesian phone numbers to international format
// without the + prefix (Fonnte/Wablas standard).
//
//   "08123456789"   → "628123456789"
//   "+628123456789" → "628123456789"
//   "628123456789"  → "628123456789"
func normalizePhone(p string) string {
	p = strings.TrimSpace(p)
	p = strings.ReplaceAll(p, " ", "")
	p = strings.ReplaceAll(p, "-", "")
	p = strings.TrimPrefix(p, "+")
	if strings.HasPrefix(p, "0") {
		return "62" + p[1:]
	}
	return p
}
