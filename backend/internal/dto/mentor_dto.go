package dto

type CreateMentorRequest struct {
	Name           string  `json:"name" binding:"required,min=3"`
	Email          string  `json:"email" binding:"required,email"`
	Slug           string  `json:"slug" binding:"required,min=3"`
	MentorPassword string  `json:"mentor_password" binding:"required,min=4"`
	PrimaryColor   string  `json:"primary_color"`
	SecondaryColor string  `json:"secondary_color"`
	LogoURL        *string `json:"logo_url"`
}

type UpdateMentorRequest struct {
	Name           string  `json:"name"`
	Email          string  `json:"email"`
	Slug           string  `json:"slug"`
	MentorPassword string  `json:"mentor_password"`
	PrimaryColor   string  `json:"primary_color"`
	SecondaryColor string  `json:"secondary_color"`
	LogoURL        *string `json:"logo_url"`
}

type MentorResponse struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Email          string  `json:"email"`
	Slug           string  `json:"slug"`
	LogoURL        *string `json:"logo_url"`
	PrimaryColor   string  `json:"primary_color"`
	SecondaryColor string  `json:"secondary_color"`
	AccentColor    *string `json:"accent_color"`
	CreatedAt      string  `json:"created_at"`
}
