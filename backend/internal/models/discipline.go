package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Discipline struct {
	ID        string    `gorm:"primaryKey;type:uuid" json:"id"`
	ProductID string    `gorm:"not null;type:uuid" json:"product_id"`
	Name      string    `gorm:"not null" json:"name"`
	Order     int       `gorm:"not null;default:0" json:"order"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (d *Discipline) BeforeCreate(tx *gorm.DB) error {
	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	return nil
}

func (Discipline) TableName() string { return "disciplines" }
