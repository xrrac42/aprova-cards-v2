package handlers

import (
	"net/http"
	"strconv"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/gin-gonic/gin"
)

type ProductHandler struct{ usecase usecases.ProductUseCase }

func NewProductHandler(uc usecases.ProductUseCase) *ProductHandler { return &ProductHandler{usecase: uc} }

func (h *ProductHandler) Create(c *gin.Context) {
	var req dto.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	r, err := h.usecase.Create(&req)
	if err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
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
	if err != nil { c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r})
}

func (h *ProductHandler) GetByID(c *gin.Context) {
	r, err := h.usecase.GetByID(c.Param("id"))
	if err != nil { c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r})
}

func (h *ProductHandler) Update(c *gin.Context) {
	var req dto.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	r, err := h.usecase.Update(c.Param("id"), &req)
	if err != nil { c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r, Message: "Product updated"})
}

func (h *ProductHandler) Delete(c *gin.Context) {
	if err := h.usecase.Delete(c.Param("id")); err != nil { c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusNoContent, nil)
}
