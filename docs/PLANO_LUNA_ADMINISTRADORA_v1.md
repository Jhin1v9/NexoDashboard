# 🧠 PLANO COMPLETO: Luna Administradora do Dashboard
## NEXO Dashboard Pro v16.1 — Visão Extraordinária

> **Filosofia**: Não basta "fazer a ação". A Luna deve **pensar como um administrador real** — antecipar, sugerir, confirmar com contexto, operar em massa, detectar padrões e reportar problemas.

---

## 📊 DIAGNÓSTICO ATUAL

### O que JÁ EXISTE (funciona)
- **215 ações** no ActionExecutor
- **~60 intents** mapeados na NLU
- **253 endpoints** no backend
- **33 páginas** no frontend
- Dados: 42 tarefas, 8 despesas, 3 ideias, 2 usuários, 0 leads, 0 pagamentos, 0 caixa

### O que ESTÁ QUEBRADO / Incompleto
1. System Admin (PC) — endpoints POST de kill/pm2 não existem no formato correto
2. Shell retorna `undefined` no service mas funciona via API
3. Logs do sistema extraem "sistema" como serviço (não está na whitelist)
4. Files ignora diretório pedido e vai pra home
5. Muitas ações são "unitárias" — não pensam em volume
6. Não existe sistema de tutorial/help contextual
7. Não existe health monitor que reporta pro Discord
8. Não existe automação/regras inteligentes
9. Não existe "undo" para ações destrutivas
10. Não existe preview antes de executar ações em massa

---

## 🎯 VISÃO EXTRAORDINÁRIA

### Princípios de Design
1. **Unitário → Massa → Inteligente**: Toda ação unitária deve ter variante em massa
2. **Confirmação Contextual**: Não perguntar "tem certeza?" — mostrar O QUE vai acontecer
3. **Undo/Redo**: Toda ação destrutiva tem 30s de undo
4. **Preview Antes**: Operações em massa mostram preview editável
5. **Detecção Proativa**: Luna percebe padrões e sugere ações
6. **Tutorial Contextual**: "Você parece perdido. Quer que eu te mostre?"
7. **Cascata Inteligente**: Uma ação dispara consequências (converter lead → criar tarefa → enviar email)

---

## 🗺️ FASES DO PLANO

---

## FASE 1: Fundação Extraordinária (2-3 dias)

### 1.1 Sistema de Ações em Massa (BatchActions)

**Problema atual**: "apagar tarefa" apaga 1. O usuário quer apagar 5? Tem que repetir 5x.

**Solução extraordinária**:
```
Usuário: "apagar as tarefas de ontem"
Luna: "Encontrei 3 tarefas de ontem:
  • [x] Revisar proposta (alta)
  • [x] Atualizar site (média)
  • [ ] Ligar pro cliente (baixa) ← desmarcada
  
  [Apagar selecionadas] [Apagar todas] [Cancelar]"
```

**Implementação**:
- Novo tipo de resposta: `batch_preview`
- Campos: `items[]`, `selected[]`, `actions[]`, `confirmLabel`, `cancelLabel`
- ActionExecutor ganha método `executeBatch(action, filters)`
- Frontend renderiza checkboxes + botões de ação em massa

**Módulos afetados**:
- Tarefas: apagar/concluir/atualizar em massa
- Leads: mover status em massa, converter em massa
- Emails: arquivar/marcar lido/em massa
- Despesas: pagar em massa
- Pagamentos: receber em massa

### 1.2 Sistema de Undo/Redo

**Problema atual**: Apagou? Se vira.

**Solução extraordinária**:
```
Usuário: "apagar tarefa revisar proposta"
Luna: "✅ Tarefa apagada. [Desfazer] ← expira em 30s"

(30s depois)
Luna: "Ação confirmada. Não é mais possível desfazer."
```

**Implementação**:
- `backend/services/undo-service.js`
- Stack de ações (max 20) por thread
- Cada ação salva: `type`, `before`, `after`, `timestamp`
- Endpoint: `POST /api/luna/undo` e `POST /api/luna/redo`
- NLU intents: `desfazer`, `refazer`

### 1.3 Preview com Contexto

**Problema atual**: "executa shell" pede confirmação genérica.

**Solução extraordinária**:
```
Usuário: "executa df -h"
Luna: "Vou executar: `df -h`
  
  ⚠️ Isso vai mostrar uso de disco.
  [Executar] [Ver explicação] [Cancelar]"
```

**Implementação**:
- `SmartFormModal.jsx` já existe — expandir para preview contextual
- Cada ação define `previewText(action)` que explica O QUE vai acontecer
- Para ações destrutivas: mostrar dados que serão afetados

---

## FASE 2: Tutorial & Help Desk Inteligente (2 dias)

### 2.1 Base de Conhecimento

**Problema atual**: Usuário novo não sabe como usar o dashboard.

**Solução extraordinária**:
```
Usuário: "como cadastro um lead?"
Luna: "Vou te guiar! São 3 passos:
  
  1️⃣ Vá para Leads (ou diga 'ir para leads')
  2️⃣ Clique no botão + Novo Lead
  3️⃣ Preencha: nome, email, empresa, status
  
  Quer que eu crie um lead de exemplo pra você ver?"
```

**Implementação**:
- `backend/data/luna-knowledge-base.json`
- Estrutura: `{ topic, keywords[], steps[], relatedActions[], videoUrl?, screenshotPath? }`
- NLU intent: `tutorial.{topic}`
- Se usuário fizer 3 comandos inválidos seguidos → Luna oferece ajuda
- Se usuário digitar "?" ou "help" → mostra menu de tópicos

**Tópicos iniciais**:
- Como usar o financeiro
- Como gerenciar leads
- Como criar tarefas recorrentes
- Como configurar email
- Como conectar WhatsApp
- Como gerar relatórios
- Como usar o workspace
- Como configurar integrações

### 2.2 Detecção de "Usuário Perdido"

```
Usuário: "cadastrar" → inválido
Usuário: "adicionar" → inválido  
Usuário: "novo" → inválido
Luna: "Parece que você quer criar algo novo. O que?
  [Lead] [Tarefa] [Cliente] [Despesa] [Pagamento] [Ideia]"
```

**Implementação**:
- Contador de intents `None` ou baixa confiança por thread
- Após 3x consecutivas → disparar mensagem proativa
- Contexto: analisar palavras-chave dos comandos falhos para sugerir

### 2.3 FAQ Automático

```
Usuário: "por que meu email não sincroniza?"
Luna: "Os problemas mais comuns são:
  1. Token OAuth expirado → reconecte em Configurações > Email
  2. Limite de API do Gmail → aguarde 1h
  3. Filtro de segurança → verifique se não é spam
  
  Quer que eu verifique o status da sua conexão?"
```

**Implementação**:
- Mapear erros comuns do backend → respostas explicativas
- Se Luna detecta erro X 3x → adiciona ao FAQ automaticamente
- Endpoint: `GET /api/luna/faq?q={query}`

---

## FASE 3: Health Monitor & Alertas Proativos (2-3 dias)

### 3.1 Monitor de Serviços do Dashboard

**Problema atual**: Só descobre que algo quebrou quando tenta usar.

**Solução extraordinária**:
```
Luna (proativa): "⚠️ Abner, detectei problemas:
  
  🔴 Email: sincronização parada há 2h
  🟡 WhatsApp: 12 mensagens não classificadas
  🟢 Backend: OK
  🟢 PM2: 1/1 processos online
  
  Quer que eu tente corrigir o email? [Sim] [Ver detalhes] [Ignorar]"
```

**Implementação**:
- `backend/services/health-monitor.js`
- Checa a cada 5 minutos:
  - Email: último sync, erros recentes
  - WhatsApp: estado da conexão, mensagens pendentes
  - Backend: erro 500 nos últimos logs
  - PM2: processos online vs esperados
  - Ollama: modelo disponível
  - Banco de dados: conectividade
  - Disco: espaço < 10%
  - Memória: uso > 90%
- Se problema detectado → cria alerta + notificação
- Endpoint: `GET /api/luna/health-report`

### 3.2 Reporte Automático pro Discord

```
Luna: "Detectei erro crítico no sync de email. 
  Reportar no Discord? [Sim] [Não, mas me avise depois]"
```

**Implementação**:
- Usar `discord-notifier.js` existente
- Criar embeds profissionais com:
  - Tipo de problema
  - Severidade (info/warning/critical)
  - Logs relevantes (últimas 5 linhas)
  - Ação sugerida
  - Quem foi notificado
- Configurar no `backend/data/config/integrations-config.json`

### 3.3 Diagnóstico Sob Demanda

```
Usuário: "tudo ok com o sistema?"
Luna: "🩺 Diagnóstico completo:
  
  ✅ Backend: respondendo em 45ms
  ✅ Banco: conectado, 142 registros
  ✅ Email: último sync há 12 min
  ⚠️ WhatsApp: 5 mensagens aguardando classificação
  ✅ PM2: luna-telegram-bot online
  ✅ Ollama: gemma3:1b carregado
  ✅ Disco: 58% usado (85GB livre)
  
  Recomendo: classificar mensagens do WhatsApp. Quer que eu faça?"
```

---

## FASE 4: Ações Administrativas Extraordinárias (3-4 dias)

### 4.1 Tarefas: Além do CRUD

**Atual**: criar, concluir, listar, apagar

**Extraordinário**:
- `tarefas_atrasadas`: "mostra tarefas atrasadas" → lista + opção de adiar ou concluir em massa
- `tarefas_por_prioridade`: "quais tarefas são urgentes?" → ordena por prioridade + impacto
- `criar_tarefa_recorrente`: "toda segunda, revisar leads" → cria série de tarefas
- `delegar_tarefa`: "delegar revisar site pro Elias" → muda assignedTo + notifica
- `bloquear_tarefa`: "não posso fazer X sem Y" → marca dependência
- `tarefas_do_dia`: "o que tenho pra hoje?" → filtra por dueDate = hoje + prioridade
- `tarefas_por_cliente`: "quais tarefas do cliente X?" → filtra por contexto
- `resumo_semanal`: "como foi minha semana?" → tarefas concluídas, pendentes, novas

### 4.2 Leads: Pipeline Inteligente

**Atual**: criar, listar, atualizar status, converter

**Extraordinário**:
- `leads_frios`: "quais leads estão esfriando?" → sem contato há X dias
- `follow_up_automatico`: "sugerir follow-up" → detecta leads sem contato + sugere ação
- `mover_pipeline`: "mover lead X pra qualificado" → atualiza status + log
- `atribuir_vendedor`: "lead Y é do Elias" → muda responsável
- `leads_por_fonte`: "de onde vêm meus leads?" → analytics por origem
- `taxa_conversao`: "qual minha taxa de conversão?" → calcula converted/total
- `lead_score`: "qual lead tem mais chance?" → scoring baseado em interações
- `importar_leads`: "importar leads do CSV" → upload + mapeamento de campos

### 4.3 Financeiro: Análise Real

**Atual**: registrar pagamento/despesa, consultar caixa, listar

**Extraordinário**:
- `fluxo_de_caixa`: "como tá meu fluxo?" → receitas - despesas por período
- `previsao_receitas`: "quanto vou receber no mês?" → soma pagamentos pendentes
- `despesas_recorrentes`: "quais despesas repetem?" → agrupa por tipo + período
- `balanco_mensal`: "balanço de maio" → receitas vs despesas + gráfico
- `clientes_devedores`: "quem me deve?" → pagamentos pendentes por cliente
- `categorizar_despesa`: "essa despesa é o quê?" → IA sugere categoria
- `alerta_orcamento`: "estou perto do limite?" → compara gasto vs orçamento
- `gerar_relatorio_financeiro`: "relatório do trimestre" → PDF/CSV com gráficos

### 4.4 Email: Gestão Inteligente

**Atual**: listar, ler, marcar lido, arquivar, responder, rascunho com IA

**Extraordinário**:
- `emails_nao_respondidos`: "quem não me respondeu?" → threads onde você foi o último
- `emails_urgentes`: "tem email urgente?" → detecta palavras-chave (urgente, asap, prazo)
- `responder_com_template`: "responder com template de orçamento" → usa template + personaliza
- `limpar_inbox`: "limpar inbox antigo" → arquiva emails > 30 dias lidos
- `email_para_tarefa`: "transformar email em tarefa" → cria tarefa com contexto do email
- `email_para_lead`: "esse email é um lead" → extrai dados + cria lead
- `estatisticas_email`: "como tá meu email?" → taxa de resposta, tempo médio, volume
- `follow_up_email`: "lembrar de responder" → cria tarefa de follow-up

### 4.5 WhatsApp: Atendimento Inteligente

**Atual**: enviar mensagem, ver histórico, escanear, verificar menções

**Extraordinário**:
- `atendimentos_pendentes`: "tem cliente esperando?" → mensagens não respondidas
- `resumo_atendimento`: "resumir conversa com cliente X" → IA resume thread
- `transferir_atendimento`: "passar cliente Y pro Elias" → notifica + transfere
- `classificar_mensagens`: "classificar mensagens pendentes" → IA detecta intenção
- `resposta_rapida`: "responder com 'vou verificar'" → template de resposta
- `atendimentos_do_dia`: "quantos atendimentos hoje?" → contagem + resumo
- `satisfacao_cliente`: "como tá o atendimento?" → análise de sentimento das mensagens

### 4.6 Clientes & Workspace: Visão 360°

**Atual**: listar, criar, atualizar

**Extraordinário**:
- `ficha_cliente`: "mostra ficha do cliente X" → dados + tarefas + pagamentos + leads
- `projetos_do_cliente`: "quais projetos do cliente Y?" → filtra workspace
- `faturamento_por_cliente`: "quanto faturou com cliente Z?" → soma pagamentos
- `clientes_inativos`: "quem não movimenta há 6 meses?" → detecta inatividade
- `aniversario_cliente`: "aniversários do mês" → datas importantes
- `historico_interacoes`: "histórico com cliente X" → email + whatsapp + tarefas

---

## FASE 5: Automações & Regras Inteligentes (3-4 dias)

### 5.1 Motor de Automação

```
Usuário: "toda vez que um lead for criado, cria uma tarefa de follow-up em 2 dias"
Luna: "✅ Automação criada!
  
  Quando: lead.criar
  Faz: criar_tarefa 'Follow-up {lead.nome}' dueDate=+2d
  Ativa: sim"
```

**Implementação**:
- `backend/services/automation-engine.js`
- Regras: `{ trigger, conditions, actions, enabled, createdBy }`
- Triggers: `lead.criar`, `tarefa.atrasar`, `email.receber`, `pagamento.registrar`
- Ações: qualquer ação do ActionExecutor
- Scheduler verifica triggers a cada minuto

### 5.2 Regras de Negócio

```
Usuário: "se caixa ficar negativo, me avisa no discord"
Luna: "✅ Regra criada!
  
  Quando: caixa < 0
  Faz: alertar_discord '⚠️ Caixa negativo: {valor}'"
```

### 5.3 Lembretes Inteligentes

```
Luna (proativa): "⏰ Lembrete: você tem 3 tarefas pra hoje:
  • Revisar proposta (vence em 2h)
  • Ligar pro cliente (vence em 4h)
  • Enviar orçamento (vence amanhã)
  
  Quer ver?"
```

**Implementação**:
- Cron job a cada hora verificando tarefas próximas do vencimento
- Notifica via: chat (se online), Discord, ou aguarda próxima interação

---

## FASE 6: Analytics & Insights (2-3 dias)

### 6.1 Dashboard de Insights

```
Usuário: "como vai meu negócio?"
Luna: "📊 Resumo Executivo:
  
  💰 Financeiro:
     • Receitas do mês: R$ 0 (sem dados)
     • Despesas: R$ 8.320,00
     • Saldo: -R$ 8.320,00 ⚠️
  
  📈 Vendas:
     • Leads: 0 (crie leads!)
     • Taxa de conversão: N/A
  
  ✅ Produtividade:
     • Tarefas concluídas: 12/42 (28%)
     • Tarefas atrasadas: 3 ⚠️
  
  📧 Comunicação:
     • Emails não lidos: 0
     • WhatsApp pendentes: 0
  
  Recomendo: cadastrar leads e registrar receitas."
```

### 6.2 Comparação de Períodos

```
Usuário: "compare esse mês com o anterior"
Luna: "📊 Comparativo:
  
  | Métrica      | Maio | Abril | Δ     |
  |--------------|------|-------|-------|
  | Receitas     | R$0  | R$0   | =     |
  | Despesas     | R$8k | R$5k  | +60%  |
  | Leads        | 0    | 2     | -100% |
  | Tarefas      | 5    | 8     | -37%  |
  
  Tendência: 🟡 Cuidado com despesas"
```

### 6.3 Detecção de Anomalias

```
Luna (proativa): "🚨 Detectei anomalia:
  
  Suas despesas aumentaram 200% em relação à média mensal.
  Maiores aumentos:
  • Hosting: +R$ 300
  • Software: +R$ 150
  
  Quer ver detalhes?"
```

---

## FASE 7: Integração & Controle Total (2-3 dias)

### 7.1 Controle de Serviços pelo Dashboard

**Atual**: system admin controla PC (nginx, pm2, systemd)

**Novo foco**: controlar serviços DO DASHBOARD
```
Usuário: "reiniciar o sync de email"
Luna: "🔄 Reiniciando sync de email... ✅ Concluído. Próximo sync em 5 min."

Usuário: "status do whatsapp"
Luna: "📱 WhatsApp Agent:
  • Status: conectado
  • Último scan: há 2h
  • Mensagens pendentes: 5
  • Erros hoje: 0
  
  [Reconectar] [Ver logs] [Limpar buffer]"
```

### 7.2 GitHub / Vercel: CI/CD Visível

```
Usuário: "status dos deploys"
Luna: "🚀 Deploys:
  • nexo-dashboard: ✅ produção (v1.2.3)
  • luna-bot: 🟡 building...
  • landing-page: ✅ produção
  
  Último deploy: há 3h por Abner"
```

### 7.3 Backup & Restore

```
Usuário: "fazer backup agora"
Luna: "💾 Backup iniciado...
  • tasks.json: ✅ 42 registros
  • leads.json: ✅ 0 registros
  • expenses.json: ✅ 8 registros
  • Total: 12KB
  
  Backup salvo em: /backup/2026-05-24_14-30.json"

Usuário: "restaurar backup de ontem"
Luna: "⚠️ Isso vai sobrescrever dados atuais. 
  Preview do backup:
  • Tarefas: 40 (atual: 42)
  • Despesas: 8 (atual: 8)
  
  [Restaurar] [Ver diff] [Cancelar]"
```

---

## 📋 RESUMO DE IMPLEMENTAÇÃO

### Serviços Novos
| Serviço | Arquivo | Complexidade |
|---------|---------|-------------|
| BatchActions | `services/batch-actions.js` | Média |
| UndoService | `services/undo-service.js` | Baixa |
| HealthMonitor | `services/health-monitor.js` | Média |
| KnowledgeBase | `services/knowledge-base.js` | Baixa |
| AutomationEngine | `services/automation-engine.js` | Alta |
| AnalyticsEngine | `services/analytics-engine.js` | Média |
| BackupManager | `services/backup-manager.js` | Baixa |

### Endpoints Novos
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/luna/batch` | POST | Executar ações em massa |
| `/api/luna/undo` | POST | Desfazer última ação |
| `/api/luna/health-report` | GET | Diagnóstico completo |
| `/api/luna/faq` | GET | Buscar na base de conhecimento |
| `/api/luna/insights` | GET | Analytics e insights |
| `/api/luna/automations` | CRUD | Gerenciar automações |
| `/api/luna/backup` | POST/GET | Backup/restore |
| `/api/luna/tutorial` | GET | Obter tutorial por tópico |

### Ações Novas no ActionExecutor
| Ação | Categoria | Descrição |
|------|-----------|-----------|
| `tarefas_em_massa` | Tarefas | Preview + executar em lote |
| `tarefas_atrasadas` | Tarefas | Listar atrasadas |
| `criar_tarefa_recorrente` | Tarefas | Série de tarefas |
| `leads_frios` | Leads | Sem contato há X dias |
| `mover_leads_em_massa` | Leads | Pipeline em lote |
| `fluxo_de_caixa` | Financeiro | Análise temporal |
| `previsao_receitas` | Financeiro | Projeção |
| `balanco_mensal` | Financeiro | Comparativo |
| `emails_nao_respondidos` | Email | Threads pendentes |
| `emails_urgentes` | Email | Detecção de urgência |
| `atendimentos_pendentes` | WhatsApp | Não respondidos |
| `resumo_atendimento` | WhatsApp | IA resume conversa |
| `ficha_cliente` | Clientes | Visão 360° |
| `faturamento_por_cliente` | Clientes | Receitas por cliente |
| `diagnostico_sistema` | Sistema | Health check |
| `gerar_backup` | Sistema | Backup manual |
| `criar_automacao` | Automação | Nova regra |
| `resumo_executivo` | Analytics | Dashboard geral |
| `comparar_periodos` | Analytics | Comparativo |
| `desfazer_acao` | Utilitário | Undo |
| `tutorial` | Help | Explicar funcionalidade |
| `detectar_perdido` | Help | Oferecer ajuda |

### NLU: Novos Intents
| Intent | Exemplos |
|--------|----------|
| `tarefa.atrasada` | "tarefas atrasadas", "o que tá atrasado" |
| `tarefa.recorrente` | "toda semana revisar", "criar tarefa repetida" |
| `lead.frio` | "leads esfriando", "sem contato há dias" |
| `lead.mover_massa` | "mover todos pra qualificado" |
| `financeiro.fluxo` | "fluxo de caixa", "entradas e saídas" |
| `financeiro.previsao` | "quanto vou receber", "projeção" |
| `email.urgente` | "email urgente", "precisa de atenção" |
| `email.nao_respondido` | "quem não respondeu", "threads pendentes" |
| `whatsapp.pendente` | "cliente esperando", "não respondi" |
| `whatsapp.resumo` | "resumir conversa", "o que falamos" |
| `cliente.ficha` | "ficha do cliente", "tudo sobre X" |
| `sistema.diagnostico` | "tudo ok?", "diagnóstico", "health check" |
| `sistema.backup` | "fazer backup", "salvar dados" |
| `tutorial.pedir` | "como usar", "ajuda com", "tutorial" |
| `automation.criar` | "toda vez que", "automatizar", "quando X fazer Y" |
| `analytics.resumo` | "como vai o negócio", "resumo", "dashboard" |

---

## 🎨 EXPERIÊNCIA DO USUÁRIO EXTRAORDINÁRIA

### Padrões de Interação

**1. Operação em Massa**
```
Usuário: "concluir tarefas de ontem"
→ Luna detecta 3 tarefas
→ Mostra preview com checkboxes
→ Usuário desmarca 1
→ Executa 2
→ Oferece undo
```

**2. Confirmação Contextual**
```
Usuário: "apagar lead João"
→ Luna mostra: "Vou apagar: João Silva (joao@email.com), 
   status: novo, criado há 2 dias. 
   [Apagar] [Ver histórico primeiro] [Cancelar]"
```

**3. Cascata Inteligente**
```
Usuário: "converter lead Maria"
→ Luna: "Vou converter Maria em cliente. 
   Quer que eu também:
   • [x] Criar tarefa 'Onboarding Maria'?
   • [x] Enviar email de boas-vindas?
   • [ ] Criar projeto no workspace?
   
   [Converter + Selecionados] [Só converter]"
```

**4. Proatividade**
```
Luna: "⏰ Bom dia, Abner! Hoje você tem:
   • 2 tarefas vencendo hoje
   • 1 lead aguardando follow-up há 3 dias
   • 5 mensagens WhatsApp não classificadas
   
   Por onde quer começar?"
```

**5. Aprendizado**
```
Usuário: "não, eu queria dizer 'adicionar despesa', não 'apagar'"
Luna: "Entendido! Vou lembrar que quando você fala 'gastei',
   é pra adicionar despesa. ✅ Aprendido."
```

---

## 📅 ORDEM DE IMPLEMENTAÇÃO SUGERIDA

### Semana 1: Fundação
- [ ] UndoService + batch actions
- [ ] Preview contextual nas ações
- [ ] Fix system admin (se quiser manter)

### Semana 2: Tutorial & Help
- [ ] KnowledgeBase com 10 tópicos
- [ ] Detecção de usuário perdido
- [ ] FAQ automático

### Semana 3: Health & Alerts
- [ ] HealthMonitor
- [ ] Reporte Discord
- [ ] Diagnóstico sob demanda

### Semana 4: Ações Administrativas
- [ ] Tarefas extraordinárias
- [ ] Leads extraordinários
- [ ] Financeiro extraordinário

### Semana 5: Automações
- [ ] Motor de automação
- [ ] Regras de negócio
- [ ] Lembretes inteligentes

### Semana 6: Analytics
- [ ] Resumo executivo
- [ ] Comparativo de períodos
- [ ] Detecção de anomalias

---

## 🤔 DECISÕES PRA VOCÊ TOMAR

1. **Manter System Admin do PC?**
   - Prós: Útil pra devOps, monitoramento servidor
   - Contras: Não é foco do dashboard, pode ser perigoso
   - **Sugestão**: Manter mas esconder por trás de `sistema.avancado`. Foco na UI é dashboard.

2. **Prioridade #1?**
   - Tutorial/Help (usuários novos)
   - Health Monitor (estabilidade)
   - Ações em massa (produtividade)
   - Analytics (visão de negócio)

3. **Automações agora ou depois?**
   - Agora: mais complexo, mas diferencial forte
   - Depois: fundação primeiro

4. **Discord alerts: qual webhook?**
   - Precisa do webhook URL do Discord da NEXO

---

## 🎯 MÉTRICAS DE SUCESSO

- Usuário consegue fazer 80% das operações sem sair do chat
- Tempo médio de operação reduzido em 50%
- Zero "como faz?" sem resposta da Luna
- Problemas detectados antes do usuário perceber
- 90% das ações têm preview antes de executar

---

**Pronto. Esse é o plano completo. Quer que eu comece implementando? Se sim, qual fase?**
