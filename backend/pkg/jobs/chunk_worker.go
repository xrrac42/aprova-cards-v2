// Package jobs wires the async card-generation pipeline (internal/usecases.GenerationUseCase)
// to River. Job args carry only IDs — workers load the actual chunk/job
// state from Postgres, keeping river_job.args small.
package jobs

import (
	"context"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/riverqueue/river"
)

type ChunkWorkerArgs struct {
	JobID   string `json:"job_id"`
	ChunkID string `json:"chunk_id"`
}

func (ChunkWorkerArgs) Kind() string { return "generation_chunk" }

type ChunkWorker struct {
	river.WorkerDefaults[ChunkWorkerArgs]
	UC usecases.GenerationUseCase
}

// Timeout overrides River's 1-minute default, which cancelled any chunk whose
// LLM call ran past 60s — a long first pass, or first pass plus the coverage
// follow-up — turning it into a retry that hit the same wall. It must exceed
// two sequential calls at the HTTP client's timeout (pkg/anthropic).
func (w *ChunkWorker) Timeout(*river.Job[ChunkWorkerArgs]) time.Duration { return 7 * time.Minute }

func (w *ChunkWorker) Work(ctx context.Context, job *river.Job[ChunkWorkerArgs]) error {
	return w.UC.ProcessChunk(ctx, job.Args.JobID, job.Args.ChunkID, job.Attempt, job.MaxAttempts)
}
