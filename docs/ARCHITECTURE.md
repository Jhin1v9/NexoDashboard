# System Architecture — NEXO Dashboard PRO

## Overview
Dashboard de operacoes interno para NEXO Digital. VPN-only, self-hosted.

## Stack
- **Frontend:** React 18 + Vite + Tailwind CSS + Framer Motion
- **Backend:** Node.js + Express + WebSocket (ws)
- **Data:** File-based JSON persistence
- **Agents:** Playwright CDP + WhatsApp Web
- **Deploy:** Vercel (frontend) + Self-hosted (backend)

## Data Flow

```
[WhatsApp Web] → [Playwright CDP] → [Luna Agent]
                                           ↓
[Site Forms] → [Webhook] → [Backend API] ← [Luna Scheduler]
                               ↓                ↑
                        [JSON Files]        [Relatorios]
                               ↓
                        [WebSocket] → [Frontend]
                               ↓
                        [Dashboard UI]
```

## Backend Architecture

### Entry Point
- `backend/server.js` — Express app + WebSocket server
- Porta 3456, bind 127.0.0.1 (localhost only)

### Data Layer
Todos os dados em `backend/data/*.json`:
- `transactions.json` — Fonte da verdade financeira
- `cash-box.json` — Derivado de transactions
- `tasks.json` — Tarefas manuais
- `whatsapp-tasks.json` — Tarefas extraidas do WhatsApp
- `changelog.json` — Release notes
- `users.json` — Usuarios do sistema
- `quotes.json` — Orcamentos
- `ops-state.json` — Estado do Centro de Operacoes

### API Layer
- RESTful APIs com padrao `{ success: boolean, ...data }`
- WebSocket para broadcast real-time
- Proxy Vite redireciona `/api/*` para localhost:3456

## Frontend Architecture

### Routing
- react-router-dom v6
- 12 rotas principais
- `/` redireciona para Operacoes

### State Management
- **Global:** WebSocket real-time (server → all clients)
- **Local:** useState/useReducer
- **Server:** Custom hooks (useChangelog, useTransactions, useRealtime)

### Component Hierarchy
```
App
├── Sidebar (navegacao)
├── TopBar (notificacoes, usuario, status)
├── main (conteudo das paginas)
│   ├── Routes
│   │   ├── Operacoes (default)
│   │   ├── Dashboard
│   │   ├── Financeiro
│   │   └── ...
└── CommandPalette (Ctrl+K)
```

## WhatsApp Agent Architecture

### Components
- `luna-cto-agent.mjs` — Extracao, analise, geracao de relatorios
- `luna-scheduler.mjs` — Loop: scan 10min / relatorio 30min
- `luna-daemon.mjs` — Monitoramento e reinicio automatico

### Data Flow
```
[WhatsApp Web] → [extrai mensagens] → [compara checkpoint]
                                              ↓
                                    [novas?] → [adiciona ao buffer]
                                              ↓
                                    [relatorio 30min] → [junta buffer]
                                              ↓
                                    [envia no grupo Production]
```

## Security
- VPN-only (127.0.0.1)
- Sem autenticacao (ambiente controlado)
- Sem secrets no codigo (use .env.local)
- CORS para origens confiaveis
