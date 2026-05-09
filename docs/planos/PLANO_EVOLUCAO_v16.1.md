# PLANO DE EVOLUÇÃO EXTRAORDINÁRIO — NEXO Dashboard Pro v16.1

**Data:** 2026-05-08  
**Arquiteto:** NEXO CHIEF ENGINEER (Kimi Code CLI)  
**Cliente:** Abner — NEXO Digital S.L.  
**Status:** Aprovado para execução imediata

---

## 🎯 FILOSOFIA

> Não consertamos. **Evoluímos.**  
> Não reconstruímos. **Fortalecemos os alicerces.**  
> Cada linha de código afeta EUR real, usuários reais (Abner, Nonoke, Elias) e decisões reais às 3h da manhã.

**Regras de ouro:**
1. Um arquivo por vez. Revisão brutal (5x) antes de próximo.
2. NUNCA quebrar API existente — backward compatibility é sagrada.
3. NUNCA reescrever arquivo inteiro — patches cirúrgicos.
4. Sempre testar antes de declarar "done".
5. Produção estável > features > refactoring.

---

## 📊 DIAGNÓSTICO RESUMIDO

| Sistema | Saúde | Problema Crítico |
|---------|-------|------------------|
| Backend | 🟡 | `/api/finance/summary` duplicada (rota ruim sobrescreve boa); `updateCashBoxFromTransactions()` destrói histórico; `loadSchema()` sem BOM-safe |
| Agente | 🟡 | `luna-buffer.json` esvazia mensagens para histórico; autor "Desconhecido" em todo histórico |
| Frontend | 🔴 | WhatsApp vazio (consome buffer, não history); badge prioridade hardcoded; Links sem preview |
| Dados | 🟢 | `whatsapp-history.json` tem 7345 mensagens reais; `contacts-map.json` rico; `cash-box.json` matematicamente correto |

---

## 🗺️ ROADMAP DE 6 FASES

### FASE 0 — HOTFIXES CRÍTICOS (30 min)
**Objetivo:** Parar o sangramento. Dashboard mostra dados errados.

| # | Ação | Arquivo | Linha | Risco |
|---|------|---------|-------|-------|
| 0.1 | **Remover rota `/api/finance/summary` duplicada** | `server.js` | 1856 | Médio — pode afetar `Financeiro.jsx` se depende do formato simplista |
| 0.2 | **Trocar `loadSchema()`/`loadConfig()` para `readJSON()`** | `server.js` | 51-71 | Baixo — `readJSON` já é BOM-safe, sem breaking change |
| 0.3 | **Dashboard WhatsApp card = usar histórico** | `Dashboard.jsx` | — | Baixo — apenas mudar fonte de dados do card |

**Validação:**
- `curl http://localhost:3456/api/finance/summary` → retorna `totalPending`, `alerts`, `overduePayments`
- `curl http://localhost:3456/api/schema/contacts` → retorna dados mesmo com BOM no arquivo
- Dashboard mostra WhatsApp > 0

---

### FASE 1 — WHATSAPP FRONTEND v1.1 (1h)
**Objetivo:** Tab WhatsApp funcional e útil.

| # | Ação | Arquivo | Detalhe |
|---|------|---------|---------|
| 1.1 | **Consumir `/api/whatsapp/history` como fonte primária** | `WhatsApp.jsx` | Merge buffer (novidades) + history (base). Se buffer vazio, mostrar history |
| 1.2 | **Corrigir badge de prioridade** | `WhatsApp.jsx` | Suportar `low`/`medium`/`high` com cores distintas |
| 1.3 | **Fallback de autor vazio** | `WhatsApp.jsx` | Se "Desconhecido", mostrar avatar com "?" e não crashar |
| 1.4 | **Links Recentes na Overview** | `WhatsApp.jsx` | Usar `LinkHub` mini (últimos 3 links com preview) |

**Arquitetura da merge Buffer + History:**
```
messages = [
  ...bufferMessages.filter(m => m.isNew),  // novidades do último scan
  ...historyMessages.slice(0, 50)          // base persistente
]
// Deduplicar por ID
```

---

### FASE 2 — RESOLUÇÃO DE AUTOR v2.0 (1h)
**Objetivo:** Nunca mais "Desconhecido".

| # | Ação | Arquivo | Detalhe |
|---|------|---------|---------|
| 2.1 | **Backend: `resolveAuthor()` robusto** | `server.js` | Usar `contacts-map.json`. Match exato → parcial (últimos 8 dígitos) → fallback `authorName`/`pushName` |
| 2.2 | **Aplicar `resolveAuthor()` em `/api/whatsapp/history`** | `server.js` | Cada mensagem retorna `resolvedAuthor: { name, color, avatar, role }` |
| 2.3 | **Frontend: `MessageBubble` com avatar/cor** | `WhatsApp.jsx` | Usar `resolvedAuthor.color` para borda/avatar; `resolvedAuthor.name` em vez de `sender` |
| 2.4 | **Frontend: `TaskItem` com autor resolvido** | `WhatsApp.jsx` | Mesma lógica para tarefas |

**Schema do resolvedAuthor:**
```json
{
  "name": "Abner",
  "shortName": "Abner",
  "role": "CEO & Co-Founder",
  "color": "#3742fa",
  "avatar": null,
  "avatarEmoji": "🧠",
  "phone": "34685093192"
}
```

---

### FASE 3 — LINK HUB v2.0 (1.5h — já iniciado)
**Objetivo:** Links transformados em inteligência, não lixo.

| # | Ação | Status | Detalhe |
|---|------|--------|---------|
| 3.1 | **Serviço `url-classifier.js`** | ✅ DONE | Classifica URL em plataforma/cor/ícone |
| 3.2 | **Serviço `link-preview.js` (cheerio + cache)** | ✅ DONE | Fetch OGP com cache 24h, fallback elegante |
| 3.3 | **Endpoints `/api/links/*`** | ✅ DONE | CRUD + sync + enrich + preview individual |
| 3.4 | **Seed `links-index.json` do buffer** | ✅ DONE | 45 links migrados do `luna-buffer.json` |
| 3.5 | **Componente `LinkHub.jsx`** | ✅ DONE | Grid/list, filtros, busca, grupos colapsáveis |
| 3.6 | **Integração na tab Links do WhatsApp** | ✅ DONE | `<LinkHub />` renderizado na tab |
| 3.7 | **Enriquecimento assíncrono em background** | 🔄 PENDENTE | Não bloquear request com 45 fetches. Usar async queue ou lazy loading |
| 3.8 | **Dedup por URL** | 🔄 PENDENTE | Garantir que sync não crie duplicatas |

**Próximo passo crítico:** O endpoint `GET /api/links` com `enriched=true` faz `await fetchLinkPreview()` para até 10 links em série. Isso pode demorar 5-10s e bloquear o event loop.  
**Solução extraordinária:** Lazy enrichment. Retornar links imediatamente (com classificação), e enriquecer preview via `Promise.allSettled()` em background, atualizando o index depois.

---

### FASE 4 — PROTEÇÃO DO CASH BOX (45 min)
**Objetivo:** Histórico financeiro é imutável.

| # | Ação | Arquivo | Detalhe |
|---|------|---------|---------|
| 4.1 | **Fix `updateCashBoxFromTransactions()`** | `server.js` | NUNCA recriar `history`. Apenas: `cashBox.balance.value = novoSaldo` + `cashBox.lastUpdated = now` |
| 4.2 | **Separar histórico automático vs manual** | `server.js` | Adicionar `historyAuto` (derivado de transactions) e manter `history` (tudo: manual + payments + expenses) |
| 4.3 | **Endpoint `POST /api/cash-box/reconcile`** | `server.js` | Recalcula saldo a partir do histórico completo e ajusta `balance.value` se houver drift |

**Princípio:** O `cash-box.json` é a **fonte da verdade**. `transactions.json`, `payments.json`, `expenses.json` são **fontes de entrada**. Nunca uma fonte de entrada pode sobrescrever a fonte da verdade.

---

### FASE 5 — CRUD CAIXA v2.0 (2h)
**Objetivo:** Controle total sem destruir automação.

| # | Ação | Arquivo | Detalhe |
|---|------|---------|---------|
| 5.1 | **Endpoint `POST /api/cash-box/entries`** | `server.js` | Criar entrada manual. Campos: `type` (income/expense/adjustment), `amount`, `description`, `category`, `date` |
| 5.2 | **Endpoint `PUT /api/cash-box/entries/:id`** | `server.js` | Editar entrada. Se `amount`/`type` mudar, recalcular saldo desde o início do histórico |
| 5.3 | **Endpoint `DELETE /api/cash-box/entries/:id`** | `server.js` | Soft delete: `deletedAt` + `isActive: false`. NUNCA remover do array |
| 5.4 | **Endpoint `GET /api/cash-box/entries/:id`** | `server.js` | Ler uma entrada |
| 5.5 | **Frontend: Modal `CashBoxEntryModal.jsx`** | `frontend/src/components/finance/` | Form para criar/editar entrada |
| 5.6 | **Frontend: Tabela no `Caixa.jsx`** | `Caixa.jsx` | Listar entradas com filtros (tipo, categoria, data). Botão editar/deletar |
| 5.7 | **Audit trail mínimo** | `server.js` | Cada POST/PUT/DELETE gera entry em `cashBox.auditLog` |

**Contrato API preservado:**
- `GET /api/cash-box` → continua funcionando igual
- `POST /api/cash-box/adjust` → continua funcionando igual
- `GET /api/cash-box/history` → agora inclui entradas manuais + automáticas

---

### FASE 6 — POLISH EXTRAORDINÁRIO (1h)
**Objetivo:** Dashboard que parece produto, não protótipo.

| # | Ação | Arquivo | Detalhe |
|---|------|---------|---------|
| 6.1 | **Ativar `ToastContext`** | `main.jsx` | Envolver `<App />` com `<ToastProvider>`. Usar toasts para ações (salvo, deletado, erro) |
| 6.2 | **Ativar `MobileBottomNav`** | `App.jsx` | Importar e renderizar em mobile (`sm:hidden`) |
| 6.3 | **Alertas no Dashboard** | `Dashboard.jsx` | Consumir `/api/finance/summary` → `alerts` e mostrar banner scrollable |
| 6.4 | **Atividade Recente com contexto** | `Dashboard.jsx` | Usar `whatsapp-history.json` (últimas 5 mensagens com autor resolvido + categoria) |
| 6.5 | **Keyboard shortcuts** | `App.jsx` | `Ctrl+K` já abre CommandPalette. Adicionar `/` para focar busca no LinkHub |
| 6.6 | **Atualizar `AGENTS.md`** | `AGENTS.md` | Documentar todas as mudanças, APIs novas, estrutura de dados atualizada |

---

## 🛡️ ARQUITETURA DE QUALIDADE

### 1. Async Queue para Enriquecimento
```javascript
// NUNCA fazer await fetchLinkPreview() dentro de loop síncrono em rota HTTP
// CORRETO:
res.json({ success: true, links: linksComClassificacao }); // retorna imediatamente
// Em background:
Promise.allSettled(linksParaEnriquecer.map(l => fetchLinkPreview(l.url)))
  .then(results => { /* salva no index */ });
```

### 2. BOM-Safe em TODOS os loaders
```javascript
// ANTES (crashava com BOM):
JSON.parse(fs.readFileSync(file, 'utf8'));
// DEPOIS (sempre seguro):
readJSON(file); // já remove BOM
```

### 3. Fallbacks em Cascata
```
resolveAuthor(msg):
  1. Match exato no contacts-map.json
  2. Match parcial (últimos 8 dígitos)
  3. msg.authorName (do buffer)
  4. msg.pushName (do WhatsApp)
  5. "Desconhecido" com cor cinza neutra
```

### 4. WebSocket Broadcast Pattern
```javascript
// Toda mutação de dados:
writeJSON(FILE, data);
broadcast({ type: 'entity:action', data });
// Nunca broadcast antes de writeJSON
```

---

## ✅ CHECKLIST DE ENTREGA POR FASE

### Antes de declarar fase concluída:
- [ ] Código passa em `node -c` (backend) e `npx vite build` (frontend)
- [ ] APIs testadas com `curl` — retornam `{ success: true, ... }`
- [ ] WebSocket broadcast chamado após toda mutação
- [ ] Nenhum `console.log` residual (apenas `console.error` para erros)
- [ ] Nenhuma rota existente quebrada
- [ ] AGENTS.md atualizado

---

## ⏱️ ESTIMATIVA TOTAL

| Fase | Tempo | Dependências |
|------|-------|--------------|
| 0 — Hotfixes | 30 min | Nenhuma |
| 1 — WhatsApp Frontend | 1h | Fase 0 |
| 2 — Resolução de Autor | 1h | Fase 1 |
| 3 — Link Hub v2.0 | 1h (resto) | Fase 0 |
| 4 — Proteção Cash Box | 45 min | Fase 0 |
| 5 — CRUD Caixa | 2h | Fase 4 |
| 6 — Polish | 1h | Todas |
| **TOTAL** | **~7.5h** | — |

---

## 🚀 INÍCIO DA EXECUÇÃO

**Fase atual:** FASE 0 — Hotfixes Críticos  
**Próximo commit message:** `hotfix(v16.1): remove duplicate finance/summary, BOM-safe schemas, dashboard WhatsApp count from history`

---

*Plano gerado por NEXO CHIEF ENGINEER*  
*Status: Aprovado para execução imediata*  
*Data: 2026-05-08*
