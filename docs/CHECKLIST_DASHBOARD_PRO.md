
# ═══════════════════════════════════════════════════════════════════
# CHECKLIST UI/UX — DASHBOARD PRO vs LUNA v16.0
# Raciocínio: Designer UI/UX Supremo | Nível: EXTRAORDINÁRIO
# ═══════════════════════════════════════════════════════════════════

## 📊 O QUE O DASHBOARD PRO **JÁ TEM** (Análise do Código)

### Páginas Existentes (21 total):
| # | Página | Tamanho | Status | O que faz |
|---|--------|---------|--------|-----------|
| 1 | Dashboard.jsx | 17KB | ✅ Ativa | KPIs, WhatsApp stats, clientes, predictions, financial overview |
| 2 | Clientes.jsx | 17KB | ✅ Ativa | Fichas de clientes, health score, pastas (CODIGO, DEMOS, ENTREGAS, PROMPTS, RELATORIOS) |
| 3 | Projetos.jsx | 3.4KB | ⚠️ Simples | Health score, tendências, status básico |
| 4 | Tarefas.jsx | 4KB | ✅ Ativa | CRUD de tarefas, checkboxes, auto-save |
| 5 | Financeiro.jsx | 40KB | ✅ Ativa | CRUD completo: payments, expenses, cash box, transactions, quotes, alerts |
| 6 | Caixa.jsx | 12KB | ✅ Ativa | Saldo, histórico, projeção 6 meses, statement |
| 7 | Gastos.jsx | 10KB | ✅ Ativa | Despesas com split entre membros |
| 8 | MeusGastos.jsx | 9KB | ✅ Ativa | Gastos pessoais |
| 9 | Orcamentos.jsx | 11KB | ✅ Ativa | Quotes/orçamentos com status |
| 10 | Operacoes.jsx | 20KB | ✅ Ativa | Ops center, alerts, recent changes, system health |
| 11 | Relatorios.jsx | 11KB | ✅ Ativa | Relatórios (provavelmente financeiros) |
| 12 | WhatsApp.jsx | 30KB | ✅ Ativa | Dados do agente WhatsApp, mensagens, buffer, checkpoint |
| 13 | GitHub.jsx | 3KB | ✅ Ativa | Repos, issues, commits |
| 14 | VercelProjects.jsx | 3KB | ✅ Ativa | Deploys, projetos Vercel |
| 15 | Changelog.jsx | 10KB | ✅ Ativa | Release notes, updates |
| 16 | Leads.jsx | — | ✅ Via API | Webhook do site, stats, follow-up tasks |
| 17 | Members.jsx | — | ✅ Via API | Membros da equipe |
| 18 | AccessRequest.jsx | 5KB | ✅ Ativa | Pedidos de acesso |
| 19 | AdminAccess.jsx | 11KB | ✅ Ativa | Gerenciamento de acesso |
| 20 | Ferramentas.jsx | 2.5KB | ✅ Ativa | Ferramentas CLI |
| 21 | ReceitaDetalhe.jsx | 12KB | ✅ Ativa | Detalhe de receitas |

### APIs do Backend (server.js):
| Endpoint | O que retorna |
|----------|---------------|
| GET /api/state | clients, tasks, users, predictions |
| GET /api/whatsapp | messages, tasks, ideas, decisions, links, mentions (do luna-buffer.json) |
| GET /api/whatsapp-agent | stats do agente, lastUpdate |
| GET /api/luna/status | version, chromeConnected, whatsappConnected, buffer counts |
| GET /api/luna/buffer | buffer completo |
| GET /api/luna/reports/history | histórico de relatórios |
| GET /api/payments | receitas/pagamentos |
| GET /api/expenses | despesas |
| GET /api/cash-box | caixa com saldo e histórico |
| GET /api/quotes | orçamentos |
| GET /api/leads | leads do site |
| GET /api/github-repos | repos GitHub |
| GET /api/vercel-projects | projetos Vercel |
| GET /api/changelog | release notes |
| GET /api/members | membros |
| GET /api/ops | operations center |

---

## ❌ O QUE O DASHBOARD PRO **NÃO TEM** (Gap Analysis)

### 1. PÁGINA DE CONFIGURAÇÕES DO LUNA ⬜
**Onde:** Não existe página dedicada
**O que falta:**
- Editar modelo Ollama (gemma2:2b vs outros)
- Editar system prompt (personalidade)
- Configurar timeout, temperature
- Ativar/desativar integrações (Email, Notion, Site Forms)
- Configurar GitHub repos monitorados
- Ver status das integrações

**Impacto:** Sem isso, só dá pra editar os JSONs manualmente. Não é "editable via dashboard".

---

### 2. PÁGINA DE GRUPOS WHATSAPP ⬜
**Onde:** Não existe página dedicada
**O que falta:**
- Visualizar grupos monitorados (Production, Paulo)
- Ver regras de comunicação (lunaCanSpeak, humanOnly)
- Editar scanInterval, reportInterval
- Ver membros de cada grupo
- Configurar dashboardSendEnabled

**Impacto:** Sem isso, não dá pra gerenciar onde a Luna pode ou não falar.

---

### 3. PIPELINE VISUAL DE LEADS ⬜
**Onde:** Leads existem mas sem pipeline visual
**O que falta:**
- Kanban: novo → contatado → qualificado → proposta-enviada → negociacao
- Cards arrastáveis (drag & drop)
- Probabilidade de conversão (0.4, 0.5, 0.6, 0.7)
- Source do lead (referral, site-form, whatsapp-detectado)
- Lead scoring (hot/warm/cold)
- Próxima ação por lead

**Impacto:** Sem pipeline visual, não dá pra ver o funil de vendas.

---

### 4. MILESTONES DE PROJETOS ⬜
**Onde:** Projetos.jsx tem só 3.4KB (muito simples)
**O que falta:**
- Timeline visual de milestones
- Progress bar por projeto
- Bugs detectados por projeto
- Deploy status (deployed, demoReady)
- Repo link
- Team members assigned

**Impacto:** Projetos.jsx é muito básico. Não mostra o progresso real.

---

### 5. LINKS INTELLIGENCE ⬜
**Onde:** Não existe página dedicada
**O que falta:**
- Cards com preview de links (título, descrição, imagem)
- Tipo de link (Instagram, GitHub, Demo, PDF)
- Contexto da conversa onde o link foi mencionado
- Quem compartilhou
- Quando foi compartilhado

**Impacto:** Links são detectados mas não visualizados de forma inteligente.

---

### 6. NEWS ENGINE ⬜
**Onde:** Não existe página dedicada
**O que falta:**
- Notícias não categorizadas (catch-all)
- Relevância scoring
- Filtrar por categoria
- Resumo automático
- Autor e timestamp

**Impacto:** Mensagens que não são tarefa/lead/ideia/decisão ficam perdidas.

---

### 7. TEAM RADAR ⬜
**Onde:** Dashboard mostra "participants" mas sem profundidade
**O que falta:**
- Quem falou quanto (mensagens/hora)
- Streak de contribuição
- Última atividade por membro
- Sentimento por membro
- Palavras mais usadas

**Impacto:** Não dá pra ver quem está mais ativo no grupo.

---

### 8. ACTIVITY TIMELINE ⬜
**Onde:** Não existe visualização timeline
**O que falta:**
- Timeline das últimas 24h
- Granularidade por hora
- Ícones por tipo (mensagem, decisão, link, tarefa)
- Filtros por tipo

**Impacto:** Não dá pra ver o fluxo do dia de forma cronológica.

---

### 9. ALERTS & ACTIONS ESPECÍFICOS ⬜
**Onde:** Operacoes.jsx tem alerts genéricos
**O que falta:**
- Alertas de orçamento expirando (Juan: 15/05)
- Alertas de P0s não resolvidos
- Alertas de follow-ups pendentes
- Alertas de bugs críticos
- Alertas de deadlines de milestones

**Impacto:** Alerts são genéricos, não ligados aos dados reais dos schemas.

---

### 10. CLASSIFICAÇÃO DE MENSAGENS ⬜
**Onde:** WhatsApp.jsx mostra dados brutos
**O que falta:**
- Badge de categoria (tarefaRealizada, tarefaPendente, lead, ideia, decisão)
- Cor por prioridade (P0=vermelho, P1=laranja, P2=amarelo, P3=azul)
- Ícone por categoria (✅, 📋, 🎯, 💡, 📌)
- Sentimento (😊, 😐, 😠)
- Cliente mencionado (tag)
- Projeto mencionado (tag)

**Impacto:** Mensagens não são classificadas visualmente. Tudo parece igual.

---

### 11. SCHEMA VERSION CONTROL ⬜
**Onde:** Não existe página dedicada
**O que falta:**
- Ver versão atual do schema
- Histórico de mudanças
- Quem editou o quê
- Rollback disponível

**Impacto:** Sem controle de versão visível, não dá pra auditar mudanças.

---

### 12. DASHBOARD LUNA (REPORT VISUAL) ⬜
**Onde:** Não existe página dedicada
**O que falta:**
- HTML gerado para screenshot
- Preview do relatório antes de enviar
- Controle de envio (on/off, intervalo, cooldown)
- Comandos: /dashboard, /dashboard-off, /dashboard-on
- Tema NEXO Dark aplicado
- Seções: KPIs, Tarefas, Leads, Links, Clientes, Projetos, News, Alertas

**Impacto:** O relatório é gerado mas não dá pra ver/preview antes de enviar.

---

## 🎯 RESUMO: GAPS CRÍTICOS

| # | Gap | Severidade | Esforço |
|---|-----|-----------|---------|
| 1 | Configurações do Luna | 🔴 Alta | Médio |
| 2 | Grupos WhatsApp | 🔴 Alta | Médio |
| 3 | Pipeline de Leads | 🔴 Alta | Alto |
| 4 | Milestones de Projetos | 🟡 Média | Médio |
| 5 | Links Intelligence | 🟡 Média | Médio |
| 6 | News Engine | 🟡 Média | Médio |
| 7 | Team Radar | 🟢 Baixa | Baixo |
| 8 | Activity Timeline | 🟢 Baixa | Médio |
| 9 | Alerts Específicos | 🔴 Alta | Médio |
| 10 | Classificação Visual | 🔴 Alta | Alto |
| 11 | Schema Version | 🟢 Baixa | Baixo |
| 12 | Dashboard Luna Preview | 🔴 Alta | Alto |

---

## ✅ O QUE JÁ ESTÁ PRONTO (Não precisa tocar)

| Componente | Status |
|-----------|--------|
| Financial module (payments, expenses, cash box, transactions) | ✅ Completo |
| Clientes (fichas, health score, pastas) | ✅ Completo |
| Tarefas (CRUD, auto-save) | ✅ Completo |
| Orçamentos (quotes) | ✅ Completo |
| Caixa (saldo, projeção, statement) | ✅ Completo |
| Gastos (split entre membros) | ✅ Completo |
| GitHub repos | ✅ Completo |
| Vercel projects | ✅ Completo |
| Changelog | ✅ Completo |
| Leads webhook | ✅ Completo |
| Members | ✅ Completo |
| Ops Center | ✅ Completo |
| WhatsApp agent data | ✅ Completo |

---

## 🚀 PRÓXIMOS PASSOS RECOMENDADOS

1. **Criar página de Configurações do Luna** — Integrações, Ollama, tema
2. **Criar página de Grupos WhatsApp** — Visualizar/editar grupos
3. **Evoluir Leads para Pipeline Kanban** — Drag & drop, probabilidade
4. **Evoluir Projetos para Milestones** — Timeline, progress, bugs
5. **Criar Links Intelligence** — Cards com preview
6. **Criar News Engine** — Notícias não categorizadas
7. **Criar Dashboard Luna Preview** — HTML para screenshot
8. **Evoluir WhatsApp.jsx** — Badges de classificação, cores, ícones
9. **Criar Alerts & Actions** — Orçamentos expirando, P0s, deadlines
10. **Criar Schema Version** — Controle de versão visível

---

*Análise feita com raciocínio de Designer UI/UX Supremo*
*Baseado no código real do Dashboard Pro + Schemas v16.0*
*Data: 2026-05-05*
