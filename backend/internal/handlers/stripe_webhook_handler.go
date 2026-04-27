package handlers

import (
	"encoding/json"
	"io"
	"log"
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
	paymentUC usecases.PaymentUseCase,
	studentSignUpUC usecases.StudentSignUpUseCase,
) *StripeWebhookHandler {
	return &StripeWebhookHandler{
		paymentUsecase:       paymentUC,
		studentSignUpUsecase: studentSignUpUC,
	}
}

// POST /webhooks/stripe
func (h *StripeWebhookHandler) HandleWebhookEvent(c *gin.Context) {
	endpointSecret := os.Getenv("STRIPE_WEBHOOK_SECRET")
	if endpointSecret == "" {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Webhook secret not configured",
		})
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Failed to read request body",
		})
		return
	}

	sigHeader := c.GetHeader("Stripe-Signature")
	if sigHeader == "" {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Missing Stripe signature",
		})
		return
	}

	event, err := webhook.ConstructEventWithOptions(body, sigHeader, endpointSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})
	if err != nil {
		log.Printf("[webhook] ConstructEvent failed: %v", err)
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Invalid webhook signature",
		})
		return
	}

	h.processEvent(c, event)
}

func (h *StripeWebhookHandler) processEvent(c *gin.Context, event stripe.Event) {
	switch event.Type {

	case "checkout.session.completed":
		h.handleCheckoutSessionCompleted(c, event)

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
			Message: "Webhook recebido",
		})
	}
}

// 🔥 CORRIGIDO: fluxo único de checkout
func (h *StripeWebhookHandler) handleCheckoutSessionCompleted(c *gin.Context, event stripe.Event) {
	var session stripe.CheckoutSession

	if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
		log.Printf("Erro ao parsear checkout session: %v", err)
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Invalid checkout session",
		})
		return
	}

	if session.Metadata == nil {
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: true,
			Message: "No metadata",
		})
		return
	}

	inviteCode := session.Metadata["invite_code"]

	studentEmail := ""
	if v, ok := session.Metadata["student_email"]; ok {
		studentEmail = v
	}
	if session.CustomerDetails != nil {
		if studentEmail == "" {
			studentEmail = session.CustomerDetails.Email
		}
	}

	if inviteCode == "" || studentEmail == "" {
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: true,
			Message: "Missing invite_code or email",
		})
		return
	}

	subscriptionID := ""
	if session.Subscription != nil {
		subscriptionID = session.Subscription.ID
	}

	req := &dto.ActivateFromCheckoutRequest{
		InviteCode:           inviteCode,
		StudentEmail:         studentEmail,
		AmountCents:          int(session.AmountTotal),
		Currency:             string(session.Currency),
		StripeSessionID:      session.ID,
		StripeSubscriptionID: subscriptionID,
	}

	if err := h.studentSignUpUsecase.ActivateFromCheckout(req); err != nil {
		log.Printf("Erro ao ativar acesso: %v", err)

		// ⚠️ Importante: retorna 200 pra evitar retry infinito
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: false,
			Message: "Activation failed: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Student access activated",
	})
}

// ---------------- PAYMENT ----------------

func (h *StripeWebhookHandler) handlePaymentIntentSucceeded(c *gin.Context, event stripe.Event) {
	var paymentIntent stripe.PaymentIntent

	if err := json.Unmarshal(event.Data.Raw, &paymentIntent); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Failed to parse payment intent",
		})
		return
	}

	if paymentIntent.Metadata == nil {
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: true,
			Message: "No metadata",
		})
		return
	}

	studentEmail := paymentIntent.Metadata["student_email"]
	productID := paymentIntent.Metadata["product_id"]
	inviteCode := paymentIntent.Metadata["invite_code"]
	fullName := paymentIntent.Metadata["full_name"]

	err := h.paymentUsecase.HandleStripeWebhook(
		event.ID,
		string(event.Type),
		map[string]interface{}{
			"payment_intent": paymentIntent,
			"student_email":  studentEmail,
			"product_id":     productID,
		},
	)

	if err != nil {
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: true,
			Message: "Processed with error",
		})
		return
	}

	// fluxo complementar de signup
	if inviteCode != "" && h.studentSignUpUsecase != nil {
		req := &dto.CompleteStudentSignUpRequest{
			PaymentID:  paymentIntent.ID,
			InviteCode: inviteCode,
			Email:      studentEmail,
			FullName:   fullName,
		}

		_, _ = h.studentSignUpUsecase.CompleteStudentSignUp(req)
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Payment processed",
	})
}

func (h *StripeWebhookHandler) handlePaymentIntentFailed(c *gin.Context, event stripe.Event) {
	var paymentIntent stripe.PaymentIntent
	_ = json.Unmarshal(event.Data.Raw, &paymentIntent)

	_ = h.paymentUsecase.HandleStripeWebhook(
		event.ID,
		string(event.Type),
		map[string]interface{}{
			"payment_intent": paymentIntent,
		},
	)

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Payment failure processed",
	})
}

func (h *StripeWebhookHandler) handleChargeRefunded(c *gin.Context, event stripe.Event) {
	var charge stripe.Charge
	_ = json.Unmarshal(event.Data.Raw, &charge)

	_ = h.paymentUsecase.HandleStripeWebhook(
		event.ID,
		string(event.Type),
		map[string]interface{}{
			"charge": charge,
		},
	)

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Refund processed",
	})
}

func (h *StripeWebhookHandler) handleSubscriptionUpdated(c *gin.Context, event stripe.Event) {
	var subscription stripe.Subscription
	_ = json.Unmarshal(event.Data.Raw, &subscription)

	_ = h.paymentUsecase.HandleStripeWebhook(
		event.ID,
		string(event.Type),
		map[string]interface{}{
			"subscription": subscription,
		},
	)

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Subscription updated",
	})
}

func (h *StripeWebhookHandler) handleSubscriptionDeleted(c *gin.Context, event stripe.Event) {
	var subscription stripe.Subscription
	_ = json.Unmarshal(event.Data.Raw, &subscription)

	_ = h.paymentUsecase.HandleStripeWebhook(
		event.ID,
		string(event.Type),
		map[string]interface{}{
			"subscription": subscription,
		},
	)

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Subscription deleted",
	})
}
