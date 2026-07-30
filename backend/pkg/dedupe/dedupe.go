// Package dedupe collapses near-duplicate flashcards produced by the
// map-reduce generation pipeline. Overlapping chunk text (see pkg/chunker)
// deliberately causes adjacent chunks to generate near-identical cards near
// their boundaries — this is a cheap, non-LLM cleanup pass that runs before
// the reviewer LLM call, so tokens aren't spent asking a model to spot
// duplicates a simple text comparison already catches.
package dedupe

import (
	"strings"

	"github.com/approva-cards/back-aprova-cards/pkg/anthropic"
)

// DefaultThreshold is the Jaccard similarity (0..1) above which two cards'
// fronts are considered duplicates.
const DefaultThreshold = 0.85

// Dedupe returns cards with near-duplicates removed, keeping the first
// occurrence of each. Comparison is based on the "front" field only —
// two cards asking the same question in slightly different words are
// exactly the kind of boundary-overlap duplicate this is meant to catch.
func Dedupe(cards []anthropic.GeneratedCard, threshold float64) []anthropic.GeneratedCard {
	if threshold <= 0 {
		threshold = DefaultThreshold
	}

	kept := make([]anthropic.GeneratedCard, 0, len(cards))
	keptWords := make([]map[string]struct{}, 0, len(cards))

	for _, card := range cards {
		words := wordSet(card.Front)
		isDuplicate := false
		for _, existing := range keptWords {
			if jaccard(words, existing) >= threshold {
				isDuplicate = true
				break
			}
		}
		if !isDuplicate {
			kept = append(kept, card)
			keptWords = append(keptWords, words)
		}
	}

	return kept
}

func wordSet(s string) map[string]struct{} {
	s = strings.ToLower(s)
	fields := strings.FieldsFunc(s, func(r rune) bool {
		return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9') && r != 'á' && r != 'à' && r != 'â' && r != 'ã' &&
			r != 'é' && r != 'ê' && r != 'í' && r != 'ó' && r != 'ô' && r != 'õ' && r != 'ú' && r != 'ü' && r != 'ç'
	})
	set := make(map[string]struct{}, len(fields))
	for _, f := range fields {
		if f != "" {
			set[f] = struct{}{}
		}
	}
	return set
}

func jaccard(a, b map[string]struct{}) float64 {
	if len(a) == 0 && len(b) == 0 {
		return 1
	}
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	intersection := 0
	for w := range a {
		if _, ok := b[w]; ok {
			intersection++
		}
	}
	union := len(a) + len(b) - intersection
	return float64(intersection) / float64(union)
}
