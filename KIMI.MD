# KIMI.MD — NEXO Dashboard Pro

> Este arquivo é contexto operacional, NÃO documentação. Carrega no início de toda sessão. Mantenha curto, opinado e atualizado.
> 
> **🧠 Sistema de persistência:** Este projeto usa `.kimi-context/` para manter contexto entre sessões. LEIA `.kimi-context/handoff.md` e `.kimi-context/index.json` antes de agir.

---

## 0. Princípio Fundamental

> **FOCO É QUALIDADE, NÃO VELOCIDADE.**
>
> O usuário quer escolher a melhor solução de uma vez e não ficar mudando depois.
> SEMPRE priorizar qualidade, robustez e manutenibilidade sobre rapidez de implementação.
> NUNCA sugerir "começar rápido e evoluir depois" sem que o usuário peça explicitamente.
> **NUNCA regredir** — não remover funcionalidades que já funcionam.

---

## 0. Instance Identity

```yaml
active_instance: kimi-fase1-fix
signature: KIMI-FASE1-FIX 🟢
context_system: .kimi-context/ (v1)
last_updated: 2026-05-29T16:00:00+02:00
```

**Regra para múltiplas instâncias Kimi:**
- Cada instância deve gerar seu próprio `kimi-XXXXXXXX` ID
- NUNCA sobrescreva trabalho de outra instância sem confirmar com o usuário
- Se `index.json` mostrar outra instância como `active`, pergunte antes de continuar

---

## 1. Project Identity

**NEXO Dashboard Pro** — ERP interno da NEXO Digital (empresa de 3 founders: Abner, Nonoke, Elias). Stack Node.js + React + **PostgreSQL (Neon)**. Deploy na Render.com free tier.

**Propósito:** Centralizar clientes, projetos, tarefas, WhatsApp (Luna agent), **Telegram Bot** (@lunanexobot), financeiro, leads, pipeline de vendas, **IDEIAS** (brainstorm com IA Gemini), e **EMAIL HUB** (integração Gmail + IA).

**Repo GitHub:** `github.com/Jhin1v9/NexoDashboard`

**Branch oficial:** `main`

**Persistência:** PostgreSQL (Neon) é a **única fonte da verdade**. 19/19 entidades migradas. JSON files são legado.

---

## 2. Current Focus

### 🎯 Sprint Ativo: Luna CLI v3.3 "Espelho Completo" + Hotfixes Críticos

**Status:** ✅ v3.3 entregue — 110/110 testes passando, E2E validado

**Commits recentes (main):**
- `331e236` docs: limpeza de documentação antiga + atualiza AGENTS.md, KIMI.MD, PLANO.md
- `9d43690` fix: corrige erros 500 — schema mismatch e bugs de API
- `059a4bd` calibração: 5 ajustes pós-migração double-bracket
- `6d5e8d1` feat: migrate from JSON to double-bracket delimiters
- `56b84a5` fix(security): ToolGuard + path traversal + undo safety
- `0ba8319` feat(git): git-native safety — branch-per-session + /undo /diff /reset

### ✅ Concluído Recentemente
| Fase | Status | Detalhe |
|------|--------|---------|
| Double-bracket migration | ✅ | Parser `parseTagResponse()`, 20/20 unit tests |
| System prompt redução | ✅ | ~2000 → ~300 tokens, taxa execução ~70% → >95% |
| DOM Mirror v3.3 | ✅ | 4 tipos nativos (ipython, web_search, browser, computer) |
| ToolGuard integration | ✅ | 7 padrões: retry, circuit breaker, idempotency, schema, timeout, checksum, checkpoint |
| Python sandbox | ✅ | AST-light deny-list (os, subprocess, eval, exec, open) |
| Performance chat | ✅ | `processLunaChatRequest()` pura — eliminou ~6-8s de delay |
| PostgreSQL 19/19 | ✅ | `datastore-pg.js` 100%, 90/90 Jest tests |

### 🔥 Próximo: HOTFIXES (executar ANTES de qualquer feature nova)
| # | Bug | Arquivo | Severidade |
|---|-----|---------|------------|
| H1 | IntentParser regex email — `"responder email"` → `consultar_emails` errado | `IntentParser.js:268` | 🔴 |
| H2 | `totalExpensesMonth` usa `e.date` (não existe no modelo) | `server.js:~4564` | 🔴 |
| H3 | `typeof null === 'object'` zera `amount` silenciosamente | `server.js:~4569` | 🔴 |
| H4 | ActionExecutor `m.body` tratado como string quando é objeto | `ActionExecutor.js:983` | 🔴 |

### 🗄️ Fase 0.1 — Reverse Schema Engineering + Migração PG

**Status:** ✅ Concluído — 19/19 entidades migradas (100%)

- `backend/datastore-pg.js` — 58 funções, zero fallback JSON.
- `backend/db.js` — Pool node-postgres com transactions.
- `backend/migrations/005-real-schema.sql` — Schema real.
- `pg-sync.js` — **REMOVIDO**.

**Testes:** 90/90 Jest passando.

---

## 3. Arquitetura Crítica

### Backend (Node.js, CommonJS, ~8.800 linhas)
- `backend/server.js` — Monolito Express. `/api/luna/chat` → NLU → ActionExecutor
- `backend/datastore-pg.js` — PostgreSQL-only datastore (58 funções)
- `backend/db.js` — Pool node-postgres
- `backend/services/luna-nlu.js` — NLP.js corpus PT/ES/CA
- `backend/services/luna-semantic-nlu.js` — Semantic Embedding Engine (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`)
- `backend/services/action-preview.js` — Preview contextual com dados reais
- `backend/services/undo-service.js` — Undo/Redo persistente
- `agents/core/ActionExecutor.js` — 113+ ações
- `agents/core/NLUActionMapper.js` — Mapeia intents → ações
- `agents/core/IntentParser.js` — Regex fallback (BUG-001 aqui!)
- `agents/telegram-luna-agent.cjs` — Bot Telegram @lunanexobot

### Frontend (React 18, Vite, Tailwind)
- `frontend/src/pages/Workspace.jsx` — Página `/workspace`
- `frontend/src/components/luna/LunaFloatingButton.jsx` — FAB global (BUG: re-render a cada pixel no drag)
- `frontend/src/components/luna/LunaChatPanel.jsx` — Chat HUD futurista
- `frontend/src/pages/LunaControl.jsx` — Terminal + Chat + Comandos
- `frontend/src/pages/Tarefas.jsx` — Tarefas (BUG: mention regex `/@\w+/g` quebrado)

### Luna CLI (`agents/`)
- `luna-soul.cjs` — Orquestrador (~2300 linhas)
- `kimi-bridge.cjs` — Playwright CDP bridge (~3000 linhas)
- `luna-tool-guard.cjs` — Segurança + sandbox
- `luna-tools.cjs` — 32+ tool implementations
- `kimi-tool-adapter.cjs` — Adapter Pattern nativo→Luna
- `tool-call-ledger.cjs` — Ledger de tool calls com deduplicação

### NLU Flow (cascata)
1. **NLU** (`node-nlp`) — Score ≥0.5 → executa
2. **Regex** (`IntentParser`) — Fallback fast path
3. **Semantic** (`luna-semantic-nlu.js`) — Embeddings similarity
4. **LLM** (Gemini/Ollama) — Fallback conversação

---

## 4. Estado Conhecido de Problemas

| Problema | Severidade | Status |
|----------|-----------|--------|
| BUG-001: IntentParser regex email errado | 🔴 Alta | Regex `query_email` captura `"responder email"` |
| BUG-002: `totalExpensesMonth` campo inexistente | 🔴 Alta | Usa `e.date` em vez de `startDate\|renewDate` |
| BUG-003: `typeof null === 'object'` | 🔴 Alta | Zera `amount` quando null |
| BUG-007: ActionExecutor `m.body` como string | 🔴 Alta | `{text,caption}` → `"[object Object]"` |
| API Gemini revogada | 🟡 Média | NLU offline cobre 100% operacional. Ollama pendente |
| 149 leituras `readJSON()` no server.js | 🟡 Média | Ignoram `datastore-pg.js`, desincronizam PG |
| `/luna-control` sem auth | 🟡 Média | Qualquer um acessa |
| Rate limit só no login | 🟡 Média | Tasks, payments, expenses sem proteção |
| ChangelogBadge double close | 🟢 Baixa | Race condition overlay + mousedown |
| LunaFloatingButton re-render drag | 🟢 Baixa | God component 632 linhas |
| NotificationCenter auto-mark-read | 🟢 Baixa | Usuário nunca vê unread |
| **Backend não reiniciado após deploy** | ✅ Resolvido | `kill` + `nohup` no script |
| **pg-sync.js corrompendo dados** | ✅ Resolvido | Removido |
| **Performance chat 6-8s** | ✅ Resolvido | `processLunaChatRequest()` pura |

---

## 4.1 Plano vs Realidade

| Fase | Progresso Real | Gap Principal |
|------|---------------|---------------|
| 0.1 — Reverse Schema Engineering | ✅ 100% | 19/19 entidades migradas |
| 0.2 — Frontend/WebSocket bugs | ✅ 100% | 9/9 bugs corrigidos |
| 1 — Fundação de Consciência | ✅ 100% | — |
| 2 — Eliminar o Modal | ✅ ~90% | Modo C e D implementados |
| 3 — Execução Inteligente | ✅ ~90% | Preview visual implementado |
| 4 — Consciência por Módulo | ✅ 100% | — |
| 5 — NLP.js + Contexto | ✅ 100% | — |
| 6 — Sugestões Proativas | 🟡 ~30% | Badge no FAB, falta expandir |
| 7 — Workspace File Viewer | ✅ 100% | — |
| Luna CLI v3.3 | ✅ 100% | 110/110 tests, >95% exec rate |

---

## 5. Decisões de Design (NÃO mude sem confirmar)

1. **SmartFormModal NUNCA deve ser removido** — é a UX principal para criação/edição.
2. **LunaFloatingButton e página `/luna` compartilham o MESMO backend** (`/api/luna/chat`) mas têm UX diferentes.
3. **Nomes dos CEOs:** abner, nonoke (enoque), elias — todos admin. Senha padrão: `7741`.
4. **PostgreSQL é a única fonte da verdade** — JSON files são legado. Migrar para PG, não o contrário.
5. **Qualidade > velocidade** — O usuário odeia retrabalho. Uma entidade por vez, testada, aprovada.
6. **Schema 1:1** — Nenhum adapter/mapper. Nomes de campos no PG = nomes no JSON.
7. **Luna CLI usa CommonJS (.cjs)** — NUNCA TypeScript, NUNCA ESM `import/export`.
8. **Kimi Web usa Connect-RPC** — NÃO SSE. DOM Mirror é o único caminho viável para extração.

---

## 6. Comandos Úteis

```bash
# Testes backend (Jest)
cd backend && npx jest --verbose        # 90/90

# Testes Luna CLI
cd agents && node run-all-tests.mjs     # 110/110

# Build frontend
cd frontend && npm run build

# Restart backend
kill $(ss -tlnp | grep 3456 | awk '{print $6}' | cut -d',' -f2 | cut -d'=' -f2)
cd backend && nohup node server.js > server.log 2>&1 &

# Login para testes
curl -s -X POST http://localhost:3456/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"abner","password":"7741"}'

# Health check
curl -s http://localhost:3456/api/health

# Status git
git log --oneline -5 && git status
```

---

## 7. Links Rápidos

- **Render Dashboard:** `dashboard.render.com/web/srv-d85gqt...`
- **App em produção:** `nexodashboard.onrender.com`
- **Repo GitHub:** `github.com/Jhin1v9/NexoDashboard`
- **Branch:** `main`
- **Neon DB:** PostgreSQL com 22 tabelas
- **Schema Audit:** `backend/docs/SCHEMA_AUDIT.md` (46KB)
- **Backlog completo:** `BACKLOG-100-FUNCIONAL.md`
- **Plano prioritário:** `.kimi/CONSOLIDADO_MASTER.md`
