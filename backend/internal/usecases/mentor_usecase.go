package usecases

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
)

type MentorUseCase interface {
	Create(req *dto.CreateMentorRequest) (*dto.MentorResponse, error)
	GetByID(id string) (*dto.MentorResponse, error)
	GetAll(page, pageSize int) (*dto.PaginatedResponse, error)
	Update(id string, req *dto.UpdateMentorRequest) (*dto.MentorResponse, error)
	Delete(id string) error
}

type mentorUseCase struct {
	repo repositories.MentorRepository
}

func NewMentorUseCase(repo repositories.MentorRepository) MentorUseCase {
	return &mentorUseCase{repo: repo}
}

func (uc *mentorUseCase) Create(req *dto.CreateMentorRequest) (*dto.MentorResponse, error) {
	existing, _ := uc.repo.GetByEmail(req.Email)
	if existing != nil {
		return nil, errors.New("email already exists")
	}
	existingSlug, _ := uc.repo.GetBySlug(req.Slug)
	if existingSlug != nil {
		return nil, errors.New("slug already exists")
	}

	entity := &models.Mentor{
		Name:           req.Name,
		Email:          req.Email,
		Slug:           req.Slug,
		MentorPassword: req.MentorPassword,
		PrimaryColor:   req.PrimaryColor,
		SecondaryColor: req.SecondaryColor,
		LogoURL:        req.LogoURL,
	}
	if entity.PrimaryColor == "" { entity.PrimaryColor = "#6c63ff" }
	if entity.SecondaryColor == "" { entity.SecondaryColor = "#43e97b" }

	if err := uc.repo.Create(entity); err != nil {
		return nil, err
	}
	return mentorToDTO(entity), nil
}

func (uc *mentorUseCase) GetByID(id string) (*dto.MentorResponse, error) {
	entity, err := uc.repo.GetByID(id)
	if err != nil { return nil, err }
	return mentorToDTO(entity), nil
}

func (uc *mentorUseCase) GetAll(page, pageSize int) (*dto.PaginatedResponse, error) {
	entities, total, err := uc.repo.GetAll(page, pageSize)
	if err != nil { return nil, err }
	if pageSize < 1 { pageSize = 10 }
	var responses []dto.MentorResponse
	for _, e := range entities {
		responses = append(responses, *mentorToDTO(&e))
	}
	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 { totalPages++ }
	return &dto.PaginatedResponse{Data: responses, Total: total, Page: page, PageSize: pageSize, TotalPages: totalPages}, nil
}

func (uc *mentorUseCase) Update(id string, req *dto.UpdateMentorRequest) (*dto.MentorResponse, error) {
	entity, err := uc.repo.GetByID(id)
	if err != nil { return nil, err }
	if req.Name != "" { entity.Name = req.Name }
	if req.Email != "" { entity.Email = req.Email }
	if req.Slug != "" { entity.Slug = req.Slug }
	if req.MentorPassword != "" { entity.MentorPassword = req.MentorPassword }
	if req.PrimaryColor != "" { entity.PrimaryColor = req.PrimaryColor }
	if req.SecondaryColor != "" { entity.SecondaryColor = req.SecondaryColor }
	if req.LogoURL != nil { entity.LogoURL = req.LogoURL }
	if err := uc.repo.Update(entity); err != nil { return nil, err }
	return mentorToDTO(entity), nil
}

func (uc *mentorUseCase) Delete(id string) error {
	return uc.repo.Delete(id)
}

func mentorToDTO(e *models.Mentor) *dto.MentorResponse {
	return &dto.MentorResponse{
		ID: e.ID, Name: e.Name, Email: e.Email, Slug: e.Slug,
		LogoURL: e.LogoURL, PrimaryColor: e.PrimaryColor,
		SecondaryColor: e.SecondaryColor, AccentColor: e.AccentColor,
		CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
}
