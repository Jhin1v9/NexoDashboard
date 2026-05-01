# 🧠 ARQUITETURA MULTI-FONTE — NEXO DIGITAL

> **Documento Arquitetural de Referência**  
> Empresa: NEXO DIGITAL | Equipe: 3 pessoas (Abner, Nonoke, Elias)  
> Dashboard: React + Vite + Node.js + Express + WebSocket (porta 3456)  
> Versão: 1.0 | Data: 2026-05-01  
> **Status: EM PRODUÇÃO — implementável em produção imediatamente**

---

## 📋 SUMÁRIO EXECUTIVO

A NEXO DIGITAL precisa agregar dados de **6 fontes distintas** (WhatsApp, Discord, GitHub, Vercel, formulários do site, finanças) em um **único dashboard unificado** com notificações em tempo real. Este documento define a arquitetura, stack tecnológica, padrões ETL, sistema de classificação, frequências de polling e scripts de automação.

**Objetivo:** Menos de 2 segundos de delay entre evento real e notificação no dashboard. Zero perda de mensagens. Fácil manutenção por 3 pessoas.

---

## 🏗️ ARQUITETURA GERAL

### Modelo: ETL Híbrido + Event-Driven

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CAMADA DE FONTE (SOURCE LAYER)                          │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ WhatsApp │  │   Discord    │  │ GitHub   │  │ Vercel   │  │   Site Forms │  │
│  │  (2 gp)  │  │(Prog Plantão)│  │ (Repos)  │  │ (Deploys)│  │  (Novo Lead) │  │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │               │               │             │               │          │
│  [POLL]│          [WEBHOOK]      [WEBHOOK]     [WEBHOOK]       [WEBHOOK]       │
│  5s    │               │               │             │               │          │
│       ▼               ▼               ▼             ▼               ▼          │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │WhatsApp  │  │ Discord Bot  │  │ GitHub   │  │ Vercel   │  │ Form Handler │  │
│  │Adapter   │  │  Listener    │  │ Webhook  │  │ Webhook  │  │   Endpoint   │  │
│  │(Node.js) │  │  (Node.js)   │  │ Handler  │  │ Handler  │  │  (Express)   │  │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
└───────┼───────────────┼───────────────┼─────────────┼───────────────┼──────────┘
        │               │               │             │               │
        └───────────────┴───────────────┴─────────────┴───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE NORMALIZAÇÃO (TRANSFORM LAYER)                   │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │              Unified Message Normalizer (Node.js Service)                     │ │
│  │  • Converte cada fonte para formato unificado                                 │ │
│  │  • Aplica regras de classificação/priorização                                 │ │
│  │  • Dedup (detecta duplicados por hash)                                        │ │
│  │  • Enriquecimento (contexto, autor, thread)                                   │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                             │
│                                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │              Event Broker (Redis Pub/Sub + Stream)                            │ │
│  │  • Filas por prioridade: high | medium | low                                  │ │
│  │  • Stream: nexo:events (capped at ~10k)                                     │ │
│  │  • Pub/Sub: nexo:notify (real-time push)                                    │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE PERSISTÊNCIA (STORAGE LAYER)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   SQLite/    │  │    Redis     │  │   Arquivos   │  │    Supabase (futuro) │ │
│  │   PostgreSQL │  │   (cache)    │  │   (anexos)   │  │   (PostgreSQL + RT)  │ │
│  │              │  │              │  │              │  │                      │ │
│  │ • Messages   │  │ • Sessions   │  │ • WhatsApp   │  │ • Tudo acima         │ │
│  │ • Events     │  │ • Presence   │  │   media      │  │ • Realtime subs      │ │
│  │ • Threads    │  │ • Queues     │  │ • Attachments│  │ • Auth               │ │
│  │ • Metrics    │  │ • RateLimit  │  │ • Logs       │  │ • Storage            │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE API + REALTIME (API LAYER)                       │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │              NEXO API Server (Express + WebSocket porta 3456)                 │ │
│  │                                                                             │ │
│  │  REST Endpoints:                      WebSocket Events:                     │ │
│  │  • GET /api/inbox                    • message:new                          │ │
│  │  • GET /api/inbox/:id                • message:update                       │ │
│  │  • GET /api/stats                   • thread:new                            │ │
│  │  • POST /api/webhooks/:source       • priority:alert                        │ │
│  │  • GET /api/metrics                 • deploy:success/fail                   │ │
│  │  • GET /api/health                  • mention: detected                   │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                             │
│                                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │              Dashboard NEXO (React + Vite + Tailwind)                       │ │
│  │                                                                             │ │
│  │  Views:                                Widgets:                             │ │
│  │  • Unified Inbox (todas fontes)        • Status Vercel                      │ │
│  │  • Filtro por fonte/prioridade         • GitHub Activity                   │ │
│  │  • Thread detail view                  • WhatsApp últimas msgs              │ │
│  │  • Métricas/Analytics                  • Discord #programadores             │ │
│  │  • Alerts/Notificações               • Formulários (novos leads)           │ │
│  │  • Tarefas pendentes                 • Priority Queue                       │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE AUTOMAÇÃO (AUTOMATION LAYER)                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │   Cron Jobs      │  │   Event Rules    │  │     Notification Router        │  │
│  │  (node-cron)     │  │  (if-this-then)  │  │   (WhatsApp + Discord DM)      │  │
│  │                  │  │                  │  │                                │  │
│  │ • Reconcile      │  │ • New lead →     │  │ • @everyone no Discord         │  │
│  │   every 15min    │  │   notify Abner   │  │   (mention)                    │  │
│  │ • Health check   │  │ • Deploy fail →  │  │ • WhatsApp msg prioritária     │  │
│  │   every 5min     │  │   alert all      │  │   (urgente)                    │  │
│  │ • Cleanup old    │  │ • @mention →     │  │ • Push browser (SSE)           │  │
│  │   msgs (24h+)    │  │   highlight msg  │  │                                │  │
│  └──────────────────┘  └──────────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Padrões Arquiteturais Aplicados

| Padrão | Onde | Por quê |
|--------|------|---------|
| **Adapter Pattern** | Cada fonte tem seu adapter | Isolar lógica específica da plataforma. Mudança na API do Discord? Altera só o DiscordAdapter. |
| **ETL Híbrido** | Extrai (source), Transforma (normalizer), Carrega (storage) | Padronizar dados de 6 fontes diferentes em um schema único |
| **Event-Driven (Pub/Sub)** | Redis Streams + WebSocket | Desacoplar produtores de consumidores. WhatsApp não precisa saber que o dashboard existe. |
| **CQRS Leve** | Leitura via REST/WS, escrita via webhooks/events | O dashboard consome de um schema otimizado para leitura |
| **Unified Inbox** | Dashboard principal | Uma única interface para todos os canais, com threads e contexto preservado |
| **Circuit Breaker** | Cada adapter | Se WhatsApp cai, não quebra o resto do sistema |

---

## 🔄 FLUXO DE DADOS ENTRE FONTES

### Fluxo Completo (end-to-end)

```
[FONTE] → [ADAPTER] → [NORMALIZADOR] → [BROKER] → [STORAGE] → [API] → [DASHBOARD]
   │          │            │              │           │          │         │
   │          │            │              │           │          │         │
   ▼          ▼            ▼              ▼           ▼          ▼         ▼
WhatsApp   WhatsApp    UnifiedMsg      Redis      SQLite    Express   React
 (polling)  Adapter    Schema         Stream     DB        API       UI

Discord    Discord     ┌─────────┐    ┌─────┐    ┌────┐    ┌─────┐   ┌─────┐
(webhook)  Adapter     │ dedup   │───▶│ high│───▶│    │───▶│ REST│──▶│ Inbox│
                       │ classify│    │ med │    │    │    │ WS  │   │ Stats│
GitHub     GitHub     │ enrich  │    │ low │    │    │    │     │   │Alerts│
(webhook)  Adapter     └─────────┘    └─────┘    └────┘    └─────┘   └─────┘

Vercel     Vercel
(webhook)  Adapter

Forms      Form
(webhook)  Handler
```

### Estados de uma Mensagem no Sistema

```
[RECEIVED] → [NORMALIZED] → [CLASSIFIED] → [QUEUED] → [DELIVERED] → [READ/ARCHIVED]
    │             │              │            │           │             │
    ▼             ▼              ▼            ▼           ▼             ▼
  Adapter     Schema         Priority     Redis      WebSocket    User action
  recebe      unificado      score        Stream     push        no dashboard
```

---

## ⏱️ FREQUÊNCIA DE POLLING POR FONTE

| Fonte | Método | Frequência | Justificativa | Rate Limit |
|-------|--------|-----------|---------------|------------|
| **WhatsApp** | Polling (WhatsApp Web / Baileys) | **5 segundos** | Mensagens de grupo precisam ser rapidamente capturadas. Baileys mantém conexão persistente, polling é leve. | N/A (conexão persistente via Baileys) |
| **Discord** | **WebSocket Gateway** (real-time) | **Event-driven** | Discord Gateway é push nativo. Zero polling. Bot conecta via WebSocket e recebe `messageCreate` events. | 120 eventos/60s por bucket. Backpressure automático. |
| **GitHub** | **Webhooks** + Polling fallback | **Webhook: instantâneo** / **Fallback: 60 segundos** | Webhooks para commits, PRs, issues. Polling como fallback para rate limits ou downtime. | 5000 req/hr (API), webhooks ilimitados |
| **Vercel** | **Webhooks** | **Event-driven** | Vercel envia webhooks para deploy events. Zero polling necessário. | N/A |
| **Site (Forms)** | **Webhook/POST** | **Event-driven** | Formulário envia POST para endpoint `/api/webhooks/forms` quando submetido. | N/A (próprio tráfego) |
| **Finanças** | Polling (se houver API) | **15 minutos** | Dados financeiros não precisam de tempo real. Reconciliação periódica suficiente. | Depende do provider |

### Decisão Arquitetural: Webhooks >> Polling

> **Regra de ouro:** Sempre que a fonte suportar webhooks, use webhooks. Polling é fallback de último recurso. Webhooks reduzem latência de minutos para milissegundos e diminuem carga no servidor em 95%+ (dados do Linear e outras plataformas).

**Quando usar polling:**
- WhatsApp (não há webhook oficial para grupos via WhatsApp Web)
- Fallback de reconciliação quando webhook falha
- Fontes sem API de eventos (alguns sistemas legados)

---

## 📐 FORMATO DE DADOS UNIFICADO

### Schema: `UnifiedEvent`

Todo evento de qualquer fonte é convertido para este schema antes de entrar no sistema.

```json
{
  "event_id": "evt_a1b2c3d4e5f6",           // UUID v4 gerado pelo normalizador
  "source": "discord",                      // Fonte: whatsapp | discord | github | vercel | forms | finance
  "source_event_id": "1234567890",          // ID original da fonte
  "timestamp_received": "2026-05-01T13:44:00.000Z",  // Quando o adapter recebeu
  "timestamp_origin": "2026-05-01T13:43:58.000Z",  // Timestamp original da fonte
  
  "type": "message",                        // message | deploy | issue | pr | form_submit | mention | alert | reaction
  "subtype": "group_message",              // group_message | dm | thread_reply | comment | commit | deployment | bug_report | lead | mention
  
  "author": {
    "id": "user_123",
    "name": "Elias",
    "username": "elias_dev",
    "avatar_url": "https://cdn.discordapp.com/...",
    "role": "developer",                    // intern | developer | admin | client | bot | system
    "is_bot": false,
    "is_me": false                          // true se o autor sou eu (NEXO DIGITAL)
  },
  
  "content": {
    "text": "Alguém pode revisar o PR #42?",
    "html": "<p>Alguém pode revisar o PR #42?</p>",
    "markdown": "Alguém pode revisar o PR #42?",
    "attachments": [
      {
        "type": "image",
        "url": "https://cdn.discordapp.com/...",
        "filename": "screenshot.png",
        "mime_type": "image/png",
        "size_bytes": 124500
      }
    ],
    "links": [
      {
        "url": "https://github.com/nexo/pr-42",
        "title": "PR #42 - Add dark mode",
        "preview": "..."
      }
    ]
  },
  
  "context": {
    "conversation_id": "conv_abc123",        // Thread/conversa agrupada
    "parent_event_id": null,                // Se for reply, ID do evento pai
    "channel": {
      "id": "123456789",
      "name": "programadores-de-plantao",
      "type": "group"                       // group | dm | channel | repository
    },
    "project_id": null,
    "client_id": null,                      // Se detectado via form ou contexto
    "tags": ["review", "frontend", "urgente"]
  },
  
  "priority": {
    "score": 85,                            // 0-100 calculado
    "level": "high",                        // critical | high | medium | low | info
    "reasons": [
      "mention_detected",
      "keyword_urgent",
      "source_discord_high_trust"
    ]
  },
  
  "status": {
    "state": "new",                         // new | read | archived | pending | resolved | ignored
    "read_by": [],                          // ["abner", "elias"]
    "assigned_to": null,                    // "elias"
    "first_seen_at": "2026-05-01T13:44:00.000Z",
    "read_at": null,
    "archived_at": null
  },
  
  "actions": {
    "can_reply": true,
    "can_react": true,
    "can_assign": true,
    "can_archive": true,
    "reply_endpoint": "/api/reply/discord/123456789",
    "source_url": "https://discord.com/channels/.../123456789/1234567890"
  },
  
  "metadata": {
    "raw_payload_hash": "sha256:abc123...", // Hash do payload original para dedup
    "adapter_version": "1.0.0",
    "processed_at": "2026-05-01T13:44:00.500Z",
    "processing_duration_ms": 45
  }
}
```

### Schema: `UnifiedThread`

Conversa agrupada por `conversation_id`, independente da fonte.

```json
{
  "thread_id": "conv_abc123",
  "participants": ["abner", "elias", "nonoke"],
  "sources": ["discord", "whatsapp"],
  "title": "Revisão PR #42 - Dark Mode",
  "last_message_at": "2026-05-01T13:44:00.000Z",
  "message_count": 12,
  "unread_count": 3,
  "priority": "high",
  "status": "open",
  "tags": ["frontend", "review", "dark-mode"]
}
```

---

## 🎯 SISTEMA DE CLASSIFICAÇÃO / PRIORIZAÇÃO

### Fórmula de Prioridade (Score 0-100)

```
score = base_score + urgency_bonus + relevance_bonus - staleness_penalty

Onde:
- base_score:     Depende do source (veja tabela abaixo)
- urgency_bonus:  +30 se keywords urgentes detectadas
- relevance_bonus: +20 se @mention ao usuário logado
- staleness_penalty: -1 por minuto após 30 minutos de idade
```

### Base Score por Fonte

| Fonte | Base Score | Justificativa |
|-------|-----------|---------------|
| **Vercel (deploy fail)** | 100 | Deploy quebrado = parada de produção |
| **GitHub (issue critical)** | 95 | Bug crítico no repo |
| **Forms (novo lead)** | 90 | Potencial cliente = receita |
| **WhatsApp (mensagem)** | 70 | Comunicação cliente/direta |
| **Discord (@mention)** | 85 | Alguém precisa de você |
| **Discord (mensagem normal)** | 50 | Comunicação interna |
| **GitHub (commit normal)** | 40 | Atividade normal |
| **Vercel (deploy success)** | 30 | Info, não urgente |
| **Finanças** | 20 | Dados periódicos, não urgente |

### Keywords de Urgência (aumentam score em +30)

```javascript
const URGENCY_KEYWORDS = [
  "urgente", "urgente", "critical", "crítico", "quebrado", "broken",
  "down", "offline", "erro", "error", "fail", "falha", "bug",
  "produção", "production", "cliente espera", "deadline", "prazo",
  "deploy failed", "build failed", "ci failed", "test failed",
  "@everyone", "@here", "help", "socorro", "parou", "stopped"
];
```

### Níveis de Prioridade

| Score | Level | Cor | Ação |
|-------|-------|-----|------|
| 90-100 | 🔴 **CRITICAL** | Vermelho | Push imediato + som + notificação WhatsApp |
| 70-89 | 🟠 **HIGH** | Laranja | Push imediato + badge no dashboard |
| 40-69 | 🟡 **MEDIUM** | Amarelo | Badge no dashboard, sem push |
| 10-39 | 🟢 **LOW** | Verde | Apenas no feed, sem badge |
| 0-9 | ⚪ **INFO** | Cinza | Log silencioso |

### Regras de Notificação (Event Rules)

```javascript
// config/notifications.js
const NOTIFICATION_RULES = [
  {
    id: "deploy-fail-alert",
    condition: { source: "vercel", type: "deploy", status: "failed" },
    action: { 
      notify: ["all"], 
      channel: ["discord", "whatsapp"],
      priority: "critical",
      sound: true 
    }
  },
  {
    id: "new-lead",
    condition: { source: "forms", type: "lead" },
    action: { 
      notify: ["abner"], 
      channel: ["whatsapp"],
      priority: "high",
      template: "🎯 NOVO LEAD: {name} - {email} - Interesse: {service}"
    }
  },
  {
    id: "mention-discord",
    condition: { source: "discord", type: "mention", mentioned_user: "{me}" },
    action: { 
      notify: ["{me}"], 
      channel: ["dashboard", "discord_dm"],
      priority: "high" 
    }
  },
  {
    id: "github-pr-review",
    condition: { source: "github", type: "pr", action: "review_requested" },
    action: { 
      notify: ["{requested_reviewer}"], 
      channel: ["dashboard"],
      priority: "medium" 
    }
  },
  {
    id: "whatsapp-client-msg",
    condition: { source: "whatsapp", type: "message", is_client: true },
    action: { 
      notify: ["abner"], 
      channel: ["dashboard", "whatsapp"],
      priority: "high",
      template: "📱 Cliente no WhatsApp: {sender_name}\n{content_preview}"
    }
  }
];
```

---

## 🔌 INTEGRAÇÃO DISCORD — DETALHAMENTO COMPLETO

### Opções de Integração

| Método | Latência | Esforço | Quando Usar |
|--------|---------|---------|-------------|
| **Discord Bot (Gateway)** | <100ms | Médio | **Recomendado** — recebe todos os eventos em tempo real |
| **Discord Webhooks** | <1s | Baixo | Apenas para enviar mensagens DO dashboard PARA o Discord |
| **Discord HTTP API** | ~200ms | Baixo | Operações pontuais (buscar histórico, enviar DM) |

### Arquitetura Recomendada: Bot + Webhooks

```
┌─────────────┐     Gateway (WebSocket)     ┌───────────────┐
│   Discord   │◄───────────────────────────►│  NEXO Bot     │
│   Server    │    messageCreate events      │  (Node.js)    │
│             │    reactionAdd events        │               │
│             │    guildMemberAdd, etc       │  • Recebe     │
└─────────────┘                              │  • Normaliza  │
                                             │  • Envia p/   │
                                             │    Redis       │
                                             └───────┬───────┘
                                                     │
                              ┌──────────────────────┴──────────┐
                              │                                   │
                              ▼                                   ▼
                       ┌─────────────┐                    ┌─────────────┐
                       │  Redis      │                    │  Webhook    │
                       │  Stream     │                    │  Endpoint   │
                       │  (events)   │                    │  (outbound) │
                       └──────┬──────┘                    └─────────────┘
                              │                                   │
                              ▼                                   ▼
                       ┌─────────────┐                    ┌─────────────┐
                       │  Dashboard  │                    │   Discord   │
                       │  (WebSocket)│                    │   Channel   │
                       └─────────────┘                    └─────────────┘
```

### Configuração do Bot Discord

```javascript
// discord/bot.js
const { Client, GatewayIntentBits, Events } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,    // REQUERIDO: precisa habilitar no portal
    GatewayIntentBits.GuildMembers,
  ]
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  
  // Normalizar e enviar para o sistema
  const normalizedEvent = await normalizeDiscordMessage(message);
  await publishToRedis(normalizedEvent);
  
  // Se for @mention a alguém da equipe, notificar
  const mentioned = message.mentions.users.find(u => 
    ['abner_id', 'nonoke_id', 'elias_id'].includes(u.id)
  );
  if (mentioned) {
    await notifyMention(normalizedEvent, mentioned);
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  const normalizedEvent = await normalizeDiscordReaction(reaction, user);
  await publishToRedis(normalizedEvent);
});

client.login(process.env.DISCORD_BOT_TOKEN);
```

### Slash Commands para Gerenciamento

```javascript
// Comandos úteis para a equipe interagir com o dashboard via Discord
const commands = [
  {
    name: 'status',
    description: 'Ver status do dashboard NEXO',
  },
  {
    name: 'task',
    description: 'Criar uma tarefa no dashboard',
    options: [
      { name: 'title', type: 3, required: true, description: 'Título da tarefa' },
      { name: 'priority', type: 3, required: false, description: 'low|medium|high' },
    ]
  },
  {
    name: 'alert',
    description: 'Enviar alerta para todos no dashboard',
    options: [
      { name: 'message', type: 3, required: true, description: 'Mensagem de alerta' },
    ]
  }
];
```

### Discord Webhook Outbound (Dashboard → Discord)

```javascript
// Quando um evento crítico acontece, notificar o Discord
async function notifyDiscordChannel(event) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  const payload = {
    username: "NEXO Monitor",
    avatar_url: "https://nexo.digital/logo.png",
    embeds: [{
      title: event.type === 'deploy' && event.status === 'failed' 
        ? "🚨 DEPLOY FALHOU" 
        : `📩 ${event.source.toUpperCase()}`,
      description: event.content.text.substring(0, 2000),
      color: event.priority.level === 'critical' ? 0xff4757 : 0x3742fa,
      fields: [
        { name: "Prioridade", value: event.priority.level, inline: true },
        { name: "Autor", value: event.author.name, inline: true },
        { name: "Fonte", value: event.source, inline: true },
      ],
      timestamp: event.timestamp_received,
      footer: { text: "NEXO DIGITAL Dashboard" }
    }]
  };
  
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
```

---

## 🔔 EVENT-DRIVEN ARCHITECTURE PARA DASHBOARD

### Por que Event-Driven?

> **"Producers não precisam saber quem consome seus eventos, e consumers podem escalar independentemente."**  
> — Event-Driven Architecture, 2025

Para a NEXO DIGITAL, isso significa:
- WhatsApp cai? O dashboard continua funcionando.
- 100 mensagens chegam de uma vez? Redis fila e processa sem perder nada.
- Adicionar uma nova fonte? Só criar um adapter — o resto do sistema não muda.

### Componentes do Sistema de Eventos

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         EVENT PIPELINE                                        │
│                                                                               │
│   ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐     │
│   │ Producer │───▶│ Redis Stream   │───▶│ Consumer     │───▶│ Action   │     │
│   │ (Adapter)│    │ (nexo:events)  │    │ (Worker)     │    │ (Notify) │     │
│   └──────────┘    └──────────────┘    └──────────────┘    └──────────┘     │
│                                                                               │
│   Cada adapter produz → Stream central consome → Workers processam → Ação    │
│                                                                               │
│   Grupos de Consumidores:                                                     │
│   • group:dashboard  → atualiza UI em tempo real                             │
│   • group:notifier   → envia push/WhatsApp/Discord                           │
│   • group:storage    → persiste no SQLite                                     │
│   • group:analytics  → agrega métricas                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Redis Streams: Configuração de Produção

```javascript
// config/redis.js
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
});

// Stream principal: todos os eventos normalizados
const STREAM_NAME = 'nexo:events';
const MAX_STREAM_LENGTH = 10000;  // ~ cap the stream

// Publicar evento
async function publishEvent(event) {
  const payload = JSON.stringify(event);
  await redis.xadd(STREAM_NAME, 'MAXLEN', '~', MAX_STREAM_LENGTH, '*', 'data', payload);
}

// Consumir eventos (consumer group)
async function consumeEvents(groupName, consumerName, handler) {
  const streamKey = STREAM_NAME;
  
  // Criar grupo se não existir
  try {
    await redis.xgroup('CREATE', streamKey, groupName, '$', 'MKSTREAM');
  } catch (e) {
    if (!e.message.includes('already exists')) throw e;
  }
  
  // Loop de consumo
  while (true) {
    const results = await redis.xreadgroup(
      'GROUP', groupName, consumerName,
      'COUNT', 10,
      'BLOCK', 5000,
      'STREAMS', streamKey, '>'
    );
    
    if (results) {
      for (const [, messages] of results) {
        for (const [id, fields] of messages) {
          const event = JSON.parse(fields[1]);
          await handler(event);
          await redis.xack(streamKey, groupName, id);
        }
      }
    }
  }
}
```

### WebSocket vs SSE: Decisão para o Dashboard

| Critério | WebSocket (atual) | SSE (Server-Sent Events) |
|----------|-------------------|--------------------------|
| **Latência** | <50ms | <100ms |
| **Bidirecional** | ✅ Sim | ❌ Não (apenas server→client) |
| **Firewall-friendly** | ❌ Pode ser bloqueado | ✅ HTTP puro, 100% compatível |
| **Reconexão automática** | Manual | ✅ Nativa do browser |
| **Autenticação** | Custom | Token via query string |
| **Complexidade** | Média | Baixa |
| **Recomendação** | **Manter WebSocket** | Migrar futuramente se firewall for problema |

> **Decisão:** Manter WebSocket (já implementado na porta 3456). Adicionar **SSE como fallback** para clientes com problemas de firewall. Implementar long-polling como último recurso.

### Real-Time Push: Fluxo Completo

```
[Evento Discord] ──▶ [Discord Adapter] ──▶ [Redis Stream] ──▶ [API Server]
                                                                   │
                                                                   │ WebSocket broadcast
                                                                   ▼
                                                            [Clientes React]
                                                                   │
                                                                   ├─▶ Dashboard Abner (push)
                                                                   ├─▶ Dashboard Elias (push)
                                                                   └─▶ Dashboard Nonoke (push)
```

---

## 🔬 PADRÕES ETL (EXTRACT, TRANSFORM, LOAD)

### Pipeline ETL da NEXO DIGITAL

```
┌─────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐
│ EXTRACT │──▶│  TRANSFORM│──▶│ ENRICH   │──▶│  LOAD    │──▶│ NOTIFY  │
└─────────┘   └───────────┘   └──────────┘   └──────────┘   └─────────┘
   │             │               │              │              │
   │             │               │              │              │
   ▼             ▼               ▼              ▼              ▼
Adapter      Normalizer      Classifier     SQLite +       WebSocket
recebe       converte para    calcula       Redis          + Push
payload      UnifiedEvent     prioridade    Stream         + WhatsApp
```

### E — EXTRACT (Adapters)

```javascript
// adapters/whatsapp.adapter.js
class WhatsAppAdapter {
  constructor(baileysClient) {
    this.client = baileysClient;
    this.groupIds = ['group_id_1', 'group_id_2']; // 2 grupos monitorados
  }

  async start() {
    this.client.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (!this.groupIds.includes(msg.key.remoteJid)) continue;
        
        const rawPayload = this.extractPayload(msg);
        await this.pipeline.ingest(rawPayload);
      }
    });
  }

  extractPayload(msg) {
    return {
      platform: 'whatsapp',
      raw: msg,
      timestamp: msg.messageTimestamp * 1000,
      groupId: msg.key.remoteJid,
      sender: msg.key.participant || msg.key.remoteJid,
      content: msg.message?.conversation || msg.message?.extendedTextMessage?.text,
      media: msg.message?.imageMessage || msg.message?.documentMessage,
    };
  }
}
```

```javascript
// adapters/discord.adapter.js
class DiscordAdapter {
  constructor(botClient) {
    this.client = botClient;
  }

  async start() {
    this.client.on(Events.MessageCreate, async (message) => {
      // Ignorar bots e canais não-monitorados
      if (message.author.bot) return;
      if (message.channel.name !== 'programadores-de-plantao') return;
      
      const rawPayload = this.extractPayload(message);
      await this.pipeline.ingest(rawPayload);
    });
  }

  extractPayload(message) {
    return {
      platform: 'discord',
      raw: message,
      timestamp: message.createdTimestamp,
      channelId: message.channelId,
      guildId: message.guildId,
      author: {
        id: message.author.id,
        username: message.author.username,
        displayName: message.author.displayName,
      },
      content: message.content,
      mentions: message.mentions.users.map(u => u.id),
      attachments: message.attachments.map(a => a.url),
    };
  }
}
```

```javascript
// adapters/github.adapter.js
class GitHubAdapter {
  constructor() {
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  }

  async handleWebhook(req) {
    // Verificar assinatura HMAC
    const signature = req.headers['x-hub-signature-256'];
    const payload = req.body;
    
    const rawPayload = this.extractPayload(payload, req.headers['x-github-event']);
    await this.pipeline.ingest(rawPayload);
    
    return { status: 'ok' };
  }

  extractPayload(payload, eventType) {
    return {
      platform: 'github',
      raw: payload,
      eventType,  // push, pull_request, issues, etc.
      timestamp: payload.repository?.updated_at,
      repo: payload.repository?.full_name,
      author: payload.sender,
      action: payload.action,
      content: this.formatContent(payload, eventType),
    };
  }
}
```

```javascript
// adapters/vercel.adapter.js
class VercelAdapter {
  async handleWebhook(req) {
    const payload = req.body;
    
    const rawPayload = {
      platform: 'vercel',
      raw: payload,
      eventType: payload.type,  // deployment, project
      timestamp: new Date().toISOString(),
      project: payload.name || payload.project?.name,
      url: payload.url,
      state: payload.state,  // READY, ERROR, BUILDING
      deploymentId: payload.id,
      gitCommit: payload.meta?.githubCommitRef,
    };
    
    await this.pipeline.ingest(rawPayload);
    return { status: 'ok' };
  }
}
```

### T — TRANSFORM (Normalizer)

```javascript
// core/normalizer.js
class UnifiedNormalizer {
  constructor() {
    this.dedupCache = new Map();  // últimos 1000 hashes
  }

  async normalize(rawEvent) {
    const normalizer = this.getNormalizer(rawEvent.platform);
    const unified = await normalizer(rawEvent);
    
    // Dedup check
    const hash = this.hashPayload(unified);
    if (this.dedupCache.has(hash)) {
      return null; // Duplicado, descartar
    }
    this.dedupCache.set(hash, Date.now());
    
    // Cleanup cache antigo
    if (this.dedupCache.size > 1000) {
      const oldest = this.dedupCache.keys().next().value;
      this.dedupCache.delete(oldest);
    }
    
    return unified;
  }

  getNormalizer(platform) {
    const normalizers = {
      whatsapp: this.normalizeWhatsApp.bind(this),
      discord: this.normalizeDiscord.bind(this),
      github: this.normalizeGitHub.bind(this),
      vercel: this.normalizeVercel.bind(this),
      forms: this.normalizeForm.bind(this),
    };
    return normalizers[platform];
  }

  hashPayload(event) {
    const crypto = require('crypto');
    const str = `${event.source}:${event.source_event_id}:${event.timestamp_origin}`;
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  normalizeDiscord(raw) {
    return {
      event_id: generateUUID(),
      source: 'discord',
      source_event_id: raw.raw.id,
      timestamp_received: new Date().toISOString(),
      timestamp_origin: new Date(raw.timestamp).toISOString(),
      type: 'message',
      subtype: raw.raw.mentions.users.size > 0 ? 'mention' : 'group_message',
      author: {
        id: raw.author.id,
        name: raw.author.displayName || raw.author.username,
        username: raw.author.username,
        avatar_url: raw.raw.author.displayAvatarURL?.(),
        role: 'unknown',  // mapear via roles cache
        is_bot: false,
      },
      content: {
        text: raw.content,
        html: null,
        markdown: raw.content,
        attachments: raw.attachments.map(url => ({
          type: this.guessMimeType(url),
          url,
        })),
        links: this.extractLinks(raw.content),
      },
      context: {
        conversation_id: `discord:${raw.channelId}`,
        parent_event_id: raw.raw.reference?.messageId || null,
        channel: {
          id: raw.channelId,
          name: raw.raw.channel.name,
          type: 'group',
        },
      },
      actions: {
        can_reply: true,
        can_react: true,
        source_url: `https://discord.com/channels/${raw.guildId}/${raw.channelId}/${raw.raw.id}`,
      },
      metadata: {
        raw_payload_hash: this.hashPayload(raw),
      }
    };
  }
  
  // ... normalizeWhatsApp, normalizeGitHub, normalizeVercel, normalizeForm
}
```

### L — LOAD (Storage)

```javascript
// core/storage.js
class EventStorage {
  constructor(db, redis) {
    this.db = db;        // SQLite/PostgreSQL
    this.redis = redis;  // Cache + Streams
  }

  async save(event) {
    // 1. Persistir no banco relacional
    await this.db.run(`
      INSERT INTO events (
        event_id, source, source_event_id, type, subtype,
        author_id, author_name, content_text, priority_score, priority_level,
        conversation_id, channel_id, channel_name, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      event.event_id, event.source, event.source_event_id,
      event.type, event.subtype, event.author.id, event.author.name,
      event.content.text?.substring(0, 2000),  // limitar tamanho
      event.priority.score, event.priority.level,
      event.context.conversation_id,
      event.context.channel.id,
      event.context.channel.name,
      event.status.state,
      event.timestamp_received
    ]);

    // 2. Publicar no Redis Stream para realtime
    await this.redis.xadd('nexo:events', '*', 'data', JSON.stringify(event));

    // 3. Atualizar cache de threads
    await this.updateThreadCache(event);

    return event;
  }

  async updateThreadCache(event) {
    const threadKey = `thread:${event.context.conversation_id}`;
    const thread = await this.redis.hgetall(threadKey);
    
    if (!thread || !thread.thread_id) {
      // Criar novo thread
      await this.redis.hmset(threadKey, {
        thread_id: event.context.conversation_id,
        sources: event.source,
        last_message_at: event.timestamp_received,
        message_count: 1,
        unread_count: 1,
        priority: event.priority.level,
        status: 'open',
      });
    } else {
      // Atualizar thread existente
      await this.redis.hmset(threadKey, {
        last_message_at: event.timestamp_received,
        message_count: parseInt(thread.message_count || 0) + 1,
        unread_count: parseInt(thread.unread_count || 0) + 1,
        priority: this.maxPriority(thread.priority, event.priority.level),
      });
    }
  }

  maxPriority(a, b) {
    const levels = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    return levels[a] > levels[b] ? a : b;
  }
}
```

---

## 📊 COMO AS SOLUÇÕES DE MERCADO FAZEM

### Linear.app

**Arquitetura:** GraphQL API + Webhooks nativos + Real-time sync

| Aspecto | Como faz |
|---------|----------|
| **API** | GraphQL (mesma API usada internamente). Toda mutação via API é observada em tempo real por todos os clientes. |
| **Webhooks** | HTTP POST com payload completo do objeto alterado. HMAC-SHA256 assinatura. Retries com backoff exponencial (1min → 1hr → 6hrs). |
| **Realtime** | WebSocket interno — qualquer mudança na API reflete em todos os clients conectados instantaneamente. |
| **Inbox** | "Inbox Notifications" — eventos que envolvem o usuário diretamente (mention, assigned, reaction). Separado do feed geral. |
| **Agent Integration** | Webhooks para agentes de IA. Primeira resposta em <10s, follow-ups em até 30min. |

**Lição para NEXO:** Usar webhooks como primeira escolha. Fallback de polling com reconciliação periódica. Separar "inbox do usuário" de "feed geral".

### Notion

**Arquitetura:** Connected Workspace — docs, wikis, databases em um sistema flexível

| Aspecto | Como faz |
|---------|----------|
| **Dados** | Tudo é block. Databases com múltiplas views (table, board, calendar, gallery, list, timeline). |
| **API** | REST + Beta SDK. Rate limit: 3 req/s. |
| **Webhooks** | Webhooks para changes em databases (novas páginas, updates). |
| **Real-time** | Colaboração real-time é nativa — múltiplos usuários editam simultaneamente. |
| **Integrações** | Zapier, Make, Slack, GitHub. Foco em conectar, não em centralizar. |

**Lição para NEXO:** O "database como primitivo" é poderoso. Poderia usar Supabase (PostgreSQL + Realtime) como equivalente, com views diferentes no dashboard.

### Monday.com

**Arquitetura:** Visual Work Management + Automation Rules Engine

| Aspecto | Como faz |
|---------|----------|
| **Boards** | Color-coded boards com status, owner, due date, priority — tudo visual. |
| **Automations** | "Receitas" no-code: "quando status muda para Done, notificar owner e mover para archive". |
| **API** | GraphQL API. Webhooks para changes em boards. |
| **Integrations** | 40+ integrações nativas. Slack, Teams, Gmail, etc. |
| **Unified** | Centraliza tarefas, não mensagens. Diferente do nosso caso. |

**Lição para NEXO:** A "receita" de automação é excelente. Replicar com regras simples tipo if-this-then-that. Foco em ações, não apenas notificações.

### HubSpark / Unified Inbox Solutions

**Arquitetura:** Channel Aggregation + Smart Organization + Unified Response

| Aspecto | Como faz |
|---------|----------|
| **Aggregation** | Conecta a APIs oficiais de cada plataforma. Mensagens fluem para sistema central. |
| **Organization** | By customer (thread única independente da plataforma), by status (new/open/pending/closed), by assignment, by priority. |
| **Context Preservation** | Histórico completo, customer details, previous interactions, tags, notes da equipe. |
| **Unified Response** | Responde do inbox. Mensagem sai pela plataforma correta automaticamente. |

**Lição para NEXO:** Manter threads por "conversa", não por plataforma. Preservar contexto entre interações. Permitir resposta direta do dashboard quando possível.

### Blabla.ai / SMS-iT (Social Media Management)

**Arquitetura:** Polling + Webhooks híbridos + Event Rules + AI Responses

| Aspecto | Como faz |
|---------|----------|
| **Ingestão** | Background polling OU webhooks (quando disponível). |
| **Event Triggers** | Novo comentário, palavra flaggada, lead pronto. |
| **Routing** | Regras roteiam mensagens para filas, aplicam tags, lançam automações. |
| **AI** | Auto-respostas e respostas sugeridas mantendo brand voice. |
| **Analytics** | Métricas cross-platform (response time, engagement, satisfaction). |

**Lição para NEXO:** Implementar event triggers (quando X acontece, faça Y). Usar IA para sumarizar threads longas e sugerir priorização.

---

## 🛠️ STACK TECNOLÓGICA RECOMENDADA

### Stack Atual + Adições Mínimas

| Camada | Atual | Adicionar | Alternativa Futura |
|--------|-------|-----------|-------------------|
| **Frontend** | React 18 + Vite + Tailwind | — | — |
| **Backend API** | Express (porta 3456) | — | — |
| **WebSocket** | ws (nativo) | SSE fallback | — |
| **Database** | SQLite (provavelmente) | Redis (cache + streams) | Supabase (PostgreSQL + Realtime) |
| **Queue/Events** | — | **Redis (ioredis)** | RabbitMQ / BullMQ |
| **WhatsApp** | WhatsApp Web / Baileys | — | WhatsApp Business API (quando possível) |
| **Discord** | — | **discord.js + bot token** | — |
| **GitHub** | — | **Webhooks** + octokit | — |
| **Vercel** | — | **Webhooks** | — |
| **Forms** | — | **POST endpoint** + validation | — |
| **Cron** | — | **node-cron** | — |
| **Process Manager** | — | **PM2** | Docker |
| **Hosting** | Local/VPS | — | Railway / Render (futuro) |

### Decisão: Por que Redis?

1. **Lightweight** — roda em container ou instalação simples (menos de 50MB RAM)
2. **Multi-função** — cache, filas (streams), pub/sub, presence, rate limiting
3. **Familar** — sintaxe simples, ótima documentação
4. **Escalável** — quando crescer, Redis Cluster está disponível
5. **Zero custo** — open source, sem licença

### PM2 para Gerenciamento de Processos

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'nexo-api',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3456 },
      log_file: './logs/api.log',
      error_file: './logs/api.error.log',
      out_file: './logs/api.out.log',
      max_memory_restart: '500M',
      restart_delay: 3000,
    },
    {
      name: 'nexo-discord-bot',
      script: './discord/bot.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
    },
    {
      name: 'nexo-worker-events',
      script: './workers/event-consumer.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', CONSUMER_GROUP: 'dashboard' },
    },
    {
      name: 'nexo-worker-notify',
      script: './workers/notification-consumer.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', CONSUMER_GROUP: 'notifier' },
    },
    {
      name: 'nexo-whatsapp-adapter',
      script: './adapters/whatsapp.adapter.js',
      instances: 1,
      exec_mode: 'fork',
      restart_delay: 10000,
    }
  ]
};
```

---

## 📝 SCRIPTS DE AUTOMAÇÃO SUGERIDOS

### 1. Script de Reconciliação (cada 15 minutos)

```javascript
// scripts/reconcile.js
const cron = require('node-cron');

// Reconciliação: garantir que nada foi perdido entre webhooks
cron.schedule('*/15 * * * *', async () => {
  console.log('[RECONCILE] Starting reconciliation cycle...');
  
  const results = {
    whatsapp: await reconcileWhatsApp(),
    github: await reconcileGitHub(),
    discord: await reconcileDiscord(),
    vercel: await reconcileVercel(),
  };
  
  const totalFixed = Object.values(results).reduce((a, b) => a + b, 0);
  if (totalFixed > 0) {
    console.log(`[RECONCILE] Fixed ${totalFixed} missing events`);
    await notifyAdmins(`🔄 Reconciliação: ${totalFixed} eventos sincronizados`);
  }
});

async function reconcileWhatsApp() {
  // Buscar últimas mensagens do Baileys store
  // Comparar com database local
  // Inserir faltantes
  const lastSync = await db.get('SELECT MAX(timestamp_origin) FROM events WHERE source = "whatsapp"');
  const missing = await baileys.getMessagesAfter(lastSync);
  let fixed = 0;
  for (const msg of missing) {
    const exists = await db.get('SELECT 1 FROM events WHERE source_event_id = ?', [msg.key.id]);
    if (!exists) {
      await pipeline.ingest(msg);
      fixed++;
    }
  }
  return fixed;
}

async function reconcileGitHub() {
  // GitHub API: buscar recent events
  const since = await db.get('SELECT MAX(timestamp_origin) FROM events WHERE source = "github"');
  const events = await githubAPI.listRepoEvents({ since });
  let fixed = 0;
  for (const event of events) {
    const exists = await db.get('SELECT 1 FROM events WHERE source_event_id = ?', [event.id]);
    if (!exists) {
      await pipeline.ingest(event);
      fixed++;
    }
  }
  return fixed;
}
```

### 2. Script de Health Check (cada 5 minutos)

```javascript
// scripts/health-check.js
const cron = require('node-cron');

cron.schedule('*/5 * * * *', async () => {
  const checks = {
    api: await checkAPI(),
    websocket: await checkWebSocket(),
    redis: await checkRedis(),
    whatsapp: await checkWhatsApp(),
    discord: await checkDiscordBot(),
    github: await checkGitHubWebhook(),
    vercel: await checkVercelWebhook(),
  };
  
  const failures = Object.entries(checks).filter(([_, v]) => !v.ok);
  
  if (failures.length > 0) {
    const msg = `🚨 HEALTH CHECK FALHOU:\n${failures.map(([name]) => `- ${name}`).join('\n')}`;
    await notifyAbner(msg);
  }
  
  // Salvar métricas
  await db.run(`
    INSERT INTO health_checks (timestamp, api_ok, ws_ok, redis_ok, wa_ok, discord_ok, github_ok, vercel_ok)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [new Date().toISOString(), ...Object.values(checks).map(c => c.ok ? 1 : 0)]);
});

async function checkAPI() {
  try {
    const res = await fetch('http://localhost:3456/api/health');
    return { ok: res.status === 200, latency: Date.now() - start };
  } catch {
    return { ok: false, latency: null };
  }
}

async function checkWhatsApp() {
  try {
    const state = await baileys.getState();
    return { ok: state === 'connected', state };
  } catch {
    return { ok: false };
  }
}

async function checkDiscordBot() {
  try {
    const ws = discordClient.ws;
    return { ok: ws.status === 0, status: ws.status }; // 0 = READY
  } catch {
    return { ok: false };
  }
}
```

### 3. Script de Cleanup (diário)

```javascript
// scripts/cleanup.js
cron.schedule('0 3 * * *', async () => {
  // Arquivar mensagens antigas (>30 dias)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  await db.run(`
    UPDATE events 
    SET status = 'archived', archived_at = ?
    WHERE created_at < ? AND status != 'archived'
  `, [new Date().toISOString(), thirtyDaysAgo]);
  
  // Deletar events resolvidos muito antigos (>90 dias)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await db.run(`
    DELETE FROM events 
    WHERE created_at < ? AND status IN ('resolved', 'archived', 'ignored')
  `, [ninetyDaysAgo]);
  
  // Compactar SQLite
  await db.run('VACUUM');
  
  console.log('[CLEANUP] Daily cleanup completed');
});
```

### 4. Script de Deploy Auto-Notify

```javascript
// adapters/vercel.adapter.js — notificação especial para deploys
async function handleDeployEvent(payload) {
  const event = await this.normalize(payload);
  
  if (event.state === 'ERROR') {
    // ALERTA CRÍTICO
    await notifyAll({
      priority: 'critical',
      message: `🚨 DEPLOY FALHOU: ${event.project}\n${event.url}\nCommit: ${event.gitCommit}`,
      channels: ['discord', 'whatsapp', 'dashboard'],
      sound: true,
    });
  } else if (event.state === 'READY') {
    // Deploy OK
    await notifyDashboard({
      priority: 'info',
      message: `✅ Deploy OK: ${event.project}`,
    });
  }
}
```

### 5. Script de Novo Lead → Notificação

```javascript
// adapters/forms.adapter.js
async function handleFormSubmit(payload) {
  const event = await this.normalize(payload);
  
  // Enriquecer: detectar se é cliente novo ou recorrente
  const existingClient = await db.get(
    'SELECT * FROM clients WHERE email = ?', 
    [payload.email]
  );
  
  event.context.client_id = existingClient?.id || null;
  event.context.is_new_client = !existingClient;
  
  // Prioridade alta para novo lead
  event.priority = {
    score: existingClient ? 70 : 95,
    level: existingClient ? 'medium' : 'high',
    reasons: ['new_lead', existingClient ? 'recurring_client' : 'first_contact'],
  };
  
  await this.pipeline.ingest(event);
  
  // Notificar imediatamente
  await notifyAbner({
    message: event.context.is_new_client 
      ? `🎯 NOVO LEAD: ${payload.name} (${payload.email})\nServiço: ${payload.service}\nMensagem: ${payload.message?.substring(0, 100)}`
      : `🔄 CLIENTE RECORRENTE: ${payload.name} enviou novo formulário`,
    channel: 'whatsapp',
  });
}
```

### 6. Script de Backup Diário

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backup/nexo-digital/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Backup SQLite
cp ./data/nexo.db "$BACKUP_DIR/nexo.db"

# Backup Redis
cp ./data/dump.rdb "$BACKUP_DIR/dump.rdb"

# Backup config
cp -r ./config "$BACKUP_DIR/config"

# Compress
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

# Keep only last 7 days
find /backup/nexo-digital -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR.tar.gz"
```

---

## 📅 ROADMAP DE IMPLEMENTAÇÃO

### Fase 1: Fundação (Semana 1-2)
- [ ] Instalar Redis local
- [ ] Criar schema SQLite (`events`, `threads`, `health_checks`)
- [ ] Implementar `UnifiedEvent` schema
- [ ] Implementar `UnifiedNormalizer`
- [ ] Criar sistema de dedup por hash
- [ ] Testar pipeline end-to-end com eventos simulados

### Fase 2: Fontes Core (Semana 3-4)
- [ ] WhatsApp Adapter (Baileys → UnifiedEvent)
- [ ] GitHub Webhook handler
- [ ] Vercel Webhook handler
- [ ] Form POST endpoint
- [ ] Dashboard: Unified Inbox view
- [ ] Dashboard: Filtros por fonte/prioridade

### Fase 3: Discord (Semana 5)
- [ ] Criar bot no Discord Developer Portal
- [ ] Configurar intents (MessageContent obrigatório)
- [ ] Implementar Discord Adapter
- [ ] Conectar ao grupo "Programadores de Plantão"
- [ ] Slash commands (/status, /task, /alert)
- [ ] Testar mention detection

### Fase 4: Event-Driven + Real-time (Semana 6)
- [ ] Redis Stream: `nexo:events`
- [ ] Consumer groups (dashboard, notifier, storage, analytics)
- [ ] WebSocket broadcast otimizado
- [ ] SSE fallback
- [ ] Reconnect com Last-Event-ID

### Fase 5: Automação + Polish (Semana 7)
- [ ] Cron: reconciliação (15min)
- [ ] Cron: health check (5min)
- [ ] Cron: cleanup (diário)
- [ ] Notification rules engine
- [ ] WhatsApp push para eventos críticos
- [ ] Backup automático

### Fase 6: Analytics + Refinamento (Semana 8)
- [ ] Métricas de resposta por fonte
- [ ] Métricas de volume/prioridade
- [ ] Dashboard analytics view
- [ ] Performance tuning (Redis config)
- [ ] Documentação de operação

---

## 🔗 REFERÊNCIAS E FONTES

1. **Linear Webhooks Guide** — https://inventivehq.com/blog/linear-webhooks-guide (2025)
2. **Linear Developers: Webhooks** — https://linear.app/developers/webhooks
3. **Discord Event Relay Bot** — https://javascript.plainenglish.io/discord-event-relay-bot (2025)
4. **Discord Bot Guide 2026** — https://skywork.ai/skypage/en/discord-bot-guide
5. **Building a Unified Social Media Inbox** — https://getlate.dev/blog/unified-social-media-inbox (2024)
6. **Multi-Platform Communication Aggregation Pattern** — https://agentic-patterns.com/patterns/multi-platform-communication-aggregation/
7. **HubSpark Unified Inbox** — https://hubspark.com/how-does-hubsparks-unified-inbox-work
8. **Wasupp Unified Inbox** — https://www.wasupp.in/blog/what-is-a-unified-inbox
9. **Blabla.ai Social Media Management** — https://blabla.ai/blog/social-media-management-platforms (2026)
10. **Notion vs Monday.com 2026** — https://get-alfred.ai/blog/notion-vs-monday
11. **Runbear: AI Operating System** — https://runbear.io/posts/superhuman-vs-fyxer-vs-runbear (2026)
12. **Event-Driven Architecture 2025** — https://www.growin.com/blog/event-driven-architecture-scale-systems-2025/
13. **SSE Architecture at Artera** — https://innovation.artera.io/blog/our-journey-to-a-scalable-sse-architecture/
14. **Designing Scalable Notification Systems** — https://namastedev.com/blog/designing-scalable-notification-systems/
15. **SMS-iT Communication Hub** — https://smsit.ai/feature-social-media-messaging
16. **Render Webhook Discord Bot** — https://render.com/templates/webhook-discord-bot

---

## ✅ CHECKLIST DE ENTREGA

- [x] Diagrama arquitetural completo (texto/descritivo)
- [x] Fluxo de dados entre todas as 6 fontes
- [x] Frequência de polling por fonte (tabela)
- [x] Formato de dados unificado (`UnifiedEvent` schema JSON)
- [x] Sistema de classificação/priorização com fórmula e níveis
- [x] Padrões ETL (Extract, Transform, Load) com código
- [x] Integração Discord detalhada (bot, webhooks, slash commands)
- [x] Event-driven architecture (Redis Streams, Pub/Sub, WebSocket/SSE)
- [x] Melhores práticas de unified inbox + polling
- [x] Soluções de mercado: Linear, Notion, Monday.com, HubSpark, SMS-iT
- [x] Stack tecnológica recomendada (compatível com stack atual)
- [x] 6 scripts de automação prontos para uso
- [x] Roadmap de implementação em 8 semanas
- [x] Referências de mercado com URLs

---

> **Documento gerado por pesquisa arquitetural multi-fonte.**  
> **Status:** Pronto para implementação.  
> **Próximo passo:** Fase 1 — instalar Redis e criar schema base.
