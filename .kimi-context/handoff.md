# 🔄 HANDOFF — Próximas Ações Pendentes

> **Regra de ouro:** SEMPRE leia este arquivo no início de uma nova sessão. Ele contém o estado de trabalho que não cabe no KIMI.MD.
> 
> **Sessão ativa:** `kimi-10a71fc7` 🟡 — última atualização: 2026-05-19

---

## 🎯 Foco Atual (Luna v20.0 — NLU Unificado + Fluxo Floating Button)

### ✅ Concluído nesta sessão (kimi-10a71fc7 🟡)
- [x] **NLU Unificado:** LunaFloatingButton e página `/luna` usam o MESMO backend (`/api/luna/chat`)
- [x] **Fluxo dual:** SmartFormModal para formulários + fallback `/api/luna/chat` para consultas
- [x] **Intents novos:** `social` (saudações), `financeiro.listar_pagamentos/despesas`
- [x] **ActionExecutor:** Ações `ajuda` e `navigate`, correção `completeTask` (sem criar tarefa vazia)
- [x] **Saudações NLU:** "oi luna", "bom dia", "como vai" — score 1.0, respostas variadas
- [x] **Botão flutuante estilizado:** Gradiente purple, ícone Wand2, sem debug, sem limitação por página
- [x] **Sugestões globais:** 5 comandos fixos em qualquer página (não mais por módulo)
- [x] **Changelog recuperado:** 18 entradas (tinham sido apagadas, reduzidas para 3)
- [x] **Repo unificado:** `NexoDashboard/` local antigo desvinculado do remote
- [x] **Todos os commits enviados:** `039ee00` é o HEAD atual
- [x] **Build passando:** Vite build 0 erros

### ⏳ Próximo passo
- [ ] **🔴 URGENTE:** Substituir `GEMINI_API_KEY` no `backend/.env` (revogada pelo Google)
- [ ] **FASE 4 — Expandir corpus NLU:** Aumentar exemplos por intent (criar_rascunho score 0.68)
- [ ] **FASE 5 — Melhorar extração de params:** Email `para`/`assunto` de frases naturais
- [ ] **FASE 6 — Deploy para Render:** Verificar se build no Render está OK
- [ ] **Opcional:** Adicionar `LunaActionDrawer`, `LunaActionFlow`, `LunaSafetyDelay` ao fluxo principal

---

## 🚨 Modificações de outras sessões que afetam este trabalho

| Sessão | Arquivos modificados | Impacto |
|---|---|---|
| `kimi-c4b19cd8` 🟢 | `agents/core/ActionExecutor.js` (+1.156 linhas) | 109 métodos, 21 categorias — integrar com SmartFormModal |
| `kimi-c4b19cd8` 🟢 | `agents/core/IntentParser.js` (+120 linhas) | Regex patterns + prompts LLM — complementa NLP.js |
| `kimi-19007e56` 🔴 | `backend/server.js` | ContextModule/contextId nos endpoints de chat |
| `kimi-19007e56` 🔴 | Frontend EmailHub | Banner drafts, LunaEmailAssistant — não conflita |

---

## 🔗 Arquivos chave desta sessão

```
backend/server.js                                    # Endpoint /api/luna/chat (NLU → ActionExecutor)
backend/services/luna-nlu.js                         # Motor NLP.js + corpus de treinamento
agents/core/ActionExecutor.js                        # 113+ ações (ajuda, navigate, task_done corrigido)
agents/core/NLUActionMapper.js                       # Mapeia intents NLU → ações
agents/core/IntentParser.js                          # Regex fallback

frontend/src/components/luna/LunaFloatingButton.jsx  # Botão flutuante (mini-chat + SmartFormModal fallback)
frontend/src/components/luna/SmartFormModal.jsx      # Modal de formulário (Active Learning)
frontend/src/components/luna/LunaIntentSchemas.js    # Schemas de formulário por intent
frontend/src/components/luna/LunaModuleSuggestions.js # Sugestões GLOBAIS (5 fixas, não por página)
frontend/src/context/LunaContext.jsx                 # Provider global de contexto
frontend/src/lib/lunaEventBus.js                     # Event emitter desacoplado

backend/data/changelog.json                          # 18 entradas recuperadas + 3 novas
```

---

## 📝 Notas da instância

**Instância:** `kimi-10a71fc7` 🟡  
**Commit atual:** `039ee00` — `feat(luna-floating): remove limitacao por pagina + estilo producao`  
**Build:** ✅ Vite build passando (0 erros)  
**Testes manuais:** ✅ 24 comandos NLU testados (página /luna + botão flutuante)  
**API Key Gemini:** 🔴 Revogada — NLU offline cobre 100% dos comandos operacionais  
**Render:** ⏳ Aguardando deploy automático do commit `039ee00`  

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
