package dto

// ValidateSupabaseUserResponse represents the validation of a Supabase user
type ValidateSupabaseUserResponse struct {
	UserID        string `json:"user_id"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	FullName      string `json:"full_name"`
	Picture       string `json:"picture,omitempty"`
}

// SupabaseAuthError represents an error from Supabase Auth
type SupabaseAuthError struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
	ErrorCode        string `json:"error_code"`
}

// PostSignUpWebhookPayload represents the webhook sent by Supabase Auth after user signup
type PostSignUpWebhookPayload struct {
	Data struct {
		ID                  string                 `json:"id"`
		Aud                 string                 `json:"aud"`
		Role                string                 `json:"role"`
		Email               string                 `json:"email"`
		EmailVerified       bool                   `json:"email_verified"`
		PhoneVerified       bool                   `json:"phone_verified"`
		AppMetadata         map[string]interface{} `json:"app_metadata"`
		UserMetadata        map[string]interface{} `json:"user_metadata"`
		Identities          []interface{}          `json:"identities"`
		CreatedAt           string                 `json:"created_at"`
		UpdatedAt           string                 `json:"updated_at"`
		LastSignInAt        string                 `json:"last_sign_in_at"`
		RawAppMetadata      map[string]interface{} `json:"raw_app_metadata"`
		RawUserMetadata     map[string]interface{} `json:"raw_user_metadata"`
		IsSuperAdmin        bool                   `json:"is_super_admin"`
		Factors             []interface{}          `json:"factors"`
		UnconfirmedEmail    *string                `json:"unconfirmed_email"`
		ConfirmedAt         *string                `json:"confirmed_at"`
		EmailChangeTokenNew string                 `json:"email_change_token_new"`
		EmailChangeConfirm  bool                   `json:"email_change_confirm"`
		BannedUntil         *string                `json:"banned_until"`
		BannedReason        *string                `json:"banned_reason"`
	} `json:"data"`
	EventType string `json:"event_type"` // "user.signed_up", "user.created", etc.
	CreatedAt string `json:"created_at"`
}

// AuthRefreshTokenRequest represents a request to refresh the auth token
type AuthRefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// AuthRefreshTokenResponse represents the response from refreshing an auth token
type AuthRefreshTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

// AuthPasswordResetRequest represents a request to reset password
type AuthPasswordResetRequest struct {
	Email      string `json:"email" binding:"required,email"`
	RedirectTo string `json:"redirect_to" binding:"required"` // URL for password reset link
}

// AuthPasswordResetResponse represents the response from a password reset request
type AuthPasswordResetResponse struct {
	Message string `json:"message"`
}

// AuthConfirmEmailRequest represents a request to confirm email verification
type AuthConfirmEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
	Token string `json:"token" binding:"required"`
	Type  string `json:"type" binding:"required"` // "signup", "recovery", etc.
}

// AuthConfirmEmailResponse represents the response from email confirmation
type AuthConfirmEmailResponse struct {
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	Confirmed bool   `json:"confirmed"`
}
