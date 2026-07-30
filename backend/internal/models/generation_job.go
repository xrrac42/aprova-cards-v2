package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	GenerationJobStatusPending    = "pending"
	GenerationJobStatusProcessing = "processing"
	GenerationJobStatusReducing   = "reducing"
	GenerationJobStatusReviewing  = "reviewing"
	GenerationJobStatusCompleted  = "completed"
	GenerationJobStatusFailed     = "failed"
)

type GenerationJob struct {
	ID                string         `gorm:"primaryKey;type:uuid" json:"id"`
	DisciplineID      string         `gorm:"not null;type:uuid" json:"discipline_id"`
	Status            string         `gorm:"not null;default:pending" json:"status"`
	Archetype         string         `json:"archetype"`
	Preset            string         `json:"preset"`
	RegraDeOuro       string         `json:"regra_de_ouro"`
	SourceCharCount   int            `json:"source_char_count"`
	TotalChunks       int            `json:"total_chunks"`
	CompletedChunks   int            `json:"completed_chunks"`
	ReduceEnqueuedAt  *time.Time     `json:"reduce_enqueued_at"`
	Result            datatypes.JSON `gorm:"type:jsonb" json:"result"`
	ReviewError       string         `json:"review_error"`
	Error             string         `json:"error"`
	CreatedAt         time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	StartedAt         *time.Time     `json:"started_at"`
	CompletedAt       *time.Time     `json:"completed_at"`
}

func (j *GenerationJob) BeforeCreate(tx *gorm.DB) error {
	if j.ID == "" {
		j.ID = uuid.New().String()
	}
	return nil
}

func (GenerationJob) TableName() string { return "generation_jobs" }
