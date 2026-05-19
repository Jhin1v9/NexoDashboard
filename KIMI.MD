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
active_instance: kimi-10a71fc7
signature: KIMI-10A71FC7 🟡
context_system: .kimi-context/ (v1)
last_updated: 2026-05-19T20:15:00+02:00
```

**Regra para múltiplas instâncias Kimi:**
- Cada instância deve gerar seu próprio `kimi-XXXXXXXX` ID
- NUNCA sobrescreva trabalho de outra instância sem confirmar com o usuário
- Se `index.json` mostrar outra instância como `active`, pergunte antes de continuar

---

## 1. Project Identity

**NEXO Dashboard Pro** — ERP interno da NEXO Digital (empresa de 3 founders: Abner, Nonoke, Elias). Stack Node.js + React. Todos os dados em JSON files (sem banco de dados). Deploy na Render.com free tier.

**Propósito:** Centralizar clientes, projetos, tarefas, WhatsApp (Luna agent), financeiro, leads, pipeline de vendas, **IDEIAS** (brainstorm com IA Gemini), e agora **EMAIL HUB** (integração Gmail + IA).

**Repo GitHub:** `github.com/Jhin1v9/NexoDashboard` (único — `NexoDashboard/` local antigo foi desvinculado do remote)

**Branch oficial:** `main` (merge de `codex/initial-nexo-dashboard-pro-v16` feito em 2026-05-19, fast-forward sem conflitos)

**Histórico:** O desenvolvimento foi feito na branch `codex/initial-nexo-dashboard-pro-v16` e depois mergeado para `main`. A branch `codex` ainda existe mas não é mais necessária — `main` tem o código absoluto.

---

## 2. Current Focus

### 🎯 Sprint Ativo: Workspace File Viewer v2 + Contexto Luna Enriquecido

**Status:** ✅ Concluído — build passando, commits até `3e4256e` enviados

#### Workspace File Viewer v2 ✅
- [x] **Syntax highlighting:** `highlight.js` com 15 linguagens (JS, TS, JSON, CSS, Python, PHP, SQL, YAML, Bash, Dockerfile, GraphQL, etc.)
- [x] **Modo Preview/Código:** Toggle para Markdown, HTML e arquivos de código
- [x] **Indicador de alterações não salvas:** ● laranja no header + texto "alterações não salvas"
- [x] **Atalhos de teclado:** `Ctrl+S` salvar, `ESC` fechar viewer
- [x] **Scrollbars customizadas:** `.custom-scrollbar` com hover `#3a3a4e`
- [x] **Preview Markdown:** Headers, bold, italic, listas, links, code blocks, blockquote, hr
- [x] **Preview HTML:** iframe com sandbox + botão "Abrir no navegador" (nova aba)
- [x] **Contexto Luna enriquecido:** `buildDashboardContext()` lê o arquivo do workspace e injeta no prompt (até 4000 chars)

#### Endpoints Backend ✅
- [x] `GET /api/workspace/clients/:id/content` — Lê arquivo textual (limite 5MB)
- [x] `PUT /api/workspace/clients/:id/content` — Salva arquivo textual
- [x] `contextFile` repassado em `/api/luna/chat` e `/api/luna/threads/:id/messages`

#### Passo 3 — Execução Inteligente ✅
- [x] **lunaDecisionEngine.js:** Matriz de decisão (score + dados + risco → auto/collect/confirm/preview/transform)
- [x] **LunaActionDrawer.jsx:** Drawer lateral 380px, sem backdrop blur, página continua interativa
- [x] **LunaSafetyDelay.jsx:** Barra de progresso 1.5s com botão "Desfazer" (ESC) para ações destrutivas
- [x] **useLunaAnimation.js:** Web Animations API — create/delete/update/move/batch/breath/progress/shake
- [x] **LunaActionFlow.jsx:** Componente de apresentação puro (sem useEffect), orquestrado pelo LunaFloatingButton
- [x] **Integração no LunaFloatingButton:** Decision Engine chamado no submit handler, execução direta (auto) ou drawer

#### NLU Expansão ✅
- [x] **137 intents** em 15 domínios (PT/ES/CA), modelo re-treinado e validado
- [x] **SmartFormModal:** Schemas para todos os 137 intents

#### Infraestrutura Luna Viva (Passos 1-2) ✅
- [x] **LunaContext + Event Bus:** Consciência global, comunicação desacoplada
- [x] **Harvesters:** RouteHarvester, TaskHarvester, EmailHarvester, FinanceHarvester
- [x] **useLunaDOM:** Captura de cliques, foco e scroll no DOM

#### Deploy/Repo ✅
- [x] **NexoDashboard local antigo:** Remote removido (não empurra mais pro GitHub)
- [x] **NEXO_DASHBOARD_PRO:** Único projeto com acesso ao remote
- [x] **Todos os commits enviados:** `920c182` é o HEAD atual

---

## 3. Arquitetura Crítica

### Backend (Node.js, CommonJS, ~7100 linhas)
- `backend/server.js` — Monolito Express. Endpoint `/api/luna/chat` com NLU → ActionExecutor
- `backend/services/luna-nlu.js` — Motor NLP.js (node-nlp). Corpus PT/ES/CA. Modelo em `backend/data/luna-model.nlp`
- `agents/core/ActionExecutor.js` — 113+ ações. Executa tarefas, pagamentos, emails, etc.
- `agents/core/NLUActionMapper.js` — Mapeia intents NLU → ações do ActionExecutor
- `agents/core/IntentParser.js` — Regex fallback quando NLU não reconhece

### Frontend (React 18, Vite, Tailwind)
- `frontend/src/pages/Workspace.jsx` — Página `/workspace` (clientes, pastas, arquivos, viewer)
- `frontend/src/components/workspace/WorkspaceFileViewer.jsx` — Viewer/editor fullscreen com syntax highlighting
- `frontend/src/pages/LunaControl.jsx` — Página `/luna` (terminal + chat + comandos)
- `frontend/src/components/luna/LunaFloatingButton.jsx` — Botão flutuante global (mini-chat + Decision Engine)
- `frontend/src/components/luna/LunaActionDrawer.jsx` — Drawer inline 380px sem blur (Passo 3)
- `frontend/src/components/luna/LunaSafetyDelay.jsx` — Safety delay 1.5s com undo (Passo 3)
- `frontend/src/components/luna/LunaActionFlow.jsx` — Orquestrador de apresentação (Passo 3)
- `frontend/src/components/luna/SmartFormModal.jsx` — Modal de formulário para intents com fields
- `frontend/src/components/luna/LunaIntentSchemas.js` — Schemas de formulário por intent (137 intents)
- `frontend/src/components/luna/LunaModuleSuggestions.js` — Sugestões globais
- `frontend/src/hooks/useLunaAnimation.js` — Web Animations API hook (Passo 3)
- `frontend/src/lib/lunaDecisionEngine.js` — Motor de decisão de execução (Passo 3)
- `frontend/src/context/LunaContext.jsx` — Consciência global da Luna
- `frontend/src/lib/lunaEventBus.js` — Event emitter desacoplado

### NLU Flow (prioridade)
1. **NLU** (`node-nlp`) — Score ≥0.5 → executa direto
2. **Regex** (`IntentParser`) — Fallback para padrões conhecidos
3. **LLM** (Gemini) — Fallback social/conversação (API revogada, offline)

---

## 4. Estado Conhecido de Problemas

| Problema | Severidade | Status |
|----------|-----------|--------|
| API Gemini revogada (`AIzaSyCRgGWJemoesHA2V2NlQ2l46ooy0qO7R9g`) | 🔴 Alta | NLU offline cobre 100% dos comandos operacionais, mas IA generativa (drafts, resumos, ideias) está offline |
| `criar rascunho de email` score NLU baixo (0.68) | ✅ Resolvido | Corpus expandido, score agora 1.0 com novos exemplos |
| Email params (`para`, `assunto`) não extraídos de frases naturais | 🟡 Média | `extractEmail()` e `extractAfterKeyword()` existem mas são básicos |
| `concluir tarefa` sem match → avisa "desconhecida" | 🟢 Baixa | Poderia sugerir tarefas similares no futuro |
| Modelo NLU `.nlp` salvo em disco | ✅ Resolvido | `backend/data/luna-model.nlp` e `backend/model.nlp` persistidos |
| **Modo C: Transformação de Interface** (checkboxes multi-seleção) | ✅ Resolvido | `LunaBatchAction` implementado com seleção múltipla |
| **Preview visual** antes de executar ação destrutiva | ✅ Resolvido | `LunaInlinePreview` integrado no LunaActionDrawer |
| **Assistente passivo proativo** (badges, toasts) | ✅ Resolvido | Badge animado no botão flutuante com `/api/luna/proactive` |
| **Workspace File Viewer** | ✅ Resolvido | Viewer/editor com syntax highlighting, preview Markdown/HTML, contexto Luna |
| **Backend não reiniciado após deploy** | ✅ Resolvido | `kill` + `nohup node server.js` no script de restart |

---

## 4.1 Plano vs Realidade

> Análise completa: `.kimi-context/plans-vs-reality.md`

| Fase | Progresso Real | Gap Principal |
|------|---------------|---------------|
| 1 — Fundação de Consciência | ✅ 100% | — |
| 2 — Eliminar o Modal | ✅ ~90% | Modo C e D implementados |
| 3 — Execução Inteligente | ✅ ~90% | Preview visual implementado |
| 4 — Consciência por Módulo | ✅ 100% | — |
| 5 — NLP.js + Contexto | ✅ 100% | — |
| 6 — Sugestões Proativas | 🟡 ~30% | Badge no botão flutuante, falta expandir |
| 7 — Workspace File Viewer | ✅ 100% | Editor + syntax highlighting + contexto Luna |

**Veredito:** A Luna está **operacional** (~80% do roadmap). Comando-voz → ação está 100% funcional. Workspace tem viewer/editor de arquivos com syntax highlighting. Gaps: IA generativa (Gemini revogada) e deploy contínuo.

---

## 5. Decisões de Design (NÃO mude sem confirmar)

1. **SmartFormModal NUNCA deve ser removido** — é a UX principal para criação/edição. Fallback chat só para consultas.
2. **LunaFloatingButton e página `/luna` compartilham o MESMO backend** (`/api/luna/chat`) mas têm UX diferentes.
3. **Nomes dos CEOs:** abner, nonoke (enoque), elias — todos admin. Senha padrão: `7741`.
4. **Dados em JSON files** — NUNCA adicionar banco de dados sem conversar com o usuário.
5. **Qualidade > velocidade** — O usuário odeia retrabalho. Pense duas vezes antes de mudar.

---

## 6. Comandos Úteis

```bash
# Build frontend
cd frontend && npm run build

# Restart backend
kill $(ss -tlnp | grep 3456 | awk '{print $6}' | cut -d',' -f2 | cut -d'=' -f2)
cd backend && nohup node server.js > server.log 2>&1 &

# Login para testes
curl -s -X POST http://localhost:3456/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"abner","password":"7741"}'

# Forçar retreinamento NLU
rm backend/data/luna-model.nlp && restart backend

# Status git
git log --oneline -5 && git status
```

---

## 7. Links Rápidos

- **Render Dashboard:** `dashboard.render.com/web/srv-d85gqt...`
- **App em produção:** `nexodashboard.onrender.com`
- **Repo GitHub:** `github.com/Jhin1v9/NexoDashboard`
- **Branch:** `main` (merge de `codex` feito, commits até `3e4256e`)
