package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"smart-lms/internal/config"
	"smart-lms/internal/models"

	"github.com/gofiber/fiber/v2"
)

// ─── AI Config Management ─────────────────────────────────

func GetAIConfigs(c *fiber.Ctx) error {
	var configs []models.AIConfig
	config.DB.Where("school_id = ?", schoolID(c)).Find(&configs)
	// Mask API keys and session tokens
	for i := range configs {
		if len(configs[i].APIKey) > 8 {
			configs[i].APIKey = configs[i].APIKey[:4] + "****" + configs[i].APIKey[len(configs[i].APIKey)-4:]
		}
		if len(configs[i].SessionToken) > 10 {
			configs[i].SessionToken = configs[i].SessionToken[:6] + "****" + configs[i].SessionToken[len(configs[i].SessionToken)-4:]
		}
	}
	return c.JSON(configs)
}

func CreateAIConfig(c *fiber.Ctx) error {
	var cfg models.AIConfig
	if err := c.BodyParser(&cfg); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	cfg.SchoolID = schoolID(c)
	config.DB.Create(&cfg)
	return c.Status(201).JSON(fiber.Map{"message": "AI config dibuat", "id": cfg.ID})
}

func UpdateAIConfig(c *fiber.Ctx) error {
	var cfg models.AIConfig
	config.DB.First(&cfg, paramID(c))
	if err := c.BodyParser(&cfg); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	config.DB.Save(&cfg)
	return c.JSON(fiber.Map{"message": "AI config diupdate"})
}

func DeleteAIConfig(c *fiber.Ctx) error {
	config.DB.Delete(&models.AIConfig{}, paramID(c))
	return c.JSON(fiber.Map{"message": "AI config dihapus"})
}

func SetActiveAI(c *fiber.Ctx) error {
	id := paramID(c)
	config.DB.Model(&models.AIConfig{}).Where("school_id = ?", schoolID(c)).Update("active", false)
	config.DB.Model(&models.AIConfig{}).Where("id = ?", id).Update("active", true)
	return c.JSON(fiber.Map{"message": "AI config diaktifkan"})
}

// FetchAIModels calls {base_url}/models with the given API key and returns the
// list of models reported by the provider. Works with any OpenAI-compatible API
// (OpenAI, OpenRouter, Groq, Together, xAI, DeepSeek, local Ollama, etc).
func FetchAIModels(c *fiber.Ctx) error {
	var body struct {
		BaseURL string `json:"base_url"`
		APIKey  string `json:"api_key"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.BaseURL == "" {
		return c.Status(400).JSON(fiber.Map{"error": "base_url wajib diisi"})
	}
	url := strings.TrimRight(body.BaseURL, "/") + "/models"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if body.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+body.APIKey)
	}
	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": fmt.Sprintf("gagal konek ke provider: %v", err)})
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": fmt.Sprintf("provider error (%d): %s", resp.StatusCode, string(raw))})
	}
	// OpenAI-compatible shape: {"data":[{"id":"gpt-4o",...}, ...]}
	var parsed struct {
		Data []struct {
			ID      string `json:"id"`
			Object  string `json:"object"`
			OwnedBy string `json:"owned_by"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "respons provider tidak valid", "raw": string(raw)})
	}
	ids := make([]string, 0, len(parsed.Data))
	for _, m := range parsed.Data {
		if m.ID != "" {
			ids = append(ids, m.ID)
		}
	}
	sort.Strings(ids)
	return c.JSON(fiber.Map{"models": ids, "count": len(ids)})
}

// ─── AI API Call Helper ───────────────────────────────────

type AIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type AIRequest struct {
	Model       string      `json:"model"`
	Messages    []AIMessage `json:"messages"`
	MaxTokens   int         `json:"max_tokens"`
	Temperature float64     `json:"temperature"`
	Stream      bool        `json:"stream"` // must be false — some providers default to streaming
}

type AIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func callAI(schoolID uint, prompt string, maxTokens int) (string, error) {
	// Get active AI config
	var aiCfg models.AIConfig
	result := config.DB.Where("school_id = ? AND active = true", schoolID).First(&aiCfg)
	if result.Error != nil {
		// Fallback to env vars
		return callAIEnv(prompt, maxTokens)
	}

	// Route based on auth type
	if aiCfg.AuthType == "chatgpt_session" {
		return callChatGPTSession(aiCfg, prompt)
	}

	reqBody := AIRequest{
		Model: aiCfg.Model,
		Messages: []AIMessage{
			{Role: "user", Content: prompt},
		},
		MaxTokens:   maxTokens,
		Temperature: 0.7,
	}

	body, _ := json.Marshal(reqBody)
	client := &http.Client{Timeout: 120 * time.Second}
	req, err := http.NewRequest("POST", aiCfg.BaseURL+"/chat/completions", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+aiCfg.APIKey)

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("AI API error: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("AI API returned %d: %s", resp.StatusCode, string(respBody))
	}

	content := parseAIResponse(respBody)
	if content != "" {
		return content, nil
	}
	return "", fmt.Errorf("no response from AI")
}

// callChatGPTSession calls ChatGPT backend-api using session access_token (free, no API key needed)
func callChatGPTSession(cfg models.AIConfig, prompt string) (string, error) {
	model := cfg.Model
	if model == "" {
		model = "auto" // ChatGPT default
	}

	type chatGPTMsg struct {
		ID      string   `json:"id"`
		Author  struct {
			Role string `json:"role"`
		} `json:"author"`
		Content struct {
			ContentType string   `json:"content_type"`
			Parts       []string `json:"parts"`
		} `json:"content"`
	}

	msgID := fmt.Sprintf("%d", time.Now().UnixNano())
	reqPayload := map[string]interface{}{
		"action": "next",
		"messages": []map[string]interface{}{
			{
				"id":     msgID,
				"author": map[string]string{"role": "user"},
				"content": map[string]interface{}{
					"content_type": "text",
					"parts":        []string{prompt},
				},
			},
		},
		"model":                    model,
		"timezone_offset_id":       "Asia/Jakarta",
		"history_and_training_disabled": false,
	}

	body, _ := json.Marshal(reqPayload)
	client := &http.Client{Timeout: 180 * time.Second}
	req, err := http.NewRequest("POST", "https://chatgpt.com/backend-api/conversation", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.SessionToken)
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Origin", "https://chatgpt.com")
	req.Header.Set("Referer", "https://chatgpt.com/")
	req.Header.Set("Oai-Device-Id", fmt.Sprintf("%x-%x-%x-%x-%x", time.Now().UnixNano()&0xffffffff, time.Now().UnixNano()>>32&0xffff, 0x4000|time.Now().UnixNano()>>48&0x0fff, 0x8000|time.Now().UnixNano()>>60&0x3fff, time.Now().UnixNano()&0xffffffffffff))
	req.Header.Set("Oai-Language", "en-US")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ChatGPT API error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		// Try refresh token
		if err := RefreshChatGPTToken(cfg.ID); err != nil {
			return "", fmt.Errorf("ChatGPT session expired dan refresh gagal: %v", err)
		}
		// Reload config and retry once
		config.DB.First(&cfg, cfg.ID)
		req2, _ := http.NewRequest("POST", "https://chatgpt.com/backend-api/conversation", bytes.NewBuffer(body))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Authorization", "Bearer "+cfg.SessionToken)
		req2.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
		resp2, err2 := client.Do(req2)
		if err2 != nil {
			return "", fmt.Errorf("ChatGPT retry error: %v", err2)
		}
		defer resp2.Body.Close()
		if resp2.StatusCode != 200 {
			raw2, _ := io.ReadAll(resp2.Body)
			return "", fmt.Errorf("ChatGPT retry returned %d: %s", resp2.StatusCode, string(raw2))
		}
		resp = resp2
	}
	if resp.StatusCode != 200 {
		raw, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ChatGPT returned %d: %s", resp.StatusCode, string(raw))
	}

	// ChatGPT streams SSE lines: data: {...}\n\n
	// Last meaningful chunk has the full message
	raw, _ := io.ReadAll(resp.Body)
	var lastContent string
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")
		if payload == "[DONE]" || payload == "" {
			continue
		}
		var chunk struct {
			Message struct {
				Content struct {
					Parts []string `json:"parts"`
				} `json:"content"`
				Status string `json:"status"`
			} `json:"message"`
		}
		if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
			continue
		}
		if len(chunk.Message.Content.Parts) > 0 && chunk.Message.Content.Parts[0] != "" {
			lastContent = chunk.Message.Content.Parts[0]
		}
	}

	if lastContent != "" {
		return lastContent, nil
	}
	return "", fmt.Errorf("no response from ChatGPT")
}

// parseAIResponse handles both standard JSON and SSE (server-sent events)
// OpenAI-compatible responses. Some providers (esp. relays like One-API) always
// stream even when stream=false, so we reassemble chunks.
func parseAIResponse(respBody []byte) string {
	// Standard JSON path
	var aiResp AIResponse
	if err := json.Unmarshal(respBody, &aiResp); err == nil && len(aiResp.Choices) > 0 && aiResp.Choices[0].Message.Content != "" {
		return aiResp.Choices[0].Message.Content
	}
	// SSE path — lines of `data: {...}\n\n`
	var sb strings.Builder
	for _, line := range strings.Split(string(respBody), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "" || payload == "[DONE]" {
			continue
		}
		// SSE chunks use `delta` instead of `message`
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
			continue
		}
		for _, ch := range chunk.Choices {
			if ch.Delta.Content != "" {
				sb.WriteString(ch.Delta.Content)
			} else if ch.Message.Content != "" {
				sb.WriteString(ch.Message.Content)
			}
		}
	}
	return sb.String()
}

func callAIEnv(prompt string, maxTokens int) (string, error) {
	baseURL := os.Getenv("AI_BASE_URL")
	apiKey := os.Getenv("AI_API_KEY")
	model := os.Getenv("AI_MODEL")

	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	if model == "" {
		model = "gpt-4o"
	}

	reqBody := AIRequest{
		Model: model,
		Messages: []AIMessage{
			{Role: "user", Content: prompt},
		},
		MaxTokens:   maxTokens,
		Temperature: 0.7,
	}

	body, _ := json.Marshal(reqBody)
	client := &http.Client{Timeout: 120 * time.Second}
	req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("AI API error: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("AI API returned %d: %s", resp.StatusCode, string(respBody))
	}

	content := parseAIResponse(respBody)
	if content != "" {
		return content, nil
	}
	return "", fmt.Errorf("no response from AI")
}

// ─── AI Generate Soal ─────────────────────────────────────

// ─── AI Job Helpers ───────────────────────────────────────

// createJob inserts a new AIJob row and returns it.
func createJob(sid, userID uint, kind string, input interface{}) (*models.AIJob, error) {
	raw, _ := json.Marshal(input)
	job := models.AIJob{
		SchoolID: sid,
		UserID:   userID,
		Kind:     kind,
		Status:   "pending",
		Input:    string(raw),
	}
	if err := config.DB.Create(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func updateJob(id uint, patch map[string]interface{}) {
	patch["updated_at"] = time.Now()
	config.DB.Model(&models.AIJob{}).Where("id = ?", id).Updates(patch)
}

// GetAIJob returns the current status of a background AI job.
// Use this to poll from the frontend.
func GetAIJob(c *fiber.Ctx) error {
	var job models.AIJob
	if err := config.DB.Where("id = ? AND school_id = ?", paramID(c), schoolID(c)).First(&job).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Job tidak ditemukan"})
	}
	return c.JSON(job)
}

// ─── AI Generate Soal (async) ─────────────────────────────
//
// Generating questions with an LLM can take 20-120 seconds. We can't block
// an HTTP request that long — Nginx/Cloudflare proxies will cut it off and
// even if they don't, the user just sees a spinner and gets zero feedback.
//
// Pattern:
//   1. POST /ai/generate-questions creates a job row, spawns a goroutine,
//      and immediately returns 202 with {job_id}.
//   2. Goroutine calls the AI, parses, writes questions to DB, updates
//      the job row (status, progress, result, error).
//   3. Frontend polls GET /ai/jobs/:id every 2s until status=done/failed.

type GenerateQuestionsReq struct {
	Topic      string `json:"topic"`
	Subject    string `json:"subject"`
	SubjectID  uint   `json:"subject_id"`
	Level      string `json:"level"`
	Count      int    `json:"count"`
	Type       string `json:"type"`
	Difficulty string `json:"difficulty"`
	BankID     uint   `json:"bank_id"`
	TopicIDs   []uint `json:"topic_ids"`
}

func AIGenerateQuestions(c *fiber.Ctx) error {
	var req GenerateQuestionsReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Count == 0 {
		req.Count = 5
	}
	if req.Count > 50 {
		req.Count = 50
	}
	if req.Type == "" {
		req.Type = "pilihan_ganda"
	}
	if req.Difficulty == "" {
		req.Difficulty = "sedang"
	}

	sid := schoolID(c)
	userID := c.Locals("user_id").(uint)

	if req.BankID > 0 && (req.SubjectID == 0 || req.Level == "") {
		var bank models.QuestionBank
		config.DB.First(&bank, req.BankID)
		if req.SubjectID == 0 {
			req.SubjectID = bank.SubjectID
		}
		if req.Level == "" {
			req.Level = bank.Level
		}
		if req.Subject == "" && bank.SubjectID > 0 {
			var subj models.Subject
			config.DB.First(&subj, bank.SubjectID)
			req.Subject = subj.Name
		}
	}

	// Last-resort: look up subject by name if still zero (form only has text field)
	if req.SubjectID == 0 && req.Subject != "" {
		var subj models.Subject
		if err := config.DB.Where("school_id = ? AND LOWER(name) = LOWER(?)", sid, req.Subject).First(&subj).Error; err == nil {
			req.SubjectID = subj.ID
			if req.Level == "" {
				req.Level = subj.Level
			}
		}
	}
	if req.SubjectID == 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "Mata pelajaran tidak ditemukan. Pilih bank soal atau pastikan nama mapel sesuai dengan master data.",
		})
	}

	job, err := createJob(sid, userID, "generate_questions", req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat job: " + err.Error()})
	}

	go runGenerateQuestionsJob(job.ID, sid, userID, req)

	return c.Status(202).JSON(fiber.Map{
		"message": "Generate soal dimulai di background",
		"job_id":  job.ID,
	})
}

func runGenerateQuestionsJob(jobID, sid, userID uint, req GenerateQuestionsReq) {
	started := time.Now()
	updateJob(jobID, map[string]interface{}{
		"status":     "running",
		"progress":   5,
		"message":    "Menyiapkan prompt...",
		"started_at": &started,
	})

	defer func() {
		if r := recover(); r != nil {
			finished := time.Now()
			updateJob(jobID, map[string]interface{}{
				"status":      "failed",
				"error":       fmt.Sprintf("panic: %v", r),
				"finished_at": &finished,
			})
		}
	}()

	prompt := fmt.Sprintf(`Buatkan %d soal %s tentang "%s" untuk mata pelajaran %s.
Tingkat kesulitan: %s.

Format JSON array:
[
  {
    "type": "pilihan_ganda",
    "content": "Pertanyaan...",
    "options": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],
    "answer": "A",
    "explanation": "Pembahasan...",
    "points": 10
  }
]

Untuk soal essay, gunakan type "essay" dan kosongkan options, answer berisi kunci jawaban.
Hanya outputkan JSON array, tanpa teks tambahan.`, req.Count, req.Type, req.Topic, req.Subject, req.Difficulty)

	// Auto-scale max_tokens so long quizzes don't get cut off.
	// Empirically ~500 tokens per pilihan-ganda question, ~300 per essay.
	perQ := 500
	if req.Type == "essay" {
		perQ = 350
	}
	maxTokens := req.Count*perQ + 300
	if maxTokens < 1500 {
		maxTokens = 1500
	}
	if maxTokens > 16000 {
		maxTokens = 16000
	}

	updateJob(jobID, map[string]interface{}{
		"progress": 15,
		"message":  fmt.Sprintf("Memanggil AI (max %d tokens)...", maxTokens),
	})

	type aiQuestion struct {
		Type        string          `json:"type"`
		Content     string          `json:"content"`
		Options     json.RawMessage `json:"options"`
		Answer      string          `json:"answer"`
		Explanation string          `json:"explanation"`
		Points      int             `json:"points"`
	}

	// Up to 2 attempts: if first parse fails, retry once with a stricter prompt.
	var aiQuestions []aiQuestion
	var lastRaw string
	var lastErr error
	for attempt := 1; attempt <= 2; attempt++ {
		pr := prompt
		if attempt == 2 {
			pr = "PENTING: respon HANYA JSON array valid, tanpa teks lain, tanpa markdown.\n\n" + prompt
			updateJob(jobID, map[string]interface{}{
				"progress": 40,
				"message":  "Attempt 1 gagal parse, coba ulang dengan prompt lebih ketat...",
			})
		}
		resp, err := callAI(sid, pr, maxTokens)
		if err != nil {
			lastErr = err
			continue
		}
		lastRaw = resp
		jsonStr := extractJSON(resp)
		if err := json.Unmarshal([]byte(jsonStr), &aiQuestions); err == nil && len(aiQuestions) > 0 {
			lastErr = nil
			break
		} else {
			lastErr = fmt.Errorf("parse error: %v", err)
		}
	}
	if lastErr != nil && len(aiQuestions) == 0 {
		finished := time.Now()
		raw := lastRaw
		if len(raw) > 2000 {
			raw = raw[:2000] + "...(truncated)"
		}
		updateJob(jobID, map[string]interface{}{
			"status":      "failed",
			"error":       "Gagal parse response AI: " + lastErr.Error() + "\n\nRaw response:\n" + raw,
			"finished_at": &finished,
			"progress":    100,
		})
		return
	}

	updateJob(jobID, map[string]interface{}{
		"progress": 70,
		"message":  fmt.Sprintf("Menyimpan %d soal ke database...", len(aiQuestions)),
	})

	questions := make([]models.Question, 0, len(aiQuestions))
	for _, aq := range aiQuestions {
		optStr := ""
		if len(aq.Options) > 0 && string(aq.Options) != "null" {
			optStr = string(aq.Options)
		}
		questions = append(questions, models.Question{
			Type:        aq.Type,
			Content:     aq.Content,
			Options:     optStr,
			Answer:      aq.Answer,
			Explanation: aq.Explanation,
			Points:      aq.Points,
		})
	}

	var teacher models.Teacher
	config.DB.Where("user_id = ?", userID).First(&teacher)
	for i := range questions {
		q := &questions[i]
		q.SchoolID = sid
		q.SubjectID = req.SubjectID
		q.Level = req.Level
		q.AuthorID = teacher.ID
		q.Difficulty = req.Difficulty
		q.Visibility = "private"
		q.CurrentVersion = 1
		if q.Points == 0 {
			q.Points = 10
		}
	}

	if len(questions) > 0 {
		if err := config.DB.Create(&questions).Error; err != nil {
			finished := time.Now()
			updateJob(jobID, map[string]interface{}{
				"status":      "failed",
				"error":       "Gagal simpan soal: " + err.Error(),
				"finished_at": &finished,
				"progress":    100,
			})
			return
		}

		if len(req.TopicIDs) > 0 {
			var topics []models.Topic
			config.DB.Where("id IN ? AND school_id = ?", req.TopicIDs, sid).Find(&topics)
			for _, q := range questions {
				config.DB.Model(&q).Association("Topics").Replace(topics)
			}
		}

		if req.BankID > 0 {
			for _, q := range questions {
				addQuestionToBank(req.BankID, q.ID, userID)
			}
		}

		for _, q := range questions {
			snapshotVersion(q, userID, "AI generated")
		}
	}

	resultJSON, _ := json.Marshal(map[string]interface{}{
		"message":   fmt.Sprintf("%d soal berhasil digenerate", len(questions)),
		"questions": questions,
	})
	finished := time.Now()
	updateJob(jobID, map[string]interface{}{
		"status":      "done",
		"progress":    100,
		"message":     fmt.Sprintf("Selesai — %d soal dibuat", len(questions)),
		"result":      string(resultJSON),
		"finished_at": &finished,
	})
}

// ─── AI Koreksi Esai ──────────────────────────────────────

func AIGradeEssay(c *fiber.Ctx) error {
	var req struct {
		ExamAttemptID uint `json:"exam_attempt_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var answers []models.ExamAnswer
	config.DB.Where("exam_attempt_id = ? AND is_correct IS NULL", req.ExamAttemptID).
		Preload("Question").Find(&answers)

	graded := 0
	for _, ans := range answers {
		if ans.Question.Type != "essay" {
			continue
		}

		prompt := fmt.Sprintf(`Nilai jawaban esai berikut berdasarkan kunci jawaban.

PERTANYAAN: %s

KUNCI JAWABAN: %s

JAWABAN SISWA: %s

Beri penilaian dalam format JSON:
{
  "score": 0-10,
  "feedback": "Feedback singkat untuk siswa"
}

Nilai berdasarkan: kesesuaian dengan kunci, kelengkapan, dan pemahaman. Hanya outputkan JSON.`, 
			ans.Question.Content, ans.Question.Answer, ans.Answer)

		response, err := callAI(schoolID(c), prompt, 500)
		if err != nil {
			continue
		}

		jsonStr := extractJSON(response)
		var result struct {
			Score    float64 `json:"score"`
			Feedback string  `json:"feedback"`
		}
		if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
			continue
		}

		// Scale to question points
		scaledScore := result.Score / 10 * float64(ans.Question.Points)
		ans.AIScore = &scaledScore
		ans.AIFeedback = result.Feedback
		ans.Score = &scaledScore
		correct := scaledScore >= float64(ans.Question.Points)*0.6
		ans.IsCorrect = &correct
		config.DB.Save(&ans)
		graded++
	}

	// Recalculate total score
	if graded > 0 {
		var attempt models.ExamAttempt
		config.DB.First(&attempt, req.ExamAttemptID)
		var totalScore, totalPoints float64
		var allAnswers []models.ExamAnswer
		config.DB.Where("exam_attempt_id = ?", req.ExamAttemptID).Preload("Question").Find(&allAnswers)
		for _, a := range allAnswers {
			totalPoints += float64(a.Question.Points)
			if a.Score != nil {
				totalScore += *a.Score
			}
		}
		if totalPoints > 0 {
			final := totalScore / totalPoints * 100
			attempt.Score = &final
			attempt.Status = "graded"
			config.DB.Save(&attempt)
		}
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("%d soal esai berhasil dikoreksi AI", graded),
		"graded":  graded,
	})
}

// ─── AI Generate RPP ──────────────────────────────────────

type GenerateRPPReq struct {
	Subject   string `json:"subject"`
	Class     string `json:"class"`
	Topic     string `json:"topic"`
	Kurikulum string `json:"kurikulum"`
	Duration  string `json:"duration"`
}

func AIGenerateRPP(c *fiber.Ctx) error {
	var req GenerateRPPReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Subject == "" || req.Topic == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Mata pelajaran dan topik wajib diisi"})
	}
	if req.Kurikulum == "" {
		req.Kurikulum = "Kurikulum Merdeka"
	}
	if req.Duration == "" {
		req.Duration = "2 x 45 menit"
	}

	sid := schoolID(c)
	userID := c.Locals("user_id").(uint)
	job, err := createJob(sid, userID, "generate_rpp", req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat job: " + err.Error()})
	}

	go runGenerateRPPJob(job.ID, sid, req)

	return c.Status(202).JSON(fiber.Map{
		"job_id":  job.ID,
		"message": "Generate RPP dimulai di background",
	})
}

func runGenerateRPPJob(jobID uint, sid uint, req GenerateRPPReq) {
	defer func() {
		if r := recover(); r != nil {
			updateJob(jobID, map[string]interface{}{
				"status": "failed",
				"error":  fmt.Sprintf("panic: %v", r),
			})
		}
	}()

	updateJob(jobID, map[string]interface{}{
		"status":   "running",
		"progress": 15,
		"message":  "Memanggil AI untuk generate RPP...",
	})

	prompt := fmt.Sprintf(`Buatkan RPP (Rencana Pelaksanaan Pembelajaran) lengkap dengan format berikut:

Mata Pelajaran: %s
Kelas: %s
Topik: %s
Kurikulum: %s
Alokasi Waktu: %s

Buatkan RPP lengkap yang mencakup:
1. Identifikasi (mata pelajaran, kelas, alokasi waktu, dll)
2. Kompetensi Awal
3. Indikator Pencapaian Kompetensi
4. Tujuan Pembelajaran
5. Materi Pembelajaran
6. Pendekatan/Model Pembelajaran
7. Langkah-langkah Pembelajaran (Pendahuluan, Kegiatan Inti, Penutup)
8. Penilaian (Pengetahuan, Kinerja, Sikap)
9. Lembar Kerja Peserta Didik (jika ada)

Format dalam JSON dengan struktur yang jelas dan terorganisir.`, req.Subject, req.Class, req.Topic, req.Kurikulum, req.Duration)

	response, err := callAI(sid, prompt, 4000)
	if err != nil {
		updateJob(jobID, map[string]interface{}{
			"status": "failed",
			"error":  "AI error: " + err.Error(),
		})
		return
	}

	resultJSON, _ := json.Marshal(fiber.Map{
		"message": "RPP berhasil digenerate",
		"rpp":     response,
	})
	now := time.Now()
	updateJob(jobID, map[string]interface{}{
		"status":      "done",
		"progress":    100,
		"message":     "RPP selesai digenerate",
		"result":      string(resultJSON),
		"finished_at": &now,
	})
}

// ─── AI Generate Prota & Promes ───────────────────────────

type GenerateProtaReq struct {
	Subject   string `json:"subject"`
	Class     string `json:"class"`
	Kurikulum string `json:"kurikulum"`
	Tahun     string `json:"tahun"`
}

func AIGenerateProtaPromes(c *fiber.Ctx) error {
	var req GenerateProtaReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Subject == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Mata pelajaran wajib diisi"})
	}
	if req.Kurikulum == "" {
		req.Kurikulum = "Kurikulum Merdeka"
	}
	if req.Tahun == "" {
		req.Tahun = fmt.Sprintf("%d/%d", time.Now().Year(), time.Now().Year()+1)
	}

	sid := schoolID(c)
	userID := c.Locals("user_id").(uint)
	job, err := createJob(sid, userID, "generate_prota", req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat job: " + err.Error()})
	}

	go runGenerateProtaJob(job.ID, sid, req)

	return c.Status(202).JSON(fiber.Map{
		"job_id":  job.ID,
		"message": "Generate Prota & Promes dimulai di background",
	})
}

func runGenerateProtaJob(jobID uint, sid uint, req GenerateProtaReq) {
	defer func() {
		if r := recover(); r != nil {
			updateJob(jobID, map[string]interface{}{
				"status": "failed",
				"error":  fmt.Sprintf("panic: %v", r),
			})
		}
	}()

	updateJob(jobID, map[string]interface{}{
		"status":   "running",
		"progress": 15,
		"message":  "Memanggil AI untuk generate Prota & Promes...",
	})

	prompt := fmt.Sprintf(`Buatkan Program Tahunan (Prota) dan Program Semester (Promes) untuk:

Mata Pelajaran: %s
Kelas: %s
Kurikulum: %s
Tahun Ajaran: %s

Buatkan:
1. PROGRAM TAHUNAN: Pembagian materi per semester dengan alokasi waktu
2. PROGRAM SEMESTER GANJIL: Minggu per minggu dengan topik, KD/CP, dan kegiatan
3. PROGRAM SEMESTER GENAP: Minggu per minggu dengan topik, KD/CP, dan kegiatan

Format dalam JSON yang terstruktur dengan baik.`, req.Subject, req.Class, req.Kurikulum, req.Tahun)

	response, err := callAI(sid, prompt, 6000)
	if err != nil {
		updateJob(jobID, map[string]interface{}{
			"status": "failed",
			"error":  "AI error: " + err.Error(),
		})
		return
	}

	resultJSON, _ := json.Marshal(fiber.Map{
		"message": "Prota & Promes berhasil digenerate",
		"data":    response,
	})
	now := time.Now()
	updateJob(jobID, map[string]interface{}{
		"status":      "done",
		"progress":    100,
		"message":     "Prota & Promes selesai digenerate",
		"result":      string(resultJSON),
		"finished_at": &now,
	})
}

// ─── Helper: Extract JSON from AI response ────────────────

func extractJSON(s string) string {
	// Remove markdown code blocks
	if strings.Contains(s, "```json") {
		start := strings.Index(s, "```json") + 7
		end := strings.Index(s[start:], "```")
		if end > 0 {
			s = strings.TrimSpace(s[start : start+end])
		}
	} else if strings.Contains(s, "```") {
		start := strings.Index(s, "```") + 3
		end := strings.Index(s[start:], "```")
		if end > 0 {
			s = strings.TrimSpace(s[start : start+end])
		}
	}
	// Find the first JSON array or object using a string-aware scanner so that
	// brackets inside string literals are ignored. This is the bug that caused
	// "Gagal parse response AI" when questions contained `}`, `]`, or quoted code.
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch != '[' && ch != '{' {
			continue
		}
		closeChar := byte('}')
		if ch == '[' {
			closeChar = ']'
		}
		depth := 0
		inStr := false
		escape := false
		for j := i; j < len(s); j++ {
			c := s[j]
			if escape {
				escape = false
				continue
			}
			if c == '\\' && inStr {
				escape = true
				continue
			}
			if c == '"' {
				inStr = !inStr
				continue
			}
			if inStr {
				continue
			}
			if c == ch {
				depth++
			} else if c == closeChar {
				depth--
				if depth == 0 {
					return s[i : j+1]
				}
			}
		}
		// No balanced close — try to truncate trailing partial items and close.
		// This handles AI responses cut off by max_tokens.
		truncated := tryCompleteJSON(s[i:])
		if truncated != "" {
			return truncated
		}
	}
	return s
}

// tryCompleteJSON handles a truncated JSON array like
// `[{"a":1},{"b":2},{"c":` → returns `[{"a":1},{"b":2}]`
// Best-effort — only useful for arrays of objects.
func tryCompleteJSON(s string) string {
	if len(s) == 0 || s[0] != '[' {
		return ""
	}
	// Find last complete top-level object within the array
	depth := 0
	inStr := false
	escape := false
	lastComplete := -1
	for i := 1; i < len(s); i++ {
		c := s[i]
		if escape {
			escape = false
			continue
		}
		if c == '\\' && inStr {
			escape = true
			continue
		}
		if c == '"' {
			inStr = !inStr
			continue
		}
		if inStr {
			continue
		}
		if c == '{' || c == '[' {
			depth++
		} else if c == '}' || c == ']' {
			depth--
			if depth == 0 {
				lastComplete = i
			}
		}
	}
	if lastComplete > 0 {
		return s[:lastComplete+1] + "]"
	}
	return ""
}
