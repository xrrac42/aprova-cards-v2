package handlers

import (
	"net/http"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
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
