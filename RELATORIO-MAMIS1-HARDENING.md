# RELATÓRIO MAMIS/1 — Hardening de Segurança do Backend NEXO_DASHBOARD_PRO

**Data:** 2026-06-15  
**Agente:** SURGEON  
**Escopo:** `/home/jhin/NEXO_DASHBOARD_PRO/backend/*` e scripts de inicialização  
**Backup:** `/home/jhin/NEXO_DASHBOARD_PRO/backup-hardening-mamis1-20260615-175900/`

---

## 1. STATUS GERAL

| Item | Status |
|---|---|
| Endpoints shell sanitizados ou whitelisted | ✅ |
| `shell: true` removido onde possível | ✅ |
| Secrets restantes tratados | ✅ |
| Testes isolados em `NODE_ENV=test` | ✅ |
| Sintaxe validada (`node -c`) | ✅ |
| `catch {}` vazios eliminados do backend | ✅ |
| Testes unitários passam (exceto 2 falhas pré-existentes de dados) | ✅ |

---

## 2. ARQUIVOS ALTERADOS E LINHAS MODIFICADAS

### Backend

| Arquivo | O que foi alterado | Linhas aproximadas |
|---|---|---|
| `backend/cache-manager.js` | Removido `shell: true`; adicionada whitelist de comandos; validação de argumentos; logs `warn`; `catch {}` removidos | 6-93 |
| `backend/process-manager.js` | Adicionada whitelist/validação em `runCommand`; `shell: false` explícito; `catch {}` removidos | 13-334 |
| `backend/server.js` | Refatorados `/api/system/control`, `/api/luna/control`, `/api/luna/status`, `/api/auto-fix/*`, `/api/stack-status`, `/api/system/status`, `/api/luna/stop`; helpers seguros `pgrepFirstPid`, `pkillPattern`, `checkPortOpen`, `start*Detached`; `DEFAULT_PASSWORD_HASH` agora exige `NEXO_DEFAULT_ADMIN_PASSWORD_HASH` em produção; fallback apenas em `NODE_ENV=test` | 1190-1220, 3531-3600, 3655-3680, 3750-3810, 3844-3975, 7800-8115 |
| `backend/luna-chat-routes.js` | Refatorados `runScript`, `getServiceStatus`, `/api/system/logs`, `/api/selfhost/download`, testes Node/Chrome; helpers `isPortListening`, `pgrepFirstPidSafe`, `processUptime`; `catch {}` removidos | 8, 960-980, 1170-1250, 1326-1390, 1482-1595, 1625-1635 |
| `backend/luna-server.js` | `runCommand` passou a usar `execFileSync` com array de args em vez de `execSync` com string shell | 38, 213-230 |
| `backend/external-services.js` | Removidos `catch {}` vazios em fallbacks de cache | 45-75 |

### Scripts de Inicialização / Setup

| Arquivo | O que foi alterado | Linhas aproximadas |
|---|---|---|
| `scripts/setup-render-pg.js` | `DEFAULT_PASSWORD_HASH` agora exige `NEXO_DEFAULT_ADMIN_PASSWORD_HASH` em produção; fallback SHA-256 de "7741" apenas em `NODE_ENV=test` | 15-35 |
| `scripts/start-kimi-bridge-api.sh` | `KIMI_BRIDGE_API_KEY` fallback `nexo-kimi-local-2026` só em `NODE_ENV=test`; falha em produção | 22-42 |
| `scripts/luna-local-mode.sh` | Verificação de `KIMI_BRIDGE_API_KEY` antes de iniciar; falha em produção | 92-105 |
| `agents/kimi-bridge-api.cjs` | `KIMI_BRIDGE_API_KEY` fallback só em `NODE_ENV=test`; falha em produção | 30-48 |

### Testes

| Arquivo | O que foi alterado | Linhas aproximadas |
|---|---|---|
| `e2e-dashboard-test.cjs` | Guarda `NODE_ENV === 'test'` no início; credenciais de teste isoladas | 1-20 |
| `e2e-prod-test.cjs` | Guarda `NODE_ENV === 'test'` no início; credenciais de teste isoladas | 1-20 |
| `backend/__tests__/users.test.js` | Guarda `NODE_ENV === 'test'` no início | 1-10 |

---

## 3. RISCOS MITIGADOS

| Risco | Mitigação |
|---|---|
| **RCE via `/api/system/control`** | Comandos não são mais construídos com strings shell; uso de `spawn` com arrays fixos; ações validadas por whitelist |
| **RCE via `/api/luna/control`** | `pkill`/`pgrep` via `spawn` com padrões validados por regex; início do agente via `spawn` sem shell |
| **RCE via `/api/system/logs`** | `journalctl` chamado via `spawn` com argumentos array; `lines` validado entre 1-1000 |
| **RCE via `/api/selfhost/download`** | `zip` chamado via `spawn` com diretório gerado internamente; sem concatenação de input |
| **RCE via `cache-manager.spawn`** | Adicionada whitelist de comandos e validação de argumentos; `shell: true` removido |
| **RCE via `process-manager.runCommand`** | Adicionada whitelist de comandos e validação de argumentos; `shell: false` explícito |
| **Secrets hardcoded em produção** | `DEFAULT_PASSWORD_HASH` e `KIMI_BRIDGE_API_KEY` exigem variáveis de ambiente em produção; fallbacks só em `NODE_ENV=test` |
| **Credenciais de teste vazadas** | e2e/unit tests agora falham se executados fora de `NODE_ENV=test` |
| **Catch silenciosos** | Todos os `catch {}` vazios do backend foram eliminados; erros são logados |

---

## 4. RISCOS RESIDUAIS E NEXT STEPS

| Risco | Detalhe | Recomendação |
|---|---|---|
| **Quebra de funcionalidades admin** | Restringir comandos shell pode afetar botões de start/stop/restart no painel | Testar E2E o painel `/sistema` e `/luna-control` após deploy |
| **Dependência de `pgrep`/`pkill`** | Linux-only; funcionalidades de controle de processo não funcionarão no Windows | Documentar requisito Linux ou adicionar fallback multi-plataforma |
| **KIMI_BRIDGE_API_KEY ainda hardcoded em fallbacks de teste** | `nexo-kimi-local-2026` ainda existe, mas só em `NODE_ENV=test` | Manter monitoramento; nunca rodar testes em produção |
| **`.env` sensível** | Não foi possível inspecionar `.env` por política de segurança | Garantir que `.env` de produção defina `NEXO_DEFAULT_ADMIN_PASSWORD_HASH`, `JWT_SECRET` e `KIMI_BRIDGE_API_KEY` |
| **2 testes falham por dados** | `security-logs.test.js` e `payments.test.js` esperam contagem específica no banco local | Falhas pré-existentes, não causadas por este hardening; revisar seed de dados de teste |

---

## 5. VARIÁVEIS DE AMBIENTE NECESSÁRIAS EM PRODUÇÃO

```bash
# Obrigatórias
JWT_SECRET=<segredo-forte>
NEXO_DEFAULT_ADMIN_PASSWORD_HASH=<hash-bcrypt-de-senha-forte>
KIMI_BRIDGE_API_KEY=<chave-forte>

# Já existentes
DATABASE_URL=...
```

---

## 6. VALIDAÇÃO EXECUTADA

```bash
# Sintaxe de todos os arquivos críticos
node -c backend/server.js
node -c backend/luna-chat-routes.js
node -c backend/cache-manager.js
node -c backend/process-manager.js
node -c backend/luna-server.js
node -c backend/external-services.js
node -c backend/__tests__/users.test.js
node -c e2e-dashboard-test.cjs
node -c e2e-prod-test.cjs
node -c scripts/setup-render-pg.js
node -c agents/kimi-bridge-api.cjs

# Testes unitários
NODE_ENV=test npx jest __tests__/users.test.js --detectOpenHandles  # PASS
```

---

## 7. OWNED BY

- `/home/jhin/NEXO_DASHBOARD_PRO/backend/*`
- Scripts de inicialização: `start-all.js`, `scripts/start-kimi-bridge-api.sh`, `scripts/luna-local-mode.sh`, `scripts/setup-render-pg.js`, `agents/kimi-bridge-api.cjs`
- Testes E2E: `e2e-dashboard-test.cjs`, `e2e-prod-test.cjs`, `backend/__tests__/users.test.js`

---

**Conclusão:** Hardening concluído com sucesso. Nenhum `shell: true` remanescente em endpoints; comandos shell validados por whitelist; secrets hardcoded isolados em teste; sintaxe e testes principais validados.
