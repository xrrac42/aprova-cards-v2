package handlers

import (
	"net/http"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/gin-gonic/gin"
)

type SessionHandler struct {
	repo repositories.StudentSessionRepository
}

func NewSessionHandler(repo repositories.StudentSessionRepository) *SessionHandler {
	return &SessionHandler{repo: repo}
}

// POST /api/v1/sessions
func (h *SessionHandler) Create(c *gin.Context) {
	var req dto.CreateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	email, _ := c.Get("user_email")
	emailStr, _ := email.(string)
	if emailStr == "" {
		emailStr = c.GetHeader("X-Student-Email")
	}
	if emailStr == "" {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "student email required"})
		return
	}

	entity := &models.StudentSession{
		StudentEmail: emailStr,
		ProductID:    req.ProductID,
		DisciplineID: req.DisciplineID,
		SessionDate:  time.Now().UTC().Truncate(24 * time.Hour),
	}

	if err := h.repo.Create(entity); err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, dto.APIResponse{
		Success: true,
		Data: dto.SessionResponse{
			ID: entity.ID, StudentEmail: entity.StudentEmail,
			ProductID: entity.ProductID, DisciplineID: entity.DisciplineID,
			CardsReviewed: entity.CardsReviewed, Correct: entity.Correct,
			Incorrect: entity.Incorrect, StudyTimeSeconds: entity.StudyTimeSeconds,
			SessionDate: entity.SessionDate.Format("2006-01-02"),
			CreatedAt:   entity.CreatedAt.Format("2006-01-02T15:04:05Z"),
		},
		Message: "Session started",
	})
}

// POST /api/v1/sessions/:id/complete
func (h *SessionHandler) Complete(c *gin.Context) {
	var req dto.CompleteSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	entity, err := h.repo.GetByID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: "session not found"})
		return
	}

	entity.CardsReviewed = req.CardsReviewed
	entity.Correct = req.Correct
	entity.Incorrect = req.Incorrect
	entity.StudyTimeSeconds = req.StudyTimeSeconds

	if err := h.repo.Update(entity); err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data: dto.SessionResponse{
			ID: entity.ID, StudentEmail: entity.StudentEmail,
			ProductID: entity.ProductID, DisciplineID: entity.DisciplineID,
			CardsReviewed: entity.CardsReviewed, Correct: entity.Correct,
			Incorrect: entity.Incorrect, StudyTimeSeconds: entity.StudyTimeSeconds,
			SessionDate: entity.SessionDate.Format("2006-01-02"),
			CreatedAt:   entity.CreatedAt.Format("2006-01-02T15:04:05Z"),
		},
		Message: "Session completed",
	})
}
