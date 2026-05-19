# 🔄 HANDOFF — Próximas Ações Pendentes

> **Regra de ouro:** SEMPRE leia este arquivo no início de uma nova sessão.
> 
> **Sessão ativa:** `kimi-19007e56` 🔴 — última atualização: 2026-05-19

---

## 🎯 Foco Atual

### ✅ Concluído nesta sessão (kimi-19007e56 🔴)
- [x] **Testes completos locais** — Backend, frontend build, endpoints com curl
- [x] **Testes online (Render)** — API responde, bundle novo deployado (`index-DATHYlcm.js`)
- [x] **Teste browser via Playwright** — Email Hub carrega, Luna painel inline funciona
- [x] **Fix deploy Render** — `npm install --legacy-peer-deps` no root `package.json`
- [x] **Descoberta da instância 🟢** — `kimi-c4b19cd8` deixou mudanças não commitadas; foram integradas no commit `7ed2c6c`
- [x] **Sistema `.kimi-context/` funcional** — Index, handoff, snapshots salvos

### ❌ Problema CRÍTICO descoberto
- [ ] **API Key Gemini revogada** — Google reportou como "leaked". Toda a IA do sistema está quebrada.

---

## 🚨 Blockers / Problemas Conhecidos

| Problema | Severidade | Status | Contexto |
|---|---|---|---|
| API Key Gemini revogada | 🔴 CRÍTICO | **NÃO RESOLVIDO** | `backend/.env` — key `AIzaSyCRgGWJemoesHA2V2NlQ2l46ooy0qO7R9g` bloqueada |
| Frontend não mostra erro quando IA falha | 🟡 ALTO | Pendente | LunaEmailAssistant precisa de estado de erro |
| EmailCompose não preenche `to` | 🟡 MÉDIO | Pendente | Ao aprovar draft de reply, destinatário fica vazio |
| Chunk size warning | 🟢 BAIXO | Pendente | Bundle ~1.8MB |

---

## 🔗 Arquivos Chave

```
backend/.env                                 # ⚠️ Precisa de nova GEMINI_API_KEY
backend/services/email-ai.js                 # Prompts de email (funciona quando API key OK)
backend/services/gemini-client.js            # Cliente Gemini multi-key
frontend/src/components/email/LunaEmailAssistant.jsx  # Painel inline
frontend/src/pages/EmailHub.jsx              # Banner drafts, handlers
frontend/src/components/email/EmailCompose.jsx        # initialBody prop
agents/core/ActionExecutor.js                # Expandido pela instância 🟢
.kimi-context/index.json                     # Índice de sessões
.kimi-context/handoff.md                     # Este arquivo
```

---

## 📝 Notas da Instância Atual

**Instância:** `kimi-19007e56` 🔴  
**Última ação:** Commit `7ed2c6c` feito e deployado no Render. Aguardando nova GEMINI_API_KEY.  
**Contexto salvo em:** `.kimi-context/sessions/2026-05-19-kimi-19007e56.md`

---

## 🧠 Protocolo para Próxima Sessão

1. **LER** `.kimi-context/index.json` — verificar `activeSessionId`
2. **SE** `activeSessionId` for diferente de `kimi-19007e56`: confirmar com usuário
3. **GERAR** novo ID `kimi-XXXXXXXX`
4. **ATUALIZAR** `index.json` com nova sessão
5. **TRABALHO:** Substituir API key → testar IA → polir frontend → deploy
