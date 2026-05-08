# NEXO LUNA v16.0 — CONTEXTO ATUALIZADO

> Documento de contexto para agentes de IA. Cole este arquivo no próximo chat para que o agente entenda o estado ATUAL do projeto sem explicações adicionais.

---

## 🏢 EMPRESA

**NEXO DIGITAL S.L.** — Barcelona, Espanha
- **Abner Gabriel Mendes** — CEO & Co-Founder (ARCHITECT) — 34685093192
- **Enoque G Santos Clemente** — CEO & Co-Founder (ENGINE) — 34689135159
- **Elias Mendes** — CEO & Co-Founder (STRATEGIST) — 34672953062 (pessoal) / 34624529442 (empresarial/Superclim)

Ownership: 25% cada + 25% reinvestimento NEXO. Todos fullstack.

---

## 👥 CLIENTES E LEADS

| Nome | Empresa | Tipo | Prioridade | Pipeline |
|------|---------|------|-----------|----------|
| Paulo | SantaFe Construcciones | Cliente ativo | P1 | em-progresso |
| Juan | Sorveteria Tropicale | Lead P0 | P0 | novo (orçamento expira 15/05) |
| Jess | Onadance | Lead | P2 | novo |
| Gesse | ReformasMachado.com | Lead | P2 | novo |
| Lucas | Mapio | Lead | P3 | novo |
| Irmãos CCB | CCB | Lead | P3 | novo |

---

## 🚀 PROJETOS

| Projeto | Tipo | Status | Prioridade | Milestones |
|---------|------|--------|-----------|------------|
| SantaFe Construcciones | Cliente externo | em-progresso | P1 | Design✅, Dev✅, SEO⬜, Publicação⬜ |
| NEXO Dashboard Pro | Infraestrutura interna | em-progresso | P0 | Schema✅, Extração⬜, Dashboard⬜, Classificador⬜, Comandos⬜, Relatório⬜, Email⬜, Forms⬜ |

Projetos pessoais (Bool, Truco, Tetris, Superclim.es) NÃO constam no schema.

---

## 📁 SCHEMAS v16.0 (7 ARQUIVOS) — ✅ CARREGANDO NO BACKEND

Local: `backend/data/schema/` e `backend/data/config/`

| # | Arquivo | Local | Status |
|---|---------|-------|--------|
| 1 | contacts-map.json | schema/ | ✅ Backend lê |
| 2 | clients-registry.json | schema/ | ✅ Backend lê |
| 3 | projects-registry.json | schema/ | ✅ Backend lê |
| 4 | groups-config.json | schema/ | ✅ Backend lê |
| 5 | schema-version.json | schema/ | ✅ Backend lê |
| 6 | integrations-config.json | config/ | ✅ Backend lê |
| 7 | luna-dashboard-config.json | config/ | ✅ Backend lê |

Todos com: cross-references, editable fields, validation rules, permissions.

---

## 🔧 BACKEND — server.js MODIFICADO (Copilot aplicou)

### APIs NOVAS (adicionadas pelo Copilot):
| Endpoint | O que retorna | Status |
|----------|--------------|--------|
| GET /api/schema/contacts | contacts-map.json | ✅ Testado |
| GET /api/schema/clients | clients-registry.json | ✅ Testado |
| GET /api/schema/projects | projects-registry.json | ✅ Testado |
| GET /api/schema/groups | groups-config.json | ✅ Testado |
| GET /api/schema/version | schema-version.json | ✅ Testado |
| GET /api/config/integrations | integrations-config.json | ✅ Testado |
| GET /api/config/dashboard | luna-dashboard-config.json | ✅ Testado |
| GET /api/nexo-state | TUDO combinado | ✅ Testado |

### APIs ANTIGAS (mantidas, sem alteração):
| Endpoint | O que retorna |
|----------|--------------|
| GET /api/tasks | Tarefas do time |
| GET /api/users | Usuários ativos |
| GET /api/payments | Receitas/pagamentos |
| GET /api/expenses | Despesas com split |
| GET /api/cash-box | Caixa com saldo |
| GET /api/quotes | Orçamentos |
| GET /api/leads | Leads do site (webhook) |
| GET /api/members | Membros da equipe |
| GET /api/ops | Alerts e operações |
| GET /api/changelog | Release notes |
| GET /api/transactions | Transações |
| GET /api/whatsapp | Dados WhatsApp (luna-buffer.json) |
| GET /api/whatsapp-agent | Stats do agente |
| GET /api/luna/buffer | Buffer da Luna |
| GET /api/luna/reports/history | Histórico de relatórios |

---

## 🚫 REGRA ABSOLUTA

**Luna NUNCA envia mensagens no grupo do Paulo.**
- `lunaCanSpeak = FALSE` para todos os grupos de cliente/lead
- `lunaCanSendReports = FALSE` para todos os grupos de cliente/lead
- `humanOnly = TRUE` para todos os grupos de cliente/lead
- Reports, dashboards, respostas automáticas: **SÓ no grupo Production**
- Tratamento com cliente: **100% humanizado**

---

## 🤖 ARQUITETURA LUNA v16.0

| Camada | Modelo | Quando | Tempo |
|--------|--------|--------|-------|
| Regex Blindado | Nenhum | Confiança >= 0.85 | ~10ms |
| Gemma 2B | Ollama localhost:11434 | Regex inconclusivo | ~200ms |
| Fallback | Regex genérico | Ollama falha | ~10ms |

**NÃO há segundo modelo na RAM.** Fallback é determinístico (regex), não LLM.

---

## 🎯 REPOSITÓRIO E INFRAESTRUTURA

- **GitHub:** `https://github.com/Jhin1v9/NexoDashboard` (repo NOVO, limpo)
- **Repo antigo:** Deletado por conter dados sensíveis
- **Backend:** Rodando em `localhost:3456` ✅
- **Frontend:** Precisa ser religado (`npm run dev`)
- **Tarefas agendadas:** Luna-Stack, NEXO Auto Monitor, SpaceAgentTask — **TODAS DESATIVADAS**
- **Dados sensíveis locais:** `whatsapp-agent-data.json`, `luna-buffer.json` ainda existem em `backend/data/` (não commitados no Git)

---

## ❌ O QUE O DASHBOARD PRO **NÃO TEM** (12 Gaps)

| # | Gap | Severidade | Onde criar |
|---|-----|-----------|------------|
| 1 | Configurações do Luna (Ollama, tema, integrações) | 🔴 Alta | Nova página: `/config/luna` |
| 2 | Grupos WhatsApp (visualizar/editar) | 🔴 Alta | Nova página: `/config/grupos` |
| 3 | Pipeline de Leads (Kanban arrastável) | 🔴 Alta | Evoluir Leads.jsx |
| 4 | Milestones de Projetos (timeline) | 🟡 Média | Evoluir Projetos.jsx |
| 5 | Links Intelligence (cards com preview) | 🟡 Média | Nova página: `/links` |
| 6 | News Engine (notícias não categorizadas) | 🟡 Média | Nova página: `/news` |
| 7 | Team Radar (quem falou quanto) | 🟢 Baixa | Nova seção no Dashboard |
| 8 | Activity Timeline (últimas 24h) | 🟢 Baixa | Nova seção no Dashboard |
| 9 | Alerts Específicos (orçamentos expirando, P0s) | 🔴 Alta | Nova seção no Operacoes.jsx |
| 10 | Classificação Visual de Mensagens (badges P0/P1/P2) | 🔴 Alta | Evoluir WhatsApp.jsx |
| 11 | Schema Version Control | 🟢 Baixa | Nova página: `/config/schemas` |
| 12 | Dashboard Luna Preview (HTML para screenshot) | 🔴 Alta | Nova página: `/luna/preview` |

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
| Backend server.js (com 8 novas APIs) | ✅ Completo |
| 7 Schemas JSON v16.0 | ✅ Completo |

---

## 🚀 PRÓXIMOS PASSOS RECOMENDADOS

1. **Religar o frontend** (`cd frontend && npm run dev`)
2. **Testar as novas APIs no Dashboard** — ver se /api/schema/clients aparece na página Clientes
3. **Evoluir WhatsApp.jsx** — Adicionar badges de classificação (P0/P1/P2, ícones, sentimento)
4. **Criar Pipeline de Leads** — Kanban arrastável com Juan, Jess, Gesse, Lucas, CCB
5. **Criar Configurações do Luna** — Página para editar Ollama, tema, comandos
6. **Criar Dashboard Luna Preview** — HTML com Tailwind para screenshot

---

## ⚠️ NOTAS PARA O AGENTE

- NUNCA gere código genérico. Sempre baseie-se nos schemas reais.
- NUNCA crie arquivos sem explicar o propósito ao usuário.
- SEMPRE valide cruzado com os 7 schemas antes de entregar.
- O usuário prefere 1 arquivo por vez, com revisão brutal (5x).
- O usuário quer o máximo de perfeição, não "bom o suficiente".
- O usuário é CEO da NEXO, baseado em Barcelona, fala pt-BR com toques de espanhol.
- O backend está rodando em localhost:3456 com 8 novas APIs.
- O repo GitHub é `NexoDashboard` (novo, limpo).
- Tarefas agendadas do Windows foram desativadas.
