<!-- From: /media/jhin/Backup Documentos/01_ATIVOS/NEXO_DASHBOARD_PRO/AGENTS.md -->
# ═══════════════════════════════════════════════════════════════════
# AGENTS.md — NEXO COMMAND CENTER v4.0
# Documento de contexto para agentes de IA
# Data: 2026-05-12
# Última atualização: 2026-05-26 01:00
# Último commit: e1e7e4e (main)
# ═══════════════════════════════════════════════════════════════════

## 🏢 EMPRESA

**NEXO DIGITAL S.L.** — Barcelona, Espanha
- **Abner Gabriel Mendes** — CEO & Co-Founder — 34685093192
- **Enoque G Santos Clemente** — CEO & Co-Founder — 34689135159
- **Elias Mendes** — CEO & Co-Founder — 34672953062 (pessoal) / 34624529442 (empresarial/Superclim)

Ownership: 25% cada + 25% reinvestimento NEXO. Todos fullstack.

---

## 🚀 ESTADO ATUAL DO SISTEMA (2026-05-09)

### Análise de Código Real — Validado por Kimi Code CLI

> **⚠️ ATUALIZAÇÃO CRÍTICA:** O backend foi migrado de JSON files para PostgreSQL (Neon) em 2026-05-23.
> Todas as entidades de dados agora usam `datastore-pg.js` como source of truth.
> Arquivos JSON de inicialização ainda existem no código mas são inofensivos (não mais lidos pelas rotas).

#### Backend (server.js — ~8750 linhas)
| # | Feature | Status | Evidência |
|---|---------|--------|-----------|
| 1 | BOM-safe `readJSON()` | ✅ Funciona | Usado globalmente |
| 2 | `loadSchema()` / `loadConfig()` | ✅ BOM-safe agora | Trocado para `readJSON()` em 2026-05-08 |
| 3 | `/api/finance/summary` | ✅ FIXADO | Rota duplicada removida. Agora retorna versão completa (alerts, overdue, pending) |
| 4 | `updateCashBoxFromTransactions()` | ✅ PROTEGIDO | NUNCA mais recria histórico. Apenas atualiza saldo + audit log |
| 5 | `/api/whatsapp/history` | ✅ Evoluído | Retorna `resolvedAuthor` para cada mensagem (contacts-map.json) |
| 6 | `/api/whatsapp-agent` | ✅ Evoluído | `totalMessages` faz fallback para `history.length` quando buffer vazio |
| 7 | CRUD Caixa v2.0 | ✅ IMPLEMENTADO | `POST/PUT/DELETE/GET /api/cash-box/entries` + reconcile + soft delete |
| 8 | Link Hub API v2.0 | ✅ IMPLEMENTADO | 8 endpoints: `/api/links`, `/api/links/preview`, `/api/links/sync`, etc. |
| 9 | `fetchLinkPreview()` | ✅ Funciona | cheerio + cache 24h + fallback elegante |
| 10 | `url-classifier.js` | ✅ Funciona | 15 plataformas, regex robusto |
| 11 | Modo Pagamento Recebido | ✅ IMPLEMENTADO | `POST /api/cash-box/payments` com distribuição automática 25% cada sócio |
| 12 | Filtro de Privacidade WhatsApp | ✅ IMPLEMENTADO | `isAuthorizedChat()` — só monitora grupos com `monitoring.enabled=true`, ignora DMs |
| 13 | Sidebar v4.0 | ✅ IMPLEMENTADO | Dashboard na raiz, Comunicação (WhatsApp/Email/Instagram), Leads, Luna, **Sistema** |
| 14 | Resolução de Autor v2 | ✅ IMPLEMENTADO | `confidence` scores, cores de founder, reprocessamento de 169 msgs |
| 15 | Chat por Conversa (WhatsApp) | ✅ IMPLEMENTADO | Layout tipo WhatsApp Web — sidebar de chats + thread de mensagens |
| 16 | Pipeline de Leads (Kanban) | ✅ IMPLEMENTADO | 6 colunas, cards com move arrows, filtros, modal CRUD |
| 17 | Luna Control Center v2 | ✅ REESCRITO | 3 abas: Terminal (logs realtime), Chat (interação direta), Comandos Rápidos |
| 18 | System Engine | ✅ IMPLEMENTADO | `/api/system/status`, `/api/system/logs`, `/api/system/control` — controle Backend/Frontend |
| 19 | WhatsApp Bidirecional | ✅ IMPLEMENTADO | `POST /api/whatsapp/send` via Playwright CDP + input no chat |
| 20 | Email Hub (IMAP/SMTP) | ✅ IMPLEMENTADO | 3-col layout, compose modal, sync inbox, query params auto-compose |
| 21 | Instagram Hub | ✅ IMPLEMENTADO | Profile iframe + messages import JSON |
| 22 | detectClient() + Toast | ✅ IMPLEMENTADO | `/api/detect-client`, ToastContainer com useToast |
| 23 | **PostgreSQL Migration** | ✅ **19/19 ENTIDADES** | `datastore-pg.js` — zero adapters, schema 1:1 |
| 24 | **Security Headers** | ✅ IMPLEMENTADO | HSTS, CSP, X-Frame-Options, Permissions-Policy |
| 25 | **Path Traversal Fix** | ✅ IMPLEMENTADO | `sanitizeClientId` + regex sanitização |
| 26 | **Luna NLU v2** | ✅ IMPLEMENTADO | IntentParser 96% acerto, navigate/filter intents |
| 27 | **Luna HUD v2/v3** | ✅ IMPLEMENTADO | ChatPanel futurista, FAB orb, inline actions, reactions, ghost mode, voice input + TTS |
| 28 | **Dashboard Context** | ✅ IMPLEMENTADO | `GET /api/luna/dashboard-state`, context awareness |
| 29 | **Playwright WhatsApp** | ✅ INSTALADO | `whatsapp-sender.js` com CDP automation |
| 30 | **Login tradicional** | ✅ IMPLEMENTADO | Split-screen, dark mode, design Linear/Stripe/Vercel |
| 31 | **Modo Voz completo** | ✅ IMPLEMENTADO | STT (SpeechRecognition) + TTS (speechSynthesis), waveform visual, toggle no chat |
| 32 | **E2E Playwright** | 🟡 EM PROGRESSO | Auth 3/3 passando, notifications 1/2, leads 0/2 |
| 33 | **Email Fallback SMTP** | ✅ IMPLEMENTADO | Fallback de Gmail OAuth para Nodemailer quando OAuth indisponível |

#### Luna Workspace Agent v1.0 (2026-05-26)
| # | Feature | Status | Evidência |
|---|---------|--------|-----------|
| 1 | **Workspace Bootstrap** | ✅ IMPLEMENTADO | `luna-workspace.cjs` — escaneia árvore, detecta stack, lê arquivos-chave |
| 2 | **Context Injection** | ✅ IMPLEMENTADO | Workspace Manifest + Active Files cache injetados no prompt do Kimi Web |
| 3 | **Git-Native Safety** | ✅ IMPLEMENTADO | `luna-git.cjs` — branch por sessão, atomic commits, /undo /diff /reset |
| 4 | **ToolGuard** | ✅ IMPLEMENTADO | 7 padrões de resiliência: retry, circuit breaker, idempotency, schema validation, timeout, checksum, checkpoints |
| 5 | **TUI Commands** | ✅ IMPLEMENTADO | /workspace, /add, /drop, /undo, /diff, /reset |
| 6 | **Testes** | ✅ 14/14 PASSANDO | 8 unitários + 6 E2E |

#### Agente Luna (luna-cto-agent.cjs + SmartClassifier)
| # | Feature | Status | Evidência |
|---|---------|--------|-----------|
| 1 | SmartClassifier v16.1 | ✅ FIXADO | `resolveAuthor()` agora faz match por NOME (displayName, shortName, fullName, codename) — não só por telefone |
| 2 | `resolveAuthor()` | ✅ Backend + Agente | Match por nome adicionado em ambos. Reprocessamento: 22/101 mensagens resolvidas |
| 3 | `PlaywrightExtractor` | ✅ Melhorado | Agora extrai autor de 4 fontes do DOM: data-pre-plain-text, data-id (telefone), title attribute, container pai |
| 4 | `whatsapp-history.json` | ✅ Acumulativo | 101 mensagens, 22 com `resolvedAuthor` completo (color, avatarEmoji, role, phone) |
| 5 | `luna-buffer.json` | ⚠️ Volátil | `newMessages: []` — buffer esvazia após processamento (por design) |
| 6 | `links-index.json` | ✅ Populado | 45 links extraídos do buffer, classificados |

#### Frontend (React 18 + Vite)
| # | Feature | Status | Evidência |
|---|---------|--------|-----------|
| 1 | `Dashboard.jsx` — WhatsApp card | ✅ FIXADO | Mostra total do histórico (84) em vez de 0 |
| 2 | `WhatsApp.jsx` — Mensagens | ✅ Evoluído | Consome `/api/whatsapp/history` como fonte primária |
| 3 | `WhatsApp.jsx` — Autor | ✅ Evoluído | `MessageBubble` usa `resolvedAuthor.color` + `avatarEmoji` |
| 4 | `WhatsApp.jsx` — Badge prioridade | ✅ FIXADO | Suporta low/medium/high com cores distintas |
| 5 | `WhatsApp.jsx` — Links | ✅ EVOLUÍDO | Tab `links` renderiza `<LinkHub />` com preview/grid/filtros |
| 6 | `Caixa.jsx` — CRUD | ✅ IMPLEMENTADO | Tabela de histórico + modal criar/editar + botão reconciliar |
| 7 | `Financeiro.jsx` — Summary | ✅ FIXADO | Recebe versão completa da API (não mais simplista) |
| 8 | `ToastContext` | ✅ ATIVADO | Envolve `<App />` em `main.jsx` |
| 9 | `MobileBottomNav` | ✅ ATIVADO | Renderizado em `App.jsx` |
| 10 | `LunaControl.jsx` v2 | ✅ REESCRITO | Terminal (logs 300 linhas, auto-scroll, cores), Chat (bubble style), Comandos (grid 8 cards) |
| 11 | `SystemEngine.jsx` | ✅ NOVO | Cards Backend/Frontend/Luna/Supervisor, logs por serviço, start/stop/restart |

---

## 📁 ESTRUTURA DE ARQUIVOS CRÍTICA (ATUALIZADA)

```
NEXO_DASHBOARD_PRO/
├── backend/
│   ├── server.js                    ← ~8750 linhas. APIs REST + WebSocket
│   ├── datastore-pg.js              ← 58 funções — source of truth PostgreSQL
│   ├── db.js                        ← Pool node-postgres (Neon)
│   ├── services/
│   │   ├── url-classifier.js        ← classificação de URL por plataforma
│   │   ├── link-preview.js          ← fetch OGP + cache 24h
│   │   ├── ollama-client.js         ← Cliente Ollama (gemma3:1b)
│   │   └── luna-semantic-nlu.js     ← Semantic Embedding Engine
│   ├── migrations/
│   │   └── 005-real-schema.sql      ← Schema real do PostgreSQL
│   ├── __tests__/                   ← 19 suites, 90 testes Jest
│   ├── data/                        ← JSON de config (inofensivos, não mais lidos)
│   │   ├── luna-buffer.json         ← volátil por design
│   │   ├── whatsapp-history.json    ← backup (dados agora no PG)
│   │   └── schema/
│   │       └── contacts-map.json    ← 535 linhas, dados dos 3 founders
│   └── workspace/                   ← Filesystem de clientes (não commitar)
├── agents/
│   ├── core/
│   │   ├── IntentParser.js          ← NLU v2 — 96% acerto, navigate/filter
│   │   └── ActionExecutor.js        ← 109 métodos, 21 categorias
│   ├── luna-cto-agent.cjs           ← Agente principal (Playwright CDP)
│   ├── SmartClassifier_v16.js       ← Classificador + resolveAuthor()
│   └── telegram-luna-agent.cjs      ← Bot Telegram (@lunanexobot)
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── luna/
│       │   │   ├── LunaChatPanel.jsx      ← HUD futurista v2
│       │   │   ├── LunaFloatingButton.jsx ← Orb holográfico
│       │   │   ├── LunaActionBridge.jsx   ← Ações inline cross-module
│       │   │   └── LunaProactiveToast.jsx ← Notificações proativas
│       │   ├── email/
│       │   │   ├── EmailHub.jsx           ← 3-col layout, query params
│       │   │   └── EmailCompose.jsx       ← Compose com props initialTo/Subject
│       │   ├── NotificationCenter.jsx     ← Dropdown acessível, WS realtime
│       │   ├── LinkHub.jsx                ← grid/list, filtros, preview
│       │   └── Sidebar.jsx                ← v4.0 — Sistema, Comunicação
│       ├── pages/
│       │   ├── WhatsApp.jsx         ← history primária, resolvedAuthor
│       │   ├── Dashboard.jsx        ← cards com dados do PG
│       │   ├── Caixa.jsx            ← CRUD completo
│       │   ├── Financeiro.jsx       ← summary completo
│       │   ├── LandingPage.jsx      ← redirect automático se logado
│       │   ├── LunaControl.jsx      ← Terminal + Chat + Comandos
│       │   └── SystemEngine.jsx     ← controle Backend/Frontend
│       ├── context/
│       │   ├── ToastContext.jsx     ← ATIVADO
│       │   └── AuthContext.jsx      ← JWT + interceptador 401
│       └── main.jsx                 ← ToastProvider + AuthProvider
├── .kimi-context/
│   ├── handoff.md                 ← Estado de trabalho entre sessões
│   └── nlu-gap-analysis.md        ← Análise de gaps do NLU
├── AGENTS.md                      ← Este documento
└── PLANO.md                       ← Plano vivo — backlog e decisões
```

---

## ⚠️ PROBLEMAS VALIDADOS NO CÓDIGO (RESOLVIDOS EM 2026-05-09)

### 🔴 CRÍTICO — RESOLVIDOS
| # | Problema | Solução Aplicada |
|---|----------|-----------------|
| 1 | Finance Summary duplicada e sobrescrita | Removida rota simplista (linha 1856). Versão completa (linha 1422) é a ativa. |
| 2 | `updateCashBoxFromTransactions()` destrói histórico | Refatorado para apenas atualizar `balance.value`. NUNCA toca em `history[]`. Audit log adicionado. |
| 3 | WhatsApp mensagens = 0 / "(sem texto)" | Frontend consome `/api/whatsapp/history` como fonte primária. Buffer é secundário. |
| 4 | Autor = "Desconhecido" em todo histórico | FIXADO v2: `resolveAuthor()` agora extrai nome do INÍCIO do texto quando `author='Desconhecido'` (WhatsApp Web v2.30+ embute nome no texto). Aliases adicionados ao `contacts-map.json` (`Tú`, `Nonoke`, etc.). PlaywrightExtractor ganhou Estratégia 5. **43/169 mensagens resolvidas** (25.4% — dobrou de 22/169). Restantes são clientes não mapeados, mensagens de sistema/Luna, ou mídia sem texto. |
| 5 | `loadSchema()` sem BOM-safe | Trocado para `readJSON()` que remove BOM automaticamente. |
| 6 | `/api/leads` retorna `data.leads is not iterable` | Removidas rotas duplicadas (GET, POST, PUT, stats) que usavam `LEADS_FILE` obsoleto. Adicionada constante `CLIENTS_REGISTRY_FILE` faltante. Endpoint agora consome `clients-registry.json` corretamente. |
| 7 | Endpoints novos retornando HTML (frontend) | Backend reiniciado. Rotas `/api/luna/commands`, `/api/emails/config`, `/api/instagram/profile`, `/api/whatsapp/send` agora registradas e funcionando. |

### 🟡 MÉDIO — RESOLVIDOS
| # | Problema | Solução Aplicada |
|---|----------|-----------------|
| 6 | Badge prioridade hardcoded "Média" | `TaskItem` agora suporta `low`/`medium`/`high` com labels e cores distintas. |
| 7 | Links sem preview/thumbnail | `LinkHub.jsx` consome `/api/links`. Backend enriquece previews com cheerio + cache 24h. |
| 8 | Dashboard WhatsApp card = 0 | `/api/whatsapp-agent` faz fallback `totalMessages = history.length` quando buffer vazio. |
| 9 | Contagens infladas na API (148 tasks vs 9 reais) | FIXADO: `/api/whatsapp-agent` agora calcula `totalTasks`, `totalLinks`, etc. a partir do `whatsapp-history.json` em tempo real. Buffers apenas como fallback. |

### 🟢 BAIXO — RESOLVIDOS
| # | Problema | Solução Aplicada |
|---|----------|-----------------|
| 9 | ToastContext não usado | Ativado em `main.jsx` envolvendo `<App />`. |
| 10 | MobileBottomNav não renderizado | Importado e renderizado em `App.jsx`. |

---

## 🔧 REGRAS ABSOLUTAS PARA O AGENTE

1. **NUNCA reescreva arquivos inteiros** — use patches cirúrgicos (apply_patch)
2. **NUNCA apague código que funciona** — só adicione/modifique
3. **NUNCA crie código genérico** — baseie-se nos schemas reais do projeto
4. **NUNCA atribua tarefas/decisões** — só os 3 CEOs têm poder hierárquico
5. **SEMPRE valide cruzado** com os 7 schemas antes de entregar
6. **SEMPRE teste** após cada modificação — 1 problema por vez
7. **SEMPRE commit + push** após cada fase funcionando
8. **Idioma da UI: Espanhol** (labels, botões, textos) — NOTA: atualmente está pt-BR, manter consistência
9. **Código/variáveis: Inglês** (TypeScript, nomes de funções)
10. **Um arquivo por vez** — revisão brutal (5x) antes de próximo
11. **NUNCA ignore o BOM** — sempre strip `0xFEFF`
12. **NUNCA quebre contratos de API** — rotas existentes devem continuar funcionando

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS (Backlog)

### Feito hoje (2026-05-08) — v16.1
- [x] FASE 0: Hotfixes críticos (summary, BOM-safe, dashboard count)
- [x] FASE 1: WhatsApp Frontend (history primária, badge, autor fallback)
- [x] FASE 2: Resolução de Autor v2.1 (match por nome + telefone, reprocessamento 22/101 msgs)
- [x] FASE 3: Link Hub v2.0 (preview, classificação, sync, grid/list)
- [x] FASE 4: Proteção Cash Box (nunca recriar histórico)
- [x] FASE 5: CRUD Caixa v2.0 (entries + modal + reconcile)
- [x] FASE 6: Polish (Toast, MobileNav)
- [x] FASE 7: FIX CRÍTICO — Autor Resolution 0% → 21.8% (resolveAuthor por nome, PlaywrightExtractor 4 fontes)
- [x] FASE 8: FIX CRÍTICO — Contagens infladas da API (stats agora calculados do history.json em tempo real)
- [x] FASE 9: Mojibake corrigido em 90+ strings (ftfy + PlaywrightExtractor Array.from fix)
- [x] FASE 10: Modo Pagamento Recebido com Distribuição Automática (25% entre sócios)

### Feito hoje (2026-05-09) — v16.2
- [x] FASE 11: Luna Control Center v2.0 — Terminal realtime, Chat interativo, Comandos Rápidos
- [x] FASE 12: System Engine — APIs `/api/system/*` + página `SystemEngine.jsx` para controle do motor do dashboard
- [x] FASE 13: Separação de responsabilidades — Luna (agente) vs Sistema (backend/frontend/supervisor)

### Feito hoje (2026-05-12) — v17.0 (Login Ultra-Secreto)
- [x] Sistema de autenticação JWT completo (login, me, logout, change-password)
- [x] Landing page camuflada com terminal secreto (Konami Code)
- [x] ProtectedRoute protege todas as rotas internas
- [x] Settings completo: Perfil, Segurança, Usuários
- [x] Security log com fingerprint + IP geolocation + WhatsApp alerta
- [x] NotificationCenter com WebSocket realtime
- [x] Caixa.jsx refetch fix após salvar

### Pendente futuro (priorizado)
- [ ] **Página de login tradicional** — substituir terminal secreto/Konami code (Opção A recomendada)
- [ ] **Criptografia em repouso** — `gmail-tokens.json`, `email-config.json`
- [ ] **Source maps** — desabilitar em produção (bundle JS exposto)
- [ ] **Dashboard: Atividade Recente** com contexto (usar history + classification)
- [ ] **Alertas:** Exibir `alerts` do `/api/finance/summary` no Dashboard
- [ ] **Link Hub:** enriquecimento background mais robusto (workers ou fila)
- [ ] **Cash Box:** endpoint `GET /api/cash-box/entries` para listar com filtros
- [ ] **Landing page de vendas personalizada** (aguardando CEO enviar HTML/JSX)
- [ ] **Atualizar Discord Webhook** — token atual retorna 401 (Invalid Webhook Token)

### Mojibake corrigido (2026-05-09)
- `backend/data/cash-box.json` — 2 strings (despesa rápida, dedução do caixa)
- `backend/data/whatsapp-history.json` — 8 strings + 1 ID truncado (emojis •— corrompidos)
- `backend/data/luna-buffer.json` — 15 strings
- `backend/data/full-extract.json` — 12 strings + 1 ID truncado
- `backend/data/links-index.json` — 1 string
- `backend/data/luna-data.json` — 4 strings
- `backend/data/company-tasks.json` — 1 string
- `backend/data/reports/*.json` — 46 strings
- **Total: 90+ strings corrigidas com `ftfy` (Fixes Text For You)**
- **PlaywrightExtractor**: `Array.from().slice(0,50).join('')` em vez de `.slice(0,50)` para nunca mais cortar emojis/UTF-8 no meio

---

## 🤖 ARQUITETURA ATUAL

```
Mensagem WhatsApp
    ↓
Agente Luna (Playwright CDP)
    ↓
SmartClassifier.regex (10ms) — 16 categorias, scoring 40-100
    ↓
├─ Salva em backend/data/whatsapp-history.json (histórico persistente)
└─ Salva em backend/data/luna-buffer.json (dados do scan atual)
    ↓
Backend server.js (localhost:3456)
    ↓
├─ resolveAuthor() — contacts-map.json → resolvedAuthor
├─ Link Hub — url-classifier + link-preview (cheerio)
├─ Cash Box — histórico imutável + CRUD entries + reconcile
└─ Finance Summary — versão completa (payments + expenses + alerts)
    ↓
Frontend Dashboard (localhost:3457)
    ↓
├─ WhatsApp.jsx — history primária, resolvedAuthor, LinkHub
├─ Caixa.jsx — CRUD completo de entradas
├─ Dashboard.jsx — WhatsApp card com histórico, Toast ativo
└─ MobileBottomNav — navegação mobile ativa
```

**Princípio arquitetural estabelecido:**
1. **PostgreSQL é o source of truth** para todas as 19 entidades de dados via `datastore-pg.js`
2. **`onChange` hook** dispara WebSocket broadcast para sincronização realtime frontend
3. **O `luna-buffer.json` é VOLÁTIL** — esvazia após processamento
4. **O histórico (`whatsapp-history.json`) agora está no PG** — arquivo local é backup apenas
5. **Zero adapters** — schema PG é 1:1 com estruturas JSON originais, IDs são strings JS-generated

---

## 💰 MODO PAGAMENTO RECEBIDO (FASE 10)

**Data:** 2026-05-08
**Status:** ✅ IMPLEMENTADO E TESTADO
**Componentes:** `PaymentModal.jsx`, `Caixa.jsx`, `server.js` (3 endpoints)

### Endpoints Backend
- `POST /api/cash-box/payments` — Cria entrada tipo `payment_received` com distribuição pendente
- `POST /api/cash-box/payments/:id/apply-distribution` — Gera 3 saídas (despesa) para pagamento dos sócios + 1 reinvestimento NEXO
- `POST /api/cash-box/payments/:id/confirm-split` — Marca distribuição como confirmada sem gerar saídas

### Regras de Distribuição
- Padrão: 25% cada (Abner, Enoque, Elias, NEXO Digital)
- Toggle off → % redistribuída proporcionalmente entre os ativos
- Sócios recebem como `expense` (saída do caixa)
- NEXO Digital recebe como `income` (reinvestimento)

### Frontend
- Modal com detecção automática de keywords (`pagamento`, `receber`, `fatura`, etc.)
- Preview em tempo real dos splits com toggle por sócio
- Badges "Pagamento" em âmbar na tabela de caixa
- Linhas expansíveis mostram status da distribuição

---

## 📊 CHECKLIST DE VERIFICAÇÃO RÁPIDA

```powershell
# Testar APIs do backend
Invoke-RestMethod -Uri "http://localhost:3456/api/finance/summary" | Select-Object totalPending, cashBoxBalance, alerts
Invoke-RestMethod -Uri "http://localhost:3456/api/whatsapp/history?limit=3" | Select-Object total
Invoke-RestMethod -Uri "http://localhost:3456/api/schema/contacts" | Select-Object success
Invoke-RestMethod -Uri "http://localhost:3456/api/links/stats" | Select-Object total, broken
Invoke-RestMethod -Uri "http://localhost:3456/api/cash-box" | Select-Object balance

# Verificar arquivos
Get-Content "backend/data/whatsapp-history.json" | ConvertFrom-Json | Measure-Object
Get-Content "backend/data/links-index.json" | ConvertFrom-Json | Select-Object -ExpandProperty links | Measure-Object
Get-Content "backend/data/cash-box.json" | ConvertFrom-Json | Select-Object -ExpandProperty history | Measure-Object
```

---

## 📝 NOTAS PARA O AGENTE

- O usuário é CEO da NEXO, baseado em Barcelona, fala pt-BR com toques de espanhol
- O usuário prefere **1 arquivo por vez**, com revisão brutal
- O usuário quer **EXTRAORDINÁRIO**, não "bom o suficiente"
- O backend está em `localhost:3456`, frontend em `localhost:3457`
- O agente Luna roda em Windows, usa Chrome CDP (porta 9223)
- Ollama roda em `localhost:11434` com modelo **`gemma3:1b`** (substituiu gemma2:2b — mais rápido, metade da RAM)
- WhatsApp Web está logado no perfil "Luna" do Chrome
- **NUNCA** enviar mensagens no grupo do Paulo (regra absoluta)
- **NUNCA** reconstruir — apenas evoluir o que existe
- **NUNCA** implementar "KIMI API VS LOCAL" (instrução explícita do usuário para ignorar)
- **NUNCA** modificar regex patterns do `IntentParser.js` sem rodar testes massivos primeiro
- **NUNCA** mudar `lunaOllama` config de `gemma3:1b` sem validar performance
- **SEMPRE** ler `PLANO.md`, `handoff.md` e `AGENTS.md` antes de qualquer ação

---

---

## 🔐 LOGIN ULTRA-SECRETO (TERMINAL INVISÍVEL) — IMPLEMENTADO v1.0

**Data:** 2026-05-12
**Status:** ✅ IMPLEMENTADO E TESTADO
**Commit:** `18668cc`

### O que foi entregue:

#### Backend (Node.js Express)
| Feature | Status |
|---------|--------|
| `POST /api/auth/login` — JWT + bcrypt + fingerprint | ✅ |
| `GET /api/auth/me` — retorna usuário do token | ✅ |
| `POST /api/auth/logout` — invalida token | ✅ |
| `POST /api/auth/change-password` — altera senha com bcrypt | ✅ |
| `GET /api/users` — lista usuários (sem expor senhas) | ✅ |
| `GET /api/security/log` — log de eventos de segurança | ✅ |
| `GET/PUT /api/security/settings` — config alertas | ✅ |
| `POST /api/security/test-whatsapp` — teste de alerta | ✅ |
| `GET /api/notifications` — notificações persistentes | ✅ |
| Device fingerprint (canvas + WebGL + UA + screen + timezone) | ✅ |
| IP geolocation via ip-api.com | ✅ |
| Security log sliding window (100 eventos) | ✅ |
| Rate limit por IP (5 tentativas / 5 min) | ✅ |
| Alerta WhatsApp após 5 falhas (grupo Production) | ✅ |

#### Frontend (React 18 + Vite)
| Feature | Status |
|---------|--------|
| `LandingPage.jsx` — camuflagem com hero, features, preços | ✅ |
| `SecretTerminal.jsx` — terminal CRT retro (Konami Code ↑↑↓↓←→←→BA) | ✅ |
| `AuthContext.jsx` — login/logout/token persistence + interceptador 401 | ✅ |
| `ProtectedRoute.jsx` — protege rotas internas, redirect se não auth | ✅ |
| `NotificationCenter.jsx` — bell icon + dropdown + WebSocket realtime | ✅ |
| `Settings.jsx` — 3 abas: Perfil, Segurança, Usuários | ✅ |
| `TopBar.jsx` — avatar + nome + logout (sem switchUser antigo) | ✅ |
| `Caixa.jsx` — refetch automático após salvar (bugfix) | ✅ |

### Usuários (senha padrão: `7741`)
| ID | Nome | Role | Cor |
|----|------|------|-----|
| abner | Abner | Admin | #3742fa |
| nonoke | Nonoke | Admin | #2ed573 |
| elias | Elias | Admin | #ffa502 |

### Segurança:
- JWT expira em 8h, salvo em localStorage
- Senhas hasheadas com bcrypt (custo 10)
- Fingerprint coletado em todo login (canvas hash, WebGL renderer, UA, screen, timezone, language)
- Tentativas falhas logadas com IP, geolocalização, dispositivo, fingerprint
- Alerta WhatsApp enviado no grupo Production após 5 tentativas falhas do mesmo IP em 5 min
- Rate limit de 5 min entre alertas WhatsApp consecutivos
- Interceptador axios 401: remove token e redireciona para landing automaticamente

### Pendente (aguardando CEO):
- Landing page de vendas personalizada (HTML/JSX) — substituir placeholder atual
- Teste real de alerta WhatsApp de intruso no grupo Production

---

---

## 🤖 LUNA BRAIN v2.0 — EVOLUÇÃO 2026-05-20

### O que foi entregue nesta sessão

#### 1. Bot do Telegram (@lunanexobot)
- **Arquivo:** `agents/telegram-luna-agent.cjs`
- **Token:** `7778220021:AAHI08gP1nlsizzh1f4ak00-eaSOdU1OwsY` (no `.env`)
- **Funcionalidade:** Recebe menções, classifica com NLP híbrido, responde com sugestão + botões inline (Executar / Dashboard / Não era isso)
- **Endpoints:** `POST /api/telegram/start`, `/stop`, `GET /api/telegram/status`

#### 2. Semantic Embedding Engine (Fase 1 v2.0)
- **Arquivo:** `backend/services/luna-semantic-nlu.js`
- **Modelo:** `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384 dims)
- **Índice:** `backend/data/luna-semantic-index.json` (2686 vetores)
- **Script de build:** `backend/scripts/build-semantic-index.js`
- **Endpoints:** `/api/luna/semantic-understand`, `/api/luna/hybrid-understand`

#### 3. NLP Híbrido (Ensemble)
O sistema agora usa **dois cérebros**:
- **Semantic Embedding** — similaridade vetorial de frases
- **NLP.js Bayesiano** — classificação por frequência de palavras
- **Ensemble** — detecta overconfidence do NLP.js em `financeiro.pagamento` e prefere semantic quando suspeito

#### 4. Sistema de Menções com Feedback Loop
- **Buffer:** `newMentions[]` em `luna-buffer.json` unifica WhatsApp + Telegram
- **Dashboard:** Aba "Menções" mostra sugestão NLP com botões Executar/Não era isso
- **Feedback:** `POST /api/luna/pending/:id/feedback` → corrige intent → ensina NLU
- **Execute:** `POST /api/luna/pending/:id/execute` → executa ação via ActionExecutor

---

## ⚠️ REGRA CRÍTICA — NUNCA APAGAR

### `handleExecute()` no `agents/telegram-luna-agent.cjs`

Quando editar o wizard do Telegram, **NUNCA** substitua o trecho do `handleExecute` que chama a API do backend. Ele é responsável por sincronizar a tarefa criada com o PostgreSQL.

```javascript
// ✅ CORRETO — chama API do backend (sync PG↔JSON):
    try {
      const apiToken = process.env.INTERNAL_API_TOKEN;
      const res = await fetch(`${CONFIG.API_BASE}/luna/pending/${mentionId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ actionType })
      });
      // ...

// ❌ ERRADO — ActionExecutor direto (só salva no JSON local, não aparece no dashboard):
    try {
      const executor = getActionExecutor();
      const result = await executor.execute(
        [{ type: actionType, params: { body: mention.body, author: mention.author } }],
        { authorName: mention.author }
      );
```

**Por quê?** O `ActionExecutor` escreve direto em `tasks.json` via `fs.writeFileSync`. Só o `writeJSON()` do backend dispara `syncFileToPG()`.

---

## 🔧 CONFIGURAÇÃO OBRIGATÓRIA NO `.env`

Adicionar no `backend/.env`:

```bash
# Token do bot do Telegram (fornecido por @BotFather)
TELEGRAM_BOT_TOKEN=7778220021:AAHI08gP1nlsizzh1f4ak00-eaSOdU1OwsY

# Token interno para o bot chamar a API do backend
# Gerar com: node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({id:'service',name:'Service Bot',role:'admin'},'SEU_JWT_SECRET',{expiresIn:'1y'}))"
INTERNAL_API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InNlcnZpY2UiLCJuYW1lIjoiU2VydmljZSBCb3QiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzkyNzgyNTgsImV4cCI6MTgxMDgzNTg1OH0.-mlBvPKJ98431BnygF5s5muaS1IOGm3ULYfT7wowLr0
```

---

## 📊 RESULTADOS DOS TESTES

| Frase de Teste | NLP.js (antigo) | Semantic (novo) | Melhoria |
|---|---|---|---|
| `"novo lead"` | `None` (100%) | `lead.criar` (100%) | ✅ Corrigiu |
| `"cria um rascunho"` | `tarefa.criar` (83%) | `email.criar_rascunho` (100%) | ✅ Corrigiu |
| `"fazer rascunho de email"` | `None` (100%) | `email.criar_rascunho` (91%) | ✅ Corrigiu |
| `"tirar do lixo"` | `financeiro.pagamento` (100%) | `email.mover_lixeira` (97%) | ✅ Corrigiu |
| `"cria uma tarefa"` | `tarefa.criar` (83%) | `tarefa.criar` (100%) | ✅ Melhorou |

---

## 🚀 PRÓXIMOS PASSOS (Roadmap v2.0)

### Fase 2: Context Memory Graph (~3-4 dias)
- Memória de últimas 10 interações por chat
- Entidades ativas do ERP (projetos, clientes)
- Re-ranking baseado em contexto conversacional

### Fase 3: LLM Local Chain-of-Thought (~1 semana)
- Ollama + Llama 3.1 8B rodando local
- Raciocínio passo-a-passo para frases complexas
- Chamado apenas quando ensemble confidence < 0.70

### Fase 4: Active Learning Avançado (~1 semana)
- Gera 20 variações sintéticas por correção
- Atualiza índice FAISS em 2 segundos
- Fine-tuning LoRA do LLM com feedback

---

*Atualizado após evolução completa v4.0 em 2026-05-09*
*Status: Backend ✅ | Agente ✅ | Frontend ✅ | Chat Persistente ✅ | Telegram Bot ✅ | Semantic NLU ✅*
*Fases concluídas: 1.1, 1.2, 1.3, 1.4, 2, 3.1, 3.2, 3.3, 3.4, 4, 5 (Chat Threads), 6 (Telegram Bot), 7 (Semantic Embedding)*
