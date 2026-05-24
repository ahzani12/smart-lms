package handlers

import (
	"regexp"
	"strconv"
	"strings"

	"smart-lms/internal/models"
)

// ─── AUTO-CORRECT SCORING ─────────────────────────────────────────────
// Returns: (score, isCorrect, graded)
//   - graded=false utk essay yang belum bisa auto-corrected (no keyword)
//     → tetap perlu manual grading via GradeAnswer endpoint.
//
// Tipe didukung:
//   pilihan_ganda — exact match A/B/C/D/E
//   true_false    — match BENAR/SALAH (case-insensitive)
//   fill_blank    — exact match (case-insensitive) atau di list AcceptedAnswers
//   essay         — keyword scoring: ratio kata kunci hadir × points
//   numeric       — match angka dgn toleransi (default 0)
//   multi_answer  — set match (A,C == C,A)
//   matching      — JSON pair match
//   ordering      — exact sequence match

func scoreAnswer(q models.Question, answer string) (score float64, correct bool, graded bool) {
	maxPts := float64(q.Points)
	studentAns := strings.TrimSpace(answer)

	switch q.Type {
	case "pilihan_ganda":
		correct = strings.EqualFold(studentAns, strings.TrimSpace(q.Answer))
		if correct {
			score = maxPts
		}
		return score, correct, true

	case "true_false":
		// Normalize both: BENAR/SALAH bisa juga ditulis B/S/TRUE/FALSE/dll
		studentNorm := normalizeBoolAnswer(studentAns)
		keyNorm := normalizeBoolAnswer(q.Answer)
		correct = studentNorm != "" && studentNorm == keyNorm
		if correct {
			score = maxPts
		}
		return score, correct, true

	case "fill_blank":
		// Cek vs Answer + AcceptedAnswers (newline-separated, case-insensitive, trim)
		correct = matchFillBlank(studentAns, q.Answer, q.AcceptedAnswers)
		if correct {
			score = maxPts
		}
		return score, correct, true

	case "essay":
		// Keyword scoring: hitung berapa keyword muncul di studentAns
		keywords := splitNonEmpty(q.Keywords, "\n", ",")
		if len(keywords) == 0 {
			// Tidak ada keyword → manual grade
			return 0, false, false
		}
		hits := 0
		ansLower := strings.ToLower(studentAns)
		for _, k := range keywords {
			k = strings.ToLower(strings.TrimSpace(k))
			if k == "" {
				continue
			}
			if strings.Contains(ansLower, k) {
				hits++
			}
		}
		ratio := float64(hits) / float64(len(keywords))
		score = round2(maxPts * ratio)
		// "correct" utk essay = full score
		correct = hits == len(keywords) && hits > 0
		return score, correct, true

	case "numeric":
		// Match angka, toleransi opsional di Answer field "value|tolerance"
		want, tol := parseNumericKey(q.Answer)
		got, err := strconv.ParseFloat(strings.ReplaceAll(studentAns, ",", "."), 64)
		if err != nil {
			return 0, false, true
		}
		correct = absDiff(got, want) <= tol
		if correct {
			score = maxPts
		}
		return score, correct, true

	case "multi_answer":
		// Set match: "A,C" == "C,A"
		studentSet := normalizeKeySet(studentAns)
		keySet := normalizeKeySet(q.Answer)
		correct = setEqual(studentSet, keySet)
		if correct {
			score = maxPts
		}
		return score, correct, true

	case "ordering":
		// Exact sequence match
		correct = strings.EqualFold(
			strings.Join(splitNonEmpty(studentAns, ",", "|"), ","),
			strings.Join(splitNonEmpty(q.Answer, ",", "|"), ","),
		)
		if correct {
			score = maxPts
		}
		return score, correct, true

	default:
		// Unknown type → don't grade
		return 0, false, false
	}
}

// ─── helpers ──────────────────────────────────────────────────────────

func normalizeBoolAnswer(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	switch s {
	case "B", "BENAR", "TRUE", "T", "YA", "Y":
		return "BENAR"
	case "S", "SALAH", "FALSE", "F", "TIDAK", "N":
		return "SALAH"
	}
	return ""
}

func matchFillBlank(student, key, accepted string) bool {
	target := strings.ToLower(strings.TrimSpace(student))
	if target == "" {
		return false
	}
	if strings.EqualFold(target, strings.TrimSpace(key)) {
		return true
	}
	for _, alt := range splitNonEmpty(accepted, "\n", ",") {
		if strings.EqualFold(target, strings.TrimSpace(alt)) {
			return true
		}
	}
	return false
}

// splitNonEmpty splits by any of the given separators, trims, drops empties.
func splitNonEmpty(s string, seps ...string) []string {
	parts := []string{s}
	for _, sep := range seps {
		var next []string
		for _, p := range parts {
			next = append(next, strings.Split(p, sep)...)
		}
		parts = next
	}
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func parseNumericKey(s string) (val, tol float64) {
	s = strings.TrimSpace(s)
	if idx := strings.Index(s, "|"); idx >= 0 {
		val, _ = strconv.ParseFloat(strings.TrimSpace(s[:idx]), 64)
		tol, _ = strconv.ParseFloat(strings.TrimSpace(s[idx+1:]), 64)
		return
	}
	val, _ = strconv.ParseFloat(s, 64)
	return
}

func absDiff(a, b float64) float64 {
	if a > b {
		return a - b
	}
	return b - a
}

func normalizeKeySet(s string) []string {
	parts := splitNonEmpty(s, ",", " ", "|")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		out = append(out, strings.ToUpper(p))
	}
	// Sort for set comparison
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[i] > out[j] {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out
}

func setEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func round2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

// rxNonAlpha kept for future tokenization use (essay scoring v2)
var rxNonAlpha = regexp.MustCompile(`[^\p{L}\p{N}\s]+`)

var _ = rxNonAlpha // avoid unused warning
