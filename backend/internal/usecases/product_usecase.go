package usecases

import (
	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
)

type ProductUseCase interface {
	Create(req *dto.CreateProductRequest) (*dto.ProductResponse, error)
	GetByID(id string) (*dto.ProductResponse, error)
	GetAll(page, pageSize int) (*dto.PaginatedResponse, error)
	GetByMentorID(mentorID string, page, pageSize int) (*dto.PaginatedResponse, error)
	Update(id string, req *dto.UpdateProductRequest) (*dto.ProductResponse, error)
	Delete(id string) error
}

type productUseCase struct {
	repo     repositories.ProductRepository
	discRepo repositories.DisciplineRepository
}

func NewProductUseCase(repo repositories.ProductRepository, discRepo repositories.DisciplineRepository) ProductUseCase {
	return &productUseCase{repo: repo, discRepo: discRepo}
}

func (uc *productUseCase) Create(req *dto.CreateProductRequest) (*dto.ProductResponse, error) {
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	entity := &models.Product{MentorID: req.MentorID, Name: req.Name, AccessCode: req.AccessCode, Active: active, CoverImageURL: req.CoverImageURL, PaymentLink: req.PaymentLink}
	if err := uc.repo.Create(entity); err != nil {
		return nil, err
	}

	// Create the first discipline automatically so the product is ready to receive cards.
	if uc.discRepo != nil {
		firstDiscipline := &models.Discipline{
			ProductID: entity.ID,
			Name:      "Geral",
			Order:     0,
		}
		if err := uc.discRepo.Create(firstDiscipline); err != nil {
			_ = uc.repo.Delete(entity.ID)
			return nil, err
		}
	}

	return productToDTO(entity), nil
}

func (uc *productUseCase) GetByID(id string) (*dto.ProductResponse, error) {
	e, err := uc.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return productToDTO(e), nil
}

func (uc *productUseCase) GetAll(page, pageSize int) (*dto.PaginatedResponse, error) {
	entities, total, err := uc.repo.GetAll(page, pageSize)
	if err != nil {
		return nil, err
	}
	if pageSize < 1 {
		pageSize = 10
	}
	var r []dto.ProductResponse
	for _, e := range entities {
		r = append(r, *productToDTO(&e))
	}
	tp := int(total) / pageSize
	if int(total)%pageSize > 0 {
		tp++
	}
	return &dto.PaginatedResponse{Data: r, Total: total, Page: page, PageSize: pageSize, TotalPages: tp}, nil
}

func (uc *productUseCase) GetByMentorID(mentorID string, page, pageSize int) (*dto.PaginatedResponse, error) {
	entities, total, err := uc.repo.GetByMentorID(mentorID, page, pageSize)
	if err != nil {
		return nil, err
	}
	if pageSize < 1 {
		pageSize = 10
	}
	var r []dto.ProductResponse
	for _, e := range entities {
		r = append(r, *productToDTO(&e))
	}
	tp := int(total) / pageSize
	if int(total)%pageSize > 0 {
		tp++
	}
	return &dto.PaginatedResponse{Data: r, Total: total, Page: page, PageSize: pageSize, TotalPages: tp}, nil
}

func (uc *productUseCase) Update(id string, req *dto.UpdateProductRequest) (*dto.ProductResponse, error) {
	e, err := uc.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.Name != "" {
		e.Name = req.Name
	}
	if req.AccessCode != "" {
		e.AccessCode = req.AccessCode
	}
	if req.Active != nil {
		e.Active = *req.Active
	}
	if req.CoverImageURL != nil {
		e.CoverImageURL = req.CoverImageURL
	}
	if req.PaymentLink != nil {
		e.PaymentLink = req.PaymentLink
	}
	if err := uc.repo.Update(e); err != nil {
		return nil, err
	}
	return productToDTO(e), nil
}

func (uc *productUseCase) Delete(id string) error { return uc.repo.Delete(id) }

func productToDTO(e *models.Product) *dto.ProductResponse {
	return &dto.ProductResponse{ID: e.ID, MentorID: e.MentorID, Name: e.Name, AccessCode: e.AccessCode, Active: e.Active, CoverImageURL: e.CoverImageURL, PaymentLink: e.PaymentLink, CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z")}
}
