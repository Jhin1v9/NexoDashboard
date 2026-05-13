# 🐛 BugDetector Reports - Sistema de Monitoramento

## Visão Geral

Este sistema permite que os reports gerados pelo **BugDetector Pro** no frontend sejam automaticamente enviados para o backend e salvos na pasta `reports/` para análise.

## 📁 Estrutura

```
NEXO_DASHBOARD_PRO/
├── backend/data/reports/             # 📂 Reports recebidos do BugDetector
│   ├── bug-report-<id>-<timestamp>.json
│   └── ...
├── backend/server.js                 # 🖥️  Endpoints da API
├── frontend/src/main.jsx             # ⚛️  Integração React
├── frontend/src/utils/bugdetector-reporter.js  # 📡 Reporter
└── monitor-reports.cjs               # 👁️  Script de monitoramento
```

## 🚀 Como Funciona

### 1. Frontend (BugDetector → Backend)

Quando um usuário cria um report pelo BugDetector:

1. O `bugdetector-reporter.js` intercepta o salvamento no localStorage
2. Envia o report via POST para `/api/bugdetector/reports`
3. O backend salva como JSON na pasta `reports/`

### 2. Backend (API Endpoints)

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/api/bugdetector/reports` | Recebe novo report | ❌ Não |
| GET | `/api/bugdetector/reports` | Lista todos os reports | ✅ Sim |
| GET | `/api/bugdetector/reports/:filename` | Obtém um report | ✅ Sim |
| DELETE | `/api/bugdetector/reports/:filename` | Remove um report | ✅ Sim |

### 3. Monitoramento (CLI)

Use o script `monitor-reports.cjs` para acompanhar em tempo real:

```bash
# Modo watch (padrão) - monitora novos reports
node monitor-reports.cjs

# Lista todos os reports
node monitor-reports.cjs --list

# Mostra o report mais recente
node monitor-reports.cjs --latest
```

## 📋 Uso

### Iniciar o Monitoramento

```bash
cd /home/jhin/NEXO_DASHBOARD_PRO
node monitor-reports.cjs --watch
```

Saída esperada:
```
👁️  Modo monitoramento ativado
📁 Observando: /home/jhin/NEXO_DASHBOARD_PRO/reports

Aguardando novos reports... (Ctrl+C para sair)
```

### Quando um Report Chega

```
🔔 NOVO REPORT DETECTADO!
   Arquivo: bug-report-abc123-2026-05-13T14-30-00-000Z.json

======================================================================
🐛 BUG REPORT
======================================================================
ID:        abc123
Data:      13/05/2026, 14:30:00
Tipo:      bug
Severidade: high
Status:    pending
URL:       http://localhost:3457/dashboard
Página:    NEXO DASHBOARD PRO
----------------------------------------------------------------------
📝 Descrição:
O botão de exportar não está funcionando...

🧠 IA Análise:
   Categoria: ui
   Severidade: high
   Confiança: 85%
   Causa Raiz: Event listener não registrado
======================================================================
```

## 🔧 Configuração

### Variáveis de Ambiente (Frontend)

No `.env` do frontend:

```env
VITE_API_URL=http://localhost:3456
```

### Configuração do BugDetector

No `main.jsx`, o reporter já está integrado:

```jsx
import { setupBugDetectorReporter, bugDetectorReporterConfig } from './utils/bugdetector-reporter.js'

// Ativa o reporter
setupBugDetectorReporter()

// Passa os callbacks para o provider
<BugDetectorProvider config={{ 
  shortcut: 'Ctrl+Shift+D', 
  trigger: 'keyboard-shortcut',
  ...bugDetectorReporterConfig
}}>
```

## 📝 Formato dos Reports

Cada report é salvo como JSON com a seguinte estrutura:

```json
{
  "id": "uuid-do-report",
  "timestamp": "2026-05-13T14:30:00.000Z",
  "type": "bug",
  "severity": "high",
  "status": "pending",
  "url": "http://localhost:3457/dashboard",
  "pageTitle": "NEXO DASHBOARD PRO",
  "description": "Descrição do problema...",
  "expectedBehavior": "Comportamento esperado...",
  "markdownReport": "Análise em markdown da IA...",
  "element": {
    "tag": "button",
    "selector": "[data-bd-id=\"bd-1\"]",
    "xpath": "//div[1]/button",
    "rect": { "x": 100, "y": 200, "width": 120, "height": 40 }
  },
  "aiAnalysis": {
    "category": "ui",
    "severity": "high",
    "confidence": 85,
    "rootCause": "Event listener não registrado",
    "technicalDescription": "...",
    "codeFix": { ... }
  },
  "consoleLogs": [...],
  "networkRequests": [...],
  "screenshot": "data:image/png;base64,...",
  "_receivedAt": "2026-05-13T14:30:05.000Z",
  "_source": "bugdetector-pro"
}
```

## 🔒 Segurança

- Os reports são salvos localmente no servidor
- Endpoints de listagem/leitura requerem autenticação
- Endpoint de criação (POST) é público para receber do frontend
- Proteção contra directory traversal nos endpoints

## 🐛 Troubleshooting

### Reports não estão chegando

1. Verifique se o backend está rodando: `curl http://localhost:3456/api/stack-status`
2. Verifique o console do navegador por erros do reporter
3. Verifique se o CORS está configurado corretamente

### Erro de CORS

Adicione no `server.js` se necessário:

```javascript
app.use(cors({
  origin: ['http://localhost:3457', 'http://seu-dominio.com'],
  credentials: true
}));
```

### Pasta reports não existe

O sistema cria automaticamente. Se não criar:

```bash
mkdir -p /home/jhin/NEXO_DASHBOARD_PRO/reports
chmod 755 /home/jhin/NEXO_DASHBOARD_PRO/reports
```

## 📊 Próximos Passos

- [ ] Criar página no dashboard para visualizar reports
- [ ] Adicionar filtros por severidade/status
- [ ] Integrar com sistema de notificações
- [ ] Exportar reports para GitHub/Jira automaticamente
