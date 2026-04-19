package repositories

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type MentorRepository interface {
	Create(entity *models.Mentor) error
	GetByID(id string) (*models.Mentor, error)
	GetByEmail(email string) (*models.Mentor, error)
	GetBySlug(slug string) (*models.Mentor, error)
	GetAll(page, pageSize int) ([]models.Mentor, int64, error)
	Update(entity *models.Mentor) error
	Delete(id string) error
}

type mentorRepository struct{ db *gorm.DB }

func NewMentorRepository(db *gorm.DB) MentorRepository {
	return &mentorRepository{db: db}
}

func (r *mentorRepository) Create(entity *models.Mentor) error {
	return r.db.Create(entity).Error
}

func (r *mentorRepository) GetByID(id string) (*models.Mentor, error) {
	var e models.Mentor
	if err := r.db.First(&e, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("mentor not found")
		}
		return nil, err
	}
	return &e, nil
}

func (r *mentorRepository) GetByEmail(email string) (*models.Mentor, error) {
	var e models.Mentor
	if err := r.db.First(&e, "email = ?", email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *mentorRepository) GetBySlug(slug string) (*models.Mentor, error) {
	var e models.Mentor
	if err := r.db.First(&e, "slug = ?", slug).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *mentorRepository) GetAll(page, pageSize int) ([]models.Mentor, int64, error) {
	var entities []models.Mentor
	var total int64
	if page < 1 { page = 1 }
	if pageSize < 1 { pageSize = 10 }
	offset := (page - 1) * pageSize
	if err := r.db.Model(&models.Mentor{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := r.db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}
	return entities, total, nil
}

func (r *mentorRepository) Update(entity *models.Mentor) error {
	return r.db.Save(entity).Error
}

func (r *mentorRepository) Delete(id string) error {
	return r.db.Delete(&models.Mentor{}, "id = ?", id).Error
}
