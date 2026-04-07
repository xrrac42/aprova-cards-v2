# ============================================================
# Backend Dockerfile - Multi-stage build
# Final image: ~15MB (distroless)
# ============================================================

# ---- Stage 1: Build ----
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache ca-certificates git

WORKDIR /build

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /build/aprova-cards ./cmd/server/main.go

# ---- Stage 2: Runtime ----
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /build/aprova-cards /aprova-cards

EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/aprova-cards"]
