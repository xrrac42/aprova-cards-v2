package dto

type SystemHealthResponse struct {
	Score             int                  `json:"score"`
	WebhookFails24h   int64                `json:"webhook_fails_24h"`
	LoginFails24h     int64                `json:"login_fails_24h"`
	InactiveStudents  int64                `json:"inactive_students"`
	ActiveStudentsDay int64                `json:"active_students_today"`
	CardsStudiedDay   int64                `json:"cards_studied_today"`
	SessionsDay       int64                `json:"sessions_today"`
	ActiveIncidents   []SystemIncidentDTO  `json:"active_incidents"`
	ResolvedIncidents []SystemIncidentDTO  `json:"resolved_incidents"`
	Exceptions        []HealthExceptionDTO `json:"exceptions"`
}

type SystemIncidentDTO struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Severity    string `json:"severity"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Metadata    string `json:"metadata"`
	Resolved    bool   `json:"resolved"`
	CreatedAt   string `json:"created_at"`
}

type HealthExceptionDTO struct {
	ID           string `json:"id"`
	Type         string `json:"type"`
	ReferenceKey string `json:"reference_key"`
	CreatedAt    string `json:"created_at"`
}

type ResolveIncidentRequest struct {
	ID string `json:"id" binding:"required"`
}
