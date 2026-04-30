package usecases

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/openai"
)

type CardUseCase interface {
	Create(req *dto.CreateCardRequest, productID string) (*dto.CardResponse, error)
	GetByDisciplineID(disciplineID string, page, pageSize int) (*dto.PaginatedResponse, error)
	GetByProductID(productID string, disciplineID string, search string, page, pageSize int) (*dto.PaginatedResponse, error)
	Update(id string, req *dto.UpdateCardRequest) (*dto.CardResponse, error)
	Delete(id string) error
	GenerateWithAI(disciplineID string, req *dto.GenerateCardsRequest) (*dto.GenerateCardsResponse, error)
}

type cardUseCase struct {
	repo         repositories.CardRepository
	discRepo     repositories.DisciplineRepository
	openaiClient *openai.Client
}

func NewCardUseCase(repo repositories.CardRepository, discRepo repositories.DisciplineRepository, openaiClient ...*openai.Client) CardUseCase {
	uc := &cardUseCase{repo: repo, discRepo: discRepo}
	if len(openaiClient) > 0 {
		uc.openaiClient = openaiClient[0]
	}
	return uc
}

func (uc *cardUseCase) Create(req *dto.CreateCardRequest, productID string) (*dto.CardResponse, error) {
	if len(req.Front) == 0 {
		return nil, errors.New("front cannot be empty")
	}
	disc, err := uc.discRepo.GetByID(req.DisciplineID)
	if err != nil {
		return nil, errors.New("discipline not found")
	}

	pid := productID
	if pid == "" {
		pid = disc.ProductID
	}

	e := &models.Card{DisciplineID: req.DisciplineID, ProductID: pid, Front: req.Front, Back: req.Back, Order: req.Order}
	if err := uc.repo.Create(e); err != nil {
		return nil, err
	}
	return cardToDTO(e), nil
}

func (uc *cardUseCase) GetByDisciplineID(disciplineID string, page, pageSize int) (*dto.PaginatedResponse, error) {
	entities, total, err := uc.repo.GetByDisciplineID(disciplineID, page, pageSize)
	if err != nil {
		return nil, err
	}
	if pageSize < 1 {
		pageSize = 20
	}
	var r []dto.CardResponse
	for _, e := range entities {
		r = append(r, *cardToDTO(&e))
	}
	tp := int(total) / pageSize
	if int(total)%pageSize > 0 {
		tp++
	}
	return &dto.PaginatedResponse{Data: r, Total: total, Page: page, PageSize: pageSize, TotalPages: tp}, nil
}

func (uc *cardUseCase) GetByProductID(productID string, disciplineID string, search string, page, pageSize int) (*dto.PaginatedResponse, error) {
	entities, total, err := uc.repo.GetByProductID(productID, disciplineID, search, page, pageSize)
	if err != nil {
		return nil, err
	}
	if pageSize < 1 {
		pageSize = 20
	}
	var r []dto.CardResponse
	for _, e := range entities {
		r = append(r, *cardToDTO(&e))
	}
	tp := int(total) / pageSize
	if int(total)%pageSize > 0 {
		tp++
	}
	return &dto.PaginatedResponse{Data: r, Total: total, Page: page, PageSize: pageSize, TotalPages: tp}, nil
}

func (uc *cardUseCase) Update(id string, req *dto.UpdateCardRequest) (*dto.CardResponse, error) {
	e, err := uc.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	if req.Front != "" {
		e.Front = req.Front
	}
	if req.Back != "" {
		e.Back = req.Back
	}
	if req.Order != nil {
		e.Order = *req.Order
	}
	if err := uc.repo.Update(e); err != nil {
		return nil, err
	}
	return cardToDTO(e), nil
}

func (uc *cardUseCase) Delete(id string) error { return uc.repo.Delete(id) }

func (uc *cardUseCase) GenerateWithAI(disciplineID string, req *dto.GenerateCardsRequest) (*dto.GenerateCardsResponse, error) {
	if uc.openaiClient == nil {
		return nil, errors.New("geração com IA não configurada (defina OPENAI_API_KEY)")
	}

	disc, err := uc.discRepo.GetByID(disciplineID)
	if err != nil {
		return nil, errors.New("disciplina não encontrada")
	}

	limit := req.Limit
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	system := `Você é um especialista em criação de flashcards para estudantes brasileiros que se preparam para concursos e vestibulares.
Crie flashcards concisos e precisos em português (pt-BR), baseados EXCLUSIVAMENTE no conteúdo do documento fornecido.
Retorne SOMENTE um array JSON válido, sem texto adicional, markdown ou blocos de código.
Cada item deve ter "front" (pergunta ou termo) e "back" (resposta ou definição).
O campo "front" deve ser uma pergunta objetiva ou um conceito-chave extraído do documento.
O campo "back" deve ser a resposta direta e completa, fiel ao conteúdo.`

	user := fmt.Sprintf(`Com base no documento abaixo, crie NO MÁXIMO %d flashcards. Não ultrapasse esse limite.

DOCUMENTO:
%s

Formato obrigatório: [{"front":"...","back":"..."},{"front":"...","back":"..."}]`, limit, req.Context)

	content, err := uc.openaiClient.Chat(system, user)
	if err != nil {
		return nil, fmt.Errorf("erro ao chamar OpenAI: %w", err)
	}

	// Extrai o array JSON mesmo se houver texto extra
	cleaned := strings.TrimSpace(content)
	if start := strings.Index(cleaned, "["); start > 0 {
		cleaned = cleaned[start:]
	}
	if end := strings.LastIndex(cleaned, "]"); end >= 0 && end < len(cleaned)-1 {
		cleaned = cleaned[:end+1]
	}

	type rawCard struct {
		Front string `json:"front"`
		Back  string `json:"back"`
	}
	var rawCards []rawCard
	if err := json.Unmarshal([]byte(cleaned), &rawCards); err != nil {
		return nil, fmt.Errorf("resposta da IA não é JSON válido: %w", err)
	}

	var created []dto.CardResponse
	for i, rc := range rawCards {
		if strings.TrimSpace(rc.Front) == "" || strings.TrimSpace(rc.Back) == "" {
			continue
		}
		card := &models.Card{
			DisciplineID: disciplineID,
			ProductID:    disc.ProductID,
			Front:        rc.Front,
			Back:         rc.Back,
			Order:        i,
		}
		if err := uc.repo.Create(card); err != nil {
			continue
		}
		created = append(created, *cardToDTO(card))
	}

	return &dto.GenerateCardsResponse{Cards: created, Generated: len(created)}, nil
}

func cardToDTO(e *models.Card) *dto.CardResponse {
	return &dto.CardResponse{ID: e.ID, DisciplineID: e.DisciplineID, ProductID: e.ProductID, Front: e.Front, Back: e.Back, Order: e.Order, CreatedAt: e.CreatedAt.Format("2006-01-02T15:04:05Z")}
}
