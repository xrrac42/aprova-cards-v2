package usecases

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/approva-cards/back-aprova-cards/internal/models"
	"github.com/approva-cards/back-aprova-cards/internal/repositories"
	"github.com/approva-cards/back-aprova-cards/pkg/anthropic"
	"github.com/approva-cards/back-aprova-cards/pkg/chunker"
	"github.com/approva-cards/back-aprova-cards/pkg/dedupe"
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
	// this the deduplicated (unreviewed) set is used directly.
	maxCardsForReviewer = 150
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
	user := buildChunkUserPrompt(disc.Name, chunk.ChunkText, chunk.ChunkIndex+1, job.TotalChunks, chunk.CardLimit)

	output, genErr := uc.ai.GenerateCards(ctx, system, user)

	terminal := true
	if genErr != nil {
		_ = uc.chunkRepo.MarkFailed(chunkID, genErr.Error(), attempt)
		if anthropic.IsTransient(genErr) && attempt < maxAttempts {
			terminal = false // let River retry — don't count this chunk as done yet
		}
	} else {
		cardsJSON, marshalErr := json.Marshal(output.Cards)
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
	if len(deduped) > 0 && len(deduped) <= maxCardsForReviewer {
		if err := uc.jobRepo.UpdateStatus(jobID, models.GenerationJobStatusReviewing); err != nil {
			return err
		}
		system, user := buildReviewerPrompt(disc.Name, deduped)
		reviewed, err := uc.ai.GenerateCards(ctx, system, user)
		if err != nil {
			reviewErr = err.Error()
		} else if len(reviewed.Cards) > 0 {
			final = reviewed.Cards
		}
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
		n := len(c.Text) / charsPerCard
		if n < minCardsPerChunk {
			n = minCardsPerChunk
		}
		if n > maxCardsPerChunk {
			n = maxCardsPerChunk
		}
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

func buildChunkUserPrompt(discName, chunkText string, chunkIndex, totalChunks, limit int) string {
	return fmt.Sprintf(
		"Disciplina: %s\nEste texto é a parte %d de %d de um documento maior — use SOMENTE o conteúdo abaixo, não faça referência a outras partes do documento.\n"+
			"Gere NO MÁXIMO %d flashcards com base neste trecho.\n\nTRECHO:\n%s",
		discName, chunkIndex, totalChunks, limit, chunkText,
	)
}

func buildReviewerPrompt(discName string, cards []anthropic.GeneratedCard) (system, user string) {
	system = "Você é um revisor de qualidade de flashcards para concursos públicos brasileiros.\n" +
		"Você recebe uma lista de flashcards já gerados a partir de diferentes trechos de um mesmo documento, " +
		"processados separadamente e por isso com possível sobreposição.\n" +
		"Remova duplicatas remanescentes e cards de baixa qualidade ou genéricos demais. " +
		"NÃO invente cards novos que não estejam fundamentados na lista recebida — apenas curadoria. " +
		"Retorne a lista final."

	var sb strings.Builder
	fmt.Fprintf(&sb, "Disciplina: %s\nLista de flashcards gerados (%d no total):\n\n", discName, len(cards))
	for i, c := range cards {
		fmt.Fprintf(&sb, "%d. FRENTE: %s\n   VERSO: %s\n", i+1, c.Front, c.Back)
	}
	return system, sb.String()
}
