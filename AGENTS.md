# ═══════════════════════════════════════════════════════════════════
# AGENTS.md — NEXO COMMAND CENTER v5.0
# Documento de contexto para agentes de IA
# Data: 2026-05-29
# Último commit: 9d43690 (main)
# ═══════════════════════════════════════════════════════════════════

## 🏢 EMPRESA

**NEXO DIGITAL S.L.** — Barcelona, Espanha
- **Abner Gabriel Mendes** — CEO & Co-Founder — 34685093192
- **Enoque G Santos Clemente** — CEO & Co-Founder — 34689135159
- **Elias Mendes** — CEO & Co-Founder — 34672953062 (pessoal) / 34624529442 (empresarial)

Ownership: 25% cada + 25% reinvestimento NEXO. Todos fullstack.

---

## 🚀 ESTADO ATUAL DO SISTEMA (2026-05-29)

### Commits Recentes (mais novos primeiro)
- `9d43690` fix: corrige erros 500 no dashboard — schema mismatch e bugs de API
- `045f7f1` docs: relatório final v3.1 tags calibrado — 50/50 testes, E2E 3/3
- `059a4bd` calibração(system+parser+action): 5 ajustes pós-migração double-bracket
- `6d5e8d1` feat(parser+prompt): migrate from JSON to double-bracket delimiters
- `b20708f` fix(bridge+tui): reset stream state on old pages + /clear alias
- `56b84a5` fix(security): ToolGuard integration + path traversal + undo safety + stream fixes
- `0ba8319` feat(git): git-native safety — branch-per-session + auto-commit + /undo /diff /reset
- `f8b9c95` feat(workspace): bootstrap + tool-guard with 7 resilience patterns
- `4ae3faa` feat(bridge): 4-layer thinking/response extraction + WebSocket interceptor

### Backend (server.js — ~8750 linhas)
| # | Feature | Status |
|---|---------|--------|
| 1 | PostgreSQL Migration | ✅ 19/19 entidades — `datastore-pg.js` source of truth |
| 2 | Auth JWT + bcrypt + fingerprint | ✅ Global middleware protege `/api/*` |
| 3 | Rate limiting | ✅ Apenas login (15min). Outras rotas: pendente |
| 4 | Security headers | ✅ HSTS, CSP, X-Frame-Options, Permissions-Policy |
| 5 | Path traversal fix | ✅ `path.resolve` + workspace validation |
| 6 | VPN/Tor/proxy detection | ✅ Via ipapi.is + Tor Project list |
| 7 | Intruder capture | ✅ Camera + screenshot + Discord/WhatsApp alert |
| 8 | WhatsApp Bidirecional | ✅ `POST /api/whatsapp/send` via Playwright CDP |
| 9 | Email Hub (IMAP/SMTP) | ✅ Fallback SMTP quando OAuth indisponível |
| 10 | Instagram Hub | ✅ Profile iframe + messages import |
| 11 | System Engine | ✅ `/api/system/*` — controle Backend/Frontend/Luna |
| 12 | Cash Box v2.0 | ✅ CRUD entries + reconcile + payment split 25% |
| 13 | Leads Pipeline (Kanban) | ✅ 6 colunas, cards, filtros, modal CRUD |
| 14 | Luna NLU v2 | ✅ IntentParser 96% + Semantic Embedding Engine |
| 15 | Luna HUD v3.0 | ✅ ChatPanel, FAB, inline actions, voice, ghost mode |
| 16 | Telegram Bot | ✅ `@lunanexobot` — `/kimi`, `/kimi_instant`, `/kimi_thinking` |
| 17 | Undo/Redo persistente | ✅ Stack por thread, TTL 30s, botão countdown |
| 18 | Preview Contextual | ✅ Cards ricos com dados reais antes de executar |
| 19 | Tool Registry API | ✅ 15+ tools expostas para Kimi Central |

### Luna CLI v3.3 "Espelho Completo" (`agents/`)
| # | Feature | Status |
|---|---------|--------|
| 1 | Kimi Web Bridge | ✅ Playwright CDP — DOM Mirror + MutationObserver |
| 2 | Native tool mapping | ✅ `ipython`→`executeShell`, `web_search`→`searchWeb`, `browser`→`fetchURL`, `computer`→desktop |
| 3 | Double-bracket parser | ✅ `[[action]]`, `[[response]]`, `[[meta]]`, `[[suggest]]` |
| 4 | ToolGuard | ✅ Retry, circuit breaker, idempotency, schema validation, timeout, checksum |
| 5 | Python sandbox | ✅ AST-light deny-list (`os`, `subprocess`, `eval`, `exec`, `open`) |
| 6 | Git-native safety | ✅ Branch por sessão, atomic commits, `/undo` triple-guard |
| 7 | Tests | ✅ 110/110 passando (48 unit + 6 integ + 22 sec + 18 adv + 16 E2E) |

### Frontend (React 18 + Vite + Tailwind)
| # | Feature | Status |
|---|---------|--------|
| 1 | LandingPage + SecretTerminal | ✅ Konami Code (↑↑↓↓←→←→BA) + redirect se logado |
| 2 | Dashboard | ✅ Cards com dados do PG, WhatsApp histórico |
| 3 | Tarefas | ✅ CRUD + comentários + mention highlight |
| 4 | Financeiro | ✅ Summary completo (payments + expenses + alerts) |
| 5 | Caixa | ✅ CRUD entries + modal + reconcile + refetch automático |
| 6 | WhatsApp | ✅ History primária, resolvedAuthor, LinkHub, chat por conversa |
| 7 | Email Hub | ✅ 3-col layout, compose modal, query params auto-compose |
| 8 | Luna Control Center | ✅ Terminal realtime, Chat interativo, Comandos Rápidos |
| 9 | NotificationCenter | ✅ WebSocket realtime, dropdown acessível |
| 10 | Settings | ✅ Perfil, Segurança, Usuários |

---

## 📁 ESTRUTURA DE ARQUIVOS CRÍTICA

```
NEXO_DASHBOARD_PRO/
├── backend/
│   ├── server.js              ← ~8750 linhas. APIs REST + WebSocket
│   ├── datastore-pg.js        ← 58 funções — source of truth PostgreSQL
│   ├── db.js                  ← Pool node-postgres (Neon)
│   ├── services/
│   │   ├── url-classifier.js
│   │   ├── link-preview.js
│   │   ├── luna-semantic-nlu.js   ← Semantic Embedding Engine
│   │   ├── luna-nlu.js            ← NLP.js corpus PT/ES/CA
│   │   ├── action-preview.js      ← Preview contextual
│   │   └── undo-service.js        ← Undo/Redo persistente
│   ├── migrations/
│   │   └── 005-real-schema.sql    ← Schema real do PG
│   ├── __tests__/             ← 19 suites, 90 testes Jest
│   └── data/                  ← JSON legado (inofensivos, não mais lidos)
├── frontend/src/
│   ├── components/
│   │   ├── luna/              ← LunaChatPanel, LunaFloatingButton, LunaActionBridge
│   │   ├── email/             ← EmailHub, EmailCompose
│   │   ├── NotificationCenter.jsx
│   │   ├── LinkHub.jsx
│   │   └── Sidebar.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── WhatsApp.jsx
│   │   ├── Tarefas.jsx
│   │   ├── Caixa.jsx
│   │   ├── Financeiro.jsx
│   │   ├── LunaControl.jsx
│   │   └── SystemEngine.jsx
│   └── context/
│       ├── AuthContext.jsx
│       └── ToastContext.jsx
├── agents/
│   ├── core/
│   │   ├── IntentParser.js        ← NLU v2 — 96% acerto
│   │   ├── ActionExecutor.js      ← 113+ ações, 21 categorias
│   │   └── NLUActionMapper.js     ← Mapeia intents → ações
│   ├── luna-soul.cjs              ← Orquestrador Luna CLI
│   ├── kimi-bridge.cjs            ← Playwright CDP bridge
│   ├── luna-tool-guard.cjs        ← Segurança + sandbox
│   ├── luna-workspace.cjs         ← Workspace scanner
│   ├── luna-git.cjs               ← Git-native safety
│   ├── telegram-luna-agent.cjs    ← Bot Telegram @lunanexobot
│   └── CHANGELOG.md               ← Luna CLI changelog
├── .kimi-context/
│   ├── handoff.md                 ← Estado entre sessões
│   ├── nlu-gap-analysis.md        ← Gaps do NLU
│   └── plans-vs-reality.md        ← Tracking de planos
├── .kimi/
│   ├── CONSOLIDADO_MASTER.md      ← Plano de ação prioritário
│   └── PROTOCOLO_MULTI_KIMI.md    ← Multi-agent protocol
├── AGENTS.md                      ← Este documento
├── PLANO.md                       ← Estado vivo — backlog e decisões
├── BACKLOG-100-FUNCIONAL.md       ← Backlog completo de bugs/tarefas
└── KIMI.MD                        ← Contexto operacional Kimi
```

---

## 🔧 REGRAS ABSOLUTAS PARA O AGENTE

1. **NUNCA reescreva arquivos inteiros** — use patches cirúrgicos (`applyPatch`)
2. **NUNCA apague código que funciona** — só adicione/modifique
3. **NUNCA crie código genérico** — baseie-se nos schemas reais do projeto
4. **NUNCA atribua tarefas/decisões** — só os 3 CEOs têm poder hierárquico
5. **SEMPRE valide cruzado** com os schemas antes de entregar
6. **SEMPRE teste** após cada modificação — 1 problema por vez
7. **SEMPRE commit + push** após cada fase funcionando
8. **Idioma da UI: pt-BR** (labels, botões, textos) — manter consistência
9. **Código/variáveis: Inglês**
10. **Um arquivo por vez** — revisão brutal antes de próximo
11. **NUNCA ignore o BOM** — sempre strip `0xFEFF`
12. **NUNCA quebre contratos de API** — rotas existentes devem continuar funcionando
13. **PostgreSQL é a ÚNICA fonte da verdade** — não use `readJSON()` para dados de entidade

---

## 🤖 LUNA KERNEL v5.0 (`.luna-kernel/`)

Stack: Node.js v24+, CommonJS (.cjs), sem TypeScript.
- **Luna Web**: Svelte 4 + Tailwind + SSE streaming
- **Kimi Bridge**: Playwright CDP + DOM Mirror + MutationObserver
- **ToolGuard**: 7 padrões de resiliência
- **NLU**: IntentParser 96% + Semantic Embedding (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`)
- **LLM Offline**: Ollama (`gemma4:4b` intent, `gemma4:12b` chat, `nomic-embed-text` embeddings)

---

## 🚨 BACKLOG PRIORITÁRIO (do CONSOLIDADO_MASTER.md)

### HOTFIXES (executar primeiro)
| # | Bug | Arquivo | Impacto |
|---|-----|---------|---------|
| H1 | IntentParser regex email — `"responder email"` classifica como `consultar_emails` | `IntentParser.js:268` | 🔴 Luna não entende emails |
| H2 | `totalExpensesMonth` usa `e.date` (não existe) em vez de `startDate\|renewDate` | `server.js:~4564` | 🔴 Dashboard financeiro incorreto |
| H3 | `typeof null === 'object'` zera `amount` silenciosamente | `server.js:~4569` | 🔴 Despesas com null viram 0 |
| H4 | ActionExecutor `m.body` tratado como string quando é objeto `{text,caption}` | `ActionExecutor.js:983` | 🔴 Menções `@LUNA` perdidas |

### FASE 1: Luna 100% Offline (3-5 dias)
- O1. Instalar Ollama + pull `gemma4:4b`, `gemma4:12b`, `nomic-embed-text`
- O2. Criar `ollama-client.js` com circuit breaker
- O3. Refatorar `IntentParser.js` — 4 camadas: NLU → Regex → Semantic → Ollama
- O4. Streaming SSE no `/api/luna/chat`

### FASE 2: Frontend Stability (2-3 dias)
- F1. Fix ChangelogBadge double close handler
- F2. Fix LunaFloatingButton drag re-render (usar ref + transform)
- F3. Fix mention regex `/@\w+/g` → iterar sobre MENTION_USERS
- F4. Fix NotificationCenter auto-mark-all-as-read

### FASE 3: Backend Hardening (3-4 dias)
- B1. Rate limiting global em todas as rotas POST/PUT/DELETE
- B2. Fix path traversal — usar `sanitizeSubPath()` do workspace-manager
- B3. Migrar 149 leituras `readJSON()` para `dataStore.*()`
- B4. Fix `/luna-control` auth

---

## 🔐 CONFIGURAÇÃO OBRIGATÓRIA NO `.env`

```bash
# Database
DATABASE_URL=postgres://...neon.tech/...

# Auth
JWT_SECRET=<gerar aleatório 64 chars>
NODE_ENV=production

# Gemini (IA generativa — atualmente offline, substituir por Ollama)
GEMINI_API_KEY=<nova key>

# Telegram Bot
TELEGRAM_BOT_TOKEN=7778220021:AAHI08gP1nlsizzh1f4ak00-eaSOdU1OwsY
INTERNAL_API_TOKEN=<JWT service token>

# Email (SMTP fallback)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=nexodigital.sys@gmail.com
SMTP_PASS=<app-password>

# Discord Security Alert
DISCORD_SECURITY_WEBHOOK=<mover para .env>
```

---

## 📊 CHECKLIST RÁPIDO

```bash
# Testar APIs
curl http://localhost:3456/api/health
curl http://localhost:3456/api/finance/summary
curl http://localhost:3456/api/whatsapp/history?limit=3

# Testes
cd backend && npx jest --verbose        # 90/90 Jest
cd agents && node run-all-tests.mjs     # 110/110 Luna CLI

# Login
curl -s -X POST http://localhost:3456/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"abner","password":"7741"}'
```

---

## 📝 NOTAS PARA O PRÓXIMO AGENTE

- O usuário é CEO da NEXO, baseado em Barcelona, fala **pt-BR**
- Prefere **1 arquivo por vez**, com revisão brutal
- Quer **EXTRAORDINÁRIO**, não "bom o suficiente"
- Backend: `localhost:3456`, Frontend: `localhost:3457`
- **NUNCA** enviar mensagens no grupo do Paulo (regra absoluta — leitura ONLY)
- **NUNCA** reconstruir — apenas evoluir o que existe
- **SEMPRE** ler `AGENTS.md`, `PLANO.md`, `KIMI.MD` e `.kimi-context/handoff.md` antes de agir
- Luna persona: brasileira, 28 anos mental, informal, 2-3 emojis, nunca genérica

---

*Atualizado: 2026-05-29 | Commit: 9d43690 | Status: Backend ✅ Frontend ✅ Luna CLI ✅*
