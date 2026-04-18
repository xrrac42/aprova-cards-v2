package usecases

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/auth"
)

type AuthUseCase interface {
	AdminLogin(req *dto.AdminLoginRequest, jwtSecret string, jwtExp int) (*dto.LoginResponse, error)
}

type authUseCase struct {
	mentorRepo repositories.MentorRepository
	adminEmail string
	adminPassHash string
}

func NewAuthUseCase(mentorRepo repositories.MentorRepository, adminEmail, adminPass string) AuthUseCase {
	h := sha256.Sum256([]byte(adminPass))
	return &authUseCase{
		mentorRepo:    mentorRepo,
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
