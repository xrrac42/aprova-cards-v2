package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Admin     AdminConfig
	Server    ServerConfig
	Database  DatabaseConfig
	JWT       JWTConfig
	CORS      CORSConfig
	RateLimit RateLimitConfig
	Supabase  SupabaseConfig
}

type ServerConfig struct {
	Port string
	Env  string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

type JWTConfig struct {
	Secret     string
	Expiration int
}

type CORSConfig struct {
	AllowedOrigins string
}

type RateLimitConfig struct {
	Enabled       bool
	Requests      int
	WindowSeconds int
}

type SupabaseConfig struct {
	URL            string
	ServiceRoleKey string
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
			Env:  getEnv("SERVER_ENV", "development"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres"),
			Name:     getEnv("DB_NAME", "aprova_cards"),
			SSLMode:  getEnv("DB_SSL_MODE", "disable"),
		},
		JWT: JWTConfig{
			Secret:     getEnv("JWT_SECRET", "your-secret-key-here"),
			Expiration: getEnvInt("JWT_EXPIRATION", 3600),
		},
		CORS: CORSConfig{
			AllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		},
		Admin: AdminConfig{
			Email:    getEnv("ADMIN_EMAIL", "admin@aprovacards.com"),
			Password: getEnv("ADMIN_PASSWORD", "admin123"),
		},
		RateLimit: RateLimitConfig{
			Enabled:       getEnvBool("RATE_LIMIT_ENABLED", true),
			Requests:      getEnvInt("RATE_LIMIT_REQUESTS", 100),
			WindowSeconds: getEnvInt("RATE_LIMIT_WINDOW_SECONDS", 60),
		},
		Supabase: SupabaseConfig{
			URL:            getEnvFirst([]string{"SUPABASE_URL", "VITE_SUPABASE_URL"}, ""),
			ServiceRoleKey: getEnv("SUPABASE_SERVICE_ROLE_KEY", ""),
		},
	}
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.Database.Host,
		c.Database.Port,
		c.Database.User,
		c.Database.Password,
		c.Database.Name,
		c.Database.SSLMode,
	)
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	valStr := getEnv(key, "")
	if val, err := strconv.Atoi(valStr); err == nil {
		return val
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	val := getEnv(key, "")
	if val == "" {
		return defaultVal
	}
	return val == "true" || val == "1" || val == "yes"
}

func getEnvFirst(keys []string, defaultVal string) string {
	for _, key := range keys {
		if value, exists := os.LookupEnv(key); exists && value != "" {
			return value
		}
	}
	return defaultVal
}

type AdminConfig struct {
	Email    string
	Password string
}
