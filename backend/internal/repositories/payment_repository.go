package repositories

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type PaymentRepository interface {
	// Payment operations
	Create(entity *models.Payment) error
	GetByID(id string) (*models.Payment, error)
	GetByStripePaymentIntentID(stripePaymentIntentID string) (*models.Payment, error)
	GetByStudentEmail(email string, page, pageSize int) ([]models.Payment, int64, error)
	GetByProductID(productID string, page, pageSize int) ([]models.Payment, int64, error)
	Update(entity *models.Payment) error
	List(filter map[string]interface{}, page, pageSize int) ([]models.Payment, int64, error)

	// PaymentSplit operations
	CreateSplit(entity *models.PaymentSplit) error
	GetSplitByPaymentID(paymentID string) (*models.PaymentSplit, error)
	UpdateSplit(entity *models.PaymentSplit) error
	GetPendingSplitsByMentorID(mentorID string, page, pageSize int) ([]models.PaymentSplit, int64, error)

	// PaymentWebhook operations
	CreateWebhook(entity *models.PaymentWebhook) error
	GetWebhookByStripeEventID(stripeEventID string) (*models.PaymentWebhook, error)
	GetPendingWebhooks(limit int) ([]models.PaymentWebhook, error)
	UpdateWebhook(entity *models.PaymentWebhook) error
}

type paymentRepository struct{ db *gorm.DB }

func NewPaymentRepository(db *gorm.DB) PaymentRepository {
	return &paymentRepository{db: db}
}

// ============= Payment Operations =============

func (r *paymentRepository) Create(entity *models.Payment) error {
	return r.db.Create(entity).Error
}

func (r *paymentRepository) GetByID(id string) (*models.Payment, error) {
	var payment models.Payment
	if err := r.db.First(&payment, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &payment, nil
}

func (r *paymentRepository) GetByStripePaymentIntentID(stripePaymentIntentID string) (*models.Payment, error) {
	var payment models.Payment
	if err := r.db.First(&payment, "stripe_payment_intent_id = ?", stripePaymentIntentID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &payment, nil
}

func (r *paymentRepository) GetByStudentEmail(email string, page, pageSize int) ([]models.Payment, int64, error) {
	var payments []models.Payment
	var total int64
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	q := r.db.Model(&models.Payment{}).Where("student_email = ?", email)
	q.Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&payments).Error; err != nil {
		return nil, 0, err
	}
	return payments, total, nil
}

func (r *paymentRepository) GetByProductID(productID string, page, pageSize int) ([]models.Payment, int64, error) {
	var payments []models.Payment
	var total int64
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize
	q := r.db.Model(&models.Payment{}).Where("product_id = ?", productID)
	q.Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&payments).Error; err != nil {
		return nil, 0, err
	}
	return payments, total, nil
}

func (r *paymentRepository) Update(entity *models.Payment) error {
	return r.db.Save(entity).Error
}

func (r *paymentRepository) List(filter map[string]interface{}, page, pageSize int) ([]models.Payment, int64, error) {
	var payments []models.Payment
	var total int64
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	q := r.db.Model(&models.Payment{})
	for key, value := range filter {
		q = q.Where(key+" = ?", value)
	}
	q.Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&payments).Error; err != nil {
		return nil, 0, err
	}
	return payments, total, nil
}

// ============= PaymentSplit Operations =============

func (r *paymentRepository) CreateSplit(entity *models.PaymentSplit) error {
	return r.db.Create(entity).Error
}

func (r *paymentRepository) GetSplitByPaymentID(paymentID string) (*models.PaymentSplit, error) {
	var split models.PaymentSplit
	if err := r.db.First(&split, "payment_id = ?", paymentID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &split, nil
}

func (r *paymentRepository) UpdateSplit(entity *models.PaymentSplit) error {
	return r.db.Save(entity).Error
}

func (r *paymentRepository) GetPendingSplitsByMentorID(mentorID string, page, pageSize int) ([]models.PaymentSplit, int64, error) {
	var splits []models.PaymentSplit
	var total int64
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	q := r.db.Model(&models.PaymentSplit{}).
		Where("mentor_id = ? AND transfer_status = ?", mentorID, "pending")
	q.Count(&total)
	if err := q.Order("created_at ASC").Offset(offset).Limit(pageSize).Find(&splits).Error; err != nil {
		return nil, 0, err
	}
	return splits, total, nil
}

// ============= PaymentWebhook Operations =============

func (r *paymentRepository) CreateWebhook(entity *models.PaymentWebhook) error {
	return r.db.Create(entity).Error
}

func (r *paymentRepository) GetWebhookByStripeEventID(stripeEventID string) (*models.PaymentWebhook, error) {
	var webhook models.PaymentWebhook
	if err := r.db.First(&webhook, "stripe_event_id = ?", stripeEventID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &webhook, nil
}

func (r *paymentRepository) GetPendingWebhooks(limit int) ([]models.PaymentWebhook, error) {
	var webhooks []models.PaymentWebhook
	if limit < 1 {
		limit = 100
	}
	if err := r.db.Where("processed = ?", false).Order("created_at ASC").Limit(limit).Find(&webhooks).Error; err != nil {
		return nil, err
	}
	return webhooks, nil
}

func (r *paymentRepository) UpdateWebhook(entity *models.PaymentWebhook) error {
	return r.db.Save(entity).Error
}
