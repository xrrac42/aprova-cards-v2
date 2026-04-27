package usecases

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/auth"
	apperrors "github.com/approva-cards/back-aprova-cards/pkg/errors"
	"gorm.io/gorm"
)

type AuthUseCase interface {
	InviteAndGrantAccess(email string, mentorID string) error
	AdminLogin(req *dto.AdminLoginRequest, jwtSecret string, jwtExp int) (*dto.LoginResponse, error)
	ValidateStudentPortalAccess(slug, studentID, studentEmail string) (*dto.StudentPortalAccessResponse, error)
}

type authUseCase struct {
	mentorRepo        repositories.MentorRepository
	db                *gorm.DB
	adminEmail        string
	adminPassHash     string
	supabaseAdmin     auth.SupabaseAdmin
	studentAccessRepo repositories.StudentAccessRepository
}

func NewAuthUseCase(
	mentorRepo repositories.MentorRepository,
	studentAccessRepo repositories.StudentAccessRepository,
	supabaseAdmin auth.SupabaseAdmin,
	db *gorm.DB,
	adminEmail,
	adminPass string,
) AuthUseCase {
	h := sha256.Sum256([]byte(adminPass))
	return &authUseCase{
		mentorRepo:        mentorRepo,
		studentAccessRepo: studentAccessRepo,
		supabaseAdmin:     supabaseAdmin,
		db:                db,
		adminEmail:        adminEmail,
		adminPassHash:     hex.EncodeToString(h[:]),
	}
}

// InviteAndGrantAccess sends a Supabase invite email. Full access provisioning
// (student_access row) happens via ActivateFromCheckout in the Stripe webhook.
func (u *authUseCase) InviteAndGrantAccess(email string, mentorID string) error {
	if u.supabaseAdmin == nil {
		return fmt.Errorf("supabase admin not configured")
	}
	_, err := u.supabaseAdmin.InviteUserByEmail(email)
	if err != nil {
		return fmt.Errorf("erro ao convidar aluno: %w", err)
	}
	return nil
}

func (uc *authUseCase) AdminLogin(req *dto.AdminLoginRequest, jwtSecret string, jwtExp int) (*dto.LoginResponse, error) {
	if req.Email != uc.adminEmail {
		return nil, errors.New("invalid credentials")
	}

	h := sha256.Sum256([]byte(req.Password))
	inputHash := hex.EncodeToString(h[:])

	if subtle.ConstantTimeCompare([]byte(inputHash), []byte(uc.adminPassHash)) != 1 {
		return nil, errors.New("invalid credentials")
	}

	token, err := auth.GenerateToken(jwtSecret, jwtExp, "admin", uc.adminEmail, "admin")
	if err != nil {
		return nil, errors.New("failed to generate token")
	}

	return &dto.LoginResponse{
		Token: token,
		User: dto.UserInfo{
			ID:    "admin",
			Email: uc.adminEmail,
			Role:  "admin",
			Name:  "Administrator",
		},
	}, nil
}

func (uc *authUseCase) ValidateStudentPortalAccess(slug, studentID, studentEmail string) (*dto.StudentPortalAccessResponse, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" || strings.TrimSpace(studentID) == "" {
		return nil, apperrors.NewBadRequest("slug e student_id são obrigatórios")
	}

	mentor, err := uc.mentorRepo.GetBySlug(slug)
	if err != nil {
		return nil, err
	}
	if mentor == nil {
		return nil, apperrors.NewForbidden("Acesso negado. Você não possui permissão para acessar este portal.")
	}

	var access struct {
		StudentID string `gorm:"column:student_id"`
		MentorID  string `gorm:"column:mentor_id"`
		ProductID string `gorm:"column:product_id"`
		Email     string `gorm:"column:email"`
	}

	// Primary: student_id + mentor_id (populated by webhook after payment)
	err = uc.db.Raw(`
		SELECT sa.student_id, sa.mentor_id, sa.product_id, sa.email
		FROM student_access sa
		WHERE sa.student_id = ?
		  AND sa.mentor_id = ?
		  AND sa.active = true
		LIMIT 1
	`, studentID, mentor.ID).Scan(&access).Error
	if err == nil && strings.TrimSpace(access.ProductID) != "" {
		return &dto.StudentPortalAccessResponse{
			MentorID:  mentor.ID,
			ProductID: access.ProductID,
			Email:     access.Email,
		}, nil
	}

	if strings.TrimSpace(studentEmail) == "" {
		return nil, apperrors.NewForbidden("Acesso negado. Você não possui permissão para acessar este portal.")
	}

	// Fallback: email + product.mentor_id for older records
	err = uc.db.Raw(`
		SELECT sa.student_id, sa.mentor_id, sa.product_id, sa.email
		FROM student_access sa
		JOIN products p ON p.id = sa.product_id
		WHERE LOWER(sa.email) = LOWER(?)
		  AND p.mentor_id = ?
		  AND sa.active = true
		LIMIT 1
	`, studentEmail, mentor.ID).Scan(&access).Error
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(access.ProductID) == "" {
		return nil, apperrors.NewForbidden("Acesso negado. Você não possui permissão para acessar este portal.")
	}

	return &dto.StudentPortalAccessResponse{
		MentorID:  mentor.ID,
		ProductID: access.ProductID,
		Email:     access.Email,
	}, nil
}
