package usecases

import (
	"errors"
	"fmt"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/anthropic"
)

type CardUseCase interface {
	Create(req *dto.CreateCardRequest, productID string) (*dto.CardResponse, error)
	GetByDisciplineID(disciplineID string, page, pageSize int) (*dto.PaginatedResponse, error)
	GetByProductID(productID string, disciplineID string, search string, page, pageSize int) (*dto.PaginatedResponse, error)
	Update(id string, req *dto.UpdateCardRequest) (*dto.CardResponse, error)
	Delete(id string) error
	GenerateWithAI(disciplineID string, req *dto.GenerateCardsRequest) (*dto.GenerateCardsResponse, error)
	PreviewWithAI(disciplineID string, req *dto.GenerateCardsRequest) (*dto.PreviewCardsResponse, error)
	BatchSave(disciplineID string, req *dto.BatchSaveRequest) (*dto.BatchSaveResponse, error)
}

type cardUseCase struct {
	repo            repositories.CardRepository
	discRepo        repositories.DisciplineRepository
	anthropicClient *anthropic.Client
}

func NewCardUseCase(repo repositories.CardRepository, discRepo repositories.DisciplineRepository, anthropicClient ...*anthropic.Client) CardUseCase {
	uc := &cardUseCase{repo: repo, discRepo: discRepo}
	if len(anthropicClient) > 0 {
		uc.anthropicClient = anthropicClient[0]
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

// GenerateWithAI generates cards via Anthropic and immediately persists them.
// Kept for backward compatibility with the legacy /admin/disciplines/:id/generate-ai route.
func (uc *cardUseCase) GenerateWithAI(disciplineID string, req *dto.GenerateCardsRequest) (*dto.GenerateCardsResponse, error) {
	preview, err := uc.PreviewWithAI(disciplineID, req)
	if err != nil {
		return nil, err
	}

	disc, err := uc.discRepo.GetByID(disciplineID)
	if err != nil {
		return nil, errors.New("disciplina não encontrada")
	}

	var created []dto.CardResponse
	for i, pc := range preview.Cards {
		card := &models.Card{
			DisciplineID: disciplineID,
			ProductID:    disc.ProductID,
			Front:        pc.Front,
			Back:         pc.Back,
			Order:        i,
		}
		if err := uc.repo.Create(card); err != nil {
			continue
		}
		created = append(created, *cardToDTO(card))
	}

	return &dto.GenerateCardsResponse{Cards: created, Generated: len(created)}, nil
}

// PreviewWithAI generates cards via Anthropic using Structured Outputs and returns them
// without persisting — the caller reviews and approves before calling BatchSave.
func (uc *cardUseCase) PreviewWithAI(disciplineID string, req *dto.GenerateCardsRequest) (*dto.PreviewCardsResponse, error) {
	if uc.anthropicClient == nil {
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

	system := buildSystemPrompt(req)
	user := fmt.Sprintf(
		"Disciplina: %s\nGere NO MÁXIMO %d flashcards com base no documento abaixo.\n\nDOCUMENTO:\n%s",
		disc.Name, limit, req.Context,
	)

	output, err := uc.anthropicClient.GenerateCards(system, user)
	if err != nil {
		return nil, fmt.Errorf("erro ao chamar Anthropic: %w", err)
	}

	cards := make([]dto.PreviewCard, 0, len(output.Cards))
	for i, c := range output.Cards {
		if strings.TrimSpace(c.Front) == "" || strings.TrimSpace(c.Back) == "" {
			continue
		}
		tags := c.TopicTags
		if tags == nil {
			tags = []string{}
		}
		cards = append(cards, dto.PreviewCard{
			ID:         fmt.Sprintf("%d", i+1),
			Front:      c.Front,
			Back:       c.Back,
			TopicTags:  tags,
			Difficulty: c.Difficulty,
		})
	}

	return &dto.PreviewCardsResponse{Cards: cards, Generated: len(cards)}, nil
}

// BatchSave persists a list of human-approved cards to the database.
func (uc *cardUseCase) BatchSave(disciplineID string, req *dto.BatchSaveRequest) (*dto.BatchSaveResponse, error) {
	if len(req.Cards) == 0 {
		return nil, errors.New("nenhum card para salvar")
	}

	disc, err := uc.discRepo.GetByID(disciplineID)
	if err != nil {
		return nil, errors.New("disciplina não encontrada")
	}

	var saved []dto.CardResponse
	for i, bc := range req.Cards {
		if strings.TrimSpace(bc.Front) == "" || strings.TrimSpace(bc.Back) == "" {
			continue
		}
		card := &models.Card{
			DisciplineID: disciplineID,
			ProductID:    disc.ProductID,
			Front:        bc.Front,
			Back:         bc.Back,
			Order:        i,
		}
		if err := uc.repo.Create(card); err != nil {
			continue
		}
		saved = append(saved, *cardToDTO(card))
	}

	return &dto.BatchSaveResponse{Cards: saved, Saved: len(saved)}, nil
}

func buildSystemPrompt(req *dto.GenerateCardsRequest) string {
	archetypeDesc := map[string]string{
		"qa":    "Q&A Direto — Frente: pergunta objetiva. Verso: resposta direta e completa.",
		"cloze": "Preencher Lacuna — Frente: frase com [ __ ] para completar. Verso: termo correto + explicação.",
		"case":  "Caso Hipotético — Frente: situação prática hipotética. Verso: análise jurídica completa.",
	}
	presetDesc := map[string]string{
		"default":      "Linguagem didática e clara para estudantes gerais.",
		"cespe":        "Foco em alternativas CERTO/ERRADO, com afirmações precisas nos moldes CESPE/CEBRASPE.",
		"oab":          "Questões OAB com raciocínio jurídico e legislação vigente.",
		"magistratura": "Questões aprofundadas para magistratura, com doutrina e jurisprudência.",
	}

	archDesc := archetypeDesc[req.Archetype]
	if archDesc == "" {
		archDesc = archetypeDesc["qa"]
	}
	preDesc := presetDesc[req.Preset]
	if preDesc == "" {
		preDesc = presetDesc["default"]
	}

	system := fmt.Sprintf(
		"Você é um especialista em criação de flashcards para concursos públicos brasileiros.\n"+
			"Crie flashcards concisos e precisos em português (pt-BR), baseados EXCLUSIVAMENTE no conteúdo fornecido.\n\n"+
			"Arquétipo: %s\nEstilo de banca: %s",
		archDesc, preDesc,
	)

	if req.RegraDeOuro != "" {
		system += fmt.Sprintf("\nInstrução do mentor: %s", req.RegraDeOuro)
	}

	return system
}

func cardToDTO(e *models.Card) *dto.CardResponse {
	return &dto.CardResponse{
		ID:           e.ID,
		DisciplineID: e.DisciplineID,
		ProductID:    e.ProductID,
		Front:        e.Front,
		Back:         e.Back,
		Order:        e.Order,
		CreatedAt:    e.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
}
