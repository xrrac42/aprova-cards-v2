package handlers

import (
	"net/http"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ReportsHandler struct {
	db *gorm.DB
}

func NewReportsHandler(db *gorm.DB) *ReportsHandler {
	return &ReportsHandler{db: db}
}

// GetAdminReports returns aggregated reports for the admin dashboard
// GET /api/v1/admin/reports?period=week|month
func (h *ReportsHandler) GetAdminReports(c *gin.Context) {
	period := c.DefaultQuery("period", "week")
	now := time.Now().UTC()

	var since time.Time
	if period == "month" {
		since = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	} else {
		since = now.AddDate(0, 0, -7)
	}

	// Active students this month
	var activeStudentsMonth int64
	h.db.Model(&models.StudentSession{}).
		Where("session_date >= ?", time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)).
		Distinct("student_email").Count(&activeStudentsMonth)

	// Sessions this month
	var sessionsMonth int64
	h.db.Model(&models.StudentSession{}).
		Where("session_date >= ?", time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)).
		Count(&sessionsMonth)

	// Total cards
	var totalCards int64
	h.db.Model(&models.Card{}).Count(&totalCards)

	// Active students by day
	type dayRow struct {
		Date  time.Time
		Count int64
	}
	var studentsByDay []dayRow
	h.db.Model(&models.StudentSession{}).
		Select("session_date as date, COUNT(DISTINCT student_email) as count").
		Where("session_date >= ?", since).
		Group("session_date").Order("session_date ASC").
		Scan(&studentsByDay)

	activeByDay := make([]dto.DayMetric, 0, len(studentsByDay))
	for _, r := range studentsByDay {
		activeByDay = append(activeByDay, dto.DayMetric{Date: r.Date.Format("2006-01-02"), Count: r.Count})
	}

	// Cards reviewed by day
	var cardsByDay []struct {
		Date  time.Time
		Count int64
	}
	h.db.Model(&models.StudentSession{}).
		Select("session_date as date, COALESCE(SUM(cards_reviewed), 0) as count").
		Where("session_date >= ?", since).
		Group("session_date").Order("session_date ASC").
		Scan(&cardsByDay)

	cardsMetric := make([]dto.DayMetric, 0, len(cardsByDay))
	for _, r := range cardsByDay {
		cardsMetric = append(cardsMetric, dto.DayMetric{Date: r.Date.Format("2006-01-02"), Count: r.Count})
	}

	// Top products by engagement (this month)
	type productRow struct {
		ProductID string
		Sessions  int64
		Cards     int64
	}
	var topProducts []productRow
	h.db.Model(&models.StudentSession{}).
		Select("product_id, COUNT(*) as sessions, COALESCE(SUM(cards_reviewed), 0) as cards").
		Where("session_date >= ?", time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)).
		Group("product_id").Order("sessions DESC").Limit(10).
		Scan(&topProducts)

	topEngagement := make([]dto.ProductEngagement, 0, len(topProducts))
	for _, r := range topProducts {
		var product models.Product
		name := r.ProductID
		if err := h.db.Select("name").First(&product, "id = ?", r.ProductID).Error; err == nil {
			name = product.Name
		}
		topEngagement = append(topEngagement, dto.ProductEngagement{
			ProductID: r.ProductID, ProductName: name,
			Sessions: r.Sessions, Cards: r.Cards,
		})
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data: dto.ReportsResponse{
			ActiveStudentsMonth: activeStudentsMonth,
			SessionsMonth:       sessionsMonth,
			TotalCards:          totalCards,
			ActiveStudentsByDay: activeByDay,
			CardsReviewedByDay:  cardsMetric,
			TopProducts:         topEngagement,
		},
	})
}
