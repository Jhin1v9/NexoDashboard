# 🛡️ PLANO NEXO DASHBOARD PRO — Documento Vivo

> **LEIA ESTE ARQUIVO PRIMEIRO** antes de qualquer ação no projeto.  
> Este documento mantém o estado atual, decisões aprovadas e próximos passos.  
> **Atualizado:** 2026-05-19 20:35 UTC

---

## 📌 Estado Atual

| Área | Status |
|------|--------|
| Backend (local) | ✅ Rodando com hardening de segurança aplicado |
| Backend (Render) | ✅ Deploy concluído — hardening ativo |
| Frontend (local) | ✅ OK |
| Frontend (Render) | ✅ OK |

---

## ✅ Concluído (Aprovado)

### Fase Segurança — Parte 1 (Commits `19dba35` → `8ffd2f1`)
- [x] **Middleware global de auth** protege TODAS as rotas `/api/*` por padrão
- [x] **CORS restrito** — apenas origens permitidas (não mais `*`)
- [x] **JWT_SECRET** — remove fallback hardcoded, gera aleatório se não definido
- [x] **Remove `/api/debug/gmail-config`** — endpoint que expunha credenciais OAuth
- [x] **Rate limiting no login** — max 5 tentativas/15min, bloqueio 30min
- [x] Testado localmente: sem token → 401, com token → 200, rate limit → 429
- [x] **Testado em produção** — todas as rotas retornam 401 sem auth ✅

---

## 🔒 Pendente de Aprovação / Próximos Passos

### Fase Segurança — Parte 2 (AGUARDANDO APROVAÇÃO)
- [ ] **Página de login tradicional** — substituir o terminal secreto/Konami code
- [ ] **Criptografia em repouso** — `gmail-tokens.json`, `email-config.json`
- [ ] **Path traversal fix** — workspace file access (`../` bypass)
- [ ] **Source maps** — desabilitar em produção (bundle JS exposto)
- [ ] **HTTP headers de segurança** — HSTS, X-Frame-Options, CSP, etc.
- [ ] **Audit log persistente** — security log no PostgreSQL (não JSON)

### Fase Migração de Dados (AGUARDANDO APROVAÇÃO)
- [ ] Migrar `tasks.json` → PostgreSQL
- [ ] Migrar `leads.json` → PostgreSQL
- [ ] Migrar `payments.json` → PostgreSQL
- [ ] Migrar `expenses.json` → PostgreSQL
- [ ] Migrar `cash-box.json` → PostgreSQL
- [ ] Migrar `quotes.json` → PostgreSQL
- [ ] Migrar `ideas-registry.json` → PostgreSQL
- [ ] Manter em JSON (volátil): `cache/*`, `dev-servers.json`, `nexo-news.json`

### Fase Terminal Secreto — Decisão Pendente
**Opção A (Recomendada):** Página `/login` tradicional com email/senha  
**Opção B:** Manter terminal mas gerar código dinamicamente no backend  
**Opção C:** Manter como está (NÃO RECOMENDADO — bundle JS exposto)

---

## 🚨 Decisões Críticas Tomadas

1. **Render plano free = filesystem efêmero** → dados em JSON são perdidos após sleep/wake
2. **PostgreSQL (Neon) já configurado** → apenas `users` usa hoje
3. **180 rotas estavam sem auth** → corrigido com middleware global
4. **Senha padrão "7741"** — 4 dígitos, vulnerável a brute force (rate limit mitiga parcialmente)

---

## 🧪 Como Testar Segurança (Pentest Ético)

```bash
# Verificar se rotas estão protegidas (deve retornar 401)
curl https://nexodashboard.onrender.com/api/tasks
curl https://nexodashboard.onrender.com/api/leads
curl https://nexodashboard.onrender.com/api/payments

# Health check deve funcionar (200)
curl https://nexodashboard.onrender.com/api/health

# Login deve funcionar
curl -X POST https://nexodashboard.onrender.com/api/auth/login \
  -d '{"username":"abner","password":"7741"}'
```

---

## 🔗 Links Importantes

| Recurso | URL |
|---------|-----|
| Produção (Render) | https://nexodashboard.onrender.com |
| Render Dashboard | https://dashboard.render.com/web/srv-d85gqtrbc2fs73bq95bg |
| Repositório GitHub | https://github.com/Jhin1v9/NexoDashboard |
| Branch principal | `main` |
| Branch codex | `codex/initial-nexo-dashboard-pro-v16` |

---

## 📝 Notas para o Próximo Agente

1. **Sempre leia este arquivo primeiro** antes de qualquer mudança
2. **Nunca use `WriteFile` com `overwrite`** em arquivos CSS globais (aprendemos na lição do `index.css`)
3. **Testar localmente antes de commitar** — backend roda em `localhost:3456`
4. **Branches sincronizadas** — `main` e `codex` devem estar no mesmo commit
5. **Deploy automático** — push na `main` dispara deploy no Render
6. **JWT_SECRET obrigatório** — backend encerra se não estiver definido
7. **CORS restrito** — adicionar novas origens em `ALLOWED_ORIGINS` no código ou env var

---

*Este documento deve ser atualizado a cada decisão significativa ou mudança de estado.*
