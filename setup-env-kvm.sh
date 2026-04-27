#!/bin/bash
# Setup script para configurar variáveis de ambiente na KVM
# Execute como: bash /home/aprova-deploy/setup-env.sh

set -e

echo "🔧 Configurando variáveis de ambiente para Aprova Cards..."

# Criar arquivo .env
cat > /home/aprova-deploy/aprova-cards-v2/.env << 'EOF'
# ============================================================
# BACKEND CONFIG
# ============================================================
SERVER_PORT=8080
SERVER_ENV=production

# Database (Supabase)
DB_HOST=your-supabase-host.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=YOUR_DB_PASSWORD_HERE
DB_NAME=postgres
DB_SSL_MODE=require

# Supabase Admin
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# JWT
JWT_SECRET=YOUR_STRONG_JWT_SECRET_HERE
JWT_EXPIRATION=3600

# CORS
CORS_ALLOWED_ORIGINS=https://seu-dominio.com,https://www.seu-dominio.com

# Rate Limit
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_SECONDS=60

# Admin (opcional)
ADMIN_EMAIL=admin@aprovacards.com
ADMIN_PASSWORD=YOUR_SECURE_PASSWORD_HERE

# ============================================================
# FRONTEND CONFIG (Vite)
# ============================================================
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY_HERE
VITE_BACKEND_URL=https://seu-dominio.com

# ============================================================
# STRIPE CONFIG
# ============================================================
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_STRIPE_PUBLISHABLE_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# ============================================================
# EMAIL CONFIG (opcional)
# ============================================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_FROM=seu-email@gmail.com
SMTP_PASSWORD=your-app-specific-password

# Frontend URLs
FRONTEND_BASE_URL=https://seu-dominio.com
EOF

# Proteger arquivo
chmod 600 /home/aprova-deploy/aprova-cards-v2/.env

echo "✅ .env criado em /home/aprova-deploy/aprova-cards-v2/.env"
echo "⚠️  EDITE o arquivo com suas chaves reais!"
echo ""
echo "Para editar:"
echo "  sudo nano /home/aprova-deploy/aprova-cards-v2/.env"
