package dedupe

import (
	"testing"

	"github.com/approva-cards/back-aprova-cards/pkg/anthropic"
)

func TestDedupe_CollapsesNearIdenticalFronts(t *testing.T) {
	cards := []anthropic.GeneratedCard{
		{Front: "O que é o princípio da legalidade?", Back: "A"},
		{Front: "O que é o princípio da legalidade ?", Back: "B"}, // near-duplicate boundary overlap
		{Front: "O que é o princípio da impessoalidade?", Back: "C"},
	}

	result := Dedupe(cards, DefaultThreshold)

	if len(result) != 2 {
		t.Fatalf("expected 2 cards after dedupe, got %d: %+v", len(result), result)
	}
	if result[0].Back != "A" {
		t.Errorf("expected first occurrence to be kept, got Back=%q", result[0].Back)
	}
}

func TestDedupe_KeepsDistinctFronts(t *testing.T) {
	cards := []anthropic.GeneratedCard{
		{Front: "Qual é a capital do Brasil?", Back: "Brasília"},
		{Front: "Qual é a capital da França?", Back: "Paris"},
		{Front: "Quantos poderes compõem a República?", Back: "Três"},
	}

	result := Dedupe(cards, DefaultThreshold)

	if len(result) != len(cards) {
		t.Fatalf("expected all %d distinct cards to be kept, got %d", len(cards), len(result))
	}
}

func TestDedupe_EmptyInput(t *testing.T) {
	result := Dedupe(nil, DefaultThreshold)
	if len(result) != 0 {
		t.Fatalf("expected empty result, got %d", len(result))
	}
}
