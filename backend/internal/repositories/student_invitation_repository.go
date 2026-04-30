package repositories

import (
	"errors"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/gorm"
)

type StudentInvitationRepository interface {
	// StudentInvitation operations
	Create(entity *models.StudentInvitation) error
	GetByID(id string) (*models.StudentInvitation, error)
	GetByInviteCode(code string) (*models.StudentInvitation, error)
	GetByMentorIDAndProductID(mentorID, productID string, page, pageSize int) ([]models.StudentInvitation, int64, error)
	GetByMentorID(mentorID string, page, pageSize int) ([]models.StudentInvitation, int64, error)
	Update(entity *models.StudentInvitation) error
	Delete(id string) error

	// StudentAuth operations
	CreateStudentAuth(entity *models.StudentAuth) error
	GetStudentAuthByEmail(email string) (*models.StudentAuth, error)
	GetStudentAuthBySupabaseID(supabaseID string) (*models.StudentAuth, error)
	GetStudentAuthByInvitationID(invitationID string) (*models.StudentAuth, error)
	UpdateStudentAuth(entity *models.StudentAuth) error
}

type studentInvitationRepository struct{ db *gorm.DB }

func NewStudentInvitationRepository(db *gorm.DB) StudentInvitationRepository {
	return &studentInvitationRepository{db: db}
}

// ============= StudentInvitation Operations =============

func (r *studentInvitationRepository) Create(entity *models.StudentInvitation) error {
	return r.db.Create(entity).Error
}

func (r *studentInvitationRepository) GetByID(id string) (*models.StudentInvitation, error) {
	var invitation models.StudentInvitation
	if err := r.db.First(&invitation, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &invitation, nil
}

func (r *studentInvitationRepository) GetByInviteCode(code string) (*models.StudentInvitation, error) {
	var invitation models.StudentInvitation
	if err := r.db.First(&invitation, "invite_code = ?", code).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &invitation, nil
}

func (r *studentInvitationRepository) GetByMentorIDAndProductID(mentorID, productID string, page, pageSize int) ([]models.StudentInvitation, int64, error) {
	var invitations []models.StudentInvitation
	var total int64
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	q := r.db.Model(&models.StudentInvitation{}).
		Where("mentor_id = ? AND product_id = ?", mentorID, productID)
	q.Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&invitations).Error; err != nil {
		return nil, 0, err
	}
	return invitations, total, nil
}

func (r *studentInvitationRepository) GetByMentorID(mentorID string, page, pageSize int) ([]models.StudentInvitation, int64, error) {
	var invitations []models.StudentInvitation
	var total int64
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	q := r.db.Model(&models.StudentInvitation{}).Where("mentor_id = ?", mentorID)
	q.Count(&total)
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&invitations).Error; err != nil {
		return nil, 0, err
	}
	return invitations, total, nil
}

func (r *studentInvitationRepository) Update(entity *models.StudentInvitation) error {
	updates := map[string]interface{}{}
	addIfColumnExists := func(column string, value interface{}) {
		if r.db.Migrator().HasColumn(&models.StudentInvitation{}, column) {
			updates[column] = value
		}
	}

	addIfColumnExists("mentor_id", entity.MentorID)
	addIfColumnExists("product_id", entity.ProductID)
	addIfColumnExists("invite_code", entity.InviteCode)
	addIfColumnExists("student_email", entity.StudentEmail)
	addIfColumnExists("status", entity.Status)
	addIfColumnExists("invited_email", entity.InvitedEmail)
	addIfColumnExists("invited_name", entity.InvitedName)
	addIfColumnExists("expires_at", entity.ExpiresAt)
	addIfColumnExists("signed_up_at", entity.SignedUpAt)
	addIfColumnExists("activated_at", entity.ActivatedAt)
	addIfColumnExists("payment_id", entity.PaymentID)
	addIfColumnExists("updated_at", entity.UpdatedAt)

	return r.db.Model(&models.StudentInvitation{}).Where("id = ?", entity.ID).Updates(updates).Error
}

func (r *studentInvitationRepository) Delete(id string) error {
	return r.db.Delete(&models.StudentInvitation{}, "id = ?", id).Error
}

// ============= StudentAuth Operations =============

func (r *studentInvitationRepository) CreateStudentAuth(entity *models.StudentAuth) error {
	if !r.db.Migrator().HasTable(&models.StudentAuth{}) {
		// Backward compatibility: some environments may not have student_auth yet.
		return nil
	}
	err := r.db.Create(entity).Error
	if isMissingStudentAuthTableErr(err) {
		// Backward compatibility: some environments may not have student_auth yet.
		return nil
	}
	return err
}

func (r *studentInvitationRepository) GetStudentAuthByEmail(email string) (*models.StudentAuth, error) {
	if !r.db.Migrator().HasTable(&models.StudentAuth{}) {
		return nil, nil
	}
	var auth models.StudentAuth
	if err := r.db.First(&auth, "student_email = ?", email).Error; err != nil {
		if isMissingStudentAuthTableErr(err) {
			return nil, nil
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &auth, nil
}

func (r *studentInvitationRepository) GetStudentAuthBySupabaseID(supabaseID string) (*models.StudentAuth, error) {
	if !r.db.Migrator().HasTable(&models.StudentAuth{}) {
		return nil, nil
	}
	var auth models.StudentAuth
	if err := r.db.First(&auth, "supabase_user_id = ?", supabaseID).Error; err != nil {
		if isMissingStudentAuthTableErr(err) {
			return nil, nil
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &auth, nil
}

func (r *studentInvitationRepository) GetStudentAuthByInvitationID(invitationID string) (*models.StudentAuth, error) {
	if !r.db.Migrator().HasTable(&models.StudentAuth{}) {
		return nil, nil
	}
	var auth models.StudentAuth
	if err := r.db.First(&auth, "invitation_id = ?", invitationID).Error; err != nil {
		if isMissingStudentAuthTableErr(err) {
			return nil, nil
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &auth, nil
}

func (r *studentInvitationRepository) UpdateStudentAuth(entity *models.StudentAuth) error {
	if !r.db.Migrator().HasTable(&models.StudentAuth{}) {
		// Backward compatibility: some environments may not have student_auth yet.
		return nil
	}
	err := r.db.Save(entity).Error
	if isMissingStudentAuthTableErr(err) {
		// Backward compatibility: some environments may not have student_auth yet.
		return nil
	}
	return err
}

func isMissingStudentAuthTableErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "student_auth") &&
		(strings.Contains(msg, "does not exist") || strings.Contains(msg, "sqlstate 42p01"))
}
