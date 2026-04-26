package usecases

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/auth"
	apperrors "github.com/approva-cards/back-aprova-cards/pkg/errors"
	"gorm.io/gorm"
)

type AuthUseCase interface {
	AdminLogin(req *dto.AdminLoginRequest, jwtSecret string, jwtExp int) (*dto.LoginResponse, error)
	ValidateStudentPortalAccess(slug, studentID, studentEmail string) error
}

type authUseCase struct {
	mentorRepo    repositories.MentorRepository
	db            *gorm.DB
	adminEmail    string
	adminPassHash string
}

func NewAuthUseCase(mentorRepo repositories.MentorRepository, db *gorm.DB, adminEmail, adminPass string) AuthUseCase {
	h := sha256.Sum256([]byte(adminPass))
	return &authUseCase{
		mentorRepo:    mentorRepo,
		db:            db,
		adminEmail:    adminEmail,
		adminPassHash: hex.EncodeToString(h[:]),
	}
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

func (uc *authUseCase) ValidateStudentPortalAccess(slug, studentID, studentEmail string) error {
	slug = strings.TrimSpace(slug)
	if slug == "" || strings.TrimSpace(studentID) == "" {
		return apperrors.NewBadRequest("slug e student_id são obrigatórios")
	}

	mentor, err := uc.mentorRepo.GetBySlug(slug)
	if err != nil {
		return err
	}
	if mentor == nil {
		return apperrors.NewForbidden("Acesso negado. Você não possui permissão para acessar este portal.")
	}

	var hasAccess bool
	// Preferred validation path for schemas that store explicit student_id + mentor_id.
	err = uc.db.Raw(`
		SELECT EXISTS (
			SELECT 1
			FROM student_access sa
			WHERE sa.student_id = ?
			  AND sa.mentor_id = ?
			  AND sa.active = true
		)
	`, studentID, mentor.ID).Scan(&hasAccess).Error
	if err == nil {
		if !hasAccess {
			return apperrors.NewForbidden("Acesso negado. Você não possui permissão para acessar este portal.")
		}
		return nil
	}

	if strings.TrimSpace(studentEmail) == "" {
		return apperrors.NewForbidden("Acesso negado. Você não possui permissão para acessar este portal.")
	}

	// Backward-compatible fallback for schemas that still map student_access by email+product.
	err = uc.db.Raw(`
		SELECT EXISTS (
			SELECT 1
			FROM student_access sa
			JOIN products p ON p.id = sa.product_id
			WHERE LOWER(sa.email) = LOWER(?)
			  AND p.mentor_id = ?
			  AND sa.active = true
		)
	`, studentEmail, mentor.ID).Scan(&hasAccess).Error
	if err != nil {
		return err
	}

	if !hasAccess {
		return apperrors.NewForbidden("Acesso negado. Você não possui permissão para acessar este portal.")
	}

	return nil
}
