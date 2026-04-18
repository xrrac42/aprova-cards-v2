package handlers

import (
	"net/http"
	"strconv"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/gin-gonic/gin"
)

type StudentHandler struct{ repo repositories.StudentAccessRepository }

func NewStudentHandler(repo repositories.StudentAccessRepository) *StudentHandler {
	return &StudentHandler{repo: repo}
}

func (h *StudentHandler) GetByProductID(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	entities, total, err := h.repo.GetByProductID(c.Param("id"), page, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()}); return }
	if ps < 1 { ps = 20 }
	var r []dto.StudentAccessResponse
	for _, e := range entities {
		r = append(r, dto.StudentAccessResponse{ID: e.ID, Email: e.Email, ProductID: e.ProductID, Active: e.Active, InactiveReason: e.InactiveReason, CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z")})
	}
	tp := int(total) / ps; if int(total)%ps > 0 { tp++ }
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: dto.PaginatedResponse{Data: r, Total: total, Page: page, PageSize: ps, TotalPages: tp}})
}

func (h *StudentHandler) AddStudent(c *gin.Context) {
	var req dto.AddStudentRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	productID := c.Param("id")
	existing, _ := h.repo.GetByEmailAndProduct(req.Email, productID)
	if existing != nil {
		c.JSON(http.StatusConflict, dto.APIResponse{Success: false, Error: "student already has access"})
		return
	}
	e := &models.StudentAccess{Email: req.Email, ProductID: productID, Active: true}
	if err := h.repo.Create(e); err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Data: dto.StudentAccessResponse{ID: e.ID, Email: e.Email, ProductID: e.ProductID, Active: e.Active, CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z")}, Message: "Student added"})
}

func (h *StudentHandler) UpdateAccess(c *gin.Context) {
	var req dto.UpdateStudentAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	email := c.Param("email")
	productID := c.Query("product_id")
	if productID == "" { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "product_id query param required"}); return }
	existing, _ := h.repo.GetByEmailAndProduct(email, productID)
	if existing == nil { c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: "student access not found"}); return }
	existing.Active = req.Active
	existing.InactiveReason = req.InactiveReason
	if err := h.repo.Update(existing); err != nil { c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Access updated"})
}
