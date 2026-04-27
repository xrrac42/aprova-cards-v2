package repositories

import (
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type SystemIncidentRepository interface {
	Create(entity *models.SystemIncident) error
	GetActive(limit int) ([]models.SystemIncident, error)
	GetResolved(limit int) ([]models.SystemIncident, error)
	Resolve(id string) error
	CountByTypeSince(incidentType string, since time.Time) (int64, error)
	GetExceptions() ([]models.HealthCheckException, error)
	UpsertException(entity *models.HealthCheckException) error
}

type systemIncidentRepository struct{ db *gorm.DB }

func NewSystemIncidentRepository(db *gorm.DB) SystemIncidentRepository {
	return &systemIncidentRepository{db: db}
}

func (r *systemIncidentRepository) Create(entity *models.SystemIncident) error {
	return r.db.Create(entity).Error
}

func (r *systemIncidentRepository) GetActive(limit int) ([]models.SystemIncident, error) {
	var entities []models.SystemIncident
	if limit < 1 { limit = 30 }
	if err := r.db.Where("resolved = false").Order("created_at DESC").Limit(limit).Find(&entities).Error; err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *systemIncidentRepository) GetResolved(limit int) ([]models.SystemIncident, error) {
	var entities []models.SystemIncident
	if limit < 1 { limit = 50 }
	if err := r.db.Where("resolved = true").Order("created_at DESC").Limit(limit).Find(&entities).Error; err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *systemIncidentRepository) Resolve(id string) error {
	return r.db.Model(&models.SystemIncident{}).Where("id = ?", id).Update("resolved", true).Error
}

func (r *systemIncidentRepository) CountByTypeSince(incidentType string, since time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&models.SystemIncident{}).Where("type = ? AND created_at >= ?", incidentType, since).Count(&count).Error
	return count, err
}

func (r *systemIncidentRepository) GetExceptions() ([]models.HealthCheckException, error) {
	var entities []models.HealthCheckException
	if err := r.db.Order("created_at DESC").Find(&entities).Error; err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *systemIncidentRepository) UpsertException(entity *models.HealthCheckException) error {
	return r.db.Save(entity).Error
}
