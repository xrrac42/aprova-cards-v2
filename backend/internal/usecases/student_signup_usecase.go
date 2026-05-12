package usecases

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/auth"
	"github.com/approva-cards/back-aprova-cards/pkg/errors"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type StudentSignUpUseCase interface {
	// Invitation operations
	GenerateInvitation(req *dto.GenerateInvitationRequest, mentorID string) (*dto.InvitationResponse, error)
	GetInvitation(invitationID string) (*dto.InvitationResponse, error)
	ListMentorInvitations(mentorID string, page, pageSize int) (*dto.InvitationListResponse, error)
	ValidateInviteCode(code string) (*dto.ValidateInviteCodeResponse, error)

	// Kiwify payment flow
	ActivateFromKiwify(req *dto.ActivateFromKiwifyRequest) error

	// Student signup operations
	InitiateStudentSignUp(req *dto.StudentSignUpRequest) (*dto.StudentSignUpResponse, error)

	// Auth operations
	GetStudentAuth(email string) (*dto.StudentAuthResponse, error)
	CreateSupabaseUser(email, password, fullName, invitationID string) (supabaseUserID string, err error)
}

type studentSignUpUseCase struct {
	db                *gorm.DB
	invitationRepo    repositories.StudentInvitationRepository
	mentorRepo        repositories.MentorRepository
	productRepo       repositories.ProductRepository
	paymentRepo       repositories.PaymentRepository
	studentAccessRepo repositories.StudentAccessRepository
	supabaseAuth      *auth.SupabaseAuthService
	supabaseAdmin     *auth.SupabaseAdminClient
}

func NewStudentSignUpUseCase(
	db *gorm.DB,
	invitationRepo repositories.StudentInvitationRepository,
	mentorRepo repositories.MentorRepository,
	productRepo repositories.ProductRepository,
	paymentRepo repositories.PaymentRepository,
	studentAccessRepo repositories.StudentAccessRepository,
	supabaseAuth *auth.SupabaseAuthService,
	supabaseAdmin *auth.SupabaseAdminClient,
) StudentSignUpUseCase {
	return &studentSignUpUseCase{
		db:                db,
		invitationRepo:    invitationRepo,
		mentorRepo:        mentorRepo,
		productRepo:       productRepo,
		paymentRepo:       paymentRepo,
		studentAccessRepo: studentAccessRepo,
		supabaseAuth:      supabaseAuth,
		supabaseAdmin:     supabaseAdmin,
	}
}

func (uc *studentSignUpUseCase) GenerateInvitation(req *dto.GenerateInvitationRequest, mentorID string) (*dto.InvitationResponse, error) {
	if req.ProductID == "" {
		return nil, errors.NewBadRequest("ProductID is required")
	}

	product, err := uc.productRepo.GetByID(req.ProductID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch product")
	}
	if product == nil {
		return nil, errors.NewNotFound("Product not found")
	}
	if product.MentorID != mentorID {
		return nil, errors.NewForbidden("Product does not belong to this mentor")
	}

	inviteCode, err := generateUniqueInviteCode()
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to generate invite code")
	}

	expirationDays := req.ExpirationDays
	if expirationDays == 0 {
		expirationDays = 30
	}
	expiresAt := time.Now().AddDate(0, 0, expirationDays)

	invitation := &models.StudentInvitation{
		ID:         uuid.New().String(),
		MentorID:   mentorID,
		ProductID:  req.ProductID,
		InviteCode: inviteCode,
		Status:     "pending",
		ExpiresAt:  expiresAt,
	}

	if req.InvitedEmail != "" {
		invitation.InvitedEmail = &req.InvitedEmail
	}
	if req.InvitedName != "" {
		invitation.InvitedName = &req.InvitedName
	}

	if err := uc.invitationRepo.Create(invitation); err != nil {
		return nil, errors.NewInternalServerError("Failed to create invitation")
	}

	return uc.invitationToDTO(invitation), nil
}

func (uc *studentSignUpUseCase) GetInvitation(invitationID string) (*dto.InvitationResponse, error) {
	invitation, err := uc.invitationRepo.GetByID(invitationID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch invitation")
	}
	if invitation == nil {
		return nil, errors.NewNotFound("Invitation not found")
	}

	return uc.invitationToDTO(invitation), nil
}

func (uc *studentSignUpUseCase) ListMentorInvitations(mentorID string, page, pageSize int) (*dto.InvitationListResponse, error) {
	invitations, total, err := uc.invitationRepo.GetByMentorID(mentorID, page, pageSize)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to list invitations")
	}

	var data []dto.InvitationResponse
	for _, inv := range invitations {
		data = append(data, *uc.invitationToDTO(&inv))
	}

	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	return &dto.InvitationListResponse{
		Data:       data,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

func (uc *studentSignUpUseCase) ValidateInviteCode(code string) (*dto.ValidateInviteCodeResponse, error) {
	invitation, err := uc.invitationRepo.GetByInviteCode(code)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to validate invitation")
	}

	if invitation == nil {
		return &dto.ValidateInviteCodeResponse{
			IsValid: false,
			Message: "Invalid invite code",
		}, nil
	}

	if time.Now().After(invitation.ExpiresAt) {
		return &dto.ValidateInviteCodeResponse{
			IsValid: false,
			Message: "Invitation has expired",
		}, nil
	}

	if invitation.Status == "active" {
		return &dto.ValidateInviteCodeResponse{
			IsValid: false,
			Message: "Invitation has already been used",
		}, nil
	}

	product, err := uc.productRepo.GetByID(invitation.ProductID)
	if err == nil && product != nil {
		paymentLink := ""
		if product.PaymentLink != nil {
			paymentLink = *product.PaymentLink
		}
		return &dto.ValidateInviteCodeResponse{
			IsValid:      true,
			InvitationID: invitation.ID,
			ProductID:    invitation.ProductID,
			MentorID:     invitation.MentorID,
			ProductName:  product.Name,
			PaymentLink:  paymentLink,
			Status:       invitation.Status,
			ExpiresAt:    invitation.ExpiresAt.Format(time.RFC3339),
			Message:      "Invitation is valid",
		}, nil
	}

	return &dto.ValidateInviteCodeResponse{
		IsValid:      true,
		InvitationID: invitation.ID,
		ProductID:    invitation.ProductID,
		MentorID:     invitation.MentorID,
		Status:       invitation.Status,
		ExpiresAt:    invitation.ExpiresAt.Format(time.RFC3339),
		Message:      "Invitation is valid",
	}, nil
}

func (uc *studentSignUpUseCase) InitiateStudentSignUp(req *dto.StudentSignUpRequest) (*dto.StudentSignUpResponse, error) {
	validation, err := uc.ValidateInviteCode(req.InviteCode)
	if err != nil {
		return nil, err
	}
	if !validation.IsValid {
		return nil, errors.NewBadRequest(validation.Message)
	}

	invitation, err := uc.invitationRepo.GetByInviteCode(req.InviteCode)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch invitation")
	}

	existingAuth, err := uc.invitationRepo.GetStudentAuthByEmail(req.Email)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to check email")
	}
	if existingAuth != nil {
		return nil, errors.NewBadRequest("E-mail inválido ou já cadastrado")
	}

	supabaseUserID := uuid.New().String()
	if uc.supabaseAdmin != nil && uc.supabaseAdmin.IsConfigured() {
		userMetadata := map[string]interface{}{
			"role":          "aluno",
			"mentor_id":     invitation.MentorID,
			"product_id":    invitation.ProductID,
			"invitation_id": invitation.ID,
			"signup_method": "student_invitation",
		}
		authUser, authErr := uc.supabaseAdmin.CreateAuthUserWithMetadata(req.Email, req.Password, userMetadata)
		if authErr != nil {
			return nil, errors.NewBadRequest("E-mail inválido ou já cadastrado")
		}
		supabaseUserID = authUser.ID
	}

	studentAuth := &models.StudentAuth{
		StudentEmail:   req.Email,
		SupabaseUserID: supabaseUserID,
		InvitationID:   &invitation.ID,
		MentorID:       invitation.MentorID,
		ProductID:      invitation.ProductID,
	}
	if err := uc.invitationRepo.CreateStudentAuth(studentAuth); err != nil {
		if uc.supabaseAdmin != nil && uc.supabaseAdmin.IsConfigured() {
			_ = uc.supabaseAdmin.DeleteAuthUser(supabaseUserID)
		}
		return nil, errors.NewInternalServerError("Failed to create student auth")
	}

	now := time.Now()
	invitation.StudentEmail = &req.Email
	invitation.Status = "signed_up"
	invitation.SignedUpAt = &now
	if err := uc.invitationRepo.Update(invitation); err != nil {
		return nil, errors.NewInternalServerError("Failed to update invitation")
	}

	return &dto.StudentSignUpResponse{
		InvitationID: invitation.ID,
		Email:        req.Email,
		Message:      "Sign up initiated successfully",
		NextStep:     "payment",
	}, nil
}

// ActivateFromKiwify handles the Kiwify order.approved webhook:
// creates payment + split records, updates user_roles, and grants student_access.
func (uc *studentSignUpUseCase) ActivateFromKiwify(req *dto.ActivateFromKiwifyRequest) error {
	existingAuth, err := uc.invitationRepo.GetStudentAuthByEmail(req.StudentEmail)
	if err != nil {
		return fmt.Errorf("failed to fetch student auth: %w", err)
	}

	// Derive mentor ID from student auth when not provided
	mentorID := req.MentorID
	if mentorID == "" && existingAuth != nil {
		mentorID = existingAuth.MentorID
	}
	if mentorID == "" {
		return fmt.Errorf("mentor ID not found for student %s", req.StudentEmail)
	}

	var invitation *models.StudentInvitation
	if existingAuth != nil && existingAuth.InvitationID != nil {
		invitation, _ = uc.invitationRepo.GetByID(*existingAuth.InvitationID)
	}

	mentor, err := uc.mentorRepo.GetByID(mentorID)
	if err != nil || mentor == nil {
		return fmt.Errorf("failed to fetch mentor %s: %w", mentorID, err)
	}

	currency := req.Currency
	if currency == "" {
		currency = "brl"
	}

	productID := ""
	if invitation != nil {
		productID = invitation.ProductID
	} else if existingAuth != nil {
		productID = existingAuth.ProductID
	}

	// Idempotent: reuse existing payment if already processed
	payment, _ := uc.paymentRepo.GetByExternalPaymentID(req.KiwifyOrderID)
	if payment == nil {
		now := time.Now()
		payment = &models.Payment{
			StudentEmail:      req.StudentEmail,
			ProductID:         productID,
			MentorID:          mentorID,
			ExternalPaymentID: req.KiwifyOrderID,
			AmountCents:       req.AmountCents,
			Currency:          currency,
			Status:            "succeeded",
			SucceededAt:       &now,
		}
		if err := uc.paymentRepo.Create(payment); err != nil {
			return fmt.Errorf("failed to create payment record: %w", err)
		}

		splitPct := mentor.RevenueShare
		split := &models.PaymentSplit{
			PaymentID:         payment.ID,
			MentorID:          mentor.ID,
			PlatformFeeCents:  int(float64(payment.AmountCents) * (1 - splitPct/100)),
			MentorAmountCents: int(float64(payment.AmountCents) * splitPct / 100),
			SplitPercentage:   splitPct,
		}
		if err := uc.paymentRepo.CreateSplit(split); err != nil {
			return fmt.Errorf("failed to create payment split: %w", err)
		}
	}

	supabaseUserID := ""
	if existingAuth != nil {
		supabaseUserID = existingAuth.SupabaseUserID
	}

	// Ensure user_roles has an up-to-date entry
	if supabaseUserID != "" {
		updated := uc.db.Model(&models.UserRole{}).
			Where("id = ? OR email = ?", supabaseUserID, req.StudentEmail).
			Updates(map[string]interface{}{
				"mentor_id":  mentorID,
				"product_id": productID,
				"role":       "aluno",
				"active":     true,
				"updated_at": time.Now(),
			})
		if updated.RowsAffected == 0 {
			role := &models.UserRole{
				ID:        supabaseUserID,
				Email:     req.StudentEmail,
				Role:      "aluno",
				MentorID:  &mentorID,
				ProductID: &productID,
				Active:    true,
			}
			if err := uc.db.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "email"}},
				DoUpdates: clause.AssignmentColumns([]string{"mentor_id", "product_id", "role", "active", "updated_at"}),
			}).Create(role).Error; err != nil {
				log.Printf("[kiwify-activate] user_roles upsert failed (non-fatal): %v", err)
			}
		}
	}

	// Grant student access — idempotent
	var invitationID *string
	if invitation != nil {
		invitationID = &invitation.ID
	}

	existingAccess, _ := uc.studentAccessRepo.GetByEmailAndProduct(req.StudentEmail, productID)
	if existingAccess == nil {
		mentorIDForAccess := mentorID
		access := &models.StudentAccess{
			Email:        req.StudentEmail,
			MentorID:     &mentorIDForAccess,
			ProductID:    productID,
			Active:       true,
			InvitationID: invitationID,
		}
		if supabaseUserID != "" {
			access.StudentID = &supabaseUserID
		}
		log.Printf("[kiwify-activate] creating student_access: email=%s mentor=%s product=%s", req.StudentEmail, mentorID, productID)
		if err := uc.studentAccessRepo.Create(access); err != nil {
			return fmt.Errorf("failed to create student access: %w", err)
		}
	} else {
		existingAccess.Active = true
		existingAccess.InactiveReason = nil
		mentorIDUpdate := mentorID
		existingAccess.MentorID = &mentorIDUpdate
		existingAccess.InvitationID = invitationID
		if (existingAccess.StudentID == nil || *existingAccess.StudentID == "") && supabaseUserID != "" {
			existingAccess.StudentID = &supabaseUserID
		}
		if err := uc.studentAccessRepo.Update(existingAccess); err != nil {
			return fmt.Errorf("failed to update student access: %w", err)
		}
	}

	// Activate invitation if found
	if invitation != nil {
		now := time.Now()
		paymentID := payment.ID
		invitation.Status = "active"
		invitation.PaymentID = &paymentID
		invitation.ActivatedAt = &now
		_ = uc.invitationRepo.Update(invitation)
	}

	return nil
}

func (uc *studentSignUpUseCase) GetStudentAuth(email string) (*dto.StudentAuthResponse, error) {
	auth, err := uc.invitationRepo.GetStudentAuthByEmail(email)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch student auth")
	}
	if auth == nil {
		return nil, errors.NewNotFound("Student auth not found")
	}

	return &dto.StudentAuthResponse{
		ID:             auth.ID,
		StudentEmail:   auth.StudentEmail,
		SupabaseUserID: auth.SupabaseUserID,
		MentorID:       auth.MentorID,
		ProductID:      auth.ProductID,
		EmailVerified:  auth.EmailVerified,
		CreatedAt:      auth.CreatedAt.Format(time.RFC3339),
	}, nil
}

func (uc *studentSignUpUseCase) CreateSupabaseUser(email, password, fullName, invitationID string) (string, error) {
	if uc.supabaseAuth == nil {
		return uuid.New().String(), nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	metadata := map[string]interface{}{
		"invitation_id": invitationID,
		"signup_method": "student_invitation",
		"created_at":    time.Now().Unix(),
	}

	response, err := uc.supabaseAuth.CreateUser(ctx, &auth.CreateAuthUserInput{
		Email:    email,
		Password: password,
		FullName: fullName,
		Metadata: metadata,
	})
	if err != nil {
		return "", fmt.Errorf("failed to create supabase user: %w", err)
	}

	return response.ID, nil
}

func (uc *studentSignUpUseCase) invitationToDTO(invitation *models.StudentInvitation) *dto.InvitationResponse {
	inviteLink := fmt.Sprintf("%s/checkout?code=%s", getBaseURL(), invitation.InviteCode)

	resp := &dto.InvitationResponse{
		ID:         invitation.ID,
		InviteCode: invitation.InviteCode,
		InviteLink: inviteLink,
		MentorID:   invitation.MentorID,
		ProductID:  invitation.ProductID,
		Status:     invitation.Status,
		ExpiresAt:  invitation.ExpiresAt.Format(time.RFC3339),
		CreatedAt:  invitation.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  invitation.UpdatedAt.Format(time.RFC3339),
	}

	if invitation.InvitedEmail != nil {
		resp.InvitedEmail = invitation.InvitedEmail
	}
	if invitation.InvitedName != nil {
		resp.InvitedName = invitation.InvitedName
	}
	if invitation.SignedUpAt != nil {
		signedUpAt := invitation.SignedUpAt.Format(time.RFC3339)
		resp.SignedUpAt = &signedUpAt
	}
	if invitation.ActivatedAt != nil {
		activatedAt := invitation.ActivatedAt.Format(time.RFC3339)
		resp.ActivatedAt = &activatedAt
	}

	return resp
}

func generateUniqueInviteCode() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func getBaseURL() string {
	baseURL := os.Getenv("FRONTEND_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:5173"
	}
	return baseURL
}
