package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	healthTimeout = 5 * time.Second
	appVersion    = "1.0.0"
)

// HealthHandler responsável por health check
type HealthHandler struct {
	db *gorm.DB
}

// NewHealthHandler cria novo handler com acesso ao banco
func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

// Check retorna status real de saúde do servidor e do banco de dados
// GET /api/v1/health
func (h *HealthHandler) Check(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), healthTimeout)
	defer cancel()

	now := time.Now().UTC()

	dbStatus := h.checkDatabase(ctx)

	overallStatus := "healthy"
	httpStatus := http.StatusOK

	if dbStatus.Status != "up" {
		overallStatus = "degraded"
		httpStatus = http.StatusServiceUnavailable
	}

	response := dto.HealthResponse{
		Status:    overallStatus,
		Timestamp: now.Format(time.RFC3339),
		Version:   appVersion,
		Uptime:    time.Since(startTime).String(),
		Checks: dto.HealthChecks{
			Database: dbStatus,
		},
	}

	c.JSON(httpStatus, dto.APIResponse{
		Success: httpStatus == http.StatusOK,
		Data:    response,
		Message: "Health check completed",
	})
}

// checkDatabase executa um SELECT 1 real no Supabase para verificar conectividade
func (h *HealthHandler) checkDatabase(ctx context.Context) dto.HealthCheckDetail {
	start := time.Now()

	sqlDB, err := h.db.DB()
	if err != nil {
		return dto.HealthCheckDetail{
			Status:     "down",
			Latency:    time.Since(start).String(),
			Error:      "failed to get underlying db connection",
		}
	}

	if err := sqlDB.PingContext(ctx); err != nil {
		return dto.HealthCheckDetail{
			Status:     "down",
			Latency:    time.Since(start).String(),
			Error:      "database ping failed: " + err.Error(),
		}
	}

	// Executa query real para validar que o banco responde
	var result int
	if err := h.db.WithContext(ctx).Raw("SELECT 1").Scan(&result).Error; err != nil {
		return dto.HealthCheckDetail{
			Status:     "down",
			Latency:    time.Since(start).String(),
			Error:      "database query failed: " + err.Error(),
		}
	}

	stats := sqlDB.Stats()

	return dto.HealthCheckDetail{
		Status:      "up",
		Latency:     time.Since(start).String(),
		OpenConns:   stats.OpenConnections,
		InUseConns:  stats.InUse,
		IdleConns:   stats.Idle,
	}
}

// startTime registra quando o servidor iniciou (para calcular uptime)
var startTime = time.Now()
