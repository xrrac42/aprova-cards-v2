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
	"github.com/stripe/stripe-go/v79"
	checkoutsession "github.com/stripe/stripe-go/v79/checkout/session"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type StudentSignUpUseCase interface {
	// Invitation operations
	GenerateInvitation(req *dto.GenerateInvitationRequest, mentorID string) (*dto.InvitationResponse, error)
	GetInvitation(invitationID string) (*dto.InvitationResponse, error)
	ListMentorInvitations(mentorID string, page, pageSize int) (*dto.InvitationListResponse, error)
	ValidateInviteCode(code string) (*dto.ValidateInviteCodeResponse, error)

	// Stripe checkout flow
	CreateCheckoutSession(req *dto.CreateCheckoutSessionRequest) (*dto.CheckoutSessionResponse, error)
	ActivateFromCheckout(req *dto.ActivateFromCheckoutRequest) error

	// Student signup operations
	InitiateStudentSignUp(req *dto.StudentSignUpRequest) (*dto.StudentSignUpResponse, error)
	CompleteStudentSignUp(req *dto.CompleteStudentSignUpRequest) (*dto.CompleteStudentSignUpResponse, error)

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
	stripeSecretKey   string
	frontendBaseURL   string
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
	stripeSecretKey string,
	frontendBaseURL string,
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
		stripeSecretKey:   stripeSecretKey,
		frontendBaseURL:   frontendBaseURL,
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

	// Create Supabase user with the student's real password so they can log in after payment.
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

	// Persist student_auth immediately so the webhook can skip re-creation.
	studentAuth := &models.StudentAuth{
		StudentEmail:   req.Email,
		SupabaseUserID: supabaseUserID,
		InvitationID:   &invitation.ID,
		MentorID:       invitation.MentorID,
		ProductID:      invitation.ProductID,
	}
	if err := uc.invitationRepo.CreateStudentAuth(studentAuth); err != nil {
		// Roll back the Supabase user to keep state consistent.
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

// CreateCheckoutSession creates a Stripe Checkout Session (subscription mode) for the student invite flow.
func (uc *studentSignUpUseCase) CreateCheckoutSession(req *dto.CreateCheckoutSessionRequest) (*dto.CheckoutSessionResponse, error) {
	if uc.stripeSecretKey == "" {
		return nil, errors.NewInternalServerError("Stripe not configured: set STRIPE_SECRET_KEY (or STRIPE_SECRET/STRIPE_API_KEY) in backend environment")
	}

	validation, err := uc.ValidateInviteCode(req.InviteCode)
	if err != nil {
		return nil, err
	}
	if !validation.IsValid {
		return nil, errors.NewBadRequest(validation.Message)
	}

	product, err := uc.productRepo.GetByID(validation.ProductID)
	if err != nil || product == nil {
		return nil, errors.NewNotFound("Product not found")
	}

	currency := req.Currency
	if currency == "" {
		currency = "brl"
	}

	baseURL := uc.frontendBaseURL
	if baseURL == "" {
		baseURL = getBaseURL()
	}

	stripe.Key = uc.stripeSecretKey
	params := &stripe.CheckoutSessionParams{
		Mode: stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String(currency),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String(product.Name),
					},
					UnitAmount: stripe.Int64(int64(req.AmountCents)),
					Recurring: &stripe.CheckoutSessionLineItemPriceDataRecurringParams{
						Interval: stripe.String("month"),
					},
				},
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(baseURL + "/payment/success?session_id={CHECKOUT_SESSION_ID}"),
		CancelURL:  stripe.String(baseURL + "/payment/cancel"),
		Metadata: map[string]string{
			"invite_code": req.InviteCode,
			"mentor_id":   validation.MentorID,
			"product_id":  validation.ProductID,
		},
	}

	// Pre-fill student email in the Stripe form
	if inv, err2 := uc.invitationRepo.GetByInviteCode(req.InviteCode); err2 == nil && inv != nil && inv.StudentEmail != nil {
		params.CustomerEmail = stripe.String(*inv.StudentEmail)
		params.Metadata["student_email"] = *inv.StudentEmail
	}

	session, err := checkoutsession.New(params)
	if err != nil {
		return nil, errors.NewInternalServerError(fmt.Sprintf("failed to create checkout session: %v", err))
	}

	return &dto.CheckoutSessionResponse{
		SessionID:  session.ID,
		SessionURL: session.URL,
	}, nil
}

// ActivateFromCheckout handles the checkout.session.completed webhook:
// creates payment + split records, provisions the student's Supabase account if needed,
// creates student_access and activates the invitation.
func (uc *studentSignUpUseCase) ActivateFromCheckout(req *dto.ActivateFromCheckoutRequest) error {
	invitation, err := uc.invitationRepo.GetByInviteCode(req.InviteCode)
	if err != nil {
		return fmt.Errorf("failed to fetch invitation: %w", err)
	}
	if invitation == nil {
		return fmt.Errorf("invitation not found for code %s", req.InviteCode)
	}

	// Canonical email for granting access is invitation email (if present),
	// not the email typed during Stripe checkout.
	activationEmail := req.StudentEmail
	if invitation.StudentEmail != nil && *invitation.StudentEmail != "" {
		activationEmail = *invitation.StudentEmail
	}
	if activationEmail == "" {
		return fmt.Errorf("student email not available for invitation %s", invitation.ID)
	}

	mentor, err := uc.mentorRepo.GetByID(invitation.MentorID)
	if err != nil || mentor == nil {
		return fmt.Errorf("failed to fetch mentor: %w", err)
	}

	currency := req.Currency
	if currency == "" {
		currency = "brl"
	}

	// Idempotent payment creation: reuse existing record if the session was already processed.
	payment, _ := uc.paymentRepo.GetByStripePaymentIntentID(req.StripeSessionID)
	if payment == nil {
		now := time.Now()
		payment = &models.Payment{
			StudentEmail:          activationEmail,
			ProductID:             invitation.ProductID,
			MentorID:              invitation.MentorID,
			StripePaymentIntentID: req.StripeSessionID,
			AmountCents:           req.AmountCents,
			Currency:              currency,
			Status:                "succeeded",
			SucceededAt:           &now,
		}
		if req.StripeSubscriptionID != "" {
			payment.StripeSubscriptionID = &req.StripeSubscriptionID
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

	// Provision student in Supabase Auth if not already registered.
	existingAuth, _ := uc.invitationRepo.GetStudentAuthByEmail(activationEmail)

	var supabaseUserID string
	if existingAuth != nil {
		supabaseUserID = existingAuth.SupabaseUserID
	} else if uc.supabaseAdmin != nil && uc.supabaseAdmin.IsConfigured() {
		authUser, authErr := uc.supabaseAdmin.InviteUserByEmail(activationEmail)
		if authErr == nil {
			supabaseUserID = authUser.ID
			studentAuth := &models.StudentAuth{
				StudentEmail:   activationEmail,
				SupabaseUserID: authUser.ID,
				InvitationID:   &invitation.ID,
				MentorID:       invitation.MentorID,
				ProductID:      invitation.ProductID,
			}
			_ = uc.invitationRepo.CreateStudentAuth(studentAuth)
		}
	}

	// Ensure user_roles has an entry so the frontend login check passes.
	if supabaseUserID != "" {
		mentorID := invitation.MentorID
		productID := invitation.ProductID
		role := &models.UserRole{
			ID:        supabaseUserID,
			Email:     activationEmail,
			Role:      "aluno",
			MentorID:  &mentorID,
			ProductID: &productID,
			Active:    true,
		}
		_ = uc.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"active", "updated_at"}),
		}).Create(role).Error
	}

	// Grant access — idempotent: if a row already exists for this email+product, skip.
	existingAccess, _ := uc.studentAccessRepo.GetByEmailAndProduct(activationEmail, invitation.ProductID)
	if existingAccess == nil {
		access := &models.StudentAccess{
			Email:        activationEmail,
			MentorID:     invitation.MentorID,
			ProductID:    invitation.ProductID,
			Active:       true,
			InvitationID: &invitation.ID,
		}
		if supabaseUserID != "" {
			access.StudentID = &supabaseUserID
		}
		log.Printf("[activate] creating student_access: email=%s mentor=%s product=%s student_id=%v", activationEmail, invitation.MentorID, invitation.ProductID, supabaseUserID)
		if err := uc.studentAccessRepo.Create(access); err != nil {
			log.Printf("[activate] student_access CREATE failed: %v", err)
			return fmt.Errorf("failed to create student access: %w", err)
		}
		log.Printf("[activate] student_access created OK")
	} else {
		log.Printf("[activate] student_access already exists for %s, skipping create", activationEmail)

		// Payment approved: always reactivate existing access.
		existingAccess.Active = true
		existingAccess.InactiveReason = nil
		existingAccess.MentorID = invitation.MentorID
		existingAccess.InvitationID = &invitation.ID
		if (existingAccess.StudentID == nil || *existingAccess.StudentID == "") && supabaseUserID != "" {
			existingAccess.StudentID = &supabaseUserID
		}

		if err := uc.studentAccessRepo.Update(existingAccess); err != nil {
			log.Printf("[activate] student_access UPDATE failed: %v", err)
			return fmt.Errorf("failed to update student access: %w", err)
		}
	}

	now := time.Now()
	paymentID := payment.ID
	invitation.Status = "active"
	invitation.PaymentID = &paymentID
	invitation.ActivatedAt = &now
	_ = uc.invitationRepo.Update(invitation)

	return nil
}

func generateTempPassword() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
