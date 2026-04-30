# 🚀 Guia de Deployment - Aprova Cards

## 📋 Pré-requisitos

- KVM na Hostinger com Linux (Ubuntu/Debian recomendado)
- Usuário com acesso SSH
- Chave SSH configurada
- Domínio apontado para a KVM

---

## 1️⃣ CONFIGURAR STRIPE WEBHOOK

### Via Dashboard Stripe (Produção)

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique **"Add an endpoint"**
3. **Endpoint URL**: `https://seu-dominio.com/api/v1/webhooks/stripe`
4. **Eventos a ouvir**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Clique **"Add endpoint"**
6. Copie o **Signing Secret** (começa com `whsec_`)

### Guardar este secret em: `STRIPE_WEBHOOK_SECRET` no .env

---

## 2️⃣ COLETAR SUAS CHAVES DE AMBIENTE

Você precisa ter:

### **Supabase** (BD + Auth)
- `DB_HOST` - seu-projeto.supabase.co
- `DB_PASSWORD` - senha do postgres
- `SUPABASE_URL` - URL da API
- `SUPABASE_SERVICE_ROLE_KEY` - chave de serviço (admin)
- `VITE_SUPABASE_URL` - mesma URL para frontend
- `VITE_SUPABASE_PUBLISHABLE_KEY` - chave anon/pública

### **Stripe**
- `STRIPE_SECRET_KEY` - sk_live_...
- `STRIPE_PUBLISHABLE_KEY` - pk_live_...
- `STRIPE_WEBHOOK_SECRET` - whsec_... (copiado acima)

### **Backend**
- `JWT_SECRET` - gerar token seguro: `openssl rand -hex 32`
- `ADMIN_EMAIL` e `ADMIN_PASSWORD` - seu acesso admin
- `CORS_ALLOWED_ORIGINS` - seu domínio

### **Email (opcional)**
- `SMTP_HOST` - smtp.gmail.com
- `SMTP_PORT` - 587
- `SMTP_FROM` - seu-email@gmail.com
- `SMTP_PASSWORD` - app-specific password do Gmail

---

## 3️⃣ CONFIGURAR GITHUB SECRETS

Execute na sua máquina local:

```bash
# Instalar GitHub CLI se não tiver
brew install gh

# Login
gh auth login

# Configurar secrets (substitua pelos seus valores reais)
gh secret set DEPLOY_HOST --body "192.168.x.x"  # IP da KVM
gh secret set DEPLOY_USER --body "root"         # usuário SSH
gh secret set DEPLOY_PORT --body "22"           # porta SSH (se não for 22)

# Chave SSH privada
gh secret set DEPLOY_KEY < ~/.ssh/id_rsa
```

**Ou via Dashboard:**
https://github.com/xrrac42/aprova-cards-v2/settings/secrets/actions

---

## 4️⃣ CONFIGURAR .env NA KVM

SSH na sua KVM:

```bash
ssh -i ~/.ssh/id_rsa root@192.168.x.x
# ou
ssh root@seu-dominio.com
```

Criar pasta do projeto:

```bash
mkdir -p /home/aprova-deploy/aprova-cards-v2
cd /home/aprova-deploy/aprova-cards-v2
```

Clonar repositório:

```bash
git clone https://github.com/xrrac42/aprova-cards-v2.git .
```

Criar .env com suas variáveis:

```bash
nano .env
```

Copie e cole seu arquivo `.env` com todos os valores preenchidos.

**Proteger:**
```bash
chmod 600 .env
```

---

## 5️⃣ CONFIGURAR SYSTEMD SERVICES (AUTO-RESTART)

Criar serviço do backend:

```bash
sudo tee /etc/systemd/system/aprova-backend.service > /dev/null << 'EOF'
[Unit]
Description=Aprova Cards Backend
After=network.target

[Service]
Type=simple
User=aprova-deploy
WorkingDirectory=/home/aprova-deploy/aprova-cards-v2/backend
EnvironmentFile=/home/aprova-deploy/aprova-cards-v2/.env
ExecStart=/home/aprova-deploy/aprova-cards-v2/backend/main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

Criar serviço do frontend (nginx):

```bash
sudo tee /etc/systemd/system/aprova-frontend.service > /dev/null << 'EOF'
[Unit]
Description=Aprova Cards Frontend (Nginx)
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/sbin/nginx -c /etc/nginx/aprova.conf
RemainAfterExit=yes
ExecReload=/usr/sbin/nginx -s reload
ExecStop=/usr/sbin/nginx -s quit
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

Ativar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable aprova-backend aprova-frontend
sudo systemctl start aprova-backend aprova-frontend
```

---

## 6️⃣ CONFIGURAR NGINX

```bash
sudo tee /etc/nginx/sites-available/aprova > /dev/null << 'EOF'
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    # Redirecionar HTTP para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com www.seu-dominio.com;

    # SSL (gerar com Certbot)
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;

    # Frontend - serve dist
    location / {
        root /home/aprova-deploy/aprova-cards-v2/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/v1 {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/aprova /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7️⃣ CERTIFICADO SSL (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt-get install certbot python3-certbot-nginx

# Gerar certificado
sudo certbot certonly --nginx -d seu-dominio.com -d www.seu-dominio.com

# Auto-renovação
sudo systemctl enable certbot.timer
```

---

## 8️⃣ CONFIGURAR STRIPE WEBHOOK CLI (Teste Local)

Se quiser testar antes de ir para produção:

```bash
# Instalar
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:8080/api/v1/webhooks/stripe
```

Copie o `webhook signing secret` gerado e coloque em `STRIPE_WEBHOOK_SECRET`

---

## ✅ CHECKLIST FINAL

- [ ] Chaves Stripe geradas
- [ ] Webhook Stripe configurado em https://seu-dominio.com/api/v1/webhooks/stripe
- [ ] GitHub Secrets configurados (DEPLOY_HOST, DEPLOY_USER, DEPLOY_KEY)
- [ ] .env criado na KVM com todas variáveis preenchidas
- [ ] SSH key funcionando (teste: `ssh root@seu-dominio.com`)
- [ ] Serviços systemd criados e ativos
- [ ] Nginx configurado
- [ ] SSL ativo
- [ ] Domínio apontado para KVM

---

## 🚀 PRIMEIRO DEPLOY

Faça um push para `main`:

```bash
git add .
git commit -m "chore: setup deployment pipeline"
git push origin main
```

A pipeline GitHub Actions executará automaticamente!

Acompanhe em: https://github.com/xrrac42/aprova-cards-v2/actions

---

## 📊 MONITORAMENTO

Ver logs do backend:
```bash
sudo journalctl -u aprova-backend -f
```

Ver logs do nginx:
```bash
sudo tail -f /var/log/nginx/error.log
```

---

## 🆘 TROUBLESHOOTING

**"Permission denied" ao fazer deploy?**
```bash
sudo chown -R aprova-deploy:aprova-deploy /home/aprova-deploy/aprova-cards-v2
```

**Port 8080 já em uso?**
```bash
sudo lsof -i :8080
sudo kill -9 <PID>
```

**Webhook não funciona?**
```bash
# Testar conexão
curl -X POST https://seu-dominio.com/api/v1/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

**Dúvidas? Me chama!** 🚀
