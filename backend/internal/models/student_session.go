package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StudentSession struct {
	ID               string    `gorm:"primaryKey;type:uuid" json:"id"`
	StudentEmail     string    `gorm:"not null" json:"student_email"`
	ProductID        string    `gorm:"not null;type:uuid" json:"product_id"`
	DisciplineID     *string   `gorm:"type:uuid" json:"discipline_id"`
	CardsReviewed    int       `gorm:"not null;default:0" json:"cards_reviewed"`
	Correct          int       `gorm:"not null;default:0" json:"correct"`
	Incorrect        int       `gorm:"not null;default:0" json:"incorrect"`
	StudyTimeSeconds int       `gorm:"not null;default:0" json:"study_time_seconds"`
	SessionDate      time.Time `gorm:"not null;default:CURRENT_DATE" json:"session_date"`
	CreatedAt        time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (s *StudentSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

func (StudentSession) TableName() string { return "student_sessions" }
