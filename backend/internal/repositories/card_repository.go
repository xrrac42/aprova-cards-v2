package repositories

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type CardRepository interface {
	Create(entity *models.Card) error
	GetByID(id string) (*models.Card, error)
	GetByDisciplineID(disciplineID string, page, pageSize int) ([]models.Card, int64, error)
	GetByProductID(productID string, disciplineID string, search string, page, pageSize int) ([]models.Card, int64, error)
	Update(entity *models.Card) error
	Delete(id string) error
}

type cardRepository struct{ db *gorm.DB }

func NewCardRepository(db *gorm.DB) CardRepository {
	return &cardRepository{db: db}
}

func (r *cardRepository) Create(entity *models.Card) error {
	return r.db.Create(entity).Error
}

func (r *cardRepository) GetByID(id string) (*models.Card, error) {
	var e models.Card
	if err := r.db.First(&e, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("card not found")
		}
		return nil, err
	}
	return &e, nil
}

func (r *cardRepository) GetByDisciplineID(disciplineID string, page, pageSize int) ([]models.Card, int64, error) {
	var entities []models.Card
	var total int64
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	q := r.db.Model(&models.Card{}).Where("discipline_id = ?", disciplineID)
	q.Count(&total)
	if err := q.Order(`"order" ASC`).Offset(offset).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}
	return entities, total, nil
}

func (r *cardRepository) GetByProductID(productID string, disciplineID string, search string, page, pageSize int) ([]models.Card, int64, error) {
	var entities []models.Card
	var total int64
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	q := r.db.Model(&models.Card{})
	if disciplineID != "" {
		// When discipline is provided, keep the filter exactly discipline-based.
		q = q.Where("discipline_id = ?", disciplineID)
	} else {
		q = q.Where("product_id = ?", productID)
	}
	if search != "" {
		like := "%" + search + "%"
		q = q.Where("front ILIKE ? OR back ILIKE ?", like, like)
	}

	q.Count(&total)
	if err := q.Order(`"order" ASC`).Offset(offset).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}

	return entities, total, nil
}

func (r *cardRepository) Update(entity *models.Card) error {
	return r.db.Save(entity).Error
}

func (r *cardRepository) Delete(id string) error {
	return r.db.Delete(&models.Card{}, "id = ?", id).Error
}
