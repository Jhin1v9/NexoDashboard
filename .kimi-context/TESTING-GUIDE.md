# 🧪 Guia de Testes Automatizados — NEXO Dashboard Pro

> **Sempre leia este arquivo antes de testar.** Atualize após cada sessão de testes.

---

## 🔐 Como Autenticar

| Campo | Valor |
|---|---|
| URL | `http://localhost:3457/login` |
| Username | `abner` |
| Password | `7741` |
| Token JWT | Armazenado em `localStorage` como `nexo_token` |

**Via API (curl):**
```bash
curl -X POST http://localhost:3456/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"abner","password":"7741"}'
```

**Via Playwright:**
```js
await page.goto('http://localhost:3457/login');
await page.fill('input[placeholder="Seu usuário"]', 'abner');
await page.fill('input[type="password"]', '7741');
await page.click('button:has-text("Entrar")');
await page.waitForURL('http://localhost:3457/dashboard', { timeout: 5000 });
```

---

## 🖥️ Infraestrutura de Teste

| Serviço | Porta | Comando | Log |
|---|---|---|---|
| Backend | `3456` | `cd backend && node server.js` | `/tmp/nexo-backend.log` |
| Frontend (dev) | `3457` | `cd frontend && npx vite --port 3457` | `/tmp/nexo-frontend.log` |
| PostgreSQL | Neon (remoto) | via `DATABASE_URL` em `backend/.env` | — |
| Ollama | local | `ollama serve` | console |
| WebSocket | `3456/ws` | parte do backend | — |

### ⚠️ Instabilidade do Neon PostgreSQL (IMPORTANTE)

O banco de dados Neon (`pg.neon.tech`) pode ficar temporariamente **OFFLINE** após:
- Commits/pushes do usuário ou de outras sessões do Kimi
- Operações de deploy na Vercel
- Manutenção automática do Neon

**Sintomas:**
- `connect ETIMEDOUT 35.168.64.81:5432`
- `ENETUNREACH` em IPv6
- Todas as rotas `/api/*` retornam 500

**O que FAZER:**
1. ✅ **ESPERE** 30-60 segundos — o Neon se recupera sozinho
2. ✅ Verifique `curl http://localhost:3456/api/health` — se retorna `ok`, o backend está vivo
3. ✅ Se APIs ainda retornam 500, espere mais um pouco e teste novamente
4. ✅ Após o Neon estabilizar, **reinicie o backend** para reconectar

**O que NÃO FAZER:**
- ❌ Não fique matando/reiniciando o backend freneticamente
- ❌ Não assuma que o código está quebrado — é o banco que está instável
- ❌ Não tente "consertar" a conexão do Neon mudando código

**Verificar status:**
```bash
curl http://localhost:3456/api/health  # deve retornar {"status":"ok"}
curl http://localhost:3457/            # deve retornar 200
```

---

## ✅ Checklist de Testes E2E

### 1. Login
- [ ] Navegar para `/login`
- [ ] Preencher `abner` / `7741`
- [ ] Clicar em "Entrar"
- [ ] Esperar redirecionamento para `/dashboard`
- [ ] Verificar `localStorage.getItem('nexo_token')` não é null

### 2. WhatsApp
- [ ] Navegar para `/whatsapp`
- [ ] Clicar em "Menções" tab
- [ ] **NÃO deve crashar** (erro `Activity is not defined` = FIX PENDENTE)

### 3. Email (Gmail OAuth)
- [ ] Navegar para `/email`
- [ ] Clicar em "Conectar com Google"
- [ ] Deve mostrar alert com erro real (ex: "Credenciais OAuth2 não configuradas")
- [ ] **NÃO deve ser silencioso**

### 4. Luna Chat
- [ ] Clicar no FAB (botão flutuante inferior direito)
- [ ] Chat deve abrir
- [ ] Digitar mensagem e pressionar Enter
- [ ] Mensagem deve aparecer no chat
- [ ] Luna deve responder (pode ser "Desculpe, não consegui processar..." se Ollama falhar)

### 5. Caixa (Salvar)
- [ ] Navegar para `/caixa`
- [ ] Editar saldo ou outro campo
- [ ] Clicar em "Salvar"
- [ ] **NÃO deve mostrar "Erro ao salvar"**

### 6. Notificações
- [ ] Clicar no sino com badge "3+"
- [ ] Dropdown deve abrir
- [ ] Clicar no sino com badge "9+"
- [ ] Dropdown deve abrir (FIX PENDENTE)

---

## 🐛 Bugs Conhecidos & Status

| # | Bug | Status | Último Teste | Notas |
|---|---|---|---|---|
| 1 | WhatsApp `Activity is not defined` | 🟡 PENDENTE | 2026-05-23 | Falta import `Activity` em `WhatsApp.jsx` |
| 2 | Luna não responde (fetch sem Auth) | 🟡 PENDENTE | 2026-05-23 | Internal fetch para `/api/luna/chat` não passa header `Authorization` |
| 3 | Email OAuth silencioso | ✅ CORRIGIDO | 2026-05-23 | Agora mostra alert com erro real |
| 4 | Caixa "Erro ao salvar" | 🟡 PENDENTE | 2026-05-23 | Páginas com `fetch` nativo não enviam token JWT |
| 5 | Sino 9+ não abre | ✅ FUNCIONA | 2026-05-23 | Há 3 sinos na TopBar (ChangelogBadge, NotificationCenter, PushNotification). O "9+" é o NotificationCenter — **funciona quando clicado corretamente** |
| 6 | Ollama erro JSON | 🟡 CONHECIDO | 2026-05-23 | `[OllamaClient] Unexpected non-whitespace character after JSON` — não crítico |
| 7 | WebSocket ERR_CONNECTION_REFUSED | 🟡 CONHECIDO | 2026-05-23 | WS funciona via teste, browser às vezes falha |
| 8 | Vite dev server cai | 🟡 CONHECIDO | 2026-05-23 | Reiniciar: `cd frontend && npx vite --port 3457` |

---

## 🔧 Comandos Úteis

**Reiniciar backend:**
```bash
cd /home/jhin/NEXO_DASHBOARD_PRO/backend
pkill -f "node server.js"
nohup node server.js > /tmp/nexo-backend.log 2>&1 &
```

**Reiniciar frontend:**
```bash
cd /home/jhin/NEXO_DASHBOARD_PRO/frontend
nohup npx vite --port 3457 > /tmp/nexo-frontend.log 2>&1 &
```

**Ver logs em tempo real:**
```bash
tail -f /tmp/nexo-backend.log
tail -f /tmp/nexo-frontend.log
```

**Build produção:**
```bash
cd /home/jhin/NEXO_DASHBOARD_PRO/frontend && npx vite build
```

**Testar API diretamente:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3456/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"abner","password":"7741"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

curl -s http://localhost:3456/api/notifications -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3456/api/cash-box -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3456/api/luna/threads -H "Authorization: Bearer $TOKEN"
```

---

## 📝 Notas para Próximas Instâncias

1. **Sempre reinicie o Vite** antes de testar (`npx vite --port 3457`)
2. **Sempre verifique se o backend está rodando** (`curl http://localhost:3456/api/health`)
3. **Use `abner` / `7741`** para login — é a única conta que sabemos que funciona
4. **Ollama pode falhar** — não é crítico, a Luna ainda processa mensagens via NLU
5. **WebSocket pode falhar no browser** — teste via `node -e "new WebSocket('ws://localhost:3456/ws')"` no backend
6. **NEVER sobrescreva `window.fetch`** globalmente — quebra o React e o Vite HMR
7. **SEMPRE verifique `git status`** antes de fazer mudanças
8. **Siga o handoff.md** para entender o estado atual do projeto
9. **Token JWT expira após restart do backend** — O secret é gerado aleatoriamente em cada startup. Se reiniciar o backend, faça logout/login novamente no browser (ou limpe o localStorage)
10. **Há 3 sinos na TopBar** — Não se confunda:
    - 🔔 **"9+"** (esquerda) = `NotificationCenter` — notificações do sistema
    - 🔔 **"3"** (meio) = `ChangelogBadge` — atualizações do changelog  
    - 🔔 **vazio** (direita) = `PushNotificationButton` — notificações push do browser

---

## 🔄 Histórico de Sessões

| Data | Instância | Foco | Resultado |
|---|---|---|---|
| 2026-05-23 | kimi-atual-hud-v3 | Bugfix + testes E2E | 5 bugs identificados, 1 corrigido (Email OAuth) |
