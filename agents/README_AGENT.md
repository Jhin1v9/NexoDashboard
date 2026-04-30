# Agentes NEXO

Agentes de automação para o NEXO Dashboard PRO.

## Agentes Disponíveis

### `nexo-agent-brain.js`
Agente principal com padrão ReAct (Reasoning + Acting).
- Monitora health dos projetos
- Detecta tarefas via WhatsApp
- Toma decisões automáticas

### `whatsapp-agent.js`
Automação WhatsApp via Playwright.
- Lê grupo "Production 2026"
- Extrai tarefas de mensagens
- Envia relatórios

### `auto-monitor.js`
Monitor automático periódico.
- Verifica health a cada hora
- Alerta quando necessário

## Configuração

```bash
cd agents
npm install
npx playwright install
```

## Uso

```bash
# Agente principal
npm run agent

# Monitor
npm run monitor

# WhatsApp
npm run whatsapp
```
