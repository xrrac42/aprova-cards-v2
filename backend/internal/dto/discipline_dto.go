package dto

type CreateDisciplineRequest struct {
	ProductID string `json:"product_id"`
	Name      string `json:"name" binding:"required,min=2"`
	Order     int    `json:"order"`
}

type UpdateDisciplineRequest struct {
	Name  string `json:"name"`
	Order *int   `json:"order"`
}

type ReorderDisciplinesRequest struct {
	IDs []string `json:"ids" binding:"required,min=1"`
}

type DisciplineResponse struct {
	ID        string `json:"id"`
	ProductID string `json:"product_id"`
	Name      string `json:"name"`
	Order     int    `json:"order"`
	CreatedAt string `json:"created_at"`
}
