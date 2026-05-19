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

---

## 0. Instance Identity

```yaml
active_instance: kimi-10a71fc7
signature: KIMI-10A71FC7 🟡
context_system: .kimi-context/ (v1)
last_updated: 2026-05-19
```

**Regra para múltiplas instâncias Kimi:**
- Cada instância deve gerar seu próprio `kimi-XXXXXXXX` ID
- NUNCA sobrescreva trabalho de outra instância sem confirmar com o usuário
- Se `index.json` mostrar outra instância como `active`, pergunte antes de continuar

---

## 1. Project Identity

**NEXO Dashboard Pro** — ERP interno da NEXO Digital (empresa de 3 founders: Abner, Nonoke, Elias). Stack Node.js + React. Todos os dados em JSON files (sem banco de dados). Deploy na Render.com free tier.

**Propósito:** Centralizar clientes, projetos, tarefas, WhatsApp (Luna agent), financeiro, leads, pipeline de vendas, **IDEIAS** (brainstorm com IA Gemini), e agora **EMAIL HUB** (integração Gmail + IA).

---

## 2. Current Focus

### 🎯 Sprint Ativo: Workspace-Leads Unification + Active Learning

**Status:** ✅ Concluído — build passando, commit `3ea779f` enviado

#### Workspace-Leads Unification ✅
- [x] `GET /api/workspace/clients` retorna leads (`kind: 'lead'`) + clientes (`kind: 'client'`) unificados
- [x] Sidebar do Workspace separada em seções "Leads" e "Clientes"
- [x] LeadPreviewPanel: preview de lead com botão "Converter em Cliente"
- [x] `POST /api/leads/:id/convert` cria workspace automaticamente + README.md
- [x] workspace-manager.js: `clientExists()` para evitar duplicação

#### Active Learning ✅
- [x] SmartFormModal mostra "Não era isso?" quando NLU score < 0.85
- [x] Picker de intents corretas busca de `/api/luna/intents`
- [x] POST `/api/luna/learn` re-treina modelo em ~3-5s
- [x] Feedback visual com toasts ("Luna aprendeu!")

#### Próximos passos pendentes
- [ ] **🔴 URGENTE:** Substituir `GEMINI_API_KEY` no `backend/.env` (revogada pelo Google)
- [ ] FASE 4 — Expandir corpus NLU de ~25 para 50-100 exemplos por intent
- [ ] FASE 5 — Melhorar extração de título (regex atual remove objeto)
- [ ] Deploy para Render

**Branch ativa:** `codex/initial-nexo-dashboard-pro-v16`

---

## 3. Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 18+, Express 4, WebSocket (ws), CommonJS |
| Frontend | React 18, Vite 6, TailwindCSS 3, Framer Motion |
| Auth | JWT (jsonwebtoken), bcryptjs, localStorage |
| IA | Gemini 2.5 Flash via `@google/genai` (IntentParser + Chat Luna + Ideias + Email AI) |
| Rich Text | TipTap v3 (StarterKit + Table + TaskList + Image + Highlight + Typography) |
| DnD | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Charts | Recharts |
| Icons | lucide-react |
| Data | JSON files puros (sem DB) |
| Email | Gmail OAuth 2.0 (Client ID: 644081746963-qmop60bnprhslm6v5j5t4sc46f36hcr5) |

---

## 4. Architecture

```
NEXO_DASHBOARD_PRO/
├── backend/
│   ├── server.js              # Entry point Express (~6800 linhas)
│   ├── routes/
│   │   └── ideas.js           # API Sessão IDEIAS
│   ├── services/
│   │   ├── email-ai.js        # Gemini prompts para email (suggest/draft/summarize/analyze)
│   │   └── ...
│   ├── data/                  # TODOS os dados JSON
│   │   ├── schema/            # Schemas estruturados
│   │   ├── email-drafts.json  # Rascunhos da Luna (pending/approved/rejected)
│   │   └── *.json
│   └── agents/
│       └── core/ActionExecutor.js  # Executa ações da Luna (criar tarefa, etc)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   └── EmailHub.jsx   # Página principal de email (Sprint 1+2)
│   │   ├── components/email/
│   │   │   ├── EmailSidebar.jsx
│   │   │   ├── EmailReader.jsx
│   │   │   ├── EmailCompose.jsx
│   │   │   ├── EmailList.jsx
│   │   │   ├── LunaEmailAssistant.jsx  # Assistente AI inline
│   │   │   └── ResizablePanel.jsx
│   │   ├── components/ideas/
│   │   ├── components/editor/
│   │   └── context/
│   │       ├── EmailFocusModeContext.jsx
│   │       └── EmailDensityContext.jsx
│   └── package.json
├── .kimi-context/             # 🧠 PERSISTÊNCIA DE CONTEXTO (ver seção 15)
│   ├── index.json
│   ├── handoff.md
│   └── sessions/
└── KIMI.MD                    # Este arquivo
```

**Regra de ouro:** NUNCA modifique arquivos fora do que for necessário. O projeto é monolito flat — server.js tem muita lógica viva ali.

---

## 5. Operational Rules

- **JavaScript puro** — NUNCA use TypeScript. CommonJS backend, ESM frontend.
- **axios no frontend** — Sempre axios com headers `{ Authorization: Bearer ${token} }`.
- **JSON files** — Use `readJSON`/`writeJSON` helpers do server.js.
- **Auth middleware** — Sempre `requireAuth` para rotas protegidas. NUNCA `authMiddleware`.
- **Design system NEXO** — Tokens `bg-nexo-bg`, `glass-card`, `text-nexo-muted`, `text-nexo-primary`.
- **Broadcast WebSocket** — Após modificar dados, sempre `broadcast({ type: 'MODULE', data })`.
- **Não quebre rotas existentes** — Ao adicionar features, NUNCA remova ou renomeie endpoints.
- **Factory pattern para rotas** — Novas rotas exportam `module.exports = function(requireAuth) { ... }`.

---

## 6. Data Model (Arquivos JSON Principais)

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `data/users.json` | Dict | `{ active, users: { abner, nonoke, elias } }` |
| `data/tasks.json` | Array | Tarefas do sistema |
| `data/company-tasks.json` | Array | Tarefas da empresa |
| `data/schema/clients-registry.json` | Dict | `{ clients: { [id]: {...} } }` |
| `data/schema/projects-registry.json` | Dict | `{ projects: { [id]: {...} } }` |
| `data/payments.json` | Array | Receitas |
| `data/expenses.json` | Array | Despesas |
| `data/cash-box.json` | Dict | Caixa |
| `data/ideas-registry.json` | Dict | `{ _schema, ideas: [], templates: [], categories: [] }` |
| `data/email-drafts.json` | Dict | `{ drafts: [], lastId: 0 }` — rascunhos Luna |
| `data/notifications.json` | Array | Notificações do dashboard |

---

## 7. API Surface (Endpoints Principais)

### Auth
- `POST /api/auth/login` → `{ token }`
- `GET /api/auth/me` → `{ user }`

### Core
- `GET /api/state` → clients + tasks + users + predictions
- `GET|POST|PUT|DELETE /api/tasks` → CRUD tarefas
- `GET|POST /api/whatsapp` → Buffer WhatsApp

### Email Hub (Sprint 2)
- `GET /api/email/messages` → Lista emails
- `GET /api/email/threads/:id` → Thread completa
- `POST /api/email/messages/send` → Enviar email
- `POST /api/email/messages/:id/read|unread|star|archive|trash|spam` → Ações
- `POST /api/email/ai/suggest-reply` → 3 sugestões de tom
- `POST /api/email/ai/draft` → Gera rascunho com instruções
- `POST /api/email/ai/summarize` → Resumo + actionItems + sentiment + priority
- `POST /api/email/ai/analyze` → Análise de segurança
- `POST /api/email/ai/draft-for-approval` → Gera draft pending + task + notificação
- `POST /api/email/ai/action-items-to-tasks` → Converte action items em tarefas
- `GET /api/email/drafts?threadId=&status=` → Listar rascunhos
- `POST /api/email/drafts/:id/approve` → Aprovar rascunho
- `POST /api/email/drafts/:id/reject` → Rejeitar rascunho

### IDEIAS
- `GET|POST|PUT|DELETE /api/ideas` → CRUD
- `POST /api/ideas/:id/ai-chat` → Chat Gemini com Tool Calling
- `POST /api/ideas/:id/convert-task` → Converter em tarefa

---

## 8. Design System

### Tokens Tailwind
```
bg: '#08080c'          card: '#0f0f16'       border: '#1a1a2e'
success: '#2ed573'     danger: '#ff4757'     warning: '#ffa502'
info: '#6c5ce7'        text: '#e0e0e0'       muted: '#6c757d'
```

### Classes Custom
- `.glass` — backdrop blur + borda sutil
- `.glass-card` — card padrão do NEXO
- `.btn-primary` — botão primário
- `.nav-item` — itens da sidebar
- `.gradient-text` — gradiente violeta-cyan-verde

---

## 9. Authentication

- **Users:** abner, nonoke, elias — todos Admin
- **Senha padrão:** `7741`
- **JWT_SECRET:** `backend/.env`
- **Token:** `localStorage.getItem('nexo_token')`
- **Logout automático:** Interceptador 401 no axios

---

## 10. Active Issues & TODO

- [ ] **Deploy Sprint 2** — Branch `codex/initial-nexo-dashboard-pro-v16` para Render
- [ ] **Teste browser** — Banner de drafts, aprovação, action items → tasks
- [ ] **Chunk size warning** — Bundle frontend ~1.8MB (não crítico)
- [ ] **Preencher `to` no compose** — Quando aprovar draft de reply, preencher destinatário
- [ ] **Verificar `requireAuth`** — Nos novos endpoints `/api/email/ai/*`

---

## 11. Deployment

### Backend (porta 3456)
```bash
cd backend && npm start
```

### Frontend (porta 3457)
```bash
cd frontend && npm run dev
```

### Build produção
```bash
cd frontend && npm run build
# Dist vai para backend/public/ (serve estático pelo Express)
```

**Render:** Auto-deploy na branch `codex/initial-nexo-dashboard-pro-v16`.

---

## 12. Session History

| Data | O que foi feito | Instância |
|------|----------------|-----------|
| 2026-05-10 | FIX WhatsApp gray screen | — |
| 2026-05-11 | Criação do MISSION BRIEF para Sessão IDEIAS | — |
| 2026-05-12 | Agent Swarm gera código completo da Sessão IDEIAS | — |
| 2026-05-13 | Merge inteligente no projeto real (15 arquivos) | — |
| 2026-05-14 | Build passa, APIs testadas com sucesso | — |
| 2026-05-18 | GEMINI_API_KEY no `.env`, KIMI.MD criado | — |
| 2026-05-18 | dotenv instalado, IA polida, Ollama removido | — |
| 2026-05-18 | Tool Calling implementado (7 ferramentas) | — |
| 2026-05-18 | **NEXO Mail Sprint 1** — Layout, modo foco, sidebar, Luna painel inline | kimi-bbf526dc 🔵 |
| 2026-05-18 | **NEXO Mail Sprint 2** — Drafts pendentes, action items→tasks, notificações | kimi-bbf526dc 🔵 |
| 2026-05-18 | **Sistema `.kimi-context/` criado** — Persistência de contexto entre sessões | kimi-bbf526dc 🔵 |

---

## 13. Credentials & Secrets

> NUNCA commitar valores reais. `.env` está no `.gitignore`.

| Secret | Local |
|--------|-------|
| GEMINI_API_KEY | `backend/.env` |
| JWT_SECRET | `backend/.env` |
| Gmail OAuth Client ID | Hardcoded no frontend (público) |
| User passwords | `backend/data/users.json` (bcrypt) |

---

## 14. Dicas para Continuação

- Para nova feature: crie `plan.md` primeiro, depois execute
- Para bug no frontend: cheque `AuthContext` e interceptador 401
- Para bug no backend: cheque se arquivo JSON existe e tem schema válido
- Para dados do WhatsApp: fonte da verdade é `whatsapp-history.json`
- Para adicionar nova página: editar `App.jsx` + `Sidebar.jsx` apenas
- Para nova rota API: seguir pattern factory `module.exports = function(requireAuth)`
- Sempre testar com `curl` antes de testar no browser

---

## 15. 🧠 Sistema de Persistência de Contexto (.kimi-context)

> Criado em 2026-05-18 para mitigar perda de informação por context compaction.
> Baseado em: Context Anchoring, memo-agent, OpenClaw memory patterns.

### Estrutura
```
.kimi-context/
├── index.json          # Índice mestre: sessões, instâncias, regras
├── handoff.md          # 🔄 O QUE FAZER AGORA — leia isto primeiro!
└── sessions/
    └── YYYY-MM-DD-kimi-XXXXXXXX.md  # Snapshot completo por sessão
```

### Protocolo para Nova Sessão
1. **LER** `.kimi-context/index.json` — qual instância está ativa?
2. **LER** `.kimi-context/handoff.md` — o que está pendente?
3. **LER** `KIMI.MD` — contexto operacional geral
4. **SE** outra instância estiver `active`: confirmar com usuário antes de prosseguir
5. **GERAR** novo `kimi-XXXXXXXX` ID único
6. **ATUALIZAR** `index.json` com nova sessão
7. **TRABALHAR** normalmente
8. **ANTES de context compaction:** salvar snapshot em `sessions/`
9. **ANTES de encerrar:** atualizar `handoff.md`

### Geração de ID de Instância
```bash
kimi_id="kimi-$(date +%s%N | sha256sum | head -c 8)"
# Ex: kimi-bbf526dc
```

### Regras de Conflito
- NUNCA duas instâncias `active` ao mesmo tempo
- Se encontrar trabalho não-finalizado de outra instância: pergunte ao usuário
- Snapshots são READ-ONLY após criação (exceto para marcar como `archived`)

---

*Última atualização: 2026-05-18 por kimi-bbf526dc 🔵*
