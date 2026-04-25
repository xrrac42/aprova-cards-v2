#!/bin/bash
# Initial Setup Script for Payment System Integration

set -e

echo "🚀 Starting Payment System Integration Setup..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Backend Setup
echo -e "${BLUE}[1/5]${NC} Setting up Backend..."

cd backend

# Check if go.mod exists
if [ ! -f "go.mod" ]; then
    echo -e "${RED}Error: go.mod not found in backend/{{NC}}"
    exit 1
fi

# Add Stripe dependency
echo -e "${YELLOW}Installing Stripe Go SDK...${NC}"
go get github.com/stripe/stripe-go/v79
go get github.com/stripe/stripe-go/v79/webhook
go mod tidy

echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# 2. Frontend Setup
echo -e "${BLUE}[2/5]${NC} Setting up Frontend..."

cd ../frontend

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found in frontend/${NC}"
    exit 1
fi

# Install Stripe packages
echo -e "${YELLOW}Installing Stripe React packages...${NC}"
npm install @stripe/react-stripe-js @stripe/js
npm install

echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# 3. Create .env files if they don't exist
echo -e "${BLUE}[3/5]${NC} Creating environment files..."

cd ..

# Backend .env
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Creating backend/.env template...${NC}"
    cat > backend/.env.example << 'EOF'
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here

# Payment Configuration
PAYMENT_SPLIT_PERCENTAGE=70

# Database (already configured)
# DB_URL=...
EOF
    echo -e "${YELLOW}Created backend/.env.example - please update with your Stripe keys${NC}"
fi

# Frontend .env
if [ ! -f "frontend/.env" ]; then
    echo -e "${YELLOW}Creating frontend/.env template...${NC}"
    cat > frontend/.env.example << 'EOF'
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_BASE_URL=http://localhost:8000
EOF
    echo -e "${YELLOW}Created frontend/.env.example - please update with your Stripe keys${NC}"
fi

echo -e "${GREEN}✓ Environment files created${NC}"

# 4. Database Migration
echo -e "${BLUE}[4/5]${NC} Database migration file created..."

if [ -f "supabase/migrations/20260419_001_create_payments_tables.sql" ]; then
    echo -e "${GREEN}✓ Migration file exists at supabase/migrations/20260419_001_create_payments_tables.sql${NC}"
    echo -e "${YELLOW}To apply migration, run:${NC}"
    echo -e "${YELLOW}  psql -U \$DB_USER -d \$DB_NAME -f supabase/migrations/20260419_001_create_payments_tables.sql${NC}"
else
    echo -e "${RED}✗ Migration file not found${NC}"
fi

# 5. Summary
echo -e "${BLUE}[5/5]${NC} Setup complete!"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Payment System Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. ${BLUE}Configure Stripe Keys:${NC}"
echo "   - Get your keys from: https://dashboard.stripe.com/apikeys"
echo "   - Update backend/.env with STRIPE_SECRET_KEY"
echo "   - Update frontend/.env with VITE_STRIPE_PUBLISHABLE_KEY"
echo ""
echo "2. ${BLUE}Apply Database Migration:${NC}"
echo "   psql -U \$DB_USER -d \$DB_NAME -f supabase/migrations/20260419_001_create_payments_tables.sql"
echo ""
echo "3. ${BLUE}Update backend/cmd/server/main.go:${NC}"
echo "   - Register payment routes (see PAYMENT_INTEGRATION.md)"
echo "   - Import payment repositories, usecases, handlers"
echo ""
echo "4. ${BLUE}Run Tests:${NC}"
echo "   cd backend && go test ./internal/usecases -v"
echo "   cd frontend && npm test"
echo ""
echo "5. ${BLUE}Start Development Server:${NC}"
echo "   Backend:  cd backend && go run cmd/server/main.go"
echo "   Frontend: cd frontend && npm run dev"
echo ""
echo "6. ${BLUE}Test Payment Flow:${NC}"
echo "   - Use test card: 4242 4242 4242 4242"
echo "   - Any future expiry date"
echo "   - Any CVC code"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "   - Read: PAYMENT_SYSTEM.md (technical details)"
echo "   - Read: PAYMENT_INTEGRATION.md (step-by-step guide)"
echo "   - Read: IMPLEMENTATION_SUMMARY.md (overview)"
echo ""
echo -e "${BLUE}Need help?${NC}"
echo "   Check the documentation files or visit https://stripe.com/docs"
echo ""
