# KIMI.MD — NEXO Dashboard Pro

> Este arquivo é contexto operacional, NÃO documentação. Carrega no início de toda sessão. Mantenha curto, opinado e atualizado.

---

## 1. Project Identity

**NEXO Dashboard Pro** — ERP interno da NEXO Digital (empresa de 3 founders: Abner, Nonoke, Elias). Stack Node.js + React. Todos os dados em JSON files (sem banco de dados). Deploy manual em servidor Windows (RDP).

**Propósito:** Centralizar clientes, projetos, tarefas, WhatsApp (Luna agent), financeiro, leads, pipeline de vendas e agora **IDEIAS** (sessão de brainstorm com IA Gemini).

---

## 2. Current Focus

- [x] **Sessão IDEIAS mergeada** — CRUD completo + editor TipTap + chat Gemini + templates + conversão em tarefas
- [x] **GEMINI_API_KEY inserida no `.env`** do backend (usando chave `AIzaSy...` do Google AI Studio)
- [x] **dotenv instalado** — `backend/server.js` agora carrega `.env` corretamente
- [x] **IA polida com Tool Calling** — IA pode criar, editar, apagar, listar, comentar, mudar status e converter em tarefa
- [x] **Prompt enxuto** — IA não se apresenta mais, respostas curtas e diretas
- [x] **Ollama removido** — Chat da Luna e IntentParser agora usam Gemini API (gemini-2.5-flash-lite)
- [x] **Badge Gemini no frontend** — Indicador visual na aba LUNA/CHAT
- [ ] **Testar navegação visual** da aba Ideias no browser
- [ ] **Corrigir chunk size warning** do frontend (1.869KB > 500KB)

**Branch ativa:** `codex/initial-nexo-dashboard-pro-v16`

---

## 3. Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 18+, Express 4, WebSocket (ws), CommonJS |
| Frontend | React 18, Vite 6, TailwindCSS 3, Framer Motion |
| Auth | JWT (jsonwebtoken), bcryptjs, localStorage |
| IA | Gemini 2.5 Flash via `@google/genai` (IntentParser + Chat Luna + Ideias) |
| Rich Text | TipTap v3 (StarterKit + Table + TaskList + Image + Highlight + Typography) |
| DnD | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Charts | Recharts |
| Icons | lucide-react |
| Data | JSON files puros (sem DB) |

---

## 4. Architecture

```
NEXO_DASHBOARD_PRO/
├── backend/
│   ├── server.js              # Entry point Express (~5600 linhas)
│   ├── routes/
│   │   └── ideas.js           # API Sessão IDEIAS (factory function(requireAuth))
│   ├── data/                  # TODOS os dados JSON
│   │   ├── schema/            # Schemas estruturados (clients, projects, contacts)
│   │   └── *.json             # Arquivos de dados flat
│   ├── services/              # WhatsApp sender, link preview, cache
│   ├── cache-manager.js       # Cache de comandos CLI
│   └── external-services.js   # GitHub, Vercel, tools
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Router principal
│   │   ├── pages/             # 29 páginas
│   │   ├── components/        # Componentes reutilizáveis
│   │   ├── components/ideas/  # IdeiasTable, IdeasKanban, IdeasGallery, IdeasList
│   │   ├── components/editor/ # BlockEditor, SlashCommandMenu, BubbleToolbar
│   │   ├── components/ai/     # AIChatSidebar
│   │   ├── context/           # AuthContext, DataContext
│   │   └── styles/index.css   # Tailwind + classes custom
│   └── package.json
├── agents/                    # Luna CTO agent, WhatsApp agent (fora do scope)
└── KIMI.MD                    # Este arquivo
```

**Regra de ouro:** NUNCA modifique arquivos fora do que for necessário. O projeto é monolito flat — server.js tem ~5600 linhas e muita lógica vive ali.

---

## 5. Operational Rules

- **JavaScript puro** — NUNCA use TypeScript. O projeto é 100% JS (CommonJS backend, ESM frontend).
- **axios no frontend** — NUNCA use fetch. Sempre axios com headers `{ Authorization: Bearer ${token} }`.
- **JSON files** — Todos os dados são JSON. Use `readJSON`/`writeJSON` helpers (já existem no server.js e ideas.js).
- **Auth middleware** — Sempre `requireAuth` para rotas protegidas. NUNCA `authMiddleware`.
- **Design system NEXO** — Usar tokens `bg-nexo-bg`, `glass-card`, `text-nexo-muted`, `text-nexo-primary`. NUNCA cores hardcoded.
- **Broadcast WebSocket** — Após modificar dados, sempre `broadcast({ type: 'MODULE', data })`.
- **Não quebre rotas existentes** — Ao adicionar features, NUNCA remova ou renomeie endpoints existentes.
- **Factory pattern para rotas** — Novas rotas devem exportar `module.exports = function(requireAuth) { ... }`.
- **Path corrections** — Se swarm gerar path errado (ex: `data/schema/ideas-registry.json`), CORRIJA para `data/ideas-registry.json`.

---

## 6. Data Model (Arquivos JSON Principais)

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `data/users.json` | Dict | `{ active, users: { abner, nonoke, elias } }` — cada user tem name, role, color |
| `data/tasks.json` | Array | Tarefas do sistema com status, priority, assignedTo |
| `data/company-tasks.json` | Array | Tarefas da empresa (separado de tasks.json) |
| `data/schema/clients-registry.json` | Dict | `{ clients: { [clientId]: {...} } }` |
| `data/schema/projects-registry.json` | Dict | `{ projects: { [projectId]: {...} } }` |
| `data/schema/contacts-map.json` | Dict | `{ contacts: { [phone]: { displayName, shortName, role, avatar } } }` |
| `data/payments.json` | Array | Receitas com transactions, revenueSplit, status |
| `data/expenses.json` | Array | Despesas com splitAmong, paidBy, recurring |
| `data/cash-box.json` | Dict | Caixa com balance, history, projections |
| `data/ideas-registry.json` | Dict | `{ _schema, ideas: [], templates: [], categories: [] }` |
| `data/whatsapp-history.json` | Array | Mensagens do WhatsApp com classification |
| `data/luna-buffer.json` | Dict | Buffer volátil do agente Luna |

**Obs:** `clients-registry.json` e `projects-registry.json` são **dicts** (objeto com IDs como keys), NÃO arrays.

---

## 7. API Surface (Endpoints Principais)

### Auth
- `POST /api/auth/login` → `{ token }`
- `GET /api/auth/me` → `{ user }`
- Todas as rotas abaixo usam `requireAuth`

### Core
- `GET /api/state` → clients + tasks + users + predictions
- `GET|POST|PUT|DELETE /api/tasks` → CRUD tarefas
- `GET|POST /api/whatsapp` → Buffer WhatsApp
- `GET /api/whatsapp/history` → Histórico de mensagens
- `GET /api/whatsapp-agent` → Dados do agente inteligente

### Financeiro
- `GET|POST /api/payments` → Receitas
- `POST /api/payments/:id/transactions` → Adicionar pagamento
- `GET|POST /api/expenses` → Despesas
- `GET|PUT /api/cash-box` → Caixa
- `GET /api/cash-box/projection` → Projeção 6 meses

### IDEIAS (nova)
- `GET /api/ideas` → Lista de ideias
- `POST /api/ideas` → Criar ideia
- `GET /api/ideas/:id` → Detalhe
- `PUT /api/ideas/:id` → Atualizar
- `DELETE /api/ideas/:id` → Deletar
- `GET /api/ideas/templates` → Templates
- `POST /api/ideas/from-template` → Criar do template
- `GET /api/ideas/stats` → Estatísticas
- `POST /api/ideas/:id/comments` → Comentário
- `POST /api/ideas/:id/ai-chat` → Chat com Gemini (+ Tool Calling interno)
- `POST /api/ideas/:id/apply-ai` → Aplicar sugestão da IA
- `POST /api/ideas/:id/convert-task` → Converter em tarefa

**Tool Calling da IA (7 ferramentas):**
A IA pode executar acoes automaticamente via chat usando o formato `<TOOL_CALL>{"tool": "...", "params": {...}}</TOOL_CALL>`:
1. `create_idea` — Cria nova ideia no workspace
2. `update_idea` — Atualiza titulo, conteudo, status, prioridade, tags
3. `delete_idea` — Arquiva ideia (soft delete)
4. `list_ideas` — Lista ideias com filtros
5. `add_comment` — Adiciona comentario
6. `change_status` — Muda status da ideia
7. `convert_to_task` — Converte em tarefa do sistema

**Prompt da IA:** Direto, sem apresentacao, maximo 150 palavras. Nunca pede confirmacao antes de executar.

---

## 8. Design System

### Tokens Tailwind (tailwind.config.js)
```
bg: '#08080c'          card: '#0f0f16'       border: '#1a1a2e'
success: '#2ed573'     danger: '#ff4757'     warning: '#ffa502'
info: '#6c5ce7'        text: '#e0e0e0'       muted: '#6c757d'
```

### Classes Custom (index.css)
- `.glass` — backdrop blur + borda sutil
- `.glass-card` — card padrão do NEXO (usado EM TODA UI)
- `.btn-primary` — botão primário (bg-nexo-info)
- `.nav-item` — itens da sidebar
- `.gradient-text` — gradiente violeta-cyan-verde

### Fontes
- **Body:** Inter
- **Heading:** Space Grotesk
- **Mono:** JetBrains Mono

---

## 9. Authentication

- **Users:** abner, nonoke, elias — todos Admin
- **Senha padrão:** `7741`
- **JWT_SECRET:** definido no `.env` do backend
- **Token:** armazenado em `localStorage.getItem('nexo_token')`
- **Logout automático:** Interceptador 401 no axios remove token e redireciona
- **Switch user:** `POST /api/users/switch` atualiza `users.json.active`

---

## 10. Active Issues & TODO

- [ ] **Testar Ideias no browser** — APIs funcionam via curl, mas navegação visual não testada
- [ ] **Testar IA Gemini** — API key inserida, mas chat não testado end-to-end
- [ ] **Chunk size warning** — Bundle frontend >500KB (não crítico, mas pode otimizar lazy loading)
- [ ] **Playwright browser lock** — Ferramenta de screenshot com erro, não bloqueia o projeto
- [ ] **Rota /api/users GET** — Não existe; lista de users vem de `/api/state` ou `/api/auth/me`

---

## 11. Deployment

### Backend (porta 3456)
```bash
cd backend && npm start   # ou node server.js
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

---

## 12. Session History

| Data | O que foi feito |
|------|----------------|
| 2026-05-10 | FIX WhatsApp gray screen (normalizeAgentData com hooks errados) |
| 2026-05-11 | Criação do MISSION BRIEF para Sessão IDEIAS |
| 2026-05-12 | Agent Swarm gera código completo da Sessão IDEIAS |
| 2026-05-13 | Merge inteligente no projeto real (15 arquivos novos) |
| 2026-05-14 | Build passa, APIs testadas com sucesso, path corrigido |
| 2026-05-18 | GEMINI_API_KEY inserida no `.env`, KIMI.MD criado |
| 2026-05-18 | dotenv instalado no backend para carregar `.env` corretamente |
| 2026-05-18 | IA polida: prompt enxuto sem apresentacao, respostas curtas |
| 2026-05-18 | Tool Calling implementado: 7 ferramentas para IA manipular ideias |
| 2026-05-18 | Frontend atualizado para mostrar acoes executadas pela IA no chat |
| 2026-05-18 | Ollama removido do sistema; Gemini API integrada no chat da Luna e no IntentParser |
| 2026-05-18 | Badge Gemini adicionado no header do chat da Luna |

---

## 13. Credentials & Secrets

> NUNCA commitar valores reais. `.env` está no `.gitignore`.

| Secret | Local |
|--------|-------|
| GEMINI_API_KEY | `backend/.env` |
| JWT_SECRET | `backend/.env` (fallback hardcoded em server.js) |
| User passwords | `backend/data/users.json` (bcrypt hashed) |

---

## 14. Dicas para Continuação

- Para nova feature: crie `plan.md` primeiro, depois execute swarm ou manual
- Para bug no frontend: cheque `AuthContext` e interceptador 401
- Para bug no backend: cheque se o arquivo JSON existe e tem schema válido
- Para dados do WhatsApp: fonte da verdade é `whatsapp-history.json` (não o buffer)
- Para adicionar nova página: editar `App.jsx` + `Sidebar.jsx` apenas
- Para nova rota API: seguir pattern factory `module.exports = function(requireAuth)`
- Sempre testar com `curl` antes de testar no browser
