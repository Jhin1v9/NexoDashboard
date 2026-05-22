# CONSOLIDADO MASTER — NEXO DASHBOARD PRO
## Data: 2026-05-22 | Orquestrador: Kimi Supreme Analyst
## Fontes: Pesquisa (EN/ZH/RU/DE) + Frontend Audit + Backend Audit + LLM Architect

═══════════════════════════════════════════════════════════════════════════════
PARTE 1: PESQUISA MUNDIAL LLM OFFLINE (4 idiomas)
═══════════════════════════════════════════════════════════════════════════════

### Descoberta principal
NÃO, não são "só essas opções". O ecossistema de LLM offline em 2026 é vasto, mas há um consenso absoluto entre todas as fontes (EUA, China, Rússia, Alemanha):

| Framework | Consenso Global | Melhor Para |
|-----------|----------------|-------------|
| **Ollama** | Padrão de facto #1 em TODOS os países | Facilidade, API OpenAI-compatible, 200+ modelos |
| **LM Studio** | #2, melhor GUI | Quem não quer terminal |
| **LocalAI** | #3 para devs | Drop-in replacement OpenAPI, Docker-ready |
| **GPT4All** | #4 para privacidade extrema | Zero telemetria, 100% offline garantido |
| **node-llama-cpp** | #5 para Node.js puro | Bindings diretos, sem daemon externo |
| **Jan** | #6, alternativa all-in-one | UI polida, RAG built-in |
| **vLLM** | Produção/high-throughput | Não é para desktop |

### Modelos recomendados para PT/ES (consenso internacional)
- `gemma4:4b` / `gemma4:12b` (Google, 2026) — 85 tok/s, multilíngue nativo PT/ES/EN/CA
- `llama3.3:8b` (Meta) — ecossistema maior, fine-tunes em PT disponíveis
- `mistral:7b` (Apache 2.0) — eficiente, bom em PT/ES
- `qwen3.5` (Alibaba) — código + multilíngue
- `phi4:14b` (Microsoft) — alto desempenho relativo ao tamanho

### Tradução do consenso chinês/russo/alemão:
- **CN (中文)**: Ollama é "最简单的方法" (método mais simples). Qwen e Gemma dominam. MCP (Model Context Protocol) é tendência forte para 2026.
- **RU (русский)**: Ollama + Termux roda em smartphone. "Вся обработка данных происходит локально" (todos os dados processados localmente). Privacidade é driver #1.
- **DE (Deutsch)**: Ollama é "Datenschutz" (privacidade de dados). GPT4All é "Zero-Telemetry". Hardware: 8GB mínimo, 16GB confortável, GPU opcional.

### Veredicto da pesquisa
Para NEXO, **Ollama é a única escolha sensata** porque:
1. Já existe código Ollama espalhado no projeto (`LunaBrain_v16.js`, `LunaSemanticMemory.js`)
2. API `/v1/chat/completions` compatível com OpenAI = refactor mínimo no frontend
3. Um comando (`ollama pull gemma4:4b`) e está rodando
4. Funciona em CPU-only (16GB RAM baseline)

═══════════════════════════════════════════════════════════════════════════════
PARTE 2: FINDINGS DOS 3 SUBAGENTES
═══════════════════════════════════════════════════════════════════════════════

### AGENT A — FRONTEND AUDIT (483 linhas)

#### 🔴 CRÍTICO: ChangelogBadge
- **Double close handler**: overlay onClick + document mousedown simultâneos = race condition
- **Fake event object**: card passa `{ stopPropagation: () => {} }` como evento — anti-pattern que quebra se handler precisar de outras props
- **z-index guerra com NotificationCenter**: ambos usam z-[9999], ordem de montagem decide quem fica por cima

#### 🔴 CRÍTICO: LunaFloatingButton
- **Re-render a cada pixel no drag**: `setPos` chamado em `onMouseMove`, re-renderiza componente de 632 linhas a 60-120Hz
- **Zero suporte a touch**: só mouse events, inutilizável em mobile
- **Estado fragmentado**: 10 estados independentes no mesmo componente (god component)
- **Triple fetch duplicado** no `luna:actionDismissed`

#### 🔴 CRÍTICO: Tarefas.jsx
- **Regex mention quebrado**: `/@\w+/g` para no espaço. `@João Silva` renderiza como `@João` + `Silva` sem highlight
- **Triple fetch ao comentar**: POST + GET todas tarefas + refetch()
- **Re-render da lista inteira**: modal embutido no mesmo componente, digitar comentário re-renderiza todos os cards

#### 🟡 MÉDIO: SecretTerminal
- **Shadowing de `performance`**: `let performance = 'N/A'` bloqueia `window.performance.memory` — nunca coleta memória
- **Input invisível**: `opacity-0 w-1 h-1` impede teclado virtual em mobile
- **Race honeypot**: animação vs evidence collection sem timeout global

#### 🟡 MÉDIO: NotificationCenter
- **Auto-mark-all-as-read ao abrir**: usuário NUNCA vê quais eram não-lidas
- **WebSocket sem reconexão**: caiu = morreu
- **Sem handleClickOutside**: inconsistente com ChangelogBadge

#### 🟡 MÉDIO: App.jsx
- **Zero code splitting**: 30+ páginas importadas estaticamente, bundle gigante
- **Interceptadores axios duplicados**: `main.jsx` e `AuthContext.jsx` ambos tratam 401
- **Sem rota 404**

#### BÔNUS: Mapeamento z-index completo
Duas escalas conflitantes: "normal" (50-110) vs "extrema" (9980-9999). `LunaChatPanel` (9981) fica **abaixo** de tooltips do Sidebar (9990).

---

### AGENT B — BACKEND AUDIT (234 linhas)

#### 🔴 CRÍTICO: Autenticação e Segurança
- **Rotas sensíveis SEM rate limiting**: apenas login tem rate limit. Tasks, payments, expenses, email, workspace, luna — tudo sem proteção
- **Path traversal fraco**: `.replace(/\.\./g, '')` não impede encoding, null bytes, symlinks. `workspace-manager.js` tem `sanitizeSubPath()` robusta mas `server.js` a ignora
- **`/luna-control` acessível sem auth**: qualquer um pode acessar painel da Luna
- **Inconsistência INTERNAL_API_TOKEN**: middleware global rejeita, `requireAuth` aceita — quebra integrações internas

#### 🔴 CRÍTICO: Persistência Quebrada (JSON vs PostgreSQL)
- **149 leituras diretas de JSON** no `server.js` via `readJSON()`, ignorando completamente o `datastore-pg.js`
- **`buildDashboardContext` lê JSON direto**: se PG é fonte de verdade, Luna recebe dados stale
- **Changelog API lê JSON**: tabela `changelog` no PG fica deserta
- **ActionExecutor faz fallback JSON**: quando API REST falha, escreve em arquivo JSON dessincronizando do PG

#### 🔴 CRÍTICO: BUG-001 — IntentParser regex email
- **Regex**: `/\b(emails?|...|responder\s+emails?|...)\b/i`
- **Problema**: `"responder email"` classifica como `consultar_emails` (consulta) em vez de `responder_email`
- **Não existe regex** para `enviar_email` no fastParse(). ActionExecutor suporta, mas regex nunca emite.

#### 🔴 CRÍTICO: BUG-002 — totalExpensesMonth
- **Código**: `e.date || e.createdAt` — mas `expense` NÃO tem campo `date`, tem `startDate`, `renewDate`, `endDate`
- **Impacto**: despesas recorrentes contabilizadas pelo mês de criação, não do período. Dashboard financeiro incorreto.

#### 🔴 CRÍTICO: BUG-003 — `typeof null === 'object'`
- **Código**: `typeof e.amount === 'object'` — se `amount` for `null`, entra no branch objeto e retorna `0`
- **Impacto**: despesas com `amount: null` são zeradas silenciosamente

#### 🟡 MÉDIO: BUG-007 — ActionExecutor `m.body`
- **Linha 983**: `m.body || m.text || ''` — se `m.body` é objeto `{text, caption}`, converte para `"[object Object]"`, perde menção `@LUNA` silenciosamente
- **Linha 994**: tem fallback correto (`m.body?.text`), mas linha 983 não usa

#### 🟡 MÉDIO: Email API
- **Sem rota dedicada `/reply`**: envio e resposta usam o mesmo `POST /api/email/messages/send`

---

### AGENT C — LLM OFFLINE ARCHITECTURE (956 linhas)

#### 💡 Descoberta Surpreendente: 70% da infra já existe!

| Componente | Estado | O que falta |
|------------|--------|-------------|
| `luna-nlu.js` (node-nlp) | ✅ 100% offline, PT/ES/CA | Integrar no fluxo do chat |
| `luna-semantic-nlu.js` | ✅ `@xenova/transformers` embeddings | Conectar no IntentParser |
| `LunaSemanticMemory.js` | ✅ Ollama + keyword fallback | Consolidar como RAG único |
| `LunaBrain_v16.js` | ✅ Código Ollama (`gemma2:2b`) | Ativar no `/api/luna/chat` |
| `IntentParser.js` | ❌ Usa Gemini API no LLM path | Substituir por Ollama |
| `server.js` fallback social | ❌ Usa Gemini direto | Substituir por LunaBrain |

#### Arquitetura Proposta: Dual-Model
```
Intent Layer (rápido):  gemma4:4b  → classifica intenção em JSON, temperatura 0.1
Chat Layer (qualidade): gemma4:12b → respostas humanizadas, temperatura 0.7, streaming
Embeddings:             nomic-embed-text → RAG local
```

#### Fluxo de 4 camadas (cascata):
```
1. NLU (node-nlp)       → score ≥ 0.5  → retorna
2. Regex Fast Path      → score ≥ 0.8  → retorna
3. Semantic NLU         → score ≥ 0.75 → retorna (Xenova embeddings)
4. Ollama Intent        → score ≥ 0.6  → retorna (gemma4:4b, JSON format)
   └─> Se falha → Fallback regex (25% coverage)
   └─> Se tudo falha → "Não entendi, tente de outra forma"
```

#### RAG Local proposto
- **SQLite + FTS5** para full-text search em tarefas, emails, leads
- **Embeddings Ollama** (`nomic-embed-text`, 768d) para busca semântica
- **Chunking por domínio**: tarefas, emails, leads, ideias — cada um com sua tabela
- **Boost de recência**: documentos mais recentes têm peso maior na similaridade

#### Circuit Breaker
- `CLOSED` → normal (usa Ollama)
- `OPEN` → Ollama falhou 5x, usa regex offline
- `HALF_OPEN` → testa Ollama após 30s, se voltar fecha o circuito

#### Hardware necessário
| Config | Intent | Chat | Tokens/s |
|--------|--------|------|----------|
| 16GB RAM CPU-only | gemma4:4b | gemma4:4b | 25-40 |
| 16GB + RTX 4060 (8GB) | gemma4:4b | gemma4:12b | 60-85 |
| 32GB + RTX 3060 (12GB) | gemma4:4b | gemma4:12b | 70-100 |

> **Nota**: Ollama faz offload automático para GPU. CPU-only funciona, só é mais lento.

═══════════════════════════════════════════════════════════════════════════════
PARTE 3: PLANO DE AÇÃO PRIORITÁRIO
═══════════════════════════════════════════════════════════════════════════════

### FASE 0: HOTFIXES (1-2 dias) — Bugs que quebram agora

| # | Bug | Arquivo | Fix | Impacto |
|---|-----|---------|-----|---------|
| H1 | IntentParser regex email | `IntentParser.js:268` | Separar `send_email`, `reply_email` do `query_email` | 🔴 Luna chat volta a entender emails |
| H2 | totalExpensesMonth campo errado | `server.js:4564` | Usar `startDate || renewDate || createdAt` | 🔴 Dashboard financeiro correto |
| H3 | `typeof null === 'object'` | `server.js:4569` | Adicionar `e.amount &&` antes do typeof | 🔴 Despesas não zeram |
| H4 | ActionExecutor `m.body` | `ActionExecutor.js:983` | Usar `getBodyText()` unificado | 🔴 Menções @Luna funcionam |

### FASE 1: LUNA 100% OFFLINE (3-5 dias)

| # | Tarefa | Arquivo | Descrição |
|---|--------|---------|-----------|
| O1 | Instalar Ollama | sistema | `curl -fsSL https://ollama.com/install.sh \| sh` |
| O2 | Pull modelos | sistema | `ollama pull gemma4:4b gemma4:12b nomic-embed-text` |
| O3 | Criar `ollama-client.js` | `backend/services/` | Wrapper com circuit breaker, retry, timeout |
| O4 | Refatorar `IntentParser.js` | `agents/core/` | 4 camadas: NLU → Regex → Semantic → Ollama |
| O5 | Ativar `LunaBrain_v16.js` | `agents/` | Conectar Ollama no caminho crítico do chat |
| O6 | Streaming SSE | `backend/server.js` | `/api/luna/chat` retorna stream em vez de JSON único |
| O7 | RAG v1 | `backend/services/` | SQLite FTS5 + embeddings para tarefas/leads/emails |

### FASE 2: FRONTEND STABILITY (2-3 dias)

| # | Tarefa | Arquivo | Descrição |
|---|--------|---------|-----------|
| F1 | Fix ChangelogBadge race | `ChangelogBadge.jsx` | Remover overlay onClick OU handleClickOutside, nunca ambos |
| F2 | Fix LunaFloatingButton drag | `LunaFloatingButton.jsx` | Usar ref + transform direto no DOM durante drag |
| F3 | Fix mention regex | `Tarefas.jsx` | `/@\w+/g` → iterar sobre MENTION_USERS para substituição exata |
| F4 | Fix NotificationCenter auto-read | `NotificationCenter.jsx` | Remover markAllAsRead automático do useEffect[open] |
| F5 | Standardizar z-index | `styles/` ou constants | Criar design system de camadas |

### FASE 3: BACKEND HARDENING (3-4 dias)

| # | Tarefa | Arquivo | Descrição |
|---|--------|---------|-----------|
| B1 | Rate limiting global | `server.js` | `express-rate-limit` em todas as rotas POST/PUT/DELETE |
| B2 | Fix path traversal | `server.js` | Substituir `.replace(/\.\./g, '')` por `sanitizeSubPath()` |
| B3 | Unificar datastore | `server.js` | Migrar as 149 leituras `readJSON()` para `dataStore.*()` |
| B4 | Fix `/luna-control` auth | `server.js` | Adicionar `requireAuth` na rota |
| B5 | Rota email reply | `server.js` | Criar `POST /api/email/messages/:id/reply` |

═══════════════════════════════════════════════════════════════════════════════
PARTE 4: RISCOS E DEPENDÊNCIAS
═══════════════════════════════════════════════════════════════════════════════

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Ollama não roda na máquina atual (hardware) | Média | Testar `gemma4:4b` primeiro (5GB RAM). Se não rodar, usar `phi4:3.8b` |
| Modelo local não entende PT/ES tão bem quanto Gemini | Baixa | Gemma 4 é treinado nativamente em PT/ES. Testar com dataset de comandos NEXO |
| Latência alta em CPU-only (3-5s por resposta) | Média | Streaming SSE + indicador de "digitando". Usar gemma4:4b para tudo se 12b for lento |
| Refactor quebra compatibilidade com Gemini | Baixa | Manter Gemini como camada 5 (circuit breaker fallback para cloud) |
| Falta de testes automatizados | Alta | Criar testes manuais primeiro (scripts de verificação), depois Jest |

═══════════════════════════════════════════════════════════════════════════════
PARTE 5: DECISÕES PENDENTES DO COMMANDER (Abner)
═══════════════════════════════════════════════════════════════════════════════

1. **Hardware**: Qual a configuração da máquina que roda o backend? (RAM, GPU, CPU) Isso define se usamos gemma4:4b apenas ou 4b+12b.

2. **Prioridade**: Quer começar pelos HOTFIXES (bugs que quebram agora) ou já quer pular direto para a FASE 1 (Luna offline)?

3. **Gemini**: Quer manter Gemini como fallback camada 5 (se Ollama cai, chama Gemini) ou 100% offline sem exceção?

4. **Scope**: Quer que eu implemente tudo agora, ou prefere que eu gere um PR/plano e você revisa antes?

═══════════════════════════════════════════════════════════════════════════════
# END CONSOLIDADO MASTER
═══════════════════════════════════════════════════════════════════════════════
