package usecases

import (
	"strings"
	"testing"

	"github.com/approva-cards/back-aprova-cards/pkg/anthropic"
)

func cardsFor(dispositivos ...string) []anthropic.GeneratedCard {
	out := make([]anthropic.GeneratedCard, len(dispositivos))
	for i, d := range dispositivos {
		out[i] = anthropic.GeneratedCard{Front: "f" + d, Back: "b", Dispositivo: d}
	}
	return out
}

func TestPlanComplement_FullCoverageSkipsFollowUp(t *testing.T) {
	ids := []string{"Art. 5", "Art. 5, I", "Art. 5, II"}
	plan := planComplement(cardsFor("Art. 5º, inciso I", "Art. 5º, II"), ids, 10, false)
	if plan.needed {
		t.Errorf("expected no follow-up, got %+v", plan)
	}
}

func TestPlanComplement_SingleGapIsTolerated(t *testing.T) {
	ids := []string{"Art. 5, I", "Art. 5, II"}
	if plan := planComplement(cardsFor("Art. 5, I"), ids, 10, false); plan.needed {
		t.Errorf("one missing dispositivo should not trigger a follow-up, got %+v", plan)
	}
}

func TestPlanComplement_LazyPassTargetsMissingDispositivos(t *testing.T) {
	ids := []string{"Art. 5, I", "Art. 5, II", "Art. 5, III", "Art. 6"}
	plan := planComplement(cardsFor("Art. 5, I"), ids, 10, false)
	if !plan.needed {
		t.Fatal("expected follow-up")
	}
	if got := strings.Join(plan.missing, "|"); got != "Art. 5, II|Art. 5, III|Art. 6" {
		t.Errorf("missing = %q", got)
	}
	if plan.budget != 6 {
		t.Errorf("budget = %d, want 2 per gap = 6", plan.budget)
	}
}

func TestPlanComplement_UserCeilingCapsBudget(t *testing.T) {
	ids := []string{"Art. 1", "Art. 2", "Art. 3", "Art. 4"}
	plan := planComplement(cardsFor("Art. 1"), ids, 3, true)
	if !plan.needed || plan.budget != 2 {
		t.Errorf("expected budget limited to room under ceiling (2), got %+v", plan)
	}
	if plan := planComplement(cardsFor("Art. 1", "Art. 1", "Art. 1"), ids, 3, true); plan.needed {
		t.Errorf("ceiling already reached, expected no follow-up, got %+v", plan)
	}
}

func TestPlanComplement_NonLegalTextUsesCardCount(t *testing.T) {
	if plan := planComplement(cardsFor("", "", ""), nil, 10, false); !plan.needed || plan.budget != 7 {
		t.Errorf("3 of 10 should trigger a follow-up for 7, got %+v", plan)
	}
	if plan := planComplement(cardsFor("", "", "", "", "", ""), nil, 10, false); plan.needed {
		t.Errorf("6 of 10 is enough, got %+v", plan)
	}
}

func TestNaturalCardLimit_DispositivoCountRaisesEstimate(t *testing.T) {
	var sb strings.Builder
	sb.WriteString("Art. 5º São requisitos:")
	for _, r := range []string{"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"} {
		sb.WriteString(" " + r + " - requisito;")
	}
	// 13 dispositivos in a few hundred chars: the density heuristic alone
	// would give the minimum.
	if got := naturalCardLimit(sb.String()); got != 13 {
		t.Errorf("naturalCardLimit = %d, want 13", got)
	}
}

func TestApplyRemovals(t *testing.T) {
	cards := cardsFor("a", "b", "c", "d", "e")

	kept, reviewErr := applyRemovals(cards, []int{2, 2, 9, 0, 4})
	if reviewErr != "" {
		t.Fatalf("unexpected reviewErr %q", reviewErr)
	}
	var got []string
	for _, c := range kept {
		got = append(got, c.Dispositivo)
	}
	if strings.Join(got, "") != "ace" {
		t.Errorf("kept = %v, want a c e", got)
	}

	kept, reviewErr = applyRemovals(cards, []int{1, 2, 3})
	if reviewErr == "" || len(kept) != len(cards) {
		t.Errorf("removing 3 of 5 should be rejected, got %d cards, err %q", len(kept), reviewErr)
	}
}
