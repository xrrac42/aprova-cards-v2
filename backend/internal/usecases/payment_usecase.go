package usecases

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/approva-cards/back-aprova-cards/config"
	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/errors"
	"github.com/stripe/stripe-go/v79"
	"github.com/stripe/stripe-go/v79/paymentintent"
)

type PaymentUseCase interface {
	// Payment Intent operations
	CreatePaymentIntent(req *dto.CreatePaymentIntentRequest, mentorID string) (*dto.PaymentIntentResponse, error)
	GetPaymentIntent(paymentID string) (*dto.PaymentResponse, error)
	ConfirmPayment(req *dto.ConfirmPaymentRequest) (*dto.PaymentResponse, error)

	// Payment listing and history
	ListPayments(query *dto.ListPaymentsQuery) (*dto.PaymentListResponse, error)
	GetStudentPayments(email string, page, pageSize int) (*dto.PaymentListResponse, error)

	// Refunds
	RefundPayment(req *dto.RefundPaymentRequest) (*dto.PaymentResponse, error)

	// Webhook handling
	HandleStripeWebhook(eventID string, eventType string, data interface{}) error

	// Split management (internal)
	CalculatePaymentSplit(totalAmountCents int, splitPercentage float64) (*dto.PaymentSplitDTO, error)
}

type paymentUseCase struct {
	paymentRepo repositories.PaymentRepository
	mentorRepo  repositories.MentorRepository
	productRepo repositories.ProductRepository
	stripeCfg   config.StripeConfig
}

func NewPaymentUseCase(
	paymentRepo repositories.PaymentRepository,
	mentorRepo repositories.MentorRepository,
	productRepo repositories.ProductRepository,
	stripeCfg config.StripeConfig,
) PaymentUseCase {
	return &paymentUseCase{
		paymentRepo: paymentRepo,
		mentorRepo:  mentorRepo,
		productRepo: productRepo,
		stripeCfg:   stripeCfg,
	}
}

// CreatePaymentIntent creates a Stripe payment intent for a student payment
func (uc *paymentUseCase) CreatePaymentIntent(req *dto.CreatePaymentIntentRequest, mentorID string) (*dto.PaymentIntentResponse, error) {
	// Validate request
	if req.StudentEmail == "" || req.ProductID == "" || req.AmountCents <= 0 {
		return nil, errors.NewBadRequest("Invalid payment request")
	}

	// Get mentor to retrieve Stripe customer ID
	mentor, err := uc.mentorRepo.GetByID(mentorID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch mentor")
	}
	if mentor == nil {
		return nil, errors.NewNotFound("Mentor not found")
	}

	// Set default currency
	if req.Currency == "" {
		req.Currency = "brl"
	}

	// Create Stripe payment intent
	stripe.Key = uc.stripeCfg.SecretKey
	params := &stripe.PaymentIntentParams{
		Amount:      stripe.Int64(int64(req.AmountCents)),
		Currency:    stripe.String(req.Currency),
		Description: stripe.String(req.Description),
		Metadata: map[string]string{
			"student_email": req.StudentEmail,
			"product_id":    req.ProductID,
			"mentor_id":     mentorID,
		},
	}

	intent, err := paymentintent.New(params)
	if err != nil {
		return nil, errors.NewInternalServerError(fmt.Sprintf("Failed to create payment intent: %v", err))
	}

	// Create payment record in database
	now := time.Now()
	payment := &models.Payment{
		StudentEmail:          req.StudentEmail,
		ProductID:             req.ProductID,
		MentorID:              mentorID,
		StripePaymentIntentID: intent.ID,
		AmountCents:           req.AmountCents,
		Currency:              req.Currency,
		Status:                "pending",
		Description:           &req.Description,
		CreatedAt:             now,
		UpdatedAt:             now,
	}

	if err := uc.paymentRepo.Create(payment); err != nil {
		return nil, errors.NewInternalServerError("Failed to create payment record")
	}

	return &dto.PaymentIntentResponse{
		ID:                    payment.ID,
		StripePaymentIntentID: payment.StripePaymentIntentID,
		ClientSecret:          intent.ClientSecret,
		AmountCents:           payment.AmountCents,
		Currency:              payment.Currency,
		Status:                payment.Status,
		StudentEmail:          payment.StudentEmail,
		ProductID:             payment.ProductID,
		CreatedAt:             payment.CreatedAt.Format(time.RFC3339),
	}, nil
}

// GetPaymentIntent retrieves a payment intent by ID
func (uc *paymentUseCase) GetPaymentIntent(paymentID string) (*dto.PaymentResponse, error) {
	payment, err := uc.paymentRepo.GetByID(paymentID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch payment")
	}
	if payment == nil {
		return nil, errors.NewNotFound("Payment not found")
	}

	// Get payment split if exists
	split, err := uc.paymentRepo.GetSplitByPaymentID(paymentID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch payment split")
	}

	return uc.paymentToDTO(payment, split), nil
}

// ConfirmPayment confirms a payment with a payment method
func (uc *paymentUseCase) ConfirmPayment(req *dto.ConfirmPaymentRequest) (*dto.PaymentResponse, error) {
	// Get payment intent from database
	payment, err := uc.paymentRepo.GetByStripePaymentIntentID(req.PaymentIntentID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch payment")
	}
	if payment == nil {
		return nil, errors.NewNotFound("Payment not found")
	}

	stripe.Key = uc.stripeCfg.SecretKey
	form := &stripe.PaymentIntentConfirmParams{
		PaymentMethod: stripe.String(req.PaymentMethodID),
	}

	intent, err := paymentintent.Confirm(req.PaymentIntentID, form)
	if err != nil {
		payment.Status = "failed"
		uc.paymentRepo.Update(payment)
		return nil, errors.NewBadRequest(fmt.Sprintf("Payment confirmation failed: %v", err))
	}

	payment.Status = mapStripeStatus(intent.Status)
	now := time.Now()
	payment.UpdatedAt = now
	if intent.Status == stripe.PaymentIntentStatusSucceeded {
		payment.SucceededAt = &now
		payment.Status = "succeeded"

		mentor, err := uc.mentorRepo.GetByID(payment.MentorID)
		if err != nil {
			return nil, errors.NewInternalServerError("Failed to fetch mentor for split")
		}
		splitPercentage := mentor.RevenueShare
		split := &models.PaymentSplit{
			PaymentID:         payment.ID,
			MentorID:          payment.MentorID,
			PlatformFeeCents:  int(float64(payment.AmountCents) * (1 - splitPercentage/100)),
			MentorAmountCents: int(float64(payment.AmountCents) * splitPercentage / 100),
			SplitPercentage:   splitPercentage,
		}
		if err := uc.paymentRepo.CreateSplit(split); err != nil {
			return nil, errors.NewInternalServerError("Failed to create payment split")
		}
	}

	if err := uc.paymentRepo.Update(payment); err != nil {
		return nil, errors.NewInternalServerError("Failed to update payment")
	}

	split, err := uc.paymentRepo.GetSplitByPaymentID(payment.ID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch payment split")
	}

	return uc.paymentToDTO(payment, split), nil
}

// ListPayments lists payments with filters
func (uc *paymentUseCase) ListPayments(query *dto.ListPaymentsQuery) (*dto.PaymentListResponse, error) {
	filter := make(map[string]interface{})
	if query.StudentEmail != nil {
		filter["student_email"] = *query.StudentEmail
	}
	if query.ProductID != nil {
		filter["product_id"] = *query.ProductID
	}
	if query.Status != nil {
		filter["status"] = *query.Status
	}

	payments, total, err := uc.paymentRepo.List(filter, query.Page, query.PageSize)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to list payments")
	}

	var data []dto.PaymentResponse
	for _, payment := range payments {
		split, err := uc.paymentRepo.GetSplitByPaymentID(payment.ID)
		if err != nil {
			continue
		}
		data = append(data, *uc.paymentToDTO(&payment, split))
	}

	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return &dto.PaymentListResponse{
		Data:       data,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: totalPages,
	}, nil
}

// GetStudentPayments retrieves all payments for a student
func (uc *paymentUseCase) GetStudentPayments(email string, page, pageSize int) (*dto.PaymentListResponse, error) {
	payments, total, err := uc.paymentRepo.GetByStudentEmail(email, page, pageSize)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch student payments")
	}

	var data []dto.PaymentResponse
	for _, payment := range payments {
		split, err := uc.paymentRepo.GetSplitByPaymentID(payment.ID)
		if err != nil {
			continue
		}
		data = append(data, *uc.paymentToDTO(&payment, split))
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	return &dto.PaymentListResponse{
		Data:       data,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// RefundPayment refunds a payment
func (uc *paymentUseCase) RefundPayment(req *dto.RefundPaymentRequest) (*dto.PaymentResponse, error) {
	payment, err := uc.paymentRepo.GetByID(req.PaymentID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch payment")
	}
	if payment == nil {
		return nil, errors.NewNotFound("Payment not found")
	}

	if payment.Status != "succeeded" {
		return nil, errors.NewBadRequest("Only succeeded payments can be refunded")
	}

	stripe.Key = uc.stripeCfg.SecretKey
	_, err = paymentintent.Get(payment.StripePaymentIntentID, nil)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to get Stripe payment intent")
	}

	payment.Status = "refunded"
	now := time.Now()
	payment.UpdatedAt = now
	if err := uc.paymentRepo.Update(payment); err != nil {
		return nil, errors.NewInternalServerError("Failed to update payment")
	}

	split, err := uc.paymentRepo.GetSplitByPaymentID(payment.ID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch payment split")
	}

	return uc.paymentToDTO(payment, split), nil
}

// HandleStripeWebhook handles incoming Stripe webhook events
func (uc *paymentUseCase) HandleStripeWebhook(eventID string, eventType string, data interface{}) error {
	// Check if webhook already processed
	existing, err := uc.paymentRepo.GetWebhookByStripeEventID(eventID)
	if err != nil {
		return errors.NewInternalServerError("Failed to check webhook")
	}
	if existing != nil {
		return nil // Already processed
	}

	// Convert data to JSON
	rawData, _ := json.Marshal(data)
	if len(rawData) == 0 {
		rawData = []byte("{}")
	}
	webhook := &models.PaymentWebhook{
		StripeEventID: eventID,
		EventType:     eventType,
		RawData:       rawData,
		Processed:     false,
	}

	if err := uc.paymentRepo.CreateWebhook(webhook); err != nil {
		return errors.NewInternalServerError("Failed to create webhook record")
	}

	// Process based on event type
	switch eventType {
	case "payment_intent.succeeded":
		// Payment successful - already handled in ConfirmPayment
		webhook.Processed = true
	case "payment_intent.payment_failed":
		// Payment failed
		webhook.Processed = true
	case "charge.refunded":
		// Refund processed
		webhook.Processed = true
	}

	if err := uc.paymentRepo.UpdateWebhook(webhook); err != nil {
		return errors.NewInternalServerError("Failed to update webhook")
	}

	return nil
}

// CalculatePaymentSplit calculates the split between mentor and platform
func (uc *paymentUseCase) CalculatePaymentSplit(totalAmountCents int, splitPercentage float64) (*dto.PaymentSplitDTO, error) {
	if splitPercentage < 0 || splitPercentage > 100 {
		return nil, errors.NewBadRequest("Split percentage must be between 0 and 100")
	}

	mentorAmount := int(float64(totalAmountCents) * splitPercentage / 100)
	platformFee := totalAmountCents - mentorAmount

	return &dto.PaymentSplitDTO{
		MentorAmountCents: mentorAmount,
		PlatformFeeCents:  platformFee,
		SplitPercentage:   splitPercentage,
	}, nil
}

// Helper functions

func (uc *paymentUseCase) paymentToDTO(payment *models.Payment, split *models.PaymentSplit) *dto.PaymentResponse {
	var splitDTO *dto.PaymentSplitDTO
	if split != nil {
		splitDTO = &dto.PaymentSplitDTO{
			ID:                split.ID,
			PaymentID:         split.PaymentID,
			MentorID:          split.MentorID,
			PlatformFeeCents:  split.PlatformFeeCents,
			MentorAmountCents: split.MentorAmountCents,
			SplitPercentage:   split.SplitPercentage,
			TransferStatus:    split.TransferStatus,
		}
	}

	return &dto.PaymentResponse{
		ID:                    payment.ID,
		StudentEmail:          payment.StudentEmail,
		ProductID:             payment.ProductID,
		MentorID:              payment.MentorID,
		StripePaymentIntentID: payment.StripePaymentIntentID,
		AmountCents:           payment.AmountCents,
		Currency:              payment.Currency,
		Status:                payment.Status,
		PaymentMethod:         payment.PaymentMethod,
		PaymentSplit:          splitDTO,
		CreatedAt:             payment.CreatedAt.Format(time.RFC3339),
		UpdatedAt:             payment.UpdatedAt.Format(time.RFC3339),
		SucceededAt:           formatTime(payment.SucceededAt),
	}
}

func mapStripeStatus(status stripe.PaymentIntentStatus) string {
	switch status {
	case stripe.PaymentIntentStatusProcessing:
		return "processing"
	case stripe.PaymentIntentStatusSucceeded:
		return "succeeded"
	case stripe.PaymentIntentStatusRequiresPaymentMethod:
		return "pending"
	case stripe.PaymentIntentStatusRequiresConfirmation:
		return "pending"
	case stripe.PaymentIntentStatusRequiresAction:
		return "pending"
	case stripe.PaymentIntentStatusCanceled:
		return "failed"
	default:
		return "pending"
	}
}

func formatTime(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339)
	return &s
}
