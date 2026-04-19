package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StudentFeedback struct {
	ID              string    `gorm:"primaryKey;type:uuid" json:"id"`
	StudentEmail    string    `gorm:"not null;column:student_email" json:"student_email"`
	ProductID       string    `gorm:"not null;type:uuid" json:"product_id"`
	Mensagem        string    `gorm:"not null" json:"mensagem"`
	TotalCardsEpoca int       `gorm:"not null;default:0;column:total_cards_epoca" json:"total_cards_epoca"`
	CriadoEm        time.Time `gorm:"not null;default:now();column:criado_em" json:"criado_em"`
}

func (s *StudentFeedback) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

func (StudentFeedback) TableName() string { return "student_feedback" }
