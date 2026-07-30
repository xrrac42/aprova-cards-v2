package jobs

import (
	"context"

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

func (w *ReduceWorker) Work(ctx context.Context, job *river.Job[ReduceWorkerArgs]) error {
	return w.UC.RunReduce(ctx, job.Args.JobID)
}
