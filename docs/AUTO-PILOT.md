# NEXO AUTO-PILOT — Luna Modo Automático

> Criado: 2026-05-01
> Versão: 1.0
> Função: Luna analisa sozinha, detecta gaps, envia perguntas, se atualiza

---

## 🎯 MISSÃO

Transformar Luna em um **agente autônomo** que:
1. **Analisa** o Dashboard continuamente (a cada 2h)
2. **Detecta** gaps e inconsistências sozinha
3. **Envia** perguntas no grupo Production 2026 automaticamente
4. **Atualiza** o Dashboard quando recebe respostas
5. **Não precisa** do usuário mandar — ela mesma percebe o que falta

---

## 🔄 FLUXO AUTOMÁTICO

```
┌─────────────────────────────────────────┐
│  1. ANÁLISE (a cada 2h)                │
│     • Lê todos os JSON do backend       │
│     • Verifica inconsistências          │
│     • Compara com dados do WhatsApp     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. DETECÇÃO DE GAPS                   │
│     • Pagamento sem status real?        │
│     • Despesa sem valor?                │
│     • Tarefa atrasada?                  │
│     • Site sem integração?               │
│     • Health Score baixo?               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. ENVIO AUTOMÁTICO                   │
│     • Gera pergunta no template         │
│     • Envia no Production 2026         │
│     • Marca: 🌙 Luna — CTO Virtual     │
│     • Aguarda resposta                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  4. CAPTURA DE RESPOSTA                │
│     • Lê WhatsApp a cada 30min          │
│     • Identifica: "Essa msg é resposta   │
│       à minha pergunta anterior?"      │
│     • Extrai dados da resposta          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  5. AUTO-UPDATE                         │
│     • PATCH no backend JSON            │
│     • Atualiza Dashboard                │
│     • Confirma no grupo: "✅ Atualizado" │
│     • Salva em memória                  │
└─────────────────────────────────────────┘
```

---

## 📋 CHECKLIST DE GAPS (O que Luna detecta sozinha)

### Financeiro
- [ ] Caixa Home ≠ Caixa Financeiro → **Alerta CRÍTICO**
- [ ] Pagamento 'pending' > 3 dias → **Perguntar status**
- [ ] Pagamento 'partial' sem data real → **Perguntar quando pagou**
- [ ] Despesa sem valor real (ex: Kimi = €0) → **Perguntar valor**
- [ ] Caixa < €200 → **Alerta: caixo baixo**
- [ ] Projeção não inclui mensalidades → **Corrigir**

### Clientes
- [ ] Health Score < 50% → **Investigar pastas**
- [ ] Cliente sem pasta DADOS/ → **Alerta**
- [ ] Cliente sem CHAT/ → **Alerta**
- [ ] Cliente sem PROJETOS/ → **Alerta**
- [ ] Contrato fechado mas status ≠ 'contracted' → **Corrigir**

### Tarefas
- [ ] Tarefa pendente > 7 dias → **Perguntar impedimento**
- [ ] Tarefa concluída no WhatsApp mas pendente no Dashboard → **Corrigir**
- [ ] Tarefa sem responsável → **Alerta**
- [ ] Tarefa sem prazo → **Alerta**

### WhatsApp
- [ ] 0 mensagens novas por > 2h → **Modo acelerado (10min)**
- [ ] Parser não detectou links → **Melhorar regex**
- [ ] Parser não detectou ideias → **Melhorar keywords**
- [ ] Parser não detectou decisões → **Melhorar keywords**
- [ ] Relatório enviado para chat errado → **Corrigir destino**

### Site / Leads
- [ ] Formulário existe mas sem integração → **Alerta: leads perdidos**
- [ ] 0 leads no Dashboard → **Verificar se formulário funciona**
- [ ] Site fora do ar → **Alerta imediato**

### GitHub / Vercel
- [ ] GitHub: 0 issues → **Verificar se repo correto**
- [ ] Vercel: 0 deploys → **Verificar configuração**
- [ ] Commit > 3 dias → **Perguntar progresso**

---

## 🤖 TEMPLATES DE PERGUNTAS AUTOMÁTICAS

### Template 1: Pagamento Pendente
```
🌙 Luna — CTO Virtual — Kimi Claw

Time, detectei um pagamento pendente no Dashboard:

💰 Cliente: {clientName}
📋 Valor: € {amount}
📅 Previsto: {dueDate}
⏳ Status: {status} há {daysPending} dias

❓ Esse pagamento foi recebido?
Se sim, me passa:
• Data do pagamento:
• Método (Bizum/Transferência/Dinheiro):
• Quem pagou:

Vou atualizar o sistema automaticamente.

🌙 Luna — CTO Virtual — Kimi Claw
```

### Template 2: Despesa Sem Valor
```
🌙 Luna — CTO Virtual — Kimi Claw

Time, preciso do valor real de uma despesa:

📊 Despesa: {expenseName}
📅 Tipo: {type} ({period})
💰 Valor estimado: € {estimatedAmount}

❓ Qual o valor EXATO que pagamos?
• Valor real: € ?
• Data do pagamento:
• Dividido entre quantos:

🌙 Luna — CTO Virtual — Kimi Claw
```

### Template 3: Site Sem Integração
```
🌙 Luna — CTO Virtual — Kimi Claw

🚨 ALERTA: Buraco no funil de vendas detectado!

🌐 Site: chatopsmaster.com
📋 Formulário de contato: ✅ Existe
📤 Onde os leads chegam: ❓ DESCONHECIDO

❓ Onde vocês recebem os dados dos formulários?
1. Email (qual?)
2. Planilha Google Sheets
3. Não chega nada (estamos perdendo leads! 💸)
4. Outro:

Preciso saber pra integrar no Dashboard.

🌙 Luna — CTO Virtual — Kimi Claw
```

### Template 4: Tarefa Atrasada
```
🌙 Luna — CTO Virtual — Kimi Claw

Time, detectei uma tarefa atrasada:

📋 Tarefa: {taskName}
📅 Criada: {createdDate}
⏳ Status: Pendente há {daysOverdue} dias
👤 Responsável: {assignee || "Não definido"}

❓ Essa tarefa já foi concluída?
• Sim → Marco como done no Dashboard
• Não → Qual o impedimento?

🌙 Luna — CTO Virtual — Kimi Claw
```

### Template 5: Domínio Não Conectado
```
🌙 Luna — CTO Virtual — Kimi Claw

Time, verificando status de domínio:

🌐 Domínio: {domainName}
📋 Cliente: {clientName}
✅ Registrado: Sim
🔌 Conectado com hosting: ❓ Desconhecido

❓ O domínio já está apontando pro servidor?
• Sim → DNS configurado
• Não → Ainda precisa configurar
• Não sei → Vou verificar

🌙 Luna — CTO Virtual — Kimi Claw
```

### Template 6: Health Score Baixo
```
🌙 Luna — CTO Virtual — Kimi Claw

Time, detectei um cliente com pouca documentação:

👤 Cliente: {clientName}
📊 Health Score: {healthScore}% ({completedFolders}/{totalFolders} pastas)

Pastas existentes: {existingFolders}
Pastas faltando: {missingFolders}

❓ Precisamos completar a estrutura do cliente?
Posso criar as pastas faltantes se me confirmarem.

🌙 Luna — CTO Virtual — Kimi Claw
```

### Template 7: Confirmação de Update
```
🌙 Luna — CTO Virtual — Kimi Claw

✅ Dashboard atualizado automaticamente!

📊 O que foi atualizado:
• {field1}: {oldValue} → {newValue}
• {field2}: {oldValue} → {newValue}

💾 Dados salvos em: {filePath}
🕐 Hora: {timestamp}

Se algo estiver errado, me avisem que eu corrijo.

🌙 Luna — CTO Virtual — Kimi Claw
```

---

## 🔍 SISTEMA DE IDENTIFICAÇÃO

### Como Luna sabe que uma mensagem é resposta À DELA?

1. **Última mensagem do grupo:** Verifica se foi enviada por Luna (contém "🌙 Luna — CTO Virtual — Kimi Claw")
2. **Tempo:** Mensagens enviadas até 2h depois da pergunta = respostas
3. **Conteúdo:** Se contém "sim/não/€/data/nome" = resposta válida
4. **Autor:** Se for Abner/Nonoke/Elias = resposta do time

### Como Luna evita loop infinito?

1. **Checkpoint:** Salva hash da última pergunta enviada
2. **Só pergunta de novo** se:
   - Passou > 2h desde a última pergunta
   - OU: Recebeu resposta e precisa de mais info
3. **Nunca pergunta 2x** a mesma coisa sem resposta
4. **Modo silencioso:** Se não há gaps, não envia nada

---

## 📁 ARQUIVOS DE CONFIGURAÇÃO

| Arquivo | Função |
|---------|--------|
| `backend/data/auto-config.json` | Config geral do modo automático |
| `backend/data/auto-questions.json` | Histórico de perguntas enviadas |
| `backend/data/auto-responses.json` | Respostas capturadas do WhatsApp |
| `agents/luna-auto-pilot.mjs` | Script de automação (futuro) |
| `HEARTBEAT.md` | Checklist de checagens automáticas |

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [x] Criar auto-config.json
- [x] Atualizar HEARTBEAT.md com modo automático
- [x] Criar templates de perguntas
- [x] Documentar sistema de identificação
- [ ] Criar script luna-auto-pilot.mjs
- [ ] Implementar análise automática de gaps
- [ ] Implementar envio automático no WhatsApp
- [ ] Implementar captura de respostas
- [ ] Implementar auto-update do Dashboard
- [ ] Testar end-to-end

---

## 🚀 PRÓXIMOS PASSOS

1. **Usuário (Abner)** manda prompt pro Kimi Code → Implementa correções no Dashboard
2. **Luna** continua monitorando em modo automático
3. **Quando detectar gap** → Envia pergunta no Production 2026
4. **Quando time responder** → Atualiza Dashboard automaticamente
5. **Loop contínuo** → Dashboard sempre atualizado sem intervenção manual

---

*"Funciona > Perfeito > Bonito > Nada"*

🌙 *Luna — CTO Virtual — NEXO Digital*
