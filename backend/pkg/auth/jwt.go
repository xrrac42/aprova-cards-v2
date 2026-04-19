package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token expired")
)

type Claims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Role  string `json:"role"`
	Exp   int64  `json:"exp"`
	Iat   int64  `json:"iat"`
}

func GenerateToken(secret string, expSeconds int, userID, email, role string) (string, error) {
	now := time.Now().UTC()
	claims := Claims{
		Sub:   userID,
		Email: email,
		Role:  role,
		Iat:   now.Unix(),
		Exp:   now.Add(time.Duration(expSeconds) * time.Second).Unix(),
	}

	header := base64Encode([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payloadB64 := base64Encode(payload)

	sigInput := header + "." + payloadB64
	sig := sign(sigInput, secret)

	return sigInput + "." + sig, nil
}

func ValidateToken(secret, tokenStr string) (*Claims, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, ErrInvalidToken
	}

	sigInput := parts[0] + "." + parts[1]
	expectedSig := sign(sigInput, secret)

	if !hmac.Equal([]byte(parts[2]), []byte(expectedSig)) {
		return nil, ErrInvalidToken
	}

	payloadBytes, err := base64Decode(parts[1])
	if err != nil {
		return nil, ErrInvalidToken
	}

	var claims Claims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, ErrInvalidToken
	}

	if time.Now().UTC().Unix() > claims.Exp {
		return nil, ErrExpiredToken
	}

	return &claims, nil
}

func sign(input, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(input))
	return base64Encode(h.Sum(nil))
}

func base64Encode(data []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(data), "=")
}

func base64Decode(s string) ([]byte, error) {
	switch len(s) % 4 {
	case 2:
		s += "=="
	case 3:
		s += "="
	}
	return base64.URLEncoding.DecodeString(s)
}
