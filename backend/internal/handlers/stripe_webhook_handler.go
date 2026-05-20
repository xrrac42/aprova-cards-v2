package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/gin-gonic/gin"
)

type KiwifyWebhookHandler struct {
	studentSignUpUsecase usecases.StudentSignUpUseCase
}

func NewKiwifyWebhookHandler(studentSignUpUC usecases.StudentSignUpUseCase) *KiwifyWebhookHandler {
	return &KiwifyWebhookHandler{studentSignUpUsecase: studentSignUpUC}
}

// POST /webhooks/kiwify
func (h *KiwifyWebhookHandler) HandleWebhookEvent(c *gin.Context) {
	rawBody, _ := io.ReadAll(c.Request.Body)
	log.Printf("[kiwify-webhook] raw body: %s", string(rawBody))

	var payload dto.KiwifyWebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		log.Printf("[kiwify-webhook] failed to parse payload: %v", err)
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "Invalid payload"})
		return
	}

	order := payload.Order
	log.Printf("[kiwify-webhook] event=%s order_id=%s status=%s email=%s", order.WebhookEventType, order.OrderID, order.OrderStatus, order.Customer.Email)

	// Only process approved orders
	if order.WebhookEventType != "order_approved" && order.OrderStatus != "paid" {
		c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Event ignored"})
		return
	}

	if order.Customer.Email == "" {
		log.Printf("[kiwify-webhook] missing customer email, order_id=%s", order.OrderID)
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "Missing customer email"})
		return
	}

	currency := order.Commissions.Currency
	if currency == "" {
		currency = "BRL"
	}

	req := &dto.ActivateFromKiwifyRequest{
		StudentEmail:  order.Customer.Email,
		KiwifyOrderID: order.OrderID,
		AmountCents:   order.Commissions.ChargeAmount,
		Currency:      currency,
	}

	if err := h.studentSignUpUsecase.ActivateFromKiwify(req); err != nil {
		log.Printf("[kiwify-webhook] activation failed for %s: %v", order.Customer.Email, err)
		// Return 200 to avoid infinite retries from Kiwify
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: false,
			Message: "Activation failed: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Student access activated"})
}
