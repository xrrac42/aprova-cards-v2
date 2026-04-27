package dto

type AdminLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=1"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	User  interface{} `json:"user"`
}

type UserInfo struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
	Name  string `json:"name"`
}

type StudentPortalAccessResponse struct {
	Token     string `json:"token"`      // Go-issued JWT para usar nas rotas protegidas
	MentorID  string `json:"mentor_id"`
	ProductID string `json:"product_id"`
	Email     string `json:"email"`
}
