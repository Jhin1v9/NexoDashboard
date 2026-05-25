# 🆘 Alternativas Gratuitas — Neon Quota Excedida

> Problema: `Your project has exceeded the data transfer quota. Upgrade your plan to increase limits.`
>
> O Neon free tier tem **5GB/mês de data transfer** (não é storage, é tráfego de dados).
> Com 22 tabelas e queries frequentes, estoura rápido.

---

## ⚡ Opção Rápida 1: PostgreSQL Local (RECOMENDADO para desenvolvimento)

**Grátis para sempre. Zero dependência de internet.**

### Passo 1: Instalar PostgreSQL local

```bash
# Ubuntu/Debian/WSL
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql

# Criar usuário e banco
sudo -u postgres psql -c "CREATE USER nexo WITH PASSWORD 'nexo123';"
sudo -u postgres psql -c "CREATE DATABASE nexodb OWNER nexo;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE nexodb TO nexo;"
```

Ou rode o script pronto:
```bash
./setup-local-pg.sh
```

### Passo 2: Aplicar schema

```bash
# Aplica o schema completo (migration 005)
psql postgres://nexo:nexo123@localhost:5432/nexodb < backend/migrations/005-real-schema.sql

# (Opcional) Seed de usuários
psql postgres://nexo:nexo123@localhost:5432/nexodb < backend/migrations/002-seed-users.sql
```

### Passo 3: Rodar backend apontando para local

```bash
cd backend
DATABASE_URL="postgres://nexo:nexo123@localhost:5432/nexodb" node server.js
```

Ou crie um `.env.local`:
```
DATABASE_URL=postgres://nexo:nexo123@localhost:5432/nexodb
```

---

## ☁️ Opção 2: Render PostgreSQL (RECOMENDADO para produção)

**1GB storage, free tier NUNCA expira.**

1. Acesse: https://dashboard.render.com
2. New → PostgreSQL
3. Nome: `nexo-db`
4. Plan: **Free** (1 GB, shared CPU)
5. Crie → copie a Internal Connection String
6. Cole no `.env` do Render (ou local):
   ```
   DATABASE_URL=postgres://nexo_user:senha@dpg-xxxxx.render.com/nexo_db
   ```

| Feature | Neon Free | Render Free |
|---------|-----------|-------------|
| Storage | 0.5 GB | **1 GB** |
| Data Transfer | **5 GB/mês** | Ilimitado |
| Computação | 191 horas/mês | Sempre on |
| Expira? | Não | **Nunca** |
| Branching | ✅ | ❌ |

**Vantagem do Render:** Sem limite de data transfer. Ideal para apps com muitas queries.

---

## 🆕 Opção 3: Novo Projeto Neon

Se a quota é por **projeto**, criar um novo projeto = **nova quota de 5GB**.

1. Vá em https://console.neon.tech
2. New Project
3. Escolha a mesma região
4. Copie a nova connection string
5. Atualize `DATABASE_URL`

⚠️ **Cuidado:** Se o problema for volume de queries, vai estourar de novo em pouco tempo.

---

## 🔥 Opção 4: Supabase (PostgreSQL real + BaaS)

**500MB storage, 2 projetos gratuitos.**

1. https://supabase.com
2. New Project
3. Database password: defina uma
4. Settings → Database → Connection String (URI)
5. Use no `.env`:
   ```
   DATABASE_URL=postgresql://postgres:senha@db.xxx.supabase.co:5432/postgres
   ```

⚠️ Free tier **pausa após 7 dias de inatividade**. Despausar é automático mas leva ~30s.

---

## 💡 Opção 5: Reduzir Consumo do Neon (Manter Neon)

Se quiser continuar no Neon mas evitar estourar a quota:

### 5.1 — Adicionar Cache de Queries

```bash
npm install node-cache
```

Cachear queries frequentes (users, tarefas pendentes) por 30-60s reduz drasticamente o tráfego.

### 5.2 — Batch de Writes

Em vez de `saveUser()` a cada request, acumule mudanças e salve a cada 5s.

### 5.3 — Desativar WebSocket em Dev

O WebSocket constante gera queries de keep-alive. Desative para desenvolvimento:
```bash
WEBSOCKET_ENABLED=false node server.js
```

### 5.4 — Menos Polling no Frontend

Reduza o intervalo de refresh automático no frontend (ex: de 5s para 30s).

---

## 🐳 Opção Bônus: Docker (se tiver Docker instalado)

```bash
# Sobe PostgreSQL com um comando
docker compose -f docker-compose.dev.yml up -d

# Schema já é aplicado automaticamente via volume
# Acesse: postgres://nexo:nexo123@localhost:5432/nexodb
```

---

## 📊 Comparativo Final

| Opção | Custo | Setup | Data Transfer | Ideal Para |
|-------|-------|-------|---------------|------------|
| **PostgreSQL Local** | R$0 | 5 min | Ilimitado | Desenvolvimento diário |
| **Render Free** | R$0 | 10 min | Ilimitado | **Produção** (replace Neon) |
| **Novo Neon** | R$0 | 5 min | 5 GB/mês | Paliativo temporário |
| **Supabase Free** | R$0 | 10 min | Ilimitado | Se precisar de auth/storage |
| **Neon + Cache** | R$0 | 30 min | ~2-3 GB/mês | Quer manter Neon |

---

## 🚀 Minha Recomendação

1. **Agora (desbloquear dev):** PostgreSQL local → `./setup-local-pg.sh`
2. **Produção (migrar do Neon):** Render PostgreSQL Free → nunca expira, sem limite de transferência
3. **Futuro:** Implementar cache no backend para reduzir queries (economiza qualquer banco)

---

## ❓ Perguntas Frequentes

**Q: Perdo meus dados do Neon?**
R: Não. Exporte com `pg_dump` antes de trocar:
```bash
pg_dump "sua-connection-string-neon" > backup-neon.sql
psql "nova-connection-string" < backup-neon.sql
```

**Q: Posso usar SQLite em vez de PostgreSQL?**
R: Tecnicamente sim, mas exige adaptar `datastore-pg.js`. Não recomendo — PostgreSQL local é quase tão fácil.

**Q: E o Render? Já deployo lá.**
R: Perfeito! Render tem PostgreSQL nativo free tier. É a migração mais natural.
