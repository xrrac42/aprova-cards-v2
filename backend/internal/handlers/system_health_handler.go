package handlers

import (
	"net/http"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/gin-gonic/gin"
)

type SystemHealthHandler struct {
	incidentRepo repositories.SystemIncidentRepository
	sessionRepo  repositories.StudentSessionRepository
	accessRepo   repositories.StudentAccessRepository
}

func NewSystemHealthHandler(
	incidentRepo repositories.SystemIncidentRepository,
	sessionRepo repositories.StudentSessionRepository,
	accessRepo repositories.StudentAccessRepository,
) *SystemHealthHandler {
	return &SystemHealthHandler{
		incidentRepo: incidentRepo,
		sessionRepo:  sessionRepo,
		accessRepo:   accessRepo,
	}
}

// GET /api/v1/admin/system-health
func (h *SystemHealthHandler) GetSystemHealth(c *gin.Context) {
	now := time.Now().UTC()
	last24h := now.Add(-24 * time.Hour)
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	webhookFails, _ := h.incidentRepo.CountByTypeSince("webhook_failed", last24h)
	loginFails, _ := h.incidentRepo.CountByTypeSince("login_failed", last24h)
	inactiveStudents, _ := h.incidentRepo.CountByTypeSince("inactive_student", time.Time{})

	activeStudents, _ := h.sessionRepo.CountActiveStudentsSince(startOfDay)
	cardsStudied, _ := h.sessionRepo.SumCardsReviewedSince(startOfDay)
	sessionsToday, _ := h.sessionRepo.CountSessionsSince(startOfDay)

	active, _ := h.incidentRepo.GetActive(30)
	resolved, _ := h.incidentRepo.GetResolved(50)
	exceptions, _ := h.incidentRepo.GetExceptions()

	// Calculate health score (100 = perfect)
	score := 100
	score -= int(webhookFails) * 10
	score -= int(loginFails) * 2
	score -= int(inactiveStudents)
	if score < 0 {
		score = 0
	}

	activeIncidents := make([]dto.SystemIncidentDTO, 0, len(active))
	for _, i := range active {
		activeIncidents = append(activeIncidents, dto.SystemIncidentDTO{
			ID: i.ID, Type: i.Type, Severity: i.Severity,
			Title: i.Title, Description: i.Description,
			Metadata: i.Metadata, Resolved: i.Resolved,
			CreatedAt: i.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	resolvedIncidents := make([]dto.SystemIncidentDTO, 0, len(resolved))
	for _, i := range resolved {
		resolvedIncidents = append(resolvedIncidents, dto.SystemIncidentDTO{
			ID: i.ID, Type: i.Type, Severity: i.Severity,
			Title: i.Title, Description: i.Description,
			Metadata: i.Metadata, Resolved: i.Resolved,
			CreatedAt: i.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	exceptionsDTOs := make([]dto.HealthExceptionDTO, 0, len(exceptions))
	for _, e := range exceptions {
		exceptionsDTOs = append(exceptionsDTOs, dto.HealthExceptionDTO{
			ID: e.ID, Type: e.Type, ReferenceKey: e.ReferenceKey,
			CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data: dto.SystemHealthResponse{
			Score:             score,
			WebhookFails24h:   webhookFails,
			LoginFails24h:     loginFails,
			InactiveStudents:  inactiveStudents,
			ActiveStudentsDay: activeStudents,
			CardsStudiedDay:   cardsStudied,
			SessionsDay:       sessionsToday,
			ActiveIncidents:   activeIncidents,
			ResolvedIncidents: resolvedIncidents,
			Exceptions:        exceptionsDTOs,
		},
	})
}

// POST /api/v1/admin/incidents/:id/resolve
func (h *SystemHealthHandler) ResolveIncident(c *gin.Context) {
	id := c.Param("id")
	if err := h.incidentRepo.Resolve(id); err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Message: "Incident resolved"})
}
