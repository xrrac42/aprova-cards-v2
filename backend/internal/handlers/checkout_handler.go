package handlers

import (
	"fmt"
	"net/http"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/approva-cards/back-aprova-cards/pkg/email"
	"github.com/gin-gonic/gin"
)

type CheckoutHandler struct {
	studentSignUpUsecase usecases.StudentSignUpUseCase
	productUsecase       usecases.ProductUseCase
	mentorUsecase        usecases.MentorUseCase
	emailService         email.EmailService
	frontendBaseURL      string
}

func NewCheckoutHandler(
	studentSignUpUC usecases.StudentSignUpUseCase,
	productUC usecases.ProductUseCase,
	mentorUC usecases.MentorUseCase,
	emailSvc email.EmailService,
	frontendBaseURL string,
) *CheckoutHandler {
	return &CheckoutHandler{
		studentSignUpUsecase: studentSignUpUC,
		productUsecase:       productUC,
		mentorUsecase:        mentorUC,
		emailService:         emailSvc,
		frontendBaseURL:      frontendBaseURL,
	}
}

// POST /welcome-email
func (h *CheckoutHandler) SendWelcomeEmail(c *gin.Context) {
	var req dto.WelcomeEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	mentorSlug := fmt.Sprintf("%s", req.MentorName)
	loginURL := fmt.Sprintf("%s/login/%s", h.frontendBaseURL, mentorSlug)

	err := h.emailService.SendWelcomeEmail(
		req.StudentEmail,
		req.MentorName,
		req.ProductName,
		loginURL,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{
			Success: false,
			Error:   "Failed to send welcome email",
		})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Message: "Welcome email sent successfully",
	})
}
