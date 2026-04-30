package handlers

import (
	"net/http"
	"strconv"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/gin-gonic/gin"
)

type FeedbackHandler struct{ repo repositories.FeedbackRepository }

func NewFeedbackHandler(repo repositories.FeedbackRepository) *FeedbackHandler {
	return &FeedbackHandler{repo: repo}
}

func (h *FeedbackHandler) Create(c *gin.Context) {
	var req dto.CreateFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	email, _ := c.Get("user_email")
	emailStr, ok := email.(string)
	if !ok || emailStr == "" { emailStr = c.GetHeader("X-Student-Email") }
	if emailStr == "" { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "student email required"}); return }

	e := &models.StudentFeedback{StudentEmail: emailStr, ProductID: req.ProductID, Mensagem: req.Mensagem, TotalCardsEpoca: req.TotalCardsEpoca}
	if err := h.repo.Create(e); err != nil { c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()}); return }
	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Message: "Feedback submitted"})
}

func (h *FeedbackHandler) GetByProductID(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	entities, total, err := h.repo.GetByProductID(c.Param("id"), page, ps)
	if err != nil { c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()}); return }
	if ps < 1 { ps = 20 }
	var r []dto.FeedbackResponse
	for _, e := range entities {
		r = append(r, dto.FeedbackResponse{ID: e.ID, StudentEmail: e.StudentEmail, ProductID: e.ProductID, Mensagem: e.Mensagem, TotalCardsEpoca: e.TotalCardsEpoca, CriadoEm: e.CriadoEm.Format("2006-01-02T15:04:05Z")})
	}
	tp := int(total) / ps; if int(total)%ps > 0 { tp++ }
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: dto.PaginatedResponse{Data: r, Total: total, Page: page, PageSize: ps, TotalPages: tp}})
}
