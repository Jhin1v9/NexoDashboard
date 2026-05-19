# 🔄 HANDOFF — Próximas Ações Pendentes

> **Regra de ouro:** SEMPRE leia este arquivo no início de uma nova sessão. Ele contém o estado de trabalho que não cabe no KIMI.MD.
> 
> **Sessão ativa:** `kimi-10a71fc7` 🟡 — última atualização: 2026-05-19

---

## 🎯 Foco Atual (Workspace File Viewer v2 ✅ CONCLUÍDO)

### ✅ Concluído nesta sessão (kimi-10a71fc7 🟡)
- [x] **Workspace File Viewer v2:** Editor/viewer de arquivos no workspace com syntax highlighting
- [x] **highlight.js:** 15 linguagens registradas (JS, TS, JSON, CSS, Python, PHP, SQL, YAML, Bash, Dockerfile, GraphQL, etc.)
- [x] **Modo Preview/Código:** Toggle para Markdown, HTML e arquivos de código
- [x] **Indicador de alterações não salvas:** ● laranja no header + subtítulo
- [x] **Atalhos de teclado:** `Ctrl+S` salvar, `ESC` fechar viewer
- [x] **Scrollbars customizadas:** `.custom-scrollbar` com thumb `#2a2a3e` e hover `#3a3a4e`
- [x] **Endpoints backend:** `GET/PUT /api/workspace/clients/:id/content` (leitura/escrita textual)
- [x] **Contexto Luna enriquecido:** `buildDashboardContext()` injeta conteúdo do arquivo no prompt (até 4000 chars)
- [x] **Integração LunaControl.jsx:** Lê `file` dos query params e envia `contextFile` em mensagens de chat/thread
- [x] **Changelog v3.4.0:** Entrada documentando o File Viewer
- [x] **Build passando:** Vite build 0 erros, bundle 2.0MB
- [x] **Push para origin/main:** Commits `4eaaf6a` + `3e4256e` enviados

### ⏳ Próximos passos (priorizados por realidade do código)

Baseado na análise em `.kimi-context/plans-vs-reality.md`:

**🔴 CRÍTICO (blocante):**
- [ ] **Substituir `GEMINI_API_KEY`** no `backend/.env` (revogada pelo Google) — sem isso, IA generativa (drafts, resumos, ideias) não funciona

**🟡 IMPORTANTE (UX) — ✅ CONCLUÍDO:**
- [x] **Workspace File Viewer v2:** Syntax highlighting, preview Markdown/HTML, indicador não salvo, atalhos
- [x] **Contexto Luna enriquecido:** Arquivo do workspace injetado no prompt da IA
- [x] **Modo C — Transformação de Interface:** `LunaBatchAction` com checkboxes multi-seleção por página
- [x] **Preview visual:** `LunaInlinePreview` integrado no LunaActionDrawer (modos preview/confirm)
- [x] **Modo D — Assistente Passivo Proativo:** Badge animado no botão flutuante com `/api/luna/proactive`

**🟢 MÉDIO (polimento) — ✅ CONCLUÍDO:**
- [x] **Cross-Module Insights:** Endpoint `/api/luna/insights` com resumo cruzado + recomendações
- [ ] **Deploy para Render:** Verificar build remoto e modelo NLU carregando
- [ ] **Melhorar extração de params:** `extractEmail()` e `extractAfterKeyword()` para frases naturais

**✅ JÁ IMPLEMENTADO (não repetir):**
- [x] Fase 1 — Fundação de Consciência (7/7)
- [x] Fase 3 — Execução Inteligente (4/5, falta preview visual)
- [x] Fase 4 — Consciência por Módulo (3/3)
- [x] Fase 5 — NLP.js + Contexto (4/4)

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
frontend/src/lib/lunaDecisionEngine.js              # Motor de decisão (score → modo de execução)
frontend/src/hooks/useLunaAnimation.js              # Web Animations API hook
frontend/src/components/luna/LunaActionDrawer.jsx   # Drawer 380px sem blur
frontend/src/components/luna/LunaSafetyDelay.jsx    # Safety delay 1.5s com undo
frontend/src/components/luna/LunaActionFlow.jsx     # Orquestrador de apresentação
frontend/src/components/luna/LunaFloatingButton.jsx # Integração com Decision Engine
frontend/src/components/luna/SmartFormModal.jsx     # Fallback modal (Active Learning)
frontend/src/components/luna/LunaIntentSchemas.js   # Schemas para 137 intents
frontend/src/components/luna/LunaModuleSuggestions.js # Sugestões contextuais por módulo
frontend/src/context/LunaContext.jsx                # Provider global de contexto
frontend/src/lib/lunaEventBus.js                    # Event emitter desacoplado
backend/services/luna-nlu.js                        # Motor NLP.js — 137 intents, PT/ES/CA
backend/data/luna-model.nlp                         # Modelo treinado persistido
```

---

## 📝 Notas da instância

**Instância:** `kimi-10a71fc7` 🟡  
**Commit atual:** `920c182` — `feat(nlu): Expansão massiva de intents 36→137 + schemas + sugestões`  
**Build:** ✅ Vite build passando (0 erros)  
**Testes manuais:** ⚠️ Vite HMR cache instável — usar build de produção para testes finais  
**API Key Gemini:** 🔴 Revogada — NLU offline cobre 100% dos comandos operacionais  
**Modelo NLU:** ✅ Persistido em `backend/data/luna-model.nlp` (7.8MB) e `backend/model.nlp` (2.7MB)  

**Validação NLU (score 1.000 em todos):**
- "rascunhos pendentes" → `email.listar_rascunhos`
- "tarefas P0" → `tarefa.p0`
- "extrato financeiro" → `financeiro.extrato`
- "minhas tarefas" → `tarefa.minhas`
- "aprovar rascunho" → `email.aprovar_rascunho`
- "rejeitar draft" → `email.rejeitar_rascunho`
- "gastos do mês" → `financeiro.gastos_do_mes`
- "balanço financeiro" → `financeiro.ver_balanco`

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
