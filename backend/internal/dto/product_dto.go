package dto

type CreateProductRequest struct {
	MentorID      string  `json:"mentor_id" binding:"required"`
	Name          string  `json:"name" binding:"required,min=3"`
	AccessCode    string  `json:"access_code" binding:"required,min=4"`
	Active        *bool   `json:"active"`
	CoverImageURL *string `json:"cover_image_url"`
}

type UpdateProductRequest struct {
	Name          string  `json:"name"`
	AccessCode    string  `json:"access_code"`
	Active        *bool   `json:"active"`
	CoverImageURL *string `json:"cover_image_url"`
}

type ProductResponse struct {
	ID            string  `json:"id"`
	MentorID      string  `json:"mentor_id"`
	Name          string  `json:"name"`
	AccessCode    string  `json:"access_code"`
	Active        bool    `json:"active"`
	CoverImageURL *string `json:"cover_image_url"`
	CreatedAt     string  `json:"created_at"`
}
