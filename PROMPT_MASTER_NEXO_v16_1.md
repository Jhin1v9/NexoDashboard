# ═══════════════════════════════════════════════════════════════════════════════
# PROMPT MASTER — NEXO DASHBOARD PRO v16.1
# Correção Cirúrgica de 10 Erros Críticos
# Autor: Kimi K2.6 | Data: 2026-05-06
# REGRA ABSOLUTA: 1 arquivo por vez. NUNCA reescrever arquivo inteiro.
# ═══════════════════════════════════════════════════════════════════════════════

## 📋 CONTEXTO DO PROJETO

**Repositório:** `github.com/Jhin1v9/NexoDashboard` (branch main)
**Stack:** React 18 + Vite + Tailwind + Express + WebSocket
**Backend:** `backend/server.js` (porta 3456)
**Frontend:** `frontend/src/pages/*.jsx` (porta 3457)
**Agente Luna:** `agents/luna-cto-agent.cjs` + `luna-buffer.json`
**Dados:** `backend/data/` (JSON file-based)

**CEO NEXO:** Abner Mendes — Barcelona, Espanha
**Equipe:** Abner, Nonoke (Enoque), Elias — Todos CEOs & Fullstack
**Idioma UI:** Espanhol (labels, botões, textos)
**Código/Variáveis:** Inglês

---

## 🔴 ERROS VALIDADOS (Confirmados no código-fonte do GitHub)

### ERRO #1 — `/api/finance/summary` DUPLICADO [CRÍTICO]
**Local:** `backend/server.js` — DUAS definições do mesmo endpoint
- **Primeira** (~linha 1207): Implementação completa com `payments.json` + `expenses.json` + `cash-box.json` + `alerts.json`. Retorna: `{totalExpected, totalReceived, totalPending, cashBoxBalance, monthlyIncome, monthlyExpenses, activeClients, overduePayments, alerts}`
- **Segunda** (~linha 1637): Implementação simplificada com `transactions.json` + `payments.json` + `expenses.json`. Retorna: `{balance: {value, currency}, totalIncome: {value, currency}, totalExpense: {value, currency}, pendingPayments: {value, currency}, transactionCount, lastUpdated}`

**Impacto:** A segunda SOBRESCREVE a primeira. Dashboard recebe `{balance, totalIncome...}` em vez de `{totalExpected, totalReceived...}`. Campos `totalExpected`, `totalReceived`, `totalPending` ficam `undefined` → Dashboard cai nos fallbacks hardcoded (5850, 175, 5675).

**Correção:**
1. APAGAR a segunda definição (`app.get('/api/finance/summary', (req, res) => {...})` que lê `TRANSACTIONS_FILE`)
2. MANTER a primeira definição (a completa com payments/expenses/cashBox)
3. Adicionar `transactions.json` à primeira definição: incluir `transactionCount` e `totalTransactions` no retorno

---

### ERRO #2 — WhatsApp: Dados Brutos Não Normalizados [CRÍTICO]
**Local:** `backend/server.js` linhas ~305-320 (`/api/whatsapp`) + `agents/luna-cto-agent.cjs`

**Problema:** O endpoint `/api/whatsapp` lê `luna-buffer.json` que tem estrutura:
```json
{
  "messages": [...],
  "tasks": [...],
  "ideas": [...],
  "decisions": [...],
  "links": [...],
  "mentions": [...],
  "totalMessages": 0,
  "totalTasks": 0,
  "totalIdeas": 0,
  "totalDecisions": 0
}
```

Mas `Dashboard.jsx` consome `/api/whatsapp-agent` (não `/api/whatsapp`) e espera:
```javascript
const agentStats = agentData?.stats || {}
// agentStats.totalMessages, agentStats.totalTasks, agentStats.totalIdeas
```

E `whatsapp-agent-data.json` tem estrutura BRUTA do WhatsApp Web com objetos `_data` aninhados. Não tem campo `stats` normalizado.

**Correção:**
1. Em `backend/server.js`, modificar `/api/whatsapp-agent` para:
   - Ler `luna-buffer.json` (que tem dados processados pelo SmartClassifier)
   - Normalizar a resposta com campo `stats` contendo:
     ```javascript
     stats: {
       totalMessages: buffer.messages?.length || 0,
       totalTasks: buffer.tasks?.length || 0,
       totalIdeas: buffer.ideas?.length || 0,
       totalDecisions: buffer.decisions?.length || 0,
       totalLinks: buffer.links?.length || 0,
       totalMentions: buffer.mentions?.length || 0,
       participants: extractParticipants(buffer.messages),
       lastUpdate: buffer.lastUpdated || new Date().toISOString()
     }
     ```
   - Adicionar campo `normalizedMessages` com `authorName` resolvido (usar `resolveAuthor()` do SmartClassifier)

2. Criar função helper `extractParticipants(messages)` que retorna array único de remetentes

---

### ERRO #3 — Desalinhamento `messages` vs `newMessages` [CRÍTICO]
**Local:** `backend/server.js` `/api/whatsapp` + `Dashboard.jsx` + `WhatsApp.jsx`

**Problema:**
- `/api/whatsapp` retorna: `{messages: [...], tasks: [...], ideas: [...], totalMessages: N}`
- `Dashboard.jsx` consome `/api/whatsapp-agent` e espera `agentData.stats.totalMessages`
- `WhatsApp.jsx` consome `/api/whatsapp-agent` e espera `data.messages`
- Mas `luna-buffer.json` usa `newMessages` (não `messages`) em algumas versões do agente

**Correção:**
1. Padronizar TODOS os endpoints para usar `messages` (nunca `newMessages`)
2. Em `/api/whatsapp`, garantir que retorna `messages` (não `newMessages`)
3. Em `/api/whatsapp-agent`, mapear `buffer.messages` para `messages`
4. Em `Dashboard.jsx`, usar `agentStats.totalMessages || 0` (já faz, mas confirmar)
5. Em `WhatsApp.jsx`, usar `data.messages || []` (já faz, mas confirmar que a fonte está certa)

---

### ERRO #4 — Valores Hardcoded no Dashboard [CRÍTICO]
**Local:** `frontend/src/pages/Dashboard.jsx` ~linha 108

```javascript
const totalExpected = summary.totalExpected || 5850      // ← HARDCODED
const totalReceived = summary.totalReceived || 175       // ← HARDCODED
const totalPending = summary.totalPending || 5675        // ← HARDCODED
const cashBalance = summary.balance?.value ?? cashBox.balance?.value ?? 0
const monthlyExpenses = summary.totalExpense?.value ?? cashBox.monthlyExpenses?.value ?? 0
```

**Impacto:** Mesmo que API retorne valores corretos, se vierem `0` ou `undefined`, o dashboard mostra 5850/175/5675 (valores de demo antigos).

**Correção:**
```javascript
const totalExpected = summary.totalExpected ?? 0
const totalReceived = summary.totalReceived ?? 0
const totalPending = summary.totalPending ?? 0
const cashBalance = summary.cashBoxBalance ?? cashBox.balance?.value ?? 0
const monthlyExpenses = summary.monthlyExpenses ?? cashBox.monthlyExpenses?.value ?? 0
```
**REGRA:** Usar `??` (nullish coalescing) com `0`, NUNCA `||` com valores de demo.

---

### ERRO #5 — "Atividade Recente" Fake / Sem Dados Reais [CRÍTICO]
**Local:** `frontend/src/pages/Dashboard.jsx`

**Problema:** Dashboard mostra timestamps fixos (23:53:57, 23:41:51) que são placeholders de UI. Não consome `/api/whatsapp` nem mostra mensagens reais do Luna.

**Correção:**
1. Adicionar fetch de `/api/whatsapp` no Dashboard (ou usar `useRealtime('/api/whatsapp', 30000)`)
2. Criar componente `RecentActivity` que mostra últimas 5 mensagens do WhatsApp:
   ```javascript
   const { data: whatsappData } = useRealtime('/api/whatsapp', 30000)
   const recentMessages = (whatsappData?.messages || []).slice(-5).reverse()
   ```
3. Para cada mensagem mostrar: `authorName`, `body` (ou `text`), `timestamp` formatado
4. Se não houver mensagens, mostrar "Sin actividad reciente" (espanhol)

---

### ERRO #6 — IDs de Tarefas Inconsistentes [ALTA]
**Local:** `backend/data/tasks.json`

**Problema:** IDs mistos:
```json
{ "id": "task-1777637576514-8ezk" }    // String
{ "id": 1777534853406.4915 }           // Number (float!)
```

**Correção:**
1. Criar script de migração `backend/migrate-task-ids.js`:
   ```javascript
   const tasks = readJSON(TASKS_FILE) || []
   const migrated = tasks.map(t => ({
     ...t,
     id: typeof t.id === 'number' ? `task-${Date.now()}-${Math.random().toString(36).slice(2,6)}` : t.id
   }))
   writeJSON(TASKS_FILE, migrated)
   ```
2. Executar UMA vez
3. Modificar `POST /api/tasks` para FORÇAR string:
   ```javascript
   const task = { id: `task-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ...req.body, ... }
   ```

---

### ERRO #7 — Botão "Forçar Scan" (404) [ALTA]
**Local:** `frontend/src/pages/Dashboard.jsx` + `backend/server.js`

**Problema:** Dashboard faz POST para `/api/scan-now` mas endpoint NÃO EXISTE.

**Correção:**
1. Em `backend/server.js`, adicionar:
   ```javascript
   app.post('/api/scan-now', async (req, res) => {
     try {
       const { spawn } = require('child_process')
       const schedulerPath = path.join(__dirname, '..', 'agents', 'luna-scheduler.mjs')
       const child = spawn('node', [schedulerPath, '--force-scan'], {
         detached: true, stdio: 'ignore', cwd: path.join(__dirname, '..')
       })
       child.unref()
       res.json({ ok: true, message: 'Scan iniciado', pid: child.pid })
     } catch (e) {
       res.status(500).json({ ok: false, error: e.message })
     }
   })
   ```
2. Ou, alternativamente, mudar o frontend para usar `/api/luna/scan` (que JÁ EXISTE e faz a mesma coisa)

**Decisão:** Mudar frontend para chamar `/api/luna/scan` em vez de criar endpoint duplicado.

---

### ERRO #8 — Projetos Hardcoded no WhatsApp.jsx [ALTA]
**Local:** `frontend/src/pages/WhatsApp.jsx` ~linha 120

```javascript
const projectProgress = [
  { name: 'Tropicale (Juan)', progress: 85, ... },
  { name: 'Santafe (Paulo)', progress: 45, ... },
  { name: 'NEXO Dashboard', progress: 75, ... },
  { name: 'NEXO Intelligence', progress: 20, ... }
]
```

**Correção:**
1. Buscar projetos do schema: `useRealtime('/api/schema/projects', 60000)`
2. Ou buscar de `/api/nexo-state` que já retorna `data.projects`
3. Mapear projetos reais do `projects-registry.json`:
   ```javascript
   const { data: nexoState } = useRealtime('/api/nexo-state', 60000)
   const projects = nexoState?.data?.projects?.projects || []
   // Calcular progresso baseado em tasks completadas / total tasks por projeto
   ```

---

### ERRO #9 — Sem Deduplicação no Histórico [MÉDIA]
**Local:** `agents/luna-cto-agent.cjs` + `backend/data/whatsapp-history.json`

**Problema:** `whatsapp-history.json` acumula mensagens. Se agente rodar 2x o mesmo scan → mensagens duplicam.

**Correção:**
1. Em `luna-cto-agent.cjs`, antes de salvar no `whatsapp-history.json`:
   ```javascript
   function deduplicateMessages(existing, newMessages) {
     const seen = new Set((existing || []).map(m => m.id || m.timestamp + m.author))
     return [...existing, ...newMessages.filter(m => !seen.has(m.id || m.timestamp + m.author))]
   }
   ```
2. Usar `message.id` do WhatsApp Web (se disponível) ou hash de `timestamp + author + body`

---

### ERRO #10 — Sem Sincronização Global de Estado [MÉDIA]
**Local:** Todo o frontend

**Problema:** Cada página (`Dashboard`, `WhatsApp`, `Caixa`) carrega dados independentemente. Se valor muda em uma página, outra não sabe até dar refresh.

**Correção:**
1. `useRealtime` hook JÁ EXISTE e usa WebSocket. Verificar se está funcionando:
   - `Dashboard.jsx` usa `useRealtime('/api/state', 30000)` ✓
   - `Dashboard.jsx` usa `useRealtime('/api/finance/summary', 30000)` ✓
   - `Dashboard.jsx` usa `useRealtime('/api/cash-box', 30000)` ✓
   - `Dashboard.jsx` usa `useRealtime('/api/whatsapp-agent', 60000)` ✓
2. **Problema real:** O hook `useRealtime` faz polling HTTP, NÃO WebSocket real. WebSocket só broadcasta do backend, mas frontend não escuta WebSocket para atualização push.
3. Corrigir `useRealtime` para também escutar WebSocket `wss://localhost:3456`:
   ```javascript
   // Em useRealtime.js, adicionar:
   useEffect(() => {
     const ws = new WebSocket(`ws://${window.location.host}`)
     ws.onmessage = (event) => {
       const msg = JSON.parse(event.data)
       if (msg.type === 'cashbox' || msg.type === 'payments' || msg.type === 'expenses') {
         // Invalidar cache e refetch
         mutate(url)
       }
     }
     return () => ws.close()
   }, [url])
   ```

---

## 🎯 ORDEM DE EXECUÇÃO (OBRIGATÓRIA)

### FASE 1: Backend — Consolidação Financeira (1 arquivo)
**Arquivo:** `backend/server.js`
1. Localizar a SEGUNDA definição de `app.get('/api/finance/summary', ...)` (a que lê `TRANSACTIONS_FILE`)
2. APAGAR essa segunda definição inteira (de `app.get('/api/finance/summary'` até a próxima linha em branco antes do comentário `=== CRON JOBS ===`)
3. Na PRIMEIRA definição (a completa), adicionar ao objeto `summary` retornado:
   ```javascript
   transactionCount: (readJSON(TRANSACTIONS_FILE) || []).length,
   totalTransactions: parseFloat((readJSON(TRANSACTIONS_FILE) || []).reduce((s, t) => s + t.amount, 0).toFixed(2))
   ```
4. Modificar `/api/whatsapp-agent` para normalizar dados do `luna-buffer.json`:
   ```javascript
   app.get('/api/whatsapp-agent', (req, res) => {
     const agentRaw = readJSON(AGENT_DATA_FILE)
     const bufferPath = path.join(__dirname, '..', 'agents', 'luna-buffer.json')
     const buffer = fs.existsSync(bufferPath) ? JSON.parse(fs.readFileSync(bufferPath, 'utf8')) : { messages: [], tasks: [], ideas: [] }

     // Normalizar messages para ter authorName
     const normalizedMessages = (buffer.messages || []).map(m => ({
       ...m,
       authorName: m.authorName || m.author || 'Desconocido',
       text: m.body || m.text || m.message || '(sin texto)',
       timestamp: m.timestamp || m.time || new Date().toISOString()
     }))

     const stats = {
       totalMessages: normalizedMessages.length,
       totalTasks: (buffer.tasks || []).length,
       totalIdeas: (buffer.ideas || []).length,
       totalDecisions: (buffer.decisions || []).length,
       totalLinks: (buffer.links || []).length,
       totalMentions: (buffer.mentions || []).length,
       participants: [...new Set(normalizedMessages.map(m => m.authorName).filter(Boolean))],
       lastUpdate: buffer.lastUpdated || new Date().toISOString()
     }

     res.json({
       ...agentRaw,
       stats,
       messages: normalizedMessages,
       tasks: buffer.tasks || [],
       ideas: buffer.ideas || [],
       decisions: buffer.decisions || [],
       links: buffer.links || [],
       mentions: buffer.mentions || [],
       updatedAt: new Date().toISOString()
     })
   })
   ```
5. Adicionar endpoint `/api/scan-now` (ou documentar que frontend deve usar `/api/luna/scan`)
6. Testar: `curl http://localhost:3456/api/finance/summary` → deve retornar `totalExpected`, `totalReceived`, `totalPending`
7. Testar: `curl http://localhost:3456/api/whatsapp-agent` → deve retornar `stats.totalMessages` com valor real
8. Commit + push

### FASE 2: Frontend Dashboard — Remover Hardcoded (1 arquivo)
**Arquivo:** `frontend/src/pages/Dashboard.jsx`
1. Localizar as linhas com `|| 5850`, `|| 175`, `|| 5675`
2. Substituir por `?? 0`:
   ```javascript
   const totalExpected = summary.totalExpected ?? 0
   const totalReceived = summary.totalReceived ?? 0
   const totalPending = summary.totalPending ?? 0
   const cashBalance = summary.cashBoxBalance ?? cashBox.balance?.value ?? 0
   const monthlyExpenses = summary.monthlyExpenses ?? cashBox.monthlyExpenses?.value ?? 0
   ```
3. Adicionar fetch de WhatsApp para Atividade Recente:
   ```javascript
   const { data: whatsappData } = useRealtime('/api/whatsapp', 30000)
   const recentMessages = (whatsappData?.messages || []).slice(-5).reverse()
   ```
4. Substituir a seção "Atividade Recente" fake por:
   ```jsx
   <div className="recent-activity">
     <h3>Actividad Reciente</h3>
     {recentMessages.length === 0 && <p>Sin actividad reciente</p>}
     {recentMessages.map((msg, i) => (
       <div key={i} className="activity-item">
         <span className="activity-author">{msg.authorName || msg.author || 'Desconocido'}</span>
         <span className="activity-text">{msg.text || msg.body || '(sin texto)'}</span>
         <span className="activity-time">{new Date(msg.timestamp).toLocaleTimeString('pt-BR')}</span>
       </div>
     ))}
   </div>
   ```
5. Corrigir botão "Forçar Scan" para chamar `/api/luna/scan`:
   ```javascript
   const handleForceScan = async () => {
     await axios.post('/api/luna/scan')
     notify('Scan iniciado', { body: 'Luna está escaneando WhatsApp' })
   }
   ```
6. Testar visualmente: Dashboard deve mostrar €0.00 quando não há dados (não 5850)
7. Commit + push

### FASE 3: Frontend WhatsApp — Usar Dados Reais (1 arquivo)
**Arquivo:** `frontend/src/pages/WhatsApp.jsx`
1. Modificar `fetchData` para usar `/api/whatsapp-agent` (que agora retorna dados normalizados)
2. Garantir que `normalizeAgentData` use `messages` (não `newMessages`)
3. Substituir `projectProgress` hardcoded por:
   ```javascript
   const { data: nexoState } = useRealtime('/api/nexo-state', 60000)
   const realProjects = nexoState?.data?.projects?.projects || []
   // Mapear para o formato esperado pelo componente
   const projects = realProjects.map(p => ({
     name: p.name,
     progress: p.progress || Math.round((p.tasksCompleted / Math.max(p.tasksTotal, 1)) * 100),
     status: p.status || 'active',
     type: p.type || 'client'
   }))
   ```
4. Se `realProjects` estiver vazio, mostrar mensagem "No hay proyectos configurados" em vez de dados fake
5. Testar visualmente: WhatsApp.jsx deve mostrar mensagens reais com `authorName`
6. Commit + push

### FASE 4: Agente Luna — Deduplicação (1 arquivo)
**Arquivo:** `agents/luna-cto-agent.cjs`
1. Localizar onde salva `whatsapp-history.json`
2. Antes do `writeJSON`, adicionar deduplicação:
   ```javascript
   function deduplicateById(existing, incoming) {
     const map = new Map()
     ;(existing || []).forEach(m => map.set(m.id || m.timestamp + m.author, m))
     ;(incoming || []).forEach(m => {
       const key = m.id || m.timestamp + m.author
       if (!map.has(key)) map.set(key, m)
     })
     return Array.from(map.values())
   }
   ```
3. Commit + push

### FASE 5: Migração de IDs (1 arquivo, executar 1x)
**Arquivo:** `backend/migrate-task-ids.js` (novo)
1. Criar script que lê `tasks.json`, converte IDs numéricos para strings, salva
2. Executar: `node backend/migrate-task-ids.js`
3. Verificar: `cat backend/data/tasks.json | head -20` → todos IDs devem ser strings
4. Commit + push

### FASE 6: WebSocket Sync (1 arquivo)
**Arquivo:** `frontend/src/hooks/useRealtime.js`
1. Adicionar listener WebSocket para invalidar SWR cache quando backend broadcasta:
   ```javascript
   useEffect(() => {
     const ws = new WebSocket(`ws://${window.location.host}`)
     ws.onmessage = (event) => {
       try {
         const msg = JSON.parse(event.data)
         if (['cashbox', 'payments', 'expenses', 'tasks', 'quotes'].includes(msg.type)) {
           mutate(url) // Força refetch
         }
       } catch {}
     }
     return () => ws.close()
   }, [url])
   ```
2. Commit + push

---

## ✅ CHECKLIST DE VERIFICAÇÃO FINAL

Após cada fase, executar:

```powershell
# Testar APIs
Invoke-RestMethod -Uri "http://localhost:3456/api/finance/summary" | Select-Object totalExpected, totalReceived, totalPending, cashBoxBalance
Invoke-RestMethod -Uri "http://localhost:3456/api/whatsapp-agent" | Select-Object @{N='totalMessages';E={$_.stats.totalMessages}}, @{N='hasMessages';E={$_.messages.length -gt 0}}
Invoke-RestMethod -Uri "http://localhost:3456/api/whatsapp" | Select-Object totalMessages
Invoke-RestMethod -Uri "http://localhost:3456/api/nexo-state" | Select-Object success

# Verificar arquivos
Get-Content "backend/data/tasks.json" | ConvertFrom-Json | Select-Object -First 3 | Select-Object id, @{N='idType';E={$_.id.GetType().Name}}
Get-Content "backend/data/whatsapp-history.json" | ConvertFrom-Json | Select-Object -ExpandProperty messages | Measure-Object

# Testar frontend
# Abrir http://localhost:3457 → Dashboard deve mostrar:
# - Caixa Atual: €0.00 (ou valor real, nunca 5850/175/5675 hardcoded)
# - WhatsApp Intelligence: números reais do luna-buffer
# - Actividad Reciente: mensagens reais com nombres
```

---

## 🚫 REGRAS ABSOLUTAS (VIOLAR = ROLLBACK)

1. **NUNCA reescrever arquivo inteiro** — usar patches cirúrgicos (apply_patch)
2. **NUNCA apagar código que funciona** — só adicionar/modificar
3. **NUNCA criar código genérico** — basear-se nos schemas reais do projeto
4. **NUNCA atribuir tarefas/decisões** — só os 3 CEOs têm poder hierárquico
5. **SEMPRE valide cruzado** com os 7 schemas antes de entregar
6. **SEMPRE teste** após cada modificação — 1 problema por vez
7. **SEMPRE commit + push** após cada fase funcionando
8. **Idioma UI: Espanhol** (labels, botões, textos)
9. **Código/variáveis: Inglês** (TypeScript, nomes de funções)
10. **Um arquivo por vez** — revisão brutal (5x) antes de próximo

---

## 📞 CONTATO EMERGÊNCIA

Se algo quebrar:
1. `git stash` ou restaurar do backup
2. Verificar `backend/server.js` roda sem erros: `node backend/server.js`
3. Verificar frontend compila: `cd frontend && npm run build`
4. Chamar Abner no WhatsApp: +34 685 093 192

---

*Prompt Master gerado por Kimi K2.6 após análise cirúrgica do código-fonte*
*Data: 2026-05-06 | Status: VALIDADO contra GitHub (Jhin1v9/NexoDashboard)*
*Método: Leitura direta de raw files + comparação cruzada com relatório do agente*
