package anthropic

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	messagesURL      = "https://api.anthropic.com/v1/messages"
	defaultModel     = "claude-sonnet-4-6"
	anthropicVersion = "2023-06-01"
)

// httpClient's timeout must outlast a full 8192-token response (~2-2.5 min
// at Sonnet's output speed); the River job timeout (pkg/jobs) sits above it.
var httpClient = &http.Client{Timeout: 200 * time.Second}

// ErrTransient wraps errors worth retrying (network failures, non-2xx
// responses, token-limit truncation — a retry may yield a shorter,
// non-truncated response due to model non-determinism).
var ErrTransient = errors.New("anthropic: transient error")

// ErrPermanent wraps errors that will deterministically reproduce on retry
// with the same input (malformed/empty structured output) — retrying is a
// waste of an attempt budget.
var ErrPermanent = errors.New("anthropic: permanent error")

// IsTransient reports whether err (or a wrapped error) is retry-worthy.
func IsTransient(err error) bool { return errors.Is(err, ErrTransient) }

// Client is a raw HTTP client for the Anthropic Messages API.
// The API key is intentionally read from OPENAI_API_KEY (legacy naming — technical debt).
type Client struct {
	apiKey string
}

func NewClient(apiKey string) *Client {
	return &Client{apiKey: apiKey}
}

type cacheControl struct {
	Type string `json:"type"`
}

// textBlock is a user-turn content block. Splitting the turn into blocks lets
// the large, stable part (the source text) carry a cache breakpoint while the
// instructions after it vary between calls.
type textBlock struct {
	Type         string        `json:"type"`
	Text         string        `json:"text"`
	CacheControl *cacheControl `json:"cache_control,omitempty"`
}

type anthropicMessage struct {
	Role    string      `json:"role"`
	Content []textBlock `json:"content"`
}

type toolDefinition struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"input_schema"`
}

type toolChoice struct {
	Type string `json:"type"`
	Name string `json:"name"`
}

type anthropicRequest struct {
	Model      string             `json:"model"`
	MaxTokens  int                `json:"max_tokens"`
	System     string             `json:"system"`
	Messages   []anthropicMessage `json:"messages"`
	Tools      []toolDefinition   `json:"tools"`
	ToolChoice toolChoice         `json:"tool_choice"`
}

type contentBlock struct {
	Type  string          `json:"type"`
	Name  string          `json:"name,omitempty"`
	Input json.RawMessage `json:"input,omitempty"`
}

type anthropicResponse struct {
	Content    []contentBlock `json:"content"`
	StopReason string         `json:"stop_reason"`
	Error      *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// GeneratedCard is one flashcard returned by Claude via forced tool use.
type GeneratedCard struct {
	Front      string   `json:"front"`
	Back       string   `json:"back"`
	TopicTags  []string `json:"topic_tags"`
	Difficulty string   `json:"difficulty"` // easy | medium | hard
	// Dispositivo is the legal unit the card tests ("Art. 5, III"), copied
	// from the checklist in the prompt; empty for non-legal text. Used only
	// for the coverage check — see pkg/legal.
	Dispositivo string `json:"dispositivo"`
}

// GeneratedCardsOutput is the structured output parsed from Claude's tool call input.
type GeneratedCardsOutput struct {
	Cards []GeneratedCard `json:"cards"`
}

// CardRequest is one card-generation call. Document is sent first, with a
// cache breakpoint, so a follow-up call over the same Document (the coverage
// pass) re-reads it from cache instead of reprocessing it.
type CardRequest struct {
	System       string
	Document     string
	Instructions string
	// AllowEmpty makes an empty card list a valid answer instead of a
	// permanent error — the follow-up pass may legitimately find nothing.
	AllowEmpty bool
}

var cardsTool = toolDefinition{
	Name:        "generate_flashcards",
	Description: "Retorna os flashcards gerados em formato estruturado",
	InputSchema: map[string]any{
		"type": "object",
		"properties": map[string]any{
			"cards": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"dispositivo": map[string]any{
							"type":        "string",
							"description": "ID exato do dispositivo da lista fornecida que este card cobre (ex.: \"Art. 5, III\"); string vazia se não houver lista",
						},
						"front": map[string]any{"type": "string"},
						"back":  map[string]any{"type": "string"},
						"topic_tags": map[string]any{
							"type":  "array",
							"items": map[string]any{"type": "string"},
						},
						"difficulty": map[string]any{
							"type": "string",
							"enum": []string{"easy", "medium", "hard"},
						},
					},
					"required": []string{"dispositivo", "front", "back", "topic_tags", "difficulty"},
				},
			},
		},
		"required": []string{"cards"},
	},
}

var removeTool = toolDefinition{
	Name:        "select_cards_to_remove",
	Description: "Retorna os números dos flashcards que devem ser removidos da lista",
	InputSchema: map[string]any{
		"type": "object",
		"properties": map[string]any{
			"remove": map[string]any{
				"type":        "array",
				"items":       map[string]any{"type": "integer"},
				"description": "Números (1-based) dos cards a remover; lista vazia se nenhum",
			},
		},
		"required": []string{"remove"},
	},
}

// GenerateCards calls the Anthropic Messages API using forced tool use
// (tool_choice: {type: "tool", name: "generate_flashcards"}) which guarantees
// that Claude returns a JSON object matching the card schema.
//
// Errors are wrapped with ErrTransient or ErrPermanent (see IsTransient) so
// callers driving retries (e.g. a River job) know whether trying again is
// worthwhile.
func (c *Client) GenerateCards(ctx context.Context, req CardRequest) (*GeneratedCardsOutput, error) {
	content := []textBlock{
		{Type: "text", Text: req.Document, CacheControl: &cacheControl{Type: "ephemeral"}},
		{Type: "text", Text: req.Instructions},
	}
	input, err := c.callTool(ctx, req.System, content, cardsTool, 8192)
	if err != nil {
		return nil, err
	}

	var output GeneratedCardsOutput
	if err := json.Unmarshal(input, &output); err != nil {
		return nil, permanentErrf("parsear cards: %v", err)
	}
	if len(output.Cards) == 0 && !req.AllowEmpty {
		return nil, permanentErrf("Claude retornou lista de cards vazia — verifique o conteúdo fornecido")
	}
	return &output, nil
}

// SelectCardsToRemove asks for the 1-based indices of cards to drop instead
// of the curated list itself: the output stays a few dozen tokens no matter
// how many cards are reviewed, so the review pass no longer costs as much
// time as generating every card again.
func (c *Client) SelectCardsToRemove(ctx context.Context, systemPrompt, userPrompt string) ([]int, error) {
	input, err := c.callTool(ctx, systemPrompt, []textBlock{{Type: "text", Text: userPrompt}}, removeTool, 1024)
	if err != nil {
		return nil, err
	}
	var output struct {
		Remove []int `json:"remove"`
	}
	if err := json.Unmarshal(input, &output); err != nil {
		return nil, permanentErrf("parsear revisão: %v", err)
	}
	return output.Remove, nil
}

// callTool sends one request forcing a call to tool and returns that call's
// raw input.
func (c *Client) callTool(ctx context.Context, systemPrompt string, content []textBlock, tool toolDefinition, maxTokens int) (json.RawMessage, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY não configurado (chave Anthropic)")
	}

	payload := anthropicRequest{
		Model:      defaultModel,
		MaxTokens:  maxTokens,
		System:     systemPrompt,
		Messages:   []anthropicMessage{{Role: "user", Content: content}},
		Tools:      []toolDefinition{tool},
		ToolChoice: toolChoice{Type: "tool", Name: tool.Name},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("serializar request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, messagesURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", anthropicVersion)
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, transientErrf("chamar Anthropic: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, transientErrf("Anthropic HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result anthropicResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, permanentErrf("parsear resposta Anthropic: %v", err)
	}
	if result.Error != nil {
		return nil, transientErrf("Anthropic API: %s", result.Error.Message)
	}

	if result.StopReason == "max_tokens" {
		return nil, transientErrf("resposta cortada pelo limite de tokens — reduza o número de cards ou o tamanho do documento")
	}

	for _, block := range result.Content {
		if block.Type == "tool_use" && block.Name == tool.Name {
			if len(block.Input) == 0 || string(block.Input) == "null" {
				return nil, permanentErrf("Claude não preencheu a resposta estruturada (input vazio)")
			}
			return block.Input, nil
		}
	}

	return nil, permanentErrf("Anthropic não retornou resposta estruturada (stop_reason: %s)", result.StopReason)
}

func transientErrf(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrTransient, fmt.Sprintf(format, args...))
}

func permanentErrf(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrPermanent, fmt.Sprintf(format, args...))
}
