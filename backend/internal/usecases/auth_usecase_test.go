package usecases

import (
	"testing"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/stretchr/testify/assert"
)

type mockMentorRepo struct{}

func (m *mockMentorRepo) Create(e interface{}) error                   { return nil }
func (m *mockMentorRepo) GetByID(id string) (interface{}, error)       { return nil, nil }
func (m *mockMentorRepo) GetByEmail(e string) (interface{}, error)     { return nil, nil }
func (m *mockMentorRepo) GetBySlug(s string) (interface{}, error)      { return nil, nil }
func (m *mockMentorRepo) GetAll(p, ps int) (interface{}, int64, error) { return nil, 0, nil }
func (m *mockMentorRepo) Update(e interface{}) error                   { return nil }
func (m *mockMentorRepo) Delete(id string) error                       { return nil }

func TestAdminLogin_Success(t *testing.T) {
	uc := NewAuthUseCase(nil, nil, nil, nil, "admin@test.com", "secret123")

	req := &dto.AdminLoginRequest{Email: "admin@test.com", Password: "secret123"}
	resp, err := uc.AdminLogin(req, "jwt-secret-key", 3600)

	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.NotEmpty(t, resp.Token)
}

func TestAdminLogin_WrongEmail(t *testing.T) {
	uc := NewAuthUseCase(nil, nil, nil, nil, "admin@test.com", "secret123")

	req := &dto.AdminLoginRequest{Email: "wrong@test.com", Password: "secret123"}
	resp, err := uc.AdminLogin(req, "jwt-secret-key", 3600)

	assert.Error(t, err)
	assert.Nil(t, resp)
	assert.Equal(t, "invalid credentials", err.Error())
}

func TestAdminLogin_WrongPassword(t *testing.T) {
	uc := NewAuthUseCase(nil, nil, nil, nil, "admin@test.com", "secret123")

	req := &dto.AdminLoginRequest{Email: "admin@test.com", Password: "wrong"}
	resp, err := uc.AdminLogin(req, "jwt-secret-key", 3600)

	assert.Error(t, err)
	assert.Nil(t, resp)
}
