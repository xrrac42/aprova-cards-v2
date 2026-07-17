package handlers

import (
	"net/http"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/gin-gonic/gin"
)

type GenerationHandler struct{ usecase usecases.GenerationUseCase }

func NewGenerationHandler(uc usecases.GenerationUseCase) *GenerationHandler {
	return &GenerationHandler{usecase: uc}
}

// StartJob enqueues an async, chunked AI card generation job and returns
// immediately — it never waits on any LLM call.
func (h *GenerationHandler) StartJob(c *gin.Context) {
	var req dto.GenerateCardsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	r, err := h.usecase.StartJob(c.Request.Context(), c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusAccepted, dto.APIResponse{Success: true, Data: r})
}

// GetStatus reports progress for a generation job, and its result once completed.
func (h *GenerationHandler) GetStatus(c *gin.Context) {
	r, err := h.usecase.GetStatus(c.Request.Context(), c.Param("jobId"))
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r})
}
