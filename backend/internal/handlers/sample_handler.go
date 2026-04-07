package handlers

import (
	"net/http"
	"strconv"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/gin-gonic/gin"
)

// SampleHandler responsável pelas operações CRUD
type SampleHandler struct {
	usecase usecases.SampleUseCase
}

// NewSampleHandler cria novo handler
func NewSampleHandler(usecase usecases.SampleUseCase) *SampleHandler {
	return &SampleHandler{
		usecase: usecase,
	}
}

// Create cria um novo sample
func (h *SampleHandler) Create(c *gin.Context) {
	var req dto.CreateSampleRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	response, err := h.usecase.Create(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, dto.APIResponse{
		Success: true,
		Data:    response,
		Message: "Sample created successfully",
	})
}

// GetByID busca um sample por ID
func (h *SampleHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	response, err := h.usecase.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data:    response,
	})
}

// GetAll lista todos os samples com paginação
func (h *SampleHandler) GetAll(c *gin.Context) {
	page := 1
	pageSize := 10

	if p := c.Query("page"); p != "" {
		if val, err := strconv.Atoi(p); err == nil {
			page = val
		}
	}

	if ps := c.Query("page_size"); ps != "" {
		if val, err := strconv.Atoi(ps); err == nil {
			pageSize = val
		}
	}

	response, err := h.usecase.GetAll(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data:    response,
	})
}

// Update atualiza um sample
func (h *SampleHandler) Update(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateSampleRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	response, err := h.usecase.Update(id, &req)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data:    response,
		Message: "Sample updated successfully",
	})
}

// Delete deleta um sample
func (h *SampleHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	err := h.usecase.Delete(id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
