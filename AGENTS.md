<!-- From: /media/jhin/Backup Documentos/01_ATIVOS/NEXO_DASHBOARD_PRO/AGENTS.md -->
# ═══════════════════════════════════════════════════════════════════
# AGENTS.md — NEXO COMMAND CENTER v4.0
# Documento de contexto para agentes de IA
# Data: 2026-05-12
# Última atualização: 2026-05-12 18:35
# Último commit: c8b762b (codex/initial-nexo-dashboard-pro-v16)
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

#### Backend (server.js — ~4000 linhas)
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
| 20 | Email Hub (IMAP/SMTP) | ✅ IMPLEMENTADO | 3-col layout, compose modal, sync inbox |
| 21 | Instagram Hub | ✅ IMPLEMENTADO | Profile iframe + messages import JSON |
| 22 | detectClient() + Toast | ✅ IMPLEMENTADO | `/api/detect-client`, ToastContainer com useToast |

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
│   ├── server.js                    ← ~4000 linhas. APIs: /api/system/*, /api/links/*, /api/cash-box/entries/*
│   ├── services/
│   │   ├── url-classifier.js        ← classificação de URL por plataforma
│   │   └── link-preview.js          ← fetch OGP + cache 24h
│   ├── data/
│   │   ├── luna-buffer.json         ← newMessages: [] (volátil por design)
│   │   ├── whatsapp-history.json    ← 84+ mensagens com resolvedAuthor
│   │   ├── cash-box.json            ← Saldo protegido, histórico imutável, auditLog
│   │   ├── links-index.json         ← 45 links classificados
│   │   └── schema/
│   │       └── contacts-map.json    ← 535 linhas, dados ricos dos 3 founders
│   └── fix-bom.js                   ← Script de remoção de BOM + backup
├── agents/
│   ├── luna-cto-agent.cjs           ← Agente principal (Playwright CDP)
│   ├── SmartClassifier_v16.js       ← Classificador + resolveAuthor()
│   └── LunaBrain_v16.js             ← 7 personalidades
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── LinkHub.jsx          ← grid/list, filtros, preview, busca
│       │   └── Sidebar.jsx          ← EVOLUÍDO — item "Sistema" adicionado
│       ├── hooks/
│       │   └── useLinks.js          ← consumo de /api/links com WebSocket
│       ├── pages/
│       │   ├── WhatsApp.jsx         ← history primária, resolvedAuthor, LinkHub
│       │   ├── Dashboard.jsx        ← WhatsApp card usa histórico
│       │   ├── Caixa.jsx            ← CRUD completo de entradas
│       │   ├── Financeiro.jsx       ← summary completo
│       │   ├── LunaControl.jsx      ← REESCRITO v2 — Terminal + Chat + Comandos
│       │   └── SystemEngine.jsx     ← NOVO — controle Backend/Frontend/Supervisor
│       ├── context/
│       │   └── ToastContext.jsx     ← ATIVADO
│       └── main.jsx                 ← ToastProvider envolve App
└── docs/
    └── planos/
        └── PLANO_EVOLUCAO_v16.1.md  ← Plano completo de evolução
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

### Pendente futuro
- [ ] Dashboard: Atividade Recente com contexto (usar history + classification)
- [ ] Alertas: Exibir `alerts` do `/api/finance/summary` no Dashboard
- [ ] Link Hub: enriquecimento background mais robusto (workers ou fila)
- [ ] Cash Box: endpoint `GET /api/cash-box/entries` para listar com filtros
- [ ] Landing page de vendas personalizada (aguardando CEO enviar HTML/JSX)

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

**Princípio arquitetural estabelecido:** O `luna-buffer.json` é VOLÁTIL — ele esvazia após processamento. O histórico (`whatsapp-history.json`) é PERSISTENTE. O frontend consome o histórico como fonte primária, e o buffer apenas como "novidades do último scan".

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
- Ollama roda em `localhost:11434` com modelo `gemma2:2b`
- WhatsApp Web está logado no perfil "Luna" do Chrome
- **NUNCA** enviar mensagens no grupo do Paulo (regra absoluta)
- **NUNCA** reconstruir — apenas evoluir o que existe
- **NUNCA** implementar "KIMI API VS LOCAL" (instrução explícita do usuário para ignorar)

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

*Atualizado após evolução completa v4.0 em 2026-05-09*
*Status: Backend ✅ | Agente ✅ | Frontend ✅ | Chat Persistente ✅*
*Fases concluídas: 1.1, 1.2, 1.3, 1.4, 2, 3.1, 3.2, 3.3, 3.4, 4, 5 (Chat Threads)*
