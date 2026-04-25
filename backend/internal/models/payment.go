package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Payment represents a Stripe payment intent
type Payment struct {
	ID                    string         `gorm:"primaryKey;type:uuid" json:"id"`
	StudentEmail          string         `gorm:"not null" json:"student_email"`
	ProductID             string         `gorm:"not null;type:uuid" json:"product_id"`
	MentorID              string         `gorm:"not null;type:uuid" json:"mentor_id"`
	StripePaymentIntentID string         `gorm:"not null;uniqueIndex" json:"stripe_payment_intent_id"`
	StripeSubscriptionID  *string        `gorm:"type:text;uniqueIndex" json:"stripe_subscription_id"`
	AmountCents           int            `gorm:"not null" json:"amount_cents"` // Amount in cents (e.g., 999 = R$9.99)
	Currency              string         `gorm:"not null;default:brl" json:"currency"`
	Status                string         `gorm:"not null;default:pending;index" json:"status"` // pending, processing, succeeded, failed, refunded
	PaymentMethod         *string        `gorm:"type:text" json:"payment_method"`              // card, pix
	Description           *string        `gorm:"type:text" json:"description"`
	Metadata              datatypes.JSON `gorm:"type:jsonb" json:"metadata"`
	CreatedAt             time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt             time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	SucceededAt           *time.Time     `json:"succeeded_at"`
}

func (p *Payment) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

func (Payment) TableName() string { return "payments" }

// PaymentSplit represents the split between mentor and platform
type PaymentSplit struct {
	ID                string    `gorm:"primaryKey;type:uuid" json:"id"`
	PaymentID         string    `gorm:"not null;type:uuid;index" json:"payment_id"`
	MentorID          string    `gorm:"not null;type:uuid;index" json:"mentor_id"`
	PlatformFeeCents  int       `gorm:"not null" json:"platform_fee_cents"`
	MentorAmountCents int       `gorm:"not null" json:"mentor_amount_cents"`
	SplitPercentage   float64   `gorm:"not null;default:70.00" json:"split_percentage"`
	TransferStatus    *string   `gorm:"type:text;default:pending" json:"transfer_status"` // pending, processing, completed, failed
	StripeTransferID  *string   `gorm:"type:text" json:"stripe_transfer_id"`
	CreatedAt         time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (ps *PaymentSplit) BeforeCreate(tx *gorm.DB) error {
	if ps.ID == "" {
		ps.ID = uuid.New().String()
	}
	return nil
}

func (PaymentSplit) TableName() string { return "payment_splits" }

// PaymentWebhook represents Stripe webhook events
type PaymentWebhook struct {
	ID            string         `gorm:"primaryKey;type:uuid" json:"id"`
	StripeEventID string         `gorm:"not null;uniqueIndex" json:"stripe_event_id"`
	EventType     string         `gorm:"not null;index" json:"event_type"` // e.g., payment_intent.succeeded
	PaymentID     *string        `gorm:"type:uuid;index" json:"payment_id"`
	RawData       datatypes.JSON `gorm:"type:jsonb;not null" json:"raw_data"`
	Processed     bool           `gorm:"default:false;index" json:"processed"`
	Error         *string        `gorm:"type:text" json:"error"`
	CreatedAt     time.Time      `gorm:"autoCreateTime" json:"created_at"`
}

func (pw *PaymentWebhook) BeforeCreate(tx *gorm.DB) error {
	if pw.ID == "" {
		pw.ID = uuid.New().String()
	}
	return nil
}

func (PaymentWebhook) TableName() string { return "payment_webhooks" }
