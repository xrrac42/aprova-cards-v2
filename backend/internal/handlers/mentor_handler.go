package handlers

import (
	"net/http"
	"strconv"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/gin-gonic/gin"
)

type MentorHandler struct{ usecase usecases.MentorUseCase }

func NewMentorHandler(usecase usecases.MentorUseCase) *MentorHandler {
	return &MentorHandler{usecase: usecase}
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
