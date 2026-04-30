package dto

// HealthResponse - Resposta completa do health check
type HealthResponse struct {
	Status    string       `json:"status"`     // healthy | degraded
	Timestamp string       `json:"timestamp"`
	Version   string       `json:"version"`
	Uptime    string       `json:"uptime"`
	Checks    HealthChecks `json:"checks"`
}

// HealthChecks - Todos os checks individuais
type HealthChecks struct {
	Database HealthCheckDetail `json:"database"`
}

// HealthCheckDetail - Detalhe de um check individual
type HealthCheckDetail struct {
	Status     string `json:"status"`                // up | down
	Latency    string `json:"latency"`
	Error      string `json:"error,omitempty"`
	OpenConns  int    `json:"open_connections,omitempty"`
	InUseConns int    `json:"in_use_connections,omitempty"`
	IdleConns  int    `json:"idle_connections,omitempty"`
}
