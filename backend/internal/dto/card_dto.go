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
