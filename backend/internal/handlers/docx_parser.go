package handlers

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// ─── DOCX → QUESTIONS PARSER ───────────────────────────────────────────
// Format template (per soal):
//
//   === SOAL 1 ===
//   TIPE: pilihan_ganda
//   TINGKAT: mudah          (opsional, default: sedang)
//   POIN: 10                (opsional, default: 10)
//   SOAL: <isi soal>
//   A. opsi A               (utk pilihan_ganda)
//   B. opsi B
//   C. opsi C
//   D. opsi D
//   JAWABAN: B
//   PEMBAHASAN: <opsional>
//   ALTERNATIF: alt1, alt2  (utk isian)
//   KATA_KUNCI: kata1, kata2 (utk essay)
//
// 4 tipe wajib: pilihan_ganda, essay, benar_salah, isian
// Aliases case-insensitive: pg/pilihanganda, ts/benar-salah, fillblank/isian.

type ParsedQuestion struct {
	Number          int      `json:"number"`
	Type            string   `json:"type"`
	Difficulty      string   `json:"difficulty"`
	Points          int      `json:"points"`
	Content         string   `json:"content"`
	Options         []QOpt   `json:"options,omitempty"`
	Answer          string   `json:"answer"`
	Explanation     string   `json:"explanation,omitempty"`
	AcceptedAnswers string   `json:"accepted_answers,omitempty"` // newline-separated
	Keywords        string   `json:"keywords,omitempty"`         // newline-separated
	Errors          []string `json:"errors,omitempty"`
}

type QOpt struct {
	Key  string `json:"key"`
	Text string `json:"text"`
}

var (
	rxSoalSep = regexp.MustCompile(`(?i)^\s*={2,}\s*SOAL\s*(\d+)?\s*={2,}\s*$`)
	rxOption  = regexp.MustCompile(`^\s*([A-E])\s*[\.\)]\s*(.+?)\s*$`)
	rxField   = regexp.MustCompile(`^\s*([A-Z_]+)\s*:\s*(.*)$`)
)

// normTipe maps user input → canonical question type.
func normTipe(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "-", "_")
	switch s {
	case "pg", "pilihan_ganda", "pilihanganda", "multiple_choice", "mc":
		return "pilihan_ganda"
	case "essay", "uraian":
		return "essay"
	case "benar_salah", "benarsalah", "true_false", "ts", "tf":
		return "true_false"
	case "isian", "fill_blank", "fillblank", "fb":
		return "fill_blank"
	}
	return s
}

func normTingkat(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	switch s {
	case "mudah", "easy":
		return "mudah"
	case "sulit", "hard", "sukar":
		return "sulit"
	default:
		return "sedang"
	}
}

func normJawabanTF(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	switch s {
	case "B", "BENAR", "TRUE", "T", "YA":
		return "BENAR"
	case "S", "SALAH", "FALSE", "F", "TIDAK":
		return "SALAH"
	}
	return s
}

// ParseDocxQuestions converts plain text (extracted from .docx) into
// a list of ParsedQuestion. Errors per-soal don't abort the batch —
// each soal carries its own error list so user can see which baris bermasalah.
func ParseDocxQuestions(text string) []ParsedQuestion {
	lines := strings.Split(text, "\n")

	// Step 1: split into soal-blocks by separator
	type block struct {
		num   int
		lines []string
	}
	var blocks []block
	var current *block
	for _, raw := range lines {
		line := strings.TrimRight(raw, " \r\t")
		if m := rxSoalSep.FindStringSubmatch(line); m != nil {
			if current != nil {
				blocks = append(blocks, *current)
			}
			num := len(blocks) + 1
			if m[1] != "" {
				if n, err := strconv.Atoi(m[1]); err == nil {
					num = n
				}
			}
			current = &block{num: num}
			continue
		}
		if current != nil {
			current.lines = append(current.lines, line)
		}
	}
	if current != nil {
		blocks = append(blocks, *current)
	}

	// Step 2: parse each block
	var result []ParsedQuestion
	for _, b := range blocks {
		q := parseSoalBlock(b.num, b.lines)
		result = append(result, q)
	}
	return result
}

func parseSoalBlock(num int, lines []string) ParsedQuestion {
	q := ParsedQuestion{
		Number:     num,
		Difficulty: "sedang",
		Points:     10,
	}

	// Field accumulator — multi-line aware. SOAL/PEMBAHASAN can span multiple
	// lines until next field/option/separator.
	var (
		soalBuf      []string
		pembahasanBuf []string
		jawabanBuf   []string
		altBuf       []string
		keyBuf       []string
		opts         []QOpt
		// Track which field is "active" so multi-line content sticks.
		active = "" // "", "SOAL", "PEMBAHASAN", "JAWABAN", "ALTERNATIF", "KATA_KUNCI"
	)

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			// preserve blank lines inside multi-line fields as paragraph break
			switch active {
			case "SOAL":
				if len(soalBuf) > 0 {
					soalBuf = append(soalBuf, "")
				}
			case "PEMBAHASAN":
				if len(pembahasanBuf) > 0 {
					pembahasanBuf = append(pembahasanBuf, "")
				}
			}
			continue
		}

		// Option line (only relevant for pilihan_ganda) — A. xxx
		if m := rxOption.FindStringSubmatch(trimmed); m != nil && active != "PEMBAHASAN" {
			opts = append(opts, QOpt{Key: m[1], Text: strings.TrimSpace(m[2])})
			active = "" // option line breaks any active multi-line field
			continue
		}

		// Field line: KEY: value
		if m := rxField.FindStringSubmatch(trimmed); m != nil {
			key := strings.ToUpper(m[1])
			val := strings.TrimSpace(m[2])
			switch key {
			case "TIPE", "TYPE":
				q.Type = normTipe(val)
				active = ""
			case "TINGKAT", "DIFFICULTY":
				q.Difficulty = normTingkat(val)
				active = ""
			case "POIN", "POINTS", "POIN_NILAI":
				if n, err := strconv.Atoi(val); err == nil && n > 0 {
					q.Points = n
				}
				active = ""
			case "SOAL", "PERTANYAAN", "QUESTION":
				if val != "" {
					soalBuf = append(soalBuf, val)
				}
				active = "SOAL"
			case "JAWABAN", "ANSWER", "KUNCI":
				if val != "" {
					jawabanBuf = append(jawabanBuf, val)
				}
				active = "JAWABAN"
			case "PEMBAHASAN", "EXPLANATION", "PENJELASAN":
				if val != "" {
					pembahasanBuf = append(pembahasanBuf, val)
				}
				active = "PEMBAHASAN"
			case "ALTERNATIF", "ALT", "ALTERNATIVE":
				if val != "" {
					for _, a := range strings.Split(val, ",") {
						a = strings.TrimSpace(a)
						if a != "" {
							altBuf = append(altBuf, a)
						}
					}
				}
				active = "" // single-line: stop accumulating after this line
			case "KATA_KUNCI", "KEYWORDS", "KUNCI_JAWABAN", "KEYS":
				if val != "" {
					for _, k := range strings.Split(val, ",") {
						k = strings.TrimSpace(k)
						if k != "" {
							keyBuf = append(keyBuf, k)
						}
					}
				}
				active = "" // single-line: stop accumulating after this line
			default:
				// Unknown field — append to active multiline if any
				if active == "SOAL" {
					soalBuf = append(soalBuf, trimmed)
				} else if active == "PEMBAHASAN" {
					pembahasanBuf = append(pembahasanBuf, trimmed)
				}
			}
			continue
		}

		// Plain continuation line — append to active multi-line field
		switch active {
		case "SOAL":
			soalBuf = append(soalBuf, trimmed)
		case "PEMBAHASAN":
			pembahasanBuf = append(pembahasanBuf, trimmed)
		case "JAWABAN":
			jawabanBuf = append(jawabanBuf, trimmed)
		}
	}

	q.Content = strings.TrimSpace(strings.Join(soalBuf, "\n"))
	q.Explanation = strings.TrimSpace(strings.Join(pembahasanBuf, "\n"))
	q.Answer = strings.TrimSpace(strings.Join(jawabanBuf, " "))
	if len(opts) > 0 {
		q.Options = opts
	}
	q.AcceptedAnswers = strings.Join(altBuf, "\n")
	q.Keywords = strings.Join(keyBuf, "\n")

	// ─── Validate per type ───────────────────────────────────────────
	if q.Type == "" {
		q.Errors = append(q.Errors, "TIPE belum diisi")
	}
	if q.Content == "" {
		q.Errors = append(q.Errors, "SOAL kosong")
	}

	switch q.Type {
	case "pilihan_ganda":
		if len(opts) < 2 {
			q.Errors = append(q.Errors, "Minimal 2 opsi (A, B)")
		}
		ans := strings.ToUpper(q.Answer)
		q.Answer = ans
		valid := false
		for _, o := range opts {
			if strings.EqualFold(o.Key, ans) {
				valid = true
				break
			}
		}
		if !valid {
			q.Errors = append(q.Errors, fmt.Sprintf("JAWABAN '%s' tidak cocok dgn opsi", ans))
		}
	case "true_false":
		q.Answer = normJawabanTF(q.Answer)
		if q.Answer != "BENAR" && q.Answer != "SALAH" {
			q.Errors = append(q.Errors, "JAWABAN harus BENAR atau SALAH")
		}
	case "fill_blank":
		if q.Answer == "" {
			q.Errors = append(q.Errors, "JAWABAN kosong")
		}
	case "essay":
		if q.Answer == "" && q.Keywords == "" {
			q.Errors = append(q.Errors, "Essay butuh JAWABAN atau KATA_KUNCI utk auto-correct")
		}
	case "":
		// already flagged above
	default:
		q.Errors = append(q.Errors, fmt.Sprintf("Tipe '%s' belum didukung (gunakan: pilihan_ganda, essay, benar_salah, isian)", q.Type))
	}

	return q
}

// OptionsToJSON converts []QOpt to JSON string for storage.
func OptionsToJSON(opts []QOpt) string {
	if len(opts) == 0 {
		return ""
	}
	b, _ := json.Marshal(opts)
	return string(b)
}
