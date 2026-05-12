package dto

type PaymentResponse struct {
	ID                string           `json:"id"`
	StudentEmail      string           `json:"student_email"`
	ProductID         string           `json:"product_id"`
	MentorID          string           `json:"mentor_id"`
	ExternalPaymentID string           `json:"external_payment_id"`
	AmountCents       int              `json:"amount_cents"`
	Currency          string           `json:"currency"`
	Status            string           `json:"status"`
	PaymentMethod     *string          `json:"payment_method"`
	PaymentSplit      *PaymentSplitDTO `json:"payment_split"`
	CreatedAt         string           `json:"created_at"`
	UpdatedAt         string           `json:"updated_at"`
	SucceededAt       *string          `json:"succeeded_at"`
}

type PaymentSplitDTO struct {
	ID                string  `json:"id"`
	PaymentID         string  `json:"payment_id"`
	MentorID          string  `json:"mentor_id"`
	PlatformFeeCents  int     `json:"platform_fee_cents"`
	MentorAmountCents int     `json:"mentor_amount_cents"`
	SplitPercentage   float64 `json:"split_percentage"`
	TransferStatus    *string `json:"transfer_status"`
}

type ListPaymentsQuery struct {
	StudentEmail *string `form:"student_email"`
	ProductID    *string `form:"product_id"`
	Status       *string `form:"status"`
	Page         int     `form:"page,default=1" binding:"min=1"`
	PageSize     int     `form:"page_size,default=20" binding:"min=1,max=100"`
}

type PaymentListResponse struct {
	Data       []PaymentResponse `json:"data"`
	Total      int64             `json:"total"`
	Page       int               `json:"page"`
	PageSize   int               `json:"page_size"`
	TotalPages int               `json:"total_pages"`
}

// KiwifyWebhookPayload is the payload sent by Kiwify on order events
type KiwifyWebhookPayload struct {
	Token       string `json:"token"`
	Type        string `json:"type"`
	OrderID     string `json:"order_id"`
	OrderStatus string `json:"order_status"`
	Buyer       struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	} `json:"buyer"`
	Product struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"product"`
	Payment struct {
		Amount   int    `json:"amount"`
		Currency string `json:"currency"`
		Method   string `json:"method"`
	} `json:"payment"`
}

// ActivateFromKiwifyRequest carries the data extracted from a Kiwify webhook
type ActivateFromKiwifyRequest struct {
	MentorID      string
	StudentEmail  string
	KiwifyOrderID string
	AmountCents   int
	Currency      string
}

// WelcomeEmailRequest sends a welcome email to student
type WelcomeEmailRequest struct {
	StudentEmail string `json:"student_email" binding:"required,email"`
	MentorName   string `json:"mentor_name" binding:"required"`
	ProductName  string `json:"product_name" binding:"required"`
}
