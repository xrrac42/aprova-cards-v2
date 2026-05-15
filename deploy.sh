#!/bin/bash
set -e

echo "=== Iniciando deploy ==="

# Remove .env do frontend para garantir que usa o da raiz
rm -f /opt/aprova-cards/frontend/.env
rm -f /opt/aprova-cards/frontend/.env.local
rm -f /opt/aprova-cards/frontend/.env.production

# Compila backend
export PATH=$PATH:/usr/local/go/bin
cd /opt/aprova-cards/backend
go build -o bin/aprova-cards ./cmd/server/main.go

# Reinicia backend
kill $(lsof -t -i:8080) 2>/dev/null || true
sleep 1
nohup ./bin/aprova-cards > /tmp/aprova-backend.log 2>&1 &

# Build frontend
cd /opt/aprova-cards/frontend
npm run build
kill $(cat /tmp/aprova-frontend.pid) 2>/dev/null || true
nohup npx serve -s dist -l 5173 > /tmp/aprova-frontend.log 2>&1 &
echo $! > /tmp/aprova-frontend.pid

echo "=== Deploy concluído ==="
