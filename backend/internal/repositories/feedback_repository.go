package repositories

import (
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type FeedbackRepository interface {
	Create(entity *models.StudentFeedback) error
	GetByProductID(productID string, page, pageSize int) ([]models.StudentFeedback, int64, error)
}

type feedbackRepository struct{ db *gorm.DB }

func NewFeedbackRepository(db *gorm.DB) FeedbackRepository {
	return &feedbackRepository{db: db}
}

func (r *feedbackRepository) Create(entity *models.StudentFeedback) error {
	return r.db.Create(entity).Error
}

func (r *feedbackRepository) GetByProductID(productID string, page, pageSize int) ([]models.StudentFeedback, int64, error) {
	var entities []models.StudentFeedback
	var total int64
	if page < 1 { page = 1 }
	if pageSize < 1 { pageSize = 20 }
	offset := (page - 1) * pageSize
	q := r.db.Model(&models.StudentFeedback{}).Where("product_id = ?", productID)
	q.Count(&total)
	if err := q.Order("criado_em DESC").Offset(offset).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}
	return entities, total, nil
}
