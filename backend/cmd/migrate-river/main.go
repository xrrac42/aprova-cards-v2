// Command migrate-river applies River's own system-table migrations
// (river_job, river_leader, etc.) — a mechanism separate from the
// hand-written SQL files in supabase/migrations/.
//
// Run manually, once per environment, before deploying the async
// generation pipeline: `go run ./cmd/migrate-river`.
package main

import (
	"context"
	"log"

	"github.com/approva-cards/back-aprova-cards/config"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, cfg.GetPgxDSN())
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	migrator, err := rivermigrate.New(riverpgxv5.New(pool), nil)
	if err != nil {
		log.Fatalf("failed to create river migrator: %v", err)
	}

	res, err := migrator.Migrate(ctx, rivermigrate.DirectionUp, nil)
	if err != nil {
		log.Fatalf("failed to migrate river schema: %v", err)
	}

	for _, v := range res.Versions {
		log.Printf("river migration applied: version %d", v.Version)
	}
	log.Println("✅ river schema up to date")
}
