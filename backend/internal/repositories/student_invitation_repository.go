package repositories

import (
	"errors"

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
	return r.db.Save(entity).Error
}

func (r *studentInvitationRepository) Delete(id string) error {
	return r.db.Delete(&models.StudentInvitation{}, "id = ?", id).Error
}

// ============= StudentAuth Operations =============

func (r *studentInvitationRepository) CreateStudentAuth(entity *models.StudentAuth) error {
	return r.db.Create(entity).Error
}

func (r *studentInvitationRepository) GetStudentAuthByEmail(email string) (*models.StudentAuth, error) {
	var auth models.StudentAuth
	if err := r.db.First(&auth, "student_email = ?", email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &auth, nil
}

func (r *studentInvitationRepository) GetStudentAuthBySupabaseID(supabaseID string) (*models.StudentAuth, error) {
	var auth models.StudentAuth
	if err := r.db.First(&auth, "supabase_user_id = ?", supabaseID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &auth, nil
}

func (r *studentInvitationRepository) GetStudentAuthByInvitationID(invitationID string) (*models.StudentAuth, error) {
	var auth models.StudentAuth
	if err := r.db.First(&auth, "invitation_id = ?", invitationID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &auth, nil
}

func (r *studentInvitationRepository) UpdateStudentAuth(entity *models.StudentAuth) error {
	return r.db.Save(entity).Error
}
