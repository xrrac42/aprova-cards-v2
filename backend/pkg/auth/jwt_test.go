package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestGenerateAndValidateToken(t *testing.T) {
	secret := "test-secret-key-123"

	token, err := GenerateToken(secret, 3600, "user-123", "test@email.com", "admin")
	assert.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := ValidateToken(secret, token)
	assert.NoError(t, err)
	assert.Equal(t, "user-123", claims.Sub)
	assert.Equal(t, "test@email.com", claims.Email)
	assert.Equal(t, "admin", claims.Role)
}

func TestValidateToken_Expired(t *testing.T) {
	secret := "test-secret-key-123"

	token, _ := GenerateToken(secret, -1, "user-123", "test@email.com", "admin")

	// Wait a tiny bit to ensure expiration
	time.Sleep(10 * time.Millisecond)

	_, err := ValidateToken(secret, token)
	assert.Error(t, err)
	assert.Equal(t, ErrExpiredToken, err)
}

func TestValidateToken_WrongSecret(t *testing.T) {
	token, _ := GenerateToken("secret-1", 3600, "user-123", "test@email.com", "admin")

	_, err := ValidateToken("secret-2", token)
	assert.Error(t, err)
	assert.Equal(t, ErrInvalidToken, err)
}

func TestValidateToken_MalformedToken(t *testing.T) {
	_, err := ValidateToken("secret", "not.a.valid.token.at.all")
	assert.Error(t, err)
}

func TestValidateToken_EmptyToken(t *testing.T) {
	_, err := ValidateToken("secret", "")
	assert.Error(t, err)
}