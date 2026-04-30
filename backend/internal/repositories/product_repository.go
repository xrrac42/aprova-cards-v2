package repositories

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type ProductRepository interface {
	Create(entity *models.Product) error
	GetByID(id string) (*models.Product, error)
	GetByMentorID(mentorID string, page, pageSize int) ([]models.Product, int64, error)
	GetAll(page, pageSize int) ([]models.Product, int64, error)
	Update(entity *models.Product) error
	Delete(id string) error
}

type productRepository struct{ db *gorm.DB }

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

func (r *productRepository) Create(entity *models.Product) error {
	return r.db.Create(entity).Error
}

func (r *productRepository) GetByID(id string) (*models.Product, error) {
	var e models.Product
	if err := r.db.First(&e, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("product not found")
		}
		return nil, err
	}
	return &e, nil
}

func (r *productRepository) GetByMentorID(mentorID string, page, pageSize int) ([]models.Product, int64, error) {
	var entities []models.Product
	var total int64
	if page < 1 { page = 1 }
	if pageSize < 1 { pageSize = 10 }
	offset := (page - 1) * pageSize
	q := r.db.Model(&models.Product{}).Where("mentor_id = ?", mentorID)
	q.Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}
	return entities, total, nil
}

func (r *productRepository) GetAll(page, pageSize int) ([]models.Product, int64, error) {
	var entities []models.Product
	var total int64
	if page < 1 { page = 1 }
	if pageSize < 1 { pageSize = 10 }
	offset := (page - 1) * pageSize
	r.db.Model(&models.Product{}).Count(&total)
	if err := r.db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}
	return entities, total, nil
}

func (r *productRepository) Update(entity *models.Product) error {
	return r.db.Save(entity).Error
}

func (r *productRepository) Delete(id string) error {
	return r.db.Delete(&models.Product{}, "id = ?", id).Error
}
