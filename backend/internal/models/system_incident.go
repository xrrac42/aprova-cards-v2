package models

import (
	"time"
)

type SystemIncident struct {
	ID          string    `gorm:"type:uuid;primaryKey" json:"id"`
	Type        string    `gorm:"type:text;not null" json:"type"`
	Severity    string    `gorm:"type:text;not null" json:"severity"`
	Title       string    `gorm:"type:text;not null" json:"title"`
	Description string    `gorm:"type:text" json:"description"`
	Metadata    string    `gorm:"type:jsonb" json:"metadata"`
	Resolved    bool      `gorm:"default:false" json:"resolved"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}

type HealthCheckException struct {
	ID           string    `gorm:"type:uuid;primaryKey" json:"id"`
	Type         string    `gorm:"type:text;not null" json:"type"`
	ReferenceKey string    `gorm:"type:text;not null" json:"reference_key"`
	CreatedAt    time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (SystemIncident) TableName() string {
	return "system_incidents"
}

func (HealthCheckException) TableName() string {
	return "health_check_exceptions"
}
