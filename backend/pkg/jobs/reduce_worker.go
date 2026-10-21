package jobs

import (
	"context"
	"time"

	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/riverqueue/river"
)

type ReduceWorkerArgs struct {
	JobID string `json:"job_id"`
}

func (ReduceWorkerArgs) Kind() string { return "generation_reduce" }

type ReduceWorker struct {
	river.WorkerDefaults[ReduceWorkerArgs]
	UC usecases.GenerationUseCase
}

// Timeout overrides River's 1-minute default so the reviewer call isn't
// cancelled mid-flight on large card lists.
func (w *ReduceWorker) Timeout(*river.Job[ReduceWorkerArgs]) time.Duration { return 4 * time.Minute }

func (w *ReduceWorker) Work(ctx context.Context, job *river.Job[ReduceWorkerArgs]) error {
	return w.UC.RunReduce(ctx, job.Args.JobID)
}
