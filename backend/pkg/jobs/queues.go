package jobs

const (
	// QueueChunks bounds how many chunk-extraction LLM calls run concurrently
	// system-wide — this, not manual goroutines, is what governs concurrency.
	QueueChunks = "ai_chunks"
	QueueReduce = "ai_reduce"
)
