package middleware

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRateLimiter_AllowsWithinLimit(t *testing.T) {
	rl := NewRateLimiter(3, 60)

	assert.True(t, rl.Allow("ip-1"))
	assert.True(t, rl.Allow("ip-1"))
	assert.True(t, rl.Allow("ip-1"))
}

func TestRateLimiter_BlocksOverLimit(t *testing.T) {
	rl := NewRateLimiter(2, 60)

	assert.True(t, rl.Allow("ip-1"))
	assert.True(t, rl.Allow("ip-1"))
	assert.False(t, rl.Allow("ip-1"))
}

func TestRateLimiter_SeparateKeys(t *testing.T) {
	rl := NewRateLimiter(1, 60)

	assert.True(t, rl.Allow("ip-1"))
	assert.True(t, rl.Allow("ip-2"))
	assert.False(t, rl.Allow("ip-1"))
	assert.False(t, rl.Allow("ip-2"))
}