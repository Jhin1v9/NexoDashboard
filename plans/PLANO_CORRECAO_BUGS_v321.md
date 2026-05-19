# 📋 PLANO DE CORREÇÃO — NEXO Dashboard PRO v3.2.1

> **Data:** 2026-05-19  
> **Sessão:** 🟣 KIMI-C3E5BB1C  
> **Baseado em:** Testes completos de todas as ações da Luna + análise da estrutura atual

---

## 🎯 Visão Geral

Após testar TODAS as ações da Luna via API e chat, identificamos 5 bugs críticos. A solução ótima envolve **ativar o NLU (node-nlp) que já existe no projeto** — ele está treinado com 1000+ frases em PT/ES/CA mas NÃO está integrado no fluxo principal do `/api/luna/chat`.

### Arquitetura Proposta (Híbrida Inteligente)

```
Usuário envia comando
        ↓
   [NLP.js NLU] ←—— modelo treinado offline (PT/ES/CA)
        ↓
   Confidence ≥ 0.7?
   ├── SIM → Executa ação direto (mais rápido, mais preciso)
   └── NÃO → [Regex Fast-Path] (comandos simples)
              ↓
        Ainda não reconheceu?
              ↓
        [Gemini LLM] (quando API disponível)
              ↓
        Gemini offline?
              ↓
        [Smart Form Assistant] ← fallback final com contexto
```

Isso resolve TODOS os bugs de regex de uma só vez e torna a Luna muito mais inteligente.

---

## 🔴 FASE 1 — Bugs Críticos (Correção Imediata)

### 1.1 BUG: `buildDashboardContext` — `totalExpensesMonth.toFixed is not a function`
**Arquivo:** `backend/server.js`  
**Causa:** Variável não é número  
**Fix:** Converter com `parseFloat()` ou `Number()` antes de `.toFixed(2)`

### 1.2 BUG: `m.body?.slice is not a function` (Email body)
**Arquivo:** `agents/core/ActionExecutor.js` linha 792  
**Causa:** `m.body` é objeto `{html, text}`, não string  
**Fix:** ✅ JÁ CORRIGIDO na sessão 🟣 — usar `m.body?.text?.slice()`  
**Status:** Aguardando reinício do servidor para aplicar

### 1.3 BUG: Leads — `name` vs `displayName`
**Arquivo:** `backend/server.js` (POST /api/leads)  
**Causa:** Endpoint exige `displayName` mas frontend/envio usa `name`  
**Fix:** Normalizar: `displayName = req.body.displayName || req.body.name`

### 1.4 BUG: Ideias — tipo inválido
**Arquivo:** `backend/routes/ideas.js`  
**Causa:** Só aceita tipos específicos, erro não amigável  
**Fix:** Aceitar `"feature"` como alias de `"brainstorm"` ou melhorar mensagem

---

## 🧠 FASE 2 — Integrar NLU.js no Fluxo Principal (A Grande Mudança)

### 2.1 O que já existe (e funciona!)

| Componente | Estado | Descrição |
|---|---|---|
| `backend/services/luna-nlu.js` | ✅ Pronto | Motor NLP.js com 10 domínios e 40+ intents |
| `backend/data/luna-model.nlp` | ✅ Treinado | Modelo de 1MB treinado em PT/ES/CA |
| `frontend/src/hooks/useLunaNLU.js` | ✅ Pronto | Hook React para `/api/luna/understand` |
| `frontend/src/components/luna/LunaIntentSchemas.js` | ✅ Pronto | Schemas de formulários por intent |
| `/api/luna/understand` | ✅ Funcionando | Endpoint que processa texto → intent |
| `/api/luna/intents` | ✅ Funcionando | Lista todos os intents disponíveis |
| `/api/luna/learn` | ✅ Funcionando | Aprendizado contínuo |

**Mas:** O `/api/luna/chat` NÃO usa o NLU. Usa `IntentParser.js` (regex + Gemini).

### 2.2 Mapeamento: Intents NLU → Ações ActionExecutor

O NLU retorna intents como `email.responder`, `tarefa.criar`, `financeiro.consultar_caixa`. Precisamos mapear para as ações do ActionExecutor:

```
NLU Intent              → ActionExecutor Action
─────────────────────────────────────────────────────────
email.responder         → responder_email
email.enviar            → enviar_email
email.listar_nao_lidos  → consultar_emails
email.arquivar          → arquivar_email
email.mover_lixeira     → mover_para_lixeira
tarefa.criar            → criar_tarefa
tarefa.listar           → consultar_tarefas
tarefa.concluir         → confirmar_tarefa
financeiro.consultar_caixa → consultar_caixa
financeiro.adicionar_receita → registrar_pagamento
financeiro.adicionar_despesa → registrar_despesa
lead.criar              → criar_lead
lead.listar             → consultar_leads
ideia.criar             → criar_ideia
ideia.listar            → listar_ideias
projeto.listar          → listar_projetos
sistema.status          → consultar_status
sistema.ajuda           → ideia (modo ajuda)
whatsapp.enviar_mensagem → enviar_mensagem_whatsapp
orcamento.criar         → criar_orcamento
```

### 2.3 Modificar `/api/luna/chat`

Alterar o fluxo do endpoint para:

1. Receber mensagem do usuário
2. Chamar `lunaNLU.process(text)` primeiro
3. Se `score >= 0.7` e intent não for `'None'`:
   - Mapear intent NLU → ação ActionExecutor
   - Executar ação diretamente
   - Retornar resposta formatada
4. Se `score < 0.7` ou intent `'None'`:
   - Usar regex fast-path atual (IntentParser)
   - Se regex não reconhecer → Gemini LLM (quando disponível)
   - Se Gemini offline → fallback amigável

### 2.4 Vantagens desta abordagem

| Aspecto | Regex Atual | NLU Proposto |
|---|---|---|
| Velocidade | ⚡ Rápido | ⚡ Rápido (offline) |
| Precisão | 🔴 Baixa (ambígua) | 🟢 Alta (contexto) |
| Idiomas | 🇧🇷 PT apenas | 🇧🇷 PT + 🇪🇸 ES + 🏴 CA |
| Typos | ❌ Não tolera | ✅ Tolerante |
| Variações | ❌ Frases exatas | ✅ Entende sinônimos |
| Manutenção | ❌ Regex hardcoded | ✅ Treinamento por dados |
| Fallback | ❌ Gemini ou nada | ✅ Cascata: NLU → Regex → Gemini |

---

## 🛠️ FASE 3 — Implementação Detalhada (Passo a Passo)

### Passo 1: Corrigir `buildDashboardContext`
**Arquivo:** `backend/server.js`  
**Tempo estimado:** 5 min  
**Teste:** `curl /api/luna/chat` com "consultar status" → não deve mais ter erro no console

### Passo 2: Corrigir endpoint de Leads
**Arquivo:** `backend/server.js` (POST /api/leads)  
**Tempo estimado:** 5 min  
**Teste:** POST /api/leads com `{name: "Teste"}` → deve criar lead

### Passo 3: Criar mapeador NLU → ActionExecutor
**Arquivo novo:** `agents/core/NLUActionMapper.js`  
**Tempo estimado:** 20 min  
**Descrição:** Mapeia cada intent do NLU para a ação correspondente do ActionExecutor, extraindo entities como parâmetros

### Passo 4: Modificar `/api/luna/chat` para usar NLU primeiro
**Arquivo:** `backend/server.js`  
**Tempo estimado:** 30 min  
**Descrição:** Inserir chamada ao NLU antes do IntentParser no fluxo do chat

### Passo 5: Adicionar intents faltantes ao NLU
**Arquivo:** `backend/services/luna-nlu.js`  
**Tempo estimado:** 20 min  
**Descrição:** Adicionar intents que faltam: `ideia.listar`, `projeto.listar`, `link.listar`, `notificacao.listar`, `whatsapp.verificar_mencoes`

### Passo 6: Retreinar modelo NLU
**Arquivo:** `backend/services/luna-nlu.js`  
**Tempo estimado:** 5 min (automático no startup)  
**Descrição:** O modelo será retreinado automaticamente com os novos exemplos

### Passo 7: Testar TUDO novamente
**Tempo estimado:** 15 min  
**Descrição:** Bateria completa de testes via curl para validar todas as correções

### Passo 8: Build e commit
**Tempo estimado:** 5 min  
**Descrição:** `npm run build` no frontend + `git commit`

---

## 📊 Estimativa de Tempo Total

| Fase | Tempo Estimado |
|---|---|
| FASE 1 — Bugs críticos | ~15 min |
| FASE 2 — Integrar NLU | ~75 min |
| FASE 3 — Testes e build | ~20 min |
| **TOTAL** | **~1h 50min** |

---

## ✅ Critérios de Aceitação

- [ ] Todos os comandos de email funcionam corretamente via Luna chat
- [ ] "listar ideias", "listar projetos", "listar links" funcionam via chat
- [ ] "verificar mencoes", "listar notificacoes" funcionam via chat
- [ ] `buildDashboardContext` não gera mais erro no console
- [ ] Criar lead funciona com campo `name` (sem precisar `displayName`)
- [ ] Build passa sem erros
- [ ] Servidor reinicia sem erros
- [ ] NLU responde com confidence ≥ 0.7 para comandos comuns

---

## 🔄 Alternativa (Se o usuário preferir algo mais simples)

Se não quiser integrar o NLU agora, posso apenas:
1. Corrigir os regexes do IntentParser (15 min)
2. Corrigir os bugs de servidor (10 min)
3. Total: ~25 min

Mas a solução com NLU é **muito superior** e resolve o problema raiz: a Luna vai entender comandos em 3 idiomas, tolerar typos, e ter fallback em cascata.
