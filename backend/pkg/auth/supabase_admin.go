package auth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type SupabaseAdmin interface {
	CreateAuthUser(email, password string) (*SupabaseUser, error)
	CreateAuthUserWithMetadata(email, password string, userMetadata map[string]interface{}) (*SupabaseUser, error)
	InviteUserByEmail(email string) (*SupabaseUser, error)
	DeleteAuthUser(userID string) error
	GetUserFromAccessToken(accessToken string) (*SupabaseUser, error)
}

type SupabaseAdminClient struct {
	baseURL        string
	serviceRoleKey string
	httpClient     *http.Client
}

type SupabaseUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type createUserRequest struct {
	Email        string                 `json:"email"`
	Password     string                 `json:"password"`
	EmailConfirm bool                   `json:"email_confirm"`
	UserMetadata map[string]interface{} `json:"user_metadata,omitempty"`
}

type createUserResponse struct {
	User  SupabaseUser `json:"user"`
	ID    string       `json:"id"`
	Email string       `json:"email"`
}

type getUserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func NewSupabaseAdminClient(baseURL, serviceRoleKey string) *SupabaseAdminClient {
	cleanBase := normalizeSupabaseBaseURL(baseURL)
	return &SupabaseAdminClient{
		baseURL:        cleanBase,
		serviceRoleKey: serviceRoleKey,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *SupabaseAdminClient) IsConfigured() bool {
	return c.baseURL != "" && c.serviceRoleKey != ""
}

func (c *SupabaseAdminClient) ConfigDiagnostic() string {
	if c.baseURL == "" && c.serviceRoleKey == "" {
		return "missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY"
	}
	if c.baseURL == "" {
		return "missing SUPABASE_URL (or VITE_SUPABASE_URL)"
	}
	if c.serviceRoleKey == "" {
		return "missing SUPABASE_SERVICE_ROLE_KEY"
	}
	return "ok"
}

func (c *SupabaseAdminClient) CreateAuthUser(email, password string) (*SupabaseUser, error) {
	return c.CreateAuthUserWithMetadata(email, password, nil)
}

func (c *SupabaseAdminClient) CreateAuthUserWithMetadata(email, password string, userMetadata map[string]interface{}) (*SupabaseUser, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("supabase admin client not configured")
	}

	payload := createUserRequest{
		Email:        strings.ToLower(strings.TrimSpace(email)),
		Password:     password,
		EmailConfirm: true,
		UserMetadata: userMetadata,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	respBody, statusCode, err := c.doRequest(http.MethodPost, c.baseURL+"/auth/v1/admin/users", bytes.NewReader(body), c.serviceRoleKey)
	if err != nil {
		return nil, err
	}
	if statusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("supabase create user failed: %s", extractErrorMessage(respBody))
	}

	var out createUserResponse
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, err
	}

	created := extractCreatedUser(out)
	if created.ID == "" {
		return nil, fmt.Errorf("supabase create user returned empty user id (response=%s)", string(respBody))
	}
	return &created, nil
}

func (c *SupabaseAdminClient) InviteUserByEmail(email string) (*SupabaseUser, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("supabase admin client not configured")
	}

	payload := map[string]interface{}{
		"email": strings.ToLower(strings.TrimSpace(email)),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	respBody, statusCode, err := c.doRequest(http.MethodPost, c.baseURL+"/auth/v1/admin/invite", bytes.NewReader(body), c.serviceRoleKey)
	if err != nil {
		return nil, err
	}
	if statusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("supabase invite user failed: %s", extractErrorMessage(respBody))
	}

	var out createUserResponse
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, err
	}

	created := extractCreatedUser(out)
	if created.ID == "" {
		return nil, fmt.Errorf("supabase invite returned empty user id (response=%s)", string(respBody))
	}
	return &created, nil
}

func (c *SupabaseAdminClient) DeleteAuthUser(userID string) error {
	if !c.IsConfigured() || userID == "" {
		return nil
	}
	respBody, statusCode, err := c.doRequest(http.MethodDelete, c.baseURL+"/auth/v1/admin/users/"+userID, nil, c.serviceRoleKey)
	if err != nil {
		return err
	}
	if statusCode >= http.StatusBadRequest {
		return fmt.Errorf("supabase delete user failed: %s", extractErrorMessage(respBody))
	}
	return nil
}

func (c *SupabaseAdminClient) GetUserFromAccessToken(accessToken string) (*SupabaseUser, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("supabase admin client not configured")
	}
	respBody, statusCode, err := c.doRequest(http.MethodGet, c.baseURL+"/auth/v1/user", nil, accessToken)
	if err != nil {
		return nil, err
	}
	if statusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("supabase get user failed: %s", extractErrorMessage(respBody))
	}

	var out getUserResponse
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, err
	}
	if out.ID == "" || out.Email == "" {
		return nil, fmt.Errorf("supabase get user returned invalid payload")
	}
	return &SupabaseUser{ID: out.ID, Email: out.Email}, nil
}

func (c *SupabaseAdminClient) doRequest(method, url string, body io.Reader, bearerToken string) ([]byte, int, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("apikey", c.serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+bearerToken)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return respBody, resp.StatusCode, nil
}

func extractErrorMessage(raw []byte) string {
	if len(raw) == 0 {
		return "empty response"
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return string(raw)
	}
	if msg, ok := payload["msg"].(string); ok && msg != "" {
		return msg
	}
	if msg, ok := payload["message"].(string); ok && msg != "" {
		return msg
	}
	if errStr, ok := payload["error"].(string); ok && errStr != "" {
		return errStr
	}
	return string(raw)
}

func normalizeSupabaseBaseURL(raw string) string {
	u := strings.TrimSpace(raw)
	if u == "" {
		return ""
	}
	u = strings.TrimRight(u, "/")
	u = strings.TrimSuffix(u, "/rest/v1")
	u = strings.TrimSuffix(u, "/auth/v1")

	parsed, err := url.Parse(u)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	parsed.Path = ""
	return strings.TrimRight(parsed.String(), "/")
}

func extractCreatedUser(out createUserResponse) SupabaseUser {
	if out.User.ID != "" {
		return out.User
	}
	if out.ID != "" {
		return SupabaseUser{ID: out.ID, Email: out.Email}
	}
	return SupabaseUser{}
}
