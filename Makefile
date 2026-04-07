# ============================================================
# Aprova Cards Monorepo - Makefile
# ============================================================

.PHONY: help install dev dev-back dev-front build build-back build-front \
        test test-back test-front lint clean docker-up docker-down health

# ---- Default ----
help:
	@echo ""
	@echo "  Aprova Cards Monorepo"
	@echo "  ====================="
	@echo ""
	@echo "  make install        Install all dependencies"
	@echo "  make dev            Run backend + frontend in parallel"
	@echo "  make dev-back       Run backend only (Go)"
	@echo "  make dev-front      Run frontend only (Vite)"
	@echo "  make build          Build both backend and frontend"
	@echo "  make build-back     Build backend binary"
	@echo "  make build-front    Build frontend static assets"
	@echo "  make test           Run all tests"
	@echo "  make test-back      Run backend tests"
	@echo "  make test-front     Run frontend tests"
	@echo "  make lint           Lint both projects"
	@echo "  make clean          Remove build artifacts"
	@echo "  make docker-up      Start with Docker Compose"
	@echo "  make docker-down    Stop Docker Compose"
	@echo "  make health         Check backend health endpoint"
	@echo ""

# ---- Install ----
install:
	cd backend && go mod download && go mod tidy
	cd frontend && npm install

# ---- Development ----
dev:
	@echo "Starting backend and frontend..."
	$(MAKE) dev-back & $(MAKE) dev-front & wait

dev-back:
	cd backend && go run ./cmd/server/main.go

dev-front:
	cd frontend && npm run dev

# ---- Build ----
build: build-back build-front

build-back:
	cd backend && go build -ldflags="-s -w" -o bin/aprova-cards ./cmd/server/main.go

build-front:
	cd frontend && npm run build

# ---- Test ----
test: test-back test-front

test-back:
	cd backend && go test -v -race -coverprofile=coverage.out ./...

test-front:
	cd frontend && npm run test

# ---- Lint ----
lint:
	cd backend && gofmt -l . && go vet ./...
	cd frontend && npm run lint

# ---- Clean ----
clean:
	rm -rf backend/bin/ backend/coverage.out
	rm -rf frontend/dist/ frontend/node_modules/

# ---- Docker ----
docker-up:
	docker compose -f deploy/docker-compose.yml up --build -d

docker-down:
	docker compose -f deploy/docker-compose.yml down

# ---- Health Check ----
health:
	@curl -s http://localhost:8080/api/v1/health | python3 -m json.tool 2>/dev/null || echo "Backend not reachable"
