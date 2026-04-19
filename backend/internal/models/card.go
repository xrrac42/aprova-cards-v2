package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Card struct {
	ID           string    `gorm:"primaryKey;type:uuid" json:"id"`
	DisciplineID string    `gorm:"not null;type:uuid" json:"discipline_id"`
	ProductID    string    `gorm:"not null;type:uuid" json:"product_id"`
	SubjectID    *string   `gorm:"type:uuid" json:"subject_id"`
	Front        string    `gorm:"not null" json:"front"`
	Back         string    `gorm:"not null" json:"back"`
	Order        int       `gorm:"not null;default:0" json:"order"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (c *Card) BeforeCreate(tx *gorm.DB) error {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	return nil
}

func (Card) TableName() string { return "cards" }
