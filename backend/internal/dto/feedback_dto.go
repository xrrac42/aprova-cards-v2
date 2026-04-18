package dto

type CreateFeedbackRequest struct {
	ProductID       string `json:"product_id" binding:"required"`
	Mensagem        string `json:"mensagem" binding:"required,min=5"`
	TotalCardsEpoca int    `json:"total_cards_epoca"`
}

type FeedbackResponse struct {
	ID              string `json:"id"`
	StudentEmail    string `json:"student_email"`
	ProductID       string `json:"product_id"`
	Mensagem        string `json:"mensagem"`
	TotalCardsEpoca int    `json:"total_cards_epoca"`
	CriadoEm        string `json:"criado_em"`
}
