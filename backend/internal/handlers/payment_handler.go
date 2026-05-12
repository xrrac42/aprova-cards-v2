package handlers

import (
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

// GET /payments
func (h *PaymentHandler) ListPayments(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	query := &dto.ListPaymentsQuery{
		Page:     page,
		PageSize: pageSize,
	}

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
