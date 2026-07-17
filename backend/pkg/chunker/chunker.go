// Package chunker splits large source documents into smaller, overlapping
// text chunks so each one can be sent to the LLM independently and in
// parallel. Splitting is deterministic (character-budget based, with a
// preference for cutting at page/paragraph/sentence boundaries) — there is
// no LLM "planning" pass involved.
package chunker

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

// PageMarker is inserted by the frontend PDF extractor between pages
// (see AiGenerationPanel.tsx). Its presence gives the splitter a page-aware
// cut point; its absence just falls back to paragraph/sentence boundaries.
const PageMarker = "[[PAGE"

const (
	DefaultTargetChars  = 20000 // ~5k tokens
	DefaultOverlapChars = 200

	// DefaultMaxChunks is a safety valve against truly pathological input
	// (e.g. a non-text file misread as text), not a target — chunk jobs are
	// cheap, independent, and checkpointed, and concurrency is already
	// bounded by River's queue MaxWorkers, not by the chunk count. At
	// ~20k chars/chunk this comfortably covers hundreds of pages, which
	// matters because pdf.js text extraction is noisy (a space inserted
	// per text run) and can inflate char count well past a page's visible
	// text.
	DefaultMaxChunks = 200

	// boundarySearchWindow bounds how far back from the target cut point we
	// look for a natural boundary before giving up and hard-cutting.
	boundarySearchWindow = 800
)

type Chunk struct {
	Index     int
	Text      string
	CharStart int
	CharEnd   int
}

type SplitOptions struct {
	// TargetChars is the ideal size of each chunk, in characters.
	TargetChars int
	// OverlapChars is how much of the tail of a chunk is repeated at the
	// start of the next one, so a card whose source material straddles a
	// cut point isn't lost. This intentionally creates near-duplicate
	// content near chunk boundaries — see pkg/dedupe for the cleanup step.
	OverlapChars int
	// MaxChunks guards against pathologically large documents silently
	// spawning an unbounded number of jobs.
	MaxChunks int
}

func DefaultSplitOptions() SplitOptions {
	return SplitOptions{
		TargetChars:  DefaultTargetChars,
		OverlapChars: DefaultOverlapChars,
		MaxChunks:    DefaultMaxChunks,
	}
}

func (o SplitOptions) withDefaults() SplitOptions {
	if o.TargetChars <= 0 {
		o.TargetChars = DefaultTargetChars
	}
	if o.OverlapChars < 0 || o.OverlapChars >= o.TargetChars {
		o.OverlapChars = DefaultOverlapChars
	}
	if o.MaxChunks <= 0 {
		o.MaxChunks = DefaultMaxChunks
	}
	return o
}

// Split divides text into Chunks according to opts. Empty/whitespace-only
// input returns an error — callers should validate before enqueuing a job.
func Split(text string, opts SplitOptions) ([]Chunk, error) {
	opts = opts.withDefaults()

	if strings.TrimSpace(text) == "" {
		return nil, fmt.Errorf("documento vazio")
	}

	if len(text) <= opts.TargetChars {
		return []Chunk{{Index: 0, Text: text, CharStart: 0, CharEnd: len(text)}}, nil
	}

	var chunks []Chunk
	start := 0
	for start < len(text) {
		end := start + opts.TargetChars
		if end >= len(text) {
			end = len(text)
		} else {
			end = findBoundary(text, start, end)
		}

		chunks = append(chunks, Chunk{
			Index:     len(chunks),
			Text:      text[start:end],
			CharStart: start,
			CharEnd:   end,
		})

		if len(chunks) > opts.MaxChunks {
			return nil, fmt.Errorf("documento muito grande (mais de %d partes); considere dividir o material em documentos menores", opts.MaxChunks)
		}

		if end >= len(text) {
			break
		}

		// Next chunk starts a bit before this one ended (overlap), but must
		// always make forward progress to avoid looping forever on
		// pathological input (e.g. OverlapChars close to TargetChars).
		nextStart := snapToRuneBoundary(text, end-opts.OverlapChars)
		if nextStart <= start {
			nextStart = snapForward(text, start+1)
		}
		start = nextStart
	}

	return chunks, nil
}

// findBoundary looks backward from `end` (within boundarySearchWindow) for
// a natural cut point: page marker > paragraph break > sentence end.
// Falls back to a hard cut at `end` if none is found.
func findBoundary(text string, start, end int) int {
	windowStart := end - boundarySearchWindow
	if windowStart < start {
		windowStart = start
	}
	window := text[windowStart:end]

	if i := strings.LastIndex(window, PageMarker); i >= 0 {
		return windowStart + i
	}
	if i := strings.LastIndex(window, "\n\n"); i >= 0 {
		return windowStart + i + 2
	}
	if i := strings.LastIndex(window, ". "); i >= 0 {
		return windowStart + i + 2
	}
	// Hard cut: no natural boundary found. This is an arbitrary byte offset
	// that may land inside a multi-byte UTF-8 character (accented Portuguese
	// text is full of them) — snap it back to a valid rune boundary so the
	// stored chunk text is never invalid UTF-8.
	return snapToRuneBoundary(text, end)
}

// snapToRuneBoundary walks backward from i to the nearest valid UTF-8 rune
// boundary. A byte-offset chunk cut can otherwise split a multi-byte
// character in half, which Postgres rejects as invalid UTF-8 on insert.
func snapToRuneBoundary(text string, i int) int {
	if i <= 0 {
		return 0
	}
	if i >= len(text) {
		return len(text)
	}
	for i > 0 && !utf8.RuneStart(text[i]) {
		i--
	}
	return i
}

// snapForward walks forward from i to the next valid UTF-8 rune boundary.
// Used only for the forced-progress fallback, where snapping backward could
// land on the same index and stall the loop.
func snapForward(text string, i int) int {
	if i <= 0 {
		return 0
	}
	if i >= len(text) {
		return len(text)
	}
	for i < len(text) && !utf8.RuneStart(text[i]) {
		i++
	}
	return i
}
