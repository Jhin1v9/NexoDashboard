# 🧹 Análise de Lixo no Repositório NEXO

> Data: 18/05/2026 | Analisado por: Kimi Code CLI
> ⚠️ **IMPORTANTE:** Esta análise foi feita com critérios CONSERVADORES. Nenhum arquivo de dados do usuário foi marcado como lixo.

---

## 📊 Resumo Executivo

| Categoria | Tamanho | Qtd Arquivos |
|-----------|---------|-------------|
| 🟥 PROVAVEL_LIXO | **~1.3 GB** | 50+ |
| 🟨 SUSPEITO | **~600 MB** | 10+ |
| 🟦 LIMPEZA_LOCAL (não no git) | **~510 MB** | 4 pastas |
| **TOTAL LIBERAVEL** | **~2.4 GB** | — |

> O repositório inteiro tem ~4.2 GB. Removendo o lixo, sobram ~1.8 GB de conteúdo real.

---

## 🟥 PROVAVEL_LIXO — Pode remover sem medo

### 1. ZIP antigo do projeto (`1.2 GB`)
Arquivo de backup antigo do projeto inteiro. O código atual já está no GitHub.
```bash
rm nexodigitaldashboardv2.zip
```

### 2. Backups automáticos na pasta `agents/` (`780 KB`)
Arquivos `.bak`, `.backup`, `.bak.*` gerados automaticamente durante desenvolvimento.
```bash
cd agents && rm -f \
  LunaBrain_v16.js.bak-gemma-model-20260507 \
  luna-cto-agent.cjs.backup-* \
  luna-cto-agent.cjs.bak \
  luna-cto-agent.cjs.bak.* \
  luna-cto-agent.mjs.backup-* \
  luna-cto-agent.mjs.bak.* \
  luna-cto-agent-v15-1.cjs.backup-* \
  luna-cto-agent-v15-1.cjs.bak-* \
  luna-scheduler.mjs.backup-codex \
  LUNA_v14_1_HYBRID.cjs.bak.* \
  SmartClassifier_v16.js.bak
cd ..
```

### 3. Backups automáticos na pasta `backend/` (`904 KB`)
```bash
cd backend && rm -f \
  LunaBrain_v16.js.bak \
  server.js.backup-* \
  server.js.bak \
  server.js.bak.* \
  server.js.cleanroutes.*.bak \
  server.js.surgical.*.bak
cd ..
```

### 4. Arquivos duplicados/corrompidos na pasta `agents/`
Arquivos com `(2)` no nome e nomes estranhos (`----`). São cópias duplicadas.
```bash
cd agents && rm -f \
  "auto-monitor (2).js" \
  "luna-cto-agent---- (2).cjs" \
  "luna-cto-agent----.cjs"
cd ..
```

### 5. Scripts de correção pontuais (já executados)
Scripts que foram usados uma vez para corrigir bugs específicos. Já cumpriram sua função.
```bash
rm -f \
  agents/aplicar-correcoes.js \
  agents/corrigir-cirurgico.js \
  agents/corrigir-simples.js \
  agents/luna-extract-schema.js
```

### 6. Scripts `luna-fix-master-*` e `luna-cleanup*` na raiz (`512 KB`)
Scripts de patch/correção automática usados durante desenvolvimento. Versões antigas.
```bash
rm -f \
  luna-fix-master-v2.cjs \
  luna-fix-master-v3.cjs \
  luna-fix-master-v4.cjs \
  luna-fix-master-v6.py \
  luna-fix-master-v7.py \
  "luna-fix-master-v8 (1).cjs" \
  luna-fix-master-v8.cjs \
  luna-cleanup-master.cjs \
  luna-cleanup-report.json
```

### 7. Versões antigas de agentes (não referenciadas)
Arquivos de versões antigas que não são importados pelo código atual.
```bash
cd agents && rm -f \
  luna-cto-agent-v14-backup.cjs \
  luna-ultimate-v8.js \
  LUNA_v14_1_HYBRID.cjs \
  LunaMemory_v17.js \
  MediaProcessor_v17.js \
  luna-hybrid-scanner.js \
  luna-hybrid-scanner-v4.js \
  luna-hybrid-scanner-v5.js \
  luna-structure-scanner.js \
  nexo-whatsapp-agent-v8.mjs
cd ..
```

> **Nota:** `nexo-whatsapp-agent-v9.mjs` é mantido (versão atual). `v8` é removido.

---

## 🟨 SUSPEITO — Confirme antes de remover

### 1. Perfis do Chrome em `data/chrome-*` (`~2.1 GB`)
São perfis do Chrome usados pelo WhatsApp Web. Alguns podem ser antigos:
- `data/chrome-cdp` (528 MB)
- `data/chrome-full-profile` (363 MB)
- `data/chrome-profile` (352 MB)
- `data/chrome-abner-profile` (130 MB)
- `data/chrome-backup-profile` (108 MB)
- `data/chrome-luna-profile` (104 MB)
- `data/chrome-cdp-profile` (100 MB)
- `data/chrome-prof5` (62 MB)
- `data/chrome-prof2` (58 MB)
- `data/whatsapp-web-profile` (16 MB)

> ⚠️ **Se você usa o WhatsApp Web no dashboard, NÃO remova essas pastas!** Elas contêm a sessão logada do WhatsApp.

### 2. Pasta `ARTIFACTS/wwebjs-auth/` (`256 MB`)
Autenticação do WhatsApp Web JS. Se você usa o bot de WhatsApp, mantenha.

### 3. `agents/auto-monitor.js` (`45 KB`)
Monitor automático. Verifique se é usado por algum cron ou script antes de remover.

### 4. `INSTALL.sh` (`4 KB`)
Script de instalação. Pode ser útil para reinstalação futura.

---

## 🟦 LIMPEZA_LOCAL — Não está no git, mas ocupa disco

Essas pastas são criadas localmente pelo `npm install` e **não são enviadas pro GitHub** (já estão no `.gitignore`). Mas ocupam **510 MB** no seu disco:

```bash
rm -rf agents/node_modules/   # 103 MB
rm -rf backend/node_modules/  # 57 MB
rm -rf frontend/node_modules/ # 243 MB
rm -rf node_modules/          # 107 MB
```

> 💡 **Dica:** Para reinstalar depois, basta rodar `npm install` em cada pasta.

---

## ✅ COMANDO ÚNICO — Remove TODO o provável lixo

**Copia e cola no terminal:**

```bash
cd /home/jhin/NEXO_DASHBOARD_PRO

# 1. ZIP antigo
rm -f nexodigitaldashboardv2.zip

# 2. Backups agents/
cd agents && rm -f \
  LunaBrain_v16.js.bak-gemma-model-20260507 \
  luna-cto-agent.cjs.backup-* \
  luna-cto-agent.cjs.bak \
  luna-cto-agent.cjs.bak.* \
  luna-cto-agent.mjs.backup-* \
  luna-cto-agent.mjs.bak.* \
  luna-cto-agent-v15-1.cjs.backup-* \
  luna-cto-agent-v15-1.cjs.bak-* \
  luna-scheduler.mjs.backup-codex \
  LUNA_v14_1_HYBRID.cjs.bak.* \
  SmartClassifier_v16.js.bak \
  "auto-monitor (2).js" \
  "luna-cto-agent---- (2).cjs" \
  "luna-cto-agent----.cjs" \
  luna-cto-agent-v14-backup.cjs \
  luna-ultimate-v8.js \
  LUNA_v14_1_HYBRID.cjs \
  LunaMemory_v17.js \
  MediaProcessor_v17.js \
  luna-hybrid-scanner.js \
  luna-hybrid-scanner-v4.js \
  luna-hybrid-scanner-v5.js \
  luna-structure-scanner.js \
  nexo-whatsapp-agent-v8.mjs \
  aplicar-correcoes.js \
  corrigir-cirurgico.js \
  corrigir-simples.js \
  luna-extract-schema.js
cd ..

# 3. Backups backend/
cd backend && rm -f \
  LunaBrain_v16.js.bak \
  server.js.backup-* \
  server.js.bak \
  server.js.bak.* \
  server.js.cleanroutes.*.bak \
  server.js.surgical.*.bak
cd ..

# 4. Fix scripts na raiz
rm -f \
  luna-fix-master-v2.cjs \
  luna-fix-master-v3.cjs \
  luna-fix-master-v4.cjs \
  luna-fix-master-v6.py \
  luna-fix-master-v7.py \
  "luna-fix-master-v8 (1).cjs" \
  luna-fix-master-v8.cjs \
  luna-cleanup-master.cjs \
  luna-cleanup-report.json

# 5. node_modules locais (não no git)
rm -rf agents/node_modules/ backend/node_modules/ frontend/node_modules/ node_modules/

echo "✅ Lixo removido!"
```

---

## 🛡️ O que NÃO foi tocado (protegido)

- ✅ `backend/data/` — todos os dados do sistema
- ✅ `backend/data/schema/` — schemas dos registros
- ✅ `backend/data/config/` — configurações
- ✅ `backend/server.js` — código principal
- ✅ `backend/routes/` — rotas da API
- ✅ `backend/services/` — serviços (incluindo gemini-client.js novo)
- ✅ `frontend/src/` — todo o código React
- ✅ `agents/core/` — módulos principais (IntentParser, ActionExecutor, etc.)
- ✅ `agents/luna-scheduler.mjs` — scheduler ativo
- ✅ `agents/luna-daemon.mjs` — daemon ativo
- ✅ `agents/luna-cto-agent.cjs` — agente CTO principal
- ✅ `agents/luna-cto-agent.mjs` — agente CTO principal
- ✅ `agents/nexo-whatsapp-agent-v9.mjs` — agente WhatsApp atual
- ✅ `.git/`, `.github/`, `render.yaml`, `DEPLOY_RENDER.md`
- ✅ `package.json` (raiz, frontend, backend)

---

## 📐 Antes e Depois (estimativa)

| Item | Antes | Depois |
|------|-------|--------|
| Tamanho total | **4.2 GB** | **~1.8 GB** |
| Arquivos no git | ~105 commits | ~45 commits (limpos) |
| Build no Render | ~3-5 min | ~2-3 min |

---

Quer que eu execute o comando de limpeza agora? Ou prefere revisar item por item primeiro? 🤔
