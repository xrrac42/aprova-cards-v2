package handlers

import (
	"fmt"
	"net/http"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/approva-cards/back-aprova-cards/pkg/email"
	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v79"
	"github.com/stripe/stripe-go/v79/checkout/session"
)

type CheckoutHandler struct {
	studentSignUpUsecase usecases.StudentSignUpUseCase
	productUsecase       usecases.ProductUseCase
	mentorUsecase        usecases.MentorUseCase
	emailService         email.EmailService
	stripeSecretKey      string
	frontendBaseURL      string
}

func NewCheckoutHandler(
	studentSignUpUC usecases.StudentSignUpUseCase,
	productUC usecases.ProductUseCase,
	mentorUC usecases.MentorUseCase,
	emailSvc email.EmailService,
	stripeSecretKey string,
	frontendBaseURL string,
) *CheckoutHandler {
	return &CheckoutHandler{
		studentSignUpUsecase: studentSignUpUC,
		productUsecase:       productUC,
		mentorUsecase:        mentorUC,
		emailService:         emailSvc,
		stripeSecretKey:      stripeSecretKey,
		frontendBaseURL:      frontendBaseURL,
	}
}

// GET /checkout/session-info?session_id=xxx
func (h *CheckoutHandler) GetSessionInfo(c *gin.Context) {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "session_id is required",
		})
		return
	}

	// Retrieve Stripe Checkout Session
	stripe.Key = h.stripeSecretKey
	sess, err := session.Get(sessionID, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Failed to retrieve session",
		})
		return
	}

	// Extract mentor_id and product_id from metadata
	mentorID := sess.Metadata["mentor_id"]
	productID := sess.Metadata["product_id"]
	studentEmail := sess.Metadata["student_email"]

	if mentorID == "" || productID == "" {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   "Session metadata incomplete",
		})
		return
	}

	// Get mentor info
	mentor, err := h.mentorUsecase.GetByID(mentorID)
	if err != nil || mentor == nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{
			Success: false,
			Error:   "Mentor not found",
		})
		return
	}

	// Get product info
	product, err := h.productUsecase.GetByID(productID)
	if err != nil || product == nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{
			Success: false,
			Error:   "Product not found",
		})
		return
	}

	response := dto.CheckoutSessionInfoResponse{
		MentorName:   mentor.Name,
		ProductName:  product.Name,
		StudentEmail: studentEmail,
		AmountCents:  int(sess.AmountTotal),
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data:    response,
	})
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

	// Build login URL with mentor slug
	mentorSlug := fmt.Sprintf("%s", req.MentorName)
	loginURL := fmt.Sprintf("%s/login/%s", h.frontendBaseURL, mentorSlug)

	// Send welcome email
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
