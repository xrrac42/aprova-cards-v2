package usecases

import (
	"testing"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockPaymentRepository is a mock for PaymentRepository
type MockPaymentRepository struct {
	mock.Mock
}

func (m *MockPaymentRepository) Create(entity *models.Payment) error {
	return m.Called(entity).Error(0)
}

func (m *MockPaymentRepository) GetByID(id string) (*models.Payment, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Payment), args.Error(1)
}

func (m *MockPaymentRepository) GetByExternalPaymentID(externalPaymentID string) (*models.Payment, error) {
	args := m.Called(externalPaymentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Payment), args.Error(1)
}

func (m *MockPaymentRepository) GetByStudentEmail(email string, page, pageSize int) ([]models.Payment, int64, error) {
	args := m.Called(email, page, pageSize)
	return args.Get(0).([]models.Payment), int64(args.Int(1)), args.Error(2)
}

func (m *MockPaymentRepository) GetByProductID(productID string, page, pageSize int) ([]models.Payment, int64, error) {
	args := m.Called(productID, page, pageSize)
	return args.Get(0).([]models.Payment), int64(args.Int(1)), args.Error(2)
}

func (m *MockPaymentRepository) Update(entity *models.Payment) error {
	return m.Called(entity).Error(0)
}

func (m *MockPaymentRepository) List(filter map[string]interface{}, page, pageSize int) ([]models.Payment, int64, error) {
	args := m.Called(filter, page, pageSize)
	return args.Get(0).([]models.Payment), int64(args.Int(1)), args.Error(2)
}

func (m *MockPaymentRepository) CreateSplit(entity *models.PaymentSplit) error {
	return m.Called(entity).Error(0)
}

func (m *MockPaymentRepository) GetSplitByPaymentID(paymentID string) (*models.PaymentSplit, error) {
	args := m.Called(paymentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PaymentSplit), args.Error(1)
}

func (m *MockPaymentRepository) UpdateSplit(entity *models.PaymentSplit) error {
	return m.Called(entity).Error(0)
}

func (m *MockPaymentRepository) GetPendingSplitsByMentorID(mentorID string, page, pageSize int) ([]models.PaymentSplit, int64, error) {
	args := m.Called(mentorID, page, pageSize)
	return args.Get(0).([]models.PaymentSplit), int64(args.Int(1)), args.Error(2)
}

func (m *MockPaymentRepository) CreateWebhook(entity *models.PaymentWebhook) error {
	return m.Called(entity).Error(0)
}

func (m *MockPaymentRepository) GetWebhookByExternalEventID(externalEventID string) (*models.PaymentWebhook, error) {
	args := m.Called(externalEventID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PaymentWebhook), args.Error(1)
}

func (m *MockPaymentRepository) GetPendingWebhooks(limit int) ([]models.PaymentWebhook, error) {
	args := m.Called(limit)
	return args.Get(0).([]models.PaymentWebhook), args.Error(1)
}

func (m *MockPaymentRepository) UpdateWebhook(entity *models.PaymentWebhook) error {
	return m.Called(entity).Error(0)
}

// MockMentorRepository is a mock for MentorRepository
type MockMentorRepository struct {
	mock.Mock
}

func (m *MockMentorRepository) Create(entity *models.Mentor) error {
	return m.Called(entity).Error(0)
}

func (m *MockMentorRepository) GetByID(id string) (*models.Mentor, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Mentor), args.Error(1)
}

func (m *MockMentorRepository) GetByEmail(email string) (*models.Mentor, error) {
	args := m.Called(email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Mentor), args.Error(1)
}

func (m *MockMentorRepository) GetBySlug(slug string) (*models.Mentor, error) {
	args := m.Called(slug)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Mentor), args.Error(1)
}

func (m *MockMentorRepository) GetAll(page, pageSize int) ([]models.Mentor, int64, error) {
	args := m.Called(page, pageSize)
	return args.Get(0).([]models.Mentor), int64(args.Int(1)), args.Error(2)
}

func (m *MockMentorRepository) Update(entity *models.Mentor) error {
	return m.Called(entity).Error(0)
}

func (m *MockMentorRepository) Delete(id string) error {
	return m.Called(id).Error(0)
}

// MockProductRepository is a mock for ProductRepository
type MockProductRepository struct {
	mock.Mock
}

func (m *MockProductRepository) Create(entity *models.Product) error {
	return m.Called(entity).Error(0)
}

func (m *MockProductRepository) GetByID(id string) (*models.Product, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Product), args.Error(1)
}

func (m *MockProductRepository) GetAll(page, pageSize int) ([]models.Product, int64, error) {
	args := m.Called(page, pageSize)
	return args.Get(0).([]models.Product), int64(args.Int(1)), args.Error(2)
}

func (m *MockProductRepository) GetByMentorID(mentorID string, page, pageSize int) ([]models.Product, int64, error) {
	args := m.Called(mentorID, page, pageSize)
	return args.Get(0).([]models.Product), int64(args.Int(1)), args.Error(2)
}

func (m *MockProductRepository) Update(entity *models.Product) error {
	return m.Called(entity).Error(0)
}

func (m *MockProductRepository) Delete(id string) error {
	return m.Called(id).Error(0)
}

func TestCalculatePaymentSplit(t *testing.T) {
	uc := NewPaymentUseCase(new(MockPaymentRepository), new(MockMentorRepository), new(MockProductRepository))

	tests := []struct {
		name             string
		totalAmount      int
		splitPercentage  float64
		expectError      bool
		expectedMentor   int
		expectedPlatform int
	}{
		{"70-30 split", 10000, 70.0, false, 7000, 3000},
		{"80-20 split", 5000, 80.0, false, 4000, 1000},
		{"negative split", 10000, -10.0, true, 0, 0},
		{"split over 100", 10000, 150.0, true, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := uc.CalculatePaymentSplit(tt.totalAmount, tt.splitPercentage)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedMentor, result.MentorAmountCents)
				assert.Equal(t, tt.expectedPlatform, result.PlatformFeeCents)
			}
		})
	}
}

func TestGetPayment(t *testing.T) {
	mockPaymentRepo := new(MockPaymentRepository)

	paymentID := uuid.New().String()
	now := time.Now()
	payment := &models.Payment{
		ID:                paymentID,
		StudentEmail:      "student@example.com",
		ProductID:         uuid.New().String(),
		MentorID:          uuid.New().String(),
		ExternalPaymentID: "kiwify_order_123",
		AmountCents:       10000,
		Currency:          "brl",
		Status:            "succeeded",
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	split := &models.PaymentSplit{
		ID:                paymentID,
		PaymentID:         paymentID,
		MentorID:          payment.MentorID,
		PlatformFeeCents:  3000,
		MentorAmountCents: 7000,
		SplitPercentage:   70.0,
	}

	mockPaymentRepo.On("GetByID", paymentID).Return(payment, nil)
	mockPaymentRepo.On("GetSplitByPaymentID", paymentID).Return(split, nil)

	uc := NewPaymentUseCase(mockPaymentRepo, new(MockMentorRepository), new(MockProductRepository))
	result, err := uc.GetPayment(paymentID)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, paymentID, result.ID)
	assert.Equal(t, "student@example.com", result.StudentEmail)
	assert.Equal(t, "succeeded", result.Status)
	assert.NotNil(t, result.PaymentSplit)
	assert.Equal(t, 7000, result.PaymentSplit.MentorAmountCents)
}

func TestGetStudentPayments(t *testing.T) {
	mockPaymentRepo := new(MockPaymentRepository)

	studentEmail := "student@example.com"
	payments := []models.Payment{
		{
			ID:                uuid.New().String(),
			StudentEmail:      studentEmail,
			ProductID:         uuid.New().String(),
			MentorID:          uuid.New().String(),
			ExternalPaymentID: "kiwify_1",
			AmountCents:       10000,
			Currency:          "brl",
			Status:            "succeeded",
		},
		{
			ID:                uuid.New().String(),
			StudentEmail:      studentEmail,
			ProductID:         uuid.New().String(),
			MentorID:          uuid.New().String(),
			ExternalPaymentID: "kiwify_2",
			AmountCents:       5000,
			Currency:          "brl",
			Status:            "pending",
		},
	}

	mockPaymentRepo.On("GetByStudentEmail", studentEmail, 1, 20).Return(payments, 2, nil)
	mockPaymentRepo.On("GetSplitByPaymentID", mock.Anything).Return(nil, nil)

	uc := NewPaymentUseCase(mockPaymentRepo, new(MockMentorRepository), new(MockProductRepository))
	result, err := uc.GetStudentPayments(studentEmail, 1, 20)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, int64(2), result.Total)
	assert.Len(t, result.Data, 2)
}

func TestListPayments(t *testing.T) {
	mockPaymentRepo := new(MockPaymentRepository)

	payments := []models.Payment{
		{
			ID:                uuid.New().String(),
			StudentEmail:      "student@example.com",
			ProductID:         uuid.New().String(),
			MentorID:          uuid.New().String(),
			ExternalPaymentID: "kiwify_1",
			AmountCents:       10000,
			Currency:          "brl",
			Status:            "succeeded",
		},
	}

	productID := payments[0].ProductID
	mockPaymentRepo.On("List", map[string]interface{}{"product_id": productID}, 1, 20).
		Return(payments, 1, nil)
	mockPaymentRepo.On("GetSplitByPaymentID", mock.Anything).Return(nil, nil)

	uc := NewPaymentUseCase(mockPaymentRepo, new(MockMentorRepository), new(MockProductRepository))
	query := &dto.ListPaymentsQuery{
		ProductID: &productID,
		Page:      1,
		PageSize:  20,
	}
	result, err := uc.ListPayments(query)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, int64(1), result.Total)
	assert.Len(t, result.Data, 1)
}
