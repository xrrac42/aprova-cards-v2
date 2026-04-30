.PHONY: help build run test clean dev format lint

help:
	@echo "Available commands:"
	@echo "  make build   - Build the application"
	@echo "  make run     - Build and run"
	@echo "  make dev     - Run in development mode"
	@echo "  make test    - Run tests with coverage"
	@echo "  make clean   - Clean build artifacts"
	@echo "  make format  - Format code"
	@echo "  make lint    - Run vet and format check"

build:
	go build -ldflags="-s -w" -o bin/aprova-cards ./cmd/server/main.go

run: build
	./bin/aprova-cards

dev:
	go run ./cmd/server/main.go

test:
	go test -v -race -coverprofile=coverage.out ./...

clean:
	rm -rf bin/ coverage.out

format:
	gofmt -s -w .

lint:
	gofmt -l .
	go vet ./...
