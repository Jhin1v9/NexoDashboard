# 🔄 HANDOFF — Próximas Ações Pendentes

> **Regra de ouro:** SEMPRE leia este arquivo no início de uma nova sessão. Ele contém o estado de trabalho que não cabe no KIMI.MD.
> 
> **Sessão ativa:** `kimi-568adf4a` 🟢 — última atualização: 2026-05-23 04:15
> 
> **Último commit:** `45ee23a` — `feat(ideas): migrate ideas to PostgreSQL + 5 tests`

---

## 🎯 Foco Atual (Fase 0.1 — Migração PostgreSQL 🟡 EM ANDAMENTO)

### ✅ Concluído nesta sessão (Modo YOLO — Parte 1, 2 e 3 COMPLETAS)
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
- [x] **Entidade `security_logs` migrada:** 4 rotas + logSecurityEvent + sendSecurityWhatsAlert, 14 events no PG. Settings/lastNotifiedAt mantidos em `security-settings.json` (JSON separado)
- [x] **Testes:** 51/51 passando (`users: 3, tasks: 4, payments: 5, expenses: 5, cash-box: 4, quotes: 5, leads: 5, notifications: 5, company-tasks: 5, links: 5, security-logs: 5`)
- [x] **Dependências:** Zod, Jest, Supertest, TypeScript, ts-node, @types/* instalados
- [x] **tsconfig.json:** Strict mode ativado
- [x] **ollama-client.js:** Restaurado para `backend/services/` (required by server.js)

### ⏳ Próximos passos (uma entidade por vez)

**🔴 PRÓXIMA ENTIDADE:**
- [ ] **Fase 0.1 COMPLETA** — Todas as 19 entidades migradas ✅

**🟡 PENDENTES DEPOIS:**
- [ ] `security_settings` — ainda em JSON (settings de segurança, não é dado)
- [ ] `luna_buffer` — templates/categories ainda em JSON separado (híbrido aceitável)
- [ ] `ideas` — templates/categories ainda em JSON separado (híbrido aceitável)
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
| **Fase 0.1 atual** | `backend/server.js`, `datastore-pg.js`, `migrations/` | PostgreSQL agora é source of truth para 11 entidades |

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
backend/__tests__/security-logs.test.js                 # 5 testes
backend/jest.config.js                              # Config Jest
backend/tsconfig.json                               # TypeScript strict mode
```

---

## 📝 Notas da instância

**Instância:** `kimi-10a71fc7` 🟡  
**Commit atual:** `7382586` — `feat(links): migrate links to PostgreSQL + 5 tests`
**Commit atual (security_logs):** `86e0887` — `feat(security-logs): migrate security_logs to PostgreSQL + 5 tests`  
**Build:** ✅ Vite build passando (0 erros)  
**Testes:** ✅ 51/51 passando  
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
> 1. **Estado atual:** 19/19 entidades migradas (100%). Fase 0.1 COMPLETA.
> 2. **Próxima entidade:** Fase 0.2 — correção de bugs documentados
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

---

## 🔄 Sessão Paralela — Luna NLU + Email Modal (Fase 1)

> **Instância:** `kimi-atual` 🟡 — trabalhando em paralelo com a migração PG
> **Foco:** Correção do IntentParser + Fase 1 do plano `luna-viva-roadmap.md`

### ✅ Concluído nesta sessão (NLU/IntentParser)
- [x] **IntentParser.js corrigido:** Regex de 29.4% → 96% acerto (24/24 testes)
- [x] **Patterns adicionados:** `send_email`, `reply_email`, `social_knowledge`, `idea`, `check_stack`, `list_projects`, `list_ideas`, etc.
- [x] **Patterns corrigidos:** `task` (não captura mais "apagar tarefa"), `query_email` (não captura "enviar email"), `query_finance` (não confunde "caixa de entrada"), `status` (não captura "status do sistema")
- [x] **Ollama fallback:** `llmParse()` agora chama Ollama (gemma3:1b) ANTES de Gemini (revogado)
- [x] **OllamaClient.classifyIntent:** Prompt melhorado com `social`, parser JSON mais robusto
- [x] **server.js:** `lunaOllama` usa `gemma3:1b` como padrão (mais rápido, metade da RAM)

### ✅ COMPLETO — Fase 1: Email Modal (REVISADO — 100% testes passando)
- [x] **EmailCompose.jsx:** Adicionadas props `initialTo`, `initialSubject`
- [x] **EmailHub.jsx:** Lê query params `?compose=1&to=...&subject=...` e abre compose preenchido
- [x] **LunaFloatingButton.jsx:** Fast path + fallback navegam para `/email?compose=1&...` quando intent for `enviar_email`
- [x] **Teste IntentParser:** 28/28 testes = 100% acerto
- [x] **Teste end-to-end:** "enviar email para joao sobre orcamento" → detecta `enviar_email` → navega para `/email?compose=1&to=joao&subject=orcamento` → abre EmailCompose preenchido ✅

### 🚧 EM ANDAMENTO — Fase 2: Chat Reformulado
- [x] **LunaChatPanel.jsx revivido:** Integrado no `LunaFloatingButton.jsx` — clique no FAB agora abre chat panel (420px slide-in) em vez do input inline feio
- [x] **Navegação de email no chat:** `LunaChatPanel.sendChatMessage()` também detecta `enviar_email`/`responder_email`/`consultar_emails` e navega para `/email?compose=1&...`
- [ ] **Testar WebSocket:** Verificar se `/ws` está funcionando no backend (dev local pode ter problemas)
- [ ] **Testar threads:** Verificar se `GET /api/luna/threads` retorna threads grupo/privado
- [ ] **Limpar código morto:** Remover estados/refs do FAB que eram usados pelo input inline removido
- [ ] **Remover badge "Gemini":** O chat panel ainda mostra badge "Gemini" no header — trocar para "Ollama" ou remover
- [ ] **Animação "respirando":** Adicionar pulso sutil no FAB quando há notificações pendentes
- [x] **EmailCompose.jsx:** Adicionadas props `initialTo`, `initialSubject`
- [x] **EmailHub.jsx:** Lê query params `?compose=1&to=...&subject=...` e abre compose preenchido
- [x] **LunaFloatingButton.jsx:** Fast path + fallback navegam para `/email?compose=1&...` quando intent for `enviar_email`
- [x] **Teste IntentParser:** 28/28 testes = 100% acerto
- [x] **Teste end-to-end:** "enviar email para joao sobre orcamento" → detecta `enviar_email` → navega para `/email?compose=1&to=joao&subject=orcamento` → abre EmailCompose preenchido ✅

> ⚠️ **ALERTA CRÍTICO:** Arquivos frontend foram revertidos 2x durante esta sessão (provavelmente pela outra instância Kimi trabalhando em paralelo na migração PG). Sempre verificar se as muduras persistem após edição.

### 🛡️ O QUE NÃO MUDAR (protegido nesta sessão)

| Arquivo | O que não mudar | Por quê |
|---|---|---|
| `agents/core/IntentParser.js` | **Regex patterns** (linhas 66-340 aprox) | Acabou de ser calibrado para 96% acerto. Qualquer mudança no regex pode quebrar a classificação. |
| `agents/core/IntentParser.js` | **`llmParse()`, `callOllama()`, `parseOllamaResponse()`** (linhas 372-420) | Ollama fallback funciona. Não trocar por Gemini. |
| `backend/services/ollama-client.js` | **`classifyIntent()` systemPrompt** (linhas 139-174) | Prompt calibrado para distinguir `social` de ações de negócio. |
| `backend/services/ollama-client.js` | **JSON parser robusto** (linhas 160-202) | Extrai JSON válido mesmo quando modelo retorna markdown. |
| `backend/server.js` | **`lunaOllama` config** (linha 51) | `intentModel: 'gemma3:1b'` é o modelo certo para o hardware (5.7GB RAM). |
| `frontend/src/components/email/EmailCompose.jsx` | **Props interface** (`initialTo`, `initialSubject`) | Usado pelo EmailHub para preenchimento via URL params. |
| `frontend/src/pages/EmailHub.jsx` | **Query params handler** (novo useEffect com `useSearchParams`) | Abre compose automaticamente via `?compose=1&to=...&subject=...`. |

### ⚠️ Instruções para a outra Kimi

1. **Se for trabalhar em `agents/core/IntentParser.js`:** NÃO modifique os regex patterns sem rodar o teste massivo primeiro. Use o script de teste:
   ```bash
   cd backend && node -e "const {IntentParser}=require('../agents/core/IntentParser.js'); const p=new IntentParser({genAI:null,ollama:null}); /* testes */"
   ```

2. **Se for trabalhar em `backend/server.js`:** Mantenha `lunaOllama = new OllamaClient({ timeout: 60000, intentModel: 'gemma3:1b', chatModel: 'gemma3:1b' })`. Não volte para `gemma2:2b` (mais lento, mesma RAM).

3. **Se for trabalhar no frontend Luna:** O `LunaFloatingButton.jsx` está sendo modificado nesta sessão para suportar navegação para `/email?compose=1`. Coordenar antes de fazer mudanças grandes no FAB.

4. **Gemini está REVOGADO:** `genAI` é `null`. Não tentar reativar. Ollama (local) é o único LLM funcional.

**⚠️ Atenção:** `backend/workspace/` foi adicionado ao `.gitignore` — NÃO commitar dados de runtime.


---

## 🌙 Relatório Noturno — Fase 0.1

**Parte 1, 2 e 3 concluídas.**

### Entidades migradas nesta sessão (9 entidades):
1. `security_logs` — 14 events → commit `86e0887`
2. `changelog` — 31 entries → commit `f4662d5`
3. `whatsapp_history` — 1.171 messages → commit `fc42cc5`
4. `luna_threads` — 4 threads → commit `b0ec0bc`
5. `luna_buffer` — 1 row → commit `74457de`
6. `workspace_clients` — 2 clients → commit `65c8410`
7. `members` — 0 members → commit `91643e5`
8. `transactions` — 0 transactions → commit `20981db`
9. `ideas` — 7 ideas → commit `45ee23a`

### Entidades já migradas em sessões anteriores (10 entidades):
- `users`, `tasks`, `payments`, `expenses`, `cash_box`, `quotes`, `leads`, `notifications`, `company_tasks`, `links`

### Testes passando: 90/90 (19 suites)
- Tempos variam de 4s a 17s por suite (whatsapp_history é a mais lenta)
- Zero regressões em entidades anteriores

### Commits locais (não pushados):
```
45ee23a feat(ideas): migrate ideas to PostgreSQL + 5 tests
20981db feat(transactions): migrate transactions to PostgreSQL + 5 tests
91643e5 feat(members): migrate members to PostgreSQL + 5 tests
65c8410 feat(workspace_clients): migrate workspace_clients to PostgreSQL + 5 tests
74457de feat(luna_buffer): migrate luna_buffer to PostgreSQL + 4 tests
b0ec0bc feat(luna_threads): migrate luna_threads to PostgreSQL + 5 tests
fc42cc5 feat(whatsapp_history): migrate whatsapp_history to PostgreSQL + 5 tests
f4662d5 feat(changelog): migrate changelog to PostgreSQL + 5 tests
86e0887 feat(security-logs): migrate security_logs to PostgreSQL + 5 tests + fix lunaOllama.preload guard
```

### Notas técnicas:
- `ideas` usa híbrido PG+JSON: ideas em PG, templates/categories em JSON (arquitetura aceitável)
- `luna_buffer` usa híbrido PG+JSON: buffer em PG, templates/categories em JSON
- `workspace_manager.js` foi modificado para usar datastore-pg para índice de clientes
- `workspace_manager.js` mantém filesystem para pastas/arquivos (esperado)
- `routes/ideas.js` usa `loadIdeasData()`/`saveIdeasData()` para hibridização

### Próxima fase: Fase 0.2 — Correção de bugs documentados
Ver seção "Bugs Observados" acima.

**Aguardando autorização para push de todos os commits.**
