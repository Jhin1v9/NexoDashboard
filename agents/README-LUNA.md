# Luna CLI — Espelho Completo v3.3

> Assistente CLI autônomo de desktop com Playwright + React + Ink.
> Conecta-se ao Kimi Web e espelha ferramentas nativas localmente no PC físico.

## 🚀 Quick Start

```bash
# 1. Terminal 1 — Iniciar Luna TUI (modo visível)
cd ~/NEXO_DASHBOARD_PRO/agents && npx luna-tui --user abner

# 2. Terminal 2 — Iniciar Kimi bridge
node kimi-bridge.cjs

# 3. Enviar mensagem (o bridge retorna JSON no stdout)
echo '{"userId":"abner","action":"send_message","content":"O que é Bitcoin?"}' | node kimi-bridge.cjs
```

## 🏗️ Architecture v3.3

```
┌─────────────────────────────────────────────────────────┐
│                     Kimi Web (HER Cloud)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  ipython    │  │ web_search  │  │  browser        │  │
│  │  (sandbox)  │  │  (API)      │  │  (fetch)        │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                    │          │
│         ▼                ▼                    ▼          │
│  ┌──────────────────────────────────────────────────┐  │
│  │           DOM (React components)                  │  │
│  │   .toolcall-ipython  .toolcall-web_search         │  │
│  │   .toolcall-browser  .toolcall-computer           │  │
│  └────────────────────────┬───────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │ CDP port 9222
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Luna Bridge (CDP)                     │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │  MutationObserver │  │  DOM Mirror Extractor        │  │
│  │  (FIFO ordering)  │  │  (_extractToolMirrorFromDOM) │  │
│  └──────────────────┘  └─────────────────────────────┘  │
│                    ┌──────────────┐                       │
│                    │  Luna Soul   │                       │
│                    │  (orchestra) │                       │
│                    └──────┬───────┘                       │
│              ┌────────────┼────────────┐                  │
│    ┌─────────▼──────┐   ┌▼────────────▼┐  ┌───────────┐ │
│    │  luna-tools    │   │ luna-tool-guard│  │   engine  │ │
│    │  (32 tools)    │   │ (security)     │  │ (desktop) │ │
│    └────────────────┘   └──────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │  PC Físico Local │
                  └─────────────────┘
```

## 🔧 Ferramentas suportadas

### Luna Native (local)
| Tool | Descrição |
|------|-----------|
| `readFile` | Ler arquivo |
| `writeFile` | Escrever arquivo |
| `listDir` | Listar diretório |
| `executeShell` | Executar shell |
| `searchWeb` | Busca web (requer API key) |
| `fetchURL` | Fetch HTTP nativo |
| `clipboardWrite` | Escrever no clipboard |
| `screenshot` | Screenshot do desktop |
| ... + 24 mais | |

### Kimi Native (espelhado)
| Tool | Fonte DOM | Execução Local |
|------|-----------|----------------|
| `ipython` | `.toolcall-ipython` | `executeShell` (Python3) |
| `web_search` | `.toolcall-web_search` | `searchWeb` |
| `browser` | `.toolcall-browser` | `fetchURL` |
| `computer` | `.toolcall-computer` | Desktop Engine |

## 🔒 Segurança

### Python Sandbox
- **Blocked imports**: `os`, `subprocess`, `shutil`, `socket`, `multiprocessing`, `pty`, `resource`, `ctypes`
- **Blocked builtins**: `eval`, `exec`, `compile`, `__import__`, `open`
- **Blocked paths**: `~/.ssh`, `/etc/passwd`, `/etc/shadow`

### Destructive Operations Gate
Detecta e solicita confirmação `[s/N]` para:
- `rm`, `chmod`, `chown`
- `curl -F` (upload)
- `~/.ssh` access
- `mkfs`, `dd if=`
- `sudo`

### ToolGuard
- Schema validation para todas as tools
- Circuit breaker (falha após 3 erros)
- Idempotency via checksum SHA256
- Timeout (30s) e retry (1x)

## 🧪 Testing

```bash
# Rodar suite completa
node run-all-tests.mjs

# Testes unitários apenas
node test-all-tools.mjs

# Teste E2E manual
node test-e2e.mjs
```

**Resultados v3.3 (2026-05-26):**
- Unit Tests: 48/48 ✅
- Integration: 6/6 ✅
- Security: 22/22 ✅
- Advanced (Adapter + Ledger): 18/18 ✅
- E2E + Regression: 16/16 ✅

## 📁 Files principais

| Arquivo | Linhas | Responsabilidade |
|---------|--------|-----------------|
| `kimi-bridge.cjs` | ~3000 | CDP bridge, DOM extraction, stream polling |
| `luna-soul.cjs` | ~2300 | Orquestração, parser, tool routing |
| `luna-tools.cjs` | ~1000 | 32+ tool implementations |
| `luna-tool-guard.cjs` | ~530 | Segurança, sandbox, circuit breaker |
| `kimi-tool-adapter.cjs` | ~200 | Adapter Pattern nativo→Luna |
| `tool-call-ledger.cjs` | ~180 | Ledger de tool calls com deduplicação |

## 📝 Notas

- Kimi Web usa **Connect-RPC** (`application/connect+json`), não SSE. O interceptor de rede não funciona. DOM Mirror é o único caminho viável.
- `searchWeb` requer API key em `~/.luna/config.json` (`googleSearchApiKey`, `googleSearchEngineId`)
- A semântica `[LUNA-MIRROR]` é **read-only** — Kimi deve usar o resultado real como ground truth

## 📜 Changelog

Veja [CHANGELOG.md](CHANGELOG.md).

---
*Luna CLI v3.3 "Espelho Completo" — NEXO DIGITAL S.L. — 2026-05-26*
