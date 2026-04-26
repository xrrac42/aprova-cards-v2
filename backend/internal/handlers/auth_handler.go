package handlers

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	apperrors "github.com/approva-cards/back-aprova-cards/pkg/errors"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	usecase   usecases.AuthUseCase
	jwtSecret string
	jwtExp    int
}

func NewAuthHandler(usecase usecases.AuthUseCase, jwtSecret string, jwtExp int) *AuthHandler {
	return &AuthHandler{usecase: usecase, jwtSecret: jwtSecret, jwtExp: jwtExp}
}

func (h *AuthHandler) AdminLogin(c *gin.Context) {
	var req dto.AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	response, err := h.usecase.AdminLogin(&req, h.jwtSecret, h.jwtExp)
	if err != nil {
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "invalid credentials"})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: response, Message: "Login successful"})
}

type supabaseJWTClaims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
}

func (h *AuthHandler) ValidateStudentPortalAccess(c *gin.Context) {
	var req struct {
		Slug string `json:"slug" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	studentClaims, err := extractSupabaseClaims(c.GetHeader("Authorization"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "token inválido"})
		return
	}

	err = h.usecase.ValidateStudentPortalAccess(req.Slug, studentClaims.Sub, studentClaims.Email)
	if err != nil {
		if appErr, ok := err.(*apperrors.AppError); ok {
			c.JSON(appErr.Status, dto.APIResponse{Success: false, Error: appErr.Message})
			return
		}
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Acesso autorizado."})
}

func extractSupabaseClaims(authorizationHeader string) (*supabaseJWTClaims, error) {
	parts := strings.SplitN(authorizationHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return nil, apperrors.NewUnauthorized("invalid authorization format")
	}

	tokenParts := strings.Split(parts[1], ".")
	if len(tokenParts) < 2 {
		return nil, apperrors.NewUnauthorized("invalid token")
	}

	payload, err := base64.RawURLEncoding.DecodeString(tokenParts[1])
	if err != nil {
		return nil, apperrors.NewUnauthorized("invalid token")
	}

	var claims supabaseJWTClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, apperrors.NewUnauthorized("invalid token")
	}

	if strings.TrimSpace(claims.Sub) == "" {
		return nil, apperrors.NewUnauthorized("invalid token")
	}

	return &claims, nil
}
