package handlers

import (
	"fmt"
	"net/http"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type StudentCardsHandler struct {
	cardRepo       repositories.CardRepository
	discRepo       repositories.DisciplineRepository
	productRepo    repositories.ProductRepository
	studentAccRepo repositories.StudentAccessRepository
	db             *gorm.DB
}

func NewStudentCardsHandler(
	cardRepo repositories.CardRepository,
	discRepo repositories.DisciplineRepository,
	productRepo repositories.ProductRepository,
	studentAccRepo repositories.StudentAccessRepository,
	db *gorm.DB,
) *StudentCardsHandler {
	return &StudentCardsHandler{
		cardRepo:       cardRepo,
		discRepo:       discRepo,
		productRepo:    productRepo,
		studentAccRepo: studentAccRepo,
		db:             db,
	}
}

// GetStudentCards retorna todos os cards + disciplinas do produto do aluno
// Requer JWT autenticação e o aluno deve ter acesso ao produto
func (h *StudentCardsHandler) GetStudentCards(c *gin.Context) {
	// Pega o email do JWT (adicionado pelo middleware de auth)
	studentEmail, exists := c.Get("user_email")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "unauthorized"})
		return
	}

	email := studentEmail.(string)
	productID := c.Query("product_id")

	// Se product_id não foi passado, busca o primeiro acesso ativo do aluno
	if productID == "" {
		// Buscar o primeiro product_id do aluno que ele tem acesso
		var access models.StudentAccess
		if err := h.db.Where("email = ? AND active = ?", email, true).First(&access).Error; err != nil {
			c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "product_id required or student has no active access"})
			return
		}
		productID = access.ProductID
	}

	// Verificar se o aluno tem acesso a esse produto
	access, err := h.studentAccRepo.GetByEmailAndProduct(email, productID)
	if err != nil || access == nil || !access.Active {
		c.JSON(http.StatusForbidden, dto.APIResponse{Success: false, Error: "student does not have access to this product"})
		return
	}

	// Buscar disciplinas do produto
	disciplines, err := h.getDisciplinesWithCards(productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: "failed to load disciplines"})
		return
	}

	// Contar total de cards
	totalCards := 0
	for _, disc := range disciplines {
		totalCards += len(disc.Cards)
	}

	response := dto.StudentProductCardsResponse{
		ProductID:   productID,
		Disciplines: disciplines,
		TotalCards:  totalCards,
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: response})
}

// GetStudyCards retorna cards para estudo, com filtro opcional de disciplina
// Suporta diferentes modos de estudo (new, review, all) e limite de cards novos
func (h *StudentCardsHandler) GetStudyCards(c *gin.Context) {
	studentEmail, exists := c.Get("user_email")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "unauthorized"})
		return
	}

	email := studentEmail.(string)
	productID := c.Query("product_id")
	disciplineID := c.Query("discipline_id")
	studyMode := c.DefaultQuery("mode", "new") // new, review, all
	newLimit := 0
	if limit := c.Query("new_limit"); limit != "" {
		fmt.Sscanf(limit, "%d", &newLimit)
	}

	// Se product_id não foi passado, busca o primeiro acesso ativo do aluno
	if productID == "" {
		var access models.StudentAccess
		if err := h.db.Where("email = ? AND active = ?", email, true).First(&access).Error; err != nil {
			c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: "product_id required or student has no active access"})
			return
		}
		productID = access.ProductID
	}

	// Verificar acesso
	access, err := h.studentAccRepo.GetByEmailAndProduct(email, productID)
	if err != nil || access == nil || !access.Active {
		c.JSON(http.StatusForbidden, dto.APIResponse{Success: false, Error: "student does not have access to this product"})
		return
	}

	// Buscar cards para estudo
	studyCards, err := h.getStudyCardsForStudent(email, productID, disciplineID, studyMode, newLimit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: "failed to load study cards"})
		return
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: studyCards})
}

// getDisciplinesWithCards busca todas as disciplinas com seus cards para um produto
func (h *StudentCardsHandler) getDisciplinesWithCards(productID string) ([]dto.StudentDisciplineResponse, error) {
	var disciplines []models.Discipline
	if err := h.db.Where("product_id = ?", productID).Order("\"order\" ASC").Find(&disciplines).Error; err != nil {
		return nil, err
	}

	var response []dto.StudentDisciplineResponse

	for _, disc := range disciplines {
		// Buscar todos os cards dessa disciplina
		var cards []models.Card
		if err := h.db.Where("discipline_id = ?", disc.ID).Order("\"order\" ASC").Find(&cards).Error; err != nil {
			continue
		}

		var cardDTOs []dto.StudentCardResponse
		for _, card := range cards {
			cardDTOs = append(cardDTOs, dto.StudentCardResponse{
				ID:       card.ID,
				Front:    card.Front,
				Back:     card.Back,
				Order:    card.Order,
				Category: disc.Name,
			})
		}

		response = append(response, dto.StudentDisciplineResponse{
			ID:    disc.ID,
			Name:  disc.Name,
			Order: disc.Order,
			Cards: cardDTOs,
		})
	}

	return response, nil
}

// getStudyCardsForStudent retorna cards para estudo com filtros aplicados
// Modo: "new" (só novos), "review" (só para revisar), "all" (todos)
func (h *StudentCardsHandler) getStudyCardsForStudent(email, productID, disciplineID, studyMode string, newLimit int) ([]dto.StudentCardResponse, error) {
	var studyCards []dto.StudentCardResponse

	// Query base: todos os cards do produto
	query := h.db.Where("product_id = ?", productID)

	// Se uma disciplina foi especificada, filtrar por ela
	if disciplineID != "" && disciplineID != "all" {
		query = query.Where("discipline_id = ?", disciplineID)
	}

	var cards []models.Card
	if err := query.Order("\"order\" ASC").Find(&cards).Error; err != nil {
		return nil, err
	}

	// Se for modo "new", limitar a quantidade
	if studyMode == "new" && newLimit > 0 && len(cards) > newLimit {
		cards = cards[:newLimit]
	}

	// Buscar as disciplinas para ter os nomes
	var disciplines []models.Discipline
	h.db.Where("product_id = ?", productID).Find(&disciplines)
	discMap := make(map[string]string)
	for _, d := range disciplines {
		discMap[d.ID] = d.Name
	}

	// Converter para DTO
	for _, card := range cards {
		studyCards = append(studyCards, dto.StudentCardResponse{
			ID:       card.ID,
			Front:    card.Front,
			Back:     card.Back,
			Order:    card.Order,
			Category: discMap[card.DisciplineID],
		})
	}

	return studyCards, nil
}
