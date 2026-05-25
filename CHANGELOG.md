# Changelog — NEXO Dashboard Pro

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
