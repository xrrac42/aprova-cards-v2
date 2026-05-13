package dto

// GenerateInvitationRequest is used by mentor to generate an invitation link
type GenerateInvitationRequest struct {
	ProductID      string `json:"product_id" binding:"required"`
	InvitedName    string `json:"invited_name" binding:"omitempty,max=255"`
	InvitedEmail   string `json:"invited_email" binding:"omitempty,email"`
	ExpirationDays int    `json:"expiration_days" binding:"omitempty,default=30,min=1,max=365"`
}

// InvitationResponse represents an invitation
type InvitationResponse struct {
	ID           string  `json:"id"`
	InviteCode   string  `json:"invite_code"`
	InviteLink   string  `json:"invite_link"` // Full URL for sharing
	MentorID     string  `json:"mentor_id"`
	ProductID    string  `json:"product_id"`
	Status       string  `json:"status"`
	InvitedEmail *string `json:"invited_email"`
	InvitedName  *string `json:"invited_name"`
	ExpiresAt    string  `json:"expires_at"`
	SignedUpAt   *string `json:"signed_up_at"`
	ActivatedAt  *string `json:"activated_at"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

// ListInvitationsQuery contains query parameters for listing invitations
type ListInvitationsQuery struct {
	MentorID  *string `form:"mentor_id"`
	ProductID *string `form:"product_id"`
	Status    *string `form:"status"`
	Page      int     `form:"page,default=1" binding:"min=1"`
	PageSize  int     `form:"page_size,default=20" binding:"min=1,max=100"`
}

// InvitationListResponse contains paginated invitation results
type InvitationListResponse struct {
	Data       []InvitationResponse `json:"data"`
	Total      int64                `json:"total"`
	Page       int                  `json:"page"`
	PageSize   int                  `json:"page_size"`
	TotalPages int                  `json:"total_pages"`
}

// StudentSignUpRequest is used by student to sign up via invitation
type StudentSignUpRequest struct {
	InviteCode string `json:"invite_code" binding:"required"`
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required,min=8"`
	FullName   string `json:"full_name" binding:"required,min=3"`
}

// StudentSignUpResponse contains signup result
type StudentSignUpResponse struct {
	InvitationID string `json:"invitation_id"`
	Email        string `json:"email"`
	Message      string `json:"message"`
	NextStep     string `json:"next_step"` // "payment" or "verify_email"
}


// StudentAuthResponse represents a student's auth record
type StudentAuthResponse struct {
	ID             string `json:"id"`
	StudentEmail   string `json:"student_email"`
	SupabaseUserID string `json:"supabase_user_id"`
	MentorID       string `json:"mentor_id"`
	ProductID      string `json:"product_id"`
	EmailVerified  bool   `json:"email_verified"`
	CreatedAt      string `json:"created_at"`
}

// ValidateInviteCodeRequest checks if invitation code is valid
type ValidateInviteCodeRequest struct {
	InviteCode string `json:"invite_code" binding:"required"`
}

// ValidateInviteCodeResponse returns invitation details for validation
type ValidateInviteCodeResponse struct {
	IsValid      bool   `json:"is_valid"`
	InvitationID string `json:"invitation_id,omitempty"`
	ProductID    string `json:"product_id,omitempty"`
	MentorID     string `json:"mentor_id,omitempty"`
	ProductName  string `json:"product_name,omitempty"`
	PaymentLink  string `json:"payment_link,omitempty"`
	Status       string `json:"status,omitempty"`
	ExpiresAt    string `json:"expires_at,omitempty"`
	Message      string `json:"message,omitempty"`
}

// BulkSignUpRequest is used by admin to register students in bulk without payment
type BulkSignUpRequest struct {
	MentorID        string   `json:"mentor_id" binding:"required"`
	ProductID       string   `json:"product_id" binding:"required"`
	DefaultPassword string   `json:"default_password" binding:"required,min=6"`
	Emails          []string `json:"emails" binding:"required,min=1,max=500"`
}

// BulkSignUpResult holds the per-email result
type BulkSignUpResult struct {
	Email   string `json:"email"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// BulkSignUpResponse summarises the bulk operation
type BulkSignUpResponse struct {
	Total   int                `json:"total"`
	Success int                `json:"success"`
	Failed  int                `json:"failed"`
	Results []BulkSignUpResult `json:"results"`
}
