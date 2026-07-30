package dto

// GenerationJobResponse is returned immediately when a generation job is
// enqueued — before any LLM call has run.
type GenerationJobResponse struct {
	JobID       string `json:"job_id"`
	Status      string `json:"status"`
	TotalChunks int    `json:"total_chunks"`
}

// GenerationJobStatusResponse reports a job's progress and, once completed,
// its result — polled by the frontend.
type GenerationJobStatusResponse struct {
	JobID           string                `json:"job_id"`
	Status          string                `json:"status"`
	TotalChunks     int                   `json:"total_chunks"`
	CompletedChunks int                   `json:"completed_chunks"`
	ProgressPct     int                   `json:"progress_pct"`
	Error           string                `json:"error,omitempty"`
	Result          *PreviewCardsResponse `json:"result,omitempty"`
}
