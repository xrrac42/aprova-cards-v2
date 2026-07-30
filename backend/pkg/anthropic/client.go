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

var httpClient = &http.Client{Timeout: 120 * time.Second}

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

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
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
}

// GeneratedCardsOutput is the structured output parsed from Claude's tool call input.
type GeneratedCardsOutput struct {
	Cards []GeneratedCard `json:"cards"`
}

// GenerateCards calls the Anthropic Messages API using forced tool use
// (tool_choice: {type: "tool", name: "generate_flashcards"}) which guarantees
// that Claude returns a JSON object matching the card schema.
//
// Errors are wrapped with ErrTransient or ErrPermanent (see IsTransient) so
// callers driving retries (e.g. a River job) know whether trying again is
// worthwhile.
func (c *Client) GenerateCards(ctx context.Context, systemPrompt, userPrompt string) (*GeneratedCardsOutput, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY não configurado (chave Anthropic)")
	}

	inputSchema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"cards": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
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
					"required": []string{"front", "back", "topic_tags", "difficulty"},
				},
			},
		},
		"required": []string{"cards"},
	}

	payload := anthropicRequest{
		Model:     defaultModel,
		MaxTokens: 8192,
		System:    systemPrompt,
		Messages:  []anthropicMessage{{Role: "user", Content: userPrompt}},
		Tools: []toolDefinition{{
			Name:        "generate_flashcards",
			Description: "Retorna os flashcards gerados em formato estruturado",
			InputSchema: inputSchema,
		}},
		ToolChoice: toolChoice{Type: "tool", Name: "generate_flashcards"},
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
		if block.Type == "tool_use" && block.Name == "generate_flashcards" {
			if len(block.Input) == 0 || string(block.Input) == "{}" || string(block.Input) == "null" {
				return nil, permanentErrf("Claude não preencheu os cards (input vazio) — tente reduzir o número de cards solicitados")
			}
			var output GeneratedCardsOutput
			if err := json.Unmarshal(block.Input, &output); err != nil {
				return nil, permanentErrf("parsear cards: %v", err)
			}
			if len(output.Cards) == 0 {
				return nil, permanentErrf("Claude retornou lista de cards vazia — verifique o conteúdo fornecido")
			}
			return &output, nil
		}
	}

	return nil, permanentErrf("Anthropic não retornou cards estruturados (stop_reason: %s)", result.StopReason)
}

func transientErrf(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrTransient, fmt.Sprintf(format, args...))
}

func permanentErrf(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrPermanent, fmt.Sprintf(format, args...))
}
