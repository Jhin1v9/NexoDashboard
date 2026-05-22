# BACKEND AUDIT REPORT

## Arquivo: `/backend/server.js`

### Endpoints/Riscos

**1. Rotas REALMENTE públicas (sem qualquer auth):**
O middleware global (linha 888–910) intercepta **todas** as rotas `/api/*` e exige JWT, exceto as listadas em `PUBLIC_API_ROUTES`:

- `GET /api/health` — healthcheck (linha 913)
- `POST /api/auth/login` — login (linha 7955)
- `POST /api/auth/logout` — logout (linha 8104)
- `GET /api/auth/sync` — sync de token (listada no array público)
- `GET /api/email/auth/callback` — OAuth callback do Google (linha 6838)

**Fora do prefixo `/api/`:**
- `GET /luna-control` — serve HTML estático (linha 3915), **sem autenticação**. Qualquer um pode acessar o painel de controle da Luna.

**2. Inconsistência crítica de autenticação:**
- O middleware global (linha 888–910) **NÃO** aceita `INTERNAL_API_TOKEN` como fallback.
- O `requireAuth` (linha 93–112) **ACEITA** `INTERNAL_API_TOKEN`.
- Resultado: rotas protegidas apenas pelo middleware global (99% das rotas) **rejeitam** o service token, enquanto rotas com `requireAuth` explícito o aceitam. Isso quebra integrações internas.

**3. Rate Limiting — COBERTURA INCOMPLETA:**
- Apenas `POST /api/auth/login` tem rate limit (linha 7910–7952, memória, 5 tentativas / 15min, bloqueio 30min).
- Apenas alertas WhatsApp de segurança têm rate limit (5 minutos).
- **NENHUMA** rota sensível de escrita (`/api/tasks`, `/api/payments`, `/api/expenses`, `/api/cash-box`, `/api/email/*`, `/api/workspace/*`, `/api/luna/*`) possui rate limiting. Risco: DoS, brute-force de IDs, spam de criação.

**4. Path Traversal — Sanitização insuficiente:**
- Linha 4615 (`buildDashboardContext`): `contextFile.replace(/\.\./g, '')` — remoção ingênua de `..`.
- Linhas 8539, 8592, 8627 (workspace download/content/put): `(req.query.path || '').replace(/\.\./g, '')` — mesma falha.
- `replace(/\.\./g, '')` **não** impede traversal via encoding, null bytes, symlinks, ou padrões como `..././`. O `workspace-manager.js` possui `sanitizeSubPath()` que normaliza e valida (`startsWith('..')`, `includes('/../')`), mas o `server.js` **ignora** essa função e aplica sua própria sanitização fraca.

**5. SQL Injection:**
- Risco **baixo** para SQL direto. O `server.js` faz apenas **1** query SQL direta (linha 8753: `SELECT COUNT(*) as count FROM users`), e é parametrizada.
- Todas as queries no `datastore-pg.js` usam `$1, $2…` (parameterized queries).
- **PORÉM**: o `server.js` praticamente **IGNORA** o PostgreSQL para a maioria das entidades. Há **149 ocorrências** de `readJSON()` no arquivo, lendo diretamente de arquivos JSON no disco (`tasks.json`, `payments.json`, `expenses.json`, `cash-box.json`, etc.). Isso não é SQL injection, mas é uma arquitetura quebrada onde o PG e os JSON ficam dessincronizados.

**6. Rotas de Email — Separação inexistente:**
- `POST /api/email/messages/send` (linha 6976) é usado tanto para **enviar email novo** quanto para **responder** (requer `threadId` e `inReplyTo` no body).
- **Não existe** rota dedicada `/api/email/messages/:id/reply`. Send e Reply estão no mesmo endpoint sem distinção semântica no path.

### Bugs encontrados (com linha exata)

**BUG-002 — `totalExpensesMonth` usa campo errado para filtrar despesas do mês**
- **Local:** `/backend/server.js`, linha 4564–4567
- **Código problemático:**
```js
const monthlyExpenses = expenses.filter(e => {
  const d = e.date || e.createdAt || '';
  return d.startsWith(today.slice(0, 7));
});
```
- **Problema:** O modelo de `expense` no datastore NÃO possui campo `date`. Os campos reais são `startDate`, `renewDate`, `endDate` e `createdAt`. O fallback para `createdAt` significa que uma despesa recorrente criada em Janeiro com `startDate` em Março será contabilizada como "gasto de Janeiro". O dashboard mostra valores financeiros incorretos.
- **Fix necessário:**
```js
const d = e.startDate || e.renewDate || e.date || e.createdAt || '';
```

**BUG-003 — `typeof null === 'object'` quebra parse de `amount` em despesas**
- **Local:** `/backend/server.js`, linha 4569
- **Código:**
```js
const val = typeof e.amount === 'object' ? (e.amount?.value || 0) : (e.amount || e.valor || 0);
```
- **Problema:** Se `e.amount` for `null`, `typeof null === 'object'` é `true`, resultando em `0` mesmo que exista `e.amount_value` ou `e.valor`. Isso pode zerar despesas em registros migrados ou com dados parciais.
- **Fix:**
```js
const val = (e.amount && typeof e.amount === 'object') ? (e.amount.value || 0) : (e.amount || e.valor || 0);
```

**BUG-004 — `buildDashboardContext` lê JSON direto ignorando PostgreSQL**
- **Local:** `/backend/server.js`, linhas 4537–4541
- **Problema:** A função lê `tasks.json`, `company-tasks.json`, `cash-box.json`, `payments.json`, `expenses.json` diretamente do disco via `readJSON()`. Quando `DATABASE_URL` está configurado, o `datastore-pg.js` é a fonte de verdade, mas `buildDashboardContext` ignora-o completamente. O contexto enviado para a Luna pode conter dados **stale** ou **desatualizados** em relação ao banco.
- **Fix:** Usar `dataStore.getTasks()`, `dataStore.getPayments()`, `dataStore.getExpenses()`, `dataStore.getCashBox()` em vez de `readJSON()`.

**BUG-005 — Changelog opera em JSON ignorando PostgreSQL**
- **Local:** `/backend/server.js`, linhas 3665–3882
- **Problema:** `CHANGELOG_FILE` aponta para `__dirname/changelog.json`. O `datastore-pg.js` possui `getChangelog`/`saveChangelog` (tabela `changelog`), mas o `server.js` nunca as chama. Se o deploy usar PG, o changelog fica dessincronizado.
- **Fix:** Substituir `readJSON(CHANGELOG_FILE)` por `dataStore.getChangelog()` e `writeJSON` por `dataStore.saveChangelog()`.

### Recomendações de fix
1. **Unificar autenticação:** Fazer o middleware global aceitar `INTERNAL_API_TOKEN` (mesma lógica do `requireAuth`), ou remover o fallback do `requireAuth` para evitar confusão.
2. **Rate limiting global:** Adicionar `express-rate-limit` em todas as rotas `/api/*` de escrita (POST/PUT/DELETE), não apenas login.
3. **Path traversal:** Substituir TODAS as ocorrências de `.replace(/\.\./g, '')` no `server.js` por `workspaceManager.sanitizeSubPath()` ou por `path.resolve(base, input)` + `startsWith(base)`.
4. **Persistência unificada:** Migrar todas as leituras diretas de JSON no `server.js` para usar `dataStore.*`. Se `datastore-pg.js` é a fonte de verdade, o `server.js` não deve ler JSON diretamente.
5. **Email API:** Criar `POST /api/email/messages/:id/reply` para separar semanticamente envio de resposta.

---

## Arquivo: `/backend/datastore.js`

### Endpoints/Riscos
- Este arquivo é o **Datastore Híbrido** (fallback JSON quando `DATABASE_URL` não está setado).
- **Risco:** Ainda exporta `USE_PG` e todas as funções de fallback. Se alguém reverter o `require` no `server.js` de `datastore-pg` para `datastore`, o sistema volta a operar em JSON sem migração.
- **Path traversal leve:** `readJSONFile(file)` faz `path.join(DATA_DIR, file)` sem sanitização. Se uma função externa passar `file = '../secrets.env'`, lê fora do `DATA_DIR`. Felizmente, todas as chamadas internas usam nomes hardcoded.

### Bugs encontrados
- **Schema drift com `datastore-pg.js`:**
  - `datastore.js` `getIdeas()` retorna `{ ideas: [] }` (array).
  - `datastore-pg.js` `getIdeas()` retorna `{ ideas: {} }` (objeto/dicionário).
  - Se houver troca de datastores, o frontend que espera array vai quebrar.
- **`getMembers`** no `datastore.js` não possui `saveMember` (só getter), enquanto `datastore-pg.js` possui.

### Recomendações de fix
1. Depreciar/remover `datastore.js` ou mantê-lo apenas como utilitário de I/O JSON, não como datastore ativo.
2. Garantir que `readJSONFile` valide que o path resultante está dentro de `DATA_DIR`.

---

## Arquivo: `/backend/datastore-pg.js`

### Endpoints/Riscos
- **Risco de startup fatal:** Linha 9–14. Se `DATABASE_URL` não estiver definida, o processo faz `process.exit(1)`.
- **SQL Injection:** Risco **zero**. Todas as queries usam placeholders `$N` com arrays de parâmetros.
- **Schema drift:** `getIdeas()` retorna objeto `{}` (linha 389), diferente do `datastore.js` que retorna array `[]`.

### Bugs encontrados
- **Changelog, WhatsApp History, Luna Threads e Luna Buffer** existem neste arquivo (`getChangelog`, `saveChangelog`, etc.), mas o `server.js` **nunca os importa nem usa**. Essas tabelas no PostgreSQL ficam desertas enquanto o `server.js` lê/escreve JSON.

### Recomendações de fix
1. Expor `getChangelog`, `saveChangelog`, `getWhatsappHistory`, etc. no `module.exports` do `datastore-pg.js` (já estão) e fazer o `server.js` migrar para usá-los.

---

## Arquivo: `/agents/core/IntentParser.js`

### Endpoints/Riscos
- N/A (módulo de parsing, não expõe HTTP).

### Bugs encontrados (com linha exata)

**BUG-001 — Regex `query_email` captura comandos de ação como consulta**
- **Local:** `/agents/core/IntentParser.js`, linha 268–275
- **Regex exato:**
```js
regex: /\b(emails?|caixa\s+de\s+entrada|inbox|ver\s+emails?|checar\s+emails?|responder\s+emails?|novos?\s+emails?)\b/i
```
- **Problema:** O padrão `responder\s+emails?` captura frases como *"responder email do cliente"* e classifica como action **`consultar_emails`** (consulta/leitura), quando deveria ser uma ação de **escrita/resposta**.
- **Impacto:** O `ActionExecutor.js` possui handlers para `enviar_email` e `responder_email` (linhas 167–170), mas o `fastParse()` **nunca** emite essas ações porque **não existem regexes** para elas. O usuário é forçado a depender do LLM (Gemini) para comandos de email, que pode falhar, ter timeout ou custo desnecessário.
- **Fix necessário:**
  1. Remover `responder\s+emails?` do regex de `query_email`.
  2. Adicionar novos padrões:
```js
send_email: {
  regex: /\b(enviar|mandar|compor|escrever|criar)\s+(?:um\s+)?email\b/i,
  action: 'enviar_email',
  extract: (text) => ({ destinatario: null, assunto: null, contexto: text })
},
reply_email: {
  regex: /\b(responder|reponder)\s+(?:o\s+|ao\s+)?email|resposta\s+(?:ao|do|para)\s+email\b/i,
  action: 'responder_email',
  extract: (text) => ({ contexto: text })
}
```

**BUG-006 — Regex `query_email` não captura "enviar email"**
- Como descrito acima, `enviar email`, `mandar email`, `escrever email` caem em `intent: 'unknown'` no fast-path, forçando chamada ao Gemini.

### Recomendações de fix
1. Separar intents de leitura (`consultar_emails`) de escrita (`enviar_email`, `responder_email`) no `fastParse()`.
2. Adicionar os novos padrões à lista `criticalActions` (linha 351–363) para exigir confirmação do usuário antes de envio.

---

## Arquivo: `/agents/core/ActionExecutor.js`

### Endpoints/Riscos
- N/A (cliente interno do backend).

### Bugs encontrados (com linha exata)

**BUG-007 — Tratamento inconsistente de `m.body` (string vs objeto)**
- **Local 1:** linha 983
```js
const mentions = history.filter(m => /@(?:LUNA|KIMI|KIMICLAW)/i.test(m.body || m.text || ''));
```
- **Local 2:** linha 994
```js
text: (m.body?.text || m.body || m.text || '').slice(0, 100)
```
- **Problema:** Se a mensagem do WhatsApp tiver `m.body` como objeto (ex: `{ text: '...', caption: '...' }` — formato comum da lib `whatsapp-web.js`), a linha 983 converte o objeto para string `"[object Object]"` no `.test()`. Isso **nunca** dá match em `@LUNA`, e a menção é perdida silenciosamente.
- A linha 994 tem fallback correto (`m.body?.text || m.body || m.text || ''`), mas a linha 983 não usa `m.body?.text`.
- **Fix:**
```js
const getBodyText = (m) => (typeof m.body === 'object' ? m.body?.text : m.body) || m.text || '';
const mentions = history.filter(m => /@(?:LUNA|KIMI|KIMICLAW)/i.test(getBodyText(m)));
```

**BUG-008 — Fallback para JSON direto quebra consistência PG**
- O ActionExecutor faz fallback direto para escrita em arquivos JSON (`tasks.json`, `cash-box.json`, `clients-registry.json`, etc.) quando a API REST retorna erro. Se o backend está usando PostgreSQL, esses arquivos JSON ficam dessincronizados do banco.
- **Exemplo:** linha 356 (`createTask`) escreve em `tasks.json` se API falhar.

### Recomendações de fix
1. Unificar o tratamento de `m.body` em todas as funções que processam mensagens WhatsApp.
2. Remover fallbacks JSON do ActionExecutor ou fazer com que eles também chamem `dataStore.saveTask()` etc.

---

## Arquivo: `/backend/changelog.json`

### Endpoints/Riscos
- Arquivo estático lido pelo `server.js`. Não expõe endpoints diretamente, mas é a fonte de verdade para `/api/changelog`.

### Bugs encontrados
- **Inconsistência no campo `category`:**
  - `"bugfix"` (linhas 10, 98)
  - `"feature"` (linhas 28, 44, 64, etc.)
  - `"fix"` (linha 202)
  - `"improvement"` (linha 313)
  - `"whatsapp"` (linha 482)
  - `"finance"` (linha 498)
- O frontend pode fazer filtros por `category === 'bugfix'` e perder a entrada `"fix"`.
- **Duplicidade de fonte de verdade:** O `datastore-pg.js` possui tabela `changelog`, mas o `server.js` lê este arquivo JSON. Se houver escrita via API, o PG não é atualizado; se houver leitura do PG, o JSON não é atualizado.

### Recomendações de fix
1. Normalizar o campo `category` para um enum fechado (`bugfix`, `feature`, `improvement`, `security`, `breaking`).
2. Migrar a API `/api/changelog` para usar `dataStore.getChangelog()` e `dataStore.saveChangelog()`.

---

## RESUMO EXECUTIVO DE RISCOS CRÍTICOS

| ID | Risco | Severidade | Arquivo |
|---|---|---|---|
| R01 | Rotas de workspace com path traversal fraco | **ALTA** | `server.js` |
| R02 | Rate limiting ausente em rotas sensíveis | **ALTA** | `server.js` |
| R03 | `server.js` lê JSON direto ignorando PostgreSQL | **ALTA** | `server.js`, `datastore-pg.js` |
| R04 | `totalExpensesMonth` filtra por `createdAt` em vez de `startDate` | **MÉDIA** | `server.js` |
| R05 | IntentParser não diferencia "responder email" de "ver email" | **MÉDIA** | `IntentParser.js` |
| R06 | ActionExecutor perde menções quando `m.body` é objeto | **MÉDIA** | `ActionExecutor.js` |
| R07 | `/luna-control` acessível sem autenticação | **BAIXA** | `server.js` |
| R08 | Inconsistência `INTERNAL_API_TOKEN` entre middlewares | **BAIXA** | `server.js` |
| R09 | Categorias divergentes no `changelog.json` | **BAIXA** | `changelog.json` |
