package jobs

import (
	"context"

	"github.com/approva-cards/back-aprova-cards/internal/usecases"
	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"
)

// riverEnqueuer adapts a *river.Client to usecases.JobEnqueuer, keeping the
// usecase layer decoupled from River's generic client types.
type riverEnqueuer struct {
	client *river.Client[pgx.Tx]
}

func NewEnqueuer(client *river.Client[pgx.Tx]) usecases.JobEnqueuer {
	return &riverEnqueuer{client: client}
}

func (e *riverEnqueuer) EnqueueChunks(ctx context.Context, jobID string, chunkIDs []string) error {
	params := make([]river.InsertManyParams, len(chunkIDs))
	for i, chunkID := range chunkIDs {
		params[i] = river.InsertManyParams{
			Args:       ChunkWorkerArgs{JobID: jobID, ChunkID: chunkID},
			InsertOpts: &river.InsertOpts{Queue: QueueChunks, MaxAttempts: 3},
		}
	}
	_, err := e.client.InsertMany(ctx, params)
	return err
}

func (e *riverEnqueuer) EnqueueReduce(ctx context.Context, jobID string) error {
	_, err := e.client.Insert(ctx, ReduceWorkerArgs{JobID: jobID}, &river.InsertOpts{Queue: QueueReduce, MaxAttempts: 2})
	return err
}
