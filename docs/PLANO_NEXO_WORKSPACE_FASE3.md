# Plano NEXO Workspace — Fase 3: Execução Local de Demos (Implementado)

> Data: 19/05/2026 | Autor: Kimi (Luna CTO)

## O que foi implementado

### Backend
- **`backend/process-manager.js`** — gerenciador de processos de desenvolvimento:
  - `startServer(clientId, demoPath)` — fluxo completo:
    1. Detecta tipo de projeto via `workspaceManager.detectProjectType()`
    2. Determina comando e porta padrão por tipo (5173, 3000, 8080, etc.)
    3. Verifica conflito de porta → incrementa automaticamente se ocupada
    4. Se projeto Node e `node_modules` ausente → roda `npm install`
    5. Spawna processo com `stdio: 'pipe'` e captura logs em arquivo
    6. Guarda PID, porta, URL, comando em `dev-servers.json`
  - `stopServer(serverId)` — graceful kill (`SIGTERM`) + fallback `SIGKILL` após 2s
  - `getRunningServers()` / `cleanupDeadServers()` — lista e limpa processos mortos
  - `getServerLogs(serverId)` — retorna últimas N linhas do log
  - `isPortInUse()` / `findAvailablePort()` — gerenciamento de portas

- **`backend/server.js`** — 4 novas rotas:
  - `POST /api/workspace/clients/:id/start` — inicia servidor de demo
  - `POST /api/workspace/clients/:id/stop` — para servidor
  - `GET /api/workspace/servers` — lista servidores ativos
  - `GET /api/workspace/servers/:serverId/logs` — retorna logs

### Frontend
- **`frontend/src/pages/Workspace.jsx`** — botões de execução:
  - ▶️ Play em pastas detectáveis como projeto (dentro de demos)
  - ⏹️ Stop quando servidor estiver rodando
  - Badge verde com URL ao lado do nome da pasta
  - Polling a cada 5s para manter status atualizado

- **`frontend/src/pages/Dashboard.jsx`** — widget "Servidores Locais Ativos":
  - Card com lista de servidores rodando
  - Cliente, demo, tipo, porta, URL, PID
  - Botão ⏹️ para parar direto do dashboard
  - Link para abrir no navegador
  - Aparece apenas quando há servidores ativos

## Comandos suportados por tipo de projeto

| Tipo | Comando | Porta padrão |
|------|---------|--------------|
| react-vite | `npm run dev` | 5173 |
| react-cra | `npm start` | 3000 |
| nextjs | `npm run dev` | 3000 |
| vue | `npm run dev` | 5173 |
| static-html | `npx serve . -l PORT` | 8080 |
| php/wordpress | `php -S localhost:PORT` | 8000 |
| python | `python app.py` | 5000 |
| electron | `npm run electron:dev` | — |

## Testes realizados
- [x] Criar demo HTML estático
- [x] Detectar tipo `static-html`
- [x] Iniciar servidor (`npx serve . -l 8080`)
- [x] Servir conteúdo em `http://localhost:8080`
- [x] Listar servidores ativos via API
- [x] Ler logs do servidor
- [x] Parar servidor (kill PID)
- [x] Verificar lista vazia após stop
- [x] Build frontend sem erros
- [x] Screenshot confirma badge HTML + URL verde no Workspace

## Próximos passos (Fase 4)
- Terminal embutido com logs em tempo real (WebSocket ou SSE)
- Drag & drop de arquivos no File Manager
- Context menu (botão direito)
- Dark mode refinements

## Commits
```
Luna cto - Execucao local de demos v1.0 - Abner
```
