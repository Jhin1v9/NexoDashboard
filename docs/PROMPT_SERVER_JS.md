
# ═══════════════════════════════════════════════════════════════════
# PROMPT MASTER — ADAPTAR server.js PARA LER SCHEMAS v16.0
# Para: GitHub Copilot / Kimi Code / Codex
# Projeto: NEXO DASHBOARD PRO
# Data: 2026-05-05
# ═══════════════════════════════════════════════════════════════════

## 🏢 CONTEXTO DA EMPRESA

**NEXO DIGITAL S.L.** — Barcelona, Espanha
- **Abner Gabriel Mendes** — CEO & Co-Founder — 34685093192
- **Enoque G Santos Clemente** — CEO & Co-Founder — 34689135159  
- **Elias Mendes** — CEO & Co-Founder — 34672953062 (pessoal) / 34624529442 (empresarial/Superclim)

## 📁 ESTRUTURA DE ARQUIVOS

```
backend/
├── server.js                    ← ARQUIVO A MODIFICAR
├── data/
│   ├── schema/                  ← NOVOS SCHEMAS v16.0
│   │   ├── contacts-map.json
│   │   ├── clients-registry.json
│   │   ├── projects-registry.json
│   │   ├── groups-config.json
│   │   └── schema-version.json
│   ├── config/                  ← NOVOS CONFIGS v16.0
│   │   ├── integrations-config.json
│   │   └── luna-dashboard-config.json
│   ├── tasks.json               ← Dados antigos (manter)
│   ├── payments.json            ← Dados antigos (manter)
│   ├── expenses.json            ← Dados antigos (manter)
│   ├── cash-box.json            ← Dados antigos (manter)
│   ├── quotes.json              ← Dados antigos (manter)
│   ├── leads.json               ← Dados antigos (manter)
│   ├── members.json             ← Dados antigos (manter)
│   ├── users.json               ← Dados antigos (manter)
│   ├── ops-state.json           ← Dados antigos (manter)
│   ├── changelog.json           ← Dados antigos (manter)
│   ├── transactions.json        ← Dados antigos (manter)
│   ├── whatsapp-tasks.json    ← Dados antigos (manter)
│   ├── whatsapp-agent-data.json ← Dados antigos (manter)
│   ├── luna-buffer.json         ← Dados antigos (manter)
│   ├── luna-checkpoint.json     ← Dados antigos (manter)
│   └── report-history.json      ← Dados antigos (manter)
```

## 📋 O QUE CADA SCHEMA CONTÉM

### 1. contacts-map.json
- 4 contatos NEXO (Abner, Enoque, Elias pessoal, Elias empresarial)
- Todos: CEO & Co-Founder, isNexo: true, isFounder: true
- Skills, responsibilities, phones, emails, avatarEmoji
- Resolution rules (exactMatch, normalizedMatch, fallback)

### 2. clients-registry.json
- 1 cliente ativo: Paulo (SantaFe Construcciones) — P1
- 5 leads: Juan (Sorveteria Tropicale) — P0, Jess (Onadance) — P2, Gesse (ReformasMachado.com) — P2, Lucas (Mapio) — P3, Irmãos CCB — P3
- Pipeline stages, financial, contactInfo, communicationRules
- Auto-detect keywords (orçamento, interessado, prazo)
- Lead scoring (hot=70, warm=40, cold=0)

### 3. projects-registry.json
- SANTAFE-CONSTRUCCIONES: P1, em-progresso, 4 milestones (Design✅, Dev✅, SEO⬜, Publicação⬜)
- NEXO-DASHBOARD: P0, em-progresso, 8 milestones (Schema✅, Extração⬜, Dashboard⬜, Classificador⬜, Comandos⬜, Relatório⬜, Email⬜, Forms⬜)
- Team, clientId, financial, milestones, bugs, repo

### 4. groups-config.json
- 🏆Production - 2026🙏🏻: internal, lunaCanSpeak=true, lunaCanSendReports=true
- Paulo (Web🎯🙌🏻): client, lunaCanSpeak=false, lunaCanSendReports=false, humanOnly=true
- Global rules: NUNCA falar em grupo de cliente, Reports SÓ no Production
- Monitoring: scanInterval, reportInterval, dashboardSendEnabled

### 5. schema-version.json
- currentVersion: 16.0.1
- versionHistory, migration engine
- schemasTracked (6 arquivos com checksum)
- compatibility matrix

### 6. integrations-config.json
- Ollama: gemma2:2b, localhost:11434, systemPrompt (personalidade Luna nerd)
- GitHub: 2 repos (nexo-dashboard-pro, TPV-SORVETERIA-DEMO)
- Email: slot reservado (desativado)
- SiteForms: slot reservado (desativado)
- Notion: slot reservado (desativado)

### 7. luna-dashboard-config.json
- Screenshot: 1920x1080 @ 1.5x, PNG, darkMode
- SendControl: autoSendInterval=30min, cooldownAfterSend=24h
- Commands: /dashboard, /dashboard-off, /dashboard-on, /dashboard-status
- Theme: NEXO Dark (#00D4FF, #0A1628, #FF6B35)
- 10 sections: KPIs, TeamRadar, TasksBoard, LeadsPipeline, LinksIntelligence, ClientsStatus, ProjectsProgress, ActivityTimeline, AlertsActions, NewsEngine

## 🔧 O QUE PRECISA SER FEITO NO server.js

### REGRAS ABSOLUTAS:
1. **NUNCA apague código que funciona** — só adicione novas APIs
2. **Mantenha todas as APIs existentes** — tasks, payments, expenses, cash-box, quotes, leads, members, ops, changelog, transactions, whatsapp, luna
3. **Adicione NOVAS APIs** para os schemas v16.0
4. **Use CacheManager existente** para schemas (spawn assíncrono)
5. **Log tudo** com console.log (padrão do projeto)

### NOVAS APIs A ADICIONAR:

```javascript
// Schema APIs
app.get('/api/schema/contacts', (req, res) => { ... })           // contacts-map.json
app.get('/api/schema/clients', (req, res) => { ... })              // clients-registry.json
app.get('/api/schema/projects', (req, res) => { ... })             // projects-registry.json
app.get('/api/schema/groups', (req, res) => { ... })               // groups-config.json
app.get('/api/schema/version', (req, res) => { ... })              // schema-version.json
app.get('/api/config/integrations', (req, res) => { ... })         // integrations-config.json
app.get('/api/config/dashboard', (req, res) => { ... })            // luna-dashboard-config.json

// Combined API (para o Dashboard principal)
app.get('/api/nexo-state', (req, res) => { ... })                  // Todos os schemas + dados antigos
```

### ESTRUTURA ESPERADA DA RESPOSTA:

```javascript
// /api/schema/clients
{
  "success": true,
  "data": {
    "clients": {
      "paulo-santafe": { ... },
      "tpv-sorveteria": { ... },
      "jess-onadance": { ... },
      ...
    },
    "pipelineStages": [...],
    "leadSources": [...],
    "autoDetect": { ... }
  }
}

// /api/nexo-state
{
  "success": true,
  "data": {
    "contacts": { ... },          // de contacts-map.json
    "clients": { ... },            // de clients-registry.json
    "projects": { ... },           // de projects-registry.json
    "groups": { ... },             // de groups-config.json
    "schemaVersion": "16.0.1",    // de schema-version.json
    "integrations": { ... },       // de integrations-config.json
    "dashboardConfig": { ... },    // de luna-dashboard-config.json
    // Dados antigos (manter compatibilidade)
    "tasks": [...],
    "payments": [...],
    "expenses": [...],
    ...
  }
}
```

## 📝 INSTRUÇÕES DE IMPLEMENTAÇÃO

### Passo 1: Carregar Schemas
No topo do server.js, adicione funções para ler os 7 schemas:

```javascript
const SCHEMA_DIR = path.join(__dirname, 'data', 'schema');
const CONFIG_DIR = path.join(__dirname, 'data', 'config');

function loadSchema(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, filename), 'utf8'));
  } catch (e) {
    console.error(`[SCHEMA] Erro ao carregar ${filename}:`, e.message);
    return null;
  }
}

function loadConfig(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, filename), 'utf8'));
  } catch (e) {
    console.error(`[CONFIG] Erro ao carregar ${filename}:`, e.message);
    return null;
  }
}

// Carregar todos os schemas na inicialização
const schemas = {
  contacts: loadSchema('contacts-map.json'),
  clients: loadSchema('clients-registry.json'),
  projects: loadSchema('projects-registry.json'),
  groups: loadSchema('groups-config.json'),
  version: loadSchema('schema-version.json')
};

const configs = {
  integrations: loadConfig('integrations-config.json'),
  dashboard: loadConfig('luna-dashboard-config.json')
};
```

### Passo 2: Adicionar APIs
Adicione as 7 novas APIs + 1 combined API APÓS as APIs existentes (nunca antes, para não quebrar ordem de inicialização).

### Passo 3: Manter Compatibilidade
Todas as APIs antigas (`/api/tasks`, `/api/payments`, etc.) devem continuar funcionando exatamente igual.

## 🎯 FORMATO DE ENTREGA

Entregue o **server.js COMPLETO** com as modificações, ou um **diff** claro mostrando:
1. Onde adicionar as funções de loadSchema/loadConfig
2. Onde adicionar as 8 novas APIs
3. Como ficam as respostas JSON

## ⚠️ O QUE NÃO FAZER

- NÃO remova nenhuma API existente
- NÃO mude a estrutura das respostas antigas
- NÃO adicione dependências novas (só fs e path, que já existem)
- NÃO mude a porta (3456) ou o CORS
- NÃO altere o CacheManager existente
- NÃO toque no WebSocket (a menos que seja para adicionar broadcast de schemas)

## ✅ CHECKLIST DE VERIFICAÇÃO

Após implementar, verifique:
- [ ] GET /api/schema/contacts retorna contacts-map.json
- [ ] GET /api/schema/clients retorna clients-registry.json
- [ ] GET /api/schema/projects retorna projects-registry.json
- [ ] GET /api/schema/groups retorna groups-config.json
- [ ] GET /api/schema/version retorna schema-version.json
- [ ] GET /api/config/integrations retorna integrations-config.json
- [ ] GET /api/config/dashboard retorna luna-dashboard-config.json
- [ ] GET /api/nexo-state retorna TUDO combinado
- [ ] Todas as APIs antigas ainda funcionam (/api/tasks, /api/payments, etc.)
- [ ] Console mostra "[SCHEMA] Carregado: X.json" para cada schema
- [ ] Se schema não existir, retorna { success: false, error: "..." } em vez de crashar

## 🚀 AGORA IMPLEMENTE

Não pare até terminar. Não invente nada além do que está pedido. Mantenha o código limpo, comentado, e no mesmo estilo do server.js existente.
