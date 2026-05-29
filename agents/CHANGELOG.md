# Changelog — Luna CLI

## v3.3 "Espelho Completo" — 2026-05-26

### 🎯 Visão
A Kimi Web agora usa ferramentas **nativas** (ipython, web_search, browser, computer) e a Luna as espelha localmente no PC do usuário. O system prompt foi reduzido de ~2000 para ~300 tokens. Taxa de sucesso de execução: ~70% → >95%.

### ✨ Novidades

#### Arquitetura
- **KimiToolAdapter** (`kimi-tool-adapter.cjs`) — Contrato de interface versionado para mapeamento nativo→Luna com níveis de fidelidade (total/partial/low)
- **ToolCallLedger** (`tool-call-ledger.cjs`) — Rastreamento de ciclo de vida completo das tool calls: pending → executing → completed/failed → retry
- **DOM Mirror v3.3** — Expandido para 4 tipos de tools nativas (ipython, web_search, browser, computer) com ordenação FIFO por seq/timestamp

#### Core Engine
- `_handleAction` — Ban removido para `ipython`/`browser`/`computer`. Mapeamentos diretos:
  - `ipython` → `executeShell` (Python local)
  - `web_search` → `searchWeb`
  - `browser` → `fetchURL`
  - `computer` → desktop engine (click, type, screenshot)
- **Tool result echo** com `[LUNA-MIRROR]` semântica estável (framing "replicação read-only")
- **Auto-continue** preservado com deduplicação por hash SHA256

#### Segurança
- **Python sandbox AST-light** (`validatePythonCode`) — deny-list de imports (`os`, `subprocess`, `socket`, etc.) e builtins perigosos (`eval`, `exec`, `__import__`)
- **Destructive ops confirmation gate** (`checkDestructivePattern`) — detecta `rm`, `chmod`, `curl -F`, `sudo`, `~/.ssh` e pede confirmação `[s/N]`
- **ToolGuard schemas** para tools nativas (`ipython`, `browser`, `computer`)
- **DOM isolation** — `isInsideAssistant()` verifica se nós extraídos estão dentro do container do assistente

#### CDP / Playwright
- **MutationObserver** injetado em todas as novas páginas (`_injectDomObserver` + `_injectDomObserverEvaluate`)
- **Stream interceptor** preservado como fallback (não funcional devido a Connect-RPC, mas mantido)
- **Polling reduzido** de 800ms para 400ms

#### Tools
- **clipboardWrite fix** — `xclip` com `spawn` detached em vez de `execSync -loops 1`
- **executeShell** — assinatura corrigida (string command, não objeto)
- **fetchURL** — assinatura corrigida (string url, não objeto)

### 📊 Métricas

| Métrica | v3.2 | v3.3 |
|---------|------|------|
| System prompt | ~2000 tokens | ~300 tokens |
| Taxa de execução | ~70% | >95% (E2E validado) |
| Tools suportadas | 5 Luna | 5 Luna + 4 nativas = 9 |
| Testes passando | — | 100% (47/47 + 18/18 + 16/16) |

### 🛠️ Arquivos modificados/criados

**Criados:**
- `kimi-tool-adapter.cjs` — Adapter Pattern para tools nativas
- `tool-call-ledger.cjs` — Ledger de tool calls com deduplicação
- `PLANO-v33-FASES.md` — Plano de execução por fases
- `PLANO-v33-HTML-TAILWIND-OPEN-FIX.md` — Plano para ajuste de sandbox Python
- `TEST-RELATORIO-2026-05-26.md` — Relatório de testes unitários
- `RELATORIO-COMPLETO-v33-2026-05-26.md` — Relatório completo consolidado

**Modificados:**
- `luna-soul.cjs` — Simplified prompt, native tool routing, result echo, parser warning
- `kimi-bridge.cjs` — DOM Mirror expansion, MutationObserver, FIFO ordering, syntax fix
- `luna-tool-guard.cjs` — Native schemas, Python sandbox, destructive ops detection
- `luna-tools.cjs` — clipboardWrite fix (spawn detached)
- `kimi-bridge-interceptor-toolcalls.js` — Updated comments for v3.3

---

## v3.2 — 2026-05-25

- DOM Mirror para `.toolcall-ipython` (extração de código Python + resultado + imagens)
- Auto-continue com deduplicação `executedDomActionHashes`
- ToolGuard com retry, circuit breaker, idempotency, schema validation, timeout, checksum

## v3.1 — 2026-05-19

- Luna CLI inicial com TUI (Ink + React)
- 32+ ferramentas nativas
- Conexão Kimi Web via Playwright CDP
- `[[action]]` tag format for tool calls
