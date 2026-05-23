# 🐛 Erros Encontrados — 23/05/2026

> Sessão: SmartFormModal + Gmail API + Deploy Render
> Agente: Correção de bugs e testes E2E

---

## ✅ CORRIGIDO

### ERRO 1: `ReferenceError: Cannot access 'writeJSON' before initialization`

**Severidade:** CRÍTICA — crashava o servidor no startup

**Onde:** `backend/server.js` linha 107

**Cenário real (log Render):**
```
ReferenceError: Cannot access 'writeJSON' before initialization
    at Object.<anonymous> (/opt/render/project/src/backend/server.js:107:3)
```

**Causa:** As funções `readJSON` e `writeJSON` eram definidas na linha 950+ mas usadas na linha 107. Como usavam `const`, não havia hoisting.

**Fix:** Movidas as definições para antes da linha 93 (seção AUTH & SECURITY).

**Commit:** `5ffa78e`

---

## ❌ PENDENTE — Precisa de ação do usuário

### ERRO 2: Gmail OAuth não autenticado (email não funciona)

**Severidade:** ALTA — SmartFormModal abre mas email não envia

**Onde:** Produção (Render)

**Cenário real:**
```
Usuário: "enviar email"
Luna:    "Preciso de mais alguns dados..."
         ↓ [modal abre]
Usuário: preenche → Confirma
Luna:    "Eita, sistema... deu ruim 😅
          Erro: Falha ao enviar email — serviço de email pode estar offline"
```

**Causa:** Credenciais `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` estão no Render, mas o fluxo de autorização OAuth2 nunca foi completado. Status atual: `{"connected": false}`

**Fix necessário:**
1. Acessar `https://nexodashboard.onrender.com/`
2. Ir em **Comunicação → Email**
3. Clicar **"Conectar Gmail"**
4. Fazer login com `nexodigital.sys@gmail.com` e autorizar

**Alternativa rápida:** Configurar SMTP com App Password no Render Dashboard.

---

### ERRO 3: JWT_SECRET não definido no Render

**Severidade:** MÉDIA — usuários deslogados a cada restart/deploy

**Onde:** Produção (Render Environment Variables)

**Cenário real (log):**
```
[SECURITY] JWT_SECRET não definido no ambiente. Usando valor aleatório temporário.
[SECURITY] Todos os tokens serão invalidados após reinicialização do servidor.
```

**Fix:** Adicionar no Render Dashboard → Environment:
```
JWT_SECRET=0b0166786fc9c7edd818660c0a7043bdaab46edf1cd26ee0916fb25cb44ec502
```

---

## ⚠️ ERROS RECORRENTES — Não críticos mas poluem logs

### ERRO 4: Telegram 409 Conflict

**Severidade:** BAIXA — bot continua funcionando, mas logs poluídos

**Onde:** Local e Produção

**Cenário real:**
```
[TELEGRAM-LUNA] ⚠️ Polling error: ETELEGRAM: 409 Conflict:
terminated by other getUpdates request;
make sure that only one bot instance is running
```

**Causa:** Múltiplas instâncias do backend (local + Render, ou restart sem matar processo antigo).

**Mitigação atual:** `pkill -f "node server.js"` antes de reiniciar localmente.

**Fix ideal:** Adicionar graceful shutdown que para o bot do Telegram antes de encerrar o processo Node.

---

### ERRO 5: Ollama preload JSON parse error

**Severidade:** BAIXA — fallback NLU funciona, mas preload falha

**Onde:** Local (quando Ollama está rodando)

**Cenário real:**
```
[OllamaClient] Attempt 1 failed: Unexpected non-whitespace character after JSON at position 100
[OllamaClient] Preload failed: Unexpected non-whitespace character after JSON at position 100
```

**Causa:** Ollama retorna múltiplos JSONs em uma resposta (streaming) e o parser espera um único objeto.

**Impacto:** NLU funciona via fallback, mas o modelo não fica "pré-carregado" na memória.

---

### ERRO 6: Neon PostgreSQL instável

**Severidade:** MÉDIA — intermitente, causa 500 em todas as rotas `/api/*`

**Onde:** Local e Produção (Neon PostgreSQL)

**Cenário real:**
```
connect ETIMEDOUT 35.168.64.81:5432
Error: connect ENETUNREACH 2600:1f18:2e13:9d01:ec1e:6969:83e0:4bd6:5432
```

**Mitigação atual:** Aguardar 30s após commits/pushes antes de reiniciar backend.

**Fix ideal:** Implementar retry com exponential backoff na conexão PG, ou cache local quando PG está offline.

---

### ERRO 7: SMTP não configurado (fallback email)

**Severidade:** MÉDIA — email só funciona se Gmail OAuth estiver autenticado

**Onde:** Local e Produção

**Cenário real:**
```
[EmailService] SMTP NÃO configurado. Emails não serão enviados.
Use variáveis SMTP_HOST, SMTP_USER, SMTP_PASS
```

**Fix:** Configurar App Password do Gmail e adicionar ao `.env` / Render Dashboard:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=nexodigital.sys@gmail.com
SMTP_PASS=<app-password>
```

---

### ERRO 8: Vite HMR connection refused (dev only)

**Severidade:** BAIXA — apenas em desenvolvimento, não afeta produção

**Onde:** Local (Vite dev server)

**Cenário real:**
```
WebSocket connection to 'ws://localhost:3457/' failed: Error in connection establishment
```

**Causa:** Vite HMR WebSocket roda na porta 3457, mas o frontend dev proxy espera na 3456.

**Impacto:** HMR não funciona (precisa dar F5 manual), mas app funciona normalmente.

---

## 📊 Resumo

| # | Erro | Status | Severidade |
|---|------|--------|------------|
| 1 | `ReferenceError: writeJSON` | ✅ Corrigido | Crítica |
| 2 | Gmail OAuth não autenticado | ❌ Pendente | Alta |
| 3 | JWT_SECRET não definido | ❌ Pendente | Média |
| 4 | Telegram 409 Conflict | ⚠️ Recorrente | Baixa |
| 5 | Ollama JSON parse error | ⚠️ Recorrente | Baixa |
| 6 | Neon PostgreSQL timeouts | ⚠️ Recorrente | Média |
| 7 | SMTP não configurado | ⚠️ Recorrente | Média |
| 8 | Vite HMR connection refused | ⚠️ Recorrente | Baixa |

---

## 🎯 Próximos passos recomendados

1. **Autenticar Gmail OAuth** em produção (maior impacto imediato)
2. **Adicionar JWT_SECRET** no Render Dashboard
3. **Configurar SMTP** como backup (App Password)
4. **Implementar graceful shutdown** do Telegram bot
5. **Adicionar retry** na conexão PostgreSQL
