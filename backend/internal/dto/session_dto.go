package dto

type CreateSessionRequest struct {
	ProductID    string  `json:"product_id" binding:"required"`
	DisciplineID *string `json:"discipline_id"`
}

type CompleteSessionRequest struct {
	CardsReviewed    int `json:"cards_reviewed"`
	Correct          int `json:"correct"`
	Incorrect        int `json:"incorrect"`
	StudyTimeSeconds int `json:"study_time_seconds"`
}

type SessionResponse struct {
	ID               string  `json:"id"`
	StudentEmail     string  `json:"student_email"`
	ProductID        string  `json:"product_id"`
	DisciplineID     *string `json:"discipline_id"`
	CardsReviewed    int     `json:"cards_reviewed"`
	Correct          int     `json:"correct"`
	Incorrect        int     `json:"incorrect"`
	StudyTimeSeconds int     `json:"study_time_seconds"`
	SessionDate      string  `json:"session_date"`
	CreatedAt        string  `json:"created_at"`
}
