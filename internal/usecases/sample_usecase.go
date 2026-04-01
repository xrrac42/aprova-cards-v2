package usecases

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
)

// SampleUseCase define os casos de uso
type SampleUseCase interface {
	Create(req *dto.CreateSampleRequest) (*dto.SampleResponse, error)
	GetByID(id string) (*dto.SampleResponse, error)
	GetAll(page, pageSize int) (*dto.PaginatedResponse, error)
	Update(id string, req *dto.UpdateSampleRequest) (*dto.SampleResponse, error)
	Delete(id string) error
}

// sampleUseCase implementa a lógica de negócio
type sampleUseCase struct {
	repository repositories.SampleRepository
}

// NewSampleUseCase cria uma nova instância
func NewSampleUseCase(repository repositories.SampleRepository) SampleUseCase {
	return &sampleUseCase{
		repository: repository,
	}
}

// Create cria um novo sample
func (uc *sampleUseCase) Create(req *dto.CreateSampleRequest) (*dto.SampleResponse, error) {
	if req == nil {
		return nil, errors.New("request cannot be nil")
	}

	// Validar se email já existe
	existing, _ := uc.repository.GetByEmail(req.Email)
	if existing != nil {
		return nil, errors.New("email already exists")
	}

	entity := &models.SampleEntity{
		Name:   req.Name,
		Email:  req.Email,
		Status: "active",
	}

	if err := uc.repository.Create(entity); err != nil {
		return nil, err
	}

	return uc.entityToDTO(entity), nil
}

// GetByID busca por ID
func (uc *sampleUseCase) GetByID(id string) (*dto.SampleResponse, error) {
	entity, err := uc.repository.GetByID(id)
	if err != nil {
		return nil, err
	}

	return uc.entityToDTO(entity), nil
}

// GetAll lista todos
func (uc *sampleUseCase) GetAll(page, pageSize int) (*dto.PaginatedResponse, error) {
	entities, total, err := uc.repository.GetAll(page, pageSize)
	if err != nil {
		return nil, err
	}

	var responses []dto.SampleResponse
	for _, entity := range entities {
		responses = append(responses, *uc.entityToDTO(&entity))
	}

	if pageSize < 1 {
		pageSize = 10
	}
	totalPages := int(total) / pageSize
	if int(total)%pageSize > 0 {
		totalPages++
	}

	return &dto.PaginatedResponse{
		Data:       responses,
		Total:      total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// Update atualiza um sample
func (uc *sampleUseCase) Update(id string, req *dto.UpdateSampleRequest) (*dto.SampleResponse, error) {
	entity, err := uc.repository.GetByID(id)
	if err != nil {
		return nil, err
	}

	if req.Name != "" {
		entity.Name = req.Name
	}
	if req.Email != "" {
		entity.Email = req.Email
	}
	if req.Status != "" {
		entity.Status = req.Status
	}

	if err := uc.repository.Update(entity); err != nil {
		return nil, err
	}

	return uc.entityToDTO(entity), nil
}

// Delete deleta um sample
func (uc *sampleUseCase) Delete(id string) error {
	return uc.repository.Delete(id)
}

// entityToDTO converte entity para DTO
func (uc *sampleUseCase) entityToDTO(entity *models.SampleEntity) *dto.SampleResponse {
	return &dto.SampleResponse{
		ID:        entity.ID,
		Name:      entity.Name,
		Email:     entity.Email,
		Status:    entity.Status,
		CreatedAt: entity.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt: entity.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}
