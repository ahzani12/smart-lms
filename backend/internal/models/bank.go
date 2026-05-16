package models

import (
	"time"

	"gorm.io/gorm"
)

// ─── Topic (Kompetensi Dasar / BAB) ────────────────────────
// Tree structure. Parent: BAB. Children: Sub-BAB, KD.

type Topic struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	SchoolID  uint           `json:"school_id" gorm:"index"`
	SubjectID uint           `json:"subject_id" gorm:"index;not null"`
	Subject   *Subject       `json:"subject,omitempty" gorm:"foreignKey:SubjectID"`
	ParentID  *uint          `json:"parent_id" gorm:"index"`
	Parent    *Topic         `json:"parent,omitempty" gorm:"foreignKey:ParentID"`
	Children  []Topic        `json:"children,omitempty" gorm:"foreignKey:ParentID"`
	Code      string         `json:"code" gorm:"size:50;index"` // "BAB1" / "3.1"
	Name      string         `json:"name" gorm:"size:255;not null"`
	Level     string         `json:"level" gorm:"size:10"` // X, XI, XII, all
	Order     int            `json:"order" gorm:"default:0"`
}

// ─── Question Topic (many-to-many) ─────────────────────────
// 1 soal bisa kena beberapa topik/KD.

type QuestionTopic struct {
	QuestionID uint `json:"question_id" gorm:"primaryKey"`
	TopicID    uint `json:"topic_id" gorm:"primaryKey;index"`
}

// ─── Question Bank Item (many-to-many) ─────────────────────
// Bank soal sekarang = playlist. Soal bisa masuk banyak bank, bank bisa berisi banyak soal.

type QuestionBankItem struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	QuestionBankID uint      `json:"question_bank_id" gorm:"index;not null;uniqueIndex:idx_bankitem_unique"`
	QuestionID     uint      `json:"question_id" gorm:"index;not null;uniqueIndex:idx_bankitem_unique"`
	Order          int       `json:"order" gorm:"default:0"`
	AddedAt        time.Time `json:"added_at"`
	AddedBy        uint      `json:"added_by"`
	Question       *Question `json:"question,omitempty" gorm:"foreignKey:QuestionID"`
}

// ─── Question Version (history/revisi soal) ─────────────────
// Setiap edit = bikin version baru. Ujian lama tetep pake version lama.

type QuestionVersion struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	CreatedAt   time.Time `json:"created_at"`
	QuestionID  uint      `json:"question_id" gorm:"index;not null"`
	Version     int       `json:"version" gorm:"not null"`
	Content     string    `json:"content" gorm:"type:text"`
	Options     string    `json:"options" gorm:"type:jsonb"`
	Answer      string    `json:"answer" gorm:"type:text"`
	Explanation string    `json:"explanation" gorm:"type:text"`
	Points      int       `json:"points"`
	Difficulty  string    `json:"difficulty" gorm:"size:20"`
	EditedBy    uint      `json:"edited_by"`
	Reason      string    `json:"reason" gorm:"size:255"`
}

// ─── Import Report (hasil import Word) ──────────────────────

type ImportReport struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	CreatedAt      time.Time `json:"created_at"`
	QuestionBankID uint      `json:"question_bank_id" gorm:"index"`
	FileName       string    `json:"file_name" gorm:"size:255"`
	TotalParsed    int       `json:"total_parsed"`
	SuccessCount   int       `json:"success_count"`
	FailCount      int       `json:"fail_count"`
	Errors         string    `json:"errors" gorm:"type:jsonb"` // [{line: N, reason: "..."}]
	UploadedBy     uint      `json:"uploaded_by"`
}
