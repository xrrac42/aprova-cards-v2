# Aprova Cards - Monorepo 🎓

> **Plataforma educacional de cartões de estudo interativos**  
> **Stack:** Go + React + Supabase  
> **Status:** Em Desenvolvimento  

---

## 📋 Visão Geral

Aprova Cards é uma plataforma educacional para gerenciamento de cartões de estudo interativos. Este monorepo contém o **backend REST API** em Go, o **frontend SPA** em React/TypeScript e a infraestrutura de deploy para Coolify/VPS.

---

## 🏗️ Arquitetura do Monorepo

```
aprova-cards/
├── backend/                    # API REST em Go (Gin + GORM + Clean Architecture)
│   ├── cmd/server/             # Ponto de entrada, DI e rotas
│   │   └── main.go
│   ├── config/                 # Carregamento de variáveis de ambiente
│   │   └── config.go
│   ├── internal/               # Código privado do backend
│   │   ├── handlers/           # Layer HTTP (entrada de requisições)
│   │   │   ├── health_handler.go   # Health check real com ping no Supabase
│   │   │   └── sample_handler.go   # CRUD de exemplo
│   │   ├── usecases/           # Layer de negócio (lógica de aplicação)
│   │   ├── repositories/       # Layer de dados (acesso a BD via GORM)
│   │   ├── models/             # Layer de domínio (entidades)
│   │   └── dto/                # Objetos de transferência (Request/Response)
│   │       ├── dto.go
│   │       └── health_dto.go
│   ├── pkg/                    # Código compartilhável
│   │   ├── middleware/         # CORS, Logger, ErrorHandler, RateLimit
│   │   └── errors/             # Tratamento centralizado de erros
│   ├── Dockerfile              # Multi-stage → distroless (~15MB)
│   ├── Makefile
│   ├── go.mod
│   └── go.sum
│
├── frontend/                   # SPA React (Vite + TypeScript + Tailwind + shadcn/ui)
│   ├── src/
│   │   ├── components/         # Componentes reutilizáveis + shadcn/ui
│   │   ├── pages/              # Páginas (admin/, mentor/, student/)
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilitários (auth, theme, spaced-repetition)
│   │   ├── integrations/       # Cliente Supabase
│   │   ├── types/              # TypeScript types
│   │   ├── App.tsx             # Rotas da aplicação
│   │   └── main.tsx            # Entrypoint
│   ├── public/                 # Assets estáticos
│   ├── nginx.conf              # Config de produção (SPA + reverse proxy)
│   ├── Dockerfile              # Multi-stage → nginx:alpine (~25MB)
│   ├── vite.config.ts          # Dev server + proxy /api → backend
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── supabase/                   # Infraestrutura como código
│   ├── migrations/             # SQL migrations do banco
│   ├── functions/              # Edge Functions (webhooks, AI, admin checks)
│   └── config.toml
│
├── deploy/                     # Configurações de deploy
│   └── docker-compose.yml      # Orquestração para Coolify/VPS
│
├── .env.example                # Template de variáveis de ambiente
├── .gitignore
├── Makefile                    # Orquestra todo o monorepo
└── README.md                   # Este arquivo
```

### Fluxo de uma Requisição

```
1. CLIENT (React SPA) faz POST /api/v1/samples
   ↓
2. VITE PROXY (dev) ou NGINX (prod) encaminha para o backend
   ↓
3. GIN MIDDLEWARES (CORS, Logger, RateLimit, ErrorHandler)
   ↓
4. HANDLER recebe JSON, valida com DTO
   ↓
5. USECASE aplica regras de negócio
   ↓
6. REPOSITORY acessa banco via GORM
   ↓
7. SUPABASE PostgreSQL executa operação
   ↓
8. RESPONSE retorna ao cliente
```

**Cada layer é independente** e testável isoladamente. Não há acoplamento entre camadas.

---

## 🛠️ Stack Tecnológico

### Backend

| Componente | Tecnologia | Propósito |
|---|---|---|
| **Linguagem** | Go 1.21+ | Runtime compilado, alta performance |
| **Framework HTTP** | Gin | Roteamento e middlewares |
| **ORM** | GORM | Query builder seguro (SQL injection protection) |
| **Banco de Dados** | PostgreSQL (Supabase) | Armazenamento persistente na nuvem |
| **ID Generation** | google/uuid | UUIDs para identificação única |
| **Environment** | joho/godotenv | Carregamento de variáveis .env |

### Frontend

| Componente | Tecnologia | Propósito |
|---|---|---|
| **Framework** | React 18 | UI reativa |
| **Linguagem** | TypeScript | Tipagem estática |
| **Build Tool** | Vite | Dev server rápido + HMR |
| **Styling** | Tailwind CSS + shadcn/ui | Design system |
| **Roteamento** | React Router v6 | SPA routing |
| **State** | TanStack Query | Cache e fetching |
| **Auth/DB** | Supabase JS | Cliente para Supabase |

### Infraestrutura

| Componente | Tecnologia | Propósito |
|---|---|---|
| **Containers** | Docker (multi-stage) | Build otimizado |
| **Orquestração** | Docker Compose | Deploy simplificado |
| **Hosting** | Coolify (VPS) | PaaS self-hosted |
| **Web Server** | Nginx Alpine | Serve SPA + reverse proxy |
| **Backend Image** | Distroless | Segurança (sem shell) |

---

## 🚀 Começando

### Pré-requisitos

- **Go 1.21+** instalado ([download](https://go.dev/dl))
- **Node.js 20+** instalado ([download](https://nodejs.org))
- **Git** para versionamento
- **Supabase** conta criada ([criar](https://supabase.com))
- **Docker + Docker Compose** (apenas para deploy)

### 1️⃣ Clonar o Repositório

```bash
git clone https://github.com/xrrac42/aprova-cards.git
cd aprova-cards
git pull origin main
```

### 2️⃣ Configurar Variáveis de Ambiente

```bash
cp .env.example .env
nano .env  # Preencha com suas credenciais

# Criar symlink para o backend acessar o .env da raiz
ln -s ../.env backend/.env
```

**Variáveis necessárias:**

```env
# Servidor
SERVER_PORT=8080
SERVER_ENV=development

# Supabase PostgreSQL (via Session Pooler)
DB_HOST=aws-0-sa-east-1.pooler.supabase.com
DB_PORT=5432
DB_USER=postgres.SEU_PROJECT_REF
DB_PASSWORD=sua_senha
DB_NAME=postgres
DB_SSL_MODE=require

# JWT
JWT_SECRET=sua_chave_jwt_supabase
JWT_EXPIRATION=3600

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Rate Limit
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_SECONDS=60

# Frontend (Vite)
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

**Como obter credenciais Supabase:**
1. Acesse [app.supabase.com](https://app.supabase.com)
2. **Settings → Database → Connection string → Session pooling** para DB_HOST, DB_USER, DB_PASSWORD
3. **Settings → API** para VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY

### 3️⃣ Instalar Dependências

```bash
make install
```

### 4️⃣ Rodar em Desenvolvimento

```bash
make dev
```

**Output esperado:**
```
Starting backend and frontend...
✅ Database connected successfully
✅ Routes registered successfully
🚀 Server running on http://localhost:8080

  VITE v5.4.21  ready in 200 ms
  ➜  Local:   http://localhost:5173/
```

O backend sobe em `http://localhost:8080` e o frontend em `http://localhost:5173`.
O proxy do Vite redireciona `/api/*` automaticamente para o backend.

### 5️⃣ Testar a Saúde da API

```bash
make health

# Ou diretamente
curl http://localhost:8080/api/v1/health
```

**Resposta quando tudo está OK:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-04-07T12:00:00Z",
    "version": "1.0.0",
    "uptime": "2h30m15s",
    "checks": {
      "database": {
        "status": "up",
        "latency": "12.345ms",
        "open_connections": 5,
        "in_use_connections": 1,
        "idle_connections": 4
      }
    }
  },
  "message": "Health check completed"
}
```

**Quando o banco está fora (HTTP 503):**
```json
{
  "success": false,
  "data": {
    "status": "degraded",
    "checks": {
      "database": {
        "status": "down",
        "latency": "5.001s",
        "error": "database ping failed: connection refused"
      }
    }
  },
  "message": "Health check completed"
}
```

---

## 📦 Endpoints da API

```
GET    /api/v1/health              # Health check (banco + server)
POST   /api/v1/samples             # Criar sample
GET    /api/v1/samples             # Listar samples (?page=1&page_size=10)
GET    /api/v1/samples/:id         # Obter um sample
PUT    /api/v1/samples/:id         # Atualizar sample
DELETE /api/v1/samples/:id         # Deletar sample
```

**Resposta padrão da API:**
```json
{
  "success": true,
  "data": {},
  "error": "",
  "message": ""
}
```

---

## 🐳 Deploy (Coolify / VPS)

```bash
# Build e sobe os containers
make docker-up

# Para os containers
make docker-down
```

A stack em produção:
- **frontend** (nginx:alpine, porta 80) → serve o SPA e faz proxy reverso para `/api/*`
- **backend** (distroless, porta 8080) → API Go conectando ao Supabase
- Sem container de banco — o PostgreSQL é gerenciado pelo Supabase

**Segurança do deploy:**
- Backend roda em imagem distroless (sem shell, sem package manager)
- Frontend servido por Nginx com security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- Assets estáticos com cache imutável de 1 ano (fingerprinted)
- Health checks configurados para auto-restart

---

## 📋 Comandos Disponíveis

| Comando | Descrição |
|---|---|
| `make install` | Instala dependências do Go e Node |
| `make dev` | Roda backend + frontend em paralelo |
| `make dev-back` | Roda só o backend |
| `make dev-front` | Roda só o frontend |
| `make build` | Builda ambos os projetos |
| `make build-back` | Builda só o binário Go |
| `make build-front` | Builda só os assets do frontend |
| `make test` | Roda todos os testes |
| `make test-back` | Testes Go com race detection |
| `make test-front` | Testes Vitest |
| `make lint` | Linta ambos os projetos |
| `make clean` | Remove artefatos de build |
| `make docker-up` | Sobe com Docker Compose |
| `make docker-down` | Para Docker Compose |
| `make health` | Testa o endpoint de health |

---

## 🔄 Fluxo de Desenvolvimento: Issue → Branch → PR

**Cada issue = Uma feature** implementada em uma branch separada.

### Passo 1: Sincronizar Main

```bash
git checkout main
git pull origin main
```

### Passo 2: Criar Branch da Issue

```bash
# Padrão: issue-XXX-nome-descritivo
git checkout -b issue-1-implementar-login-admin
```

**Convenção de nomes:**
- Sempre começar com `issue-XXX-`
- Hífens para separar palavras
- Lowercase
- Seja descritivo

### Passo 3: Desenvolver a Feature

Dentro da sua branch, implemente seguindo a Clean Architecture:

```
Issue: [AUTH] Implementar login admin

Implementar:
1. models/user.go         → Entidade User
2. dto/auth_dto.go        → LoginRequest/LoginResponse
3. repositories/user_repository.go → Buscar usuário por email
4. usecases/auth_usecase.go       → Lógica de autenticação + JWT
5. handlers/auth_handler.go       → Endpoint POST /api/v1/auth/admin-login
6. Testes unitários
```

### Passo 4: Commits Atômicos (Conventional Commits)

```bash
git commit -m "feat: adicionar modelo User com validações"
git commit -m "fix: corrigir validação de email no login"
git commit -m "refactor: extrair lógica de JWT para pkg"
git commit -m "docs: atualizar README com endpoints de auth"
git commit -m "test: adicionar testes unitários do AuthUseCase"
```

### Passo 5: Push e Pull Request

```bash
git push origin issue-1-implementar-login-admin
# Abra PR no GitHub linkando a issue: "Closes #1"
```

**Template de PR:**
```markdown
## 📝 Descrição
Implementa autenticação de admin com JWT

## 🔗 Issue
Closes #1

## ✅ Checklist
- [x] Código implementado
- [x] Testes escritos
- [x] Testado localmente
- [x] Sem warnings de compilação

## 🧪 Como testar
1. Clonar branch
2. `make dev`
3. POST /api/v1/auth/admin-login com email/password
```

---

## 🧪 Testes

```bash
# Todos os testes
make test

# Apenas backend (com race detection e coverage)
make test-back

# Apenas frontend
make test-front
```

---

## 🚨 Erros Comuns e Soluções

### "connection refused" (Banco)
```bash
# Verificar:
# 1. .env está com DB_HOST correto? (pooler.supabase.com, NÃO localhost)
# 2. Symlink existe? ls -la backend/.env
# 3. DB_USER tem o project ref? (postgres.XXXXXX)
# 4. Supabase está online?

# Recriar symlink se necessário:
ln -sf ../.env backend/.env
```

### "vite: not found"
```bash
cd frontend && npm install
```

### "go: not found"
```bash
wget https://go.dev/dl/go1.23.4.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.23.4.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
```

### "npm ci" falha sem lockfile
```bash
cd frontend && npm install  # Gera package-lock.json
```

---

## 🤖 Regras para Agentes de IA / LLMs

> **Instruções para Cursor, Claude Code, GitHub Copilot, Windsurf e qualquer agente que trabalhe neste repositório.**

### Arquitetura e Padrões

1. **Clean Architecture obrigatória** — Todo código backend DEVE seguir: `Handler → UseCase → Repository → Model`. Nunca acesse o banco diretamente de um handler. Nunca coloque lógica de negócio no handler.

2. **Novos endpoints seguem o padrão existente:**
   - Criar `internal/models/nome_model.go` (entidade GORM)
   - Criar `internal/dto/nome_dto.go` (Request/Response separados)
   - Criar `internal/repositories/nome_repository.go` (interface + implementação)
   - Criar `internal/usecases/nome_usecase.go` (interface + implementação)
   - Criar `internal/handlers/nome_handler.go` (handlers Gin)
   - Registrar rotas em `cmd/server/main.go` no `setupRoutes()`

3. **Um arquivo por domínio** — Não misture entidades em um único arquivo. `user.go`, `mentor.go`, `product.go` são arquivos separados.

4. **DTOs nunca expõem o modelo interno** — Sempre converta Model ↔ DTO. Nunca retorne um Model diretamente no JSON.

5. **Interfaces para tudo que é injetado** — Repositories e UseCases DEVEM ter interfaces definidas. Isso permite mock nos testes.

### Segurança

6. **Nunca use concatenação de strings para SQL** — Use apenas GORM query builder com `?` placeholders. Nunca `fmt.Sprintf` para queries.

7. **Nunca logue ou exponha credenciais** — Não faça `fmt.Println(config.Database.Password)`. Não retorne senhas em responses.

8. **Validação no DTO, não no handler** — Use binding tags do Gin: `binding:"required,email"`, `binding:"required,min=3"`.

9. **Variáveis sensíveis somente via .env** — Nunca hardcode secrets. Todo valor configurável vem de `config.Load()`.

10. **CORS restrito** — Não use `*` em produção. Configure explicitamente em `CORS_ALLOWED_ORIGINS`.

### Frontend

11. **Imports com alias @** — Sempre use `@/components/...`, `@/lib/...`, `@/hooks/...`. Nunca imports relativos longos como `../../../`.

12. **Supabase client único** — Use `import { supabase } from "@/integrations/supabase/client"`. Nunca instancie outro client.

13. **Lazy loading para páginas** — Todas as páginas (exceto Login) usam `React.lazy()` + `Suspense`. Não importe páginas de forma síncrona.

14. **shadcn/ui para componentes de UI** — Não crie componentes de UI do zero. Use os componentes em `@/components/ui/`.

15. **Variáveis de ambiente com VITE_** — Toda env var do frontend DEVE começar com `VITE_`. Acesse via `import.meta.env.VITE_*`.

### Qualidade de Código

16. **Testes para todo UseCase** — Toda lógica de negócio deve ter teste unitário. Use mocks para repositories.

17. **Tratamento de erros explícito** — Nunca ignore erros em Go (`_ = someFunc()`). Sempre trate ou retorne.

18. **Conventional Commits** — Mensagens de commit: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.

19. **Não modifique o health endpoint** — O `/api/v1/health` é usado pelo Coolify para health checks. Mudanças podem derrubar o deploy.

20. **Não remova dependências sem verificar** — Antes de remover um pacote, grep no projeto inteiro. O frontend tem muitos componentes shadcn/ui que dependem de @radix-ui.

### Deploy e Infraestrutura

21. **Docker multi-stage obrigatório** — Backend: `golang:alpine` → `distroless`. Frontend: `node:alpine` → `nginx:alpine`. Nunca use imagens de build como runtime.

22. **Sem binários no Git** — Nunca commite `backend/bin/`, `frontend/dist/`, `node_modules/`. O `.gitignore` já cobre isso.

23. **Migrations no Supabase** — Mudanças de schema vão em `supabase/migrations/`. Nunca altere o banco manualmente sem migration.

---

## 📚 Referências

- [Go Official Docs](https://golang.org/doc)
- [GORM Documentation](https://gorm.io)
- [Gin Web Framework](https://gin-gonic.com)
- [Vite Documentation](https://vitejs.dev)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## 🌟 Stack Final

```
🌐 React SPA (Vite + TypeScript + Tailwind)
    ↓ HTTP /api/*
🔀 Nginx (prod) ou Vite Proxy (dev)
    ↓
🚀 Gin Router + Middlewares (CORS, Logger, RateLimit)
    ↓
🎯 Handlers (Validação de DTOs)
    ↓
💼 UseCases (Lógica de Negócio)
    ↓
🗄️  Repositories (GORM)
    ↓
📊 Supabase PostgreSQL (Session Pooler)
```

---

**Dúvidas?** Abra uma issue no GitHub.

**Status:** 🚀 Em desenvolvimento ativo

---

*Aprova Cards © 2024*
