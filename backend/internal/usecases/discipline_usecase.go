package usecases

import (
	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
)

type DisciplineUseCase interface {
	Create(req *dto.CreateDisciplineRequest) (*dto.DisciplineResponse, error)
	GetByProductID(productID string) ([]dto.DisciplineResponse, error)
	Update(id string, req *dto.UpdateDisciplineRequest) (*dto.DisciplineResponse, error)
	Delete(id string) error
	Reorder(id string, req *dto.ReorderDisciplinesRequest) ([]dto.DisciplineResponse, error)
}

type disciplineUseCase struct{ repo repositories.DisciplineRepository }

func NewDisciplineUseCase(repo repositories.DisciplineRepository) DisciplineUseCase {
	return &disciplineUseCase{repo: repo}
}

func (uc *disciplineUseCase) Create(req *dto.CreateDisciplineRequest) (*dto.DisciplineResponse, error) {
	e := &models.Discipline{ProductID: req.ProductID, Name: req.Name, Order: req.Order}
	if err := uc.repo.Create(e); err != nil { return nil, err }
	return disciplineToDTO(e), nil
}

func (uc *disciplineUseCase) GetByProductID(productID string) ([]dto.DisciplineResponse, error) {
	entities, err := uc.repo.GetByProductID(productID)
	if err != nil { return nil, err }
	var r []dto.DisciplineResponse
	for _, e := range entities { r = append(r, *disciplineToDTO(&e)) }
	return r, nil
}

func (uc *disciplineUseCase) Update(id string, req *dto.UpdateDisciplineRequest) (*dto.DisciplineResponse, error) {
	e, err := uc.repo.GetByID(id)
	if err != nil { return nil, err }
	if req.Name != "" { e.Name = req.Name }
	if req.Order != nil { e.Order = *req.Order }
	if err := uc.repo.Update(e); err != nil { return nil, err }
	return disciplineToDTO(e), nil
}

func (uc *disciplineUseCase) Delete(id string) error { return uc.repo.Delete(id) }

func (uc *disciplineUseCase) Reorder(_ string, req *dto.ReorderDisciplinesRequest) ([]dto.DisciplineResponse, error) {
	if err := uc.repo.Reorder(req.IDs); err != nil { return nil, err }
	if len(req.IDs) > 0 {
		first, _ := uc.repo.GetByID(req.IDs[0])
		if first != nil {
			return uc.GetByProductID(first.ProductID)
		}
	}
	return nil, nil
}

func disciplineToDTO(e *models.Discipline) *dto.DisciplineResponse {
	return &dto.DisciplineResponse{ID: e.ID, ProductID: e.ProductID, Name: e.Name, Order: e.Order, CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z")}
}
