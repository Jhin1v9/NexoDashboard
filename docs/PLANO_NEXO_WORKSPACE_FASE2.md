# Plano NEXO Workspace — Fase 2: Fundação (Implementado)

> Data: 19/05/2026 | Autor: Kimi (Luna CTO)

## O que foi implementado

### Backend
- **`backend/workspace-manager.js`** — módulo core de filesystem:
  - Criação de clientes com estrutura de pastas padrão (`01_orcamentos` a `07_entregas`)
  - `cliente.json` metadata por cliente
  - `workspace-index.json` índice global
  - CRUD de arquivos/pastas com sanitização anti path-traversal
  - Detecção de tipo de projeto (react, nextjs, vue, static-html, etc.)
- **`backend/server.js`** — 11 novas rotas REST sob `/api/workspace/*`:
  - `GET /api/workspace/clients` — lista clientes
  - `POST /api/workspace/clients` — cria cliente
  - `GET|PUT|DELETE /api/workspace/clients/:id` — ler/atualizar/deletar
  - `GET /api/workspace/clients/:id/files` — lista arquivos
  - `POST /api/workspace/clients/:id/folders` — cria pasta
  - `POST /api/workspace/clients/:id/upload` — upload (multer, até 100MB)
  - `GET /api/workspace/clients/:id/download` — download
  - `DELETE /api/workspace/clients/:id/files` — deleta arquivo/pasta
  - `POST /api/workspace/clients/:id/rename` — renomeia
  - `GET /api/workspace/clients/:id/detect` — detecta tipo de projeto

### Frontend
- **`frontend/src/pages/Workspace.jsx`** — File Manager completo:
  - Sidebar de clientes com busca
  - Navegação por breadcrumbs
  - Grid e List view
  - Drag & drop upload
  - Criar cliente/pasta via modais
  - Renomear, deletar, download
  - Preview pane com metadados
  - Badges de tipo de projeto em demos
- **`frontend/src/App.jsx`** — rotas `/workspace` e `/workspace/:clientId`
- **`frontend/src/components/Sidebar.jsx`** — link "Workspace" com ícone FolderOpen

### Dependências
- `multer` instalado no backend

## Estrutura de pastas criada por cliente
```
workspace/
└── <client-id>/
    ├── 01_orcamentos/
    ├── 02_contratos/
    ├── 03_briefings/
    ├── 04_design/
    ├── 05_demos/
    ├── 06_documentacao/
    ├── 07_entregas/
    └── cliente.json
```

## Testes realizados
- [x] Criar cliente via API
- [x] Listar clientes (índice)
- [x] Listar arquivos/pastas
- [x] Criar pasta
- [x] Upload de arquivo
- [x] Download de arquivo
- [x] Deletar arquivo
- [x] Deletar cliente (com cascade de pasta)
- [x] Build do frontend sem erros
- [x] Detecção de projeto (unknown em pasta vazia)

## Próximos passos (Fase 3)
- Execução local de demos (`npm run dev`, PID tracking, kill switch)
- Widget "Servidores Ativos" no Dashboard
- Terminal embutido para logs

## Commits
```
Luna cto - Fundacao Workspace v1.0 - Abner
```
