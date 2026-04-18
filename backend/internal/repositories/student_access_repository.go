package repositories

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type StudentAccessRepository interface {
	Create(entity *models.StudentAccess) error
	GetByProductID(productID string, page, pageSize int) ([]models.StudentAccess, int64, error)
	GetByEmailAndProduct(email, productID string) (*models.StudentAccess, error)
	Update(entity *models.StudentAccess) error
}

type studentAccessRepository struct{ db *gorm.DB }

func NewStudentAccessRepository(db *gorm.DB) StudentAccessRepository {
	return &studentAccessRepository{db: db}
}

func (r *studentAccessRepository) Create(entity *models.StudentAccess) error {
	return r.db.Create(entity).Error
}

func (r *studentAccessRepository) GetByProductID(productID string, page, pageSize int) ([]models.StudentAccess, int64, error) {
	var entities []models.StudentAccess
	var total int64
	if page < 1 { page = 1 }
	if pageSize < 1 { pageSize = 20 }
	offset := (page - 1) * pageSize
	q := r.db.Model(&models.StudentAccess{}).Where("product_id = ?", productID)
	q.Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}
	return entities, total, nil
}

func (r *studentAccessRepository) GetByEmailAndProduct(email, productID string) (*models.StudentAccess, error) {
	var e models.StudentAccess
	if err := r.db.First(&e, "email = ? AND product_id = ?", email, productID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *studentAccessRepository) Update(entity *models.StudentAccess) error {
	return r.db.Save(entity).Error
}
