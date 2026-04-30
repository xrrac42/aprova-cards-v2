package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	appauth "github.com/approva-cards/back-aprova-cards/pkg/auth"
	"github.com/gin-gonic/gin"
)

type MentorHandler struct {
	usecase        usecases.MentorUseCase
	adminUseCase   usecases.AdminMentorUseCase
	supabaseClient *appauth.SupabaseAdminClient
}

func NewMentorHandler(usecase usecases.MentorUseCase, adminUseCase usecases.AdminMentorUseCase, supabaseClient *appauth.SupabaseAdminClient) *MentorHandler {
	return &MentorHandler{usecase: usecase, adminUseCase: adminUseCase, supabaseClient: supabaseClient}
}

func (h *MentorHandler) Create(c *gin.Context) {
	var req dto.CreateMentorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	r, err := h.usecase.Create(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Data: r, Message: "Mentor created"})
}

func (h *MentorHandler) GetAll(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	r, err := h.usecase.GetAll(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r})
}

func (h *MentorHandler) GetByID(c *gin.Context) {
	r, err := h.usecase.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r})
}

func (h *MentorHandler) Update(c *gin.Context) {
	var req dto.UpdateMentorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	r, err := h.usecase.Update(c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r, Message: "Mentor updated"})
}

func (h *MentorHandler) Delete(c *gin.Context) {
	if err := h.usecase.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *MentorHandler) CreateProvisioned(c *gin.Context) {
	if h.adminUseCase == nil || h.supabaseClient == nil || !h.supabaseClient.IsConfigured() {
		reason := "admin usecase not initialized"
		if h.supabaseClient != nil {
			reason = h.supabaseClient.ConfigDiagnostic()
		}
		log.Printf("[mentor-provisioning] unavailable: %s", reason)
		c.JSON(http.StatusServiceUnavailable, dto.APIResponse{Success: false, Error: "mentor provisioning unavailable", Message: reason})
		return
	}

	var req dto.CreateMentorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	bearerToken := extractBearerToken(c.GetHeader("Authorization"))
	if bearerToken == "" {
		log.Printf("[mentor-provisioning] missing bearer token")
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "missing authorization token"})
		return
	}

	caller, err := h.supabaseClient.GetUserFromAccessToken(bearerToken)
	if err != nil {
		log.Printf("[mentor-provisioning] invalid auth token: %v", err)
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "invalid auth token"})
		return
	}

	r, err := h.adminUseCase.CreateMentorByAdmin(&req, caller.Email)
	if err != nil {
		log.Printf("[mentor-provisioning] create failed (caller=%s, email=%s): %v", caller.Email, req.Email, err)
		status := http.StatusBadRequest
		if strings.Contains(strings.ToLower(err.Error()), "admin access required") {
			status = http.StatusForbidden
		}
		c.JSON(status, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	log.Printf("[mentor-provisioning] success (caller=%s, mentor_id=%s, mentor_email=%s)", caller.Email, r.ID, r.Email)

	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Data: r, Message: "Mentor provisioned"})
}

func extractBearerToken(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}
