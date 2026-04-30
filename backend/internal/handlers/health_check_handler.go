package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type HealthCheckHandler struct {
	db *gorm.DB
}

func NewHealthCheckHandler(db *gorm.DB) *HealthCheckHandler {
	return &HealthCheckHandler{db: db}
}

type Incident struct {
	Type        string                 `json:"type"`
	Severity    string                 `json:"severity"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type HealthCheckMetrics struct {
	Status    string     `json:"status"`
	Score     int        `json:"score"`
	Incidents []Incident `json:"incidents"`
	Timestamp string     `json:"timestamp"`
}

func (h *HealthCheckHandler) Check(c *gin.Context) {
	incidents := []Incident{}
	now := time.Now()
	last24h := now.Add(-24 * time.Hour)

	// 1. Check webhook failures (last 24h)
	var webhookFails int64
	h.db.Model(&models.SystemIncident{}).
		Where("type = ? AND resolved = false AND created_at >= ?", "webhook_failed", last24h).
		Count(&webhookFails)

	if webhookFails >= 3 {
		incidents = append(incidents, Incident{
			Type:        "webhook_failed",
			Severity:    "critical",
			Title:       fmt.Sprintf("🚨 %d falhas de webhook nas últimas 24h", webhookFails),
			Description: "Alunos podem não estar recebendo acesso após compra.",
		})
	}

	// 2. Check login failures (last 24h)
	var loginFails int64
	h.db.Model(&models.SystemIncident{}).
		Where("type = ? AND resolved = false AND created_at >= ?", "login_failed", last24h).
		Count(&loginFails)

	if loginFails >= 5 {
		incidents = append(incidents, Incident{
			Type:        "login_failed",
			Severity:    "warning",
			Title:       fmt.Sprintf("⚠️ %d falhas de login nas últimas 24h", loginFails),
			Description: "Vários alunos com dificuldade para acessar o sistema.",
		})
	}

	// 3. Check inactive students (bought but never studied, > 3 days)
	threeDaysAgo := now.Add(-3 * 24 * time.Hour)

	var inactiveStudents []struct {
		Email     string
		ProductID string
		CreatedAt time.Time
	}

	h.db.Table("student_access").
		Select("email, product_id, created_at").
		Where("active = true AND created_at < ?", threeDaysAgo).
		Scan(&inactiveStudents)

	if len(inactiveStudents) > 0 {
		// Get list of students who have been active
		var activeEmails []string
		h.db.Table("student_sessions").
			Select("DISTINCT student_email").
			Scan(&activeEmails)

		activeEmailsSet := make(map[string]bool)
		for _, email := range activeEmails {
			activeEmailsSet[email] = true
		}

		// Filter out active students and check exceptions
		var exceptionEmails []string
		h.db.Table("health_check_exceptions").
			Select("reference_key").
			Where("type = ?", "inactive_student").
			Scan(&exceptionEmails)

		exceptionEmailsSet := make(map[string]bool)
		for _, email := range exceptionEmails {
			exceptionEmailsSet[email] = true
		}

		inactiveCount := 0
		var inactiveEmails []string
		for _, student := range inactiveStudents {
			if !activeEmailsSet[student.Email] && !exceptionEmailsSet[student.Email] {
				inactiveCount++
				if inactiveCount <= 10 {
					inactiveEmails = append(inactiveEmails, student.Email)
				}
			}
		}

		if inactiveCount > 0 {
			desc := ""
			for i, email := range inactiveEmails {
				if i > 0 {
					desc += ", "
				}
				desc += email
			}
			if inactiveCount > 10 {
				desc += fmt.Sprintf(" e mais %d...", inactiveCount-10)
			}

			incidents = append(incidents, Incident{
				Type:        "inactive_student",
				Severity:    "warning",
				Title:       fmt.Sprintf("📊 %d aluno(s) nunca acessaram após a compra", inactiveCount),
				Description: desc,
				Metadata: map[string]interface{}{
					"count":  inactiveCount,
					"emails": inactiveEmails,
				},
			})
		}
	}

	// Calculate score
	score := 100
	for _, incident := range incidents {
		switch incident.Type {
		case "webhook_failed":
			score -= 30
		case "login_failed":
			if loginFails >= 10 {
				score -= 20
			} else {
				score -= 10
			}
		case "inactive_student":
			score -= 5
		}
	}
	if score < 0 {
		score = 0
	}

	status := "healthy"
	if score < 50 {
		status = "critical"
	} else if score < 80 {
		status = "warning"
	}

	metrics := HealthCheckMetrics{
		Status:    status,
		Score:     score,
		Incidents: incidents,
		Timestamp: now.Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data:    metrics,
	})
}
