.PHONY: help build run test clean install-deps dev format lint

help:
	@echo "Available commands:"
	@echo "  make install-deps      - Install Go dependencies"
	@echo "  make build             - Build the application"
	@echo "  make run               - Run the application"
	@echo "  make dev               - Run in development mode"
	@echo "  make test              - Run tests"
	@echo "  make clean             - Clean build artifacts"
	@echo "  make format            - Format code with gofmt"
	@echo "  make lint              - Run linter"

install-deps:
	go mod download
	go mod tidy

build:
	go build -o bin/approva-cards ./cmd/server/main.go

run: build
	./bin/approva-cards

dev:
	go run ./cmd/server/main.go

test:
	go test -v -race -coverprofile=coverage.out ./...

clean:
	rm -rf bin/
	rm -f coverage.out

format:
	gofmt -s -w .

lint:
	golint ./...
