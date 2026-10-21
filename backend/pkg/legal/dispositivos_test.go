package legal

import (
	"reflect"
	"testing"
)

// Mimics pdf.js output: runs joined by spaces, no reliable line breaks.
const sampleLei = `CAPÍTULO I DISPOSIÇÕES GERAIS Art. 1º Esta Lei dispõe sobre o regime jurídico. ` +
	`Art. 5º São requisitos básicos para investidura: I - a nacionalidade brasileira; ` +
	`II - o gozo dos direitos políticos; III - a quitação com as obrigações militares: ` +
	`a) para homens; b) quando exigido; IV - a idade mínima de dezoito anos. ` +
	`§ 1º As atribuições do cargo podem justificar outros requisitos, nos termos do § 2º do art. 37. ` +
	`§ 2º Às pessoas portadoras de deficiência é assegurado o direito de se inscrever. ` +
	`Art. 12-A O prazo é de 30 (trinta) dias, conforme o inciso II do caput. Parágrafo único. O prazo pode ser prorrogado. ` +
	`Art. 1.228. O proprietário tem a faculdade de usar a coisa.`

func TestExtract_BuildsHierarchyAndSkipsCrossReferences(t *testing.T) {
	got := Extract(sampleLei)
	want := []string{
		"Art. 1",
		"Art. 5",
		"Art. 5, I",
		"Art. 5, II",
		"Art. 5, III",
		"Art. 5, III, a",
		"Art. 5, III, b",
		"Art. 5, IV",
		"Art. 5, § 1",
		"Art. 5, § 2",
		"Art. 12-A",
		"Art. 12-A, parágrafo único",
		"Art. 1228",
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Extract mismatch\n got: %q\nwant: %q", got, want)
	}
}

func TestExtract_DashAfterArticleIsNotASuffix(t *testing.T) {
	got := Extract("Art. 3º - O servidor tomará posse.")
	if want := []string{"Art. 3"}; !reflect.DeepEqual(got, want) {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestExtract_IgnoresUnitsBeforeFirstArticle(t *testing.T) {
	// A chunk that starts mid-article: orphan incisos can't be named.
	got := Extract("; II - o gozo dos direitos; III - a quitação. Art. 6º O provimento.")
	if want := []string{"Art. 6"}; !reflect.DeepEqual(got, want) {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestExtract_PlainTextHasNoDispositivos(t *testing.T) {
	if got := Extract("A fotossíntese ocorre nos cloroplastos. Ela depende de luz."); len(got) != 0 {
		t.Errorf("expected none, got %q", got)
	}
}

func TestNormalize_EquivalentCitationsMatch(t *testing.T) {
	cases := [][2]string{
		{"Art. 5, III", "Art. 5º, inciso III"},
		{"Art. 5, § 1", "art. 5º, § 1º"},
		{"Art. 12-A, parágrafo único", "Art. 12-A, Parágrafo Único"},
		{"Art. 5, III, a", "Art. 5º, III, alínea a"},
		{"Art. 1228", "Art. 1.228"},
	}
	for _, c := range cases {
		if Normalize(c[0]) != Normalize(c[1]) {
			t.Errorf("Normalize(%q)=%q != Normalize(%q)=%q", c[0], Normalize(c[0]), c[1], Normalize(c[1]))
		}
	}
	if Normalize("Art. 5, V") == Normalize("Art. 5") {
		t.Error("inciso V must not collapse into the article")
	}
}

func TestUncovered_ChildCitationCoversAncestors(t *testing.T) {
	ids := []string{"Art. 5", "Art. 5, I", "Art. 5, II", "Art. 5, § 1", "Art. 6"}
	cited := []string{"Art. 5º, inciso I", "Art. 5º, § 1º", ""}

	got := Uncovered(ids, cited)
	want := []string{"Art. 5, II", "Art. 6"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestUncovered_PrefixDoesNotMatchDifferentNumber(t *testing.T) {
	// "Art. 50" must not count as covering "Art. 5".
	got := Uncovered([]string{"Art. 5"}, []string{"Art. 50"})
	if len(got) != 1 {
		t.Errorf("expected Art. 5 uncovered, got %q", got)
	}
}
