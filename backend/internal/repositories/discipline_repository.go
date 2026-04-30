package repositories

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type DisciplineRepository interface {
	Create(entity *models.Discipline) error
	GetByID(id string) (*models.Discipline, error)
	GetByProductID(productID string) ([]models.Discipline, error)
	Update(entity *models.Discipline) error
	Delete(id string) error
	Reorder(ids []string) error
}

type disciplineRepository struct{ db *gorm.DB }

func NewDisciplineRepository(db *gorm.DB) DisciplineRepository {
	return &disciplineRepository{db: db}
}

func (r *disciplineRepository) Create(entity *models.Discipline) error {
	return r.db.Create(entity).Error
}

func (r *disciplineRepository) GetByID(id string) (*models.Discipline, error) {
	var e models.Discipline
	if err := r.db.First(&e, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("discipline not found")
		}
		return nil, err
	}
	return &e, nil
}

func (r *disciplineRepository) GetByProductID(productID string) ([]models.Discipline, error) {
	var entities []models.Discipline
	if err := r.db.Where("product_id = ?", productID).Order(`"order" ASC`).Find(&entities).Error; err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *disciplineRepository) Update(entity *models.Discipline) error {
	return r.db.Save(entity).Error
}

func (r *disciplineRepository) Delete(id string) error {
	return r.db.Delete(&models.Discipline{}, "id = ?", id).Error
}

func (r *disciplineRepository) Reorder(ids []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for i, id := range ids {
			if err := tx.Model(&models.Discipline{}).Where("id = ?", id).Update("order", i).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
