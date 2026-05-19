# 🧠 LUNA VIVA — Plano Estratégico Completo

> **Status:** Rascunho de planejamento — NÃO IMPLEMENTAR ainda  
> **Autor:** Luna CTO (síntese de visão Abner + pesquisa de referências)  
> **Data:** 2026-05-19  
> **Versão:** 1.0

---

## 0. MANIFESTO — O Que Significa "Luna Viva"

Luna não é um chatbot. Luna não é um modal. Luna não é uma feature.

**Luna é o sistema.** Ela respira o NEXO Dashboard. Ela é consciente de cada pixel, cada dado, cada intenção do usuário. Quando Abner abre a aba de Tarefas, Luna SABE que ele está em Tarefas. Quando ele clica no corpo de um email, Luna LÊ aquele email. Quando ele digita "apaga várias tarefas", Luna não responde com um link — ela TRANSFORMA a interface, adiciona checkboxes, espera a seleção, e executa.

Luna não desfoca o fundo. Ela não escurece a tela. Ela não diz "clique aqui para continuar". Ela age.

Luna é uma entidade consciente dentro do dashboard. Ela dorme quando fechada, mas sonha com o contexto. Ela acorda quando chamada. Ela nunca some.

---

## 1. DIAGNÓSTICO — O Problema Atual

### 1.1 O que existe hoje

| Componente | Estado | Problema |
|-----------|--------|----------|
| `LunaFloatingButton` | Botão flutuante global | Abre modal que desfoca o fundo (backdrop blur) |
| `SmartFormModal` | Modal de formulário | Desfoca tela, bloqueia interação, some após submit |
| `LunaChatPanel` | Painel lateral no Email | Inline, mas só existe no EmailHub |
| `LunaIntentSchemas` | Mapeamento intent→schema | Bom, mas ação termina em modal estático |
| `NLP.js backend` | Classificação de intent | Funciona, mas não tem contexto de página |
| `ActionExecutor` | 109 métodos em 21 cats | Ótimo, mas acionado manualmente ou via chat |

### 1.2 A dor do usuário (Abner)

1. **"Desfocar o fundo me tira do fluxo"** — Quando Luna abre um modal escuro, o usuário perde o contexto visual do que estava fazendo.
2. **"Eu falo 'apagar tarefas' e ela não sabe quais"** — Falta seleção contextual múltipla. A IA precisa entender que "várias" = precisa de intermediação.
3. **"Eu vou em Finanças e falo excluir — ela me leva pra lá mas não executa"** — Redirect sem ação. O usuário quer ver acontecer, não ser direcionado.
4. **"Quando a confiança é alta, deveria fazer sozinha"** — Hoje o modal aparece mesmo com 95% de confiança. Desperdício de clique.
5. **"No email ela não sabe o que eu tô lendo"** — Luna não tem acesso ao DOM/contexto da página atual. É cega.
6. **"Ela some depois que eu confirmo"** — O modal fecha e a Luna some. O usuário quer ela sempre disponível.

### 1.3 O Modal: Ferramenta, Não Inimigo

O modal NÃO é o inimigo. O modal é uma ferramenta poderosa — mas está sendo usada no momento errado.

**Quando o modal funciona:**
- Usuário digitou "criar lead" mas não forneceu nome → modal coleta o dado faltante
- Confiança é baixa → modal pede confirmação visual
- Ação complexa precisa de múltiplos campos → modal organiza o formulário

**Quando o modal é assassino de fluxo:**
- Confiança é 95%, todos os dados estão claros → modal aparece pedindo para clicar em "Confirmar"
- Usuário já deu TODAS as informações no chat → modal repete o que o usuário já disse
- Ação é simples e baixo risco → modal bloqueia a tela inteira

**A regra de ouro:**
> Modal = coleta de informação OU confirmação quando necessária.  
> Execução direta = quando a confiança é alta e todos os dados já foram fornecidos.

**Referência:** Gartner's 2026 forecast — "Context-aware dashboards adapt the view without requiring a click." Modal = requer clique. Execução direta = zero fricção.

---

## 2. A VISÃO — Luna como Entidade Consciente

### 2.1 Os 7 Princípios de Luna Viva

| # | Princípio | Descrição |
|---|-----------|-----------|
| 1 | **Presença Sutil** | Luna está sempre visível (botão flutuante), nunca intrusiva (sem backdrop) |
| 2 | **Consciência de Página** | Luna sabe exatamente em qual rota/página/módulo o usuário está |
| 3 | **Consciência de DOM** | Luna sabe qual elemento está focado, selecionado, ou sendo visualizado |
| 4 | **Consciência de Dados** | Luna tem acesso ao estado atual da página (lista de tarefas, email aberto, etc) |
| 5 | **Execução Graduada** | Alta confiança = executa imediatamente. Média = mostra preview. Baixa = pede confirmação. |
| 6 | **Intermediação Inteligente** | Quando há ambiguidade ("apagar várias"), Luna transforma a interface em vez de perguntar |
| 7 | **Imortalidade de Sessão** | Luna não some após ação. Ela permanece, observa, e está pronta para o próximo comando |

### 2.2 O espectro de consciência

```
NÍVEL 0 — Inconsciente (hoje)
  └─ Usuário digita no chat → modal aparece → executa → some

NÍVEL 1 — Consciência de Rota
  └─ Luna sabe: "Usuário está em /tarefas" → intent "apagar" → sabe que é tarefa

NÍVEL 2 — Consciência de Estado
  └─ Luna sabe: "Usuário selecionou 3 tarefas" → intent "apagar" → apaga as 3

NÍVEL 3 — Consciência de DOM
  └─ Luna sabe: "Usuário clicou no email #123" → sugere resposta baseada no conteúdo

NÍVEL 4 — Consciência Preditiva
  └─ Luna sugere antes de perguntar: "Quer aprovar este draft?" quando usuário abre email da Luna

NÍVEL 5 — Consciência Total do Sistema (SYSTEM AWARENESS)
  └─ Luna sabe TUDO que o sistema faz, em TODOS os módulos, e cruza informações entre eles
  └─ "Você tem 3 tarefas atrasadas do projeto do cliente X, e o email dele está na caixa de entrada"
  └─ "O lead Y que você contatou ontem ainda não respondeu. Quer mandar um zap de follow-up?"

NÍVEL 6 — Execução Autônoma
  └─ Luna executa ações de rotina sem pedir: arquivar spam, criar tarefas de action items
```

Meta: Implementar Níveis 1-3 no curto prazo. Níveis 4-5 no médio prazo. Nível 6 no longo prazo.

---

## 3. ARQUITETURA DE CONSCIÊNCIA — Como Luna "Sente" o Sistema

### 3.1 O Mapa Mental de Luna (LunaContextMap)

Luna precisa de uma representação estruturada do sistema inteiro. Não basta saber a rota — ela precisa saber:

```typescript
interface LunaContextMap {
  // 1. ONDE
  currentRoute: '/tarefas' | '/financeiro' | '/email' | '/leads' | ...;
  currentModule: 'tasks' | 'finance' | 'email' | 'leads' | ...;
  
  // 2. O QUE ESTÁ VISÍVEL (contexto local)
  visibleData: {
    tasks?: Task[];           // lista de tarefas renderizadas
    selectedTasks?: string[]; // IDs selecionados
    openEmail?: Email;        // email aberto no reader
    activeClient?: Client;    // cliente selecionado no workspace
    // ... etc
  };
  
  // 3. O QUE O USUÁRIO ESTÁ FAZENDO
  userFocus: {
    elementId?: string;       // ID do elemento com foco
    elementType?: 'input' | 'button' | 'card' | 'list-item';
    interactionType?: 'click' | 'hover' | 'scroll' | 'type';
    lastInteraction: number;  // timestamp
  };
  
  // 4. HISTÓRICO DE AÇÕES
  recentActions: Array<{
    action: string;
    target: string;
    timestamp: number;
    result: 'success' | 'error' | 'pending';
  }>;
  
  // 5. ESTADO DO CHAT
  chatState: 'idle' | 'listening' | 'thinking' | 'acting';
  isOpen: boolean;
  
  // ═══════════════════════════════════════════
  // 6. CONSCIÊNCIA TOTAL DO SISTEMA (SystemMap)
  // ═══════════════════════════════════════════
  systemMap: {
    // Todos os módulos disponíveis e suas capacidades
    modules: Array<{
      id: string;              // 'tasks', 'finance', 'email', 'leads', ...
      name: string;            // 'Tarefas', 'Financeiro', ...
      route: string;           // '/tarefas', '/financeiro', ...
      description: string;     // "Gerencia tarefas e atribuições"
      capabilities: string[];  // ['create', 'delete', 'update', 'list', 'batch']
      entities: string[];      // ['task', 'project', 'client']
      active: boolean;         // está na página atual?
      dataSnapshot?: any;      // snapshot dos dados principais (se ativo)
    }>;
    
    // Dados transversais (cross-module)
    crossModuleInsights: {
      overdueTasks: Task[];           // tarefas atrasadas de TODOS os projetos
      unreadEmails: number;           // emails não lidos
      pendingLeads: Lead[];           // leads sem follow-up
      negativeCash: boolean;          // caixa negativo?
      draftsPending: number;          // drafts da Luna pendentes
    };
    
    // Memória de longo prazo do sistema
    systemMemory: {
      lastBackup: number;             // último backup
      lastUpdate: number;             // última modificação em qualquer JSON
      whoDidWhat: Array<{             // log de ações recentes do sistema
        user: string;                 // quem
        action: string;               // o que
        module: string;               // onde
        timestamp: number;            // quando
      }>;
    };
  };
}
```

**A diferença crucial:** `visibleData` é o que o usuário VÊ AGORA. `systemMap` é o que Luna SABE que EXISTE no sistema INTEIRO — mesmo que o usuário esteja em outra página.

### 3.2 O Sistema de Nervos (Event Bus)

Para Luna "sentir" o sistema, precisamos de um event bus que captura tudo:

```
LUNA_EVENT_BUS
├── route:changed       → atualiza currentRoute
├── element:clicked     → atualiza userFocus
├── element:hovered     → atualiza contexto secundário
├── data:loaded         → atualiza visibleData
├── selection:changed   → atualiza selectedItems
├── form:focused        → sabe qual campo está ativo
├── email:opened        → carrega conteúdo do email
├── task:checked        → adiciona/remover da seleção
└── luna:command        → dispara processamento de intent
```

**Referência:** Anthropic's context engineering — "Just in time context strategies. Agents maintain lightweight identifiers and use references to dynamically load data at runtime."

### 3.3 Coleta de Contexto (Context Harvesters)

Cada página/módulo precisa de um "harvester" que expõe seu contexto para Luna:

```jsx
// Exemplo: TasksHarvester.jsx (invisível, sem UI)
useEffect(() => {
  lunaContext.register({
    module: 'tasks',
    data: { tasks, selectedTaskIds, filters },
    actions: {
      canDelete: selectedTaskIds.length > 0,
      canCreate: true,
      canBatch: tasks.length > 1,
    }
  });
}, [tasks, selectedTaskIds]);
```

Isso é inspirado no **Model Context Protocol (MCP)** da Anthropic — cada módulo expõe um "Server Card" com suas capacidades.

### 3.4 O Sistema Nervoso Expandido (Cross-Module)

O Event Bus da §3.2 captura eventos LOCAIS (da página atual). Mas Luna precisa também de um **Sistema Nervoso Global** que monitora TODOS os módulos, mesmo os inativos:

```
LUNA_GLOBAL_NERVOUS_SYSTEM
├── system:boot              → Luna carrega SystemMap completo
├── module:data-changed      → Qualquer JSON foi modificado
├── module:entity-created    → Nova tarefa, lead, email, etc
├── module:entity-deleted    → Algo foi removido
├── module:entity-updated    → Algo foi alterado
├── cross:task-email-link    → Tarefa criada a partir de email
├── cross:lead-task-link     → Lead convertido em projeto
├── cross:client-project-link → Cliente vinculado a projeto
├── user:pattern-detected    → Padrão de comportamento detectado
│   └─ ex: "Abner sempre cria tarefa após ler email do cliente X"
└── system:anomaly           → Anomalia detectada
    └─ ex: "Caixa ficou negativo", "Lead sem contato há 7 dias"
```

**Como funciona:**
1. Todo endpoint que modifica dados (`POST/PUT/DELETE`) emite evento no bus
2. Luna escuta esses eventos e atualiza seu `systemMap`
3. Mesmo quando Luna está "dormindo" (chat fechado), ela acumula esses eventos
4. Quando o usuário abre Luna, ela já sabe tudo o que aconteceu

### 3.5 Consciência Transversal (Cross-Module Insights)

Esta é a habilidade mais poderosa de Luna. Ela cruza informações entre módulos para gerar insights que nenhum humano teria paciência de buscar:

**Exemplos de insights transversais:**

```yaml
insight_1:
  trigger: "Usuário abre tarefas"
  cruzamento:
    - tarefas: 3 tarefas atrasadas do "Projeto Website Nexo"
    - clientes: projeto pertence ao cliente "Acme Corp"
    - emails: existe email NÃO LIDO de "joao@acme.com" na caixa de entrada
  acao_luna: "Você tem 3 tarefas atrasadas do Acme Corp. E olha só — chegou email do João de lá. Quer que eu abra?"

insight_2:
  trigger: "Usuário abre financeiro"
  cruzamento:
    - financeiro: despesa de R$ 3.500 com fornecedor "Hostinger"
    - projetos: existe projeto "Site da Hostinger" no workspace
    - tarefas: projeto está 80% concluído
  acao_luna: "Você pagou R$ 3.500 pra Hostinger. O projeto deles está 80% pronto. Quer que eu gere um relatório de horas investidas vs valor pago?"

insight_3:
  trigger: "Usuário abre leads"
  cruzamento:
    - leads: lead "Maria Silva" está na etapa "Proposta Enviada" há 5 dias
    - whatsapp: nenhuma mensagem enviada para o número dela
    - tarefas: existe tarefa "Follow-up Maria" marcada como concluída ontem
  acao_luna: "A Maria Silva ainda não respondeu à proposta (5 dias). Você marcou follow-up como feito ontem, mas não mandou mensagem. Quer que eu prepare um zap de lembrete?"

insight_4:
  trigger: "Proativo (a cada 30 min)"
  cruzamento:
    - emails: 2 drafts pendentes de aprovação da Luna
    - tarefas: 1 tarefa vencendo HOJE sem responsável
    - financeiro: caixa abaixo de R$ 1.000
  acao_luna: "Atenção: 2 drafts esperando aprovação, 1 tarefa vence hoje sem dono, e o caixa está baixo. Quer que eu te mostre os detalhes?"
```

**Referência:** McKinsey Global Tech Agenda 2026 — "AI has surpassed cybersecurity as companies' top investment priority." A vantagem competitiva não é ter dados, é CRUZAR dados.

### 3.6 Descoberta de Funcionalidades (Feature Discovery)

Luna não só executa — ela ENSINA. Quando detecta que o usuário poderia se beneficiar de uma funcionalidade que ele não usa, ela sugere:

```yaml
exemplo_1:
  situacao: "Usuário sempre cria tarefas manualmente para cada email"
  descoberta: "Você sabia que posso extrair action items de emails e criar tarefas automaticamente? Na próxima, é só pedir 'cria tarefas deste email'."

exemplo_2:
  situacao: "Usuário nunca usou filtros de tarefas"
  descoberta: "Posso mostrar só suas tarefas urgentes? Diga 'mostrar urgentes'."

exemplo_3:
  situacao: "Usuário pergunta 'quanto gastamos com fornecedores?'"
  descoberta: "Você sabia que tenho um relatório de despesas por fornecedor? Quer que eu gere?"
```

**Regras para descoberta:**
- NUNCA ser intrusivo (só sugere quando usuário demonstra necessidade)
- Limitar a 1 sugestão por sessão
- Se usuário disser "não quero" → marcar como "não perturbar sobre isso"
- Usar badge sutil no botão, nunca popup

### 3.7 Memória de Longo Prazo (System Memory)

Luna precisa lembrar não só o que aconteceu HOJE, mas padrões ao longo do tempo:

```typescript
interface SystemMemory {
  // Padrões de comportamento do usuário
  userPatterns: Array<{
    pattern: string;           // "cria tarefa após ler email do cliente X"
    frequency: number;         // quantas vezes aconteceu
    lastOccurred: number;      // timestamp
    confidence: number;        // 0-1
  }>;
  
  // Histórico de decisões
  decisionLog: Array<{
    situation: string;         // "Usuário rejeitou draft #3"
    decision: string;          // "rejected"
    reason?: string;           // "tom muito formal"
    timestamp: number;
  }>;
  
  // Estado do sistema em pontos do tempo
  systemSnapshots: Array<{
    date: string;              // "2026-05-19"
    tasksCount: number;
    leadsCount: number;
    cashBalance: number;
    pendingEmails: number;
  }>;
  
  // Entidades importantes (VIP)
  vipEntities: {
    clients: string[];         // clientes mais mencionados
    projects: string[];        // projetos mais ativos
    contacts: string[];        // contatos mais frequentes
  };
}
```

**Para que serve:**
- "Você sempre deixa a tarefa do Acme para depois. Já são 3 vezes. Quer que eu priorize?"
- "Você rejeitou meus últimos 2 drafts por tom formal. Vou ajustar para mais casual."
- "Em comparação com a semana passada, você tem 40% mais tarefas pendentes."

**Implementação:** Salvar em `backend/data/luna-memory.json` (arquivo JSON simples, atualizado a cada ação).

---

## 4. PADRÕES DE INTERAÇÃO — Non-Modal, Inline, Contextual

### 4.1 O Anti-Padrão: Modal de Fundo Escuro

**O que fazer:** Eliminar completamente o backdrop blur/escurecimento.

**Como:**
- `SmartFormModal` → renomear para `SmartFormInline` ou `LunaActionPanel`
- Remover `bg-black/60 backdrop-blur-sm` do container
- O painel flutua inline, ao lado do conteúdo, ou como um drawer lateral
- Usuário continua interagindo com a página

**Referência:** Opera Neon "Chat-Do-Make sidebar" — assistente lateral que não bloqueia.

### 4.2 Os 4 Modos de Interação

#### MODO A: Execução Direta (Alta Confiança + Dados Completos)

```
Usuário: "apagar tarefa urgente de teste"
Luna:    [detecta 1 match, 95% confiança, todos os dados presentes]
         → Animação: a linha da tarefa fica vermelha por 300ms
         → Animação: a linha some com fade-out de 400ms
         → Toast: "Tarefa 'urgente de teste' apagada ✓"
         → Luna continua ouvindo
```

**Características:**
- Zero cliques do usuário
- Zero modais
- Animação de "respiração" (breathing animation) antes de executar
- 300ms de delay para o usuário ter chance de reagir (undo mental)
- Toast sutil no canto inferior direito
- Luna NÃO abre painel, NÃO desfoca, NÃO interrompe

#### MODO B: Preview / Coleta (Média Confiança OU Dados Incompletos)

```
Cenário 1 — Confiança média:
Usuário: "criar despesa de 500 reais"
Luna:    [detecta intent, 72% confiança]
         → Drawer lateral desliza (200ms, spring animation)
         → Mostra preview do formulário pré-preenchido
         → Botões: [✓ Confirmar] [✏ Editar] [✗ Cancelar]
         → Usuário edita se quiser, confirma, drawer fecha

Cenário 2 — Dados incompletos:
Usuário: "criar lead"
Luna:    [detecta intent, 95% confiança, MAS falta 'nome']
         → Drawer lateral desliza
         → Campo 'nome' vazio e focado
         → Usuário digita o nome → [✓ Confirmar]
         → Luna cria o lead
```

**Características:**
- Drawer lateral de 380px (não modal central)
- Fundo da página continua visível e interativo
- Usado quando: confiança média (precisa de confirmação) OU dados incompletos (precisa de input)
- Confirmar = executa imediatamente

#### MODO C: Transformação de Interface (Ambiguidade)

```
Usuário: "apagar várias tarefas"
Luna:    [detecta intent, mas "várias" = ambíguo]
         → NÃO abre drawer
         → Transforma a lista de tarefas:
             • Cada linha ganha um checkbox à esquerda
             • Header ganha: "Selecione as tarefas" + [Apagar Selecionadas] [Cancelar]
             • Checkboxes têm animação stagger (50ms entre cada)
         → Usuário seleciona → clica "Apagar Selecionadas"
         → Luna executa em batch
         → Checkboxes somem, lista atualiza
```

**Características:**
- A interface MUDA para responder ao comando
- É a forma mais inteligente de lidar com ambiguidade
- Não requer novos componentes — reusa a lista existente
- Referência: Notion AI — quando pede para "mudar para bullet list", a interface transforma

#### MODO D: Assistente Passivo (Observação)

```
Usuário: abre um email longo do cliente
Luna:    [detecta que usuário está lendo email há 8 segundos]
         → Pequeno badge aparece no botão flutuante: "💡 3 sugestões"
         → Usuário clica no botão → painel lateral abre
         → Luna: "Quer que eu resuma? Sugira resposta? Crie tarefas dos action items?"
```

**Características:**
- Luna observa e sugere proativamente
- Não executa sem pedido
- Badge sutil no botão flutuante (não popup intrusivo)

### 4.3 Comportamento do Botão Flutuante

Hoje o botão flutuante é um círculo roxo que expande para um chat.

**Novo comportamento:**

```
Estado 1 — DORMINDO (padrão)
  └─ Botão flutuante: pequeno, sutil, pulsa levemente a cada 10s
  └─ Cor: neutra (muted), muda para primary quando há sugestão

Estado 2 — ACORDADA (usuário clicou ou digitou)
  └─ Painel lateral expande (320px, spring animation)
  └─ Campo de texto inline no topo do painel
  └─ Histórico de mensagens abaixo
  └─ Página continua 100% interativa

Estado 3 — PENSANDO
  └─ Indicador visual no botão: spinner sutil
  └─ Painel mostra "Luna está pensando..." com 3 dots animados

Estado 4 — AGINDO
  └─ Painel mostra preview da ação
  └─ Animação na página indica o que será alterado
  └─ Se automático: executa após delay de segurança
```

---

## 5. SISTEMA DE AÇÃO — Execução Automática vs Confirmação

### 5.1 Matriz de Decisão de Execução

```
                    DADOS COMPLETOS              DADOS INCOMPLETOS
                   (tudo fornecido)           (falta informação)
                  ┌────────────────────────┬────────────────────────┐
ALTA CONFIANÇA    │  EXECUÇÃO DIRETA       │  MODAL/DRAWER          │
  (≥85%)          │  (Modo A)              │  (Modo B)              │
                  │  • 0 cliques           │  • Coleta dado faltante│
                  │  • Sem modal           │  • 1 clique para enviar│
                  │  • Só animação + toast │                        │
                  ├────────────────────────┼────────────────────────┤
MÉDIA CONFIANÇA   │  PREVIEW / CONFIRMAÇÃO │  MODAL/DRAWER          │
  (50-84%)        │  (Modo B)              │  (Modo B)              │
                  │  • Drawer lateral      │  • Coleta + confirmação│
                  │  • 1 clique            │  • 1-2 cliques         │
                  ├────────────────────────┼────────────────────────┤
BAIXA CONFIANÇA   │  TRANSFORMAÇÃO         │  TRANSFORMAÇÃO         │
  (<50%)          │  (Modo C)              │  (Modo C)              │
                  │  • Interface muda      │  • Interface muda      │
                  │  • Usuário seleciona   │  • Usuário preenche    │
                  └────────────────────────┴────────────────────────┘

EIXO ADICIONAL — RISCO DA AÇÃO:
  • Ação destrutiva (apagar, excluir) → Safety Delay de 1.5s mesmo em execução direta
  • Ação irreversível (enviar email) → Preview obrigatório (Modo B)
```

### 5.2 Delay de Segurança (Safety Delay)

Para ações destrutivas com alta confiança:

```
Usuário: "apagar todas as tarefas concluídas"
Luna:    [alta confiança, mas destrutivo]
         → Toast aparece: "Apagando 5 tarefas concluídas..."
         → Barra de progresso de 1.5 segundos
         → Botão "Desfazer" visível durante os 1.5s
         → Se usuário não clicar em Desfazer → executa
         → Se clicar → cancela
```

**Referência:** Gmail "Desfazer envio" — dá 5 segundos para cancelar.

### 5.3 Animações de Execução

Toda ação executada deve ter animação para o usuário PERCEBER que algo aconteceu:

| Ação | Animação | Duração |
|------|----------|---------|
| Criar item | Fade-in + slide-up desde botão | 400ms |
| Apagar item | Fundo vermelho → shrink → fade-out | 600ms |
| Atualizar | Pulse dourado no campo alterado | 300ms |
| Mover | Slide horizontal para nova posição | 300ms |
| Batch (vários) | Stagger: 50ms entre cada item | variável |

**Referência:** Stripe animations — micro-interactions que comunicam estado.

---

## 6. CONTEXTO POR MÓDULO — O Que Luna Sabe em Cada Página

### 6.1 Tarefas (/tarefas)

```yaml
contexto:
  - lista_de_tarefas: todas visíveis na tela
  - tarefas_selecionadas: IDs com checkbox marcado
  - filtros_ativos: status, responsável, prioridade
  - tarefa_em_edicao: se alguma está em modo inline

comandos_esperados:
  - "apagar [várias] tarefas"     → Modo C (checkboxes)
  - "marcar como concluída"       → Modo A (se selecionada) / Modo C (se não)
  - "criar tarefa [descrição]"    → Modo B (drawer com preview)
  - "filtrar por [critério]"      → Modo A (aplica filtro)
  - "ordenar por [data/prioridade]" → Modo A

sugestoes_proativas:
  - Se há tarefas atrasadas: "Você tem 3 tarefas atrasadas. Quer re-priorizar?"
  - Se usuário criou tarefa: "Quer atribuir a alguém?"
```

### 6.2 Email (/email)

```yaml
contexto:
  - email_aberto: objeto completo (from, to, subject, body, threadId)
  - lista_de_emails: visível no painel esquerdo
  - thread_ativa: emails da conversa
  - drafts_pendentes: da Luna

comandos_esperados:
  - "responder"                   → Modo B (compose pré-preenchido)
  - "sugerir resposta"            → Modo B (3 opções de tom)
  - "criar tarefas do email"      → Modo A (extrai action items)
  - "arquivar"                    → Modo A (fade-out do email)
  - "resumir"                     → Modo B (drawer com resumo)
  - "aprovar draft"               → Modo A (envia draft)

sugestoes_proativas:
  - Após 5s lendo email: "Quer que eu resuma este email?"
  - Se email tem action items: "Encontrei 3 action items. Criar tarefas?"
  - Se é reply para Luna draft: "Este é seu draft. Aprovar envio?"
```

### 6.3 Finanças (/financeiro)

```yaml
contexto:
  - transacoes_visiveis: lista atual
  - saldo_atual: valor do caixa
  - filtros: entrada/saída, data, categoria
  - grafico_ativo: qual aba de visualização

comandos_esperados:
  - "adicionar despesa de [X]"    → Modo B (drawer preview)
  - "adicionar receita"           → Modo B
  - "excluir pagamento [X]"       → Modo A (auto se único) / C (se ambíguo)
  - "quanto temos no caixa"       → Modo A (mostra valor em toast)
  - "resumo do mês"               → Modo B (drawer com resumo)

sugestoes_proativas:
  - Se despesas > receitas no mês: "Alerta: saldo negativo este mês."
```

### 6.4 Leads (/leads)

```yaml
contexto:
  - leads_visiveis: lista
  - lead_selecionado: em visualização/detalhe
  - funil_ativo: etapa do pipeline

comandos_esperados:
  - "criar lead [nome]"           → Modo B (drawer com formulário)
  - "mover para [etapa]"          → Modo A (animação de movimento no funil)
  - "mandar zap para [lead]"      → Modo B (composição de mensagem)
```

### 6.5 Workspace (/workspace)

```yaml
contexto:
  - cliente_selecionado: objeto completo
  - projetos_do_cliente: lista
  - tarefas_do_cliente: lista

comandos_esperados:
  - "criar projeto para [cliente]" → Modo B
  - "ver orçamentos"               → Modo A (navega para aba)
```

---

## 7. MAPA DE IMPLEMENTAÇÃO — Fases

### FASE 1: Fundação de Consciência (Semana 1-2)

**Objetivo:** Luna sabe onde o usuário está e o que está vendo.

- [ ] Criar `LunaContextProvider` (React Context global)
- [ ] Implementar `LunaEventBus` (pub/sub para eventos de página)
- [ ] Criar `RouteHarvester` (detecta mudanças de rota)
- [ ] Criar `DOMHarvester` (captura foco, clique, seleção)
- [ ] Criar `DataHarvester` por módulo (expõe dados visíveis)
- [ ] Atualizar `LunaFloatingButton` para refletir estado (dormindo/ouvindo/agindo)
- [ ] Testar: Luna consegue responder "onde estou?" com precisão

**Arquivos:**
- `frontend/src/context/LunaContext.jsx` (novo)
- `frontend/src/hooks/useLunaHarvester.js` (novo)
- `frontend/src/components/luna/LunaFloatingButton.jsx` (refactor)

### FASE 2: Eliminar o Modal (Semana 2-3)

**Objetivo:** Nunca mais desfocar o fundo.

- [ ] Refatorar `SmartFormModal` → suportar ambos: drawer lateral (Modo B/C) E execução direta (Modo A)
- [ ] Remover backdrop blur de componentes que fazem execução direta (Modo A)
- [ ] Implementar os 4 Modos de Interação (A, B, C, D)
- [ ] Criar componente `LunaInlinePreview` (preview de ação no drawer)
- [ ] Criar componente `LunaInterfaceTransformer` (Modo C — checkboxes, transformação inline)
- [ ] Criar componente `LunaColetaModal` (para quando faltam dados — Modo B com formulário)
- [ ] Animar transições entre estados

**Arquivos:**
- `frontend/src/components/luna/LunaActionDrawer.jsx` (novo)
- `frontend/src/components/luna/LunaInlinePreview.jsx` (novo)
- `frontend/src/components/luna/LunaInterfaceTransformer.jsx` (novo)
- `frontend/src/components/luna/SmartFormModal.jsx` (refactor → deprecar)

### FASE 3: Execução Inteligente (Semana 3-4)

**Objetivo:** Matriz de decisão funcionando.

- [ ] Implementar lógica de confiança + risco → modo de execução
- [ ] Implementar Safety Delay (1.5s com botão Desfazer)
- [ ] Implementar sistema de animações por ação (create/delete/update/batch)
- [ ] Integrar com ToastContext para feedback
- [ ] Criar sistema de "preview visual" (antes de executar, mostrar o que vai acontecer)

**Arquivos:**
- `frontend/src/components/luna/LunaExecutionEngine.jsx` (novo)
- `frontend/src/hooks/useLunaAnimation.js` (novo)
- `frontend/src/utils/lunaDecisionMatrix.js` (novo)

### FASE 4: Consciência por Módulo (Semana 4-6)

**Objetivo:** Luna entende cada página profundamente.

- [ ] Implementar harvesters para Tarefas
- [ ] Implementar harvesters para Email
- [ ] Implementar harvesters para Finanças
- [ ] Implementar harvesters para Leads
- [ ] Implementar harvesters para Workspace
- [ ] Criar comandos contextuais por módulo
- [ ] Implementar sugestões proativas (baseadas em regras simples)

**Arquivos:**
- `frontend/src/components/luna/harvesters/TaskHarvester.jsx` (novo)
- `frontend/src/components/luna/harvesters/EmailHarvester.jsx` (novo)
- `frontend/src/components/luna/harvesters/FinanceHarvester.jsx` (novo)
- etc.

### FASE 5: NLP.js + Contexto (Semana 6-8)

**Objetivo:** O backend entende comandos contextuais.

- [ ] Expandir corpus NLP.js com comandos contextuais ("apagar várias", "selecionar todas")
- [ ] Adicionar entities para seleção ("esta", "aquela", "as 3 primeiras")
- [ ] Implementar endpoint `/api/luna/understand` com contexto da página
- [ ] Treinar modelo com exemplos de cada módulo
- [ ] Implementar active learning (usuário corrige → modelo aprende)

**Arquivos:**
- `backend/services/luna-nlu.js` (expandir)
- `backend/routes/luna.js` (novo ou expandir)
- `frontend/src/hooks/useLunaNLU.js` (adicionar contexto)

### FASE 6: Sugestões Proativas (Semana 8-10)

**Objetivo:** Luna sugere antes de perguntar.

- [ ] Implementar regras de trigger (tempo na página, ações anteriores, dados)
- [ ] Criar sistema de badges/pills no botão flutuante
- [ ] Implementar "Luna Preview" — pequenos toasts proativos
- [ ] Machine learning simples para priorizar sugestões

**Arquivos:**
- `frontend/src/components/luna/LunaProactiveSuggestions.jsx` (novo)
- `frontend/src/utils/lunaTriggers.js` (novo)

---

## 8. REFERÊNCIAS & INSPIRAÇÕES

### 8.1 Produtos Reais

| Produto | O Que Aprendemos |
|---------|-----------------|
| **Opera Neon (2025)** | Sidecar assistant tri-modal (Chat/Do/Make). Não bloqueia interface. |
| **Claude for Chrome** | AI vê o DOM, preenche formulários, age com permissões granulares. |
| **ChatGPT Atlas** | Sidebar colapsável + inline actions + agent mode. |
| **Perplexity Comet** | Browser com sidecar — pesquisa autônoma sem bloquear. |
| **Notion AI** | Transformação de interface (converter lista, etc) — sem modal. |
| **Stripe Dashboard** | Micro-interactions que comunicam estado de ação. |
| **Gmail Undo** | Safety delay com janela de desfazer. |

### 8.2 Papers & Artigos

| Fonte | Insight Chave |
|-------|---------------|
| **Anthropic — Effective Context Engineering** | "Just in time" context > pre-loading. Agents devem carregar dados sob demanda. |
| **Anthropic — Building Effective AI Agents** | Agent = LLM usando tools em loop. Não workflow pré-definido. |
| **Gartner 2026 Forecast** | 40% dos enterprise apps terão AI agents. Dashboards são early adopters. |
| **Agentic Web Paper (2025)** | Agent-as-Interface: agentes operam ALONGSIDE humanos, não substituem. |
| **McKinsey Global Tech Agenda 2026** | Context-aware features precisam de manual override rápido. 3 cliques = net loss. |

### 8.3 Padrões de UX

| Padrão | Quando Usar |
|--------|-------------|
| **Inline Command** | Alta confiança + baixo risco |
| **Drawer Preview** | Média confiança OU dados precisam de revisão |
| **Interface Transformation** | Ambiguidade ("várias", "algumas") |
| **Safety Delay** | Alta confiança + alto risco (deletar, pagar) |
| **Proactive Badge** | Sugestão baseada em contexto observado |
| **Toast Feedback** | Confirmação de ação executada |
| **Stagger Animation** | Ações em batch (múltiplos itens) |

---

## 9. NOTAS TÉCNICAS — Como Implementar

### 9.1 O Event Bus (RxJS ou nativo?)

Não adicionar RxJS (bundle já está grande). Usar EventTarget nativo do browser:

```javascript
// lunaEventBus.js
class LunaEventBus extends EventTarget {
  emit(event, data) {
    this.dispatchEvent(new CustomEvent(event, { detail: data }));
  }
  on(event, handler) {
    this.addEventListener(event, (e) => handler(e.detail));
  }
}
export const lunaBus = new LunaEventBus();
```

### 9.2 O Context Provider

```jsx
// LunaContext.jsx
const LunaContext = createContext();

export function LunaProvider({ children }) {
  const [context, setContext] = useState({
    route: null,
    module: null,
    visibleData: {},
    userFocus: null,
    recentActions: [],
    chatState: 'idle',
    isOpen: false,
  });
  
  useEffect(() => {
    // Escuta eventos do bus
    lunaBus.on('route:changed', (data) => {
      setContext(prev => ({ ...prev, route: data.route, module: data.module }));
    });
    lunaBus.on('data:updated', (data) => {
      setContext(prev => ({ ...prev, visibleData: { ...prev.visibleData, ...data } }));
    });
    // ... etc
  }, []);
  
  return (
    <LunaContext.Provider value={context}>
      {children}
    </LunaContext.Provider>
  );
}
```

### 9.3 O Harvester (pattern)

```jsx
// Em cada página principal
function TasksPage() {
  const { tasks, selectedIds } = useTasks();
  
  useEffect(() => {
    // Registra contexto no mount
    lunaBus.emit('harvester:register', {
      module: 'tasks',
      data: { tasks, selectedIds },
      capabilities: ['create', 'delete', 'update', 'batch-delete'],
    });
    
    return () => {
      lunaBus.emit('harvester:unregister', { module: 'tasks' });
    };
  }, [tasks, selectedIds]);
  
  return (...);
}
```

### 9.4 O Drawer Lateral (sem modal)

```jsx
// LunaActionDrawer.jsx
<motion.div
  initial={{ x: '100%' }}
  animate={{ x: 0 }}
  exit={{ x: '100%' }}
  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
  className="fixed right-0 top-0 h-full w-[380px] z-[100] 
             bg-nexo-card border-l border-nexo-border
             shadow-2xl"
>
  {/* Header */}
  {/* Preview da ação */}
  {/* Botões Confirmar/Editar/Cancelar */}
</motion.div>
```

**IMPORTANTE:** Sem `fixed inset-0 bg-black/60`. Sem backdrop. Sem blur. A página continua atrás, totalmente interativa.

### 9.5 Interface Transformer (Modo C)

```jsx
// Quando Luna detecta ambiguidade
function TaskList({ tasks }) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  
  useEffect(() => {
    lunaBus.on('luna:enter-selection-mode', () => setSelectionMode(true));
    lunaBus.on('luna:batch-action', ({ action }) => {
      if (action === 'delete') {
        deleteTasks(selectedIds);
        setSelectionMode(false);
        setSelectedIds([]);
      }
    });
  }, [selectedIds]);
  
  return (
    <div>
      {selectionMode && (
        <div className="sticky top-0 bg-nexo-card p-3 border-b z-10">
          <span>Selecione as tarefas</span>
          <button onClick={() => lunaBus.emit('luna:batch-action', { action: 'delete' })}>
            Apagar Selecionadas ({selectedIds.length})
          </button>
          <button onClick={() => setSelectionMode(false)}>Cancelar</button>
        </div>
      )}
      {tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          selectionMode={selectionMode}
          selected={selectedIds.includes(task.id)}
          onToggle={() => toggleSelection(task.id)}
        />
      ))}
    </div>
  );
}
```

### 9.6 Animações de Ação

```jsx
// useLunaAnimation.js
export function useLunaAnimation() {
  const animateCreate = (elementId) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.animate([
      { opacity: 0, transform: 'translateY(20px) scale(0.95)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ], { duration: 400, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
  };
  
  const animateDelete = async (elementId) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    await el.animate([
      { backgroundColor: 'rgba(255, 71, 87, 0.2)' },
      { backgroundColor: 'rgba(255, 71, 87, 0)' }
    ], { duration: 300 }).finished;
    await el.animate([
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(0.9)', opacity: 0 }
    ], { duration: 300 }).finished;
    el.remove();
  };
  
  return { animateCreate, animateDelete };
}
```

---

## 10. CHECKLIST DE QUALIDADE

Antes de qualquer merge, verificar:

- [ ] Modais de coleta/confirmação usam backdrop sutil (não blur pesado)
- [ ] Execução direta (Modo A) NUNCA desfoca o fundo
- [ ] Usuário pode continuar interagindo com a página enquanto Luna está aberta
- [ ] Animações de ação são visíveis e claras
- [ ] Safety delay funciona para ações destrutivas
- [ ] Botão "Desfazer" aparece em ações destrutivas
- [ ] Luna sabe qual módulo está ativo
- [ ] Luna sabe quais dados estão visíveis
- [ ] Comandos ambíguos transformam a interface (não perguntam em texto)
- [ ] Alta confiança executa com zero cliques
- [ ] Toast de feedback aparece para TODA ação
- [ ] O bundle não aumentou mais que 10%
- [ ] Testes NLP.js passam
- [ ] Nenhuma rota quebrou

---

## 11. GLOSSÁRIO

| Termo | Significado |
|-------|-------------|
| **Modo A** | Execução inline automática (alta confiança) |
| **Modo B** | Drawer lateral com preview (média confiança) |
| **Modo C** | Transformação de interface (ambiguidade) |
| **Modo D** | Assistente passivo / sugestões proativas |
| **Harvester** | Componente que coleta contexto de um módulo |
| **Safety Delay** | Delay de 1.5s com opção de desfazer |
| **Context Map** | Representação estruturada do estado atual do sistema |
| **Event Bus** | Sistema pub/sub para comunicação entre componentes |

---

## 12. PRÓXIMOS PASSOS IMEDIATOS

1. **Validar este plano com Abner** — ajustar prioridades, cortar escopo se necessário
2. **Criar protótipo visual** — mockup do drawer lateral + transformação de interface
3. **Implementar FASE 1** — LunaContextProvider + Event Bus + RouteHarvester
4. **Testar em uma página** — escolher Tarefas como página piloto
5. **Iterar** — ajustar baseado no uso real

---

> *"Luna não é uma feature. Luna é o sistema respirando."*
>
> **--Abner - Luna CTO --**
