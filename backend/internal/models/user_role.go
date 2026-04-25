package models

import "time"

type UserRole struct {
	ID        string    `gorm:"primaryKey;type:uuid" json:"id"`
	Email     string    `gorm:"uniqueIndex;not null" json:"email"`
	Role      string    `gorm:"not null" json:"role"`
	MentorID  *string   `gorm:"type:uuid" json:"mentor_id"`
	ProductID *string   `gorm:"type:uuid" json:"product_id"`
	Active    bool      `gorm:"not null;default:true" json:"active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (UserRole) TableName() string { return "user_roles" }
