package repositories

import (
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type StudentProgressRepository interface {
	Upsert(entity *models.StudentProgress) error
	GetByStudentAndProduct(email, productID string) ([]models.StudentProgress, error)
	GetByStudentAndCard(email, cardID string) (*models.StudentProgress, error)
	CountByProduct(productID string) (int64, error)
}

type studentProgressRepository struct{ db *gorm.DB }

func NewStudentProgressRepository(db *gorm.DB) StudentProgressRepository {
	return &studentProgressRepository{db: db}
}

func (r *studentProgressRepository) Upsert(entity *models.StudentProgress) error {
	return r.db.Save(entity).Error
}

func (r *studentProgressRepository) GetByStudentAndProduct(email, productID string) ([]models.StudentProgress, error) {
	var entities []models.StudentProgress
	if err := r.db.Where("student_email = ? AND product_id = ?", email, productID).Find(&entities).Error; err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *studentProgressRepository) GetByStudentAndCard(email, cardID string) (*models.StudentProgress, error) {
	var e models.StudentProgress
	if err := r.db.Where("student_email = ? AND card_id = ?", email, cardID).First(&e).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *studentProgressRepository) CountByProduct(productID string) (int64, error) {
	var count int64
	err := r.db.Model(&models.StudentProgress{}).Where("product_id = ?", productID).Count(&count).Error
	return count, err
}
