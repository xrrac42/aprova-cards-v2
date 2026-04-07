# ============================================================
# Frontend Dockerfile - Multi-stage build
# Final image: ~25MB (nginx alpine)
# ============================================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /build

# Build args for Vite (become VITE_* env vars at build time)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_API_BASE_URL

# Cache dependencies
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Build app
COPY . .
RUN npm run build

# ---- Stage 2: Runtime ----
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check for container orchestrators
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
