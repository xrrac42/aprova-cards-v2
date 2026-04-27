package dto

type ReportsResponse struct {
	ActiveStudentsMonth int64              `json:"active_students_month"`
	SessionsMonth       int64              `json:"sessions_month"`
	TotalCards          int64              `json:"total_cards"`
	ActiveStudentsByDay []DayMetric        `json:"active_students_by_day"`
	CardsReviewedByDay  []DayMetric        `json:"cards_reviewed_by_day"`
	TopProducts         []ProductEngagement `json:"top_products"`
}

type DayMetric struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type ProductEngagement struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	Sessions    int64  `json:"sessions"`
	Cards       int64  `json:"cards"`
}
