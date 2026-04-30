package repositories

import (
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type StudentSessionRepository interface {
	Create(entity *models.StudentSession) error
	GetByID(id string) (*models.StudentSession, error)
	Update(entity *models.StudentSession) error
	GetByStudentAndProduct(email, productID string, page, pageSize int) ([]models.StudentSession, int64, error)
	GetRecentByProduct(productID string, since time.Time, page, pageSize int) ([]models.StudentSession, int64, error)
	GetAllRecent(since time.Time, page, pageSize int) ([]models.StudentSession, int64, error)
	CountActiveStudentsSince(since time.Time) (int64, error)
	CountSessionsSince(since time.Time) (int64, error)
	SumCardsReviewedSince(since time.Time) (int64, error)
}

type studentSessionRepository struct{ db *gorm.DB }

func NewStudentSessionRepository(db *gorm.DB) StudentSessionRepository {
	return &studentSessionRepository{db: db}
}

func (r *studentSessionRepository) Create(entity *models.StudentSession) error {
	return r.db.Create(entity).Error
}

func (r *studentSessionRepository) GetByID(id string) (*models.StudentSession, error) {
	var e models.StudentSession
	if err := r.db.First(&e, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *studentSessionRepository) Update(entity *models.StudentSession) error {
	return r.db.Save(entity).Error
}

func (r *studentSessionRepository) GetByStudentAndProduct(email, productID string, page, pageSize int) ([]models.StudentSession, int64, error) {
	var entities []models.StudentSession
	var total int64
	if page < 1 { page = 1 }
	if pageSize < 1 { pageSize = 20 }
	q := r.db.Model(&models.StudentSession{}).Where("student_email = ? AND product_id = ?", email, productID)
	q.Count(&total)
	if err := q.Order("session_date DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}
	return entities, total, nil
}

func (r *studentSessionRepository) GetRecentByProduct(productID string, since time.Time, page, pageSize int) ([]models.StudentSession, int64, error) {
	var entities []models.StudentSession
	var total int64
	if page < 1 { page = 1 }
	if pageSize < 1 { pageSize = 50 }
	q := r.db.Model(&models.StudentSession{}).Where("product_id = ? AND session_date >= ?", productID, since)
	q.Count(&total)
	if err := q.Order("session_date DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}
	return entities, total, nil
}

func (r *studentSessionRepository) GetAllRecent(since time.Time, page, pageSize int) ([]models.StudentSession, int64, error) {
	var entities []models.StudentSession
	var total int64
	if page < 1 { page = 1 }
	if pageSize < 1 { pageSize = 50 }
	q := r.db.Model(&models.StudentSession{}).Where("session_date >= ?", since)
	q.Count(&total)
	if err := q.Order("session_date DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&entities).Error; err != nil {
		return nil, 0, err
	}
	return entities, total, nil
}

func (r *studentSessionRepository) CountActiveStudentsSince(since time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&models.StudentSession{}).Where("session_date >= ?", since).Distinct("student_email").Count(&count).Error
	return count, err
}

func (r *studentSessionRepository) CountSessionsSince(since time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&models.StudentSession{}).Where("session_date >= ?", since).Count(&count).Error
	return count, err
}

func (r *studentSessionRepository) SumCardsReviewedSince(since time.Time) (int64, error) {
	var sum int64
	row := r.db.Model(&models.StudentSession{}).Where("session_date >= ?", since).Select("COALESCE(SUM(cards_reviewed), 0)").Row()
	err := row.Scan(&sum)
	return sum, err
}
