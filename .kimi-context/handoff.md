# 🔄 HANDOFF — Próximas Ações Pendentes

> **Regra de ouro:** SEMPRE leia este arquivo no início de uma nova sessão. Ele contém o estado de trabalho que não cabe no KIMI.MD.
> 
> **Sessão ativa:** `kimi-10a71fc7` 🟡 — última atualização: 2026-05-19

---

## 🎯 Foco Atual (Luna NLU + Smart Form Assistant)

### ✅ Concluído nesta sessão (kimi-10a71fc7 🟡)
- [x] **FASE 1 — NLP.js Backend completo:** 23 intents, 3 idiomas (pt/es/ca), modelo treinado
- [x] **Fallback robusto:** Corpus None com 66 exemplos/idioma, falso positivo corrigido
- [x] **Entities NER:** 5 entities registradas (cliente, projeto, tarefa, orçamento, prioridade)
- [x] **Typos tolerados:** Variações de erros de digitação nos intents principais
- [x] **Testes automatizados:** 34/34 passam (intents + fallback + entities + multi-idioma)
- [x] **FASE 3 — Smart Form Assistant:** Modal reutilizável + botão flutuante + hook useLunaNLU
- [x] **Schemas de intents:** 15+ intents mapeados para formulários/redirects/info
- [x] **Integração frontend:** Botão flutuante em todas as rotas protegidas
- [x] **Testes end-to-end validados:** Criar tarefa, criar despesa, fallback, redirect

### ⏳ Próximo passo
- [ ] **FASE 4 — Expandir corpus:** Aumentar de ~25 para 50-100 exemplos por intent
- [ ] **FASE 5 — Melhorar extração de título:** Regex atual remove "do cliente Nexo" — precisa ser mais inteligente
- [ ] **FASE 6 — Tratamento de erro visível:** Quando API falha, mostrar mensagem clara no frontend
- [ ] **FASE 7 — Active Learning:** Quando usuário corrige classificação, enviar para `/api/luna/learn`
- [ ] **🔴 URGENTE:** Substituir `GEMINI_API_KEY` no `backend/.env` (revogada pelo Google)

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
backend/services/luna-nlu.js                   # Engine NLP.js (1.226 linhas)
backend/scripts/test-luna-nlu.js               # Suite de testes (34 casos)
backend/data/luna-model.nlp                    # Modelo treinado (~690KB)

frontend/src/components/luna/LunaIntentSchemas.js    # Mapeamento intent → schema
frontend/src/components/luna/SmartFormModal.jsx      # Modal inteligente
frontend/src/components/luna/LunaFloatingButton.jsx  # Botão flutuante global
frontend/src/hooks/useLunaNLU.js                     # Hook axios
frontend/src/App.jsx                                  # Integração
```

---

## 📝 Notas da instância

**Instância:** `kimi-10a71fc7` 🟡  
**Última ação:** Fase 1 (NLP.js) completa + Fase 3 (SmartFormModal) completa. Testes end-to-end validados via browser.  
**Contexto salvo em:** `.kimi-context/sessions/2026-05-19-kimi-10a71fc7.md`

**Problemas conhecidos:**
1. API Key Gemini revogada — todos os endpoints de IA retornam vazio
2. Regex de extração de título é muito agressiva (remove "do cliente Nexo")
3. SmartFormModal não mostra loading ao confirmar
4. Bundle Vite >500KB (chunk size warning)
