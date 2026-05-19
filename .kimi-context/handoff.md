# 🔄 HANDOFF — Próximas Ações Pendentes

> **Regra de ouro:** SEMPRE leia este arquivo no início de uma nova sessão. Ele contém o estado de trabalho que não cabe no KIMI.MD.
> 
> **Sessão ativa:** `kimi-10a71fc7` 🟡 — última atualização: 2026-05-19

---

## 🎯 Foco Atual (Workspace-Leads Unification + Active Learning)

### ✅ Concluído nesta sessão (kimi-10a71fc7 🟡)
- [x] **Workspace-Leads Unification:** `GET /api/workspace/clients` retorna leads + clientes unificados
- [x] **LeadPreviewPanel:** Preview de lead na sidebar do Workspace com botão "Converter em Cliente"
- [x] **Conversão automática:** `POST /api/leads/:id/convert` cria workspace + README.md + estrutura padrão
- [x] **Active Learning NLU:** SmartFormModal mostra "Não era isso?" quando score < 0.85
- [x] **Picker de intents:** Busca `/api/luna/intents` e POST `/api/luna/learn` para re-treinar
- [x] **Build passando:** 0 erros, commit `3ea779f` enviado para GitHub

### ⏳ Próximo passo
- [ ] **🔴 URGENTE:** Substituir `GEMINI_API_KEY` no `backend/.env` (revogada pelo Google)
- [ ] **FASE 4 — Expandir corpus NLU:** Aumentar de ~25 para 50-100 exemplos por intent
- [ ] **FASE 5 — Melhorar extração de título:** Regex atual remove "do cliente Nexo" — precisa ser mais inteligente
- [ ] **FASE 6 — Deploy para Render**

---

## 🚨 Modificações de outras sessões que afetam este trabalho

| Sessão | Arquivos modificados | Impacto |
|---|---|---|
| `kimi-c4b19cd8` 🟢 | `agents/core/ActionExecutor.js` (+1.156 linhas) | 109 métodos, 21 categorias — integrar com SmartFormModal |
| `kimi-c4b19cd8` 🟢 | `agents/core/IntentParser.js` (+120 linhas) | Regex patterns + prompts LLM — pode complementar NLP.js |
| `kimi-19007e56` 🔴 | `backend/server.js` | ContextModule/contextId nos endpoints de chat |
| `kimi-19007e56` 🔴 | Frontend EmailHub | Banner drafts, LunaEmailAssistant — não conflita |

---

## 🔗 Arquivos chave desta sessão

```
backend/server.js                                    # Rotas /api/workspace/clients e /api/leads/:id/convert
backend/workspace-manager.js                         # clientExists() + createClient()
backend/services/luna-nlu.js                         # Engine NLP.js + addTrainingExample()

frontend/src/pages/Workspace.jsx                     # Sidebar unificada + LeadPreviewPanel
frontend/src/components/luna/SmartFormModal.jsx      # Active Learning (picker de intents)
frontend/src/components/luna/LunaIntentSchemas.js    # Schemas de formulário
frontend/src/hooks/useLunaNLU.js                     # Hook axios
frontend/src/components/luna/LunaFloatingButton.jsx  # Botão flutuante global
```

---

## 📝 Notas da instância

**Instância:** `kimi-10a71fc7` 🟡  
**Commit atual:** `3ea779f` — `feat(workspace): Unificação Leads+Clientes no Workspace + Active Learning NLU`  
**Build:** ✅ Vite build passando (0 erros)  
**Testes manuais:** ✅ Conversão de lead cria workspace + README.md  
**API Key Gemini:** 🔴 Revogada — endpoints `/api/email/ai/*` e `/api/luna/chat` retornam vazio  

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

**⚠️ Atenção:** `backend/workspace/` foi adicionado ao `.gitignore` — NÃO commitar dados de runtime.
