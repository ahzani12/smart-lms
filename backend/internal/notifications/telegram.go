package notifications

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// TelegramNotifier — Telegram Bot API.
// Free 100% selamanya, gak ada banned risk.
//
// Setup:
//   1. Buat bot via @BotFather di Telegram → dapet bot token
//   2. Token format: 123456789:AAEhBOweik6ad6PsWvMzHFCCjOu5Mtp7eQI
//   3. Ortu chat dulu ke bot (ketik /start) → backend ambil chat_id dari update
//      ATAU ortu kirim chat_id manual ke admin
//   4. Recipient = chat_id (bukan nomor WA)
//
// Endpoint: GET https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=X&text=...
type TelegramNotifier struct {
	BotToken string
	Client   *http.Client
}

func NewTelegramNotifier(botToken string) *TelegramNotifier {
	return &TelegramNotifier{
		BotToken: botToken,
		Client:   &http.Client{Timeout: 15 * time.Second},
	}
}

func (t *TelegramNotifier) Name() string { return "telegram" }

func (t *TelegramNotifier) Send(to, message string) (string, error) {
	if t.BotToken == "" {
		return "", fmt.Errorf("telegram: bot token kosong")
	}
	if to == "" {
		return "", fmt.Errorf("telegram: chat_id kosong")
	}

	endpoint := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", t.BotToken)
	form := url.Values{}
	form.Set("chat_id", to)
	form.Set("text", message)
	form.Set("parse_mode", "HTML")

	resp, err := t.Client.PostForm(endpoint, form)
	if err != nil {
		return "", fmt.Errorf("telegram: http error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
		Result      struct {
			MessageID int `json:"message_id"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("telegram: parse: %w (raw: %s)", err, string(body))
	}
	if !result.OK {
		return "", fmt.Errorf("telegram: %s", result.Description)
	}
	return fmt.Sprintf("%d", result.Result.MessageID), nil
}
