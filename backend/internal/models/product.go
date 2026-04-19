package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Product struct {
	ID              string    `gorm:"primaryKey;type:uuid" json:"id"`
	MentorID        string    `gorm:"not null;type:uuid" json:"mentor_id"`
	Name            string    `gorm:"not null" json:"name"`
	AccessCode      string    `gorm:"uniqueIndex;not null" json:"access_code"`
	Active          bool      `gorm:"not null;default:true" json:"active"`
	CoverImageURL   *string   `json:"cover_image_url"`
	KiwifyProductID *string   `json:"kiwify_product_id"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
	Mentor          *Mentor   `gorm:"foreignKey:MentorID" json:"mentor,omitempty"`
}

func (p *Product) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

func (Product) TableName() string { return "products" }
