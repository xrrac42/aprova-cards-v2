// Package legal extracts the structural units of Brazilian legislation
// (artigos, parágrafos, incisos, alíneas) from plain text so the generation
// pipeline can check, deterministically and without an extra LLM pass,
// whether the model actually covered every dispositivo in a chunk.
//
// Input comes from pdf.js text extraction, which joins text runs with spaces
// and loses most line breaks — so headings are recognised by shape plus the
// character that precedes them (start of text or a sentence/list terminator),
// not by line position. That is also what separates a heading ("…prazo. § 1º
// O servidor…") from a cross-reference ("na forma do § 1º").
package legal

import (
	"fmt"
	"regexp"
	"strings"
)

var (
	headingRe = regexp.MustCompile(
		`(?P<art>\bArt\.?\s*(?P<artnum>\d{1,3}(?:\.\d{3})*)\s*[º°o]?(?:-(?P<artsuf>[A-Z])\b)?)` +
			`|(?P<par>§\s*(?P<parnum>\d+)\s*[º°o]?|(?i:par[áa]grafo\s+[úu]nico))` +
			`|(?P<inc>\b(?P<incnum>[IVXLC]+)\s*[-–—]\s)` +
			`|(?P<ali>\b(?P<alinum>[a-z])\)\s)`,
	)
	romanRe = regexp.MustCompile(`^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$`)

	groupIdx = func() map[string]int {
		m := map[string]int{}
		for i, n := range headingRe.SubexpNames() {
			if n != "" {
				m[n] = i
			}
		}
		return m
	}()
)

// Extract returns the IDs of every dispositivo found in text, in document
// order and without duplicates, e.g. "Art. 5", "Art. 5, § 1", "Art. 5, III",
// "Art. 5, III, a", "Art. 7, parágrafo único". Units that appear before the
// first article heading (a chunk that starts mid-article) are skipped: their
// parent can't be named reliably.
func Extract(text string) []string {
	var (
		ids                    []string
		seen                   = map[string]bool{}
		curArt, curPar, curInc string
	)
	add := func(id string) {
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}

	for _, m := range headingRe.FindAllStringSubmatchIndex(text, -1) {
		group := func(name string) string {
			i := groupIdx[name]
			if m[2*i] < 0 {
				return ""
			}
			return text[m[2*i]:m[2*i+1]]
		}
		// Capitalised "Art." is always a heading: LC 95/98 drafting writes
		// cross-references in lowercase ("art. 5º"), and an article often
		// follows a chapter title with no terminator ("DISPOSIÇÕES GERAIS
		// Art. 1º"). Every other unit needs the positional check.
		if group("art") == "" && !isHeadingPosition(text, m[0]) {
			continue
		}

		switch {
		case group("art") != "":
			curArt = "Art. " + strings.ReplaceAll(group("artnum"), ".", "")
			if suf := group("artsuf"); suf != "" {
				curArt += "-" + suf
			}
			curPar, curInc = "", ""
			add(curArt)
		case group("par") != "":
			if curArt == "" {
				continue
			}
			if n := group("parnum"); n != "" {
				curPar = "§ " + n
			} else {
				curPar = "parágrafo único"
			}
			curInc = ""
			add(curArt + ", " + curPar)
		case group("inc") != "":
			num := group("incnum")
			if curArt == "" || !romanRe.MatchString(num) {
				continue
			}
			curInc = num
			add(join(curArt, curPar, curInc))
		case group("ali") != "":
			if curArt == "" || curInc == "" {
				continue
			}
			add(join(curArt, curPar, curInc, group("alinum")))
		}
	}
	return ids
}

// isHeadingPosition reports whether a match starting at pos sits where a
// heading can start: beginning of text, or right after a terminator. A word
// before it ("nos termos do § 1º", "inciso II do caput") means it is a
// cross-reference, not a new dispositivo.
func isHeadingPosition(text string, pos int) bool {
	prev := strings.TrimRight(text[:pos], " \t\r\n")
	if prev == "" {
		return true
	}
	switch prev[len(prev)-1] {
	case '.', ';', ':', ']', ')':
		return true
	}
	return false
}

func join(parts ...string) string {
	var out []string
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, ", ")
}

var (
	ordinalRe  = regexp.MustCompile(`(\d)\s*[º°o]\b|(\d)\s*[º°]`)
	thousandRe = regexp.MustCompile(`(\d)\.(\d{3})`)
	artRe      = regexp.MustCompile(`\bart(igo)?\.?\s*(\d)`)
	noiseRe    = regexp.MustCompile(`\b(art(igo)?|inciso|incisos|al[íi]nea|caput|do|da|de)\b\.?`)
	spaceRe    = regexp.MustCompile(`[\s.]+`)
)

// Normalize maps the many ways a model may cite a dispositivo ("Art. 5º,
// inciso III", "art. 5, III", "Art. 5º, § 1º") to one comparable key.
func Normalize(id string) string {
	s := strings.ToLower(strings.TrimSpace(id))
	s = thousandRe.ReplaceAllString(s, "$1$2")
	s = ordinalRe.ReplaceAllString(s, "$1$2")
	s = strings.NewReplacer(
		"parágrafo único", "pu", "paragrafo unico", "pu", "parágrafo unico", "pu", "par. único", "pu",
		"§", "p",
	).Replace(s)
	// Keep the article marker distinct from the number so "Art. 5" and
	// "inciso V" can't collide, then drop the remaining filler words.
	s = artRe.ReplaceAllString(s, "a$2")
	s = noiseRe.ReplaceAllString(s, "")
	s = spaceRe.ReplaceAllString(s, "")
	return strings.Trim(s, ",")
}

// Uncovered returns the dispositivos in ids that no cited reference covers.
// A citation covers its own dispositivo and every ancestor of it, so an
// article whose incisos all have cards counts as covered even if no card
// cites its caput (which is often just "São direitos:").
func Uncovered(ids, cited []string) []string {
	keys := make([]string, 0, len(cited))
	for _, c := range cited {
		for _, part := range strings.Split(c, ";") {
			if k := Normalize(part); k != "" {
				keys = append(keys, k)
			}
		}
	}

	var missing []string
	for _, id := range ids {
		want := Normalize(id)
		covered := false
		for _, k := range keys {
			if k == want || strings.HasPrefix(k, want+",") {
				covered = true
				break
			}
		}
		if !covered {
			missing = append(missing, id)
		}
	}
	return missing
}

// FormatChecklist renders ids as a numbered list for the prompt.
func FormatChecklist(ids []string) string {
	var sb strings.Builder
	for i, id := range ids {
		fmt.Fprintf(&sb, "%d. %s\n", i+1, id)
	}
	return sb.String()
}
