# Changelog — NEXO Dashboard Pro

## [Unreleased] — 2026-05-31 — Leads Fix + Plan Mode + Auto-Health + No Limits

### Fixed (Dashboard — Leads Pipeline)
- **Conflito de rotas POST `/api/leads`** (`backend/server.js`)
  - Router público `routes/leads.js` era montado em `/api/leads` e interceptava TODOS os POSTs do dashboard
  - Dashboard enviava `{displayName, email, ...}` mas o router público esperava `{name, companyName, message}`
  - Resultado: erro de validação `"Nome é obrigatório"` ao criar lead pela UI
  - **Fix:** Router público movido para `/api/demo-leads` — rotas internas do dashboard agora funcionam corretamente
- **Botão "Converter em Cliente" inexistente** (`frontend/src/components/leads/LeadModal.jsx` + `frontend/src/pages/Leads.jsx`)
  - A rota `/api/leads/:id/convert` existia no backend mas nunca era chamada pelo frontend
  - **Fix:** Adicionado botão "Converter" no modal de visualização do lead (só aparece quando `pipelineStatus !== 'ganho'`)
  - **Fix:** Implementada função `convertLead()` no `Leads.jsx` — chama a API, atualiza o estado local, mostra alert de sucesso
- **Dashboard não iniciava via `luna-nexo.sh`** (`luna-nexo.sh`)
  - `nohup node server.js > /dev/null` falhava silenciosamente
  - **Fix:** Logs redirecionados para arquivos (`dashboard.log`, `luna-server.log`, `vite.log`, `telegram.log`)
  - **Fix:** Adicionada verificação de health com `ss -tlnp` após iniciar cada serviço + retry com sleep extra

### Added (Luna Web — Plan Mode v5.0)
- **Plan Mode — Sherlock Holmes** (`luna-soul.cjs` + `luna-chat-routes.js` + frontend)
  - `processPlanModeStream()` — investigação read-only com restrição de ferramentas destrutivas
  - Endpoints: `POST /api/plan`, `/api/plan/approve`, `/api/plan/reject`, `/api/plan/revise`
  - `PlanCard.svelte` — card noir com Lucide icons (`Search`, `Shield`, `CheckCircle`, `XCircle`, `Pencil`)
  - `ChatInput.svelte` — comando `/plan` + toggle `Shift+Tab`
  - Planos persistidos em `~/.luna-kernel/plans/<sessionId>.md`

### Added (Luna Web — Local System Commands)
- **Comandos `/` para controle local** (`luna-chat-routes.js` + frontend)
  - `/reiniciar`, `/status`, `/parar`, `/ligar`, `/health`, `/logs`
  - Executam `luna-nexo.sh` diretamente via `child_process.exec`
  - Respostas mostradas no chat como mensagens de sistema

### Added (Luna Web — Auto-Health Monitor)
- **Monitoramento automático** (`luna-chat-routes.js`)
  - Intervalo de 30s verifica se LunaSoul está saudável e porta 3458 está aberta
  - Após 3 falhas consecutivas, executa `luna-nexo.sh restart` automaticamente

### Changed (Luna Kernel — Sem Limites)
- **Loop principal nunca para em agent/swarm** (`luna-soul.cjs`)
  - Removido `return` prematuro quando Kimi retorna `CHAT`/`DONE` em modo agent/swarm
  - Agora continua perguntando ao Kimi se há mais ações pendentes até o contexto acabar
  - `FORCE_COMPLETE_NO_BUTTONS_MS` aumentado de 45s para 5min (`kimi-bridge.cjs`)
  - `runTask` também continua indefinidamente até context limit ou erro fatal

## [Unreleased] — 2026-05-29 — Luna Web v3.6 + Kimi Bridge v3.6 + Unified Launcher

### Added
- **Unified Launcher** (`luna-nexo.sh` + `start-all.js`)
  - Script shell unificado: `./luna-nexo.sh [start|stop|restart|status|logs]`
  - Inicia NEXO Dashboard (3456) + Luna Config Server (3458) + Luna Web Vite (5173)
  - Logs coloridos por serviço (cyan=NEXO, magenta=Luna, yellow=Vite)
  - Mata processos antigos nas portas antes de iniciar (evita conflitos)
  - Graceful shutdown com SIGTERM + fallback SIGKILL após 5s
  - `start-all.js` — alternativa em Node.js com pipes coloridos em tempo real
- **Luna Web Chat History Endpoint** (`config-server.cjs`)
  - `GET /api/chat/session/:id/messages` — retorna histórico completo de mensagens
  - Permite reconstrução do chat ao trocar de sessão (não limpa mais a tela)

### Fixed (Luna Web Frontend — v3.6)
- **Thinking Bubble stale/repetido** (`ChatArea.svelte`)
  - `handleSend()` agora reseta `currentAssistantId = null` e `thinkingId = null`
  - Evita que thinking da mensagem anterior "cole" na nova mensagem
- **Histórico vazio ao trocar de sessão** (`ChatArea.svelte`)
  - `connectSSE()` agora é `async` e carrega histórico ANTES de conectar SSE
  - Reconstrói thinking, response, tools e erros a partir do backend
  - Remove thinking "orphan" quando response começa
- **Deduplicação SSE** (`ChatArea.svelte`)
  - Eventos com `event.id` já existente na store são ignorados
  - Evita mensagens duplicadas em reconnects do EventSource
- **Sessão não encontrada no create** (`App.svelte`)
  - `handleNewSession()` agora aguarda resposta do backend antes de trocar sessão
  - `currentMode` restaurado ao trocar de sessão (persistência de modo por sessão)
- **SSE null reference** (`api.js`)
  - `onerror` verifica `if (this.eventSource)` antes de chamar `.close()`
  - Evita `Cannot read properties of null (reading 'close')`

### Fixed (Kimi Bridge — v3.6)
- **Stream interceptor reset** (`kimi-bridge-interceptor-toolcalls.js`)
  - `window.__lunaResetStream` exposto para reset correto entre mensagens
  - Antes: `reasoning = ''` (string) quebrava `.push()` → interceptor parava
  - Agora: arrays são limpos corretamente, interceptor funciona em todas as msgs
- **Interceptor array→string** (`kimi-bridge.cjs`)
  - `_pollThinkingAndResponse()` junta `s.reasoning.join('')` e `s.content.join('')`
  - Retorna strings em vez de arrays crus para comparação correta
- **fullThinking nos deltas** (`kimi-bridge.cjs` + `config-server.cjs`)
  - `thinking_delta` agora inclui `fullThinking: poll.thinking`
  - Frontend pode exibir thinking acumulado corretamente (não apenas o delta)

### Fixed (Backend — Ideas Persistence)
- **`saveIdeasData()` sem argumento** (`backend/routes/ideas.js`)
  - 15 endpoints chamavam `await saveIdeasData()` sem passar `ideasData`
  - Isso fazia recarregar do PostgreSQL/JSON, perdendo a ideia criada em memória
  - Corrigido para `await saveIdeasData(ideasData)` em todos os endpoints
- **`INTERNAL_API_TOKEN` sincronizado** (`.luna-kernel/.env`)
  - Token divergente entre luna-kernel (`test-token...`) e backend (JWT real)
  - Causava 401 Unauthorized em TODAS as chamadas dashboard do Luna Chat
  - Agora ambos usam o mesmo JWT — tools do dashboard funcionam

### IDEIA Adicionada
- **`idea-001`: Luna Mascot Animada — Personagem Viva no Chat**
  - Criada via API com sucesso após correção do bug de persistência
  - Status: aprovada | Prioridade: alta | Tipo: feature
  - Tags: luna, mascot, animation, ui, frontend, live2d, character

---

## [Unreleased] — 2026-05-26 — Security Hardening + Kimi Web Audit Fixes

### Security (CRITICAL)
- **ToolGuard integration** (`luna-soul.cjs` + `luna-tool-guard.cjs`)
  - `_handleAction()` agora envolve TODAS as file tools com `ToolGuard.execute()`
  - 7 padrões ativos: retry com backoff, circuit breaker, idempotency, schema
    validation, timeout, checksum anti-drift, checkpoint por step
  - Schema validation rejeita tools desconhecidas e params inválidos
- **Path traversal fix** (`luna-soul.cjs`)
  - Antes de executar qualquer tool: `path.resolve(params.path)` deve estar
    dentro do `workspacePath`. Bloqueia `/etc/passwd`, `~/.ssh/id_rsa`, etc.
- **Secret scrubber** (`luna-soul.cjs`)
  - `_scrubSecrets()` remove padrões de API keys dos outputs: `sk-...`,
    `ghp_...`, `AKIA...`, `Bearer ...`, `password=...`, `PRIVATE KEY`
- **Undo safety — triple-guard** (`luna-tui.mjs`)
  - `/undo` agora: (1) `git.init()`, (2) verifica `currentBranch.startsWith
    ('luna/session-')`, (3) só executa em branches de sessão. Evita
    `git reset --hard` em `main`/`develop`

### Fixed
- **Stream interceptor state reset** (`kimi-bridge.cjs`)
  - `__lunaResetStream()` chamada no início de `newChat`, `sendMessage`,
    `sendMessageStream` — elimina contaminação cruzada entre mensagens
- **Memory leak no browser** (`kimi-bridge.cjs`)
  - `accumulate()` trunca `events` para últimos 500 (buffer circular).
    Sessões longas não mais causam OutOfMemory
- **Fetch interceptor real-time** (`kimi-bridge.cjs`)
  - Substituído `response.clone().text()` por `ReadableStream.getReader()` +
    `TextDecoder` — lê chunks SSE em tempo real, não só no final
- **Spinner eterno** (`luna-tui.mjs`)
  - `ToolCallItem` para o `setInterval` quando `msg.completed === true`.
    `action_end` marca a tool_call correspondente. CPU não mais consumida
    indefinidamente
- **Agent indicator preso** (`luna-tui.mjs`)
  - `setActiveAgents(0)` adicionado no `catch` do stream + no cleanup normal.
    Indicador `⚙` some corretamente após erro de rede
- **ScanSafe — DoS protection** (`luna-workspace.cjs`)
  - `SAFE_MAX_ENTRIES = 1000` por diretório + `SAFE_MAX_DEPTH = 10` +
    `SKIP_DIRS` hardcoded. Early-abort se diretório tem >1000 entradas
- **Gitignore matching** (`luna-workspace.cjs`)
  - `relPath` agora é sempre `path.relative(workspaceRoot, fullPath)` —
    patterns do root `.gitignore` funcionam corretamente em subdiretórios
- **Alternate screen wrapper** (`~/.local/bin/luna`)
  - Bash wrapper com `trap 'printf \"\\033[?1049l\"' EXIT INT TERM HUP` —
    restaura terminal mesmo em crash hard (SIGKILL ainda não capturável,
    mas wrapper mitiga SIGINT/SIGTERM)

### Added
- `luna-wrapper.sh` — wrapper alternativo para alternate screen restoration
- `demo-animations.mjs` — demonstração visual das tool call animations

### Tests
- Todos os testes existentes continuam passando: 30/30 (12 thinking + 4
  bridge + 8 workspace + 6 E2E)
- Sintaxe validada em 7 arquivos modificados

---

## [Unreleased] — 2026-05-25 — Fase 2: Computer Use + Luna CLI + Tool Registry

### Added
- **Computer Use Agent v1.0** (`agents/computer-use-agent.cjs`)
  - Agente de controle de desktop guiado pela Kimi Web via Playwright
  - Loop: plano → ação → screenshot → verificação
  - Máximo 20 iterações por tarefa, timeout 5 minutos
  - Confirmação obrigatória para ações destrutivas
  - Segurança: blacklist de comandos (rm -rf, format, etc.)
- **Computer Use Engine v2.0** (`agents/computer-use-engine.cjs`)
  - Reescrita em Node.js puro — sem Python child_process
  - Backends: grim/gnome-screenshot (screenshot), tesseract (OCR),
    xdotool/ydotool (input), spawn direto (shell), xdotool/dbus-send
    (window management). Shell-quote parser seguro.
- **Computer Use React** (`agents/computer-use-react.cjs`)
  - Componente React para UI do agente de desktop
- **venv-computer-use/**: ambiente Python isolado para dependências do agente
- **Luna CLI v3.0** (`agents/luna-cli.cjs`)
  - Terminal-native AI assistant powered by Kimi Web
  - Interface inspirada em Kimi CLI / Claude Code
  - Comandos slash: /new, /models, /compact, /clear, /history, /export,
    /skills, /personas
  - Modo META: Kimi Web pode criar ferramentas, skills, scripts, personas
- **Luna CLI v3.1** — Thinking/Response Separation + Streaming Compact
  - Arquitetura 4 camadas de extração thinking/response do Kimi Web:
    1. Stream interceptor (fetch/XHR/EventSource/WebSocket) — parseia
       deltas SSE em reasoning_content / content
    2. React Fiber inspection — encontra memoizedProps.message.reasoning_content
    3. Heurística de estilo computado (grey + italic = thinking)
    4. Fallback CSS selector + heurística de padrão de conteúdo
  - Final extraction sempre prefere texto limpo de _extractResponse ao
    invés de lastResponse poluído acumulado durante polling DOM
  - WebSocket interception adicionado para detectar transporte do Kimi Web
  - Modo compacto de thinking (default): texto de thinking acumulado em
    ref, apenas status line mostra '🧠 Thinking ... 2.1s · 800 tokens'
  - Comando `/thinking` toggle entre stream completo e indicador compacto
  - React.memo em MessageItem previne re-render do histórico durante streaming
  - Testes: 12 unitários + 4 integração + 1 teste real ao vivo
- **LunaSoul v3.0** (`agents/luna-soul.cjs`)
  - Engine orquestrador unificado (CLI-first, multi-channel, self-improving)
  - Loop: recebe msg → contexto → Kimi Web → parse → executa → responde
  - Context building: histórico + desktop + skills + memórias + personas
  - Tool execution com progress events
  - Event emitter para adapters (CLI, Telegram)
  - System prompt orquestrador v3 com META mode
- **SessionManager** (`agents/session-manager.cjs`)
  - Gerenciamento de sessões persistentes em JSONL (append-only, crash-safe)
  - Cada linha = evento (user, assistant, tool_call, tool_result)
  - Indexação rápida, current session link, compactação automática
- **Tool Registry API v1.0** (`backend/routes/tool-registry.js`)
  - Expõe ações do NEXO Dashboard como "tools" para a Kimi Central
  - 15+ tools: tarefas, leads, caixa, links, ideias, notificações,
    WhatsApp, financeiro, usuários, sistema
  - Todas consomem datastore-pg.js (PostgreSQL) como source of truth
  - Retornam JSON estruturado para consumo pela Kimi
- **Documentação Futura**
  - `docs/FUTURO-kimi-code-telegram.md`: Kimi Code no Telegram — IDE
    inteligente via chat privado
  - `docs/FUTURO-kimi-orquestradora-unificada.md`: Kimi Web como
    orquestradora única (sem separação /pc, /kimi)
- **Testes E2E novos**
  - `test-luna-chat.spec.js`: E2E para chat Luna no dashboard (Render)
  - `test-luna-debug.spec.js`: debug do frontend (console logs + errors)
  - `test-luna-fab.spec.js`: teste do FAB (Floating Action Button)
- **Testes de Engine**
  - `test-engine.cjs`: teste isolado do Computer Use Engine
  - `test-input.cjs`: teste de input (xdotool/ydotool)
  - `test-react-real.cjs`: teste do componente React do Computer Use
- **Testes de Thinking/Response Separation**
  - `test-thinking-extraction.mjs`: 12 testes unitários (SSE parsing, DOM
    extraction, React Fiber, style heuristic, content-pattern split)
  - `test-bridge-integration.mjs`: 4 testes de integração (layer fallback,
    stream interceptor priority)
  - `test-real-site.mjs`: teste ao vivo contra Kimi Web com verificação
    de separação thinking/response

### Changed
- `agents/package.json`: adiciona `ink` (^7.0.4) e `react` (^19.2.6)
  para a interface TUI do Luna CLI
- `backend/routes/ideas.js`: remove `requireAuth` do GET /api/ideas
  (listagem pública, não-sensível)

### Fixed (Telegram Bot — Kimi Integration)
- **Stale response bug**: bot respondia com resposta da mensagem anterior
  - Causa: `_waitForResponse` via botões da resposta anterior já visíveis
  - Fix: captura `initialText` antes de enviar → Phase 0 espera texto
    MUDAR antes de verificar botões/estabilidade (`kimi-bridge.cjs`)
- **Reply context**: quando usuário marcava mensagem com `/kimi`, o bot
  ignorava o conteúdo da mensagem marcada
  - Fix: detecta `msg.reply_to_message` e inclui texto + autor como
    contexto nos 3 handlers (`/kimi`, `/kimi_instant`, `/kimi_thinking`)
- **Greeting spam**: Kimi dizia "Oi Jhino!" em CADA mensagem
  - Fix: adiciona diretriz no final do prompt para respostas diretas,
    sem saudações e sem nomear o usuário no início
- **Streaming updater removido**: sistema complexo de streaming com
  `createStreamUpdater`, `onPartial`, `editTimer`, `lastQueuedText`
  causava race conditions entre mensagens
  - Fix: substituído por `sendThinkingThenEdit` simples — envia
    "Pensando..." e edita uma única vez com resposta completa

### Commits
- `a2d7c24` chore(deps): adiciona ink + react aos agents; remove auth de GET /api/ideas — Abner
- `8901ebf` test(e2e): novos testes Playwright para Luna + testes de engine — Abner
- `e1eacba` docs(futuro): arquiteturas futuras — Kimi Code Telegram + Orquestradora Única — Abner
- `c8db9d2` feat(api): Tool Registry API v1.0 — Abner
- `54931c6` feat(luna-cli): Luna CLI v3.0 + LunaSoul v3.0 + SessionManager — Abner
- `ba5510d` feat(computer-use): Luna Computer Use Agent v1.0 + Engine v2.0 + React — Abner
- `e9f114a` fix(telegram): move no-greeting directive to end of prompt — Abner
- `34d5b34` fix(telegram): add no-greeting instruction to /kimi prompts — Abner
- `7238aa2` fix(telegram+kimi): resolve stale response bug + add reply context — Abner
- `0d06390` fix(telegram): remove streaming updater to fix stale response bug — Abner

---

## [Unreleased] — 2026-05-25 — Luna-Kimi Bridge v2.1 + Telegram Bot Remoto

### Added
- **Luna-Kimi Bridge v2.1** (`agents/kimi-bridge.cjs`)
  - Multi-user: uma aba por usuário do Telegram (context[0] do Chrome)
  - Extração completa via Turndown (Markdown com código, listas, tabelas)
  - Detecção de fim de streaming por sinal combinado (botões + estabilidade de texto)
  - Modos Instant (⚡) e Thinking (🧠) com troca dinâmica
  - Semaphore limita 5 páginas simultâneas; idle cleanup após 10min
  - Rate limiting por usuário (cooldown 5s)
  - Logger persistente com rotação (10MB)
  - SessionStore com save debounced (JSON persistente)
  - Crash/disconnect detection com auto-reconnect
  - 29 correções de bugs da revisão crítica (race conditions, memory leaks, timeouts)
- **Kimi Bridge API** (`agents/kimi-bridge-api.cjs`)
  - Express API que encapsula o KimiBridge com auth via X-API-Key
  - Endpoints: POST /ask, POST /new-chat, GET /status, GET /health
  - Permite bot no Render se conectar ao Chrome local via Cloudflare Tunnel
- **Cloudflare Tunnel integration** (`scripts/start-kimi-bridge-api.sh`)
  - Script que inicia API local + tunnel automático
  - Testado e funcionando: resposta "Oi." em modo Instant via tunnel remoto
- **Comandos Telegram** (`agents/telegram-luna-agent.cjs`)
  - `/kimi [pergunta]` — pergunta no modo atual (Instant padrão)
  - `/kimi_instant [pergunta]` — modo rápido
  - `/kimi_thinking [pergunta]` — modo raciocínio profundo
  - `/kimi_novo` — cria novo chat
  - `/kimi_status` — mostra status do bridge
  - `/help` — guia completo de comandos
- **Documentação** (`docs/TELEGRAM-BOT-GUIDE.md`)
  - Tutorial completo do bot: comandos, arquitetura, troubleshooting

### Changed
- Modo padrão do Kimi Bridge: **Instant** (era Thinking)
- `telegram-luna-agent.cjs` suporta modo remoto via `KIMI_BRIDGE_URL`
- `render.yaml` adiciona env vars `KIMI_BRIDGE_URL` e `KIMI_BRIDGE_API_KEY`

### Fixed
- Comandos `/kimi` não eram interceptados pelo handler onText (caiam no handleMessage como menção genérica)
- newChat() falhava ao chamar sendMessage com texto vazio
- _waitForResponse retornava texto incompleto silenciosamente em timeout
- Idle cleanup sem await causava unhandled rejection
- page.close() sem await liberava semaphore prematuramente
- Turndown regra custom 'pre' usava API inexistente (node.querySelector)
- SessionStore fazia I/O síncrona bloqueante a cada atualização

### Infrastructure
- `package.json` + `package-lock.json`: dependências `turndown` e `express` adicionadas

---

## [Unreleased] — 2026-05-25 — Fase 1C: Luna FAB + Proactive Fixes + Voice Integration

### Added
- **Voz no Botão Flutuante** (`frontend/src/components/luna/LunaFloatingButton.jsx`)
  - Long-press (600ms) ativa STT diretamente no FAB
  - Botão fica verde com glow em expansão durante gravação
  - Solta → chat abre e envia transcrição automaticamente
  - Label "Clique · Segure p/ voz" aparece ao hover
  - Transcrição ao vivo em balão à esquerda do botão
- **Anel pulsante permanente** no FAB — glow cyan visível mesmo sem notificações

### Changed
- `LunaFloatingButton.jsx` — tamanho aumentado 56px → 72px, ícone 20px → 28px
- `LunaFloatingButton.jsx` — `clampPos` corrigido: botão nunca mais sai da tela
- `LunaChatPanel.jsx` — z-[9999], overflow-hidden, border-left 2px cyan
- `LunaProactiveToast.jsx` — IDs estáveis (tipo + contagem) em vez de Date.now()
- `LunaActionCenter.jsx` — navegação href via `lunaEventBus` (navigate) em vez de `window.location.href`
- `backend/server.js` — email action de `intent: 'email.enviar'` para `href: '/email?draft=X&compose=1'`

### Fixed
- Toast proativo aparecia infinitamente (ID mudava a cada 60s)
- Botão "Revisar" no ActionCenter dava reload na página (SPA quebrado)
- Botão "Enviar" (Aprovar email) não fazia nada (`email.enviar` não existia no batch)
- FAB podia ser arrastado para fora da viewport e sumir

### Testes
- Build Vite: ✅ 3151 modules, 0 erros
- Backend start: ✅ Porta 3456 respondendo
- API health: ✅ `{"status":"ok"}`

---

## [Unreleased] — 2026-05-23

### Added
- **System Admin Service** (`backend/services/system-admin.js`)
  - Monitoramento de sistema: CPU, RAM, disco, uptime, temperatura, rede
  - Listagem e controle de processos (`ps`, `kill` com proteção PID < 100)
  - Controle de serviços PM2: list, start, stop, restart, reload, delete, flush, logs
  - Controle de serviços systemd: status, start, stop, restart, enable, disable (whitelist)
  - Execução de comandos shell seguros com whitelist (ls, df, ps, top, journalctl, git status, etc.)
  - Navegação de arquivos: ls, cat, tail, find em diretórios permitidos
  - Gerenciamento de cron: listar, adicionar, remover jobs
  - Leitura de logs do sistema via journalctl
- **API Endpoints** `/api/system/*` (16 endpoints)
  - metrics, health, processes, pm2, systemd, shell, files, cron, logs
- **ActionExecutor** — 16 novas ações administrativas
  - `monitorar_sistema`, `listar_processos`, `matar_processo`, `listar_pm2`, `controlar_pm2`
  - `status_systemd`, `controlar_systemd`, `executar_shell`, `listar_arquivos`, `ler_arquivo`
  - `tail_arquivo`, `buscar_arquivos`, `listar_cron`, `adicionar_cron`, `remover_cron`, `logs_sistema`
- **NLU Training** — novos intents de administração de sistema
  - `sistema.monitorar`, `sistema.processos`, `sistema.pm2`, `sistema.shell`, `sistema.logs`
  - `sistema.arquivos`, `sistema.cron`, etc.
- **Service Token** — ActionExecutor agora usa JWT interno para acessar endpoints protegidos
- **Build fix** — `messages` array adicionado na resposta do endpoint de threads para compatibilidade com LunaChatPanel

### Changed
- `backend/server.js` — adicionado `require('os')`, endpoints `/api/system/*`, SERVICE_TOKEN para ActionExecutor
- `agents/core/NLUActionMapper.js` — novos mapeamentos, extractors e helpers para comandos administrativos
- `backend/services/luna-nlu.js` — corpus de treinamento expandido com 16 novos intents de sistema
- `agents/core/ActionExecutor.js` — métodos administrativos + formatação no `buildConciergeReply`

### Security
- Comandos shell bloqueados por padrão: `rm -rf /`, `mkfs`, `dd`, fork bombs
- Serviços systemd limitados a whitelist (nginx, mysql, postgres, ssh, cron, etc.)
- Processos de sistema (PID < 100) protegidos contra kill
- ActionExecutor não pode se matar (process.pid protegido)

## [Unreleased] — 2026-05-24 — Fase 1A: Preview Contextual + Confirmação/Neagação

### Removed
- **System Admin do PC** — removido completamente (não escondido)
  - Deletado `backend/services/system-admin.js` (-1.341 linhas)
  - Removidos 16 endpoints `/api/system/*`
  - Removidas 16 ações do ActionExecutor
  - Removidos 15 intents da NLU
  - Modelo NLU reduzido de 8.9M para 7.7M

### Added
- **Serviço de Preview Contextual** (`backend/services/action-preview.js`)
  - `buildPreviewForActions()` busca dados reais dos arquivos JSON
  - Verifica permissões (Admin vs Operador)
  - Retorna `affectedItems` com detalhes do item a ser excluído
- **LunaInlinePreview** no chat — renderiza cards ricos com dados reais
  - Mostra nome, status, prioridade, responsável da tarefa
  - Botões Confirmar/Cancelar integrados
- **NLU Intents de Confirmação/Neagação**
  - `confirmacao.sim` — 72 frases (PT/ES/CA)
  - `confirmacao.nao` — 63 frases (PT/ES/CA)
  - Entity extractor para `tarefa.deletar` (extrai título do texto)
- **Resposta Inteligente ao Cancelamento**
  - Luna pergunta "O que você queria fazer?" em vez de só "cancelado"
- **Detecção de Confirmação/Neagação por Texto**
  - Endpoint detecta "sim"/"não" no contexto de confirmação pendente
  - Executa ou cancela a ação automaticamente
  - Respostas instantâneas sem LLM para confirmação pura

### Fixed
- Preview data retorna corretamente via `/api/luna/threads/:id/messages`
  - `buildThreadContext` agora inclui `needsConfirmation` e `previewData`
  - Forward de `previewData` no endpoint de threads
- NLU modelo atualizado (`backend/data/luna-model.nlp` ← `backend/scripts/model.nlp`)
- `activeUser.role` usado em vez de `req.user.role` no `/api/luna/chat`

### Testes
- 5/5 testes Playwright passando
  - ✅ Preview ao excluir tarefa mostra dados reais
  - ✅ Cancelamento retorna mensagem contextual
  - ✅ NLU reconhece confirmação (`confirmacao.sim`)
  - ✅ NLU reconhece negação (`confirmacao.nao`)
  - ✅ Preview ao criar tarefa mostra dados

## [Unreleased] — 2026-05-25 — Fase 1B: Undo/Redo Persistente

### Added
- **Undo Service** (`backend/services/undo-service.js`)
  - Stack de ações por thread (max 20), persistência em `undo-stack.json`
  - TTL 30 segundos por entrada — expira automaticamente
  - Métodos: `push()`, `undo()`, `redo()`, `getStack()`, `getLastAction()`
- **ActionExecutor** integrado com UndoService
  - `_captureBefore()` tira snapshot do item antes da deleção
  - `_isDestructiveAction()` detecta ações que geram entrada de undo
  - `execute()` retorna `undoable: true` quando ação destrutiva é bem-sucedida
- **Endpoints Undo/Redo**
  - `POST /api/luna/undo` — desfaz última ação e restaura item via API
  - `POST /api/luna/redo` — refaz ação desfeita
  - `GET /api/luna/undo/stack` — consulta stack atual
- **Frontend: Botão Desfazer**
  - `UndoButton` com countdown regressivo de 30s
  - `handleUndo` chama API e atualiza mensagens em tempo real
  - Indicador visual "Ação desfeita" após undo bem-sucedido
- **NLU: desfazer / refazer**
  - 145 intents, treinadas em PT/ES/CA
  - Respostas instantâneas sem LLM
- **action-preview.js** agora busca em `dataStore` (PostgreSQL) antes de fallback JSON

### Testes
- 5/5 testes passando (manual/API)
  - ✅ Preview de exclusão mostra dados reais
  - ✅ Confirmação gera undoable=true
  - ✅ Undo restaura a tarefa deletada
  - ✅ Tarefa reaparece na lista após undo
  - ✅ NLU reconhece "desfazer" (intent=desfazer)
