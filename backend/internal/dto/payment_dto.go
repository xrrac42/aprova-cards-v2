package dto

// CreatePaymentIntentRequest is used to create a payment intent
type CreatePaymentIntentRequest struct {
	StudentEmail string  `json:"student_email" binding:"required,email"`
	ProductID    string  `json:"product_id" binding:"required"`
	AmountCents  int     `json:"amount_cents" binding:"required,gt=0"`
	Currency     string  `json:"currency" binding:"omitempty,len=3"`
	Description  string  `json:"description" binding:"omitempty"`
	InviteCode   *string `json:"invite_code" binding:"omitempty"` // Optional: for student signup flow
	FullName     *string `json:"full_name" binding:"omitempty"`   // Optional: student's full name
}

// PaymentIntentResponse contains payment intent details
type PaymentIntentResponse struct {
	ID                    string `json:"id"`
	StripePaymentIntentID string `json:"stripe_payment_intent_id"`
	ClientSecret          string `json:"client_secret"`
	AmountCents           int    `json:"amount_cents"`
	Currency              string `json:"currency"`
	Status                string `json:"status"`
	StudentEmail          string `json:"student_email"`
	ProductID             string `json:"product_id"`
	CreatedAt             string `json:"created_at"`
}

// ConfirmPaymentRequest is used to confirm a payment
type ConfirmPaymentRequest struct {
	PaymentIntentID string `json:"payment_intent_id" binding:"required"`
	PaymentMethodID string `json:"payment_method_id" binding:"required"`
}

// PaymentResponse represents a payment
type PaymentResponse struct {
	ID                    string           `json:"id"`
	StudentEmail          string           `json:"student_email"`
	ProductID             string           `json:"product_id"`
	MentorID              string           `json:"mentor_id"`
	StripePaymentIntentID string           `json:"stripe_payment_intent_id"`
	AmountCents           int              `json:"amount_cents"`
	Currency              string           `json:"currency"`
	Status                string           `json:"status"`
	PaymentMethod         *string          `json:"payment_method"`
	PaymentSplit          *PaymentSplitDTO `json:"payment_split"`
	CreatedAt             string           `json:"created_at"`
	UpdatedAt             string           `json:"updated_at"`
	SucceededAt           *string          `json:"succeeded_at"`
}

// PaymentSplitDTO represents payment split information
type PaymentSplitDTO struct {
	ID                string  `json:"id"`
	PaymentID         string  `json:"payment_id"`
	MentorID          string  `json:"mentor_id"`
	PlatformFeeCents  int     `json:"platform_fee_cents"`
	MentorAmountCents int     `json:"mentor_amount_cents"`
	SplitPercentage   float64 `json:"split_percentage"`
	TransferStatus    *string `json:"transfer_status"`
}

// ListPaymentsQuery contains query parameters for listing payments
type ListPaymentsQuery struct {
	StudentEmail *string `form:"student_email"`
	ProductID    *string `form:"product_id"`
	Status       *string `form:"status"`
	Page         int     `form:"page,default=1" binding:"min=1"`
	PageSize     int     `form:"page_size,default=20" binding:"min=1,max=100"`
}

// PaymentListResponse contains paginated payment results
type PaymentListResponse struct {
	Data       []PaymentResponse `json:"data"`
	Total      int64             `json:"total"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	TotalPages int               `json:"total_pages"`
}

// StripeWebhookRequest represents a Stripe webhook payload
type StripeWebhookRequest struct {
	ID   string      `json:"id"`
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// RefundPaymentRequest is used to refund a payment
type RefundPaymentRequest struct {
	PaymentID string `json:"payment_id" binding:"required"`
	Reason    string `json:"reason" binding:"omitempty"`
}

// CreateCheckoutSessionRequest creates a Stripe Checkout Session for the student invite flow
type CreateCheckoutSessionRequest struct {
	InviteCode  string `json:"invite_code" binding:"required"`
	AmountCents int    `json:"amount_cents" binding:"required,gt=0"`
	Currency    string `json:"currency" binding:"omitempty,len=3"`
}

// CheckoutSessionResponse returns the Stripe Checkout Session URL
type CheckoutSessionResponse struct {
	SessionID  string `json:"session_id"`
	SessionURL string `json:"session_url"`
}

// ActivateFromCheckoutRequest carries checkout.session.completed data for student activation
type ActivateFromCheckoutRequest struct {
	InviteCode           string
	StudentEmail         string
	AmountCents          int
	Currency             string
	StripeSessionID      string
	StripeSubscriptionID string
}

// CheckoutSessionInfoRequest queries session information
type CheckoutSessionInfoRequest struct {
	SessionID string `form:"session_id" binding:"required"`
}

// CheckoutSessionInfoResponse returns session information for success page
type CheckoutSessionInfoResponse struct {
	MentorName   string `json:"mentor_name"`
	ProductName  string `json:"product_name"`
	StudentEmail string `json:"student_email"`
	AmountCents  int    `json:"amount_cents"`
}

// WelcomeEmailRequest sends a welcome email to student
type WelcomeEmailRequest struct {
	StudentEmail string `json:"student_email" binding:"required,email"`
	MentorName   string `json:"mentor_name" binding:"required"`
	ProductName  string `json:"product_name" binding:"required"`
	SessionID    string `json:"session_id" binding:"required"`
}
