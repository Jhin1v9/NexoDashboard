# ═══════════════════════════════════════════════════════════════════
# AGENTS.md — NEXO COMMAND CENTER v5.0
# Documento de contexto para agentes de IA
# Data: 2026-05-29
# Último commit: 331e236 (main)
# ═══════════════════════════════════════════════════════════════════

## ⚠️ ARQUITETURA REAL DO LUNA WEB — LEIA ANTES DE EDITAR

> **CRÍTICO:** A arquitetura do Luna Web mudou. Não edite os arquivos errados.

### Backend do Luna Web (porta 3458)
| Arquivo | Localização | Função |
|---------|-------------|--------|
| `luna-server.js` | `NEXO_DASHBOARD_PRO/backend/luna-server.js` | **Servidor Express principal** — serve static files, auth JWT, rotas REST |
| `luna-chat-routes.js` | `NEXO_DASHBOARD_PRO/backend/luna-chat-routes.js` | **Router Express** — endpoints `/api/chat/*`, `/api/plan/*`, `/api/system/*`, `/api/config`, SSE streaming |
| `server.js` | `NEXO_DASHBOARD_PRO/backend/server.js` | Dashboard NEXO (porta 3456) — NÃO confundir com luna-server.js |

**❌ NÃO EDITE:** `~/.luna-kernel/config-server.cjs` — está **DEFASADO** (só existe como `.BAK`). O backend real é o `luna-server.js` acima.

**✅ EDITE ESTES ARQUIVOS para mudanças no backend do Luna Web:**
- `NEXO_DASHBOARD_PRO/backend/luna-chat-routes.js` — rotas da API, SSE, Plan Mode, system commands
- `NEXO_DASHBOARD_PRO/backend/luna-server.js` — apenas se precisar mudar porta, static files, ou auth setup

### Frontend do Luna Web
| Arquivo | Localização | Função |
|---------|-------------|--------|
| Source Svelte | `~/.luna-kernel/luna-web/src/` | **Source of truth** — edite aqui |
| Build produção | `~/.luna-kernel/luna-web/dist/` | Gerado por `npm run build` |
| Dev server Vite | `NEXO_DASHBOARD_PRO/agents/luna-web/` | **CÓPIA ANTIGA** — NÃO edite aqui |

**❌ NÃO EDITE:** `NEXO_DASHBOARD_PRO/agents/luna-web/` — é uma cópia antiga. O source real está em `~/.luna-kernel/luna-web/src/`.

**✅ EDITE ESTES ARQUIVOS para mudanças no frontend:**
- `~/.luna-kernel/luna-web/src/components/*.svelte`
- `~/.luna-kernel/luna-web/src/api.js`
- `~/.luna-kernel/luna-web/src/stores.js`
- `~/.luna-kernel/luna-web/src/app.css`

**Após editar o frontend:**
```bash
cd ~/.luna-kernel/luna-web && npm run build
# O build gera em ~/.luna-kernel/luna-web/dist/
# luna-server.js serve automaticamente de ../../.luna-kernel/luna-web/dist/
```

### Engine Luna (compartilhado)
| Arquivo | Localização | Função |
|---------|-------------|--------|
| `luna-soul.cjs` | `~/.luna-kernel/luna-soul.cjs` | Orquestrador — processa mensagens, Plan Mode, executa tools |
| `kimi-bridge.cjs` | `~/.luna-kernel/kimi-bridge.cjs` | Bridge Playwright CDP para Kimi Web |
| `session-manager.cjs` | `~/.luna-kernel/session-manager.cjs` | Gerenciamento de sessões |

**✅ EDITE:** `~/.luna-kernel/luna-soul.cjs` — lógica de processamento, limites, modos de operação
**✅ EDITE:** `~/.luna-kernel/kimi-bridge.cjs` — bridge, timeouts, extração DOM

### Script de controle
```bash
# Iniciar/parar/reiniciar TODOS os serviços
bash /home/jhin/NEXO_DASHBOARD_PRO/luna-nexo.sh [start|stop|restart|status|logs]

# Serviços gerenciados:
# - NEXO Dashboard (porta 3456)
# - Luna Web Server (porta 3458) ← luna-server.js
# - Luna Web Vite Dev (porta 5173)
# - Telegram Bot (@lunanexobot)
```

### Resumo — O que editar para cada mudança
| Se você quer mudar... | Edite este arquivo |
|-----------------------|-------------------|
| Rotas API do chat (/api/chat, /api/plan, /api/system) | `NEXO_DASHBOARD_PRO/backend/luna-chat-routes.js` |
| SSE streaming, sessões, persistência | `NEXO_DASHBOARD_PRO/backend/luna-chat-routes.js` |
| Porta do servidor, auth setup, static files | `NEXO_DASHBOARD_PRO/backend/luna-server.js` |
| Lógica de processamento de mensagens, modos, limites | `~/.luna-kernel/luna-soul.cjs` |
| Bridge Kimi, timeouts, extração DOM | `~/.luna-kernel/kimi-bridge.cjs` |
| Componentes UI, chat input, plan card, sidebar | `~/.luna-kernel/luna-web/src/components/*.svelte` |
| API client frontend (fetch calls) | `~/.luna-kernel/luna-web/src/api.js` |
| Stores Svelte, estado global | `~/.luna-kernel/luna-web/src/stores.js` |
| Tema CSS, variáveis, cores | `~/.luna-kernel/luna-web/src/app.css` |

---

## 🏢 EMPRESA

**NEXO DIGITAL S.L.** — Barcelona, Espanha
- **Abner Gabriel Mendes** — CEO & Co-Founder — 34685093192
- **Enoque G Santos Clemente** — CEO & Co-Founder — 34689135159
- **Elias Mendes** — CEO & Co-Founder — 34672953062 (pessoal) / 34624529442 (empresarial)

Ownership: 25% cada + 25% reinvestimento NEXO. Todos fullstack.

---

## 🚀 ESTADO ATUAL DO SISTEMA (2026-05-29)

### Commits Recentes (mais novos primeiro)
- `331e236` docs: limpeza de documentação antiga + atualiza AGENTS.md, KIMI.MD, PLANO.md
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
NEXO_DASHBOARD_PRO/                    ← Dashboard + Luna Web Backend
├── backend/
│   ├── server.js                      ← Dashboard NEXO (porta 3456) — ~8750 linhas
│   ├── luna-server.js                 ← Luna Web Server (porta 3458) — Express + static
│   ├── luna-chat-routes.js            ← Router Express — /api/chat, /api/plan, /api/system, SSE
│   ├── datastore-pg.js                ← 58 funções — source of truth PostgreSQL
│   ├── db.js                          ← Pool node-postgres (Neon)
│   ├── services/                      ← Serviços do Dashboard
│   ├── migrations/
│   ├── __tests__/                     ← 19 suites Jest
│   └── data/                          ← JSON legado
├── frontend/src/                      ← React 18 — Dashboard NEXO (porta 3457)
│   ├── components/luna/               ← LunaChatPanel, LunaFloatingButton (DASHBOARD)
│   └── pages/                         ← Dashboard, Tarefas, Financeiro, etc.
├── agents/                            ← CLI Luna + cópia antiga do frontend
│   ├── core/                          ← IntentParser, ActionExecutor, NLUActionMapper
│   ├── luna-soul.cjs                  ← ⚠️ CÓPIA ANTIGA — source real está em ~/.luna-kernel/
│   ├── kimi-bridge.cjs                ← ⚠️ CÓPIA ANTIGA — source real está em ~/.luna-kernel/
│   ├── telegram-luna-adapter.cjs      ← Bot Telegram @lunanexobot
│   └── luna-web/                      ← ⚠️ CÓPIA ANTIGA — source real está em ~/.luna-kernel/luna-web/
├── luna-nexo.sh                       ← Script unificado start/stop/restart/status/logs
├── AGENTS.md                          ← Este documento
├── PLANO.md                           ← Estado vivo — backlog e decisões
└── ...

~/.luna-kernel/                        ← LUNA KERNEL v5.0 — SOURCE OF TRUTH
├── luna-soul.cjs                      ← Orquestrador — processa mensagens, Plan Mode, tools
├── kimi-bridge.cjs                    ← Bridge Playwright CDP para Kimi Web
├── session-manager.cjs                ← Gerenciamento de sessões
├── luna-tools.cjs                     ← Ferramentas executadas no PC local
├── luna-tool-guard.cjs                ← Segurança + sandbox
├── luna-git.cjs                       ← Git-native safety
├── luna-web/                          ← FRONTEND SOURCE OF TRUTH — Svelte 4 + Tailwind
│   ├── src/
│   │   ├── components/                ← ChatArea, ChatInput, PlanCard, Sidebar, MessagesList
│   │   ├── api.js                     ← Cliente API — fetch calls
│   │   ├── stores.js                  ← Stores Svelte — estado global
│   │   └── app.css                    ← Tema CSS, variáveis
│   └── dist/                          ← Build de produção — servido por luna-server.js
├── LUNA_MASTER_PROMPT.md              ← System prompt da Luna
└── plans/                             ← Planos gerados pelo Plan Mode

~/.config/systemd/user/                ← Systemd (NÃO USADO ATUALMENTE)
└── luna-server.service                ← Aponta para ~/.luna-kernel/config-server.cjs (DEFASADO)
                                     ← O serviço real é gerenciado por luna-nexo.sh
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
- **Luna Web Frontend**: Svelte 4 + Tailwind + SSE streaming — source em `~/.luna-kernel/luna-web/src/`
- **Luna Web Backend**: Express em `NEXO_DASHBOARD_PRO/backend/luna-server.js` + `luna-chat-routes.js`
- **Kimi Bridge**: Playwright CDP + DOM Mirror + MutationObserver — `~/.luna-kernel/kimi-bridge.cjs`
- **Luna Soul**: Orquestrador — `~/.luna-kernel/luna-soul.cjs` — carregado por luna-chat-routes.js
- **ToolGuard**: 7 padrões de resiliência
- **NLU**: IntentParser 96% + Semantic Embedding (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`)
- **LLM Offline**: Ollama (`gemma4:4b` intent, `gemma4:12b` chat, `nomic-embed-text` embeddings)

### ⚠️ Arquivos DEFASADOS — NÃO EDITE
| Arquivo | Por que está defasado |
|---------|----------------------|
| `~/.luna-kernel/config-server.cjs` | Backend antigo (http nativo). Substituido por `luna-server.js` + `luna-chat-routes.js` em NEXO_DASHBOARD_PRO/backend/ |
| `~/.luna-kernel/config-server.cjs.BAK` | Backup do arquivo defasado |
| `NEXO_DASHBOARD_PRO/agents/luna-web/` | Cópia antiga do frontend. Source real em `~/.luna-kernel/luna-web/` |
| `NEXO_DASHBOARD_PRO/agents/luna-soul.cjs` | Cópia antiga. Source real em `~/.luna-kernel/luna-soul.cjs` |
| `NEXO_DASHBOARD_PRO/agents/kimi-bridge.cjs` | Cópia antiga. Source real em `~/.luna-kernel/kimi-bridge.cjs` |
| `~/.config/systemd/user/luna-server.service` | Aponta para config-server.cjs defasado. Serviço real gerenciado por `luna-nexo.sh` |

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
- **LEIA A SEÇÃO "ARQUITETURA REAL DO LUNA WEB" ACIMA antes de editar qualquer arquivo**
- Backend Dashboard: `localhost:3456`, Frontend Dashboard: `localhost:3457`
- **Luna Web**: `localhost:3458` (backend) / `localhost:5173` (Vite dev)
- **NUNCA** edite `~/.luna-kernel/config-server.cjs` — está defasado
- **NUNCA** edite arquivos em `NEXO_DASHBOARD_PRO/agents/luna-web/` — é cópia antiga
- **SEMPRE** edite o source em `~/.luna-kernel/luna-web/src/` e faça `npm run build`
- **SEMPRE** edite `NEXO_DASHBOARD_PRO/backend/luna-chat-routes.js` para rotas da API do chat
- **SEMPRE** reinicie com `bash /home/jhin/NEXO_DASHBOARD_PRO/luna-nexo.sh restart` após mudanças no backend
- **NUNCA** enviar mensagens no grupo do Paulo (regra absoluta — leitura ONLY)
- **NUNCA** reconstruir — apenas evoluir o que existe
- **SEMPRE** ler `AGENTS.md`, `PLANO.md`, `KIMI.MD` e `.kimi-context/handoff.md` antes de agir
- Luna persona: brasileira, 28 anos mental, informal, 2-3 emojis, nunca genérica

---

## 🔌 Luna Extension v8.1 (Chrome Extension — PRIMARY DOM Source)

### Arquitetura
- **Content Script** (`content.js`): Injetado no contexto isolado da página kimi.com. Escuta `window.postMessage` do `injected.js` e encaminha para o background SW via `chrome.runtime.sendMessage`.
- **Injected Script** (`injected.js`): Injetado no MAIN world via `<script src="...">`. Executa `MutationObserver` no DOM da página e envia eventos via `window.postMessage` para o content script.
- **Background Service Worker** (`background.js`): Recebe eventos do content script e envia para o servidor Luna via **HTTP POST polling** (`fetch`). Também faz polling periódico (`chrome.alarms`) para receber respostas do servidor.
- **Servidor Luna** (`luna-extension-handler.cjs`): Endpoints HTTP `/ext/register`, `/ext/event`, `/ext/poll` gerenciam sessões da extensão e roteiam eventos para a Luna Soul.

### Por que HTTP polling em vez de WebSocket?
O Chrome MV3 não permite WebSockets persistentes no Service Worker. A solução anterior (offscreen document + WebSocket) sofria de problemas de lifecycle (SW cache, offscreen doc duplicado). O polling HTTP é mais robusto e não depende de documentos offscreen.

### Arquivos
- Extensão: `~/.luna-kernel/luna-extension/`
- Handler servidor: `NEXO_DASHBOARD_PRO/backend/luna-extension-handler.cjs`
- Integração servidor: `NEXO_DASHBOARD_PRO/backend/luna-server.js` (linha ~160)

### Comandos
```bash
# 🚀 Deploy automático da extensão (limpa cache + atualiza versão + reload via CDP)
bash ~/.luna-kernel/luna-extension/deploy.sh

# Reiniciar servidor Luna após mudanças no handler
cd ~/NEXO_DASHBOARD_PRO/backend && pm2 restart luna-server

# Reiniciar Chrome com extensão (só se necessário)
ps -ef | grep chrome | grep remote-debugging-port | awk '{print $2}' | xargs kill -9
nohup /opt/google/chrome/chrome --remote-debugging-port=9222 --no-first-run \
  --no-default-browser-check --user-data-dir=/home/jhin/.luna/chrome-profile \
  --disable-background-timer-throttling --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --load-extension=/home/jhin/.luna-kernel/luna-extension \
  https://www.kimi.com/ > /dev/null 2>&1 &
```

### Caminho de volta: injeção de tool results
Quando o servidor detecta uma `tool_call` via extensão, executa a tool e envia o resultado de volta via `/ext/poll`. O SW recebe e encaminha para o content script, que:
1. Recebe o payload `tool_result` ou `inject_text`
2. Usa `document.execCommand('insertText', ...)` para inserir no `contenteditable` do Kimi
3. Simula `Enter` ou clica no botão de enviar

### Cache do Service Worker
O Chrome MV3 cacheia o SW agressivamente. O `deploy.sh` já lida com isso automaticamente:
1. Apaga cache: `rm -rf ~/.luna/chrome-profile/Default/Service\ Worker/`
2. Incrementa versão no `manifest.json`
3. Chama `chrome.runtime.reload()` via CDP

Se precisar fazer manualmente: mate o Chrome, apague o cache, mude a versão, e reinicie.

---

*Atualizado: 2026-06-03 | Commit: luna-extension-v8.1-complete | Status: Backend ✅ Frontend ✅ Luna Web ✅ Extension v8.1 ✅ Plan Mode ✅ Auto-Health ✅*
