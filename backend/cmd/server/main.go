package main

import (
	"fmt"
	"log"

	"github.com/approva-cards/back-aprova-cards/config"
	"github.com/approva-cards/back-aprova-cards/internal/handlers"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/approva-cards/back-aprova-cards/pkg/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	// Carregar configuração
	cfg := config.Load()

	// Conectar ao banco
	db := connectDatabase(cfg)

	// Setup Gin
	engine := gin.Default()

	// Middlewares
	engine.Use(middleware.RequestLogger())
	engine.Use(middleware.ErrorHandler())
	engine.Use(middleware.CORSMiddleware(cfg.CORS.AllowedOrigins))
	engine.Use(middleware.RateLimitMiddleware())

	// Injeção de dependências e rotas
	setupRoutes(engine, db)

	// Iniciar servidor
	port := ":" + cfg.Server.Port
	fmt.Printf("🚀 Server running on http://localhost%s\n", port)

	if err := engine.Run(port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func connectDatabase(cfg *config.Config) *gorm.DB {
	dsn := cfg.GetDSN()

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	fmt.Println("✅ Database connected successfully")
	return db
}

func setupRoutes(engine *gin.Engine, db *gorm.DB) {
	api := engine.Group("/api/v1")

	// Health check - Sem autenticação, com verificação real do banco
	healthHandler := handlers.NewHealthHandler(db)
	api.GET("/health", healthHandler.Check)

	// Sample routes - Exemplo de CRUD completo com Handler -> UseCase -> Repository
	sampleRepo := repositories.NewSampleRepository(db)
	sampleUseCase := usecases.NewSampleUseCase(sampleRepo)
	sampleHandler := handlers.NewSampleHandler(sampleUseCase)

	samples := api.Group("/samples")
	{
		samples.POST("", sampleHandler.Create)       // POST /api/v1/samples
		samples.GET("", sampleHandler.GetAll)        // GET /api/v1/samples?page=1&page_size=10
		samples.GET("/:id", sampleHandler.GetByID)   // GET /api/v1/samples/:id
		samples.PUT("/:id", sampleHandler.Update)    // PUT /api/v1/samples/:id
		samples.DELETE("/:id", sampleHandler.Delete) // DELETE /api/v1/samples/:id
	}

	fmt.Println("✅ Routes registered successfully")
}
