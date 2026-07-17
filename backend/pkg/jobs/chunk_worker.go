// Package jobs wires the async card-generation pipeline (internal/usecases.GenerationUseCase)
// to River. Job args carry only IDs — workers load the actual chunk/job
// state from Postgres, keeping river_job.args small.
package jobs

import (
	"context"

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

func (w *ChunkWorker) Work(ctx context.Context, job *river.Job[ChunkWorkerArgs]) error {
	return w.UC.ProcessChunk(ctx, job.Args.JobID, job.Args.ChunkID, job.Attempt, job.MaxAttempts)
}
