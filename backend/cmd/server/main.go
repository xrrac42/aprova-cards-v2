package main

import (
	"fmt"
	"log"

	"github.com/approva-cards/back-aprova-cards/config"
	"github.com/approva-cards/back-aprova-cards/internal/handlers"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	appauth "github.com/approva-cards/back-aprova-cards/pkg/auth"
	"github.com/approva-cards/back-aprova-cards/pkg/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	cfg := config.Load()

	db := connectDatabase(cfg)

	if cfg.Server.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	engine := gin.New()
	engine.Use(gin.Recovery())

	// Global middlewares
	engine.Use(middleware.RequestLogger())
	engine.Use(middleware.ErrorHandler())
	engine.Use(middleware.CORSMiddleware(cfg.CORS.AllowedOrigins))

	// Global rate limiter: 100 req/min per IP
	globalLimiter := middleware.NewRateLimiter(cfg.RateLimit.Requests, cfg.RateLimit.WindowSeconds)
	engine.Use(middleware.RateLimitByIP(globalLimiter))

	setupRoutes(engine, db, cfg)

	port := ":" + cfg.Server.Port
	fmt.Printf("🚀 Server running on http://localhost%s\n", port)

	if err := engine.Run(port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func connectDatabase(cfg *config.Config) *gorm.DB {
	dsn := cfg.GetDSN()

	logMode := logger.Info
	if cfg.Server.Env == "production" {
		logMode = logger.Warn
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logMode),
	})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	fmt.Println("✅ Database connected successfully")
	return db
}

func setupRoutes(engine *gin.Engine, db *gorm.DB, cfg *config.Config) {
	api := engine.Group("/api/v1")
	supabaseAdminClient := appauth.NewSupabaseAdminClient(cfg.Supabase.URL, cfg.Supabase.ServiceRoleKey)
	if supabaseAdminClient.IsConfigured() {
		fmt.Println("✅ Mentor provisioning: Supabase Admin configured")
	} else {
		fmt.Printf("⚠️ Mentor provisioning disabled: %s\n", supabaseAdminClient.ConfigDiagnostic())
	}

	// ---- Health (public) ----
	healthHandler := handlers.NewHealthHandler(db)
	api.GET("/health", healthHandler.Check)

	// ---- Auth (public, stricter rate limit: 5 req / 5 min) ----
	authLimiter := middleware.NewRateLimiter(5, 300)
	mentorRepo := repositories.NewMentorRepository(db)
	authUC := usecases.NewAuthUseCase(mentorRepo, cfg.Admin.Email, cfg.Admin.Password)
	authHandler := handlers.NewAuthHandler(authUC, cfg.JWT.Secret, cfg.JWT.Expiration)
	adminMentorUC := usecases.NewAdminMentorUseCase(db, supabaseAdminClient)

	authGroup := api.Group("/auth")
	authGroup.Use(middleware.RateLimitByIP(authLimiter))
	{
		authGroup.POST("/admin-login", authHandler.AdminLogin)
	}
	api.POST("/admin/mentors/provision", handlers.NewMentorHandler(usecases.NewMentorUseCase(mentorRepo), adminMentorUC, supabaseAdminClient).CreateProvisioned)

	// ---- Feedback (public for students via X-Student-Email header) ----
	feedbackRepo := repositories.NewFeedbackRepository(db)
	feedbackHandler := handlers.NewFeedbackHandler(feedbackRepo)
	api.POST("/feedbacks", feedbackHandler.Create)

	// ---- Protected routes (JWT required) ----
	protected := api.Group("")
	protected.Use(middleware.AuthMiddleware(cfg.JWT.Secret))
	{
		// -- Mentors (admin only) --
		mentorUC := usecases.NewMentorUseCase(mentorRepo)
		mentorHandler := handlers.NewMentorHandler(mentorUC, adminMentorUC, supabaseAdminClient)
		mentors := protected.Group("/mentors")
		mentors.Use(middleware.AdminOnly())
		{
			mentors.POST("", mentorHandler.Create)
			mentors.GET("", mentorHandler.GetAll)
			mentors.GET("/:id", mentorHandler.GetByID)
			mentors.PUT("/:id", mentorHandler.Update)
			mentors.DELETE("/:id", mentorHandler.Delete)
		}

		// -- Products (admin/mentor) --
		productRepo := repositories.NewProductRepository(db)
		productUC := usecases.NewProductUseCase(productRepo)
		productHandler := handlers.NewProductHandler(productUC)
		products := protected.Group("/products")
		{
			products.POST("", productHandler.Create)
			products.GET("", productHandler.GetAll)
			products.GET("/:id", productHandler.GetByID)
			products.PUT("/:id", productHandler.Update)
			products.DELETE("/:id", productHandler.Delete)
		}

		// -- Disciplines within product (separate group to avoid wildcard conflict) --
		discRepo := repositories.NewDisciplineRepository(db)
		discUC := usecases.NewDisciplineUseCase(discRepo)
		discHandler := handlers.NewDisciplineHandler(discUC)
		protected.GET("/products/:id/disciplines", discHandler.GetByProductID)
		protected.POST("/products/:id/disciplines", discHandler.Create)

		// -- Students within product --
		studentRepo := repositories.NewStudentAccessRepository(db)
		studentHandler := handlers.NewStudentHandler(studentRepo)
		protected.GET("/products/:id/students", studentHandler.GetByProductID)
		protected.POST("/products/:id/students", studentHandler.AddStudent)

		// -- Feedbacks for product --
		protected.GET("/products/:id/feedbacks", feedbackHandler.GetByProductID)

		// -- Disciplines (standalone) --
		discRepo2 := repositories.NewDisciplineRepository(db)
		discUC2 := usecases.NewDisciplineUseCase(discRepo2)
		discHandler2 := handlers.NewDisciplineHandler(discUC2)
		disciplines := protected.Group("/disciplines")
		{
			disciplines.PUT("/:id", discHandler2.Update)
			disciplines.DELETE("/:id", discHandler2.Delete)
			disciplines.POST("/:id/reorder", discHandler2.Reorder)
		}

		// -- Cards within discipline --
		cardRepo := repositories.NewCardRepository(db)
		cardUC := usecases.NewCardUseCase(cardRepo, discRepo2)
		cardHandler := handlers.NewCardHandler(cardUC)
		protected.GET("/disciplines/:id/cards", cardHandler.GetByDisciplineID)
		protected.POST("/disciplines/:id/cards", cardHandler.Create)

		// -- Cards (standalone) --
		cardRepo2 := repositories.NewCardRepository(db)
		discRepo3 := repositories.NewDisciplineRepository(db)
		cardUC2 := usecases.NewCardUseCase(cardRepo2, discRepo3)
		cardHandler2 := handlers.NewCardHandler(cardUC2)
		cards := protected.Group("/cards")
		{
			cards.PUT("/:id", cardHandler2.Update)
			cards.DELETE("/:id", cardHandler2.Delete)
		}

		// -- Students (standalone) --
		studentRepo2 := repositories.NewStudentAccessRepository(db)
		studentHandler2 := handlers.NewStudentHandler(studentRepo2)
		protected.PATCH("/students/:email/access", studentHandler2.UpdateAccess)
	}

	fmt.Println("✅ Routes registered successfully")
}
