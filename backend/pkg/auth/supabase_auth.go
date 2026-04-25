package auth

import (
	"context"
	"fmt"

	"github.com/supabase-community/supabase-go"
)

type adminUserCreateRequest struct {
	Email        string                 `json:"email"`
	Password     string                 `json:"password"`
	UserMetadata map[string]interface{} `json:"user_metadata,omitempty"`
}

type SupabaseAuthService struct {
	client *supabase.Client
}

type CreateAuthUserInput struct {
	Email    string
	Password string
	FullName string
	Metadata map[string]interface{}
}

type AuthUserResponse struct {
	ID    string
	Email string
}

type SupabaseAuthError struct {
	Code    string
	Message string
}

// NewSupabaseAuthService creates a new Supabase Auth service
func NewSupabaseAuthService(supabaseURL, serviceKey string) (*SupabaseAuthService, error) {
	client, err := supabase.NewClient(supabaseURL, serviceKey, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize supabase client: %w", err)
	}

	return &SupabaseAuthService{
		client: client,
	}, nil
}

// CreateUser creates a new auth user in Supabase
func (s *SupabaseAuthService) CreateUser(
	ctx context.Context,
	input *CreateAuthUserInput,
) (*AuthUserResponse, error) {
	if input == nil {
		return nil, fmt.Errorf("input cannot be nil")
	}

	if input.Email == "" {
		return nil, fmt.Errorf("email is required")
	}

	if input.Password == "" {
		return nil, fmt.Errorf("password is required")
	}

	// Use the admin API to create user
	// Note: This requires the Supabase service key to be set in the client
	req := adminUserCreateRequest{
		Email:    input.Email,
		Password: input.Password,
	}

	meta := make(map[string]interface{})
	if input.FullName != "" {
		meta["full_name"] = input.FullName
	}
	for k, v := range input.Metadata {
		meta[k] = v
	}
	if len(meta) > 0 {
		req.UserMetadata = meta
	}

	_ = req // supabase-go SDK does not expose admin user creation; use SupabaseAdminClient instead
	return nil, fmt.Errorf("not implemented: use SupabaseAdminClient.CreateAuthUser")
}

// GetUser retrieves a user by ID
func (s *SupabaseAuthService) GetUser(ctx context.Context, userID string) (*AuthUserResponse, error) {
	if userID == "" {
		return nil, fmt.Errorf("user ID is required")
	}

	// TODO: Implement user retrieval using admin API
	return nil, fmt.Errorf("not yet implemented")
}

// UpdateUserMetadata updates user metadata
func (s *SupabaseAuthService) UpdateUserMetadata(
	ctx context.Context,
	userID string,
	metadata map[string]interface{},
) error {
	if userID == "" {
		return fmt.Errorf("user ID is required")
	}

	if metadata == nil {
		return fmt.Errorf("metadata cannot be nil")
	}

	// TODO: Implement metadata update using admin API
	return fmt.Errorf("not yet implemented")
}

// DeleteUser deletes a user by ID
func (s *SupabaseAuthService) DeleteUser(ctx context.Context, userID string) error {
	if userID == "" {
		return fmt.Errorf("user ID is required")
	}

	// TODO: Implement user deletion using admin API
	return fmt.Errorf("not yet implemented")
}

// SendEmailVerification sends a verification email
func (s *SupabaseAuthService) SendEmailVerification(ctx context.Context, email string) error {
	if email == "" {
		return fmt.Errorf("email is required")
	}

	// TODO: Implement email verification using admin API
	return fmt.Errorf("not yet implemented")
}
