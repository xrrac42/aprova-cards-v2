package usecases

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
)

type CardUseCase interface {
	Create(req *dto.CreateCardRequest, productID string) (*dto.CardResponse, error)
	GetByDisciplineID(disciplineID string, page, pageSize int) (*dto.PaginatedResponse, error)
	Update(id string, req *dto.UpdateCardRequest) (*dto.CardResponse, error)
	Delete(id string) error
}

type cardUseCase struct {
	repo     repositories.CardRepository
	discRepo repositories.DisciplineRepository
}

func NewCardUseCase(repo repositories.CardRepository, discRepo repositories.DisciplineRepository) CardUseCase {
	return &cardUseCase{repo: repo, discRepo: discRepo}
}

func (uc *cardUseCase) Create(req *dto.CreateCardRequest, productID string) (*dto.CardResponse, error) {
	if len(req.Front) == 0 {
		return nil, errors.New("front cannot be empty")
	}
	disc, err := uc.discRepo.GetByID(req.DisciplineID)
	if err != nil { return nil, errors.New("discipline not found") }

	pid := productID
	if pid == "" { pid = disc.ProductID }

	e := &models.Card{DisciplineID: req.DisciplineID, ProductID: pid, Front: req.Front, Back: req.Back, Order: req.Order}
	if err := uc.repo.Create(e); err != nil { return nil, err }
	return cardToDTO(e), nil
}

func (uc *cardUseCase) GetByDisciplineID(disciplineID string, page, pageSize int) (*dto.PaginatedResponse, error) {
	entities, total, err := uc.repo.GetByDisciplineID(disciplineID, page, pageSize)
	if err != nil { return nil, err }
	if pageSize < 1 { pageSize = 20 }
	var r []dto.CardResponse
	for _, e := range entities { r = append(r, *cardToDTO(&e)) }
	tp := int(total) / pageSize; if int(total)%pageSize > 0 { tp++ }
	return &dto.PaginatedResponse{Data: r, Total: total, Page: page, PageSize: pageSize, TotalPages: tp}, nil
}

func (uc *cardUseCase) Update(id string, req *dto.UpdateCardRequest) (*dto.CardResponse, error) {
	e, err := uc.repo.GetByID(id)
	if err != nil { return nil, err }
	if req.Front != "" { e.Front = req.Front }
	if req.Back != "" { e.Back = req.Back }
	if req.Order != nil { e.Order = *req.Order }
	if err := uc.repo.Update(e); err != nil { return nil, err }
	return cardToDTO(e), nil
}

func (uc *cardUseCase) Delete(id string) error { return uc.repo.Delete(id) }

func cardToDTO(e *models.Card) *dto.CardResponse {
	return &dto.CardResponse{ID: e.ID, DisciplineID: e.DisciplineID, ProductID: e.ProductID, Front: e.Front, Back: e.Back, Order: e.Order, CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z")}
}
