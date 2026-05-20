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

	// Only process paid orders
	if payload.OrderStatus != "paid" {
		c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Event ignored"})
		return
	}

	if payload.Customer.Email == "" {
		log.Printf("[kiwify-webhook] missing customer email, order_id=%s order_status=%s", payload.OrderID, payload.OrderStatus)
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "Missing customer email"})
		return
	}

	currency := payload.Payment.Currency
	if currency == "" {
		currency = "brl"
	}

	req := &dto.ActivateFromKiwifyRequest{
		StudentEmail:  payload.Customer.Email,
		KiwifyOrderID: payload.OrderID,
		AmountCents:   payload.Payment.Amount,
		Currency:      currency,
	}

	if err := h.studentSignUpUsecase.ActivateFromKiwify(req); err != nil {
		log.Printf("[kiwify-webhook] activation failed for %s: %v", payload.Customer.Email, err)
		// Return 200 to avoid infinite retries from Kiwify
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: false,
			Message: "Activation failed: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Student access activated"})
}
