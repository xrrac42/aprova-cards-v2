package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StudentAccess struct {
	ID             string    `gorm:"primaryKey;type:uuid" json:"id"`
	Email          string    `gorm:"not null" json:"email"`
	ProductID      string    `gorm:"not null;type:uuid" json:"product_id"`
	Active         bool      `gorm:"not null;default:true" json:"active"`
	InactiveReason *string   `json:"inactive_reason"`
	InvitationID  *string `gorm:"-" json:"invitation_id,omitempty"`
	CreatedAt      time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (s *StudentAccess) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

func (StudentAccess) TableName() string { return "student_access" }
