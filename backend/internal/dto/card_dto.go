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
	Context     string `json:"context" binding:"required,min=10"`
	Limit       int    `json:"limit"`
	Archetype   string `json:"archetype"`    // qa | cloze | case
	Preset      string `json:"preset"`       // default | cespe | oab | magistratura
	RegraDeOuro string `json:"regra_de_ouro"`
}

type GenerateCardsResponse struct {
	Cards     []CardResponse `json:"cards"`
	Generated int            `json:"generated"`
}

// PreviewCard is a card returned for human review — not yet persisted.
type PreviewCard struct {
	ID         string   `json:"id"`
	Front      string   `json:"front"`
	Back       string   `json:"back"`
	TopicTags  []string `json:"topic_tags"`
	Difficulty string   `json:"difficulty"`
}

// PreviewCardsResponse is the response from the generate-ai-preview endpoint.
type PreviewCardsResponse struct {
	Cards     []PreviewCard `json:"cards"`
	Generated int           `json:"generated"`
}

// BatchSaveCard is one card submitted for persistence after human review.
type BatchSaveCard struct {
	Front      string   `json:"front" binding:"required"`
	Back       string   `json:"back" binding:"required"`
	TopicTags  []string `json:"topic_tags"`
	Difficulty string   `json:"difficulty"`
}

// BatchSaveRequest is the payload for the batch-save endpoint.
type BatchSaveRequest struct {
	Cards []BatchSaveCard `json:"cards" binding:"required"`
}

// BatchSaveResponse is the response from the batch-save endpoint.
type BatchSaveResponse struct {
	Cards []CardResponse `json:"cards"`
	Saved int            `json:"saved"`
}

// Student view DTOs
type StudentCardResponse struct {
	ID                   string `json:"id"`
	DisciplineID         string `json:"discipline_id"`
	DisciplineName       string `json:"discipline_name"`
	Front                string `json:"front"`
	Back                 string `json:"back"`
	Order                int    `json:"order"`
	ExistingCorrectCount int    `json:"existing_correct_count"`
	ExistingIncorrectCount int  `json:"existing_incorrect_count"`
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
