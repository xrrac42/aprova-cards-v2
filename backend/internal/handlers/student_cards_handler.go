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

// GetStudentHome retorna em uma única chamada o produto, mentor e disciplinas
// (com contagem de cards) do aluno autenticado. Não carrega o conteúdo dos
// cards — use GetStudyCards para a sessão de estudo.
func (h *StudentCardsHandler) GetStudentHome(c *gin.Context) {
	studentEmail := c.MustGet("user_email").(string)

	var access models.StudentAccess
	if err := h.db.Where("email = ? AND active = ?", studentEmail, true).First(&access).Error; err != nil {
		c.JSON(http.StatusForbidden, dto.APIResponse{Success: false, Error: "no active access found"})
		return
	}
	productID := access.ProductID

	var product models.Product
	if err := h.db.Preload("Mentor").First(&product, "id = ?", productID).Error; err != nil {
		c.JSON(http.StatusNotFound, dto.APIResponse{Success: false, Error: "product not found"})
		return
	}

	var disciplines []models.Discipline
	h.db.Where("product_id = ?", productID).Order(`"order" ASC`).Find(&disciplines)

	type countRow struct {
		DisciplineID string
		Count        int
	}
	var counts []countRow
	h.db.Model(&models.Card{}).
		Select("discipline_id, count(*) as count").
		Where("product_id = ?", productID).
		Group("discipline_id").
		Scan(&counts)
	countMap := make(map[string]int, len(counts))
	for _, r := range counts {
		countMap[r.DisciplineID] = r.Count
	}

	totalCards := 0
	discStats := make([]dto.StudentDisciplineStat, 0, len(disciplines))
	for _, d := range disciplines {
		cnt := countMap[d.ID]
		totalCards += cnt
		discStats = append(discStats, dto.StudentDisciplineStat{
			ID:         d.ID,
			Name:       d.Name,
			Order:      d.Order,
			TotalCards: cnt,
		})
	}

	mentor := dto.StudentMentorInfo{}
	if product.Mentor != nil {
		mentor = dto.StudentMentorInfo{
			ID:             product.Mentor.ID,
			Name:           product.Mentor.Name,
			LogoURL:        product.Mentor.LogoURL,
			PrimaryColor:   product.Mentor.PrimaryColor,
			SecondaryColor: product.Mentor.SecondaryColor,
		}
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data: dto.StudentHomeResponse{
			Product: dto.StudentProductInfo{
				ID:            product.ID,
				Name:          product.Name,
				CoverImageURL: product.CoverImageURL,
			},
			Mentor:      mentor,
			Disciplines: discStats,
			TotalCards:  totalCards,
		},
	})
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

	fmt.Printf("[DEBUG] GetStudentCards - email: %s, productID: %s\n", email, productID)

	// Verificar se o aluno tem acesso a esse produto
	access, err := h.studentAccRepo.GetByEmailAndProduct(email, productID)
	if err != nil || access == nil || !access.Active {
		fmt.Printf("[DEBUG] Access check failed - err: %v, access: %v\n", err, access)
		c.JSON(http.StatusForbidden, dto.APIResponse{Success: false, Error: "student does not have access to this product"})
		return
	}

	// Buscar disciplinas do produto
	disciplines, err := h.getDisciplinesWithCards(productID)
	if err != nil {
		fmt.Printf("[DEBUG] getDisciplinesWithCards failed - err: %v\n", err)
		c.JSON(http.StatusInternalServerError, dto.APIResponse{Success: false, Error: "failed to load disciplines"})
		return
	}

	fmt.Printf("[DEBUG] Found %d disciplines\n", len(disciplines))

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

// DebugStudentAccess retorna informações de debug sobre o acesso do aluno
func (h *StudentCardsHandler) DebugStudentAccess(c *gin.Context) {
	studentEmail, exists := c.Get("user_email")
	if !exists {
		c.JSON(http.StatusUnauthorized, dto.APIResponse{Success: false, Error: "unauthorized"})
		return
	}

	email := studentEmail.(string)

	// Buscar todos os acessos do aluno
	var accesses []models.StudentAccess
	h.db.Where("email = ?", email).Find(&accesses)

	debugInfo := map[string]interface{}{
		"email":    email,
		"accesses": accesses,
	}

	if len(accesses) > 0 {
		productID := accesses[0].ProductID
		var disciplines []models.Discipline
		h.db.Where("product_id = ?", productID).Find(&disciplines)
		debugInfo["first_product_id"] = productID
		debugInfo["disciplines_count"] = len(disciplines)

		var cards []models.Card
		h.db.Where("product_id = ?", productID).Find(&cards)
		debugInfo["cards_count"] = len(cards)
	}

	c.JSON(http.StatusOK, dto.APIResponse{Success: true, Data: debugInfo})
}

// getDisciplinesWithCards busca todas as disciplinas com seus cards para um produto
func (h *StudentCardsHandler) getDisciplinesWithCards(productID string) ([]dto.StudentDisciplineResponse, error) {
	var disciplines []models.Discipline
	if err := h.db.Where("product_id = ?", productID).Order("\"order\" ASC").Find(&disciplines).Error; err != nil {
		return nil, err
	}

	var response []dto.StudentDisciplineResponse

	for _, disc := range disciplines {
		var cards []models.Card
		if err := h.db.Where("discipline_id = ?", disc.ID).Order("\"order\" ASC").Find(&cards).Error; err != nil {
			continue
		}

		var cardDTOs []dto.StudentCardResponse
		for _, card := range cards {
			cardDTOs = append(cardDTOs, dto.StudentCardResponse{
				ID:             card.ID,
				DisciplineID:   disc.ID,
				DisciplineName: disc.Name,
				Front:          card.Front,
				Back:           card.Back,
				Order:          card.Order,
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

// getStudyCardsForStudent retorna cards para estudo com filtros e dados de progresso do aluno.
// Modo: "new" (só novos), "review" (só para revisar), "all" (todos)
func (h *StudentCardsHandler) getStudyCardsForStudent(email, productID, disciplineID, studyMode string, newLimit int) ([]dto.StudentCardResponse, error) {
	// Query base
	query := h.db.Where("product_id = ?", productID)
	if disciplineID != "" && disciplineID != "all" {
		query = query.Where("discipline_id = ?", disciplineID)
	}

	var cards []models.Card
	if err := query.Order("\"order\" ASC").Find(&cards).Error; err != nil {
		return nil, err
	}

	if studyMode == "new" && newLimit > 0 && len(cards) > newLimit {
		cards = cards[:newLimit]
	}

	// Nomes das disciplinas
	var disciplines []models.Discipline
	h.db.Where("product_id = ?", productID).Find(&disciplines)
	discNameMap := make(map[string]string, len(disciplines))
	for _, d := range disciplines {
		discNameMap[d.ID] = d.Name
	}

	// Progresso já registrado do aluno para estes cards
	cardIDs := make([]string, 0, len(cards))
	for _, c := range cards {
		cardIDs = append(cardIDs, c.ID)
	}
	progressMap := make(map[string]models.StudentProgress, len(cards))
	if len(cardIDs) > 0 {
		var progresses []models.StudentProgress
		h.db.Where("student_email = ? AND card_id IN ?", email, cardIDs).Find(&progresses)
		for _, p := range progresses {
			progressMap[p.CardID] = p
		}
	}

	studyCards := make([]dto.StudentCardResponse, 0, len(cards))
	for _, card := range cards {
		prog := progressMap[card.ID]
		studyCards = append(studyCards, dto.StudentCardResponse{
			ID:                     card.ID,
			DisciplineID:           card.DisciplineID,
			DisciplineName:         discNameMap[card.DisciplineID],
			Front:                  card.Front,
			Back:                   card.Back,
			Order:                  card.Order,
			ExistingCorrectCount:   prog.CorrectCount,
			ExistingIncorrectCount: prog.IncorrectCount,
		})
	}

	return studyCards, nil
}
