package dto

type AddStudentRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type UpdateStudentAccessRequest struct {
	Active         bool    `json:"active"`
	InactiveReason *string `json:"inactive_reason"`
}

type StudentAccessResponse struct {
	ID             string  `json:"id"`
	Email          string  `json:"email"`
	ProductID      string  `json:"product_id"`
	Active         bool    `json:"active"`
	InactiveReason *string `json:"inactive_reason"`
	CreatedAt      string  `json:"created_at"`
}

type SyncProgressRequest struct {
	CardID     string `json:"card_id" binding:"required"`
	Difficulty string `json:"difficulty" binding:"required,oneof=errei dificil medio facil"`
	Status     string `json:"status"`
}
