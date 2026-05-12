package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Mentor struct {
	ID              string    `gorm:"primaryKey;type:uuid" json:"id"`
	Name            string    `gorm:"not null" json:"name"`
	Email           string    `gorm:"uniqueIndex" json:"email"`
	Slug            string    `gorm:"uniqueIndex;not null" json:"slug"`
	LogoURL         *string   `json:"logo_url"`
	PrimaryColor    string    `gorm:"not null;default:'#6c63ff'" json:"primary_color"`
	SecondaryColor  string    `gorm:"not null;default:'#43e97b'" json:"secondary_color"`
	AccentColor     *string   `gorm:"default:'#ffd166'" json:"accent_color"`
	RevenueShare    float64   `gorm:"not null;default:50.00" json:"revenue_share"`
	StripeAccountID *string   `gorm:"uniqueIndex" json:"stripe_account_id"`
	KiwifyToken     *string   `gorm:"type:text" json:"kiwify_token"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (m *Mentor) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

func (Mentor) TableName() string { return "mentors" }
