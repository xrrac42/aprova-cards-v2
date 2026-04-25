package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v79"
	"github.com/stripe/stripe-go/v79/webhook"
)

type StripeWebhookHandler struct {
	paymentUsecase       usecases.PaymentUseCase
	studentSignUpUsecase usecases.StudentSignUpUseCase
}

func NewStripeWebhookHandler(
	uc usecases.PaymentUseCase,
	studentSignUpUC usecases.StudentSignUpUseCase,
) *StripeWebhookHandler {
	return &StripeWebhookHandler{
		paymentUsecase:       uc,
		studentSignUpUsecase: studentSignUpUC,
	}
}

// HandleWebhookEvent handles incoming Stripe webhook events
// POST /webhooks/stripe
func (h *StripeWebhookHandler) HandleWebhookEvent(c *gin.Context) {
	// Get webhook secret from environment
	endpointSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
	if endpointSecret == "" {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Webhook secret not configured",
		})
		return
	}

	// Read request body
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Failed to read request body",
		})
		return
	}

	// Get Stripe signature from header
	sigHeader := c.GetHeader("Stripe-Signature")
	if sigHeader == "" {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Missing Stripe signature",
		})
		return
	}

	// Verify webhook signature
	event, err := webhook.ConstructEvent(body, sigHeader, endpointSecret)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Invalid webhook signature",
		})
		return
	}

	// Process the webhook event
	h.processEvent(c, event)
}

// processEvent processes the webhook event based on its type
func (h *StripeWebhookHandler) processEvent(c *gin.Context, event stripe.Event) {
	switch event.Type {
	case "payment_intent.succeeded":
		h.handlePaymentIntentSucceeded(c, event)
	case "payment_intent.payment_failed":
		h.handlePaymentIntentFailed(c, event)
	case "charge.refunded":
		h.handleChargeRefunded(c, event)
	case "customer.subscription.updated":
		h.handleSubscriptionUpdated(c, event)
	case "customer.subscription.deleted":
		h.handleSubscriptionDeleted(c, event)
	default:
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: true,
			Message: "Webhook received but not processed",
		})
	}
}

// handlePaymentIntentSucceeded handles successful payment intents
func (h *StripeWebhookHandler) handlePaymentIntentSucceeded(c *gin.Context, event stripe.Event) {
	var paymentIntent stripe.PaymentIntent
	if err := json.Unmarshal(event.Data.Raw, &paymentIntent); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Failed to parse payment intent",
		})
		return
	}

	// Extract metadata
	if paymentIntent.Metadata == nil {
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: true,
			Message: "Payment intent succeeded but no metadata",
		})
		return
	}

	studentEmail := paymentIntent.Metadata["student_email"]
	productID := paymentIntent.Metadata["product_id"]
	inviteCode := paymentIntent.Metadata["invite_code"]
	fullName := paymentIntent.Metadata["full_name"]

	if studentEmail == "" || productID == "" {
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: true,
			Message: "Payment intent succeeded but missing metadata",
		})
		return
	}

	// Handle the webhook event through the payment usecase
	err := h.paymentUsecase.HandleStripeWebhook(
		event.ID,
		event.Type,
		map[string]interface{}{
			"payment_intent": paymentIntent,
			"student_email":  studentEmail,
			"product_id":     productID,
		},
	)
	if err != nil {
		// Still return 200 to acknowledge webhook receipt
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: true,
			Message: "Webhook processed with error",
		})
		return
	}

	// If this is a student signup payment (has invite_code), complete the signup
	if inviteCode != "" && h.studentSignUpUsecase != nil {
		completeReq := &dto.CompleteStudentSignUpRequest{
			PaymentID:  paymentIntent.ID,
			InviteCode: inviteCode,
			Email:      studentEmail,
			FullName:   fullName,
		}

		_, err := h.studentSignUpUsecase.CompleteStudentSignUp(completeReq)
		if err != nil {
			// Log error but don't fail the webhook response
			// In a production system, this would be logged and monitored
		}
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Payment processed successfully",
	})
}

// handlePaymentIntentFailed handles failed payment intents
func (h *StripeWebhookHandler) handlePaymentIntentFailed(c *gin.Context, event stripe.Event) {
	var paymentIntent stripe.PaymentIntent
	if err := json.Unmarshal(event.Data.Raw, &paymentIntent); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Failed to parse payment intent",
		})
		return
	}

	err := h.paymentUsecase.HandleStripeWebhook(
		event.ID,
		event.Type,
		map[string]interface{}{
			"payment_intent": paymentIntent,
		},
	)
	if err != nil {
		// Log error but still return 200
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Payment failure processed",
	})
}

// handleChargeRefunded handles refunded charges
func (h *StripeWebhookHandler) handleChargeRefunded(c *gin.Context, event stripe.Event) {
	var charge stripe.Charge
	if err := json.Unmarshal(event.Data.Raw, &charge); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Failed to parse charge",
		})
		return
	}

	err := h.paymentUsecase.HandleStripeWebhook(
		event.ID,
		event.Type,
		map[string]interface{}{
			"charge": charge,
		},
	)
	if err != nil {
		// Log error but still return 200
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Refund processed",
	})
}

// handleSubscriptionUpdated handles subscription updates
func (h *StripeWebhookHandler) handleSubscriptionUpdated(c *gin.Context, event stripe.Event) {
	var subscription stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &subscription); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Failed to parse subscription",
		})
		return
	}

	err := h.paymentUsecase.HandleStripeWebhook(
		event.ID,
		event.Type,
		map[string]interface{}{
			"subscription": subscription,
		},
	)
	if err != nil {
		// Log error but still return 200
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Subscription updated",
	})
}

// handleSubscriptionDeleted handles subscription deletions
func (h *StripeWebhookHandler) handleSubscriptionDeleted(c *gin.Context, event stripe.Event) {
	var subscription stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &subscription); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Failed to parse subscription",
		})
		return
	}

	err := h.paymentUsecase.HandleStripeWebhook(
		event.ID,
		event.Type,
		map[string]interface{}{
			"subscription": subscription,
		},
	)
	if err != nil {
		// Log error but still return 200
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Subscription deleted",
	})
}

// VerifyWebhookSignature verifies that the webhook came from Stripe
func VerifyWebhookSignature(payload []byte, signature string, secret string) bool {
	hash := hmac.New(sha256.New, []byte(secret))
	hash.Write(payload)
	expectedSignature := hex.EncodeToString(hash.Sum(nil))
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// WebhookTestRequest generates a test webhook request for testing purposes
func (h *StripeWebhookHandler) WebhookTestRequest(c *gin.Context) {
	// This endpoint is only for testing - should be removed in production
	testEvent := map[string]interface{}{
		"id":   "evt_test_" + string(rune(int64(1))),
		"type": "payment_intent.succeeded",
		"data": map[string]interface{}{
			"object": map[string]interface{}{
				"id":     "pi_test_123",
				"status": "succeeded",
				"metadata": map[string]string{
					"student_email": "test@example.com",
					"product_id":    "prod_test_123",
				},
			},
		},
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data:    testEvent,
		Message: "Test webhook event",
	})
}
