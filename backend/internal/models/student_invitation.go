package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StudentInvitation represents an invitation link sent by mentor to student
type StudentInvitation struct {
	ID           string     `gorm:"primaryKey;type:uuid" json:"id"`
	MentorID     string     `gorm:"not null;type:uuid;index" json:"mentor_id"`
	ProductID    string     `gorm:"not null;type:uuid;index" json:"product_id"`
	InviteCode   string     `gorm:"not null;uniqueIndex" json:"invite_code"`
	StudentEmail *string    `gorm:"index" json:"student_email"`
	Status       string     `gorm:"not null;default:pending;index" json:"status"` // pending, signed_up, payment_pending, active, expired
	InvitedEmail *string    `gorm:"type:text" json:"invited_email"`               // Email invitation was sent to
	InvitedName  *string    `gorm:"type:text" json:"invited_name"`                // Name provided when generating invite
	ExpiresAt    time.Time  `gorm:"not null;index" json:"expires_at"`
	SignedUpAt   *time.Time `json:"signed_up_at"`
	ActivatedAt  *time.Time `json:"activated_at"`
	PaymentID    *string    `gorm:"type:uuid" json:"payment_id"`
	CreatedAt    time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (si *StudentInvitation) BeforeCreate(tx *gorm.DB) error {
	if si.ID == "" {
		si.ID = uuid.New().String()
	}
	return nil
}

func (StudentInvitation) TableName() string { return "student_invitations" }

// StudentAuth represents a student's Supabase Auth user linked to a mentor
type StudentAuth struct {
	ID             string    `gorm:"primaryKey;type:uuid" json:"id"`
	StudentEmail   string    `gorm:"not null;uniqueIndex" json:"student_email"`
	SupabaseUserID string    `gorm:"not null;uniqueIndex" json:"supabase_user_id"` // From Supabase Auth
	InvitationID   *string   `gorm:"type:uuid" json:"invitation_id"`
	MentorID       string    `gorm:"not null;type:uuid;index" json:"mentor_id"`
	ProductID      string    `gorm:"not null;type:uuid;index" json:"product_id"`
	EmailVerified  bool      `gorm:"default:false" json:"email_verified"`
	CreatedAt      time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (sa *StudentAuth) BeforeCreate(tx *gorm.DB) error {
	if sa.ID == "" {
		sa.ID = uuid.New().String()
	}
	return nil
}

func (StudentAuth) TableName() string { return "student_auth" }
