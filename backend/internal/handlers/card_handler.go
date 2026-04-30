package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/gin-gonic/gin"
)

type CardHandler struct{ usecase usecases.CardUseCase }

func NewCardHandler(uc usecases.CardUseCase) *CardHandler { return &CardHandler{usecase: uc} }

func (h *CardHandler) Create(c *gin.Context) {
	var req dto.CreateCardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	if req.DisciplineID == "" {
		req.DisciplineID = c.Param("id")
	}
	r, err := h.usecase.Create(&req, "")
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Data: r, Message: "Card created"})
}

func (h *CardHandler) GetByDisciplineID(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	r, err := h.usecase.GetByDisciplineID(c.Param("id"), page, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r})
}

func (h *CardHandler) GetByProductID(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	disciplineID := c.Query("discipline_id")
	search := c.Query("search")

	r, err := h.usecase.GetByProductID(c.Param("id"), disciplineID, search, page, ps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r})
}

func (h *CardHandler) Update(c *gin.Context) {
	var req dto.UpdateCardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	r, err := h.usecase.Update(c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r, Message: "Card updated"})
}

func (h *CardHandler) Delete(c *gin.Context) {
	if err := h.usecase.Delete(c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

func (h *CardHandler) GenerateWithAI(c *gin.Context) {
	var req dto.GenerateCardsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	r, err := h.usecase.GenerateWithAI(c.Param("id"), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusCreated, dto.APIResponse{
		Success: true,
		Data:    r,
		Message: fmt.Sprintf("%d cards gerados com IA", r.Generated),
	})
}
