package handlers

import (
	"testing"

	"smart-lms/internal/models"
)

func TestScoreAnswer(t *testing.T) {
	tests := []struct {
		name      string
		q         models.Question
		ans       string
		wantScore float64
		wantCorr  bool
		wantGrad  bool
	}{
		{"PG benar", models.Question{Type: "pilihan_ganda", Answer: "B", Points: 10}, "B", 10, true, true},
		{"PG salah", models.Question{Type: "pilihan_ganda", Answer: "B", Points: 10}, "A", 0, false, true},
		{"PG case", models.Question{Type: "pilihan_ganda", Answer: "B", Points: 10}, "b", 10, true, true},
		{"TF benar lowercase", models.Question{Type: "true_false", Answer: "BENAR", Points: 5}, "benar", 5, true, true},
		{"TF B short", models.Question{Type: "true_false", Answer: "BENAR", Points: 5}, "B", 5, true, true},
		{"TF SALAH", models.Question{Type: "true_false", Answer: "SALAH", Points: 5}, "S", 5, true, true},
		{"Isian exact", models.Question{Type: "fill_blank", Answer: "Bandung", Points: 10}, "bandung", 10, true, true},
		{"Isian alt", models.Question{Type: "fill_blank", Answer: "Bandung", AcceptedAnswers: "Kota Bandung\nbdg", Points: 10}, "kota bandung", 10, true, true},
		{"Isian salah", models.Question{Type: "fill_blank", Answer: "Bandung", Points: 10}, "Jakarta", 0, false, true},
		{"Essay 3/5", models.Question{Type: "essay", Keywords: "fotosintesis\ncahaya\nair\nklorofil\nglukosa", Points: 25}, "Fotosintesis butuh cahaya dan air", 15, false, true},
		{"Essay full", models.Question{Type: "essay", Keywords: "foto\ncahaya", Points: 20}, "fotosintesis butuh cahaya", 20, true, true},
		{"Essay no keywords", models.Question{Type: "essay", Points: 20}, "any", 0, false, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			score, correct, graded := scoreAnswer(tc.q, tc.ans)
			if score != tc.wantScore || correct != tc.wantCorr || graded != tc.wantGrad {
				t.Errorf("got (score=%v, correct=%v, graded=%v), want (score=%v, correct=%v, graded=%v)",
					score, correct, graded, tc.wantScore, tc.wantCorr, tc.wantGrad)
			}
		})
	}
}
