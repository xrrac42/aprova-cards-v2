package handlers

import (
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
	var payload dto.KiwifyWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Printf("[kiwify-webhook] failed to parse payload: %v", err)
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "Invalid payload"})
		return
	}

	// Only process paid orders
	if payload.OrderStatus != "paid" {
		c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Event ignored"})
		return
	}

	if payload.Buyer.Email == "" {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "Missing buyer email"})
		return
	}

	currency := payload.Payment.Currency
	if currency == "" {
		currency = "brl"
	}

	req := &dto.ActivateFromKiwifyRequest{
		StudentEmail:  payload.Buyer.Email,
		KiwifyOrderID: payload.OrderID,
		AmountCents:   payload.Payment.Amount,
		Currency:      currency,
	}

	if err := h.studentSignUpUsecase.ActivateFromKiwify(req); err != nil {
		log.Printf("[kiwify-webhook] activation failed for %s: %v", payload.Buyer.Email, err)
		// Return 200 to avoid infinite retries from Kiwify
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: false,
			Message: "Activation failed: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Student access activated"})
}
