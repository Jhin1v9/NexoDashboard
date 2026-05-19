# 🔄 HANDOFF — Próximas Ações Pendentes

> **Regra de ouro:** SEMPRE leia este arquivo no início de uma nova sessão. Ele contém o estado de trabalho que não cabe no KIMI.MD.
> 
> **Sessão ativa:** `kimi-c4b19cd8` 🟢 — última atualização: 2026-05-19

---

## 🎯 Foco Atual (Luna ADM Gestora Única — FASE 2)

### ✅ Concluído em sessões anteriores
- [x] **kimi-bbf526dc 🔵** — NEXO Mail v2.0 Sprint 2:
  - LunaEmailAssistant convertido de modal → painel inline fixo (320px)
  - Banner de drafts pendentes no EmailHub
  - Endpoints `POST /api/email/ai/action-items-to-tasks` e `POST /api/email/ai/draft-for-approval`
  - Notificações automáticas para drafts e tasks
- [x] **kimi-c4b19cd8 🟢** — FASE 1 completa:
  - Luna transformada em item normal de nav na sidebar (`/luna`)
  - Chat flutuante removido do App.jsx
  - Threads renomeadas para `luna-threads.json`
  - Botões "Chat com Luna 💬" nas páginas EmailHub, Ideias, WhatsApp

### ⏳ Pendente / Próximo passo (esta sessão)
- [ ] **FASE 2 — Expansão do ActionExecutor**: Adicionar ações que faltam
  - `criar_orcamento`, `atualizar_orcamento`, `deletar_orcamento`
  - `criar_projeto`, `atualizar_projeto`
  - `adicionar_cliente_workspace`, `atualizar_cliente_workspace`
  - `enviar_email`, `responder_email`, `gerar_rascunho_email`
  - `deletar_orcamento`, `listar_orcamentos`
- [ ] **Atualizar `knownActions` no `server.js`** com as novas ações
- [ ] **Sincronizar com endpoints da sessão 🔵**: `action-items-to-tasks` já usa ActionExecutor — OK
- [ ] **FASE 3 PENDENTE**: Unificar IAs de Ideias e Email para usar `/api/luna/chat`
- [ ] **FASE 4 PENDENTE**: Frontend polimento — input universal, acesso rápido

### 🚨 Modificações de outras sessões que afetam este trabalho
| Sessão | Arquivos modificados | Impacto |
|---|---|---|
| `kimi-bbf526dc` 🔵 | `backend/server.js` (+170 linhas) | Novos endpoints `/api/email/ai/*` — ActionExecutor já é usado por eles, mas verificar se precisa de novos cases |
| `kimi-bbf526dc` 🔵 | `frontend/src/components/email/LunaEmailAssistant.jsx` | Painel inline — NÃO reverter para modal |
| `kimi-bbf526dc` 🔵 | `frontend/src/pages/EmailHub.jsx` | Banner drafts — integrado com compose |

---

## 🚨 Blockers / Problemas conhecidos

| Problema | Severidade | Contexto |
|---|---|---|
| Contexto do Kimi pode ser compactado | 🔴 Alta | Sistema `.kimi-context/` ativo |
| Chunk size warning Vite | 🟡 Média | Bundle > 500KB — não crítico |
| Rota `/api/users` GET não existe | 🟡 Média | Lista de users vem de `/api/state` ou `/api/auth/me` |

---

## 🔗 Arquivos chave desta sessão

```
agents/core/ActionExecutor.js              # Expansão com novas ações
backend/server.js                            # knownActions + endpoints Luna
frontend/src/pages/LunaControl.jsx           # Chat unificado
plans/PLANO_LUNA_UNICA_ADM_GESTORA_v20.md    # Plano completo
```

---

## 📝 Notas da instância

**Instância:** `kimi-c4b19cd8` 🟢  
**Última ação:** Atualizando .kimi-context e continuando FASE 2 do ActionExecutor.  
**Contexto salvo em:** `.kimi-context/sessions/2026-05-19-kimi-c4b19cd8.md`
