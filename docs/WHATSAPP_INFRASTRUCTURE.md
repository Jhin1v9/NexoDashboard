# 📱 NEXO DIGITAL — WhatsApp Infrastructure & Agents

> **Documento mestre de operações WhatsApp + Dashboard**
> Criado por: Luna (CTO Virtual) — 2026-05-01
> Última atualização: 2026-05-01 16:30
> Status: ✅ WhatsApp logado e operacional

---

## 🚨 REGRAS ABSOLUTAS (Nunca quebrar)

| # | Regra | Status |
|---|-------|--------|
| 1 | **SÓ LER:** Grupo "Production 2026" | ✅ |
| 2 | **SÓ LER:** Grupo "Paulo (web)" (read-only) | ✅ |
| 3 | **SÓ ESCREVER:** Grupo "Production 2026" | ✅ |
| 4 | **NUNCA ESCREVER** em Paulo (web) | ❌ PROIBIDO |
| 5 | **NUNCA ESCREVER** em outros grupos/chats | ❌ PROIBIDO |
| 6 | **NUNCA MENCIONAR** conteúdo de outros chats no Production 2026 | ❌ PROIBIDO |
| 7 | Usar marca **"Luna — CTO Virtual — Kimi Claw"** em todas as mensagens | ✅ |

**Violação = Parada imediata. Revisão e correção obrigatória.**

---

## 🔗 WhatsApp Web — Acesso Direto

### Chrome DevTools Protocol (CDP)
```
http://127.0.0.1:9223
```
- **Status:** ✅ WhatsApp logado e conectado
- **QR Code:** Não necessário (sessão persistente)
- **Chrome:** Rodando em modo headless com remote debugging
- **Profile:** Perfil dedicado para WhatsApp Web

### Como verificar se está online:
```powershell
# Testar conexão CDP
Invoke-RestMethod -Uri "http://127.0.0.1:9223/json/version" -Method GET

# Listar abas abertas
Invoke-RestMethod -Uri "http://127.0.0.1:9223/json/list" -Method GET
```

### Como reiniciar Chrome WhatsApp:
```powershell
# 1. Matar processos Chrome existentes
Get-Process -Name "chrome" | Where-Object { $_.MainWindowTitle -match "WhatsApp" } | Stop-Process

# 2. Iniciar Chrome com CDP
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9223 `
  --user-data-dir="C:\chrome-whatsapp-profile" `
  --no-first-run `
  --no-default-browser-check `
  "https://web.whatsapp.com"
```

---

## 🤖 AGENTES CRIADOS (Catálogo Completo)

### 📁 Local: `C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\agents\`

| # | Agente | Arquivo | Tamanho | Versão | Status | Função |
|---|--------|---------|---------|--------|--------|--------|
| 1 | **Luna CTO Agent** | `luna-cto-agent.mjs` | 44KB | v10.2 | ✅ Ativo | Agente principal de inteligência |
| 2 | **Luna Scheduler** | `luna-scheduler.mjs` | 6.4KB | v1.0 | ✅ Ativo | Agendador de tarefas |
| 3 | **Luna Daemon** | `luna-daemon.mjs` | 5KB | v1.0 | ✅ Ativo | Daemon de monitoramento |
| 4 | **NEXO Unified Check** | `nexo-unified-check.mjs` | 12.2KB | v1.0 | ✅ Ativo | Script unificado de automação |
| 5 | **NEXO WhatsApp Agent v8** | `nexo-whatsapp-agent-v8.mjs` | 55.7KB | v8.0 | 🔵 Legado | Agente WhatsApp anterior |
| 6 | **NEXO WhatsApp Agent v9** | `nexo-whatsapp-agent-v9.mjs` | 29.4KB | v9.0 | 🔵 Legado | Agente WhatsApp anterior |
| 7 | **WhatsApp Scheduler** | `whatsapp-scheduler.mjs` | 2.1KB | v1.0 | ✅ Ativo | Scheduler específico WhatsApp |
| 8 | **WhatsApp Desktop Agent** | `whatsapp-desktop-agent.js` | 6KB | v1.0 | 🟡 Backup | Agente desktop |
| 9 | **WhatsApp Mapped Agent** | `whatsapp-mapped-agent.js` | 13.8KB | v1.0 | 🟡 Backup | Agente com mapeamento |
| 10 | **WhatsApp Checkpoint** | `whatsapp-checkpoint-agent.js` | 17.4KB | v1.0 | 🟡 Backup | Agente com checkpoint |
| 11 | **WhatsApp Monitor** | `whatsapp-monitor.js` | 6.1KB | v1.0 | 🟡 Backup | Monitor simples |
| 12 | **NEXO Agent Brain** | `nexo-agent-brain.js` | 1.9KB | v1.0 | 🟡 Auxiliar | Cérebro do agente |
| 13 | **Auto Monitor** | `auto-monitor.js` | 1KB | v1.0 | 🟡 Auxiliar | Monitor automático |

### 🔴 Agente PRODUÇÃO (Atual)

**`luna-cto-agent.mjs` (v10.2)** — Este é o agente principal que está rodando.

**Funcionalidades:**
- Scan WhatsApp a cada 10 minutos (não envia, só lê)
- Relatório a cada 30 minutos (envia SÓ se houver novidades)
- Anti-spam: Após 1x "sem novidades", silêncio total
- Detecção de: tarefas, links, ideias, decisões, pagamentos
- Integração com Dashboard via JSON
- Marcação automática: "Luna — CTO Virtual — Kimi Claw"

**Regras de Envio:**
```
SCAN (10 min): Lê → Guarda no buffer → NÃO ENVIA
REPORT (30 min): Verifica buffer → Se há novidades → ENVIA relatório
REPORT VAZIO: Se último relatório teve novidades → 1x "sem novidades" → SILÊNCIO
```

---

## ⚙️ TASK SCHEDULER (Agendador Windows)

### Tarefas Criadas

| Nome | Descrição | Status | Trigger | Ação |
|------|-----------|--------|---------|------|
| **Luna-Daemon-v10** | Agente principal WhatsApp | ✅ Rodando | A cada 10 min | `node luna-cto-agent.mjs` |
| **NEXO Auto Monitor** | Monitor automático | ✅ Pronto | A cada 1 hora | `node auto-monitor.js` |
| **NEXO-WhatsApp-Agent-v8** | Agente WhatsApp v8 | ✅ Pronto | A cada 30 min | `node nexo-whatsapp-agent-v8.mjs` |

### Como verificar:
```powershell
# Listar tarefas NEXO
Get-ScheduledTask -TaskName "*Luna*","*NEXO*" | Select-Object TaskName, State, LastRunTime, NextRunTime

# Ver logs de execução
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-TaskScheduler/Operational'; ID=201,102} -MaxEvents 20 | Where-Object { $_.Message -match "Luna|NEXO" }
```

### Como recriar uma tarefa:
```powershell
# Exemplo: Recriar Luna-Daemon-v10
$action = New-ScheduledTaskAction -Execute "node" -Argument "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\agents\luna-cto-agent.mjs" -WorkingDirectory "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\agents"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
Register-ScheduledTask -TaskName "Luna-Daemon-v10" -Action $action -Trigger $trigger -Settings $settings -Force
```

---

## 📊 DASHBOARD — Estrutura de Dados

### Local: `C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\backend\data\`

| Arquivo | Tipo | Descrição | Status |
|---------|------|-----------|--------|
| `payments.json` | JSON | Pagamentos dos clientes | ✅ 2 pagamentos |
| `expenses.json` | JSON | Despesas da empresa | ✅ 2 despesas |
| `cash-box.json` | JSON | Caixa + projeção financeira | ✅ Corrigido (€55) |
| `transactions.json` | JSON | Transações estruturadas | ✅ 3 transações |
| `tasks.json` | JSON | Tarefas (cliente + empresa) | ✅ 18 tarefas |
| `leads.json` | JSON | Sistema de leads | ✅ Criado |
| `company-tasks.json` | JSON | 76 tarefas da empresa | ✅ Completo |
| `whatsapp-tasks.json` | JSON | Tarefas do WhatsApp | ✅ 2 tarefas |
| `alerts.json` | JSON | Alertas do sistema | ✅ Configurado |
| `auto-config.json` | JSON | Configuração automação | ✅ 5.4KB |
| `unified-feed-config.json` | JSON | Config feed unificado | ✅ 7.9KB |
| `luna-scheduler.log` | LOG | Logs do scheduler | ✅ 17KB |
| `luna-buffer.json` | JSON | Buffer de mensagens | ✅ Ativo |
| `luna-checkpoint.json` | JSON | Checkpoint WhatsApp | ✅ v10.2 |
| `ops-state.json` | JSON | Estado operacional | ✅ 31KB |

### Endpoints da API
```
http://localhost:3456/api/payments      → Pagamentos
http://localhost:3456/api/expenses      → Despesas
http://localhost:3456/api/cash-box      → Caixa
http://localhost:3456/api/tasks        → Tarefas
http://localhost:3456/api/leads        → Leads (NOVO)
http://localhost:3456/api/cash-box/adjust    → Ajustar caixa
http://localhost:3456/api/cash-box/history   → Histórico
http://localhost:3456/api/cash-box/statement → Extrato
```

---

## 🚀 COMO USAR — Guia Rápido

### 1. Verificar se tudo está rodando
```powershell
# Dashboard backend
Invoke-RestMethod -Uri "http://127.0.0.1:3456/api/cash-box" -Method GET

# WhatsApp CDP
Invoke-RestMethod -Uri "http://127.0.0.1:9223/json/version" -Method GET

# Task Scheduler
Get-ScheduledTask -TaskName "*Luna*","*NEXO*" | Select-Object TaskName, State
```

### 2. Reiniciar tudo
```powershell
# 1. Parar servidor Dashboard
Get-Process -Name "node" | Where-Object { $_.CommandLine -match "server.js" } | Stop-Process

# 2. Reiniciar Chrome WhatsApp
Get-Process -Name "chrome" | Where-Object { $_.MainWindowTitle -match "WhatsApp" } | Stop-Process
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9223 --user-data-dir=C:\chrome-whatsapp-profile --no-first-run https://web.whatsapp.com"

# 3. Reiniciar servidor Dashboard
cd "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\backend"
node server.js

# 4. Verificar Task Scheduler
Get-ScheduledTask -TaskName "Luna-Daemon-v10" | Start-ScheduledTask
```

### 3. Ver logs do agente
```powershell
# Logs em tempo real
Get-Content -Path "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\backend\data\luna-scheduler.log" -Tail 50 -Wait

# Ou abrir no VS Code
code "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\backend\data\luna-scheduler.log"
```

### 4. Forçar envio de relatório
```powershell
# Limpar checkpoint para forçar novo relatório
Remove-Item -Path "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\backend\data\luna-checkpoint.json" -Force
# Aguardar próximo ciclo (10-30 min)
```

### 5. Verificar dados financeiros
```powershell
# Caixa
Invoke-RestMethod -Uri "http://127.0.0.1:3456/api/cash-box" | ConvertTo-Json

# Pagamentos
Invoke-RestMethod -Uri "http://127.0.0.1:3456/api/payments" | ConvertTo-Json

# Despesas
Invoke-RestMethod -Uri "http://127.0.0.1:3456/api/expenses" | ConvertTo-Json
```

---

## 📁 Estrutura de Pastas (Organização)

```
NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\
├── agents\                    → Todos os agentes WhatsApp
│   ├── luna-cto-agent.mjs     → 🟢 PRODUÇÃO (v10.2)
│   ├── luna-scheduler.mjs     → Agendador
│   ├── luna-daemon.mjs        → Daemon
│   ├── nexo-unified-check.mjs → Automação unificada
│   ├── LUNA-RULES.md          → Regras absolutas
│   └── ...                    → Outros agentes (backup)
├── backend\                   → Servidor Node.js
│   ├── server.js              → API principal
│   └── data\                  → Todos os JSONs
│       ├── payments.json
│       ├── expenses.json
│       ├── cash-box.json
│       ├── transactions.json
│       ├── tasks.json
│       ├── leads.json
│       └── ...
├── frontend\                  → React Dashboard
│   ├── src\pages\             → Páginas
│   └── dist\                  → Build para deploy
├── docs\                      → Documentação
│   ├── ARQUITETURA-MULTI-FONTE.md
│   ├── TAREFAS_EMPRESA_NEXO.md
│   ├── AUTO-PILOT.md
│   └── ...
└── PROMPT_MASTER_v4.md        → Prompt principal
```

---

## 🔧 DEPURAÇÃO — Quando algo dá errado

### Problema: WhatsApp desconectou
```powershell
# Verificar se Chrome está rodando
Get-Process -Name "chrome" | Select-Object Id, MainWindowTitle

# Verificar CDP
Invoke-RestMethod -Uri "http://127.0.0.1:9223/json/version"

# Se não responder, reiniciar Chrome WhatsApp
```

### Problema: Agente parou de enviar relatórios
```powershell
# Verificar checkpoint
Get-Content -Path "...\backend\data\luna-checkpoint.json" | ConvertFrom-Json

# Verificar buffer
Get-Content -Path "...\backend\data\luna-buffer.json"

# Verificar logs
Get-Content -Path "...\backend\data\luna-scheduler.log" -Tail 50
```

### Problema: Dashboard não responde
```powershell
# Verificar se porta 3456 está em uso
netstat -ano | Select-String "3456"

# Matar processo na porta
Get-Process -Id (netstat -ano | Select-String "3456" | ForEach-Object { ($_ -split "\s+")[-1] } | Select-Object -First 1)

# Reiniciar servidor
cd "...\backend"; node server.js
```

---

## 📋 CHECKLIST DIÁRIO (Operação)

- [ ] WhatsApp CDP respondendo (`http://127.0.0.1:9223`)
- [ ] Dashboard backend rodando (`http://localhost:3456`)
- [ ] Task Scheduler: Luna-Daemon-v10 em "Running"
- [ ] Último relatório WhatsApp enviado (verificar grupo)
- [ ] Caixa consistente (Home = Financeiro)
- [ ] Tarefas atualizadas
- [ ] Sem erros nos logs

---

## 📞 CONTATOS E LINKS

| Recurso | Valor |
|---------|-------|
| **Dashboard** | http://localhost:3456 |
| **WhatsApp CDP** | http://127.0.0.1:9223 |
| **WhatsApp Web** | https://web.whatsapp.com |
| **Site NEXO** | https://nexo.chatopsmaster.com/pt/index.html |
| **Site Vendas** | https://chatopsmaster.com |
| **GitHub TPV** | https://github.com/Jhin1v9/TPV-SORVETERIA-DEMO |
| **GitHub Dashboard** | https://github.com/Jhin1v9/nexo-dashboard-pro |

---

## 🧠 MEMÓRIA DA LUNA

**Nunca esquecer:**
1. Só ler 2 grupos: Production 2026 + Paulo (web)
2. Só escrever em 1 grupo: Production 2026
3. Nunca mencionar outros chats
4. Sempre usar marca Luna
5. Anti-spam: 1x "sem novidades" = silêncio

**Cliente 1:** Juan — Tropicale — TPV Sorveteria — €5.500 + €199/mês
**Cliente 2:** Paulo — Santafe — Site Construcciones — €350 + €19.99/mês
**Caixa:** €55 (€175 recebido - €120 hostinger)

---

*Documento criado por: Luna — CTO Virtual — NEXO Digital*
*Data: 2026-05-01*
*Versão: 1.0*
*"Funciona > Perfeito > Bonito > Nada"*
