# PLANO LUNA ÚNICA v20.0 — A ADMINISTRADORA GESTORA DA NEXO DIGITAL

> **Objetivo:** Transformar a Luna em uma única entidade consciente que controla ABSOLUTAMENTE TUDO no NEXO Dashboard via chat. Toda ação que um humano pode fazer pela UI, a Luna deve conseguir fazer via chat — tanto online (API) quanto offline (JSON direto).

---

## 1. DIAGNÓSTICO ATUAL (Problemas)

### 1.1 Fragmentação Frontend
| Componente | Função | Problema |
|-----------|--------|----------|
| `LunaControl.jsx` (/luna) | Terminal + Chat + Comandos + Status | Código de chat duplicado |
| `LunaChatPanel.jsx` | Painel flutuante na sidebar | Chat idêntico ao acima, código separado |
| `LunaEmailAssistant.jsx` | Modal no Email | IA separada, não conversa com a Luna |
| IA de Ideias (/api/ideas/:id/ai-chat) | Chat só de ideias | IA isolada, não sabe do resto do NEXO |

### 1.2 Fragmentação Backend
| Sistema de IA | Endpoint | Escopo | Memória |
|--------------|----------|--------|---------|
| Luna Concierge | `/api/luna/chat` | Tarefas, leads, financeiro, WhatsApp | `luna-chat-threads.json` |
| IA de Ideias | `/api/ideas/:id/ai-chat` | Só ideias | Isolado em `ideas-registry.json` |
| IA de Email | `/api/email/ai/...` | Só emails | Isolado em runtime/email |

**Resultado:** 3 IAs que não se conhecem. O usuário pergunta "quantas tarefas tenho?" na aba Ideias e a IA não sabe responder.

---

## 2. VISÃO FINAL — LUNA v20.0

```
┌─────────────────────────────────────────────────────────────┐
│                    USUÁRIO (Chat)                           │
│              "Cria tarefa, responde email do                │
│               João e me mostra o caixa"                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND ÚNICO: /luna                          │
│    ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│    │   Terminal  │  │    Chat     │  │    Comandos     │   │
│    │   (logs)    │  │  (threads)  │  │   (quick acts)  │   │
│    └─────────────┘  └─────────────┘  └─────────────────┘   │
│                                                             │
│    NENHUM outro ponto de chat da Luna existe no site.       │
│    O email tem botão "Perguntar à Luna" que abre /luna.     │
│    As ideias têm botão "Chat com Luna" que abre /luna.      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND ÚNICO: /api/luna/chat                  │
│                                                             │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│    │ IntentParser│───▶│ActionExecutor│───▶│   Gemini    │   │
│    │  (regex +  │    │  (executa   │    │  (fallback  │   │
│    │   LLM)      │    │   tudo)     │    │  social)    │   │
│    └─────────────┘    └─────────────┘    └─────────────┘   │
│                            │                                │
│                            ▼                                │
│    ┌─────────────────────────────────────────────────────┐ │
│    │              MEMÓRIA COMPARTILHADA                   │ │
│    │  luna-chat-threads.json (todas as conversas)        │ │
│    │  + acesso direto a TODOS os arquivos JSON do NEXO   │ │
│    └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. LISTA COMPLETA DE AÇÕES QUE A LUNA DEVE EXECUTAR

Mapeadas a partir dos 217 endpoints do backend:

### 3.1 TAREFAS (`/api/tasks`)
- ✅ `criar_tarefa` — Criar tarefa (já existe)
- ✅ `listar_tarefas` — Listar tarefas (já existe)
- ✅ `concluir_tarefa` — Concluir tarefa (já existe como `confirmar_tarefa`)
- ✅ `excluir_tarefa` — Excluir tarefa (já existe)
- ✅ `atualizar_status_tarefa` — Mudar status (já existe)
- ✅ `adicionar_comentario_tarefa` — Comentar (já existe)
- ⬜ `atualizar_tarefa` — Editar título, descrição, prioridade, prazo, responsável
- ⬜ `listar_tarefas_por_filtro` — Filtrar por status, prioridade, responsável, data

### 3.2 CLIENTES & WORKSPACE (`/api/workspace/clients`, `/api/schema/clients`)
- ⬜ `criar_cliente` — Criar cliente no workspace
- ⬜ `listar_clientes` — Listar todos os clientes
- ⬜ `atualizar_cliente` — Editar cliente
- ⬜ `excluir_cliente` — Remover cliente
- ⬜ `detectar_stack_cliente` — Detectar tecnologia do cliente
- ⬜ `iniciar_servidor_cliente` — Start servidor do cliente
- ⬜ `parar_servidor_cliente` — Stop servidor do cliente
- ⬜ `listar_arquivos_cliente` — Listar arquivos/pastas
- ⬜ `criar_pasta_cliente` — Criar pasta
- ⬜ `fazer_upload_cliente` — Upload de arquivo (via chat: "faz upload do arquivo X")

### 3.3 PROJETOS (`/api/projects`)
- ⬜ `listar_projetos` — Listar projetos do schema
- ⬜ `criar_projeto` — Criar projeto
- ⬜ `atualizar_projeto` — Editar projeto
- ⬜ `excluir_projeto` — Remover projeto

### 3.4 LEADS (`/api/leads`)
- ✅ `criar_lead` — Criar lead (já existe)
- ✅ `listar_leads` — Listar leads (já existe)
- ✅ `excluir_lead` — Excluir lead (já existe)
- ⬜ `atualizar_lead` — Editar lead
- ⬜ `converter_lead` — Converter lead em cliente

### 3.5 FINANCEIRO — RECEITAS (`/api/payments`)
- ✅ `registrar_pagamento` — Criar receita (já existe)
- ✅ `registrar_pagamento_com_split` — Criar receita com split (já existe)
- ✅ `excluir_pagamento` — Excluir receita (já existe)
- ⬜ `listar_pagamentos` — Listar receitas
- ⬜ `atualizar_pagamento` — Editar receita
- ⬜ `adicionar_transacao` — Adicionar pagamento/transação
- ⬜ `receber_split` — Marcar split como recebido

### 3.6 FINANCEIRO — DESPESAS (`/api/expenses`)
- ✅ `registrar_despesa` — Criar despesa (já existe)
- ✅ `registrar_despesa_com_split` — Criar despesa com split (já existe)
- ✅ `excluir_despesa` — Excluir despesa (já existe)
- ⬜ `listar_despesas` — Listar despesas
- ⬜ `atualizar_despesa` — Editar despesa
- ⬜ `pagar_despesa` — Marcar despesa como paga
- ⬜ `criar_template_despesa` — Criar template de despesa

### 3.7 FINANCEIRO — CAIXA (`/api/cash-box`)
- ⬜ `consultar_caixa` — Ver saldo do caixa
- ⬜ `ajustar_caixa` — Ajustar saldo
- ⬜ `adicionar_entrada_caixa` — Registrar entrada
- ⬜ `listar_historico_caixa` — Ver histórico
- ⬜ `projecao_caixa` — Projeção 6 meses
- ⬜ `reconciliar_caixa` — Reconciliar

### 3.8 FINANCEIRO — ORÇAMENTOS (`/api/quotes`)
- ⬜ `criar_orcamento` — Criar orçamento/quote
- ⬜ `listar_orcamentos` — Listar orçamentos
- ⬜ `atualizar_orcamento` — Editar orçamento
- ⬜ `excluir_orcamento` — Remover orçamento

### 3.9 IDEIAS (`/api/ideas`)
- ⬜ `criar_ideia` — Criar ideia
- ⬜ `listar_ideias` — Listar ideias
- ⬜ `atualizar_ideia` — Editar ideia
- ⬜ `excluir_ideia` — Excluir ideia
- ⬜ `comentar_ideia` — Comentar em ideia
- ⬜ `converter_ideia_em_tarefa` — Converter ideia em tarefa
- ⬜ `criar_ideia_de_template` — Criar a partir de template
- ⬜ `listar_templates_ideias` — Listar templates

### 3.10 WHATSAPP (`/api/whatsapp`, `/api/whatsapp-agent`)
- ✅ `consultar_whatsapp` — Ver status do WhatsApp (já existe)
- ✅ `verificar_mencoes` — Verificar @Luna pendentes (já existe)
- ⬜ `enviar_mensagem_whatsapp` — Enviar mensagem
- ⬜ `escanear_whatsapp` — Forçar scan
- ⬜ `limpar_buffer_whatsapp` — Limpar buffer
- ⬜ `ver_historico_whatsapp` — Ver histórico
- ⬜ `ver_classificacoes` — Ver classificações pendentes
- ⬜ `corrigir_classificacao` — Corrigir classificação

### 3.11 EMAIL (`/api/email/...`)
- ⬜ `listar_emails` — Listar emails
- ⬜ `ler_email` — Ler email específico
- ⬜ `enviar_email` — Enviar email
- ⬜ `marcar_email_lido` — Marcar como lido
- ⬜ `marcar_email_nao_lido` — Marcar como não lido
- ⬜ `favoritar_email` — Favoritar
- ⬜ `arquivar_email` — Arquivar
- ⬜ `mover_para_lixeira` — Lixeira
- ⬜ `marcar_spam` — Spam
- ⬜ `criar_rascunho_email` — Criar rascunho
- ⬜ `aprovar_rascunho` — Aprovar rascunho
- ⬜ `rejeitar_rascunho` — Rejeitar rascunho
- ⬜ `sugerir_resposta_email` — Sugerir resposta (IA)
- ⬜ `resumir_thread_email` — Resumir thread (IA)
- ⬜ `analizar_email` — Analisar email (IA)

### 3.12 INSTAGRAM (`/api/instagram`)
- ⬜ `listar_mensagens_instagram` — Listar mensagens
- ⬜ `importar_mensagem_instagram` — Importar mensagem

### 3.13 LINKS (`/api/links`)
- ⬜ `listar_links` — Listar links salvos
- ⬜ `adicionar_link` — Salvar link
- ⬜ `excluir_link` — Remover link
- ⬜ `enriquecer_link` — Enriquecer dados do link
- ⬜ `sincronizar_links` — Sincronizar links

### 3.14 OPERAÇÕES (`/api/ops`)
- ⬜ `criar_alerta_operacao` — Criar alerta
- ⬜ `excluir_alerta_operacao` — Remover alerta
- ⬜ `registrar_mudanca` — Registrar mudança

### 3.15 SISTEMA & STACK (`/api/system`, `/api/stack-status`)
- ✅ `consultar_status_sistema` — Ver status (já existe)
- ✅ `executar_diagnostico` — Diagnóstico (já existe)
- ✅ `executar_autoconserto` — Auto-fix (já existe)
- ⬜ `controlar_servico` — Start/stop/restart serviço
- ⬜ `ver_logs_stack` — Ver logs
- ⬜ `verificar_stack` — Ver status do stack

### 3.16 SEGURANÇA (`/api/security`)
- ⬜ `consultar_log_seguranca` — Ver log
- ⬜ `atualizar_config_seguranca` — Atualizar settings
- ⬜ `testar_whatsapp_seguranca` — Testar WhatsApp

### 3.17 NOTIFICAÇÕES (`/api/notifications`)
- ⬜ `listar_notificacoes` — Listar notificações
- ⬜ `marcar_notificacao_lida` — Marcar como lida
- ⬜ `marcar_todas_lidas` — Marcar todas como lidas
- ⬜ `excluir_notificacao` — Remover notificação

### 3.18 USUÁRIOS & AUTH (`/api/auth`, `/api/users`)
- ⬜ `consultar_usuarios` — Listar usuários
- ⬜ `trocar_usuario` — Switch user
- ⬜ `alterar_senha` — Trocar senha

### 3.19 EXTERNAL TOOLS
- ⬜ `listar_repos_github` — Listar repos GitHub
- ⬜ `listar_projetos_vercel` — Listar projetos Vercel
- ⬜ `executar_comando` — Rodar comando externo
- ⬜ `fazer_git_push` — Git push

### 3.20 BUGDETECTOR (`/api/bugdetector`)
- ⬜ `listar_relatorios_bug` — Listar reports
- ⬜ `excluir_relatorio_bug` — Remover report

---

## 4. ARQUITETURA DA UNIFICAÇÃO

### 4.1 Frontend — Um Único Ponto de Chat
```
App.jsx
└── ProtectedLayout
    ├── Sidebar (item normal: /luna)
    ├── Routes
    │   └── /luna → LunaControl (único chat)
    └── [REMOVIDO] LunaChatPanel flutuante
```

**Outras páginas que precisam da Luna:**
- EmailHub.jsx → Botão "Perguntar à Luna" que navega para `/luna?context=email&threadId=xyz`
- Ideias.jsx → Botão "Chat com Luna" que navega para `/luna?context=ideas&ideaId=xyz`
- WhatsApp.jsx → Botão "Falar com Luna" que navega para `/luna?context=whatsapp`
- Dashboard.jsx → Card da Luna clicável → `/luna`

### 4.2 Backend — Um Único Endpoint de IA
```
/api/luna/chat (único)
    ├── IntentParser (entende qualquer coisa)
    │   ├── Regex fast-path (tarefa, lead, pagamento, despesa, ideia, email...)
    │   └── LLM fallback (Gemini para tudo o mais)
    ├── ActionExecutor (executa tudo)
    │   ├── Módulo Tarefas
    │   ├── Módulo Clientes
    │   ├── Módulo Projetos
    │   ├── Módulo Leads
    │   ├── Módulo Financeiro (payments, expenses, cash-box, quotes)
    │   ├── Módulo Ideias
    │   ├── Módulo WhatsApp
    │   ├── Módulo Email
    │   ├── Módulo Instagram
    │   ├── Módulo Links
    │   ├── Módulo Operações
    │   ├── Módulo Sistema
    │   ├── Módulo Segurança
    │   ├── Módulo Notificações
    │   └── Módulo Usuários
    └── Resposta humanizada
```

### 4.3 Sistema de Contexto por Thread
Cada thread pode ter um `contextModule`:
- `null` → Contexto geral (sabe de tudo)
- `"email"` → Contexto de email (sabe dos emails + tudo o mais)
- `"ideas"` → Contexto de ideias (sabe das ideias + tudo o mais)
- `"whatsapp"` → Contexto de WhatsApp

Isso permite que a Luna seja contextualmente relevante sem perder a visão geral.

---

## 5. FASES DE IMPLEMENTAÇÃO

### FASE 1: Fundação Frontend (Imediato)
1. ✅ Sidebar: Luna como item normal de nav (`/luna`) — **FEITO**
2. ⬜ App.jsx: Remover `LunaChatPanel` flutuante e estado `lunaChatOpen`
3. ⬜ LunaControl.jsx: Adicionar suporte a query params (`?context=email&threadId=xyz`)
4. ⬜ EmailHub.jsx: Botão "Perguntar à Luna" → navega para `/luna?context=email`
5. ⬜ Ideias.jsx: Botão "Chat com Luna" → navega para `/luna?context=ideas`
6. ⬜ WhatsApp.jsx: Botão "Falar com Luna" → navega para `/luna?context=whatsapp`
7. ⬜ Dashboard.jsx: Card da Luna clicável → `/luna`

### FASE 2: Expansão do ActionExecutor (Backend)
8. ⬜ Criar módulos separados no ActionExecutor para cada domínio
9. ⬜ Implementar todas as ações de Tarefas (editar, filtrar)
10. ⬜ Implementar ações de Clientes/Workspace
11. ⬜ Implementar ações de Projetos
12. ⬜ Implementar ações de Leads (editar, converter)
13. ⬜ Implementar ações de Financeiro (caixa, orçamentos, transações)
14. ⬜ Implementar ações de Ideias (CRUD completo)
15. ⬜ Implementar ações de WhatsApp (enviar, escanear, limpar)
16. ⬜ Implementar ações de Email (ler, enviar, arquivar, etc.)
17. ⬜ Implementar ações de Instagram
18. ⬜ Implementar ações de Links
19. ⬜ Implementar ações de Operações
20. ⬜ Implementar ações de Sistema
21. ⬜ Implementar ações de Segurança
22. ⬜ Implementar ações de Notificações
23. ⬜ Implementar ações de Usuários

### FASE 3: Expansão do IntentParser (Backend)
24. ⬜ Adicionar regex patterns para todos os novos domínios
25. ⬜ Atualizar prompt do LLM para reconhecer TODAS as ações
26. ⬜ Adicionar `knownActions` com todas as novas ações

### FASE 4: Unificação da IA de Ideias
27. ⬜ `ideas.js`: `/api/ideas/:id/ai-chat` deve chamar `/api/luna/chat` internamente
28. ⬜ Passar contexto da ideia para a Luna (título, conteúdo, status)
29. ⬜ Tool Calling de ideias deve usar ActionExecutor
30. ⬜ Threads de ideias devem aparecer no chat geral da Luna

### FASE 5: Unificação da IA de Email
31. ⬜ `email-ai.js`: Unificar endpoints de IA de email no ActionExecutor
32. ⬜ Luna deve conseguir responder emails diretamente do chat
33. ⬜ "Responde o email do João dizendo que está ok" → ActionExecutor envia email

### FASE 6: Consciência Total
34. ⬜ `buildDashboardContext()` deve incluir dados de TODOS os módulos
35. ⬜ Luna deve saber responder "o que está acontecendo no NEXO agora"
36. ⬜ Memória semântica: Luna lembra de conversas anteriores em qualquer thread
37. ⬜ Cross-context: "Baseado na ideia X, cria uma tarefa para o Elias"

### FASE 7: Offline-First & Resiliência
38. ⬜ Toda ação do ActionExecutor deve tentar API primeiro, fallback JSON direto
39. ⬜ Se Gemini estiver fora, regex deve cobrir 90% dos comandos comuns
40. ⬜ Sistema de fila: ações que falham vão para buffer e são retentadas

---

## 6. PADRÃO DE CÓDIGO PARA NOVAS AÇÕES

```javascript
// ActionExecutor.js
async executeSingle(action, authorName) {
  switch (action.type) {
    // ... ações existentes ...
    
    case 'criar_cliente':
      return await this.createClient(action.params, authorName);
    case 'atualizar_cliente':
      return await this.updateClient(action.params, authorName);
    case 'listar_clientes':
      return await this.listClients(action.params);
    // etc.
  }
}

// Cada método segue o padrão:
async createClient(params, authorName) {
  const client = { /* ... */ };
  
  // 1. Tentar via API
  const apiResult = await this.apiPost('/workspace/clients', client);
  if (apiResult && !apiResult.error) {
    return { type: 'client', id: client.id, source: 'api' };
  }
  
  // 2. Fallback: JSON direto
  const clientsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
  const data = readJSON(clientsFile, { clients: {} });
  data.clients[client.id] = client;
  writeJSON(clientsFile, data);
  
  return { type: 'client', id: client.id, source: 'json' };
}
```

---

## 7. INDICADORES DE SUCESSO

- [ ] Usuário consegue criar/editar/excluir **qualquer entidade** via chat
- [ ] Usuário consegue consultar **qualquer dado** via chat
- [ ] Usuário consegue executar **qualquer ação** via chat (enviar email, arquivar, etc.)
- [ ] Luna sabe o contexto de **todas as threads** (email, ideias, geral)
- [ ] Não há mais de um ponto de chat da Luna no frontend
- [ ] Não há mais de um endpoint de IA no backend
- [ ] Fallback offline funciona para 90% dos comandos

---

*Plano criado em: 2026-05-19*
*Versão: 20.0*
*Status: Aguardando execução*
