package middleware

import (
	"net/http"
	"strings"

	"github.com/approva-cards/back-aprova-cards/pkg/auth"
	"github.com/gin-gonic/gin"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "missing authorization header",
			})
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "invalid authorization format, use: Bearer <token>",
			})
			return
		}

		claims, err := auth.ValidateToken(jwtSecret, parts[1])
		if err != nil {
			status := http.StatusUnauthorized
			msg := "invalid token"
			if err == auth.ErrExpiredToken {
				msg = "token expired"
			}
			c.AbortWithStatusJSON(status, gin.H{
				"success": false,
				"error":   msg,
			})
			return
		}

		c.Set("user_id", claims.Sub)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists || role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "admin access required",
			})
			return
		}
		c.Next()
	}
}

func MentorOrAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "authentication required",
			})
			return
		}
		r := role.(string)
		if r != "admin" && r != "mentor" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "mentor or admin access required",
			})
			return
		}
		c.Next()
	}
}
