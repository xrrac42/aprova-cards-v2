# Aprova Cards - Backend API 🎓

> **Desenvolvido por:** Cadu  
> **Linguagem:** Go 1.21+  
> **Status:** Em Desenvolvimento  

---

## 📋 Visão Geral

Aprova Cards é uma plataforma educacional para gerenciamento de cartões de estudo interativos. Este repositório contém o **backend REST API** desenvolvido em **Go com arquitetura limpa**, integrado com **Supabase** para autenticação e banco de dados PostgreSQL.

### Por que Go?
- **Performance:** Compilação nativa, requisições processadas em millisegundos
- **Concorrência:** Goroutines para processamento paralelo
- **Simplicidade:** Sintaxe clara, menos boilerplate que Java/C#
- **Escalabilidade:** Estrutura preparada para lidar com milhares de usuários

---

## 🏗️ Arquitetura Clean Architecture

Este projeto segue **Clean Architecture** com separação clara de responsabilidades:

```
📂 cmd/server/
   └── main.go                 # Ponto de entrada, DI e rotas

📂 internal/
   ├── handlers/               # Layer HTTP (entrada de requisições)
   ├── usecases/               # Layer de negócio (lógica de aplicação)
   ├── repositories/           # Layer de dados (acesso a BD)
   ├── models/                 # Layer de domínio (entidades)
   └── dto/                    # Objetos de transferência (Request/Response)

📂 pkg/
   ├── middleware/             # CORS, Logger, ErrorHandler, RateLimit
   └── errors/                 # Tratamento centralizado de erros

📂 config/
   └── config.go               # Carregamento de variáveis de ambiente
```

### Fluxo de uma Requisição

```
1. CLIENT faz POST /api/v1/samples
   ↓
2. HANDLER recebe JSON, valida com DTO
   ↓
3. USECASE aplica regras de negócio
   ↓
4. REPOSITORY acessa banco via GORM
   ↓
5. DATABASE (Supabase) executa operação
   ↓
6. RESPONSE retorna ao cliente
```

**Cada layer é independente** e testável isoladamente. Não há acoplamento entre camadas.

---

## 🛠️ Stack Tecnológico

| Componente | Tecnologia | Versão | Propósito |
|---|---|---|---|
| **Linguagem** | Go | 1.21+ | Runtime e compilação |
| **Framework HTTP** | Gin | 1.9.1 | Roteamento e middlewares |
| **ORM** | GORM | 1.25.5 | Query builder seguro (SQL injection protection) |
| **Banco de Dados** | PostgreSQL | 12+ | Armazenamento persistente |
| **Autenticação** | Supabase Auth | - | JWT e gerenciamento de usuários |
| **Host BD** | Supabase | - | PostgreSQL gerenciado na nuvem |
| **ID Generation** | google/uuid | 1.5.0 | UUIDs para identificação única |
| **Environment** | joho/godotenv | 1.5.1 | Carregamento de variáveis .env |

---

## 🚀 Começando

### Pré-requisitos

- **Go 1.21+** instalado ([download](https://go.dev/dl))
- **Git** para versionamento
- **Supabase** conta criada ([criar](https://supabase.com))
- **Make** (opcional, para build commands)

### 1️⃣ Clonar o Repositório

```bash
# Clone da branch main (sempre estável)
git clone https://github.com/xrrac42/back-aprova-cards.git
cd back-aprova-cards

# Atualize sempre antes de começar
git pull origin main
```

### 2️⃣ Configurar Variáveis de Ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas credenciais
nano .env  # ou seu editor favorito
```

**Variáveis necessárias:**

```env
# Servidor
SERVER_PORT=8000
SERVER_ENV=development

# Supabase PostgreSQL
DB_HOST=seu-projeto.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_NAME=postgres
DB_SSL_MODE=require

# JWT (Supabase)
JWT_SECRET=sua_chave_jwt_supabase
JWT_EXPIRY=3600

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Rate Limit
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

**Como obter credenciais Supabase:**
1. Acesse [app.supabase.com](https://app.supabase.com)
2. Crie um novo projeto
3. Vá em **Settings → Database** para credenciais
4. Vá em **Settings → API** para JWT_SECRET

### 3️⃣ Instalar Dependências

```bash
# Download das dependências Go
go mod download

# Verifica e organiza go.mod
go mod tidy
```

### 4️⃣ Rodar o Servidor

```bash
# Modo desenvolvimento (com hot-reload via air)
make dev

# Ou direto com Go
go run cmd/server/main.go
```

**Output esperado:**
```
⚡ Servidor iniciando em http://localhost:8000
🗄️  BD conectada com sucesso
✅ Serviço pronto
```

### 5️⃣ Testar a Saúde da API

```bash
# Terminal novo
curl http://localhost:8000/api/v1/health

# Resposta esperada:
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "version": "1.0.0"
  }
}
```

---

## 📦 Estrutura de Projeto Detalhada

### `cmd/server/main.go` - Ponto de Entrada

```go
func main() {
    // 1. Carrega configuração do .env
    config := config.Load()
    
    // 2. Conecta ao Supabase PostgreSQL via GORM
    db := connectDatabase(config)
    
    // 3. Injeta dependências (Repository → UseCase → Handler)
    sampleRepo := repositories.NewSampleRepository(db)
    sampleUseCase := usecases.NewSampleUseCase(sampleRepo)
    sampleHandler := handlers.NewSampleHandler(sampleUseCase)
    
    // 4. Registra rotas
    router := setupRoutes(sampleHandler)
    
    // 5. Inicia servidor
    router.Run(config.ServerPort)
}
```

**O que é Dependency Injection (DI)?**  
DI é passar dependências pelo construtor, não criá-las dentro da função. Vantagens:
- **Testabilidade:** Fácil mockar dependências
- **Flexibilidade:** Trocar implementações facilmente
- **Desacoplamento:** Camadas não se conhecem

### `internal/handlers/` - Camada HTTP

Recebe requisições HTTP e formata respostas.

```go
type SampleHandler struct {
    usecase usecases.SampleUseCase  // Injeção de dependência
}

func (h *SampleHandler) Create(c *gin.Context) {
    var req dto.CreateSampleRequest
    
    // 1. Valida JSON automaticamente (tags: required, email, etc)
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, dto.APIResponse{Success: false, Message: err.Error()})
        return
    }
    
    // 2. Chama UseCase
    result, err := h.usecase.Create(context.Background(), req)
    if err != nil {
        c.JSON(500, dto.APIResponse{Success: false, Error: err.Error()})
        return
    }
    
    // 3. Retorna resposta formatada
    c.JSON(201, dto.APIResponse{Success: true, Data: result})
}
```

**Endpoints disponíveis (exemplos):**

```
GET    /api/v1/health              # Status do servidor
POST   /api/v1/samples             # Criar sample
GET    /api/v1/samples             # Listar samples (paginado)
GET    /api/v1/samples/:id         # Obter um sample
PUT    /api/v1/samples/:id         # Atualizar sample
DELETE /api/v1/samples/:id         # Deletar sample
```

### `internal/usecases/` - Lógica de Negócio

Contém regras de negócio, validações e orquestração.

```go
type SampleUseCase interface {
    Create(ctx context.Context, req dto.CreateSampleRequest) (*dto.SampleResponse, error)
    GetByID(ctx context.Context, id string) (*dto.SampleResponse, error)
    GetAll(ctx context.Context, page, pageSize int) (*dto.PaginatedResponse, error)
    Update(ctx context.Context, id string, req dto.UpdateSampleRequest) (*dto.SampleResponse, error)
    Delete(ctx context.Context, id string) error
}
```

**Exemplo de regra de negócio:**

```go
func (uc *sampleUseCaseImpl) Create(ctx context.Context, req dto.CreateSampleRequest) (*dto.SampleResponse, error) {
    // 1. Valida se email já existe (REGRA DE NEGÓCIO)
    existing, _ := uc.repo.GetByEmail(ctx, req.Email)
    if existing != nil {
        return nil, errors.ErrConflict  // Email duplicado
    }
    
    // 2. Cria entidade de domínio
    entity := &models.SampleEntity{
        Name:  req.Name,
        Email: req.Email,
    }
    
    // 3. Persiste via Repository
    created, err := uc.repo.Create(ctx, entity)
    if err != nil {
        return nil, errors.ErrInternalServer
    }
    
    // 4. Converte para DTO e retorna
    return uc.entityToDTO(created), nil
}
```

### `internal/repositories/` - Acesso a Dados

Encapsula todas as operações com banco de dados via GORM.

```go
type SampleRepository interface {
    Create(ctx context.Context, entity *models.SampleEntity) (*models.SampleEntity, error)
    GetByID(ctx context.Context, id string) (*models.SampleEntity, error)
    GetByEmail(ctx context.Context, email string) (*models.SampleEntity, error)
    GetAll(ctx context.Context, page, pageSize int) ([]*models.SampleEntity, int64, error)
    Update(ctx context.Context, entity *models.SampleEntity) (*models.SampleEntity, error)
    Delete(ctx context.Context, id string) error
}
```

**Implementação com GORM (segura contra SQL injection):**

```go
func (r *sampleRepositoryImpl) GetByID(ctx context.Context, id string) (*models.SampleEntity, error) {
    var entity models.SampleEntity
    
    // GORM usa ? placeholders - seguro contra SQL injection
    result := r.db.WithContext(ctx).
        Where("id = ?", id).     // Parâmetro seguro
        First(&entity)
    
    if result.Error == gorm.ErrRecordNotFound {
        return nil, errors.ErrNotFound
    }
    return &entity, result.Error
}
```

**Por que GORM é seguro:**
- Não faz concatenação de strings SQL
- Usa prepared statements automaticamente
- Sanitiza valores automaticamente

### `internal/models/` - Entidades de Domínio

Representam os dados do banco com validações e hooks.

```go
type SampleEntity struct {
    ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
    Name      string    `gorm:"column:name;type:varchar(255);not null"`
    Email     string    `gorm:"column:email;type:varchar(255);uniqueIndex;not null"`
    Status    string    `gorm:"column:status;type:varchar(50);default:'active'"`
    CreatedAt time.Time `gorm:"autoCreateTime"`
    UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

// Hook GORM - executa antes de criar
func (s *SampleEntity) BeforeCreate(tx *gorm.DB) error {
    if s.ID == "" {
        s.ID = uuid.New().String()
    }
    return nil
}
```

**Tags GORM explicadas:**
- `gorm:"primaryKey"` → Chave primária
- `gorm:"type:uuid"` → Tipo PostgreSQL
- `gorm:"uniqueIndex"` → Índice único (garante unicidade)
- `gorm:"autoCreateTime"` → Timestamp automático
- `gorm:"not null"` → Restrição de banco

### `internal/dto/` - Request/Response Objects

DTOs separam dados internos do contrato API.

```go
// REQUEST (o que o cliente envia)
type CreateSampleRequest struct {
    Name  string `json:"name" binding:"required,min=3,max=255"`
    Email string `json:"email" binding:"required,email"`
}

// RESPONSE (o que o servidor retorna)
type SampleResponse struct {
    ID        string    `json:"id"`
    Name      string    `json:"name"`
    Email     string    `json:"email"`
    Status    string    `json:"status"`
    CreatedAt string    `json:"created_at"`
    UpdatedAt string    `json:"updated_at"`
}

// RESPOSTA GENÉRICA
type APIResponse struct {
    Success bool        `json:"success"`
    Data    interface{} `json:"data,omitempty"`
    Error   string      `json:"error,omitempty"`
    Message string      `json:"message,omitempty"`
}
```

**Validações automáticas (tags):**
- `required` → Campo obrigatório
- `email` → Validação de email
- `min=3,max=255` → Tamanho mínimo/máximo
- `oneof=active,inactive` → Um dos valores

---

## 🔄 Fluxo de Desenvolvimento: Issue → Branch → PR

**Cada issue = Uma feature** implementada em uma branch separada.

### Passo 1: Clonar Main (Sempre!)

```bash
# Atualize a main
git checkout main
git pull origin main

# ✅ Main sempre estável e sincronizada
```

### Passo 2: Criar Branch da Issue

```bash
# Nome da branch segue padrão: issue-XXX-nome-descritivo
git checkout -b issue-1-implementar-login-admin

# Exemplo com número da issue do GitHub
git checkout -b issue-42-crud-mentores
```

**Convenção de nomes:**
- `issue-XXX-` sempre começa com isso
- Use hífens para separar palavras
- Use lowercase
- Seja descritivo

### Passo 3: Desenvolver a Feature

Dentro da sua branch, implemente a feature conforme descrito na issue.

**Estrutura típica:**

```
Issue: [AUTH] Implementar login admin

Implementar:
1. ❌ models/user.go - Entidade User
2. ❌ dto/auth_dto.go - LoginRequest/LoginResponse
3. ❌ repositories/user_repository.go - Buscar usuário por email
4. ❌ usecases/auth_usecase.go - Lógica de autenticação + JWT
5. ❌ handlers/auth_handler.go - Endpoint POST /api/v1/auth/admin-login
6. ❌ Testes unitários
```

### Passo 4: Commits Atômicos

```bash
# Commit small, descriptive messages
git add internal/models/user.go
git commit -m "feat: adicionar modelo User com validações"

git add internal/dto/auth_dto.go
git commit -m "feat: adicionar DTOs de autenticação"

git add internal/repositories/user_repository.go
git commit -m "feat: implementar UserRepository com GetByEmail"

# ... continue ...
```

**Formato de commit (Conventional Commits):**
- `feat:` - Nova feature
- `fix:` - Correção de bug
- `refactor:` - Mudança de código sem alterar comportamento
- `docs:` - Documentação
- `test:` - Testes

### Passo 5: Testar Localmente

```bash
# Rode o servidor em desenvolvimento
go run cmd/server/main.go

# Em outro terminal, teste o endpoint
curl -X POST http://localhost:8000/api/v1/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aprova.com","password":"senha123"}'

# Resposta esperada:
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": "uuid-xxx",
      "email": "admin@aprova.com"
    }
  }
}
```

### Passo 6: Fazer Push e PR

```bash
# Push local para GitHub
git push origin issue-1-implementar-login-admin

# Abra Pull Request (PR) no GitHub
# - Título: "[AUTH] Implementar login admin"
# - Descrição: Resuma o que foi implementado
# - Link a issue: Closes #1
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
2. `go run cmd/server/main.go`
3. POST /api/v1/auth/admin-login com email/password
```

### Passo 7: Review e Merge

- Outro dev review o código
- Após aprovação, merge para main
- **Main sempre fica estável** para próximos desenvolvedores

---

## 🧪 Testes

### Estrutura de Testes

```
📂 tests/
   ├── handlers/
   │   └── auth_handler_test.go
   ├── usecases/
   │   └── auth_usecase_test.go
   ├── repositories/
   │   └── user_repository_test.go
   └── mocks/
       └── repository_mocks.go
```

### Rodando Testes

```bash
# Todos os testes
go test ./...

# Com cobertura
go test -cover ./...

# Saída detalhada
go test -v ./...

# Um arquivo específico
go test -v ./internal/usecases -run TestCreateUser
```

### Exemplo: Teste Unitário (UseCase)

```go
func TestCreateSample(t *testing.T) {
    // Arrange: Preparar dados
    mockRepo := mocks.NewMockSampleRepository()
    usecase := usecases.NewSampleUseCase(mockRepo)
    
    req := dto.CreateSampleRequest{
        Name:  "John",
        Email: "john@example.com",
    }
    
    // Act: Executar função
    result, err := usecase.Create(context.Background(), req)
    
    // Assert: Verificar resultado
    assert.NoError(t, err)
    assert.NotNil(t, result)
    assert.Equal(t, "john@example.com", result.Email)
}
```

---

## 🌍 Variáveis de Ambiente

### `.env.example` (Compartilhado)

```env
# SERVER
SERVER_PORT=8000
SERVER_ENV=development

# DATABASE (Supabase)
DB_HOST=seu-projeto.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua_senha_super_secreta
DB_NAME=postgres
DB_SSL_MODE=require

# JWT (obtém do Supabase)
JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_EXPIRY=3600

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://aprova.com

# RATE LIMIT
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

### ⚠️ Não comitar `.env`!

```bash
# ✅ Correto
git add .env.example
git commit -m "Add .env.example template"

# ❌ NUNCA
git add .env          # Senhas expostas!
git commit -m "Add secrets"
```

---

## 📚 Referências Go para Iniciantes

### Por que Go é Simples?

| Conceito | Go | Python | Java |
|---|---|---|---|
| **Hello World** | 14 linhas | 1 linha | ~10 linhas |
| **Concorrência** | Goroutines (lightweight) | Threads pesadas | Threads pesadas |
| **Deploy** | 1 binário | + Runtime Python | + JVM |
| **Performance** | Nativa (~100ms) | Interpretada (~1000ms) | VM (~200ms) |

### Estrutura Go Básica

```go
package main  // Seu programa Go

import "fmt"  // Importa biblioteca

func main() {  // Função principal
    fmt.Println("Olá, Mundo!")
}
```

### Tipos Básicos

```go
var nome string = "Cadu"      // String
var idade int = 30             // Inteiro
var taxa float64 = 0.99        // Decimal
var ativo bool = true          // Booleano
var ids []string{"1", "2"}     // Array
var user map[string]string = map[string]string{
    "nome": "Cadu",
    "email": "cadu@aprova.com",
}
```

### Interfaces (Importante!)

Interfaces definem contrato de métodos:

```go
// Interface define o que deve ser implementado
type SampleRepository interface {
    Create(ctx context.Context, entity *SampleEntity) error
    GetByID(ctx context.Context, id string) (*SampleEntity, error)
}

// Qualquer struct que implemente esses 2 métodos satisfaz a interface
type PostgresRepository struct { ... }
func (p *PostgresRepository) Create(...) error { ... }
func (p *PostgresRepository) GetByID(...) (*SampleEntity, error) { ... }
```

**Vantagem:** Você pode trocar `PostgresRepository` por `MockRepository` nos testes!

### Receivers (Métodos em Go)

```go
type User struct {
    Name string
}

// Receiver por valor (cópia)
func (u User) Greeting() string {
    return "Oi, sou " + u.Name
}

// Receiver por pointer (referência - modificável)
func (u *User) SetName(name string) {
    u.Name = name  // Modifica original
}
```

---

## 🚨 Erros Comuns e Soluções

### 1. "cannot find module"

```bash
# ❌ Problema: Go não encontra dependência
error: cannot find module for import

# ✅ Solução
go mod download
go mod tidy
```

### 2. "connection refused" (Banco)

```bash
# ❌ Problema: Não conecta ao Supabase
connection refused 127.0.0.1:5432

# ✅ Verificar:
1. DB_HOST está correto? (deve ser seu-projeto.supabase.co)
2. DB_PASSWORD está correto?
3. Supabase está online?
4. Firewall/VPN não está bloqueando?

# ✅ Testar conexão
psql -h seu-projeto.supabase.co -U postgres -d postgres
```

### 3. "invalid character" JSON

```bash
# ❌ Problema: JSON malformado
json: invalid character '}' looking for value

# ✅ Solução: Valide JSON antes de enviar
# Use: https://jsonlint.com/
# Ou no curl: jq para validar
curl -H "Content-Type: application/json" \
     -d '{"name":"test","email":"test@test.com"}' \  # JSON correto
     http://localhost:8000/api/v1/samples
```

### 4. "permission denied" no build

```bash
# ❌ Problema
./bin/approva-cards: permission denied

# ✅ Solução
chmod +x ./bin/approva-cards
./bin/approva-cards
```

---

## 📖 Documentação Extra

### Lertools
- [Go Official Docs](https://golang.org/doc)
- [GORM Documentation](https://gorm.io)
- [Gin Web Framework](https://gin-gonic.com)
- [Supabase Docs](https://supabase.com/docs)

### Tutoriais Go para Iniciantes
- [Go by Example](https://gobyexample.com) - Excelente!
- [Tour of Go](https://tour.golang.org) - Interativo
- [Effective Go](https://golang.org/doc/effective_go) - Boas práticas

---

## 📋 Checklist de Issues

Cada issue no GitHub tem um checklist. **Marque conforme avançar**:

```markdown
## Acceptance Criteria
- [ ] Endpoint implementado
- [ ] Testes unitários
- [ ] Testado localmente
- [ ] Sem warnings de compilação
```

Ao terminar, todas as caixas devem estar ✅

---

## ✨ Resumo para Começar Agora

```bash
# 1. Clone e atualize
git clone https://github.com/xrrac42/back-aprova-cards.git
cd back-aprova-cards
git pull origin main

# 2. Configure ambiente
cp .env.example .env
nano .env  # Adicione credenciais Supabase

# 3. Instale dependências
go mod download
go mod tidy

# 4. Rode servidor
go run cmd/server/main.go

# 5. Teste saúde
curl http://localhost:8000/api/v1/health

# 6. Escolha uma issue do GitHub
# 7. Crie branch: git checkout -b issue-XXX-nome
# 8. Desenvolva, teste, commit
# 9. Push: git push origin issue-XXX-nome
# 10. Abra PR no GitHub
```

---

## 🎯 Próximos Passos

1. **Setup Local** - Configure .env e rode servidor
2. **Estudar Arquitetura** - Leia `cmd/server/main.go`
3. **Escolher Issue** - Pegue um #issue no GitHub
4. **Implementar** - Siga o padrão Handler→UseCase→Repository
5. **Testar** - Rode localmente e escreva testes
6. **PR** - Submeta para review

---

## 🌟 Stack Final

```
🌐 Client (React/Vue)
    ↓ HTTP/REST
🚀 API Gateway (Gin Router)
    ↓
🎯 Handlers (Validação)
    ↓
💼 UseCases (Lógica)
    ↓
🗄️  Repositories (GORM)
    ↓
📊 Supabase PostgreSQL
```

---

**Dúvidas?** Abra uma issue no GitHub ou entre em contato.

**Status:** 🚀 Em desenvolvimento ativo - 26 issues para resolver

---

*Desenvolvido por **Cadu** | Aprova Cards © 2024*

