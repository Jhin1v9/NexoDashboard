# PROMPT MASTER — NEXO DASHBOARD PRO v4.0

> Criado por Luna (NEXO DIGITAL) — 2026-05-01
> Para: Kimi Code (VS Code)
> Objetivo: Evoluir o Dashboard para v4.0 com base em análise completa

---

## 🧠 CONTEXTO DA EMPRESA

**NEXO DIGITAL** (antigo Jhin1v9 Tech) — Sabadell/Barcelona, Espanha
- **Equipe:** Abner (Tech Lead), Nonoke/Enoque (Design/Operacional), Elias (Dev/Ideias)
- **Stack:** React 18 + TypeScript + Vite + Tailwind + Supabase + Capacitor
- **Split Financeiro:** 25% cada (Abner, Nonoke/Enoque, Elias, NEXO Digital)

**Site Institucional:** https://chatopsmaster.com (antigo) / https://nexo.chatopsmaster.com/pt/index.html (novo, em desenvolvimento)
**Site de Vendas:** https://chatopsmaster.com — Landing page com formulários de contato

---

## 📊 DADOS ATUAIS DO DASHBOARD (Analisado em 2026-05-01)

### Clientes e Pagamentos

| Cliente | Projeto | Total | Status | Parcelas |
|---------|---------|-------|--------|----------|
| **Juan — Tropicale** | TPV Sorveteria | € 5.500 | `waiting_quote` | 3x: 30% (€1.650) + 40% (€2.200) + 30% (€1.650) |
| **Paulo — Santafe** | Site Construcciones | € 350 | `partial` | 2x: 50% (€175 ✅ pago) + 50% (€175 ⏳ pendente 15/06) |

**Mensalidades:**
- Tropicale: € 199/mês (mínimo 12 meses)
- Santafe: € 19,99/mês (administração do site)

### Despesas da Empresa

| Despesa | Valor | Tipo | Status | Split |
|---------|-------|------|--------|-------|
| Hostinger 1 ano | € 120 | Recorrente (anual) | ✅ Pago (adiantamento Paulo) | €40 cada |
| Assinatura Kimi | € 0 (VALOR A DEFINIR) | Recorrente (mensal) | ⏳ Pendente | 3-way split |

### Caixa
- **Saldo atual:** € -120 (negativo — Hostinger deduzido)
- **Recebido:** € 175 (parcela 1 Paulo)
- **Pendente:** € 5.675 (€175 parcela 2 Paulo + €5.500 Tropicale)
- **Gastos/mês:** € 10 (Hostinger equivalente mensal)
- **Projeção 3 meses:** € 165

---

## 🏗️ ARQUITETURA DO DASHBOARD ATUAL

### Backend (Node.js + Express + WebSocket)
- **Porta:** 3456 (localhost apenas, VPN-only)
- **Dados:** File-based persistence (JSON)
- **WebSocket:** Real-time broadcast para todas as abas
- **Cron Jobs:** Alertas a cada 6h, despesas recorrentes no 1º dia do mês

### Arquivos de Dados (backend/data/)
```
payments.json       — Pagamentos de clientes
expenses.json       — Despesas da empresa
cash-box.json       — Caixa da empresa (saldo, histórico, projeções)
expense-templates.json — Templates para despesas recorrentes
alerts.json         — Alertas gerados automaticamente
tasks.json          — Tarefas manuais
whatsapp-tasks.json — Tarefas extraídas do WhatsApp
users.json          — Usuários (Abner, Nonoke, Elias)
github_users.json   — Dados GitHub
vercel_users.json   — Dados Vercel
transactions.json   — Transações financeiras (CRUD completo)
quotes.json         — Orçamentos
ops-state.json      — Estado do Centro de Operações
members.json        — Membros da equipe
changelog.json      — Release notes
whatsapp-agent-data.json — Dados do agente WhatsApp
report-history.json — Histórico de relatórios
```

### Rotas API Principais
```
GET/POST/PUT/DELETE /api/payments        — CRUD pagamentos
GET/POST/PUT/DELETE /api/expenses        — CRUD despesas
GET/POST/PUT/DELETE /api/transactions   — CRUD transações
GET       /api/cash-box                  — Caixa atual
GET       /api/cash-box/projection       — Projeção financeira
GET       /api/cash-box/statement        — Extrato completo
GET       /api/finance/summary          — Resumo financeiro
GET/POST  /api/tasks                     — Tarefas
GET/POST  /api/whatsapp                  — WhatsApp tasks
GET       /api/whatsapp-agent            — WhatsApp Intelligence
GET       /api/state                     — Estado completo
GET       /api/github-repos              — Repositórios GitHub
GET       /api/vercel-projects           — Projetos Vercel
GET       /api/tools                     — Status CLI tools
GET       /api/quotes                    — Orçamentos
GET       /api/changelog                 — Release notes
POST      /api/git-push                 — Git push helper
POST      /api/run                      — Run allowed commands
POST      /api/external/refresh         — Refresh serviços externos
```

### Frontend (React + Vite)
- **Páginas:** Operações, Dashboard, Orçamentos, Financeiro, Clientes, Projetos, Tarefas, WhatsApp, GitHub, Vercel, Ferramentas, Changelog
- **Componentes:** Sidebar, Header, Cards, Gráficos, Tabelas, Modais
- **Estado:** WebSocket real-time + local state

---

## 🔍 ANÁLISE — O QUE ESTÁ FALTANDO / PRECISA MELHORAR

### ❌ CRÍTICO — Falhas Encontradas

1. **Inconsistência Financeira:**
   - Home mostra Caixa € -120, mas Financeiro mostra € 0,00
   - Hostinger pago (€120) aparece como despesa mas não como entrada (foi pago com adiantamento do Paulo)
   - Transações e Cash-Box não estão sincronizados

2. **WhatsApp Intelligence — Dados Incompletos:**
   - 100 mensagens extraídas, mas apenas 2 tarefas detectadas
   - Links: 0 (deveria detectar links enviados)
   - Ideias: 0 (deveria detectar ideias/sugestões)
   - Decisões: 0 (deveria detectar decisões tomadas)
   - **Falta:** Parser inteligente de mensagens — detectar links, ideias, decisões, pagamentos, etc.

3. **Site chatopsmaster.com — Formulários PERDIDOS:**
   - Site tem formulário de contato/lead capture
   - **PERGUNTA CRÍTICA:** Onde ficam os formulários preenchidos? 
   - Não há integração no Dashboard para receber leads do site
   - Não há webhook/API para receber dados do formulário
   - **Isso é um buraco negro — leads podem estar sendo perdidos!**

4. **Tarefas Desatualizadas:**
   - "Criar logo Santafe" — ✅ Já feito (Nonoke criou e enviou)
   - "Comprar domínio" — ✅ Já feito (santafe-construcciones.com)
   - Não estão marcadas como concluídas no Dashboard

5. **Health Score Errado:**
   - Juan e Paulo mostram 20% (1/5 pastas)
   - Juan tem: DADOS, CHAT, RELATORIOS, PROJETOS/TPV_SORVETERIA (deveria ser mais)

### ⚠️ MÉDIO — Melhorias Necessárias

6. **Projeção Financeira:**
   - Projeção de 3 meses mostra €165 — mas não considera mensalidades (€199 + €19,99)
   - Não mostra timeline de quando cada pagamento vai entrar

7. **Alertas:**
   - Apenas 1 alerta (caixa negativo)
   - Não alerta sobre: tarefas atrasadas, pagamentos próximos, renovações de despesa

8. **Integração GitHub/Vercel:**
   - GitHub: Mostra apenas 2 repos, não mostra issues/PRs
   - Vercel: Página vazia (não carrega projetos)

9. **Relatórios WhatsApp:**
   - Relatórios gerados mas não acessíveis facilmente no Dashboard
   - Histórico de relatórios não navegável

### 💡 IDEIAS — Novas Features

10. **Pipeline de Leads:**
    - Integrar formulários do chatopsmaster.com
    - Dashboard de leads: novo → qualificado → proposta → fechado
    - Notificação quando lead preenche formulário

11. **Gestão de Documentos:**
    - Upload de contratos, faturas, comprovantes
    - Vincular a pagamentos/despesas

12. **Timeline de Projeto:**
    - Visual timeline com milestones, entregas, pagamentos
    - Similar ao GitHub Projects / Notion

13. **Kanban de Tarefas:**
    - Tarefas em formato Kanban (To Do → Doing → Done)
    - Integrar com WhatsApp tasks

14. **Notificações em Tempo Real:**
    - Toast notifications para novos pagamentos, tarefas, alertas
    - Badge no ícone do WhatsApp quando há novas mensagens

---

## 🔄 FLUXO GERAL DO DASHBOARD (Como Deveria Funcionar)

### 1. ENTRADA DE DADOS
- **WhatsApp:** Agent extrai mensagens → detecta tarefas/ideias/decisões → salva no buffer
- **Site:** Lead preenche formulário → webhook para `/api/leads` → aparece no Dashboard
- **Manual:** Usuário cria tarefa/pagamento/despesa direto no Dashboard
- **GitHub/Vercel:** Commits, deploys, issues → API polling → atualiza status

### 2. PROCESSAMENTO
- **Scan WhatsApp:** A cada 10 min → extrai, analisa, guarda no buffer
- **Relatório WhatsApp:** A cada 30 min → envia no grupo Production (se houver novidades)
- **Alertas Automáticos:** Cron job a cada 6h → verifica tarefas atrasadas, pagamentos próximos, caixa baixo
- **Projeção Financeira:** Recalcula ao adicionar nova transação → atualiza caixa e projeções

### 3. SAÍDA / NOTIFICAÇÕES
- **WhatsApp:** Relatórios no grupo Production, alertas no grupo ou DM do Abner
- **Dashboard:** Real-time updates via WebSocket em todas as abas abertas
- **Push Notifications:** Toast quando evento importante acontece
- **Email:** (futuro) Alertas por email para eventos críticos

### 4. FLUXO DE UM LEAD (Exemplo Completo)
```
1. Lead visita chatopsmaster.com → preenche formulário de contato
2. Formulário envia POST para /api/leads (webhook)
3. Dashboard cria: novo lead + tarefa "Contactar lead X"
4. WhatsApp Agent detecta tarefa → inclui no próximo relatório
5. Equipe vê no Dashboard → qualifica lead → cria orçamento
6. Orçamento aprovado → vira pagamento no Dashboard
7. Pagamento recebido → atualiza caixa automaticamente
8. Projeto iniciado → tarefas criadas → GitHub repo vinculado
9. Projeto entregue → status atualizado → cliente notificado
```

### 5. FLUXO FINANCEIRO
```
Entrada: Pagamento cliente → /api/transactions (type: income)
         → split automático: 25% cada (Abner/Nonoke/Elias/NEXO)
         → caixa atualizado → projeção recalculada

Saída:   Despesa recorrente (Host/Kimi) → /api/expenses
         → split entre 3 (Abner/Nonoke/Elias)
         → deduzido do caixa da empresa (25% dos pagamentos)
         → alerta se caixa < €200

Mensalidade: Cliente paga €199/mês → entra como income recorrente
              → split 25% cada → caixa mensal atualizado
```

### 6. CHECKLIST DE FUNCIONAMENTO (O Kimi Code deve verificar)
- [ ] WhatsApp Agent: extrai mensagens, detecta tarefas, NÃO spama
- [ ] WhatsApp Agent: envia SÓ no grupo Production, NUNCA no Paulo (web)
- [ ] Site chatopsmaster.com: formulários chegam no Dashboard (via webhook)
- [ ] Pagamentos: ao marcar como pago, caixa atualiza automaticamente
- [ ] Despesas: recorrentes são deduzidas automaticamente no 1º dia do mês
- [ ] Alertas: tarefas atrasadas (>7 dias) geram alerta no Dashboard + WhatsApp
- [ ] GitHub: mostra repos, issues, PRs atualizados
- [ ] Vercel: mostra deploys, status, URLs
- [ ] WebSocket: todas as abas recebem updates em tempo real
- [ ] Health Score: calcula corretamente baseado nas pastas do cliente

---

## 🤖 WHATSAPP AGENT — ANÁLISE DO FUNCIONAMENTO

### Agente Atual: Luna-CTO-Agent v10.2
- **Arquivo:** `agents/luna-cto-agent.mjs`
- **Scheduler:** `agents/luna-scheduler.mjs` (SCAN: 10min, RELATÓRIO: 30min)
- **Daemon:** `agents/luna-daemon.mjs` (reinício automático)
- **Task Scheduler:** `Luna-Daemon-v10` (Running)

### Regras Definidas (LUNA-RULES.md)
1. SCAN a cada 10 min — extrai mensagens, guarda no buffer, **NÃO ENVIA**
2. RELATÓRIO a cada 30 min — junta novidades e envia no grupo Production
3. Se não há novidades → envia 1x "sem novidades", depois **SILÊNCIO**
4. Só volta a enviar quando detectar novas mensagens
5. **DESTINO:** Só grupo 🏆Production - 2026🙏
6. **NUNCA:** chats pessoais, outros grupos, números individuais

### Problemas Detectados
**O usuário (Abner) reclamou:** "Os relatórios do agente com as regras que especifiquei não estão obedecendo"

**Análise Luna:**
- ✅ O código PARECE seguir as regras (lógica de silêncio implementada)
- ⚠️ Mas o envio usa **fallback JS** (`document.querySelectorAll('[contenteditable="true"]')`) que pode não funcionar corretamente
- ⚠️ O número de destino no `REPORT_DESTINATIONS` é `34685093192` (Abner) — mas o `groupName` é "🏆Production - 2026🙏"
- ⚠️ O `sendReportViaWhatsApp` abre o grupo pelo nome, mas pode estar caindo no chat pessoal se o seletor falhar
- ⚠️ Não há logs de confirmação de que a mensagem foi REALMENTE enviada no grupo (só diz "enviado" mas não verifica)

**Possíveis causas do problema:**
1. O relatório está sendo enviado para o chat pessoal do Abner em vez do grupo Production
2. O fallback JS está clicando no chat errado
3. O agente está enviando múltiplas vezes (spamdando)
4. O silêncio não está funcionando (continua enviando mesmo sem novidades)

**AÇÃO NECESSÁRIA:**
- Adicionar log de confirmação visual (screenshot após envio)
- Verificar se a mensagem apareceu no grupo correto
- Adicionar validação: se o input não for encontrado, NÃO enviar (falhar silenciosamente)
- Separar destino: número do Abner para notificações push, grupo Production para relatórios

---

## 🎯 MISSÃO PARA O KIMI CODE

### Fase 1: Correções Críticas (Prioridade MÁXIMA)

1. **Corrigir inconsistência financeira**
   - Sincronizar transactions.json com cash-box.json
   - Garantir que entradas e saídas reflitam a realidade
   - Hostinger: entrada de €120 (adiantamento Paulo) + saída de €120 (pagamento Hostinger) = saldo correto

2. **Implementar parser inteligente do WhatsApp**
   - Detectar links em mensagens e salvá-los
   - Detectar ideias (palavras-chave: "ideia", "sugestão", "podemos", "deveríamos")
   - Detectar decisões (palavras-chave: "decidimos", "vamos fazer", "fechamos", "combinado")
   - Detectar pagamentos (palavras-chave: "paguei", "transferi", "bizum", "recebi")

3. **Investigar formulários do chatopsmaster.com**
   - **PERGUNTA PRINCIPAL:** Onde ficam os dados dos formulários preenchidos no site?
   - Verificar se há: Formspree, Netlify Forms, Google Forms, backend próprio, Supabase, etc.
   - Se não houver nada configurado: IMPLEMENTAR integração imediatamente
   - Criar endpoint `/api/leads` para receber webhooks do formulário

4. **Atualizar tarefas concluídas**
   - Marcar "Criar logo Santafe" como concluída
   - Marcar "Comprar domínio" como concluída
   - Adicionar novas tarefas do WhatsApp

### Fase 2: Melhorias Médias

5. **Melhorar projeção financeira**
   - Incluir mensalidades recorrentes na projeção
   - Timeline visual de pagamentos esperados
   - Gráfico de cash flow

6. **Sistema de alertas completo**
   - Alerta de tarefa atrasada (>7 dias)
   - Alerta de pagamento próximo (3 dias antes)
   - Alerta de renovação de despesa (7 dias antes)
   - Alerta de novo lead

7. **Corrigir integrações**
   - GitHub: Mostrar issues, PRs, commits recentes
   - Vercel: Mostrar deploys, status, URLs

### Fase 3: Novas Features

8. **Pipeline de Leads**
   - Dashboard de leads com Kanban
   - Integração com formulário do site
   - Automação: lead novo → tarefa → orçamento

9. **Kanban de Tarefas**
   - Interface Kanban para tarefas
   - Integrar tasks.json + whatsapp-tasks.json
   - Drag & drop entre colunas

10. **Timeline de Projetos**
    - Visual timeline para cada cliente
    - Milestones, entregas, pagamentos
    - Integrar com GitHub milestones

---

## 📋 CHECKLIST DE ENTREGA

- [ ] Inconsistência financeira corrigida
- [ ] Parser WhatsApp inteligente implementado
- [ ] Formulários do site investigados e integrados
- [ ] Tarefas atualizadas (concluídas/marcadas)
- [ ] Projeção financeira melhorada
- [ ] Sistema de alertas completo
- [ ] GitHub/Vercel corrigidos
- [ ] Pipeline de leads criado
- [ ] Kanban de tarefas implementado
- [ ] Timeline de projetos criada
- [ ] Todos os tests passando
- [ ] Documentação atualizada

---

## 🔗 LINKS IMPORTANTES

- **Dashboard:** http://localhost:3456
- **Site NEXO (novo):** https://nexo.chatopsmaster.com/pt/index.html
- **Site Vendas (antigo):** https://chatopsmaster.com
- **GitHub TPV:** https://github.com/Jhin1v9/TPV-SORVETERIA-DEMO
- **GitHub Dashboard:** https://github.com/Jhin1v9/nexo-dashboard-pro
- **GitHub NEXO Site:** https://github.com/EEA-Ops-Master/nexo-digital
- **Orçamento Sorveteria:** https://github.com/Jhin1v9/tpv-orcamento-sorveteria/tree/main/pressuposto
- **Demo Verifactu:** https://o4gfmc2fhtklc.kimi.show

---

## ❓ FORMULÁRIOS DO SITE — RESPOSTA DO USUÁRIO

**Abner respondeu:** "Vai pro GitHub os formulários"

**Status atual (verificado por Luna):** NÃO HÁ integração configurada ainda. O site chatopsmaster.com tem formulários de contato mas:
- ❌ Não há issues no GitHub com leads (verificado: repo `Jhin1v9/nexo-dashboard-pro` — 0 issues)
- ❌ Não há webhook/API configurado no Dashboard para receber leads
- ❌ Não há integração Formspree/Netlify Forms/Google Forms visível no código do site
- ❌ Os formulários estão em HTML estático (`/pt/contacto.html`) — provavelmente usam `mailto:` ou `action=""` (sem backend)

**AÇÃO NECESSÁRIA:** Implementar integração de leads no Dashboard
- Criar endpoint `/api/leads` no backend
- Configurar webhook no site para enviar leads para o Dashboard
- Ou: usar GitHub Issues API para criar issues automaticamente quando alguém preenche o formulário
- Ou: usar Formspree/Netlify Forms com webhook para o Dashboard

**O Kimi Code deve perguntar ao Abner:**
"Onde você quer que os formulários do chatopsmaster.com guardem os dados? Opções:
1. GitHub Issues (criar issue automaticamente)
2. Dashboard via webhook (endpoint /api/leads)
3. Email + planilha Google Sheets
4. Banco de dados Supabase"

---

## 🎨 REFERÊNCIAS DE SUCESSO (Mercado)

### Dashboards Financeiros / Admin de Empresas
- **Stripe Dashboard** — Clean, métricas em tempo real, gráficos de receita
- **Notion Databases** — Flexibilidade, relações entre dados, visualizações múltiplas
- **Linear** — Kanban elegante, timeline de projetos, integração GitHub
- **Vercel Dashboard** — Deploys, previews, métricas de performance
- **Monday.com** — Pipeline visual, automações, integrações
- **FreshBooks** — Finanças simples, faturas, despesas

### Padrões a Implementar
- **Dark Mode** + Glassmorphism (já temos)
- **Real-time updates** via WebSocket (já temos)
- **Kanban boards** para tarefas e leads
- **Timeline/Gantt** para projetos
- **Calendar view** para pagamentos e entregas
- **Search global** (Ctrl+K) — já temos, expandir
- **Command palette** para ações rápidas
- **Toast notifications** para eventos

---

**"Funciona > Perfeito > Bonito > Nada"**

---

*Prompt criado por Luna — NEXO DIGITAL CTO Virtual 🦀*
*Data: 2026-05-01*
*Versão: 1.0*
