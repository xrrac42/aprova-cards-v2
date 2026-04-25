package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/approva-cards/back-aprova-cards/internal/dto"
	"github.com/gin-gonic/gin"
)

type CardAnalysisHandler struct {
	lovableAPIKey string
}

func NewCardAnalysisHandler(lovableAPIKey string) *CardAnalysisHandler {
	return &CardAnalysisHandler{lovableAPIKey: lovableAPIKey}
}

type AnalyzeCardsRequest struct {
	Cards []struct {
		ID    string `json:"id" binding:"required"`
		Front string `json:"front" binding:"required"`
		Back  string `json:"back" binding:"required"`
	} `json:"cards" binding:"required"`
}

type AnalysisResult struct {
	ID         string  `json:"id"`
	Defeituoso bool    `json:"defeituoso"`
	Motivo     *string `json:"motivo"`
}

type AnalyzeCardsResponse struct {
	Resultados []AnalysisResult `json:"resultados"`
	ParseError bool             `json:"parse_error,omitempty"`
}

func (h *CardAnalysisHandler) AnalyzeCards(c *gin.Context) {
	var req AnalyzeCardsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.APIResponse{Success: false, Error: err.Error()})
		return
	}

	if len(req.Cards) == 0 {
		c.JSON(http.StatusOK, dto.APIResponse{
			Success: true,
			Data: AnalyzeCardsResponse{
				Resultados: []AnalysisResult{},
			},
		})
		return
	}

	// Check if API key is configured
	if h.lovableAPIKey == "" {
		c.JSON(http.StatusServiceUnavailable, dto.APIResponse{
			Success: false,
			Error:   "AI analysis not configured (LOVABLE_API_KEY not set)",
		})
		return
	}

	// Build card list for prompt
	cardList := make([]string, len(req.Cards))
	for i, card := range req.Cards {
		cardList[i] = fmt.Sprintf("ID: %s\nFrente: %s\nVerso: %s", card.ID, card.Front, card.Back)
	}
	cardListText := strings.Join(cardList, "\n---\n")

	prompt := fmt.Sprintf(`Você é um avaliador de qualidade de flashcards para concursos públicos.

Analise cada card e classifique como DEFEITUOSO apenas se a frente ou o verso estiver INCOMPLETO: texto claramente cortado no meio da frase, que termina abruptamente sem conclusão lógica, ou que começa no meio de uma ideia sem contexto.

NÃO classifique como defeituoso cards que:
— Têm resposta curta mas completa (ex: 'CERTO. Exigência documental.')
— Usam linguagem técnica densa
— São afirmações completas mesmo que curtas

Retorne SOMENTE JSON válido:
{
  "resultados": [
    {
      "id": "[id do card]",
      "defeituoso": true ou false,
      "motivo": "[trecho exato que está incompleto, ou null se ok]"
    }
  ]
}

Cards para analisar:
%s`, cardListText)

	// Call Lovable AI API
	aiReq := map[string]interface{}{
		"model": "google/gemini-2.5-flash",
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
	}

	bodyBytes, _ := json.Marshal(aiReq)
	httpReq, _ := http.NewRequest("POST", "https://ai.gateway.lovable.dev/v1/chat/completions", bytes.NewReader(bodyBytes))
	httpReq.Header.Set("Authorization", "Bearer "+h.lovableAPIKey)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.APIResponse{
			Success: false,
			Error:   "Failed to call AI service: " + err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		c.JSON(http.StatusTooManyRequests, dto.APIResponse{
			Success: false,
			Error:   "Rate limit excedido, tente novamente em alguns segundos.",
		})
		return
	}

	if resp.StatusCode == http.StatusPaymentRequired {
		c.JSON(http.StatusPaymentRequired, dto.APIResponse{
			Success: false,
			Error:   "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage.",
		})
		return
	}

	if resp.StatusCode != http.StatusOK {
		_, _ = io.ReadAll(resp.Body)
		c.JSON(http.StatusInternalServerError, dto.APIResponse{
			Success: false,
			Error:   fmt.Sprintf("AI service error: %d", resp.StatusCode),
		})
		return
	}

	var aiResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&aiResp)

	rawContent := ""
	if choices, ok := aiResp["choices"].([]interface{}); ok && len(choices) > 0 {
		if choice, ok := choices[0].(map[string]interface{}); ok {
			if message, ok := choice["message"].(map[string]interface{}); ok {
				if content, ok := message["content"].(string); ok {
					rawContent = content
				}
			}
		}
	}

	// Extract JSON from response (handle markdown code blocks)
	jsonStr := rawContent
	jsonRegex := regexp.MustCompile("(?s)```(?:json)?\\s*([\\s\\S]*?)```")
	if matches := jsonRegex.FindStringSubmatch(rawContent); matches != nil {
		jsonStr = strings.TrimSpace(matches[1])
	}

	var analysisResp AnalyzeCardsResponse
	if err := json.Unmarshal([]byte(jsonStr), &analysisResp); err != nil {
		analysisResp = AnalyzeCardsResponse{
			Resultados: []AnalysisResult{},
			ParseError: true,
		}
	}

	c.JSON(http.StatusOK, dto.APIResponse{
		Success: true,
		Data:    analysisResp,
	})
}
