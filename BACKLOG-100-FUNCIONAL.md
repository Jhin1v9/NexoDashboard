# 🎯 BACKLOG — Dashboard NEXO 100% Funcional

> **Data:** 2026-05-24  
> **Última atualização:** Consolidação de todos os planos, bugs e tarefas pendentes  
> **Objetivo:** Deixar o dashboard estável e 100% funcional **antes** de adicionar novas features.

---

## 📊 Estado Geral

| Área | Status |
|---|---|
| Backend APIs (diretas) | ✅ ~95% funcional — 150+ endpoints operacionais |
| Banco de Dados (Neon PG) | ✅ 22 tabelas, dados preservados |
| Frontend Build | ✅ Compila sem erros |
| Testes Jest | ✅ 90/90 passando |
| Testes E2E Playwright | ✅ 7/7 passando |
| Luna via Chat/NLU | ⚠️ ~25-65% funcional — regex insuficientes, Gemini offline |
| Deploy Render | ⚠️ Código novo commitado, mas **não deployado** |

---

## 🔴 FASE 1: CRÍTICO — Segurança & Infra

> **Impacto:** Sem isso, o dashboard não é seguro ou quebra em produção.

| # | Tarefa | Descrição | Quem faz | Status |
|---|--------|-----------|----------|--------|
| 1.1 | **Deploy no Render** | O Render ainda não pegou os commits novos (FAB fix, auth fix, etc.). Fazer redeploy manual ou configurar deploy automático via GitHub. | USUÁRIO | ❌ |
| 1.2 | **JWT_SECRET no Render** | Definir `JWT_SECRET` como variável de ambiente no Render Dashboard (atualmente usa fallback aleatório, forçando logout a cada restart). | USUÁRIO | ❌ |
| 1.3 | **Webhook Discord para .env** | Mover `DISCORD_SECURITY_WEBHOOK` hardcoded no `server.js` para variável de ambiente. | ✅ FEITO |
| 1.4 | **Rate limiting global** | Atualmente só login e WhatsApp têm rate limit. Adicionar `express-rate-limit` em todas as rotas `/api/*`. | EU | ❌ |
| 1.5 | **Helmet.js** | Instalar e configurar `helmet` no Express para headers de segurança completos (HSTS, CSP, etc.). | EU | ❌ |
| 1.6 | **Path traversal robusto** | Substituir `replace(/\.\./g, '')` por validação mais forte (whitelist de chars, path.resolve + verificação). | EU | ❌ |
| 1.7 | **Source maps em produção** | Desabilitar source maps no build Vite (`sourcemap: false` já está, mas verificar se não há leaks). | EU | ❌ |
| 1.8 | **Criptografia em repouso** | Criptografar `gmail-tokens.json` e dados sensíveis no filesystem. | EU | ❌ |
| 1.9 | **Senha padrão fraca** | "7741" tem 4 dígitos. Migrar para senha mais forte ou forçar troca no primeiro login. | EU | ❌ |
| 1.10 | **`/luna-control` sem auth** | Verificar se `/luna-control` está protegido por autenticação. | EU | ❌ |

---

## 🔴 FASE 2: CRÍTICO — Dados & Backend

> **Impacto:** Bugs que corrompem dados ou retornam informações erradas.

| # | Tarefa | Descrição | Quem faz | Status |
|---|--------|-----------|----------|--------|
| 2.1 | **`buildDashboardContext` lê JSON** | A função `buildDashboardContext` ainda lê JSON direto em vez de usar PostgreSQL via `datastore-pg.js`. | EU | ❌ |
| 2.2 | **`totalExpensesMonth.toFixed` crash** | `totalExpensesMonth` é usado como número mas às vezes é string/objeto. Adicionar `parseFloat()` antes de `.toFixed()`. | EU | ❌ |
| 2.3 | **`typeof null === 'object'` no parse** | `typeof null === 'object'` quebra o parse de `amount` em alguns endpoints. | EU | ❌ |
| 2.4 | **Changelog opera em JSON** | O endpoint `/api/changelog` ainda lê/usa JSON em vez de PostgreSQL. | EU | ❌ |
| 2.5 | **149 leituras diretas de JSON** | `server.js` ainda tem ~149 chamadas `readJSON()` que deveriam usar `datastore-pg.js`. | EU | ❌ |
| 2.6 | **Leads: `name` vs `displayName`** | Criar lead via chat usa `name` mas o schema PG espera `display_name`. Normalizar. | EU | ❌ |
| 2.7 | **Ideias: tipo inválido** | `routes/ideas.js` não aceita `"feature"` como tipo válido. | EU | ❌ |
| 2.8 | **Migrações 005/006 registradas** | Schema já aplicado no banco, mas faltavam na `_migrations`. | ✅ FEITO |

---

## 🔴 FASE 3: CRÍTICO — Luna / Chat / NLU

> **Impacto:** A Luna é o coração do produto. Sem ela funcionando bem, o dashboard perde o diferencial.

| # | Tarefa | Descrição | Quem faz | Status |
|---|--------|-----------|----------|--------|
| 3.1 | **Regex `query_email` captura ações** | `"responder email"` é classificado como `consultar_emails` em vez de `responder_email`. Corrigir regex. | EU | ❌ |
| 3.2 | **Regex `enviar_email` não captura** | Cai no fallback em vez de detectar `enviar_email`. | EU | ❌ |
| 3.3 | **Regex faltantes: listar_ideias** | `listar_ideias`, `listar_projetos`, `listar_links`, `verificar_mencoes`, `listar_notificacoes` não têm regex no IntentParser. | EU | ❌ |
| 3.4 | **`m.body?.slice is not a function`** | `ActionExecutor.js` trata `m.body` como string mas às vezes é objeto. | ✅ FEITO |
| 3.5 | **Gemini API Key** | `GEMINI_API_KEY` revogada/ausente. Decisão: usar 100% offline (Ollama + NLP.js) ou gerar nova key. | USUÁRIO decide | ❌ |
| 3.6 | **Ollama circuit breaker** | Ollama retorna erro JSON parse, abrindo circuit breaker. Tratar resposta HTML/erro gracefully. | EU | ❌ |
| 3.7 | **Ações do ActionExecutor não mapeadas** | ~25 ações do ActionExecutor não têm regex correspondente no IntentParser. | EU | ❌ |

---

## 🟡 FASE 4: ALTO — Configurações & Integrações

> **Impacto:** Funcionalidades importantes que não funcionam sem configuração do usuário.

| # | Tarefa | Descrição | Quem faz | Status |
|---|--------|-----------|----------|--------|
| 4.1 | **SMTP_PASS no .env** | Email não funciona sem App Password do Gmail. | USUÁRIO | ❌ |
| 4.2 | **TELEGRAM_NOTIFICATION_CHAT_ID** | Bot não envia notificações sem chat_id do grupo/privado. | USUÁRIO | ❌ |
| 4.3 | **Gmail OAuth** | `GMAIL_CLIENT_ID` e `SECRET` ausentes. Email Hub não conecta com Gmail API. | USUÁRIO (opcional) | ❌ |
| 4.4 | **Discord webhook de menções** | `DISCORD_MENTION_WEBHOOK` não configurado. Menções em tarefas não notificam. | USUÁRIO | ❌ |
| 4.5 | **WhatsApp Chrome CDP** | Envio de mensagens WhatsApp precisa de Chrome na porta 9223. Verificar se está rodando. | EU/USUÁRIO | 🟡 |
| 4.6 | **Neon PG instabilidade** | Timeouts intermitentes. Adicionar retry com backoff na conexão. | EU | ❌ |

---

## 🟡 FASE 5: ALTO — Frontend & UX

> **Impacto:** Experiência do usuário degradada, mas não impede uso.

| # | Tarefa | Descrição | Quem faz | Status |
|---|--------|-----------|----------|--------|
| 5.1 | **StackStatus / AutoFixPanel removidos** | Removidos do frontend (APIs inexistentes). | ✅ FEITO |
| 5.2 | **ChangelogBadge race condition** | Overlay onClick + document mousedown causam comportamento estranho. | EU | ❌ |
| 5.3 | **FAB drag sem limites** | Arrastar o FAB para fora da tela o escondia. Agora tem clamping. | ✅ FEITO |
| 5.4 | **FAB sem touch events** | Mobile inutilizável para drag do FAB. Adicionar touchstart/touchmove. | EU | ❌ |
| 5.5 | **Code splitting** | Bundle JS de 3.3MB. Usar `React.lazy()` nas páginas pesadas. | EU | ❌ |
| 5.6 | **WebSocket sem reconexão** | Se cair, não reconecta automaticamente. | EU | ❌ |
| 5.7 | **Shadowing de `performance`** | `SecretTerminal.jsx` sobrescreve `performance` global. | EU | ❌ |

---

## 🟢 FASE 6: MÉDIO — Melhorias & Estabilidade

> **Impacto:** Não bloqueante, mas melhora qualidade e manutenibilidade.

| # | Tarefa | Descrição | Quem faz | Status |
|---|--------|-----------|----------|--------|
| 6.1 | **TypeScript: converter `datastore-pg.js`** | Migrar para `.ts` com tipos. | EU | ❌ |
| 6.2 | **Zod schemas para validação** | Validar todas as entradas de API. | EU | ❌ |
| 6.3 | **Testes de integração HTTP** | Usar supertest para testar rotas end-to-end. | EU | ❌ |
| 6.4 | **Cobertura de testes > 70%** | Atualmente focado em `datastore-pg.js`. Expandir. | EU | ❌ |
| 6.5 | **Páginas mortas: AccessRequest / AdminAccess** | Existem mas não estão no router. Decidir: integrar ou remover. | EU | ❌ |
| 6.6 | **GitHub / Vercel com dados mock** | Usam `mockRepos` e `mockProjects`. Integrar com APIs reais. | EU | ❌ |
| 6.7 | **Instagram Hub mínimo** | 203 linhas, funcionalidade básica. Expandir ou remover. | EU | ❌ |
| 6.8 | **Graceful shutdown do Telegram** | Evitar erro 409 Conflict ao reiniciar. | EU | ❌ |

---

## ✅ CONCLUÍDO (Referência)

| # | O que foi feito | Quando |
|---|-----------------|--------|
| 1 | Migração PostgreSQL 19/19 entidades | 2026-05-23 |
| 2 | Testes Jest 90/90 passando | 2026-05-23 |
| 3 | Testes E2E Playwright 7/7 passando | 2026-05-23 |
| 4 | Login persistente (não desloga em erro de rede) | 2026-05-23 |
| 5 | Modo Voz (STT + TTS) | 2026-05-23 |
| 6 | Luna HUD v3.0 completo | 2026-05-23 |
| 7 | IntentParser 96% acerto | 2026-05-23 |
| 8 | NotificationCenter z-index fix | 2026-05-23 |
| 9 | ActionExecutor 100% API-first | 2026-05-23 |
| 10 | Lead Capture (demo request) | 2026-05-23 |
| 11 | Email fallback SMTP | 2026-05-23 |
| 12 | FAB clamping (não some mais) | 2026-05-23 |

---

## 🚀 Próximos Passos Recomendados

### Imediato (hoje)
1. **Redeploy no Render** — pegar código novo do GitHub
2. **Definir JWT_SECRET no Render** — parar de deslogar usuários
3. **Adicionar SMTP_PASS** — email funciona

### Esta semana
4. Corrigir 4 bugs críticos do backend (FASE 2)
5. Adicionar regex faltantes no IntentParser (FASE 3)
6. Rate limiting global + Helmet.js (FASE 1)

### Próxima semana
7. Configurar Telegram chat_id + Discord webhook
8. Code splitting no frontend
9. TypeScript + Zod schemas

---

## 📁 Documentos de Origem

Este backlog foi consolidado a partir de:

- `PLANO.md`
- `handoff.md`
- `plans/PLANO_CORRECAO_BUGS_v321.md`
- `plans/PLANO_LUNA_UNICA_ADM_GESTORA_v20.md`
- `docs/CHECKLIST_DASHBOARD_PRO.md`
- `docs/ERROS_ENCONTRADOS_2026-05-23.md`
- `TEST_REPORT_LUNA_v20.md`
- `.kimi/CONSOLIDADO_MASTER.md`
- `.kimi/AGENT_BACKEND_AUDIT.md`
- `.kimi/AGENT_FRONTEND_AUDIT.md`
