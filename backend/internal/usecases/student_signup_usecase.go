package usecases

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/auth"
	"github.com/approva-cards/back-aprova-cards/pkg/errors"
	"github.com/google/uuid"
)

type StudentSignUpUseCase interface {
	// Invitation operations
	GenerateInvitation(req *dto.GenerateInvitationRequest, mentorID string) (*dto.InvitationResponse, error)
	GetInvitation(invitationID string) (*dto.InvitationResponse, error)
	ListMentorInvitations(mentorID string, page, pageSize int) (*dto.InvitationListResponse, error)
	ValidateInviteCode(code string) (*dto.ValidateInviteCodeResponse, error)

	// Student signup operations
	InitiateStudentSignUp(req *dto.StudentSignUpRequest) (*dto.StudentSignUpResponse, error)
	CompleteStudentSignUp(req *dto.CompleteStudentSignUpRequest) (*dto.CompleteStudentSignUpResponse, error)

	// Auth operations
	GetStudentAuth(email string) (*dto.StudentAuthResponse, error)
	CreateSupabaseUser(email, password, fullName, invitationID string) (supabaseUserID string, err error)
}

type studentSignUpUseCase struct {
	invitationRepo    repositories.StudentInvitationRepository
	mentorRepo        repositories.MentorRepository
	productRepo       repositories.ProductRepository
	paymentRepo       repositories.PaymentRepository
	studentAccessRepo repositories.StudentAccessRepository
	supabaseAuth      *auth.SupabaseAuthService
}

func NewStudentSignUpUseCase(
	invitationRepo repositories.StudentInvitationRepository,
	mentorRepo repositories.MentorRepository,
	productRepo repositories.ProductRepository,
	paymentRepo repositories.PaymentRepository,
	studentAccessRepo repositories.StudentAccessRepository,
	supabaseAuth *auth.SupabaseAuthService,
) StudentSignUpUseCase {
	return &studentSignUpUseCase{
		invitationRepo:    invitationRepo,
		mentorRepo:        mentorRepo,
		productRepo:       productRepo,
		paymentRepo:       paymentRepo,
		studentAccessRepo: studentAccessRepo,
		supabaseAuth:      supabaseAuth,
	}
}

// GenerateInvitation generates a unique invitation link for a student
func (uc *studentSignUpUseCase) GenerateInvitation(req *dto.GenerateInvitationRequest, mentorID string) (*dto.InvitationResponse, error) {
	// Validate request
	if req.ProductID == "" {
		return nil, errors.NewBadRequest("ProductID is required")
	}

	// Verify product exists and belongs to mentor
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

	// Generate unique invite code
	inviteCode, err := generateUniqueInviteCode()
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to generate invite code")
	}

	// Set expiration
	expirationDays := req.ExpirationDays
	if expirationDays == 0 {
		expirationDays = 30
	}
	expiresAt := time.Now().AddDate(0, 0, expirationDays)

	// Create invitation
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

// GetInvitation retrieves an invitation by ID
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

// ListMentorInvitations lists all invitations for a mentor
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

// ValidateInviteCode validates if an invite code is valid and not expired
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

	// Check if expired
	if time.Now().After(invitation.ExpiresAt) {
		return &dto.ValidateInviteCodeResponse{
			IsValid: false,
			Message: "Invitation has expired",
		}, nil
	}

	// Check if already used
	if invitation.Status == "active" {
		return &dto.ValidateInviteCodeResponse{
			IsValid: false,
			Message: "Invitation has already been used",
		}, nil
	}

	// Get product info
	product, err := uc.productRepo.GetByID(invitation.ProductID)
	if err == nil && product != nil {
		return &dto.ValidateInviteCodeResponse{
			IsValid:      true,
			InvitationID: invitation.ID,
			ProductID:    invitation.ProductID,
			MentorID:     invitation.MentorID,
			ProductName:  product.Name,
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

// InitiateStudentSignUp initiates student signup process
func (uc *studentSignUpUseCase) InitiateStudentSignUp(req *dto.StudentSignUpRequest) (*dto.StudentSignUpResponse, error) {
	// Validate invitation code
	validation, err := uc.ValidateInviteCode(req.InviteCode)
	if err != nil {
		return nil, err
	}

	if !validation.IsValid {
		return nil, errors.NewBadRequest(validation.Message)
	}

	// Get invitation
	invitation, err := uc.invitationRepo.GetByInviteCode(req.InviteCode)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch invitation")
	}

	// Check if email is already used
	existingAuth, err := uc.invitationRepo.GetStudentAuthByEmail(req.Email)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to check email")
	}
	if existingAuth != nil {
		return nil, errors.NewBadRequest("Email already registered")
	}

	// Update invitation with student email and mark as signed_up
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
		NextStep:     "payment", // Next step is to process payment
	}, nil
}

// CompleteStudentSignUp completes the signup after payment is approved
// This is called by the payment webhook after successful payment
func (uc *studentSignUpUseCase) CompleteStudentSignUp(req *dto.CompleteStudentSignUpRequest) (*dto.CompleteStudentSignUpResponse, error) {
	// Get invitation
	invitation, err := uc.invitationRepo.GetByInviteCode(req.InviteCode)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch invitation")
	}
	if invitation == nil {
		return nil, errors.NewNotFound("Invitation not found")
	}

	// Verify payment
	payment, err := uc.paymentRepo.GetByID(req.PaymentID)
	if err != nil {
		return nil, errors.NewInternalServerError("Failed to fetch payment")
	}
	if payment == nil {
		return nil, errors.NewNotFound("Payment not found")
	}

	if payment.Status != "succeeded" {
		return nil, errors.NewBadRequest("Payment has not been approved")
	}

	if payment.StudentEmail != req.Email {
		return nil, errors.NewBadRequest("Payment email does not match")
	}

	// Create Supabase user
	supabaseUserID, err := uc.CreateSupabaseUser(req.Email, "", req.FullName, invitation.ID)
	if err != nil {
		return nil, errors.NewInternalServerError(fmt.Sprintf("Failed to create user: %v", err))
	}

	// Create StudentAuth record
	studentAuth := &models.StudentAuth{
		ID:             uuid.New().String(),
		StudentEmail:   req.Email,
		SupabaseUserID: supabaseUserID,
		InvitationID:   &invitation.ID,
		MentorID:       invitation.MentorID,
		ProductID:      invitation.ProductID,
		EmailVerified:  false,
	}

	if err := uc.invitationRepo.CreateStudentAuth(studentAuth); err != nil {
		return nil, errors.NewInternalServerError("Failed to create student auth")
	}

	// Create student_access record
	studentAccess := &models.StudentAccess{
		Email:        req.Email,
		ProductID:    invitation.ProductID,
		Active:       true,
		InvitationID: &invitation.ID,
	}

	if err := uc.studentAccessRepo.Create(studentAccess); err != nil {
		return nil, errors.NewInternalServerError("Failed to create student access")
	}

	// Update invitation to active
	now := time.Now()
	invitation.Status = "active"
	invitation.PaymentID = &req.PaymentID
	invitation.ActivatedAt = &now

	if err := uc.invitationRepo.Update(invitation); err != nil {
		return nil, errors.NewInternalServerError("Failed to activate invitation")
	}

	return &dto.CompleteStudentSignUpResponse{
		StudentAuthID:  studentAuth.ID,
		Email:          studentAuth.StudentEmail,
		SupabaseUserID: supabaseUserID,
		Message:        "Student signup completed successfully",
	}, nil
}

// GetStudentAuth retrieves student auth info
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

// CreateSupabaseUser creates a user in Supabase Auth using the Admin API
func (uc *studentSignUpUseCase) CreateSupabaseUser(email, password, fullName, invitationID string) (string, error) {
	if uc.supabaseAuth == nil {
		// Fallback: generate a placeholder ID if Supabase service is not configured
		return uuid.New().String(), nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Prepare user metadata
	metadata := map[string]interface{}{
		"invitation_id": invitationID,
		"signup_method": "student_invitation",
		"created_at":    time.Now().Unix(),
	}

	// Create user
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

// Helper functions

func (uc *studentSignUpUseCase) invitationToDTO(invitation *models.StudentInvitation) *dto.InvitationResponse {
	inviteLink := fmt.Sprintf("%s/signup?code=%s", getBaseURL(), invitation.InviteCode)

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
		baseURL = "http://localhost:5173" // Default for development
	}
	return baseURL
}
