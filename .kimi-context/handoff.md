# 🔄 HANDOFF — Próximas Ações Pendentes

> **Regra de ouro:** SEMPRE leia este arquivo no início de uma nova sessão. Ele contém o estado de trabalho que não cabe no KIMI.MD.
> 
> **Sessão ativa:** `kimi-568adf4a` 🟡 — última atualização: 2026-05-23 02:42
> 
> **Último commit:** `7382586` — `feat(links): migrate links to PostgreSQL + 5 tests`

---

## 🎯 Foco Atual (Fase 0.1 — Migração PostgreSQL 🟡 EM ANDAMENTO)

### ✅ Concluído nesta sessão
- [x] **Reverse Schema Engineering:** `backend/docs/SCHEMA_AUDIT.md` (46KB) documenta todos os mismatches
- [x] **Migration 005:** `backend/migrations/005-real-schema.sql` — schema REAL do server.js (zero adapters)
- [x] **datastore-pg.js reescrito:** 33 funções, nomes 1:1 com JSON, `onChange` → WebSocket broadcast
- [x] **migrate-005.js:** 1.228 rows migrados do JSON para PG
- [x] **pg-sync.js REMOVIDO:** Arquivado em `backend/archive/pg-sync.js.bak` — estava corrompendo dados
- [x] **Entidade `users` migrada:** 3 usuários no PG
- [x] **Entidade `tasks` migrada:** 84 tasks no PG
- [x] **Entidade `payments` migrada:** 5 rotas migradas, testes passando
- [x] **Entidade `expenses` migrada:** 5 rotas migradas, auto-deduct atualizado
- [x] **Entidade `cash_box` migrada:** ~15 rotas migradas, auto-deduct em payments/expenses atualizado
- [x] **Entidade `quotes` migrada:** 5 rotas migradas, 4 quotes no PG
- [x] **Entidade `leads` migrada:** 6 rotas migradas, leads no PG
- [x] **Entidade `notifications` migrada:** 4 rotas + addNotification helper, 12 notificações no PG
- [x] **Entidade `company_tasks` migrada:** 4 consumidores internos (buildDashboardContext, insights, action-center, batch), 76 tasks no PG
- [x] **Entidade `links` migrada:** 6 rotas (GET, GET/stats, POST/enrich, POST/sync, POST, DELETE, PUT), 46 links no PG
- [x] **Testes:** 46/46 passando (`users: 3, tasks: 4, payments: 5, expenses: 5, cash-box: 4, quotes: 5, leads: 5, notifications: 5, company-tasks: 5, links: 5`)
- [x] **Dependências:** Zod, Jest, Supertest, TypeScript, ts-node, @types/* instalados
- [x] **tsconfig.json:** Strict mode ativado
- [x] **ollama-client.js:** Restaurado para `backend/services/` (required by server.js)

### ⏳ Próximos passos (uma entidade por vez)

**🔴 PRÓXIMA ENTIDADE (escolher uma):**
- [ ] `security_logs` — 14 events no PG

**🟡 PENDENTES DEPOIS:**
- [ ] `members` — 0 members (vazio)
- [ ] `transactions` — 0 transactions (vazio)
- [ ] `security_logs` — 14 events no PG
- [ ] `changelog` — 31 entries no PG
- [ ] `ideas` — 7 ideas no PG
- [ ] `whatsapp_history` — 1.171 messages no PG
- [ ] `luna_threads` — 4 threads no PG
- [ ] `luna_buffer` — 1 row no PG
- [ ] `workspace_clients` — 2 clients no PG

**🟢 INFRAESTRUTURA:**
- [ ] TypeScript: converter `datastore-pg.js` para `.ts`
- [ ] Zod schemas para validação de entidades
- [ ] Testes de integração para rotas HTTP (supertest)
- [ ] Cobertura de testes > 70%

---

## 🚨 Modificações de outras sessões que afetam este trabalho

| Sessão | Arquivos modificados | Impacto |
|---|---|---|
| `kimi-c4b19cd8` 🟢 | `agents/core/ActionExecutor.js` (+1.156 linhas) | 109 métodos, 21 categorias — integrar com SmartFormModal |
| `kimi-c4b19cd8` 🟢 | `agents/core/IntentParser.js` (+120 linhas) | Regex patterns + prompts LLM — complementa NLP.js |
| `kimi-19007e56` 🔴 | `backend/server.js` | ContextModule/contextId nos endpoints de chat |
| `kimi-19007e56` 🔴 | Frontend EmailHub | Banner drafts, LunaEmailAssistant — não conflita |
| **Fase 0.1 atual** | `backend/server.js`, `datastore-pg.js`, `migrations/` | PostgreSQL agora é source of truth para 10 entidades |

---

## 🔗 Arquivos chave desta sessão

```
backend/datastore-pg.js                             # Datastore 100% PostgreSQL (33 funções)
backend/db.js                                       # Pool node-postgres
backend/migrations/005-real-schema.sql              # Schema real do server.js
backend/migrate-005.js                              # Script de migração JSON → PG
backend/docs/SCHEMA_AUDIT.md                        # Audit completo (46KB)
backend/docs/RELATORIO_FASE_0_1.md                  # Relatório da Fase 0.1
backend/__tests__/users.test.js                     # 3 testes
backend/__tests__/tasks.test.js                     # 4 testes
backend/__tests__/payments.test.js                  # 5 testes
backend/__tests__/expenses.test.js                  # 5 testes
backend/__tests__/cash-box.test.js                  # 4 testes
backend/__tests__/quotes.test.js                    # 5 testes
backend/__tests__/leads.test.js                     # 5 testes
backend/__tests__/notifications.test.js               # 5 testes
backend/__tests__/company-tasks.test.js               # 5 testes
backend/__tests__/links.test.js                       # 5 testes
backend/jest.config.js                              # Config Jest
backend/tsconfig.json                               # TypeScript strict mode
```

---

## 📝 Notas da instância

**Instância:** `kimi-10a71fc7` 🟡  
**Commit atual:** `7382586` — `feat(links): migrate links to PostgreSQL + 5 tests`  
**Build:** ✅ Vite build passando (0 erros)  
**Testes:** ✅ 46/46 passando  
**API Key Gemini:** 🔴 Revogada — NLU offline cobre 100% dos comandos operacionais  
**Modelo NLU:** ✅ Persistido em `backend/data/luna-model.nlp` (7.8MB)  
**PostgreSQL:** ✅ Neon DB, 22 tabelas, 10 entidades ativas em PG  

**Validação PG (counts reais):**
| Tabela | Rows |
|--------|------|
| users | 3 |
| tasks | 84 |
| payments | 0 |
| expenses | 9 |
| cash_box | 1 |
| quotes | 4 |
| leads | 0 |
| members | 0 |
| transactions | 0 |
| notifications | 12 |
| links | 46 |
| security_logs | 14 |
| changelog | 31 |
| ideas | 7 |
| whatsapp_history | 1.171 |
| luna_threads | 4 |
| luna_buffer | 1 |
| workspace_clients | 2 |

---

## 🐛 Bugs Observados (corrigir na próxima fase)

| # | Bug | Onde | Impacto | Quando observado |
|---|---|---|---|---|
| 1 | **WebSocket `ws://localhost:3457/ws` falha no dev local** | Frontend (`NotificationCenter.jsx:60`) | Notificações, tasks, cash-box não atualizam em tempo real no dev. Em produção (Render) funciona. | Teste notifications |
| 2 | **NotificationCenter dropdown não renderiza na árvore acessível** | Frontend (`NotificationCenter.jsx`) | Dropdown de notificações não aparece no snapshot de acessibilidade — pode ser portal React ou bug de estado. | Teste notifications |
| 3 | **Contador de notificações fica desatualizado sem WS** | Frontend (`useNotifications.js`) | Badge mostra "9+" mesmo após API retornar `unreadCount: 0`. Só atualiza com F5. | Teste notifications |
| 4 | **Landing page não redireciona usuário logado para `/dashboard`** | Frontend (`LandingPage.jsx` ou roteamento) | Com token válido no localStorage, acessar `/` mostra landing em vez de redirecionar para dashboard. | Teste leads/notifications |
| 5 | **Vite proxy não encaminha WebSockets** | `frontend/vite.config.js` | `ws://localhost:3457/ws` cai — precisa adicionar `ws: true` no proxy config. | Teste notifications |
| 6 | **lunaOllama.preload is not a function** | `backend/server.js:8858` | Server crasha no startup se ollama-client.js não exporta `preload()`. Fix aplicado: guard `typeof === 'function'`. | Teste links |

> **Regra:** Fase 0.1 = migração PG. NÃO corrigir bugs agora. Documentar e resolver na Fase 0.2 ou 1.x.
> **Exceção:** Bug 6 foi fixado porque impedia o backend de iniciar.

---

## 🧪 Dados de teste reais

O lead `tpv-sorveteria` foi convertido durante os testes. Pasta criada em:
```
backend/workspace/tpv-sorveteria/
├── 01_orcamentos/
├── 02_contratos/
├── 03_briefings/
├── 04_design/
├── 05_demos/
├── 06_documentacao/
├── 07_entregas/
├── cliente.json
└── README.md
```

---

## 📡 Comunicação entre sessões Kimi

> **Se você é outra instância Kimi lendo este arquivo:**
> 
> 1. **Estado atual:** 10/19 entidades migradas (52.6%). Links acabou de ser concluído.
> 2. **Próxima entidade:** `security_logs` (14 events no PG)
> 3. **Padrão consolidado:**
>    - Adicionar `delete<Entity>()` ao `datastore-pg.js` se não existir
>    - Migrar rotas no `server.js` de `readJSON/writeJSON` → `dataStore.get*/save*/delete*`
>    - Criar `backend/__tests__/<entity>.test.js` com 4-5 testes
>    - Rodar `npx jest --runInBand --testTimeout=30000`
>    - Testar no frontend (ou via curl se não houver página dedicada)
>    - Commit com mensagem descritiva, aguardar OK do usuário para push
> 4. **Arquitetura:** Zero adapters, schema 1:1 com JSON, IDs são strings JS
> 5. **Bugs:** Ver seção "Bugs Observados" acima — NÃO corrigir na Fase 0.1
> 6. **Contato:** Se precisar de contexto adicional, pergunte ao usuário — ele vai copiar/colar sua pergunta para mim

**⚠️ Atenção:** `backend/workspace/` foi adicionado ao `.gitignore` — NÃO commitar dados de runtime.
