package chunker

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestSplit_SmallDocReturnsSingleChunk(t *testing.T) {
	text := "Um documento curto sobre direito administrativo."
	chunks, err := Split(text, DefaultSplitOptions())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(chunks) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(chunks))
	}
	if chunks[0].Text != text {
		t.Fatalf("expected chunk text to equal input, got %q", chunks[0].Text)
	}
}

func TestSplit_EmptyDocReturnsError(t *testing.T) {
	if _, err := Split("   \n  ", DefaultSplitOptions()); err == nil {
		t.Fatal("expected error for empty document")
	}
}

func TestSplit_LargeDocSplitsIntoMultipleChunksWithOverlap(t *testing.T) {
	// Build ~50k chars of paragraph-separated filler text.
	var sb strings.Builder
	paragraph := strings.Repeat("lorem ipsum dolor sit amet consectetur adipiscing elit. ", 20)
	for i := 0; i < 50; i++ {
		sb.WriteString(paragraph)
		sb.WriteString("\n\n")
	}
	text := sb.String()

	opts := SplitOptions{TargetChars: 5000, OverlapChars: 200, MaxChunks: 30}
	chunks, err := Split(text, opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(chunks) < 2 {
		t.Fatalf("expected multiple chunks, got %d", len(chunks))
	}
	for i, c := range chunks {
		if c.Index != i {
			t.Errorf("chunk %d has wrong Index %d", i, c.Index)
		}
		if c.Text == "" {
			t.Errorf("chunk %d is empty", i)
		}
	}
	// Overlap: chunk i+1 should start before chunk i ends.
	for i := 0; i < len(chunks)-1; i++ {
		if chunks[i+1].CharStart >= chunks[i].CharEnd {
			t.Errorf("expected overlap between chunk %d and %d, got starts %d/%d ends %d",
				i, i+1, chunks[i].CharStart, chunks[i+1].CharStart, chunks[i].CharEnd)
		}
	}
	// Last chunk must reach the end of the document.
	if chunks[len(chunks)-1].CharEnd != len(text) {
		t.Errorf("last chunk should reach end of document, got CharEnd=%d, want %d", chunks[len(chunks)-1].CharEnd, len(text))
	}
}

func TestSplit_PrefersPageMarkerBoundary(t *testing.T) {
	page := strings.Repeat("a", 4000)
	text := page + PageMarker + " 1]]" + page + PageMarker + " 2]]" + page

	opts := SplitOptions{TargetChars: 4200, OverlapChars: 100, MaxChunks: 10}
	chunks, err := Split(text, opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(chunks) < 2 {
		t.Fatalf("expected multiple chunks, got %d", len(chunks))
	}
	if chunks[0].CharEnd != len(page) {
		t.Errorf("expected first cut to land exactly at the page marker (offset %d), got CharEnd=%d", len(page), chunks[0].CharEnd)
	}
}

func TestSplit_MaxChunksGuardTriggersOnPathologicalInput(t *testing.T) {
	// No punctuation/paragraph/page-marker boundaries at all, forcing many
	// small hard-cut chunks against a tiny MaxChunks.
	text := strings.Repeat("x", 100000)
	opts := SplitOptions{TargetChars: 1000, OverlapChars: 50, MaxChunks: 5}

	_, err := Split(text, opts)
	if err == nil {
		t.Fatal("expected MaxChunks guard error, got nil")
	}
}

func TestSplit_NeverSplitsMidRune(t *testing.T) {
	// Dense multi-byte Portuguese text with no paragraph/sentence/page
	// boundaries near the target cut points, forcing the hard-cut fallback
	// to land inside a multi-byte character unless boundaries are snapped.
	word := "administração ética pública é dever cortês àquém"
	text := strings.Repeat(word+" ", 2000)

	// Sweep target sizes so at least some hard cuts land mid-rune if the
	// snapping logic regresses.
	for _, target := range []int{997, 1001, 1500, 3333, 4999} {
		opts := SplitOptions{TargetChars: target, OverlapChars: 50, MaxChunks: 500}
		chunks, err := Split(text, opts)
		if err != nil {
			t.Fatalf("target=%d: unexpected error: %v", target, err)
		}
		for _, c := range chunks {
			if !utf8.ValidString(c.Text) {
				t.Fatalf("target=%d: chunk %d is not valid UTF-8: %q", target, c.Index, c.Text)
			}
		}
	}
}
