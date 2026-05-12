package usecases

import (
	"fmt"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/errors"
)

type PaymentUseCase interface {
	GetPayment(paymentID string) (*dto.PaymentResponse, error)
	ListPayments(query *dto.ListPaymentsQuery) (*dto.PaymentListResponse, error)
	GetStudentPayments(email string, page, pageSize int) (*dto.PaymentListResponse, error)
	CalculatePaymentSplit(totalAmountCents int, splitPercentage float64) (*dto.PaymentSplitDTO, error)
}

type paymentUseCase struct {
	paymentRepo repositories.PaymentRepository
	mentorRepo  repositories.MentorRepository
	productRepo repositories.ProductRepository
}

func NewPaymentUseCase(
	paymentRepo repositories.PaymentRepository,
	mentorRepo repositories.MentorRepository,
	productRepo repositories.ProductRepository,
) PaymentUseCase {
	return &paymentUseCase{
		paymentRepo: paymentRepo,
		mentorRepo:  mentorRepo,
		productRepo: productRepo,
	}
}

func (uc *paymentUseCase) GetPayment(paymentID string) (*dto.PaymentResponse, error) {
	payment, err := uc.paymentRepo.GetByID(paymentID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch payment")
	}
	if payment == nil {
		return nil, errors.NewNotFound("Payment not found")
	}
	split, _ := uc.paymentRepo.GetSplitByPaymentID(paymentID)
	return paymentToDTO(payment, split), nil
}

func (uc *paymentUseCase) ListPayments(query *dto.ListPaymentsQuery) (*dto.PaymentListResponse, error) {
	filter := make(map[string]interface{})
	if query.StudentEmail != nil {
		filter["student_email"] = *query.StudentEmail
	}
	if query.ProductID != nil {
		filter["product_id"] = *query.ProductID
	}
	if query.Status != nil {
		filter["status"] = *query.Status
	}

	payments, total, err := uc.paymentRepo.List(filter, query.Page, query.PageSize)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to list payments")
	}

	var data []dto.PaymentResponse
	for _, p := range payments {
		split, _ := uc.paymentRepo.GetSplitByPaymentID(p.ID)
		data = append(data, *paymentToDTO(&p, split))
	}

	totalPages := int(total) / query.PageSize
	if int(total)%query.PageSize > 0 {
		totalPages++
	}

	return &dto.PaymentListResponse{
		Data:       data,
		Total:      total,
		Page:       query.Page,
		PageSize:   query.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (uc *paymentUseCase) GetStudentPayments(email string, page, pageSize int) (*dto.PaymentListResponse, error) {
	payments, total, err := uc.paymentRepo.GetByStudentEmail(email, page, pageSize)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch student payments")
	}

	var data []dto.PaymentResponse
	for _, p := range payments {
		split, _ := uc.paymentRepo.GetSplitByPaymentID(p.ID)
		data = append(data, *paymentToDTO(&p, split))
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	return &dto.PaymentListResponse{
		Data:       data,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

func (uc *paymentUseCase) CalculatePaymentSplit(totalAmountCents int, splitPercentage float64) (*dto.PaymentSplitDTO, error) {
	if splitPercentage < 0 || splitPercentage > 100 {
		return nil, errors.NewBadRequest("Split percentage must be between 0 and 100")
	}
	mentorAmount := int(float64(totalAmountCents) * splitPercentage / 100)
	return &dto.PaymentSplitDTO{
		MentorAmountCents: mentorAmount,
		PlatformFeeCents:  totalAmountCents - mentorAmount,
		SplitPercentage:   splitPercentage,
	}, nil
}

func paymentToDTO(payment *models.Payment, split *models.PaymentSplit) *dto.PaymentResponse {
	var splitDTO *dto.PaymentSplitDTO
	if split != nil {
		splitDTO = &dto.PaymentSplitDTO{
			ID:                split.ID,
			PaymentID:         split.PaymentID,
			MentorID:          split.MentorID,
			PlatformFeeCents:  split.PlatformFeeCents,
			MentorAmountCents: split.MentorAmountCents,
			SplitPercentage:   split.SplitPercentage,
			TransferStatus:    split.TransferStatus,
		}
	}
	return &dto.PaymentResponse{
		ID:                payment.ID,
		StudentEmail:      payment.StudentEmail,
		ProductID:         payment.ProductID,
		MentorID:          payment.MentorID,
		ExternalPaymentID: payment.ExternalPaymentID,
		AmountCents:       payment.AmountCents,
		Currency:          payment.Currency,
		Status:            payment.Status,
		PaymentMethod:     payment.PaymentMethod,
		PaymentSplit:      splitDTO,
		CreatedAt:         payment.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         payment.UpdatedAt.Format(time.RFC3339),
		SucceededAt:       formatTimePtr(payment.SucceededAt),
	}
}

func formatTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339)
	return &s
}

// ensure fmt is used
var _ = fmt.Sprintf
