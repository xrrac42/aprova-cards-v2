package usecases

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/anthropic"
	"github.com/approva-cards/back-aprova-cards/pkg/chunker"
	"github.com/approva-cards/back-aprova-cards/pkg/dedupe"
	"github.com/approva-cards/back-aprova-cards/pkg/legal"
	"gorm.io/datatypes"
)

const (
	// D4: cards per chunk scale with how much source text that chunk holds,
	// instead of a single fixed cap that made sense only for one big call.
	charsPerCard     = 1000
	minCardsPerChunk = 5
	maxCardsPerChunk = 30

	// absoluteMaxTotalCards is a safety valve for pathologically large
	// documents, not a target — see proportionalCardLimits.
	absoluteMaxTotalCards = 400

	// sampleLimit mirrors the frontend's "Testar Amostra" button, which
	// sends limit=1 to request one quick preview card.
	sampleLimit = 1

	// maxCardsForReviewer bounds the reviewer LLM call's input size; above
	// this the deduplicated (unreviewed) set is used directly. The reviewer
	// answers with indices only, so its latency barely grows with the list.
	maxCardsForReviewer = 250

	// maxReviewRemovalRatio rejects a review that would drop more than this
	// share of the cards — far more likely a misread list than real curation.
	maxReviewRemovalRatio = 0.5

	// maxChecklistItems bounds the dispositivos listed in the first-pass
	// prompt so that pass fits in max_tokens; anything beyond it is still
	// checked for coverage and goes to the follow-up pass.
	maxChecklistItems = 35

	// Anti-laziness follow-up (see planComplement). It runs at most once per
	// chunk, only when the first pass left a measurable gap, and reuses the
	// cached chunk text — so its cost is paid only where it adds cards.
	minUncoveredForComplement = 2
	maxComplementCards        = 25
	// underGenerationRatio: for non-legal text (no dispositivos to check),
	// a first pass below this share of the chunk's estimated potential is
	// treated as under-generation.
	underGenerationRatio = 0.6
)

// JobEnqueuer decouples the usecase layer from River's generic client types.
// Implemented by an adapter in pkg/jobs.
type JobEnqueuer interface {
	EnqueueChunks(ctx context.Context, jobID string, chunkIDs []string) error
	EnqueueReduce(ctx context.Context, jobID string) error
}

type GenerationUseCase interface {
	StartJob(ctx context.Context, disciplineID string, req *dto.GenerateCardsRequest) (*dto.GenerationJobResponse, error)
	GetStatus(ctx context.Context, jobID string) (*dto.GenerationJobStatusResponse, error)
	// ProcessChunk and RunReduce are called by River workers (pkg/jobs).
	ProcessChunk(ctx context.Context, jobID, chunkID string, attempt, maxAttempts int) error
	RunReduce(ctx context.Context, jobID string) error
}

type generationUseCase struct {
	jobRepo   repositories.GenerationJobRepository
	chunkRepo repositories.GenerationChunkRepository
	discRepo  repositories.DisciplineRepository
	ai        *anthropic.Client
	enqueuer  JobEnqueuer
}

func NewGenerationUseCase(
	jobRepo repositories.GenerationJobRepository,
	chunkRepo repositories.GenerationChunkRepository,
	discRepo repositories.DisciplineRepository,
	ai *anthropic.Client,
	enqueuer JobEnqueuer,
) GenerationUseCase {
	return &generationUseCase{jobRepo: jobRepo, chunkRepo: chunkRepo, discRepo: discRepo, ai: ai, enqueuer: enqueuer}
}

// StartJob splits the document, persists the job + chunk rows, and enqueues
// one River job per chunk. It never calls the LLM directly and must return
// fast — this is what lets the HTTP handler answer 202 immediately instead
// of blocking on generation.
func (uc *generationUseCase) StartJob(ctx context.Context, disciplineID string, req *dto.GenerateCardsRequest) (*dto.GenerationJobResponse, error) {
	if uc.ai == nil {
		return nil, errors.New("geração com IA não configurada (defina OPENAI_API_KEY)")
	}
	if _, err := uc.discRepo.GetByID(disciplineID); err != nil {
		return nil, errors.New("disciplina não encontrada")
	}

	text := strings.TrimSpace(req.Context)
	chunks, err := chunker.Split(text, chunker.DefaultSplitOptions())
	if err != nil {
		return nil, err
	}

	// "Testar Amostra" sends Limit==1 — keep it cheap by only processing the
	// first chunk instead of fanning out across the whole document.
	if req.Limit == sampleLimit && len(chunks) > 1 {
		chunks = chunks[:1]
	}

	limits := proportionalCardLimits(chunks, req.Limit)

	job := &models.GenerationJob{
		DisciplineID:    disciplineID,
		Status:          models.GenerationJobStatusPending,
		Archetype:       req.Archetype,
		Preset:          req.Preset,
		RegraDeOuro:     req.RegraDeOuro,
		SourceCharCount: len(text),
		TotalChunks:     len(chunks),
	}
	if err := uc.jobRepo.Create(job); err != nil {
		return nil, fmt.Errorf("erro ao criar job de geração: %w", err)
	}

	chunkModels := make([]models.GenerationChunk, len(chunks))
	for i, ch := range chunks {
		chunkModels[i] = models.GenerationChunk{
			JobID:      job.ID,
			ChunkIndex: ch.Index,
			ChunkText:  ch.Text,
			CharStart:  ch.CharStart,
			CharEnd:    ch.CharEnd,
			CardLimit:  limits[i],
			Status:     models.GenerationChunkStatusPending,
		}
	}
	if err := uc.chunkRepo.CreateBatch(chunkModels); err != nil {
		_ = uc.jobRepo.SetFailed(job.ID, "erro ao preparar partes do documento")
		return nil, fmt.Errorf("erro ao preparar partes do documento: %w", err)
	}

	chunkIDs := make([]string, len(chunkModels))
	for i, cm := range chunkModels {
		chunkIDs[i] = cm.ID
	}
	if err := uc.enqueuer.EnqueueChunks(ctx, job.ID, chunkIDs); err != nil {
		_ = uc.jobRepo.SetFailed(job.ID, "falha ao enfileirar processamento")
		return nil, fmt.Errorf("erro ao enfileirar processamento: %w", err)
	}

	if err := uc.jobRepo.UpdateStatus(job.ID, models.GenerationJobStatusProcessing); err != nil {
		return nil, err
	}

	return &dto.GenerationJobResponse{
		JobID:       job.ID,
		Status:      models.GenerationJobStatusProcessing,
		TotalChunks: len(chunks),
	}, nil
}

func (uc *generationUseCase) GetStatus(ctx context.Context, jobID string) (*dto.GenerationJobStatusResponse, error) {
	job, err := uc.jobRepo.GetByID(jobID)
	if err != nil {
		return nil, err
	}

	progress := 0
	if job.TotalChunks > 0 {
		progress = job.CompletedChunks * 100 / job.TotalChunks
	}

	resp := &dto.GenerationJobStatusResponse{
		JobID:           job.ID,
		Status:          job.Status,
		TotalChunks:     job.TotalChunks,
		CompletedChunks: job.CompletedChunks,
		ProgressPct:     progress,
		Error:           job.Error,
	}

	if job.Status == models.GenerationJobStatusCompleted && len(job.Result) > 0 {
		var result dto.PreviewCardsResponse
		if err := json.Unmarshal(job.Result, &result); err == nil {
			resp.Result = &result
		}
	}

	return resp, nil
}

// ProcessChunk generates cards for a single chunk. On a transient error
// with retries remaining it returns the error so River retries the job;
// otherwise (success, or a permanent/retries-exhausted failure) it records
// the terminal state and — if this was the last chunk to finish — claims
// and enqueues the reduce step.
func (uc *generationUseCase) ProcessChunk(ctx context.Context, jobID, chunkID string, attempt, maxAttempts int) error {
	if err := uc.chunkRepo.MarkProcessing(chunkID, attempt); err != nil {
		return err
	}

	chunk, err := uc.chunkRepo.GetByID(chunkID)
	if err != nil {
		return err
	}
	job, err := uc.jobRepo.GetByID(jobID)
	if err != nil {
		return err
	}
	disc, err := uc.discRepo.GetByID(job.DisciplineID)
	if err != nil {
		return err
	}

	system := buildSystemPrompt(&dto.GenerateCardsRequest{
		Archetype:   job.Archetype,
		Preset:      job.Preset,
		RegraDeOuro: job.RegraDeOuro,
	})

	cards, genErr := uc.generateChunkCards(ctx, system, disc.Name, chunk, job.TotalChunks)

	terminal := true
	if genErr != nil {
		_ = uc.chunkRepo.MarkFailed(chunkID, genErr.Error(), attempt)
		if anthropic.IsTransient(genErr) && attempt < maxAttempts {
			terminal = false // let River retry — don't count this chunk as done yet
		}
	} else {
		cardsJSON, marshalErr := json.Marshal(cards)
		if marshalErr != nil {
			_ = uc.chunkRepo.MarkFailed(chunkID, marshalErr.Error(), attempt)
		} else {
			_ = uc.chunkRepo.MarkCompleted(chunkID, datatypes.JSON(cardsJSON), attempt)
		}
	}

	if !terminal {
		return genErr
	}

	completed, total, err := uc.jobRepo.IncrementCompletedChunks(jobID)
	if err != nil {
		return err
	}
	if total > 0 && completed >= total {
		if claimed, err := uc.jobRepo.TryClaimReduce(jobID); err == nil && claimed {
			return uc.enqueuer.EnqueueReduce(ctx, jobID)
		}
	}
	return nil
}

// RunReduce merges every completed chunk's cards, deduplicates near-identical
// entries created by chunk overlap, and runs a final reviewer pass. Reviewer
// failure never fails the job — it falls back to the deduplicated set.
func (uc *generationUseCase) RunReduce(ctx context.Context, jobID string) error {
	if err := uc.jobRepo.UpdateStatus(jobID, models.GenerationJobStatusReducing); err != nil {
		return err
	}

	completedChunks, err := uc.chunkRepo.GetCompletedByJobID(jobID)
	if err != nil {
		return err
	}
	if len(completedChunks) == 0 {
		return uc.jobRepo.SetFailed(jobID, "todos os trechos do documento falharam ao gerar cards")
	}

	var merged []anthropic.GeneratedCard
	for _, c := range completedChunks {
		if len(c.Cards) == 0 {
			continue
		}
		var cards []anthropic.GeneratedCard
		if err := json.Unmarshal(c.Cards, &cards); err != nil {
			continue
		}
		merged = append(merged, cards...)
	}

	deduped := dedupe.Dedupe(merged, dedupe.DefaultThreshold)

	job, err := uc.jobRepo.GetByID(jobID)
	if err != nil {
		return err
	}
	disc, err := uc.discRepo.GetByID(job.DisciplineID)
	if err != nil {
		return err
	}

	final := deduped
	reviewErr := ""
	if len(deduped) > 1 && len(deduped) <= maxCardsForReviewer {
		if err := uc.jobRepo.UpdateStatus(jobID, models.GenerationJobStatusReviewing); err != nil {
			return err
		}
		system, user := buildReviewerPrompt(disc.Name, deduped)
		remove, err := uc.ai.SelectCardsToRemove(ctx, system, user)
		if err != nil {
			reviewErr = err.Error()
		} else {
			final, reviewErr = applyRemovals(deduped, remove)
		}
	} else if len(deduped) > maxCardsForReviewer {
		reviewErr = "revisão final omitida para reduzir latência; conjunto deduplicado entregue diretamente"
	}

	previewCards := make([]dto.PreviewCard, 0, len(final))
	for _, c := range final {
		if strings.TrimSpace(c.Front) == "" || strings.TrimSpace(c.Back) == "" {
			continue
		}
		tags := c.TopicTags
		if tags == nil {
			tags = []string{}
		}
		previewCards = append(previewCards, dto.PreviewCard{
			ID:         fmt.Sprintf("%d", len(previewCards)+1),
			Front:      c.Front,
			Back:       c.Back,
			TopicTags:  tags,
			Difficulty: c.Difficulty,
		})
	}

	resultJSON, err := json.Marshal(dto.PreviewCardsResponse{Cards: previewCards, Generated: len(previewCards)})
	if err != nil {
		return err
	}

	return uc.jobRepo.SetResult(jobID, datatypes.JSON(resultJSON), reviewErr)
}

// proportionalCardLimits computes a per-chunk card limit sized to that
// chunk's share of the source text (D4): a short document naturally yields
// fewer cards, a long one more — without needing one big single-call limit.
// requestedTotal (the existing "Limite de cards" field) is honored as a
// ceiling when the natural total would exceed it; otherwise it's ignored.
func proportionalCardLimits(chunks []chunker.Chunk, requestedTotal int) []int {
	natural := make([]int, len(chunks))
	naturalSum := 0
	for i, c := range chunks {
		n := naturalCardLimit(c.Text)
		natural[i] = n
		naturalSum += n
	}

	ceiling := absoluteMaxTotalCards
	if requestedTotal > 0 && requestedTotal < ceiling {
		ceiling = requestedTotal
	}

	if naturalSum <= ceiling {
		return natural
	}

	scaled := make([]int, len(chunks))
	for i, n := range natural {
		s := int(math.Round(float64(n) * float64(ceiling) / float64(naturalSum)))
		if s < 1 {
			s = 1
		}
		scaled[i] = s
	}
	return scaled
}

// naturalCardLimit is a chunk's estimated card potential: the larger of a
// density heuristic and its count of dispositivos (each deserves at least one
// card), clamped to what one call can write. It is deterministic in the text,
// so ProcessChunk can recompute it to tell whether the stored CardLimit was
// scaled down by a user-set ceiling.
func naturalCardLimit(text string) int {
	n := int(math.Round(float64(len(text)) / float64(charsPerCard) * legalDensityFactor(text)))
	if d := len(legal.Extract(text)); d > n {
		n = d
	}
	if n < minCardsPerChunk {
		n = minCardsPerChunk
	}
	if n > maxCardsPerChunk {
		n = maxCardsPerChunk
	}
	return n
}

func legalDensityFactor(text string) float64 {
	lower := strings.ToLower(text)
	score := 0.0

	markers := []struct {
		needle string
		weight float64
	}{
		{needle: "art.", weight: 1.2},
		{needle: "artigo", weight: 1.0},
		{needle: "§", weight: 0.9},
		{needle: "parágrafo", weight: 0.8},
		{needle: "paragrafo", weight: 0.8},
		{needle: "inciso", weight: 0.7},
		{needle: "alínea", weight: 0.7},
		{needle: "alinea", weight: 0.7},
		{needle: "caput", weight: 0.5},
		{needle: "prazo", weight: 0.9},
		{needle: "vedado", weight: 0.8},
		{needle: "proib", weight: 0.8},
		{needle: "deverá", weight: 0.6},
		{needle: "devera", weight: 0.6},
		{needle: "sanção", weight: 0.9},
		{needle: "sancao", weight: 0.9},
		{needle: "compet", weight: 0.5},
		{needle: "hipótese", weight: 0.6},
		{needle: "hipotese", weight: 0.6},
		{needle: "dias", weight: 0.2},
		{needle: "meses", weight: 0.2},
		{needle: "anos", weight: 0.2},
	}

	for _, marker := range markers {
		if count := strings.Count(lower, marker.needle); count > 0 {
			score += float64(count) * marker.weight
		}
	}

	bonus := 1.0 + math.Min(1.2, score/10.0)
	return bonus
}

// generateChunkCards runs the first generation pass over a chunk and, when
// it under-delivered, one follow-up pass aimed at exactly what is missing.
// This is the middle ground between paying for long model reasoning on every
// chunk and accepting whatever a lazy first pass returns: Go measures the
// gap deterministically (pkg/legal), and the model spends a second call only
// where there is something left to cover. The follow-up is best-effort — its
// failure keeps the first pass's cards instead of failing the chunk.
func (uc *generationUseCase) generateChunkCards(ctx context.Context, system, discName string, chunk *models.GenerationChunk, totalChunks int) ([]anthropic.GeneratedCard, error) {
	dispositivos := legal.Extract(chunk.ChunkText)
	ceiling := chunk.CardLimit < naturalCardLimit(chunk.ChunkText)
	// The document block must be byte-identical across both passes for the
	// follow-up to hit the prompt cache.
	document := "TRECHO:\n" + chunk.ChunkText

	checklist := dispositivos
	if len(checklist) > maxChecklistItems {
		checklist = checklist[:maxChecklistItems]
	}
	first, err := uc.ai.GenerateCards(ctx, anthropic.CardRequest{
		System:       system,
		Document:     document,
		Instructions: buildChunkInstructions(discName, chunk.ChunkIndex+1, totalChunks, chunk.CardLimit, ceiling, checklist),
	})
	if err != nil {
		return nil, err
	}
	cards := first.Cards

	plan := planComplement(cards, dispositivos, chunk.CardLimit, ceiling)
	if !plan.needed {
		return cards, nil
	}

	more, err := uc.ai.GenerateCards(ctx, anthropic.CardRequest{
		System:       system,
		Document:     document,
		Instructions: buildComplementInstructions(discName, cards, plan, chunk.CardLimit),
		AllowEmpty:   true,
	})
	if err != nil {
		log.Printf("generation: chunk %s: passada complementar falhou, mantendo %d cards da primeira: %v", chunk.ID, len(cards), err)
		return cards, nil
	}
	extra := more.Cards
	if len(extra) > plan.budget {
		extra = extra[:plan.budget]
	}
	log.Printf("generation: chunk %s: complemento adicionou %d cards (lacunas: %d dispositivos)", chunk.ID, len(extra), len(plan.missing))
	return append(cards, extra...), nil
}

type complementPlan struct {
	needed bool
	// missing lists uncovered dispositivos; empty for non-legal text, where
	// the follow-up is driven by card count instead.
	missing []string
	budget  int
}

// planComplement decides whether a first pass was lazy. With dispositivos,
// "lazy" means at least minUncoveredForComplement of them got no card; without
// them, it means fewer cards than underGenerationRatio of the chunk's
// potential. A user-set ceiling caps the follow-up at the room left under it.
func planComplement(cards []anthropic.GeneratedCard, dispositivos []string, limit int, ceiling bool) complementPlan {
	room := maxComplementCards
	if ceiling {
		room = limit - len(cards)
	}
	if room <= 0 {
		return complementPlan{}
	}

	if len(dispositivos) > 0 {
		cited := make([]string, len(cards))
		for i, c := range cards {
			cited[i] = c.Dispositivo
		}
		missing := legal.Uncovered(dispositivos, cited)
		if len(missing) < minUncoveredForComplement {
			return complementPlan{}
		}
		// Up to two cards per gap (rule + exception/prazo), within room.
		budget := 2 * len(missing)
		if budget > room {
			budget = room
		}
		return complementPlan{needed: true, missing: missing, budget: budget}
	}

	if float64(len(cards)) >= underGenerationRatio*float64(limit) {
		return complementPlan{}
	}
	budget := limit - len(cards)
	if budget > room {
		budget = room
	}
	return complementPlan{needed: budget > 0, budget: budget}
}

func buildChunkInstructions(discName string, chunkIndex, totalChunks, limit int, ceiling bool, checklist []string) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "Disciplina: %s\nO TRECHO acima é a parte %d de %d de um documento maior — use SOMENTE esse conteúdo, sem referência a outras partes do documento.\n\n", discName, chunkIndex, totalChunks)

	if len(checklist) > 0 {
		sb.WriteString("Dispositivos identificados no trecho:\n")
		sb.WriteString(legal.FormatChecklist(checklist))
		sb.WriteString("\nCubra TODOS os dispositivos da lista: cada um deve ter pelo menos um card, e o campo \"dispositivo\" de cada card deve trazer exatamente o ID da lista que ele cobre. " +
			"Dispositivos com prazo, exceção, vedação, condição, competência ou sanção costumam render mais de um card — um por regra cobrável em prova. " +
			"Se um item for mera remissão ou não tiver conteúdo cobrável, pode omiti-lo.\n")
	} else {
		sb.WriteString("Identifique os tópicos centrais do trecho — artigos, incisos, parágrafos, alíneas, prazos, hipóteses, exceções, sanções, competências e definições — e cubra o máximo de tópicos distintos com qualidade. Deixe o campo \"dispositivo\" vazio.\n")
	}

	sb.WriteString("Prefira cards de alta utilidade prática: uma pergunta por comando legal, uma lacuna por regra relevante e uma explicação por exceção importante. Evite repetição literal e trechos pouco informativos.\n")
	if ceiling {
		fmt.Fprintf(&sb, "Gere NO MÁXIMO %d flashcards; se não couber tudo, priorize as regras mais cobradas.", limit)
	} else {
		fmt.Fprintf(&sb, "Referência de volume: cerca de %d flashcards. É uma estimativa, não um teto — se o trecho tiver mais regras cobráveis, gere mais; se tiver menos, não crie cards de enchimento.", limit)
	}
	return sb.String()
}

func buildComplementInstructions(discName string, existing []anthropic.GeneratedCard, plan complementPlan, limit int) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "Disciplina: %s\nRevisão de cobertura do TRECHO acima. Uma primeira passada já gerou estes cards (frentes):\n", discName)
	for _, c := range existing {
		fmt.Fprintf(&sb, "- %s\n", c.Front)
	}

	if len(plan.missing) > 0 {
		sb.WriteString("\nOs dispositivos a seguir ficaram SEM nenhum card:\n")
		sb.WriteString(legal.FormatChecklist(plan.missing))
		sb.WriteString("\nGere cards APENAS para esses dispositivos, com o ID exato no campo \"dispositivo\". " +
			"Use seu julgamento: se um item for só remissão, título ou não tiver conteúdo cobrável em prova, omita-o.\n")
	} else {
		fmt.Fprintf(&sb, "\nA primeira passada gerou %d cards para um trecho com potencial estimado de cerca de %d. "+
			"Releia o TRECHO e gere cards para regras, prazos, exceções, hipóteses e definições que ficaram de fora.\n", len(existing), limit)
	}

	fmt.Fprintf(&sb, "Não repita nem reformule os cards existentes. Se o trecho já estiver bem coberto, retorne uma lista vazia — não crie cards de enchimento. Gere NO MÁXIMO %d flashcards.", plan.budget)
	return sb.String()
}

func buildReviewerPrompt(discName string, cards []anthropic.GeneratedCard) (system, user string) {
	system = "Você é um revisor de qualidade de flashcards para concursos públicos brasileiros.\n" +
		"Você recebe uma lista numerada de flashcards gerados a partir de diferentes trechos de um mesmo documento, " +
		"processados separadamente e por isso com possível sobreposição.\n" +
		"Indique os números dos cards a REMOVER: duplicatas que cobram a mesma regra do mesmo jeito (mantenha a melhor versão), " +
		"cards cujo verso não responde à frente, e cards genéricos demais para serem cobrados em prova. " +
		"Preserve cards que tratem de comandos, prazos, exceções ou hipóteses distintas, mesmo quando pareçam semelhantes. " +
		"Na dúvida, mantenha o card. Se nada precisar sair, retorne lista vazia."

	var sb strings.Builder
	fmt.Fprintf(&sb, "Disciplina: %s\nLista de flashcards (%d no total):\n\n", discName, len(cards))
	for i, c := range cards {
		if c.Dispositivo != "" {
			fmt.Fprintf(&sb, "%d. [%s] FRENTE: %s\n   VERSO: %s\n", i+1, c.Dispositivo, c.Front, c.Back)
		} else {
			fmt.Fprintf(&sb, "%d. FRENTE: %s\n   VERSO: %s\n", i+1, c.Front, c.Back)
		}
	}
	return system, sb.String()
}

// applyRemovals drops the reviewer's 1-based indices from cards, ignoring
// out-of-range and repeated ones. A review that would remove more than
// maxReviewRemovalRatio of the list is discarded (returned as reviewErr)
// rather than trusted.
func applyRemovals(cards []anthropic.GeneratedCard, remove []int) ([]anthropic.GeneratedCard, string) {
	drop := make(map[int]bool, len(remove))
	for _, n := range remove {
		if n >= 1 && n <= len(cards) {
			drop[n-1] = true
		}
	}
	if float64(len(drop)) > maxReviewRemovalRatio*float64(len(cards)) {
		return cards, fmt.Sprintf("revisão descartada: removeria %d de %d cards", len(drop), len(cards))
	}

	kept := make([]anthropic.GeneratedCard, 0, len(cards)-len(drop))
	for i, c := range cards {
		if !drop[i] {
			kept = append(kept, c)
		}
	}
	return kept, ""
}
