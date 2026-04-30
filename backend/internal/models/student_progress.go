package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StudentProgress struct {
	ID             string    `gorm:"primaryKey;type:uuid" json:"id"`
	StudentEmail   string    `gorm:"not null" json:"student_email"`
	CardID         string    `gorm:"not null;type:uuid" json:"card_id"`
	ProductID      string    `gorm:"not null;type:uuid" json:"product_id"`
	Rating         string    `gorm:"not null" json:"rating"`
	NextReview     time.Time `gorm:"not null;default:CURRENT_DATE" json:"next_review"`
	ReviewedAt     time.Time `gorm:"not null;default:now()" json:"reviewed_at"`
	CorrectCount   int       `gorm:"not null;default:0" json:"correct_count"`
	IncorrectCount int       `gorm:"not null;default:0" json:"incorrect_count"`
}

func (s *StudentProgress) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

func (StudentProgress) TableName() string { return "student_progress" }
