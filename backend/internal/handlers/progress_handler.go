package handlers

import (
	"net/http"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/gin-gonic/gin"
)

type ProgressHandler struct {
	repo repositories.StudentProgressRepository
}

func NewProgressHandler(repo repositories.StudentProgressRepository) *ProgressHandler {
	return &ProgressHandler{repo: repo}
}

// POST /api/v1/students/:email/progress/sync
func (h *ProgressHandler) SyncProgress(c *gin.Context) {
	var req dto.SyncProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	email := c.Param("email")

	existing, _ := h.repo.GetByStudentAndCard(email, req.CardID)

	if existing != nil {
		if req.Difficulty == "facil" || req.Difficulty == "medio" {
			existing.CorrectCount++
		} else {
			existing.IncorrectCount++
		}
		existing.Rating = req.Difficulty
		existing.ReviewedAt = time.Now().UTC()
		existing.NextReview = calculateNextReview(req.Difficulty, existing.CorrectCount)

		if err := h.repo.Upsert(existing); err != nil {
			c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
			return
		}
		c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Progress updated"})
		return
	}

	correctCount := 0
	incorrectCount := 0
	if req.Difficulty == "facil" || req.Difficulty == "medio" {
		correctCount = 1
	} else {
		incorrectCount = 1
	}

	entity := &models.StudentProgress{
		StudentEmail:   email,
		CardID:         req.CardID,
		ProductID:      c.Query("product_id"),
		Rating:         req.Difficulty,
		ReviewedAt:     time.Now().UTC(),
		NextReview:     calculateNextReview(req.Difficulty, correctCount),
		CorrectCount:   correctCount,
		IncorrectCount: incorrectCount,
	}

	if err := h.repo.Upsert(entity); err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, dto.APIResponse{Success: true, Message: "Progress recorded"})
}

// GET /api/v1/students/:email/progress?product_id=xxx
func (h *ProgressHandler) GetProgress(c *gin.Context) {
	email := c.Param("email")
	productID := c.Query("product_id")
	if productID == "" {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "product_id query param required"})
		return
	}

	progress, err := h.repo.GetByStudentAndProduct(email, productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	total := len(progress)
	learned := 0
	reviewing := 0
	for _, p := range progress {
		if p.CorrectCount >= 3 {
			learned++
		} else {
			reviewing++
		}
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data: gin.H{
			"total_cards_studied": total,
			"cards_learned":       learned,
			"cards_reviewing":     reviewing,
			"progress_percent":    0,
			"details":             progress,
		},
	})
}

func calculateNextReview(difficulty string, correctCount int) time.Time {
	now := time.Now().UTC()
	switch difficulty {
	case "errei":
		return now
	case "dificil":
		return now.AddDate(0, 0, 1)
	case "medio":
		days := 3
		if correctCount > 2 { days = 7 }
		return now.AddDate(0, 0, days)
	case "facil":
		days := 7
		if correctCount > 3 { days = 14 }
		if correctCount > 5 { days = 30 }
		return now.AddDate(0, 0, days)
	default:
		return now.AddDate(0, 0, 1)
	}
}
