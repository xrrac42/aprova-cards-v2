package dto

type CreateCardRequest struct {
	DisciplineID string `json:"discipline_id" binding:"required"`
	Front        string `json:"front" binding:"required,min=1"`
	Back         string `json:"back" binding:"required,min=1"`
	Order        int    `json:"order"`
}

type UpdateCardRequest struct {
	Front string `json:"front"`
	Back  string `json:"back"`
	Order *int   `json:"order"`
}

type CardResponse struct {
	ID           string `json:"id"`
	DisciplineID string `json:"discipline_id"`
	ProductID    string `json:"product_id"`
	Front        string `json:"front"`
	Back         string `json:"back"`
	Order        int    `json:"order"`
	CreatedAt    string `json:"created_at"`
}

type GenerateCardsRequest struct {
	Context string `json:"context" binding:"required,min=10"`
	Limit   int    `json:"limit"`
}

type GenerateCardsResponse struct {
	Cards     []CardResponse `json:"cards"`
	Generated int            `json:"generated"`
}

// Student view DTOs
type StudentCardResponse struct {
	ID       string `json:"id"`
	Front    string `json:"front"`
	Back     string `json:"back"`
	Order    int    `json:"order"`
	Category string `json:"category"` // discipline name
}

type StudentDisciplineResponse struct {
	ID    string                `json:"id"`
	Name  string                `json:"name"`
	Order int                   `json:"order"`
	Cards []StudentCardResponse `json:"cards"`
}

type StudentProductCardsResponse struct {
	ProductID   string                      `json:"product_id"`
	Disciplines []StudentDisciplineResponse `json:"disciplines"`
	TotalCards  int                         `json:"total_cards"`
}
