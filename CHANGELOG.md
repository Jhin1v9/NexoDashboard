# Changelog — NEXO Dashboard Pro

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
