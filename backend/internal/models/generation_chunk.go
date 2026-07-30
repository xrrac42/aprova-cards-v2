package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	GenerationChunkStatusPending    = "pending"
	GenerationChunkStatusProcessing = "processing"
	GenerationChunkStatusCompleted  = "completed"
	GenerationChunkStatusFailed     = "failed"
)

type GenerationChunk struct {
	ID         string         `gorm:"primaryKey;type:uuid" json:"id"`
	JobID      string         `gorm:"not null;type:uuid" json:"job_id"`
	ChunkIndex int            `gorm:"not null" json:"chunk_index"`
	ChunkText  string         `gorm:"not null" json:"chunk_text"`
	CharStart  int            `json:"char_start"`
	CharEnd    int            `json:"char_end"`
	CardLimit  int            `json:"card_limit"`
	Status     string         `gorm:"not null;default:pending" json:"status"`
	Cards      datatypes.JSON `gorm:"type:jsonb" json:"cards"`
	Error      string         `json:"error"`
	Attempt    int            `json:"attempt"`
	CreatedAt  time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt  time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
}

func (c *GenerationChunk) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}

func (GenerationChunk) TableName() string { return "generation_chunks" }
