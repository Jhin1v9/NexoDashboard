# 🐘 Migração JSON → PostgreSQL (Neon)

## Objetivo
Migrar os dados do NEXO Dashboard de arquivos JSON para PostgreSQL (Neon) para garantir persistência no Render free tier.

## Passo a Passo

### 1. Criar banco Neon (5 min)
1. Acesse https://neon.tech
2. Crie uma conta (pode usar GitHub)
3. Crie um novo projeto → copie a **Connection String** (ex: `postgresql://user:pass@host.neon.tech/dbname?sslmode=require`)

### 2. Migrar dados locais para Neon (1 min)
```bash
# No terminal, na pasta do projeto:
cd backend
export DATABASE_URL="postgresql://user:pass@host.neon.tech/dbname?sslmode=require"

# 1. Criar as tabelas
node migrate.js

# 2. Transferir dados dos JSONs para o PostgreSQL
node scripts/migrate-json-to-sql.js
```

> ⚠️ **IMPORTANTE**: Rode isso ANTES de configurar o Render. Os dados dos JSONs locais (que não estão no git) precisam ir para o Neon primeiro.

### 3. Configurar Render (2 min)
1. Vá ao [Render Dashboard](https://dashboard.render.com)
2. Selecione o serviço `nexo-dashboard-pro`
3. Aba **Environment** → adicione:
   - `DATABASE_URL` = a connection string do Neon
4. Faça deploy (push para o GitHub ou manual trigger)

### 4. Verificar (2 min)
Após o deploy, acesse o dashboard e verifique se:
- Login funciona
- Tarefas aparecem
- Dados financeiros estão corretos
- Orçamentos estão visíveis

## Como funciona
- **Sem `DATABASE_URL`**: O sistema funciona 100% com JSON files (modo legado)
- **Com `DATABASE_URL`**: 
  - No startup: restaura dados do PostgreSQL para JSON files (para compatibilidade interna)
  - A cada `writeJSON`: salva no arquivo JSON **e** sincroniza com PostgreSQL (shadow sync)
  - Se o banco está vazio (primeiro deploy): migra dos JSONs para o PostgreSQL automaticamente

## Troubleshooting

### "Database connection failed"
- Verifique se a `DATABASE_URL` está correta
- Neon usa SSL: a URL deve ter `?sslmode=require` ou o driver já configura isso

### "Dados sumiram após deploy"
- Você esqueceu de rodar `migrate-json-to-sql.js` localmente antes do deploy
- Solução: pare o Render, rode a migração localmente, reinicie o Render

### "Quero voltar para JSON puro"
- Simplesmente remova a variável `DATABASE_URL` do Render
- O sistema volta a usar JSON files automaticamente

## Arquivos novos
- `backend/db.js` — conexão PostgreSQL
- `backend/datastore.js` — abstração híbrida PG/JSON
- `backend/pg-sync.js` — sincronização shadow PG ↔ JSON
- `backend/migrations/001-init.sql` — schema das tabelas
- `backend/migrations/002-seed-users.sql` — usuários iniciais
- `backend/migrate.js` — runner de migrations
- `backend/scripts/migrate-json-to-sql.js` — migração de dados
