# 🎯 MISSION BRIEF — NEXO DASHBOARD PRO: SESSÃO IDEIAS
## Implementação Completa via Agent Swarm (SPARC Methodology)
## Versão: 1.0 | Data: 2026-05-13 | Autor: NEXO Digital

---

## 📋 CONTEXTO DO PROJETO — LEIA INTEIRO ANTES DE COMEÇAR

**NEXO Dashboard Pro** é o sistema interno da NEXO Digital — agência tech de Barcelona com 3 sócios (abner, nonoke, elias). O sistema já está em produção e **NÃO PODE SER QUEBRADO**. Qualquer alteração em código existente deve ser aprovada explicitamente.

### Stack Técnico Existente
- **Backend:** Node.js v18+ + Express (porta 3456), dados persistidos em JSON files (`/backend/data/*.json`), **SEM banco relacional**
- **Frontend:** React 18 + Vite + Tailwind CSS v3 + Framer Motion + React Router v6
- **Linguagem:** JavaScript puro (`.jsx` / `.js`). **NÃO usar JavaScript.**
- **HTTP Client:** `axios` (não `fetch`). Todo o projeto usa axios.
- **Autenticação:** JWT com middleware `requireAuth` em todas as rotas protegidas
- **Usuários:** 3 usuários JWT com IDs fixos:
  - `nexo-abner-001` (Abner)
  - `nexo-enoque-001` (Nonoke/Enoque)
  - `nexo-elias-pessoal` (Elias)

### Estrutura de Pastas Existente
```
/backend/
  server.js                    ← Entry point do Express
  data/
    clients-registry.json        ← Clientes (Paulo/Santafe, etc.)
    projects-registry.json       ← Projetos (SANTAFE-CONSTRUCCIONES, TROPICALE)
    leads.json                   ← Leads (vazio atualmente, schema existe)
    contacts-map.json            ← Cross-reference de contatos
    whatsapp-agent-data.json     ← Mensagens, tarefas, ideias do grupo
    luna-knowledge-graph.json    ← Entidades, relações, fatos (vazio)
    company-tasks.json           ← Tarefas da empresa
  routes/                        ← Rotas Express existentes
  middleware/
    requireAuth.js            ← JWT validation
  config/
    jwt.js                       ← Configuração JWT

/frontend/
  src/
    pages/
      Dashboard.jsx
      Clients.jsx
      Projects.jsx
      Tasks.jsx
      WhatsApp.jsx
      Settings.jsx
    components/
      Layout.jsx                 ← Sidebar + Header
      Sidebar.jsx
      Header.jsx
    App.jsx                      ← React Router
    main.jsx                     ← Entry point Vite
```

### JSON Files Existentes — NUNCA Reformatar
**clients-registry.json** (exemplo real do Paulo/Santafé):
```json
{
  "_schema": { "version": "16.0.1", "codename": "NEXO_REVENUE_ENGINE" },
  "clients": {
    "paulo-santafe": {
      "id": "paulo-santafe",
      "status": "ativo",
      "type": "cliente-externo",
      "name": "Paulo",
      "company": "SantaFe Construcciones",
      "project": "SANTAFE-CONSTRUCCIONES",
      "services": ["Web", "SEO Básico", "Publicação"],
      "groupId": "Paulo (Web🎯🙌🏻)@g.us",
      "contactInfo": { "phone": null, "email": null, "whatsapp": "client-paulo@c.us", "instagram": null, "website": null },
      "pipeline": { "currentStage": "em-progresso", "stageHistory": [{"stage": "contrato-assinado", "date": "2026-03-01", "note": "Projeto iniciado", "changedBy": "nexo-abner-001"}], "nextExpectedStage": "concluido", "estimatedCompletion": "2026-06-01" },
      "financial": { "budgetApproved": true, "contractSigned": true, "paymentStatus": "pendente", "totalValue": null, "paidAmount": 0, "currency": "EUR" },
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2026-05-10T14:30:00Z"
    }
  }
}
```

**IMPORTANTE:** `clients-registry.json` é um **OBJETO** (dict), não array. Acessar via `data.clients[clientId]`, NÃO `data.clients.find(...)`. O mesmo vale para `projects-registry.json`.

**company-tasks.json** (exemplo):
```json
{
  "_schema": { "version": "1.0", "codename": "NEXO_COMPANY_TASKS" },
  "tasks": [
    {
      "id": "task-001",
      "title": "Implementar Verifactu no Billing",
      "status": "em-andamento",
      "priority": "alta",
      "assignedTo": "nexo-elias-pessoal",
      "projectId": "NEXO-BILLING",
      "createdAt": "2026-05-09T10:00:00Z",
      "updatedAt": "2026-05-13T09:00:00Z"
    }
  ]
}
```

**projects-registry.json** (exemplo):
```json
{
  "_schema": { "version": "16.0.1", "codename": "NEXO_PROJECT_HUB" },
  "projects": {
    "SANTAFE-CONSTRUCCIONES": {
      "id": "SANTAFE-CONSTRUCCIONES",
      "codename": "SANTAFE",
      "name": "SantaFe Construcciones",
      "type": "cliente-externo",
      "status": "em-progresso",
      "priority": "P1",
      "team": ["nexo-abner-001", "nexo-enoque-001", "nexo-elias-pessoal"],
      "clientId": "paulo-santafe",
      "services": ["Web", "SEO Básico", "Publicação"],
      "financial": { "budgetApproved": true, "contractSigned": true, "paymentStatus": "pendente", "totalValue": null, "paidAmount": 0, "currency": "EUR" },
      "milestones": [{"name": "Design aprovado", "done": true, "date": "2026-03-15", "assignedTo": "nexo-enoque-001"}]
    }
  }
}
```

**IMPORTANTE:** `projects-registry.json` é um **OBJETO** (dict), não array. Acessar via `data.projects[projectId]`, NÃO `data.projects.find(...)`.

### Regras de Ouro para JSON Files
1. **NUNCA reformatar JSONs existentes.** Sempre usar `fs.readFileSync` + parse, modificar objeto em memória, `fs.writeFileSync` com `JSON.stringify(data, null, 2)`
2. **NUNCA deletar campos existentes.** Adicionar novos campos é permitido; remover ou renomear NÃO é.
3. **NUNCA mudar `_schema.version` dos arquivos existentes.** Criar novos arquivos com schema novo é permitido.
4. **Sempre fazer backup antes de escrever.** Exemplo: `fs.writeFileSync(file + '.backup', original)` antes de overwrite.
5. **IDs sequenciais com prefixo.** Para ideias: `idea-001`, `idea-002`, etc. Usar padding de 3 dígitos.

---

## 🎯 OBJETIVO DA SESSÃO IDEIAS

Implementar a **Sessão IDEIAS** — um workspace criativo estilo Notion (block-based editor) vinculado ao ecossistema NEXO, onde os 3 sócios podem:

1. **Criar Ideias** vinculadas a clientes, leads, ou gerais
2. **Desenvolver Ideias** com rich text, imagens, links, embeds, checklists, callouts, tabelas
3. **Brainstormar com IA** (Gemini 2.5 Flash-Lite) que conhece o contexto do cliente vinculado
4. **Categorizar e filtrar** por status, tipo, cliente, autor, data, tags
5. **Colaborar** com comentários, reações (emoji), @mentions, activity log
6. **Transformar em ação** — converter ideia em tarefa (`company-tasks.json`), gerar proposta, ou compartilhar no WhatsApp

### Diferencial competitivo vs Notion/Miro
- **Vinculação nativa** com clientes, leads, projetos do sistema (Notion não tem isso)
- **IA com contexto de negócio** — Gemini sabe que Paulo é cliente de construção civil e sugere abordagens específicas
- **Grounding com Google Search** — IA busca na web benchmarks e tendências atuais (grátis, 500 req/dia)
- **Gratuito** — Gemini 2.5 Flash-Lite free tier (1000 req/dia, 250K tokens/min) é suficiente para 3 usuários

---

## 🏗️ ARQUITETURA DE DADOS — NOVO ARQUIVO

### Novo arquivo: `backend/data/ideas-registry.json`

Este arquivo deve ser criado do zero. Schema version 1.0. Codename: `NEXO_IDEAS_ENGINE`.

```json
{
  "_schema": {
    "version": "1.0",
    "codename": "NEXO_IDEAS_ENGINE",
    "createdAt": "2026-05-13T09:04:00Z",
    "description": "Workspace criativo com block-based editor, IA Gemini, e vinculação ao ecossistema NEXO"
  },
  "ideas": [
    {
      "id": "idea-001",
      "title": "Redesign visual + sistema de orçamentos para Santafé",
      "status": "em-discussao",
      "type": "proposta-comercial",
      "priority": "alta",
      "linkedTo": {
        "clientId": "paulo-santafe",
        "clientName": "Santafé Construcciones",
        "leadId": null,
        "projectId": "SANTAFE-CONSTRUCCIONES"
      },
      "content": {
        "blocks": [
          {
            "id": "blk-001",
            "type": "heading",
            "level": 1,
            "content": "Contexto do Cliente"
          },
          {
            "id": "blk-002",
            "type": "paragraph",
            "content": "A cliente tem um site funcional em WordPress mas quer modernizar o visual e adicionar um sistema de orçamentos online para clientes solicitarem serviços de construção civil."
          },
          {
            "id": "blk-003",
            "type": "callout",
            "style": "info",
            "content": "Cliente prefere pagamento 50/50 — confirmado na última reunião."
          },
          {
            "id": "blk-004",
            "type": "image",
            "url": "/uploads/ideas/idea-001/ref-design.jpg",
            "caption": "Referência visual enviada pela cliente",
            "alt": "Referência de design moderno para construção civil"
          },
          {
            "id": "blk-005",
            "type": "embed",
            "url": "https://demo-site.vercel.app",
            "title": "Preview da Demo",
            "provider": "vercel"
          },
          {
            "id": "blk-006",
            "type": "checklist",
            "items": [
              { "id": "chk-001", "text": "Mudar paleta de cores para tons terrosos", "done": true },
              { "id": "chk-002", "text": "Adicionar slider de projetos concluídos", "done": false },
              { "id": "chk-003", "text": "Criar formulário de orçamento com upload de plantas", "done": false },
              { "id": "chk-004", "text": "Integrar WhatsApp Business para leads", "done": false }
            ]
          },
          {
            "id": "blk-007",
            "type": "heading",
            "level": 2,
            "content": "Investimento Estimado"
          },
          {
            "id": "blk-008",
            "type": "paragraph",
            "content": "Baseado em projetos similares, estimamos entre €2.500 e €3.500."
          }
        ]
      },
      "aiContext": {
        "brainstormHistory": [
          {
            "id": "ai-msg-001",
            "role": "user",
            "content": "Como vender redesign para cliente que já tem site funcional mas quer mudanças visuais?",
            "timestamp": "2026-05-13T10:00:00Z",
            "model": "gemini-2.5-flash-lite"
          },
          {
            "id": "ai-msg-002",
            "role": "assistant",
            "content": "## 3 Abordagens para Santafé Construcciones\n\n### 1. Abordagem 'Evolução, não Revolução'\nDestaque que o site atual funciona bem (SEO, tráfego) e a mudança é visual + funcional. Clientes de construção civil valorizam estabilidade.\n\n### 2. Benchmark Local\nMencione sites de construção civil em Barcelona que já modernizaram (ex: Grupo Lobe, Construcciones Balaguer). Mostre que a concorrência já fez isso.\n\n### 3. ROI do Orçamento Online\nCalcule: se o formulário de orçamento gera 5 leads/mês a €500 médio, o investimento se paga em 1 mês.",
            "timestamp": "2026-05-13T10:01:00Z",
            "model": "gemini-2.5-flash-lite",
            "groundingUsed": true
          }
        ],
        "aiSuggestions": [
          {
            "id": "ai-sugg-001",
            "type": "estratégia",
            "content": "Ofereça pacote com SEO incluído — cliente já tem tráfego, não quer perder posicionamento",
            "applied": false,
            "timestamp": "2026-05-13T10:01:00Z"
          },
          {
            "id": "ai-sugg-002",
            "type": "precificação",
            "content": "€2.800 — €3.200 é a faixa justa para redesign + formulário em WordPress Barcelona",
            "applied": false,
            "timestamp": "2026-05-13T10:01:00Z"
          }
        ],
        "aiInsights": [
          {
            "id": "insight-001",
            "pattern": "Clientes de construção civil em Barcelona preferem pagamento 50/50 e valorizam portfólio visual",
            "source": "idea-001",
            "confidence": 0.92,
            "timestamp": "2026-05-13T10:01:00Z"
          }
        ]
      },
      "tags": ["redesign", "wordpress", "cliente-recorrente", "orçamento-online", "barcelona"],
      "createdBy": "nexo-enoque-001",
      "createdByName": "Nonoke",
      "createdAt": "2026-05-13T10:00:00Z",
      "updatedAt": "2026-05-13T14:30:00Z",
      "collaborators": ["nexo-abner-001", "nexo-elias-pessoal"],
      "comments": [
        {
          "id": "cmt-001",
          "author": "nexo-abner-001",
          "authorName": "Abner",
          "text": "Boa ideia! Acho que podemos oferecer pacote com SEO incluído. O site deles já ranqueia bem para 'construcciones Barcelona'.",
          "timestamp": "2026-05-13T11:00:00Z",
          "reactions": [
            { "emoji": "🔥", "users": ["nexo-elias-pessoal"] },
            { "emoji": "💡", "users": ["nexo-enoque-001"] }
          ],
          "mentions": []
        },
        {
          "id": "cmt-002",
          "author": "nexo-elias-pessoal",
          "authorName": "Elias",
          "text": "@nexo-abner-001 boa! Também podemos incluir integração com WhatsApp Business API. Já temos experiência com isso no Billing.",
          "timestamp": "2026-05-13T12:00:00Z",
          "reactions": [],
          "mentions": ["nexo-abner-001"]
        }
      ],
      "attachments": [
        {
          "id": "att-001",
          "name": "brief-cliente-santafe.pdf",
          "url": "/uploads/ideas/idea-001/brief-cliente-santafe.pdf",
          "type": "pdf",
          "size": 2048000,
          "uploadedBy": "nexo-enoque-001",
          "uploadedAt": "2026-05-13T10:30:00Z"
        },
        {
          "id": "att-002",
          "name": "ref-design-moodboard.jpg",
          "url": "/uploads/ideas/idea-001/ref-design-moodboard.jpg",
          "type": "image",
          "size": 1843200,
          "uploadedBy": "nexo-enoque-001",
          "uploadedAt": "2026-05-13T10:35:00Z"
        }
      ],
      "versionHistory": [
        {
          "version": 1,
          "snapshot": { "title": "Redesign para cliente X", "status": "rascunho", "content": { "blocks": [] } },
          "changedBy": "nexo-enoque-001",
          "changedAt": "2026-05-13T10:00:00Z",
          "changeSummary": "Ideia criada"
        },
        {
          "version": 2,
          "snapshot": { "title": "Redesign visual + sistema de orçamentos para Santafé", "status": "em-discussao", "content": { "blocks": [...] } },
          "changedBy": "nexo-enoque-001",
          "changedAt": "2026-05-13T14:30:00Z",
          "changeSummary": "Adicionado contexto do cliente, checklist e investimento estimado"
        }
      ]
    }
  ],
  "templates": [
    {
      "id": "tpl-proposta",
      "name": "Proposta Comercial",
      "description": "Estrutura completa para criar proposta de venda com contexto do cliente",
      "category": "vendas",
      "icon": "💰",
      "blocks": [
        { "id": "tpl-blk-001", "type": "heading", "level": 1, "content": "Problema do Cliente" },
        { "id": "tpl-blk-002", "type": "paragraph", "content": "Descreva o problema ou necessidade identificada durante a reunião ou conversa. Seja específico e use dados quando possível." },
        { "id": "tpl-blk-003", "type": "heading", "level": 2, "content": "Nossa Solução" },
        { "id": "tpl-blk-004", "type": "paragraph", "content": "Como a NEXO Digital resolve este problema. Destaque diferenciais e tecnologias que usaremos." },
        { "id": "tpl-blk-005", "type": "heading", "level": 2, "content": "Escopo de Entrega" },
        { "id": "tpl-blk-006", "type": "checklist", "items": [
          { "id": "tpl-chk-001", "text": "Item de entrega 1", "done": false },
          { "id": "tpl-chk-002", "text": "Item de entrega 2", "done": false },
          { "id": "tpl-chk-003", "text": "Item de entrega 3", "done": false }
        ]},
        { "id": "tpl-blk-007", "type": "heading", "level": 2, "content": "Cronograma" },
        { "id": "tpl-blk-008", "type": "paragraph", "content": "Fase 1: Descoberta (1 semana)\nFase 2: Design (2 semanas)\nFase 3: Desenvolvimento (3 semanas)\nFase 4: Testes e Entrega (1 semana)" },
        { "id": "tpl-blk-009", "type": "heading", "level": 2, "content": "Investimento" },
        { "id": "tpl-blk-010", "type": "paragraph", "content": "Valor total: €_____\nCondições: 50% na aprovação, 50% na entrega\nFormas de pagamento: Transferência bancária, Stripe, ou GoCardless" },
        { "id": "tpl-blk-011", "type": "callout", "style": "success", "content": "Esta proposta é válida por 30 dias. Após este prazo, valores podem ser reavaliados." }
      ]
    },
    {
      "id": "tpl-brainstorm",
      "name": "Brainstorm de Ideias",
      "description": "Template para sessão criativa estruturada com a equipe",
      "category": "criatividade",
      "icon": "💡",
      "blocks": [
        { "id": "tpl-blk-101", "type": "heading", "level": 1, "content": "Objetivo" },
        { "id": "tpl-blk-102", "type": "paragraph", "content": "O que queremos alcançar com esta sessão de brainstorm? Defina o problema ou oportunidade claramente." },
        { "id": "tpl-blk-103", "type": "heading", "level": 2, "content": "Restrições" },
        { "id": "tpl-blk-104", "type": "paragraph", "content": "Orçamento máximo: €_____\nPrazo limite: _____\nTecnologias obrigatórias: _____\nTecnologias proibidas: _____" },
        { "id": "tpl-blk-105", "type": "heading", "level": 2, "content": "Ideias Geradas" },
        { "id": "tpl-blk-106", "type": "checklist", "items": [
          { "id": "tpl-chk-101", "text": "Ideia 1", "done": false },
          { "id": "tpl-chk-102", "text": "Ideia 2", "done": false },
          { "id": "tpl-chk-103", "text": "Ideia 3", "done": false }
        ]},
        { "id": "tpl-blk-107", "type": "heading", "level": 2, "content": "Análise de Viabilidade" },
        { "id": "tpl-blk-108", "type": "paragraph", "content": "Para cada ideia, avalie: Esforço (Baixo/Médio/Alto) × Impacto (Baixo/Médio/Alto)" },
        { "id": "tpl-blk-109", "type": "heading", "level": 2, "content": "Próximos Passos" },
        { "id": "tpl-blk-110", "type": "checklist", "items": [
          { "id": "tpl-chk-104", "text": "Validar ideia escolhida com cliente", "done": false },
          { "id": "tpl-chk-105", "text": "Criar PRD/especificação técnica", "done": false },
          { "id": "tpl-chk-106", "text": "Estimar cronograma e orçamento", "done": false }
        ]}
      ]
    },
    {
      "id": "tpl-prd",
      "name": "Especificação Técnica (PRD)",
      "description": "Product Requirements Document para novas features e produtos",
      "category": "produto",
      "icon": "📋",
      "blocks": [
        { "id": "tpl-blk-201", "type": "heading", "level": 1, "content": "Contexto e Motivação" },
        { "id": "tpl-blk-202", "type": "paragraph", "content": "Por que estamos construindo isso? Qual problema resolve? Qual oportunidade de negócio?" },
        { "id": "tpl-blk-203", "type": "heading", "level": 2, "content": "Requisitos Funcionais" },
        { "id": "tpl-blk-204", "type": "checklist", "items": [
          { "id": "tpl-chk-201", "text": "RF1: Usuário pode _____", "done": false },
          { "id": "tpl-chk-202", "text": "RF2: Sistema deve _____", "done": false },
          { "id": "tpl-chk-203", "text": "RF3: Admin pode _____", "done": false }
        ]},
        { "id": "tpl-blk-205", "type": "heading", "level": 2, "content": "Requisitos Não-Funcionais" },
        { "id": "tpl-blk-206", "type": "paragraph", "content": "Performance: _____\nSegurança: _____\nCompatibilidade: _____\nEscalabilidade: _____" },
        { "id": "tpl-blk-207", "type": "heading", "level": 2, "content": "Critérios de Aceitação" },
        { "id": "tpl-blk-208", "type": "checklist", "items": [
          { "id": "tpl-chk-204", "text": "Dado que _____, quando _____, então _____", "done": false },
          { "id": "tpl-chk-205", "text": "Dado que _____, quando _____, então _____", "done": false }
        ]},
        { "id": "tpl-blk-209", "type": "heading", "level": 2, "content": "Notas Técnicas" },
        { "id": "tpl-blk-210", "type": "paragraph", "content": "Stack sugerida: _____\nDependências: _____\nRiscos técnicos: _____" }
      ]
    },
    {
      "id": "tpl-pipeline",
      "name": "Pipeline de Vendas",
      "description": "Acompanhamento de oportunidade comercial de ponta a ponta",
      "category": "vendas",
      "icon": "🎯",
      "blocks": [
        { "id": "tpl-blk-301", "type": "heading", "level": 1, "content": "Lead / Oportunidade" },
        { "id": "tpl-blk-302", "type": "paragraph", "content": "Nome: _____\nEmpresa: _____\nEmail: _____\nTelefone: _____\nOrigem: (Indicação / Website / Redes Sociais / Evento / Outro)" },
        { "id": "tpl-blk-303", "type": "heading", "level": 2, "content": "Necessidade Identificada" },
        { "id": "tpl-blk-304", "type": "paragraph", "content": "O que o lead precisa? Qual a dor principal? Qual o ganho desejado?" },
        { "id": "tpl-blk-305", "type": "heading", "level": 2, "content": "Estágio Atual do Pipeline" },
        { "id": "tpl-blk-306", "type": "paragraph", "content": "☐ Prospecção\n☐ Primeiro Contato\n☐ Reunião de Descoberta\n☐ Proposta Enviada\n☐ Negociação\n☐ Fechamento (Ganho / Perdido)" },
        { "id": "tpl-blk-307", "type": "heading", "level": 2, "content": "Próximo Contato" },
        { "id": "tpl-blk-308", "type": "paragraph", "content": "Data: _____\nAção: (Email / Ligação / Reunião / Proposta / Follow-up)\nResponsável: @_____" },
        { "id": "tpl-blk-309", "type": "heading", "level": 2, "content": "Valor e Probabilidade" },
        { "id": "tpl-blk-310", "type": "paragraph", "content": "Ticket estimado: €_____\nProbabilidade de fechamento: _____%\nData estimada de fechamento: _____" }
      ]
    }
  ],
  "categories": [
    { "id": "proposta-comercial", "name": "Proposta Comercial", "color": "#22c55e", "icon": "💰", "description": "Propostas de venda para clientes e leads" },
    { "id": "estratégia-vendas", "name": "Estratégia de Vendas", "color": "#f59e0b", "icon": "🎯", "description": "Estratégias e abordagens comerciais" },
    { "id": "produto-servico", "name": "Produto/Serviço", "color": "#3b82f6", "icon": "🚀", "description": "Ideias para novos produtos e serviços" },
    { "id": "processo-interno", "name": "Processo Interno", "color": "#6366f1", "icon": "⚙️", "description": "Melhorias de processos e operações" },
    { "id": "marketing", "name": "Marketing", "color": "#ec4899", "icon": "📢", "description": "Campanhas, conteúdo e estratégia de marca" },
    { "id": "brainstorm", "name": "Brainstorm", "color": "#8b5cf6", "icon": "💡", "description": "Sessões criativas e exploração de ideias" }
  ]
}
```

### Regras de Validação de Dados
1. **`id`**: String, formato `idea-XXX` onde XXX é número sequencial com padding de 3 dígitos (001, 002...)
2. **`status`**: Enum — `rascunho`, `em-discussao`, `aprovada`, `rejeitada`, `em-andamento`, `concluida`, `arquivada`
3. **`type`**: Enum — `proposta-comercial`, `brainstorm`, `prd`, `pipeline-vendas`, `estratégia`, `processo`, `marketing`, `outro`
4. **`priority`**: Enum — `baixa`, `media`, `alta`, `urgente`
5. **`linkedTo.clientId`**: Deve existir em `clients-registry.json` OU ser `null`
6. **`linkedTo.leadId`**: Deve existir em `leads.json` OU ser `null`
7. **`linkedTo.projectId`**: Deve existir em `projects-registry.json` OU ser `null`
8. **`createdBy`**: Deve ser um dos 3 IDs de usuário válidos
9. **`content.blocks[].id`**: Formato `blk-XXX` onde XXX é aleatório mas único por ideia
10. **`content.blocks[].type`**: Enum — `paragraph`, `heading`, `checklist`, `image`, `embed`, `callout`, `table`, `divider`, `quote`
11. **`content.blocks[].level`** (para heading): Integer 1-3
12. **`content.blocks[].style`** (para callout): Enum — `info`, `warning`, `success`, `idea`, `danger`
13. **`aiContext.brainstormHistory[].model`**: Sempre `"gemini-2.5-flash-lite"`
14. **`versionHistory[].version`**: Integer sequencial começando em 1
15. **Timestamps**: Sempre ISO 8601 com timezone UTC (ex: `2026-05-13T10:00:00Z`)

---

## 🔌 API ENDPOINTS — BACKEND NODE.JS EXPRESS

### Convenções
- Todas as rotas protegidas por `requireAuth` existente
- Prefixo: `/api/ideas`
- Respostas de sucesso: `{ success: true, data: ... }`
- Respostas de erro: `{ success: false, error: "mensagem descritiva" }`
- HTTP status codes: 200 (sucesso), 201 (criado), 400 (bad request), 404 (not found), 500 (server error)

### 1. LISTAR IDEIAS
```
GET /api/ideas
```
**Query Parameters:**
- `status` (string, optional) — filtra por status
- `type` (string, optional) — filtra por tipo
- `clientId` (string, optional) — filtra por cliente vinculado
- `priority` (string, optional) — filtra por prioridade
- `tag` (string, optional) — filtra por tag (busca em array)
- `search` (string, optional) — busca full-text em title, content.blocks[].content, comments[].text, tags
- `createdBy` (string, optional) — filtra por autor
- `sort` (string, optional) — `createdAt:desc` (padrão), `updatedAt:desc`, `priority:asc`, `title:asc`
- `limit` (number, optional) — padrão 50, máximo 200
- `offset` (number, optional) — padrão 0

**Response 200:**
```json
{
  "success": true,
  "data": {
    "ideas": [...],
    "total": 42,
    "limit": 50,
    "offset": 0,
    "filters": { "status": "em-discussao" }
  }
}
```

**Implementação:**
```javascript
router.get('/', requireAuth, async (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./backend/data/ideas-registry.json', 'utf8'));
    let ideas = data.ideas || [];

    // Aplicar filtros
    if (req.query.status) ideas = ideas.filter(i => i.status === req.query.status);
    if (req.query.type) ideas = ideas.filter(i => i.type === req.query.type);
    if (req.query.clientId) ideas = ideas.filter(i => i.linkedTo?.clientId === req.query.clientId);
    if (req.query.priority) ideas = ideas.filter(i => i.priority === req.query.priority);
    if (req.query.tag) ideas = ideas.filter(i => i.tags?.includes(req.query.tag));
    if (req.query.createdBy) ideas = ideas.filter(i => i.createdBy === req.query.createdBy);

    // Busca full-text
    if (req.query.search) {
      const term = req.query.search.toLowerCase();
      ideas = ideas.filter(i => {
        const inTitle = i.title?.toLowerCase().includes(term);
        const inContent = i.content?.blocks?.some(b => b.content?.toLowerCase().includes(term));
        const inComments = i.comments?.some(c => c.text?.toLowerCase().includes(term));
        const inTags = i.tags?.some(t => t.toLowerCase().includes(term));
        return inTitle || inContent || inComments || inTags;
      });
    }

    // Ordenação
    const [field, order] = (req.query.sort || 'createdAt:desc').split(':');
    ideas.sort((a, b) => {
      const valA = a[field] || '';
      const valB = b[field] || '';
      return order === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    // Paginação
    const total = ideas.length;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    ideas = ideas.slice(offset, offset + limit);

    // Popular nomes de clientes
    const clientsData = JSON.parse(fs.readFileSync('./backend/data/clients-registry.json', 'utf8'));
    ideas = ideas.map(idea => {
      if (idea.linkedTo?.clientId) {
        const client = clientsData.clients?.find(c => c.id === idea.linkedTo.clientId);
        idea.linkedTo.clientName = client?.name || idea.linkedTo.clientName || 'Desconhecido';
      }
      return idea;
    });

    res.json({ success: true, data: { ideas, total, limit, offset, filters: req.query } });
  } catch (err) {
    console.error('[IDEAS] List error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
```

### 2. CRIAR IDEIA
```
POST /api/ideas
```
**Body:**
```json
{
  "title": "string (obrigatório, min 3 chars, max 200)",
  "status": "string (opcional, padrão 'rascunho')",
  "type": "string (obrigatório)",
  "priority": "string (opcional, padrão 'media')",
  "linkedTo": {
    "clientId": "string (opcional, validar existência)",
    "leadId": "string (opcional)",
    "projectId": "string (opcional, validar existência)"
  },
  "content": {
    "blocks": [...]
  },
  "tags": ["array de strings (opcional)"],
  "templateId": "string (opcional, se criar a partir de template)"
}
```

**Regras:**
- Se `templateId` for enviado, copiar `blocks` do template para `content.blocks`
- Se `linkedTo.clientId` for enviado, buscar nome do cliente em `clients-registry.json` e preencher `linkedTo.clientName`
- Gerar `id` sequencial: encontrar maior `idea-XXX` existente, incrementar
- `createdBy` = `req.user.id` (do JWT)
- `createdByName` = nome do usuário (mapear IDs para nomes: `nexo-abner-001` → "Abner", `nexo-enoque-001` → "Nonoke", `nexo-elias-pessoal` → "Elias")
- `createdAt` e `updatedAt` = `new Date().toISOString()`
- `versionHistory` = array com 1 item (versão 1, snapshot vazio, changeSummary: "Ideia criada")

**Response 201:**
```json
{
  "success": true,
  "data": { "idea": { ... } }
}
```

### 3. DETALHE DA IDEIA
```
GET /api/ideas/:id
```
**Response 200:**
```json
{
  "success": true,
  "data": { "idea": { ... } }
}
```
- Popular `linkedTo.clientName` se `clientId` existir
- Popular `linkedTo.projectName` se `projectId` existir (buscar em `projects-registry.json`)

### 4. ATUALIZAR IDEIA
```
PUT /api/ideas/:id
```
**Body:**
```json
{
  "title": "string (opcional)",
  "status": "string (opcional)",
  "priority": "string (opcional)",
  "content": { "blocks": [...] },
  "tags": ["array"],
  "collaborators": ["array de user IDs"]
}
```

**Regras:**
- Fazer **merge profundo** no `content.blocks` — NUNCA sobrescrever o array inteiro a menos que seja intencional
- Se `content.blocks` for enviado, comparar com versão atual e adicionar nova entrada em `versionHistory`
- `updatedAt` = `new Date().toISOString()`
- Se `status` mudar para `aprovada`, adicionar notificação no `aiContext.aiInsights` se houver insights aplicáveis

### 5. DELETAR IDEIA (Soft Delete)
```
DELETE /api/ideas/:id
```
**Regra:** Não deletar fisicamente. Mudar `status` para `arquivada` e `updatedAt` para agora.

**Response 200:**
```json
{
  "success": true,
  "data": { "message": "Ideia arquivada com sucesso", "idea": { ... } }
}
```

### 6. ADICIONAR COMENTÁRIO
```
POST /api/ideas/:id/comments
```
**Body:**
```json
{
  "text": "string (obrigatório, max 2000 chars)",
  "mentions": ["array de user IDs (opcional)"]
}
```

**Regras:**
- `id` do comentário: `cmt-` + timestamp + random (ex: `cmt-1715594400000-abc`)
- `author` = `req.user.id`
- `authorName` = nome do usuário (mapear)
- `timestamp` = `new Date().toISOString()`
- `reactions` = array vazio
- Se `mentions` contiver IDs válidos, adicionar notificação (simplificada: log no console por enquanto)

### 7. REMOVER COMENTÁRIO
```
DELETE /api/ideas/:id/comments/:cid
```
**Regra:** Só autor do comentário ou admin pode remover. Se não for autor, retornar 403.

### 8. ADICIONAR/REMOVER REAÇÃO
```
POST /api/ideas/:id/comments/:cid/reactions
```
**Body:**
```json
{
  "emoji": "string (obrigatório, ex: 🔥, 💡, 👍, ❤️)"
}
```

**Regra:** Toggle — se usuário já reagiu com esse emoji, remove. Se não, adiciona.

### 9. CHAT COM IA (GEMINI)
```
POST /api/ideas/:id/ai-chat
```
**Body:**
```json
{
  "message": "string (obrigatório, pergunta do usuário)",
  "mode": "string (opcional, padrão 'brainstorm')",
  "applySuggestion": "boolean (opcional, se true, aplica última sugestão como bloco)"
}
```

**Modes válidos:** `brainstorm`, `estratégia`, `redator`, `precificação`, `pesquisa`

**Implementação completa:**
```javascript
const { GoogleGenAI } = require("@google/genai");

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

router.post('/:id/ai-chat', requireAuth, async (req, res) => {
  try {
    const { message, mode = 'brainstorm' } = req.body;
    const ideaId = req.params.id;

    // Carregar ideia
    const ideasData = JSON.parse(fs.readFileSync('./backend/data/ideas-registry.json', 'utf8'));
    const idea = ideasData.ideas.find(i => i.id === ideaId);
    if (!idea) return res.status(404).json({ success: false, error: 'Ideia não encontrada' });

    // Carregar cliente vinculado
    let client = null;
    if (idea.linkedTo?.clientId) {
      const clientsData = JSON.parse(fs.readFileSync('./backend/data/clients-registry.json', 'utf8'));
      client = clientsData.clients?.find(c => c.id === idea.linkedTo.clientId);
    }

    // Carregar histórico de ideias do mesmo cliente
    let history = [];
    if (client) {
      history = ideasData.ideas
        .filter(i => i.linkedTo?.clientId === client.id && i.id !== ideaId)
        .slice(-5)
        .map(i => ({ title: i.title, status: i.status, type: i.type }));
    }

    // Construir prompt
    const prompt = buildBrainstormPrompt(idea, client, history, message, mode);

    // Chamar Gemini
    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: {
        temperature: 0.8,
        maxOutputTokens: 2048,
        tools: mode === 'pesquisa' ? [{ googleSearchRetrieval: {} }] : undefined
      }
    });

    const aiResponse = result.text;

    // Salvar no histórico da ideia
    const aiMessageId = `ai-msg-${Date.now()}`;
    idea.aiContext.brainstormHistory.push({
      id: aiMessageId,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      model: 'gemini-2.5-flash-lite'
    });
    idea.aiContext.brainstormHistory.push({
      id: `ai-msg-${Date.now()}-resp`,
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
      model: 'gemini-2.5-flash-lite',
      groundingUsed: mode === 'pesquisa'
    });

    // Extrair sugestões estruturadas da resposta
    const suggestions = extractSuggestions(aiResponse, mode);
    suggestions.forEach(sugg => {
      idea.aiContext.aiSuggestions.push({
        id: `ai-sugg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: mode,
        content: sugg,
        applied: false,
        timestamp: new Date().toISOString()
      });
    });

    idea.updatedAt = new Date().toISOString();
    fs.writeFileSync('./backend/data/ideas-registry.json', JSON.stringify(ideasData, null, 2));

    res.json({
      success: true,
      data: {
        response: aiResponse,
        suggestions,
        history: idea.aiContext.brainstormHistory.slice(-10)
      }
    });
  } catch (err) {
    console.error('[IDEAS] AI Chat error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function buildBrainstormPrompt(idea, client, history, userQuestion, mode) {
  const modeInstructions = {
    brainstorm: 'Gere 3-5 ideias criativas e concretas. Use exemplos reais do mercado. Estruture com markdown.',
    estratégia: 'Analise como abordar/vender. Estruture em: Problema → Oportunidade → Solução → Próximo Passo.',
    redator: 'Ajude a escrever proposta, email ou pitch. Mantenha tom profissional mas próximo. Retorne texto pronto para copiar.',
    precificação: 'Sugira faixa de preço baseada no tipo de projeto. NUNCA prometa valor exato. Explique o raciocínio.',
    pesquisa: 'Busque na web soluções similares, benchmarks, tendências atuais. Use grounding com Google Search.'
  };

  return `Você é o NEXO Creative Partner 💡 — estrategista criativo e consultor de vendas da NEXO Digital.
NEXO Digital é uma agência tech de Barcelona que cria sites, apps, automações e soluções digitais.

CONTEXTO DO CLIENTE VINCULADO:
${client ? `
- Nome: ${client.name}
- Empresa: ${client.company || 'Não informado'}
- Serviços atuais: ${client.services?.join(', ') || 'Nenhum'}
- Pipeline: ${client.pipeline?.currentStage || 'Novo'}
- Localização: ${client.location || 'Não informado'}
` : 'Nenhum cliente vinculado.'}

HISTÓRICO DE IDEIAS DESTE CLIENTE:
${history?.map(h => `- ${h.title} (${h.status}, ${h.type})`).join('\n') || 'Nenhuma ideia anterior.'}

IDEIA ATUAL:
Título: ${idea.title}
Conteúdo: ${idea.content?.blocks?.filter(b => b.type === 'paragraph').map(b => b.content).join('\n') || 'Sem conteúdo'}

MODO ATUAL: ${mode.toUpperCase()}
INSTRUÇÕES ESPECÍFICAS: ${modeInstructions[mode]}

PERGUNTA DO USUÁRIO: ${userQuestion}

REGRAS GLOBAIS:
1. Responda em português brasileiro.
2. Seja CRIATIVO mas PRÁTICO — só sugira o que a NEXO pode executar (sites, apps web, automações, SEO, design).
3. NUNCA prometa prazos ou valores sem contexto suficiente.
4. NUNCA assuma que a NEXO faz algo fora do escopo (ex: apps nativos iOS/Android se não é nosso foco).
5. Se relevante, mencione tendências atuais do mercado espanhol/catalão.
6. Estruture respostas com markdown para fácil conversão em blocos do editor.
7. Seja conciso mas completo. Máximo 1500 tokens de resposta.`;
}

function extractSuggestions(text, mode) {
  // Extrair listas numeradas, bullets, ou blocos de citação como sugestões
  const suggestions = [];
  const lines = text.split('\n');
  let currentSugg = '';

  for (const line of lines) {
    if (line.match(/^\d+\.|^[-*]\s|^>\s/)) {
      if (currentSugg) suggestions.push(currentSugg.trim());
      currentSugg = line.replace(/^\d+\.\s*|^[-*]\s*|^>\s*/, '');
    } else if (currentSugg && line.trim()) {
      currentSugg += ' ' + line.trim();
    }
  }
  if (currentSugg) suggestions.push(currentSugg.trim());

  return suggestions.slice(0, 5); // Máximo 5 sugestões
}
```

### 10. LISTAR TEMPLATES
```
GET /api/ideas/templates
```
**Response:**
```json
{
  "success": true,
  "data": { "templates": [...], "categories": [...] }
}
```

### 11. CRIAR IDEIA A PARTIR DE TEMPLATE
```
POST /api/ideas/from-template
```
**Body:**
```json
{
  "templateId": "string (obrigatório)",
  "title": "string (obrigatório)",
  "linkedTo": { "clientId": "..." },
  "customizations": { "blocks": [...] }
}
```

**Regra:** Copiar `blocks` do template, depois aplicar `customizations.blocks` por cima (merge por índice ou ID).

### 12. CONVERTER IDEIA EM TAREFA
```
POST /api/ideas/:id/convert-task
```
**Body:**
```json
{
  "assignedTo": "string (opcional, padrão req.user.id)",
  "dueDate": "string ISO (opcional)"
}
```

**Implementação:**
```javascript
router.post('/:id/convert-task', requireAuth, async (req, res) => {
  try {
    const ideaId = req.params.id;
    const ideasData = JSON.parse(fs.readFileSync('./backend/data/ideas-registry.json', 'utf8'));
    const idea = ideasData.ideas.find(i => i.id === ideaId);
    if (!idea) return res.status(404).json({ success: false, error: 'Ideia não encontrada' });

    // Carregar company-tasks.json
    const tasksData = JSON.parse(fs.readFileSync('./backend/data/company-tasks.json', 'utf8'));
    const tasks = tasksData.tasks || [];

    // Gerar ID sequencial
    const maxId = tasks.reduce((max, t) => {
      const num = parseInt(t.id.replace('task-', ''));
      return num > max ? num : max;
    }, 0);
    const newId = `task-${String(maxId + 1).padStart(3, '0')}`;

    const newTask = {
      id: newId,
      title: idea.title,
      description: `Convertido da ideia ${idea.id}: ${idea.content?.blocks?.filter(b => b.type === 'paragraph').map(b => b.content).join(' ').substring(0, 200)}...`,
      status: 'pendente',
      priority: idea.priority || 'media',
      assignedTo: req.body.assignedTo || req.user.id,
      projectId: idea.linkedTo?.projectId || 'GERAL',
      ideaId: idea.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: req.body.dueDate || null
    };

    tasks.push(newTask);
    tasksData.tasks = tasks;
    fs.writeFileSync('./backend/data/company-tasks.json', JSON.stringify(tasksData, null, 2));

    // Atualizar status da ideia
    idea.status = 'em-andamento';
    idea.updatedAt = new Date().toISOString();
    fs.writeFileSync('./backend/data/ideas-registry.json', JSON.stringify(ideasData, null, 2));

    res.json({ success: true, data: { task: newTask, idea } });
  } catch (err) {
    console.error('[IDEAS] Convert task error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
```

### 13. APLICAR SUGESTÃO DA IA
```
POST /api/ideas/:id/apply-ai
```
**Body:**
```json
{
  "suggestionId": "string (obrigatório)"
}
```

**Regra:**
- Buscar `suggestionId` em `aiContext.aiSuggestions`
- Converter `content` da sugestão em blocos TipTap (heading/paragraph/checklist)
- Inserir blocos no final do `content.blocks` da ideia
- Marcar `applied = true`
- Adicionar entrada no `versionHistory`

### 14. STATS PARA DASHBOARD
```
GET /api/ideas/stats
```
**Response:**
```json
{
  "success": true,
  "data": {
    "total": 42,
    "byStatus": { "rascunho": 5, "em-discussao": 12, "aprovada": 8, "em-andamento": 10, "concluida": 5, "arquivada": 2 },
    "byType": { "proposta-comercial": 15, "brainstorm": 10, "prd": 8, ... },
    "thisWeek": 3,
    "myIdeas": 8,
    "recentActivity": [
      { "action": "comentário", "ideaId": "idea-001", "user": "Abner", "timestamp": "..." }
    ]
  }
}
```

---

## 🎨 FRONTEND — REACT + TAILWIND + FRAMER MOTION

### Novas Rotas (Adicionar em App.jsx)
```jsx
<Route path="/ideias" element={<Ideas />} />
<Route path="/ideias/nova" element={<IdeaEditor />} />
<Route path="/ideias/:id" element={<IdeaEditor />} />
```

### Novo item no Sidebar (adicionar em Sidebar.jsx)
```jsx
{
  icon: Lightbulb,
  label: "Ideias",
  path: "/ideias",
  badge: "beta"
}
```

### Página: `src/pages/Ideas.jsx`
**Layout:**
- Header com título "💡 Sessão IDEIAS", botão "+ Nova Ideia", e stats cards
- Tabs: Tabela | Kanban | Galeria | Lista
- Barra de filtros fixa abaixo das tabs
- Área de conteúdo com a view ativa

**Stats Cards (topo):**
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  💡 42      │ │  🔥 12      │ │  ✅ 8       │ │  👤 8       │
│  Total      │ │  Em Discussão│ │  Aprovadas  │ │  Minhas     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**Implementação do container:**
```jsx
// src/pages/Ideas.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Plus, LayoutGrid, List, Table2, Kanban } from 'lucide-react';
import IdeasTable from '../components/ideas/IdeasTable';
import IdeasKanban from '../components/ideas/IdeasKanban';
import IdeasGallery from '../components/ideas/IdeasGallery';
import IdeasList from '../components/ideas/IdeasList';
import IdeaFilters from '../components/ideas/IdeaFilters';
import IdeaStats from '../components/ideas/IdeaStats';
import IdeaQuickAdd from '../components/ideas/IdeaQuickAdd';

export default function Ideas() {
  const [view, setView] = useState('kanban'); // 'table' | 'kanban' | 'gallery' | 'list'
  const [ideas, setIdeas] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({});
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  useEffect(() => {
    fetchIdeas();
    fetchStats();
  }, [filters]);

  const fetchIdeas = async () => {
    const query = new URLSearchParams(filters).toString();
    const res = await axios.get(`/api/ideas?${query}`);
    const data = await res.json();
    if (data.success) setIdeas(data.data.ideas);
  };

  const fetchStats = async () => {
    const res = await axios.get('/api/ideas/stats');
    const data = await res.json();
    if (data.success) setStats(data.data);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sessão IDEIAS</h1>
            <p className="text-sm text-gray-500">Workspace criativo da NEXO Digital</p>
          </div>
        </div>
        <button
          onClick={() => setShowQuickAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Ideia
        </button>
      </div>

      {/* Stats */}
      <IdeaStats stats={stats} />

      {/* Tabs + Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[
            { id: 'table', icon: Table2, label: 'Tabela' },
            { id: 'kanban', icon: Kanban, label: 'Kanban' },
            { id: 'gallery', icon: LayoutGrid, label: 'Galeria' },
            { id: 'list', icon: List, label: 'Lista' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                view === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <IdeaFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {view === 'table' && <IdeasTable ideas={ideas} onRefresh={fetchIdeas} />}
          {view === 'kanban' && <IdeasKanban ideas={ideas} onRefresh={fetchIdeas} />}
          {view === 'gallery' && <IdeasGallery ideas={ideas} onRefresh={fetchIdeas} />}
          {view === 'list' && <IdeasList ideas={ideas} onRefresh={fetchIdeas} />}
        </motion.div>
      </AnimatePresence>

      {/* Quick Add Modal */}
      <AnimatePresence>
        {showQuickAdd && (
          <IdeaQuickAdd
            onClose={() => setShowQuickAdd(false)}
            onCreated={() => { fetchIdeas(); setShowQuickAdd(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
```

### Componente: `src/components/ideas/IdeasKanban.jsx`
**Layout:** Colunas por status. Cards drag & drop entre colunas.

```jsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import IdeaCard from './IdeaCard';

const COLUMNS = [
  { id: 'rascunho', name: 'Rascunho', color: 'bg-gray-100 border-gray-300' },
  { id: 'em-discussao', name: 'Em Discussão', color: 'bg-yellow-50 border-yellow-300' },
  { id: 'aprovada', name: 'Aprovada', color: 'bg-green-50 border-green-300' },
  { id: 'em-andamento', name: 'Em Andamento', color: 'bg-blue-50 border-blue-300' },
  { id: 'concluida', name: 'Concluída', color: 'bg-purple-50 border-purple-300' }
];

export default function IdeasKanban({ ideas, onRefresh }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [items, setItems] = useState(() => {
    const grouped = {};
    COLUMNS.forEach(col => grouped[col.id] = []);
    ideas.forEach(idea => {
      if (grouped[idea.status]) grouped[idea.status].push(idea);
    });
    return grouped;
  });

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Determinar coluna de origem e destino
    let sourceCol, destCol;
    for (const col of COLUMNS) {
      if (items[col.id].find(i => i.id === activeId)) sourceCol = col.id;
      if (col.id === overId || items[col.id].find(i => i.id === overId)) destCol = col.id;
    }

    if (sourceCol && destCol && sourceCol !== destCol) {
      // Atualizar status no backend
      await axios.get(`/api/ideas/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: destCol })
      });
      onRefresh();
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <div key={col.id} className={`flex-shrink-0 w-80 ${col.color} rounded-lg border-2 p-3`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-700">{col.name}</h3>
              <span className="bg-white px-2 py-0.5 rounded-full text-xs font-medium text-gray-600">
                {items[col.id]?.length || 0}
              </span>
            </div>
            <SortableContext items={items[col.id]?.map(i => i.id) || []} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 min-h-[100px]">
                {items[col.id]?.map(idea => (
                  <SortableIdeaCard key={idea.id} idea={idea} />
                ))}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>
    </DndContext>
  );
}

function SortableIdeaCard({ idea }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: idea.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <IdeaCard idea={idea} compact />
    </div>
  );
}
```

### Componente: `src/components/editor/BlockEditor.jsx`
**Base:** TipTap com extensões customizadas para blocos NEXO.

```jsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { useCallback } from 'react';
import SlashCommandMenu from './SlashCommandMenu';
import BubbleToolbar from './BubbleToolbar';

const CustomCallout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      style: { default: 'info' },
      icon: { default: '💡' }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-callout': '', class: `callout callout-${HTMLAttributes.style}` }, 0];
  }
});

const CustomEmbed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      url: {},
      title: { default: '' },
      provider: { default: '' }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-embed]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-embed': '', 'data-url': HTMLAttributes.url }, 0];
  }
});

export default function BlockEditor({ content, onChange, readOnly = false }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Digite "/" para comandos...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Highlight,
      Typography,
      CustomCallout,
      CustomEmbed
    ],
    content: content || '<p></p>',
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (onChange) onChange(editor.getJSON());
    }
  });

  if (!editor) return null;

  return (
    <div className="prose prose-sm max-w-none">
      <BubbleToolbar editor={editor} />
      <SlashCommandMenu editor={editor} />
      <EditorContent editor={editor} className="min-h-[300px] p-4" />
    </div>
  );
}
```

### Componente: `src/components/ai/AIChatSidebar.jsx`
**Layout:** Sidebar direita do editor. Chat contínuo com streaming.

```jsx
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Brain, Target, PenTool, DollarSign, Search, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const MODES = [
  { id: 'brainstorm', name: 'Brainstorm', icon: Brain, color: 'bg-purple-100 text-purple-700' },
  { id: 'estratégia', name: 'Estratégia', icon: Target, color: 'bg-orange-100 text-orange-700' },
  { id: 'redator', name: 'Redator', icon: PenTool, color: 'bg-blue-100 text-blue-700' },
  { id: 'precificação', name: 'Precificação', icon: DollarSign, color: 'bg-green-100 text-green-700' },
  { id: 'pesquisa', name: 'Pesquisa', icon: Search, color: 'bg-cyan-100 text-cyan-700' }
];

export default function AIChatSidebar({ ideaId, idea, client }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('brainstorm');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Carregar histórico da ideia
    if (idea?.aiContext?.brainstormHistory) {
      setMessages(idea.aiContext.brainstormHistory);
    }
    if (idea?.aiContext?.aiSuggestions) {
      setSuggestions(idea.aiContext.aiSuggestions.filter(s => !s.applied));
    }
  }, [idea]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`/api/ideas/${ideaId}/ai-chat`, { message: input, mode });
      const data = res.data;

      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date().toISOString(),
          suggestions: data.data.suggestions
        }]);
        setSuggestions(data.data.suggestions.map(s => ({
          id: `sugg-${Date.now()}-${Math.random()}`,
          content: s,
          applied: false
        })));
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Erro ao conectar com a IA. Tente novamente.',
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = async (suggestion) => {
    await axios.post(`/api/ideas/${ideaId}/apply-ai`, { suggestionId: suggestion.id });
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  return (
    <div className="w-96 flex flex-col h-full bg-gray-50 border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">NEXO Creative Partner</h3>
        </div>
        <div className="flex gap-1 flex-wrap">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                mode === m.id ? m.color + ' ring-2 ring-offset-1' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <m.icon className="w-3 h-3" />
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Pergunte algo sobre esta ideia...</p>
            <p className="text-xs mt-1">A IA conhece o contexto do cliente vinculado</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${msg.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'bg-white text-gray-800'} 
              max-w-[90%] p-3 rounded-lg shadow-sm text-sm`}
          >
            {msg.role === 'assistant' ? (
              <ReactMarkdown className="prose prose-sm max-w-none">
                {msg.content}
              </ReactMarkdown>
            ) : (
              <p>{msg.content}</p>
            )}
          </motion.div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin" />
            NEXO Creative Partner está pensando...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 p-3 bg-yellow-50"
          >
            <p className="text-xs font-medium text-gray-600 mb-2">💡 Sugestões da IA:</p>
            <div className="space-y-1">
              {suggestions.map(sugg => (
                <div key={sugg.id} className="flex items-start gap-2 text-sm">
                  <button
                    onClick={() => applySuggestion(sugg)}
                    className="flex-shrink-0 mt-0.5 w-5 h-5 rounded border border-gray-300 hover:bg-green-100 hover:border-green-400 flex items-center justify-center transition-colors"
                  >
                    <Check className="w-3 h-3 text-green-600 opacity-0 hover:opacity-100" />
                  </button>
                  <span className="text-gray-700 line-clamp-2">{sugg.content}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={`Modo ${MODES.find(m => m.id === mode)?.name}...`}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Componente: `src/components/ideas/LinkedClientPicker.jsx`
**Funcionalidade:** Dropdown com busca que carrega clientes, leads e projetos do backend.

```jsx
import { useState, useEffect, useRef } from 'react';
import { Search, X, Building2, User, Folder } from 'lucide-react';

export default function LinkedClientPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [leads, setLeads] = useState([]);
  const [projects, setProjects] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    // Carregar dados do backend
    Promise.all([
      axios.get('/api/schema/clients'),
      axios.get('/api/leads'),
      axios.get('/api/schema/projects')
    ]).then(([cRes, lRes, pRes]) => {
      const c = cRes.data;
      const l = lRes.data;
      const p = pRes.data;
      // clients e projects são OBJETOS (dict), não arrays. Usar Object.values()
      if (c.success) setClients(Object.values(c.data?.clients || {}));
      if (l.success) setLeads(l.data?.leads || []);
      if (p.success) setProjects(Object.values(p.data?.projects || {}));
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = {
    clients: clients.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.company?.toLowerCase().includes(search.toLowerCase())),
    leads: leads.filter(l => l.name?.toLowerCase().includes(search.toLowerCase())),
    projects: projects.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors"
      >
        <div className="flex items-center gap-2">
          {value?.clientId ? (
            <>
              <Building2 className="w-4 h-4 text-blue-500" />
              <span>{value.clientName || 'Cliente selecionado'}</span>
            </>
          ) : (
            <span className="text-gray-400">Vincular a cliente, lead ou projeto...</span>
          )}
        </div>
        {value?.clientId && (
          <X
            className="w-4 h-4 text-gray-400 hover:text-red-500 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onChange({ clientId: null, clientName: null, leadId: null, projectId: null }); }}
          />
        )}
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-md">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 bg-transparent text-sm outline-none"
                autoFocus
              />
            </div>
          </div>

          {filtered.clients.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-medium text-gray-500 mb-1 px-2">Clientes</p>
              {filtered.clients.map(client => (
                <button
                  key={client.id}
                  onClick={() => {
                    onChange({ clientId: client.id, clientName: client.name || client.company, leadId: null, projectId: null });
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 text-sm text-left"
                >
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <p className="text-xs text-gray-500">{client.company}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {filtered.leads.length > 0 && (
            <div className="p-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1 px-2">Leads</p>
              {filtered.leads.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => {
                    onChange({ clientId: null, clientName: null, leadId: lead.id, projectId: null });
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 text-sm text-left"
                >
                  <User className="w-4 h-4 text-orange-500" />
                  <span>{lead.name}</span>
                </button>
              ))}
            </div>
          )}

          {filtered.projects.length > 0 && (
            <div className="p-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1 px-2">Projetos</p>
              {filtered.projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => {
                    onChange({ clientId: null, clientName: null, leadId: null, projectId: project.id });
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 text-sm text-left"
                >
                  <Folder className="w-4 h-4 text-green-500" />
                  <span>{project.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 📦 STACK & DEPENDÊNCIAS

### Backend (novas dependências)
```bash
npm install @google/genai
npm install uuid
npm install date-fns
```

### Frontend (novas dependências)
```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
npm install @tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder
npm install @tiptap/extension-task-list @tiptap/extension-task-item
npm install @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
npm install @tiptap/extension-highlight @tiptap/extension-typography
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install react-markdown
npm install html-react-parser
```

### Variáveis de Ambiente (`.env`)
```
GEMINI_API_KEY=AIzaSy-sua-chave-aqui
```

---

## 🐝 SWARM EXECUTION PLAN (SPARC Methodology)

### Metodologia SPARC
1. **S**pecification — Análise completa, schemas, contratos
2. **P**seudocode — Algoritmos e fluxos em pseudocódigo
3. **A**rchitecture — Implementação paralela backend + frontend
4. **R**efinement — Polish, editor, IA, integrações
5. **C**ompletion — QA, testes E2E, entrega

### Agentes Especializados (5 Agentes)

| # | Agente | Especialidade | Fase SPARC | Input | Output |
|---|--------|---------------|------------|-------|--------|
| 1 | **Arquiteto de Sistemas** | Análise de dados, schemas, relações, endpoints | Specification | Backend existente, JSON files | `/plans/01-architecture.md`, `/plans/02-data-flow.md`, `ideas-registry.json` com seed |
| 2 | **Engenheiro de API** | Pseudocódigo, contratos de API, validação | Pseudocode | Schemas do Arquiteto | `/plans/03-api-pseudocode.md` |
| 3a | **Backend Engineer** | Node.js, Express, JSON files, Gemini SDK | Architecture | Pseudocode | `backend/routes/ideas.js`, `backend/config/gemini.js`, integração com dados existentes |
| 3b | **Frontend Engineer** | React, Tailwind, Framer Motion, routing | Architecture | Schemas + designs | `src/pages/Ideas.jsx`, `src/pages/IdeaEditor.jsx`, views, filtros, stats |
| 4 | **Especialista Editor & IA** | TipTap, Gemini integration, UX, templates | Refinement | Backend + Frontend base | `BlockEditor.jsx`, `AIChatSidebar.jsx`, templates, comentários, dnd, colaboração |
| 5 | **Revisor & Integrador** | QA, testes E2E, Git, integração, JavaScript strict | Completion | Tudo | Testes passando, commits, PR, aprovação |

### Fluxo de Execução
```
┌─────────────────┐
│  Agente 1       │ ──→ Cria architecture.md + ideas-registry.json seed
│  Arquiteto      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agente 2       │ ──→ Cria api-pseudocode.md com todas as funções
│  API Engineer   │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Agente 3a│ │Agente 3b│ ──→ Implementam em PARALELO
│Backend  │ │Frontend │
└────┬───┘ └────┬───┘
     │          │
     └────┬─────┘
          ▼
┌─────────────────┐
│  Agente 4       │ ──→ Integra editor, IA, templates, dnd
│  Editor & IA    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agente 5       │ ──→ Testa E2E, revisa, commita, entrega
│  Revisor        │
└─────────────────┘
```

---

## ✅ CRITÉRIOS DE ACEITAÇÃO — CHECKLIST FINAL

### Backend
- [ ] `ideas-registry.json` criado com schema válido e seed data de 3 ideias reais (incluindo uma vinculada a Paulo/Santafé)
- [ ] Todos os 14 endpoints respondem corretamente via Postman/curl
- [ ] Busca full-text funciona em title, content, comments, tags
- [ ] Filtros combinados funcionam (status + type + clientId)
- [ ] `linkedTo.clientName` é populado automaticamente do `clients-registry.json`
- [ ] `convert-task` cria tarefa em `company-tasks.json` sem corromper arquivo
- [ ] `ai-chat` retorna resposta da Gemini com contexto do cliente
- [ ] `apply-ai` insere blocos no editor corretamente
- [ ] Soft delete (arquivar) funciona, não deleta fisicamente
- [ ] `requireAuth` em TODAS as rotas
- [ ] Tratamento de erro em TODOS os endpoints (try/catch + log)
- [ ] Nenhum JSON existente foi reformatado ou corrompido

### Frontend
- [ ] Página `/ideias` renderiza com 4 views funcionais (Tabela, Kanban, Galeria, Lista)
- [ ] Stats cards mostram dados reais do backend
- [ ] Filtros atualizam a lista em tempo real
- [ ] Kanban permite drag & drop entre colunas (atualiza status no backend)
- [ ] Card de ideia mostra: título, status badge, prioridade, cliente vinculado, tags, autor, data
- [ ] Botão "Nova Ideia" abre modal com template selector
- [ ] Página `/ideias/nova` e `/ideias/:id` usam o mesmo editor
- [ ] Editor TipTap renderiza todos os blocos: heading, paragraph, checklist, image, embed, callout, table
- [ ] Slash commands (`/heading`, `/list`, `/image`, `/checklist`, `/callout`, `/table`, `/embed`) funcionam
- [ ] Bubble toolbar aparece ao selecionar texto
- [ ] Upload de imagem salva em `/uploads/ideas/idea-XXX/` e referencia corretamente
- [ ] LinkedClientPicker busca e filtra clientes/leads/projetos do backend
- [ ] AI Chat Sidebar conecta à API Gemini e mostra respostas formatadas
- [ ] Modos de IA (Brainstorm, Estratégia, Redator, Precificação, Pesquisa) funcionam
- [ ] Sugestões da IA aparecem com botão "Aplicar"
- [ ] Comentários funcionam com @mentions
- [ ] Reações (emoji) em comentários funcionam (toggle)
- [ ] "Converter em Tarefa" funciona e redireciona para tarefas
- [ ] Animações Framer Motion em todas as transições de view
- [ ] Design consistente com sistema existente (cores, espaçamentos, tipografia)
- [ ] Sidebar mostra novo item "Ideias" com badge "beta"
- [ ] Responsivo: funciona em mobile (touch-friendly)

### Integração & Qualidade
- [ ] Fluxo E2E testado: criar ideia → vincular cliente → chat com IA → aplicar sugestão → comentar → converter em tarefa
- [ ] Código existente (Dashboard, Clientes, Projetos, Tarefas, WhatsApp) continua funcionando
- [ ] Nenhum erro no console do navegador
- [ ] Nenhum erro no terminal do backend
- [ ] JavaScript strict (sem erros)
- [ ] Commits atômicos com mensagens descritivas em português
- [ ] Branch `feature/sessao-ideias` criada
- [ ] Push só após aprovação do usuário

---

## 🔗 INSTRUÇÕES GITHUB

### Branch
```bash
git checkout -b feature/sessao-ideias
```

### Commits Atômicos (exemplos)
```
feat(ideas): cria schema ideas-registry.json e seed data realista
feat(api): implementa CRUD de ideias com filtros e busca full-text
feat(api): integra Gemini 2.5 Flash-Lite com contexto do cliente
feat(frontend): cria página Ideas com views Tabela/Kanban/Galeria/Lista
feat(frontend): implementa TipTap block-based editor com slash commands
feat(frontend): cria AI Chat Sidebar com modos brainstorm/estratégia/redator
feat(frontend): adiciona templates Proposta, Brainstorm, PRD, Pipeline
feat(frontend): implementa comentários, reações e @mentions
feat(integration): converte ideia em tarefa no company-tasks.json
feat(ui): adiciona animações Framer Motion e responsividade mobile
fix(review): ajustes pós-revisão do Revisor — JavaScript strict, sem any
```

### Pull Request
- **Título:** `feat: Sessão IDEIAS completa — workspace criativo com IA Gemini`
- **Descrição:** Incluir checklist de critérios de aceitação
- **Reviewers:** Elias (usuário principal)
- **Merge:** Só após aprovação explícita

---

## ⚠️ NOTAS IMPORTANTES — LEIA ANTES DE COMEÇAR

### 🚨 CRÍTICO — Swarm Vai Errar Se Não Seguir

1. **LINGUAGEM: JavaScript puro (.jsx/.js). NUNCA TypeScript.** Não usar interfaces, types, `<Type>`, `.tsx`, `as Type`, ou `any`.
2. **HTTP CLIENT: axios.** Todo frontend usa `axios`, NUNCA `fetch()`. Import: `import axios from 'axios'`.
3. **BACKEND: CommonJS (require).** O server.js usa `const express = require('express')`, NÃO `import`. Nunca usar ES modules (`import/export`) no backend.
4. **DESIGN SYSTEM NEXO:** Usar classes custom: `glass-card`, `bg-nexo-card`, `text-nexo-muted`, `text-nexo-success`, `text-nexo-primary`, `bg-nexo-primary`, etc. **NUNCA** usar classes Tailwind padrão como `bg-blue-600`, `text-gray-900`, `bg-white`, `bg-gray-100`.
5. **JSON FILES SÃO OBJETOS (dict), NÃO ARRAYS.** `clients-registry.json` → `data.clients[clientId]`. `projects-registry.json` → `data.projects[projectId]`. NUNCA usar `.find()`.
6. **AUTENTICAÇÃO:** Usar `requireAuth`, NÃO `authMiddleware`.
7. **API ENDPOINTS EXISTENTES:** Clientes = `/api/schema/clients`, Projetos = `/api/schema/projects`, Leads = `/api/leads`.
8. **UPLOADS:** O Express NÃO tem multer configurado. Para upload de imagens, adicionar `npm install multer` e configurar `app.use('/uploads', express.static(...))` no server.js.

### Regras de Ouro
9. **NUNCA reformatar JSONs existentes.** Append-only. Se precisar editar, fazer merge profundo.
10. **NUNCA instalar libs pagas.** Todas as libs devem ser MIT/Apache/BSD ou gratuitas.
11. **NUNCA expor chave API no código.** Usar `.env` para `GEMINI_API_KEY`.
12. **SEMPRE tratar erro no backend.** Retornar `{ success: false, error: "..." }` em vez de crashar.
13. **SEMPRE usar `requireAuth`.** Nenhuma rota de ideias pode ser pública.
14. **SEMPRE testar com dados reais.** Usar Paulo/Santafé como cliente de teste. Seed data deve incluir ideia realista vinculada a ele.
15. **SEMPRE commitar por fase.** Não fazer um commit gigante com tudo. Cada fase SPARC = 1+ commits.
16. **SEMPRE avisar antes de fazer push.** O usuário (Elias) deve aprovar cada push. Nunca push sem consentimento.
17. **SEMPRE fazer backup antes de escrever JSON.** `fs.writeFileSync(file + '.backup-' + Date.now(), original)`.
18. **NUNCA deletar campos de JSONs existentes.** Adicionar novos campos é permitido; remover ou renomear NÃO é.
19. **SEMPRE validar IDs de usuário.** `createdBy` deve ser um dos 3 IDs válidos. Rejeitar se inválido.
20. **SEMPRE usar IDs sequenciais com padding.** `idea-001`, `idea-002`, não `idea-1`, `idea-2`.
21. **SEMPRE usar ISO 8601 com UTC.** `2026-05-13T10:00:00Z`, nunca datas localizadas sem timezone.

---

## 🚀 COMO EXECUTAR ESTE SWARM

### Opção A: Claude Flow (Ruflo)
```bash
npx claude-flow@latest init --sparc
./claude-flow swarm "Execute o MISSION BRIEF da Sessão IDEIAS do NEXO Dashboard Pro conforme documento /plans/nexo-ideas-mission.md. Siga SPARC: Specification → Pseudocode → Architecture → Refinement → Completion. Use 5 agentes especializados. Não quebre código existente. Commits atômicos. Aprovação do usuário entre fases."
```

### Opção B: Kimi Code (VS Code)
1. Copiar este prompt para Kimi Code
2. Executar em fases com aprovação do usuário entre cada fase
3. Sempre enviar resumo antes de commit
4. Nunca implementar sem OK explícito

### Opção C: ClawTeam (múltiplos agentes CLI)
```bash
clawteam spawn tmux claude --team nexo-ideas --agent-name architect --task "Fase 1: SPECIFICATION — Analisar backend existente, criar schemas, architecture.md, data-flow.md, ideas-registry.json seed"
clawteam spawn tmux claude --team nexo-ideas --agent-name api-engineer --task "Fase 2: PSEUDOCODE — Escrever pseudocódigo de todos os endpoints, validações, fluxos de erro"
clawteam spawn tmux claude --team nexo-ideas --agent-name backend --task "Fase 3a: ARCHITECTURE — Implementar backend/routes/ideas.js, backend/config/gemini.js, todos os endpoints CRUD + IA"
clawteam spawn tmux claude --team nexo-ideas --agent-name frontend --task "Fase 3b: ARCHITECTURE — Implementar frontend pages, components, views, editor base"
clawteam spawn tmux claude --team nexo-ideas --agent-name editor-ia --task "Fase 4: REFINEMENT — Integrar TipTap editor completo, AI chat, templates, drag-drop, comentários"
clawteam spawn tmux claude --team nexo-ideas --agent-name reviewer --task "Fase 5: COMPLETION — QA, testes E2E, JavaScript strict, commits, PR"
```

### Opção D: Manual (Você mesmo)
1. Salvar este arquivo em `/plans/nexo-ideas-mission.md`
2. Seguir fase por fase
3. Cada fase = branch temporária, testar, merge na `feature/sessao-ideias`
4. Push só com aprovação

---

## 📚 REFERÊNCIAS OPEN SOURCE (Inspiração, NÃO copiar tudo)

| Repositório | O que pegar | Licença |
|-------------|-------------|---------|
| [steven-tey/novel](https://github.com/steven-tey/novel) | Patterns de TipTap com slash commands, bubble menu, image upload | MIT |
| [ueberdosis/tiptap](https://github.com/ueberdosis/tiptap) | Documentação de extensões, exemplos de custom nodes | MIT |
| [clauderic/dnd-kit](https://github.com/clauderic/dnd-kit) | Patterns de drag & drop, SortableContext, sensors | MIT |
| [tailwindlabs/tailwindcss.com](https://github.com/tailwindlabs/tailwindcss.com) | UI patterns, componentes, animações | MIT |
| [google-gemini/generative-ai-js](https://github.com/google-gemini/generative-ai-js) | SDK @google/genai, exemplos de streaming, grounding | Apache 2.0 |
| [Notion-API/notion-sdk-js](https://github.com/makenotion/notion-sdk-js) | Patterns de block-based data model (só a estrutura, não o SDK) | MIT |

---

## 📝 SEED DATA OBRIGATÓRIA

A `ideas-registry.json` deve vir com 3 ideias preenchidas:

1. **Idea-001:** "Redesign visual + sistema de orçamentos para Santafé" — vinculada a Paulo/Santafé, status `em-discussao`, tipo `proposta-comercial`, com conteúdo realista, checklist, callout sobre pagamento 50/50, comentários de Abner e Elias, e histórico de chat com IA.

2. **Idea-002:** "Implementar PWA no Nexo Billing" — ideia interna, status `aprovada`, tipo `produto-servico`, vinculada ao projeto NEXO-BILLING, com PRD parcial, checklist de tasks, sem cliente vinculado.

3. **Idea-003:** "Brainstorm: novo produto para gestão de clínicas" — status `rascunho`, tipo `brainstorm`, sem vínculo, com template de brainstorm preenchido parcialmente, tags `["novo-produto", "healthcare", "saas"]`.

---

## 🎨 DESIGN SYSTEM NEXO — USE EXATAMENTE ESTAS CLASSES

O NEXO Dashboard tem um design system **custom** baseado em Tailwind. **NUNCA use classes Tailwind padrão como `bg-blue-600`, `text-gray-900`, `bg-white`, etc.** Use as classes do sistema NEXO para manter consistência visual.

### Classes Obrigatórias
```
/* Cards e containers */
glass-card          → Card com backdrop-blur, border, bg semi-transparente
bg-nexo-card        → Fundo de cards internos (#1e1e2e aprox)
bg-nexo-bg          → Fundo da página (#0f0f1a aprox)
bg-nexo-border      → Cor de bordas (#2a2a3a aprox)

/* Texto */
text-nexo-text      → Texto principal (branco/cinza claro)
text-nexo-muted     → Texto secundário (cinza médio)
text-nexo-primary   → Texto de destaque/azul (#6c5ce7)
text-nexo-success   → Verde (#22c55e)
text-nexo-warning   → Amarelo/laranja (#f59e0b)
text-nexo-danger    → Vermelho (#ef4444)
text-nexo-info      → Azul/ciano (#3b82f6)

/* Botões e badges */
bg-nexo-primary     → Botão primário (roxo/azul #6c5ce7)
bg-nexo-success     → Botão verde
hover:bg-nexo-border→ Hover padrão

/* Status (use estas classes para badges) */
bg-nexo-success/20 text-nexo-success   → Aprovada/Concluída
bg-nexo-warning/20 text-nexo-warning   → Em discussão
bg-nexo-info/20 text-nexo-info         → Em andamento
bg-nexo-danger/20 text-nexo-danger     → Rejeitada/Urgente
bg-gray-500/20 text-gray-400           → Rascunho/Arquivada
```

### Exemplo de Card Correto
```jsx
// ✅ CORRETO — usa design system NEXO
<div className="glass-card p-4">
  <h3 className="text-nexo-text font-medium">Título</h3>
  <p className="text-nexo-muted text-sm">Descrição</p>
  <span className="bg-nexo-success/20 text-nexo-success text-xs px-2 py-0.5 rounded-full">Aprovada</span>
</div>

// ❌ ERRADO — não use classes Tailwind padrão
<div className="bg-white p-4 rounded-lg shadow">
  <h3 className="text-gray-900 font-medium">Título</h3>
  <p className="text-gray-500 text-sm">Descrição</p>
  <span className="bg-green-100 text-green-800">Aprovada</span>
</div>
```

---

## 🔐 SEGURANÇA & PERFORMANCE

1. **Rate limiting:** Implementar rate limit no `/api/ideas/:id/ai-chat` — máximo 10 req/min por usuário (para não estourar free tier da Gemini e evitar abuso).
2. **Sanitização:** Sanitizar todo input de usuário antes de salvar em JSON. Usar `DOMPurify` no frontend para renderizar conteúdo rico.
3. **Tamanho de uploads:** Limitar uploads a 10MB por arquivo, 50MB total por ideia.
4. **Pagination:** Sempre paginar listas. Nunca retornar mais de 200 items.
5. **Caching:** Cachear `clients-registry.json`, `projects-registry.json` em memória por 30 segundos para evitar I/O excessivo.
6. **Backup automático:** Antes de cada `writeFileSync`, criar backup com timestamp.

---

## 📊 MÉTRICAS DE SUCESSO (Pós-lançamento)

- 3 ideias criadas na primeira semana de uso
- 5+ interações com IA por ideia em média
- 2+ ideias convertidas em tarefas no primeiro mês
- 0 bugs críticos reportados
- Tempo médio de criação de ideia: < 2 minutos
- Tempo médio de resposta da IA: < 5 segundos

---

## 🏁 CONCLUSÃO

Este MISSION BRIEF é a especificação completa e definitiva para a Sessão IDEIAS do NEXO Dashboard Pro. Seguir à risca. Não improvisar. Não inventar fora do escopo. Não quebrar código existente.

**Prioridade máxima:** Entregar valor rápido (MVP funcional em 1 semana) com qualidade (JavaScript strict, testes, documentação).

**Prioridade secundária:** Polish visual e features avançadas (version history, PDF export, WhatsApp integration) podem vir nas próximas iterações.

**Regra de ouro:** Se não está neste documento, NÃO implementar sem aprovação do usuário.

---

**FIM DO MISSION BRIEF**
**Versão:** 1.0
**Data:** 2026-05-13
**Autor:** NEXO Digital — Sessão IDEIAS
**Status:** Pronto para execução via Agent Swarm
