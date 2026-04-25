package handlers

import (
	"net/http"
	"strconv"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/gin-gonic/gin"
)

type StudentSignUpHandler struct {
	usecase usecases.StudentSignUpUseCase
}

func NewStudentSignUpHandler(uc usecases.StudentSignUpUseCase) *StudentSignUpHandler {
	return &StudentSignUpHandler{usecase: uc}
}

// GenerateInvitation generates an invitation link for a student
// POST /invitations/generate
func (h *StudentSignUpHandler) GenerateInvitation(c *gin.Context) {
	var req dto.GenerateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	// Get mentor ID from context (set by auth middleware)
	mentorID, exists := c.Get("mentor_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "Unauthorized"})
		return
	}

	result, err := h.usecase.GenerateInvitation(&req, mentorID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Data: result, Message: "Invitation generated"})
}

// GetInvitation retrieves an invitation by ID
// GET /invitations/:id
func (h *StudentSignUpHandler) GetInvitation(c *gin.Context) {
	invitationID := c.Param("id")
	result, err := h.usecase.GetInvitation(invitationID)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result})
}

// ListInvitations lists all invitations for the mentor
// GET /invitations?page=1&page_size=20&product_id=...&status=...
func (h *StudentSignUpHandler) ListInvitations(c *gin.Context) {
	mentorID, exists := c.Get("mentor_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "Unauthorized"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	result, err := h.usecase.ListMentorInvitations(mentorID.(string), page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result})
}

// ValidateInviteCode validates an invitation code
// POST /invitations/validate
func (h *StudentSignUpHandler) ValidateInviteCode(c *gin.Context) {
	var req dto.ValidateInviteCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	result, err := h.usecase.ValidateInviteCode(req.InviteCode)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result})
}

// InitiateStudentSignUp initiates the student signup process
// POST /auth/signup/initiate
func (h *StudentSignUpHandler) InitiateStudentSignUp(c *gin.Context) {
	var req dto.StudentSignUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	result, err := h.usecase.InitiateStudentSignUp(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result, Message: "Sign up initiated"})
}

// CompleteStudentSignUp completes the signup after payment is approved
// POST /auth/signup/complete
func (h *StudentSignUpHandler) CompleteStudentSignUp(c *gin.Context) {
	var req dto.CompleteStudentSignUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	result, err := h.usecase.CompleteStudentSignUp(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Data: result, Message: "Sign up completed"})
}

// GetStudentAuth retrieves student auth information
// GET /auth/student/:email
func (h *StudentSignUpHandler) GetStudentAuth(c *gin.Context) {
	email := c.Param("email")
	result, err := h.usecase.GetStudentAuth(email)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: result})
}
