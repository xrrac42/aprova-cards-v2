package usecases

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/pkg/auth"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type AdminMentorUseCase interface {
	CreateMentorByAdmin(req *dto.CreateMentorRequest, adminEmail string) (*dto.MentorResponse, error)
}

type adminMentorUseCase struct {
	db            *gorm.DB
	supabaseAdmin *auth.SupabaseAdminClient
}

func NewAdminMentorUseCase(db *gorm.DB, supabaseAdmin *auth.SupabaseAdminClient) AdminMentorUseCase {
	return &adminMentorUseCase{db: db, supabaseAdmin: supabaseAdmin}
}

func (uc *adminMentorUseCase) CreateMentorByAdmin(req *dto.CreateMentorRequest, adminEmail string) (*dto.MentorResponse, error) {
	if req == nil {
		return nil, errors.New("invalid request")
	}
	if uc.supabaseAdmin == nil || !uc.supabaseAdmin.IsConfigured() {
		return nil, errors.New("supabase admin integration not configured")
	}

	normalizedAdminEmail := strings.ToLower(strings.TrimSpace(adminEmail))
	if normalizedAdminEmail == "" {
		return nil, errors.New("admin email missing")
	}

	if err := uc.ensureAdminAccess(normalizedAdminEmail); err != nil {
		return nil, err
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
	normalizedSlug := strings.ToLower(strings.TrimSpace(req.Slug))
	if normalizedEmail == "" || normalizedSlug == "" {
		return nil, errors.New("email and slug are required")
	}

	var mentorByEmail models.Mentor
	if err := uc.db.Where("LOWER(email) = ?", normalizedEmail).First(&mentorByEmail).Error; err == nil {
		return nil, errors.New("mentor email already exists")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check mentor email: %w", err)
	}

	var mentorBySlug models.Mentor
	if err := uc.db.Where("slug = ?", normalizedSlug).First(&mentorBySlug).Error; err == nil {
		return nil, errors.New("mentor slug already exists")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check mentor slug: %w", err)
	}

	authUser, err := uc.supabaseAdmin.CreateAuthUser(normalizedEmail, req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to create auth user: %w", err)
	}

	revenueShare := req.RevenueShare
	if revenueShare == 0 {
		revenueShare = 50.0
	}

	mentor := &models.Mentor{
		Name:            strings.TrimSpace(req.Name),
		Email:           normalizedEmail,
		Slug:            normalizedSlug,
		PrimaryColor:    req.PrimaryColor,
		SecondaryColor:  req.SecondaryColor,
		LogoURL:         req.LogoURL,
		RevenueShare:    revenueShare,
		StripeAccountID: req.StripeAccountID,
	}
	if mentor.PrimaryColor == "" {
		mentor.PrimaryColor = "#6c63ff"
	}
	if mentor.SecondaryColor == "" {
		mentor.SecondaryColor = "#43e97b"
	}

	tx := uc.db.Begin()
	if tx.Error != nil {
		if err := uc.supabaseAdmin.DeleteAuthUser(authUser.ID); err != nil {
			log.Printf("[mentor-provisioning] failed to delete auth user %s on tx begin error: %v", authUser.ID, err)
		}
		return nil, tx.Error
	}

	if err := tx.Create(mentor).Error; err != nil {
		tx.Rollback()
		if delErr := uc.supabaseAdmin.DeleteAuthUser(authUser.ID); delErr != nil {
			log.Printf("[mentor-provisioning] failed to delete auth user %s on mentor create error: %v", authUser.ID, delErr)
		}
		return nil, err
	}

	mentorID := mentor.ID
	role := &models.UserRole{
		ID:       authUser.ID,
		Email:    normalizedEmail,
		Role:     "mentor",
		MentorID: &mentorID,
		Active:   true,
	}
	// Upsert: Supabase may auto-create a user_roles row via trigger on auth.users,
	// so a duplicate on PK is expected when retrying after a partial failure.
	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"email", "role", "mentor_id", "active", "updated_at"}),
	}).Create(role).Error; err != nil {
		tx.Rollback()
		if delErr := uc.supabaseAdmin.DeleteAuthUser(authUser.ID); delErr != nil {
			log.Printf("[mentor-provisioning] failed to delete auth user %s on role create error: %v", authUser.ID, delErr)
		}
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		if delErr := uc.supabaseAdmin.DeleteAuthUser(authUser.ID); delErr != nil {
			log.Printf("[mentor-provisioning] failed to delete auth user %s on commit error: %v", authUser.ID, delErr)
		}
		return nil, err
	}

	return &dto.MentorResponse{
		ID:              mentor.ID,
		Name:            mentor.Name,
		Email:           mentor.Email,
		Slug:            mentor.Slug,
		LogoURL:         mentor.LogoURL,
		PrimaryColor:    mentor.PrimaryColor,
		SecondaryColor:  mentor.SecondaryColor,
		RevenueShare:    mentor.RevenueShare,
		StripeAccountID: mentor.StripeAccountID,
		CreatedAt:       mentor.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}, nil
}

func (uc *adminMentorUseCase) ensureAdminAccess(email string) error {
	var role models.UserRole
	err := uc.db.Where("LOWER(email) = ? AND role = ? AND active = ?", email, "admin", true).First(&role).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("admin access required")
		}
		return err
	}
	return nil
}
