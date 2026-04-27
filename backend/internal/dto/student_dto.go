package dto

// ─── Student Home ─────────────────────────────────────────────────────────────

type StudentMentorInfo struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	LogoURL        *string `json:"logo_url"`
	PrimaryColor   string  `json:"primary_color"`
	SecondaryColor string  `json:"secondary_color"`
}

type StudentProductInfo struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	CoverImageURL *string `json:"cover_image_url"`
}

type StudentDisciplineStat struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Order      int    `json:"order"`
	TotalCards int    `json:"total_cards"`
}

type StudentHomeResponse struct {
	Product     StudentProductInfo      `json:"product"`
	Mentor      StudentMentorInfo       `json:"mentor"`
	Disciplines []StudentDisciplineStat `json:"disciplines"`
	TotalCards  int                     `json:"total_cards"`
}

// ─── Student Access ───────────────────────────────────────────────────────────

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
