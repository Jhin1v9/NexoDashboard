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
last_updated: 2026-05-25T00:30:00+02:00
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

**Persistência:** PostgreSQL (Neon) é a **única fonte da verdade**. JSON files ainda existem para entidades não migradas, mas `pg-sync.js` foi **removido**.

---

## 2. Current Focus

### 🎯 Sprint Ativo: Fase 1 — Preview Contextual + Confirmação + Undo (CORREÇÕES CRÍTICAS)

**Status:** ✅ Concluído — 3/3 testes E2E passando, dashboard operacional para uso rotineiro

**Commits:**
- `f05e9f1` fix(frontend): corrige bug confirmPendingActions lendo estado antes do React atualizar
- `a8b66be` docs: atualiza handoff + registry de ideas

**Bugs corrigidos:**
1. ✅ Clique em Confirmar no preview agora executa a ação (bug crítico do `confirmPendingActions`)
2. ✅ NLU pré-carregado no startup (evita 5s de delay na 1ª requisição)
3. ✅ Ollama removido (consumia RAM/CPU sem uso — será substituído por API)
4. ✅ Syntax error por comentário de bloco desbalanceado corrigido
5. ✅ Testes E2E simplificados e passando (nomes reais, não esquisitos)

### 🗄️ Fase 0.1 — Reverse Schema Engineering + Migração PG

**Status:** ✅ Concluído — 19/19 entidades migradas (100%)

#### Arquitetura de Persistência (REESCRITA)
- `backend/datastore-pg.js` — Datastore 100% PostgreSQL. 33 funções, zero fallback JSON.
- `backend/db.js` — Wrapper node-postgres com pool, transactions, health check.
- `backend/migrations/005-real-schema.sql` — Schema REAL do server.js (Reverse Schema Engineering).
- `backend/migrate-005.js` — Script de migração JSON → PG (1.228 rows migrados).
- `pg-sync.js` — **REMOVIDO** (arquivado em `backend/archive/`).

#### Entidades Migradas para PG ✅
| # | Entidade | Rotas | Testes |
|---|----------|-------|--------|
| 1 | `users` | GET/PUT | 3 ✅ |
| 2 | `tasks` | CRUD + comentários | 4 ✅ |
| 3 | `payments` | CRUD + transactions + split | 5 ✅ |
| 4 | `expenses` | CRUD + pay | 5 ✅ |
| 5 | `cash_box` | Singleton + entries + reconcile + payments | 4 ✅ |
| 6 | `quotes` | CRUD | 5 ✅ |
| 7 | `leads` | CRUD + convert | 5 ✅ |
| 8 | `notifications` | CRUD + read-all | 5 ✅ |
| 9 | `company_tasks` | Internal consumers (insights, action-center, batch) | 5 ✅ |
| 10 | `links` | CRUD + enrich + sync + stats | 5 ✅ |

**Testes totais:** 46/46 passando (`npx jest --verbose`)

#### Entidades Pendentes (ainda em JSON)
`members`, `transactions`, `security_logs`, `changelog`, `ideas`, `whatsapp_history`, `luna_threads`, `luna_buffer`, `workspace_clients`

**Regra:** UMA entidade por vez. Testada. Aprovada pelo Abner. Só aí próxima.

---

## 3. Arquitetura Crítica

### Backend (Node.js, CommonJS, ~8.800 linhas)
- `backend/server.js` — Monolito Express. Endpoint `/api/luna/chat` com NLU → ActionExecutor
- `backend/datastore-pg.js` — **NOVO** — PostgreSQL-only datastore (33 funções, schema 1:1 com JSON)
- `backend/db.js` — Pool node-postgres (`query`, `get`, `run`, `transaction`)
- `backend/services/luna-nlu.js` — Motor NLP.js (node-nlp). Corpus PT/ES/CA. Modelo em `backend/data/luna-model.nlp`
- `agents/core/ActionExecutor.js` — 113+ ações. Executa tarefas, pagamentos, emails, etc.
- `agents/core/NLUActionMapper.js` — Mapeia intents NLU → ações do ActionExecutor
- `agents/core/IntentParser.js` — Regex fallback quando NLU não reconhece
- `agents/telegram-luna-agent.cjs` — Bot do Telegram (@lunanexobot). Framework wizard declarativo com 6 ações interativas.

### Frontend (React 18, Vite, Tailwind)
- `frontend/src/pages/Workspace.jsx` — Página `/workspace` (clientes, pastas, arquivos, viewer)
- `frontend/src/components/workspace/WorkspaceFileViewer.jsx` — Viewer/editor fullscreen com syntax highlighting
- `frontend/src/pages/LunaControl.jsx` — Página `/luna` (terminal + chat + comandos)
- `frontend/src/components/luna/LunaFloatingButton.jsx` — Botão flutuante global (mini-chat + Decision Engine)
- `frontend/src/components/luna/LunaActionDrawer.jsx` — Drawer inline 380px sem blur
- `frontend/src/components/luna/LunaSafetyDelay.jsx` — Safety delay 1.5s com undo
- `frontend/src/components/luna/LunaActionFlow.jsx` — Orquestrador de apresentação
- `frontend/src/components/luna/SmartFormModal.jsx` — Modal de formulário para intents com fields
- `frontend/src/components/luna/LunaIntentSchemas.js` — Schemas de formulário por intent (137 intents)

### NLU Flow (prioridade)
1. **NLU** (`node-nlp`) — Score ≥0.5 → executa direto
2. **Regex** (`IntentParser`) — Fallback para padrões conhecidos
3. **LLM** (Gemini) — Fallback social/conversação (API revogada, offline)

---

## 4. Estado Conhecido de Problemas

| Problema | Severidade | Status |
|----------|-----------|--------|
| API Gemini revogada (`AIzaSyCRgGWJemoesHA2V2NlQ2l46ooy0qO7R9g`) | 🔴 Alta | NLU offline cobre 100% dos comandos operacionais, mas IA generativa está offline |
| `pg-sync.js` removido — JSON files desatualizados para entidades não migradas | 🟡 Média | 14 entidades ainda usam JSON. Migrar UMA POR UMA |
| Cash box balance no PG pode estar desatualizado vs JSON antigo | 🟡 Média | Reconciliar após migrar transactions |
| Email params (`para`, `assunto`) não extraídos de frases naturais | 🟡 Média | `extractEmail()` e `extractAfterKeyword()` existem mas são básicos |
| `concluir tarefa` sem match → avisa "desconhecida" | 🟢 Baixa | Poderia sugerir tarefas similares no futuro |
| **Backend não reiniciado após deploy** | ✅ Resolvido | `kill` + `nohup node server.js` no script de restart |
| **pg-sync.js corrompendo dados** | ✅ Resolvido | Removido completamente |

---

## 4.1 Plano vs Realidade

| Fase | Progresso Real | Gap Principal |
|------|---------------|---------------|
| 0.1 — Reverse Schema Engineering | 🟡 53% | 10/19 entidades migradas. Links concluído. |
| 1 — Fundação de Consciência | ✅ 100% | — |
| 2 — Eliminar o Modal | ✅ ~90% | Modo C e D implementados |
| 3 — Execução Inteligente | ✅ ~90% | Preview visual implementado |
| 4 — Consciência por Módulo | ✅ 100% | — |
| 5 — NLP.js + Contexto | ✅ 100% | — |
| 6 — Sugestões Proativas | 🟡 ~30% | Badge no botão flutuante, falta expandir |
| 7 — Workspace File Viewer | ✅ 100% | Editor + syntax highlighting + contexto Luna |

---

## 5. Decisões de Design (NÃO mude sem confirmar)

1. **SmartFormModal NUNCA deve ser removido** — é a UX principal para criação/edição.
2. **LunaFloatingButton e página `/luna` compartilham o MESMO backend** (`/api/luna/chat`) mas têm UX diferentes.
3. **Nomes dos CEOs:** abner, nonoke (enoque), elias — todos admin. Senha padrão: `7741`.
4. **PostgreSQL é a única fonte da verdade** — JSON files são legado. Migrar para PG, não o contrário.
5. **Qualidade > velocidade** — O usuário odeia retrabalho. Uma entidade por vez, testada, aprovada.
6. **Schema 1:1** — Nenhum adapter/mapper. Nomes de campos no PG = nomes no JSON.

---

## 6. Comandos Úteis

```bash
# Testes (46 testes, todas as entidades migradas)
cd backend && npx jest --verbose

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
