package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/gin-gonic/gin"
)

type PaymentHandler struct {
	usecase usecases.PaymentUseCase
}

func NewPaymentHandler(uc usecases.PaymentUseCase) *PaymentHandler {
	return &PaymentHandler{usecase: uc}
}

// CreatePaymentIntent creates a new payment intent
// POST /payments/intents
func (h *PaymentHandler) CreatePaymentIntent(c *gin.Context) {
	var req dto.CreatePaymentIntentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	// Get mentor ID from context (should be set by auth middleware)
	mentorID, exists := c.Get("mentor_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "Unauthorized"})
		return
	}

	result, err := h.usecase.CreatePaymentIntent(&req, mentorID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Data: result, Message: "Payment intent created"})
}

// GetPaymentIntent retrieves a payment intent by ID
// GET /payments/:id
func (h *PaymentHandler) GetPaymentIntent(c *gin.Context) {
	paymentID := c.Param("id")
	result, err := h.usecase.GetPaymentIntent(paymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result})
}

// ConfirmPayment confirms a payment with a payment method
// POST /payments/:id/confirm
func (h *PaymentHandler) ConfirmPayment(c *gin.Context) {
	var req dto.ConfirmPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	result, err := h.usecase.ConfirmPayment(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result, Message: "Payment confirmed"})
}

// ListPayments lists payments with filters
// GET /payments
func (h *PaymentHandler) ListPayments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	query := &dto.ListPaymentsQuery{
		Page:     page,
		PageSize: pageSize,
	}

	// Optional filters
	if studentEmail := c.Query("student_email"); studentEmail != "" {
		query.StudentEmail = &studentEmail
	}
	if productID := c.Query("product_id"); productID != "" {
		query.ProductID = &productID
	}
	if status := c.Query("status"); status != "" {
		query.Status = &status
	}

	result, err := h.usecase.ListPayments(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result})
}

// GetStudentPayments retrieves all payments for a student
// GET /payments/student/:email
func (h *PaymentHandler) GetStudentPayments(c *gin.Context) {
	email := c.Param("email")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	result, err := h.usecase.GetStudentPayments(email, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result})
}

// RefundPayment refunds a payment
// POST /payments/:id/refund
func (h *PaymentHandler) RefundPayment(c *gin.Context) {
	paymentID := c.Param("id")

	var req dto.RefundPaymentRequest
	req.PaymentID = paymentID
	if err := c.ShouldBindJSON(&req); err != nil {
		// It's okay if there's no body, we just need the payment ID
	}

	result, err := h.usecase.RefundPayment(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result, Message: "Payment refunded"})
}

// HandleWebhook handles Stripe webhook events
// POST /webhooks/stripe
func (h *PaymentHandler) HandleWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "Invalid request body"})
		return
	}

	var event map[string]interface{}
	if err := json.Unmarshal(body, &event); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "Invalid JSON"})
		return
	}

	eventID, ok := event["id"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "Missing event ID"})
		return
	}

	eventType, ok := event["type"].(string)
	if !ok {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "Missing event type"})
		return
	}

	data := event["data"]
	if err := h.usecase.HandleStripeWebhook(eventID, eventType, data); err != nil {
		// Log error but still return 200 to acknowledge receipt
		c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Webhook received"})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Webhook processed"})
}

// CalculatePaymentSplit calculates the split between mentor and platform
// POST /payments/calculate-split
func (h *PaymentHandler) CalculatePaymentSplit(c *gin.Context) {
	var req struct {
		TotalAmountCents int     `json:"total_amount_cents" binding:"required,gt=0"`
		SplitPercentage  float64 `json:"split_percentage" binding:"required,min=0,max=100"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	result, err := h.usecase.CalculatePaymentSplit(req.TotalAmountCents, req.SplitPercentage)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result})
}
