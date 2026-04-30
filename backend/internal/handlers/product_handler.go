package handlers

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	appauth "github.com/approva-cards/back-aprova-cards/pkg/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ProductHandler struct {
	usecase        usecases.ProductUseCase
	db             *gorm.DB
	supabaseClient *appauth.SupabaseAdminClient
}

func NewProductHandler(uc usecases.ProductUseCase, db *gorm.DB, supabaseClient *appauth.SupabaseAdminClient) *ProductHandler {
	return &ProductHandler{usecase: uc, db: db, supabaseClient: supabaseClient}
}

func (h *ProductHandler) Create(c *gin.Context) {
	var req dto.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	r, err := h.usecase.Create(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Data: r, Message: "Product created"})
}

func (h *ProductHandler) GetAll(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	mentorID := c.Query("mentor_id")
	var r *dto.PaginatedResponse
	var err error
	if mentorID != "" {
		r, err = h.usecase.GetByMentorID(mentorID, page, ps)
	} else {
		r, err = h.usecase.GetAll(page, ps)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r})
}

func (h *ProductHandler) GetByID(c *gin.Context) {
	r, err := h.usecase.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r})
}

func (h *ProductHandler) Update(c *gin.Context) {
	var req dto.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	r, err := h.usecase.Update(c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r, Message: "Product updated"})
}

func (h *ProductHandler) Delete(c *gin.Context) {
	if err := h.usecase.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *ProductHandler) CreateByAdmin(c *gin.Context) {
	if _, ok := h.requireAdminBySupabaseToken(c); !ok {
		return
	}
	var req dto.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	r, err := h.usecase.Create(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Data: r, Message: "Product created"})
}

func (h *ProductHandler) UpdateByAdmin(c *gin.Context) {
	if _, ok := h.requireAdminBySupabaseToken(c); !ok {
		return
	}
	var req dto.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	r, err := h.usecase.Update(c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r, Message: "Product updated"})
}

func (h *ProductHandler) GetByIDByAdmin(c *gin.Context) {
	if _, ok := h.requireAdminBySupabaseToken(c); !ok {
		return
	}
	h.GetByID(c)
}

func (h *ProductHandler) requireAdminBySupabaseToken(c *gin.Context) (string, bool) {
	if h.db == nil || h.supabaseClient == nil || !h.supabaseClient.IsConfigured() {
		reason := "product admin endpoint unavailable"
		if h.supabaseClient != nil {
			reason = h.supabaseClient.ConfigDiagnostic()
		}
		log.Printf("[product-admin] unavailable: %s", reason)
		c.JSON(http.StatusServiceUnavailable, dto.APIResponse{Success: false, Error: "product admin endpoint unavailable", Message: reason})
		return "", false
	}

	bearerToken := extractBearerTokenFromHeader(c.GetHeader("Authorization"))
	if bearerToken == "" {
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "missing authorization token"})
		return "", false
	}

	caller, err := h.supabaseClient.GetUserFromAccessToken(bearerToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "invalid auth token"})
		return "", false
	}

	var role models.UserRole
	err = h.db.Where("LOWER(email) = ? AND role = ? AND active = ?", strings.ToLower(strings.TrimSpace(caller.Email)), "admin", true).First(&role).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusForbidden, dto.APIResponse{Success: false, Error: "admin access required"})
			return "", false
		}
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: "failed to validate admin access"})
		return "", false
	}

	return caller.Email, true
}

func extractBearerTokenFromHeader(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}
