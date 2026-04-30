package handlers

import (
	"net/http"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/gin-gonic/gin"
)

type DisciplineHandler struct{ usecase usecases.DisciplineUseCase }

func NewDisciplineHandler(uc usecases.DisciplineUseCase) *DisciplineHandler { return &DisciplineHandler{usecase: uc} }

func (h *DisciplineHandler) Create(c *gin.Context) {
	var req dto.CreateDisciplineRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	if req.ProductID == "" { req.ProductID = c.Param("id") }
	r, err := h.usecase.Create(&req)
	if err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Data: r, Message: "Discipline created"})
}

func (h *DisciplineHandler) GetByProductID(c *gin.Context) {
	r, err := h.usecase.GetByProductID(c.Param("id"))
	if err != nil { c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r})
}

func (h *DisciplineHandler) Update(c *gin.Context) {
	var req dto.UpdateDisciplineRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	r, err := h.usecase.Update(c.Param("id"), &req)
	if err != nil { c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r, Message: "Discipline updated"})
}

func (h *DisciplineHandler) Delete(c *gin.Context) {
	if err := h.usecase.Delete(c.Param("id")); err != nil { c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusNoContent, nil)
}

func (h *DisciplineHandler) Reorder(c *gin.Context) {
	var req dto.ReorderDisciplinesRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	r, err := h.usecase.Reorder(c.Param("id"), &req)
	if err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: r, Message: "Disciplines reordered"})
}
