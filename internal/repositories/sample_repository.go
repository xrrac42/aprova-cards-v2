package repositories

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

// SampleRepository define o contrato de acesso a dados
type SampleRepository interface {
	Create(entity *models.SampleEntity) error
	GetByID(id string) (*models.SampleEntity, error)
	GetByEmail(email string) (*models.SampleEntity, error)
	GetAll(page, pageSize int) ([]models.SampleEntity, int64, error)
	Update(entity *models.SampleEntity) error
	Delete(id string) error
}

// sampleRepository implementa o contrato
type sampleRepository struct {
	db *gorm.DB
}

// NewSampleRepository cria uma nova instância do repositório
func NewSampleRepository(db *gorm.DB) SampleRepository {
	return &sampleRepository{db: db}
}

// Create insere um novo registro
func (r *sampleRepository) Create(entity *models.SampleEntity) error {
	if entity == nil {
		return errors.New("entity cannot be nil")
	}

	if err := r.db.Create(entity).Error; err != nil {
		return err
	}

	return nil
}

// GetByID busca por ID
func (r *sampleRepository) GetByID(id string) (*models.SampleEntity, error) {
	var entity models.SampleEntity

	if err := r.db.First(&entity, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("entity not found")
		}
		return nil, err
	}

	return &entity, nil
}

// GetByEmail busca por email
func (r *sampleRepository) GetByEmail(email string) (*models.SampleEntity, error) {
	var entity models.SampleEntity

	if err := r.db.First(&entity, "email = ?", email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("entity not found")
		}
		return nil, err
	}

	return &entity, nil
}

// GetAll busca todos com paginação
func (r *sampleRepository) GetAll(page, pageSize int) ([]models.SampleEntity, int64, error) {
	var entities []models.SampleEntity
	var total int64

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	offset := (page - 1) * pageSize

	if err := r.db.Model(&models.SampleEntity{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.Offset(offset).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}

	return entities, total, nil
}

// Update atualiza um registro
func (r *sampleRepository) Update(entity *models.SampleEntity) error {
	if entity == nil {
		return errors.New("entity cannot be nil")
	}

	if err := r.db.Save(entity).Error; err != nil {
		return err
	}

	return nil
}

// Delete deleta um registro
func (r *sampleRepository) Delete(id string) error {
	if err := r.db.Delete(&models.SampleEntity{}, "id = ?", id).Error; err != nil {
		return err
	}

	return nil
}
