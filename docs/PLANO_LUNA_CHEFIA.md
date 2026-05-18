# Plano Luna Chefe do Dashboard

**Luna cto - - Abner**

## Diagnóstico da Fase 1

Após testes extensivos via curl e no browser, identificamos os seguintes gaps:

### ✅ O que já funciona
- **Saudações**: "oi luna" → resposta instantânea via regex (sem API)
- **Status**: "como está o nexo" → resposta com dados reais (sem API)
- **Listar tarefas**: "quais tarefas pendentes" → lista real (sem API)
- **Criar tarefa**: "cria tarefa X pra Abner P0" → preview editável (mas frontend não renderiza campos)
- **Criar lead**: "novo lead Maria" → confirmação simples (funciona)
- **Pagamento com split**: "recebemos 1000 do cliente João" → split 25% funciona (fallback JSON)

### ❌ O que NÃO funciona ou está incompleto
1. **Frontend `LunaChatPanel` não renderiza `editableFields`** — mostra só botões Confirmar/Cancelar, sem campos editáveis
2. **Regex de despesa não pega variações** — "gastamos 200 com material" cai no LLM e falha quando quota esgota
3. **Não existe ação de deletar/excluir** — não dá pra apagar tarefas, pagamentos, despesas, leads
4. **Não existe ação de email** — não dá pra consultar emails ou preparar respostas
5. **Resposta de pagamento não mostra split** — diz "split automático aplicado" mas não mostra os valores
6. **Ideias não têm campo `assignedTo`** — não dá pra designar ideias para membros
7. **Modais de confirmação são pobres** — só texto, sem campos ricos pré-preenchidos com contexto

---

## Fase 1.5: Luna Chat 100% Funcional — A Chefe

### 1.5.1 Frontend: Modais Ricos no LunaChatPanel
- [ ] Extrair `EditablePreviewCard` do `LunaControl.jsx` para componente reutilizável
- [ ] Adicionar renderização de `editableFields` no `LunaChatPanel.jsx`
- [ ] Suportar `editedFields` no `confirmPendingActions` do `LunaChatPanel`
- [ ] Adicionar modais ricos para: pagamentos, despesas, leads, deleções

### 1.5.2 Backend: IntentParser sem API (regex robusto)
- [ ] Melhorar regex de despesa: "gastamos", "pagamos", "saída de", "compramos"
- [ ] Adicionar regex de deleção: "apaga", "deleta", "remove", "exclui" + [tarefa|pagamento|despesa|lead]
- [ ] Adicionar regex de email: "emails", "ver emails", "responder email"
- [ ] Adicionar regex de ideia com assign: "ideia para [nome]"

### 1.5.3 Backend: ActionExecutor — Ações destrutivas
- [ ] `excluir_tarefa(titulo/id)` — apaga do tasks.json
- [ ] `excluir_pagamento(id)` — apaga do cash-box history
- [ ] `excluir_despesa(id)` — apaga do cash-box history
- [ ] `excluir_lead(id/nome)` — apaga do clients-registry

### 1.5.4 Backend: ActionExecutor — Ações de email
- [ ] `consultar_emails()` — lista emails da API /api/email/messages
- [ ] `responder_email(id, draft)` — prepara resposta (retorna dados para modal rico)

### 1.5.5 Backend: Modais de confirmação ricos
- [ ] `buildEditablePaymentFields` — valor, de, descrição, checkbox split
- [ ] `buildEditableExpenseFields` — valor, para, descrição, split entre
- [ ] `buildEditableLeadFields` — nome, telefone, email, notas
- [ ] `buildEditableDeleteFields` — confirmação com nome do item e tipo

### 1.5.6 Backend: Melhorar respostas
- [ ] `createPayment` fallback retornar `splits` detalhados
- [ ] `buildConciergeReply` suportar `excluir_*`, `email_*`

### 1.5.7 Ideias: Campo assignedTo
- [ ] Migration SQL: `ALTER TABLE ideas ADD COLUMN assigned_to TEXT`
- [ ] Backend API: salvar/recuperar `assignedTo` em /api/ideas
- [ ] Frontend `IdeaEditor`: dropdown "Designar para" com opções: Todos, Abner, Nonoke, Elias
- [ ] Frontend `Ideias`: mostrar badge do responsável na lista

---

## Fase 2: Fundação Workspace
*(mantida como estava)*

## Fase 3: File Manager UI
*(mantida como estava)*

## Fase 4: Execução Local de Demos
*(mantida como estava)*
