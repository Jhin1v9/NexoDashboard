/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LUNA INTENT SCHEMAS — Mapeamento de intents para formulários inteligentes
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Cada intent é mapeado para:
 * - title: Título do modal
 * - description: Texto explicativo
 * - fields: Schema dos campos do formulário
 * - submitConfig: Qual endpoint chamar e como montar o payload
 * - extractEntities: Função que extrai valores das entities do NLU
 */

// ── Helpers ──

const todayISO = () => new Date().toISOString().split('T')[0]

const extractEntity = (entities, type) => {
  const found = entities.find(e => e.type === type)
  return found ? found.value : ''
}

// ── Schemas por intent ──

export const INTENT_SCHEMAS = {
  // ══════════════════════════════════════════════════════════════════════════
  // TAREFAS
  // ══════════════════════════════════════════════════════════════════════════
  'tarefa.criar': {
    title: 'Nova Tarefa',
    description: 'Preencha os detalhes da tarefa. Campos detectados automaticamente estão preenchidos.',
    fields: {
      titulo: {
        label: 'Título',
        type: 'text',
        required: true,
        placeholder: 'Nome da tarefa',
      },
      descricao: {
        label: 'Descrição',
        type: 'textarea',
        required: false,
        placeholder: 'Detalhes adicionais...',
      },
      assignedTo: {
        label: 'Responsável',
        type: 'select',
        required: false,
        options: [
          { value: '', label: 'Selecionar...' },
          { value: 'abner', label: 'Abner' },
          { value: 'nonoke', label: 'Nonoke' },
          { value: 'elias', label: 'Elias' },
        ],
      },
      priority: {
        label: 'Prioridade',
        type: 'select',
        required: false,
        options: [
          { value: 'low', label: 'Baixa' },
          { value: 'medium', label: 'Média' },
          { value: 'high', label: 'Alta' },
        ],
      },
      type: {
        label: 'Tipo',
        type: 'select',
        required: false,
        options: [
          { value: 'one_time', label: 'Única' },
          { value: 'daily', label: 'Diária' },
          { value: 'weekly', label: 'Semanal' },
          { value: 'monthly', label: 'Mensal' },
        ],
      },
      dueDate: {
        label: 'Prazo',
        type: 'date',
        required: false,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/tasks',
      transform: (values) => ({
        title: values.titulo,
        description: values.descricao || '',
        assignedTo: values.assignedTo || 'abner',
        priority: values.priority || 'medium',
        taskType: values.type || 'one_time',
        dueDate: values.dueDate || null,
        status: 'pending',
        addedBy: 'luna',
        source: 'luna-nlu',
      }),
    },
    extractEntities: (entities) => {
      const prio = extractEntity(entities, 'prioridade')
      let priority = 'medium'
      if (prio.includes('urgent') || prio.includes('alt')) priority = 'high'
      if (prio.includes('baix')) priority = 'low'
      return {
        priority,
      }
    },
  },

  'tarefa.listar': {
    title: 'Minhas Tarefas',
    description: 'Redirecionando para a lista de tarefas...',
    isRedirect: true,
    redirectTo: '/tarefas',
  },

  'tarefa.concluir': {
    title: 'Concluir Tarefa',
    description: 'Digite o título da tarefa que deseja marcar como concluída.',
    fields: {
      titulo: {
        label: 'Título da tarefa',
        type: 'text',
        required: true,
        placeholder: 'Nome da tarefa a concluir',
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/tasks/complete-by-title',
      transform: (values) => ({ title: values.titulo }),
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // EMAIL
  // ══════════════════════════════════════════════════════════════════════════
  'email.responder': {
    title: 'Responder Email',
    description: 'Escreva sua resposta abaixo.',
    fields: {
      to: {
        label: 'Para',
        type: 'text',
        required: true,
        placeholder: 'email@exemplo.com',
      },
      subject: {
        label: 'Assunto',
        type: 'text',
        required: true,
        placeholder: 'Re: ...',
      },
      body: {
        label: 'Mensagem',
        type: 'textarea',
        required: true,
        placeholder: 'Sua resposta...',
        rows: 6,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/email/drafts',
      transform: (values) => ({
        to: values.to,
        subject: values.subject,
        text: values.body,
      }),
    },
  },

  'email.criar_rascunho': {
    title: 'Novo Rascunho',
    description: 'Escreva um novo email.',
    fields: {
      to: {
        label: 'Para',
        type: 'text',
        required: true,
        placeholder: 'email@exemplo.com',
      },
      subject: {
        label: 'Assunto',
        type: 'text',
        required: true,
        placeholder: 'Assunto do email',
      },
      body: {
        label: 'Mensagem',
        type: 'textarea',
        required: false,
        placeholder: 'Corpo do email...',
        rows: 6,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/email/drafts',
      transform: (values) => ({
        to: values.to,
        subject: values.subject,
        text: values.body,
      }),
    },
  },

  'email.listar_nao_lidos': {
    title: 'Emails Não Lidos',
    description: 'Redirecionando para a caixa de entrada...',
    isRedirect: true,
    redirectTo: '/email',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FINANCEIRO
  // ══════════════════════════════════════════════════════════════════════════
  'financeiro.consultar_caixa': {
    title: 'Consultar Caixa',
    description: 'Redirecionando para o caixa...',
    isRedirect: true,
    redirectTo: '/financeiro/caixa',
  },

  'financeiro.adicionar_receita': {
    title: 'Nova Receita',
    description: 'Registre uma nova entrada de dinheiro.',
    fields: {
      description: {
        label: 'Descrição',
        type: 'text',
        required: true,
        placeholder: 'Ex: Pagamento cliente Nexo',
      },
      amount: {
        label: 'Valor (€)',
        type: 'text',
        required: true,
        placeholder: '0,00',
      },
      date: {
        label: 'Data',
        type: 'date',
        required: true,
      },
      client: {
        label: 'Cliente',
        type: 'text',
        required: false,
        placeholder: 'Nome do cliente',
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/cash-box/entries',
      transform: (values) => ({
        description: values.description,
        amount: parseFloat(values.amount.replace(',', '.')),
        date: values.date,
        category: values.client || 'manual',
        type: 'income',
        recordedBy: 'luna',
      }),
    },
  },

  'financeiro.adicionar_despesa': {
    title: 'Nova Despesa',
    description: 'Registre uma nova saída de dinheiro.',
    fields: {
      name: {
        label: 'Nome',
        type: 'text',
        required: true,
        placeholder: 'Ex: Hostinger Premium',
      },
      description: {
        label: 'Descrição',
        type: 'text',
        required: false,
        placeholder: 'Ex: Renovação anual',
      },
      amount: {
        label: 'Valor (€)',
        type: 'text',
        required: true,
        placeholder: '0,00',
      },
      category: {
        label: 'Categoria',
        type: 'select',
        required: false,
        options: [
          { value: 'operacional', label: 'Operacional' },
          { value: 'marketing', label: 'Marketing' },
          { value: 'infraestrutura', label: 'Infraestrutura' },
          { value: 'pessoal', label: 'Pessoal' },
          { value: 'outro', label: 'Outro' },
        ],
      },
      splitAmong: {
        label: 'Dividir entre',
        type: 'select',
        required: false,
        options: [
          { value: '', label: 'Não dividir' },
          { value: 'abner', label: 'Abner' },
          { value: 'abner,nonoke,elias', label: 'Abner + Nonoke + Elias' },
          { value: 'abner,nonoke', label: 'Abner + Nonoke' },
          { value: 'abner,elias', label: 'Abner + Elias' },
          { value: 'nonoke,elias', label: 'Nonoke + Elias' },
        ],
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/expenses',
      transform: (values) => {
        const split = values.splitAmong ? values.splitAmong.split(',') : []
        return {
          name: values.name,
          description: values.description || '',
          amount: { value: parseFloat(values.amount.replace(',', '.')), currency: 'EUR' },
          category: values.category || 'outro',
          categoryLabel: values.category === 'operacional' ? 'Operacional' :
                         values.category === 'marketing' ? 'Marketing' :
                         values.category === 'infraestrutura' ? 'Infraestrutura' :
                         values.category === 'pessoal' ? 'Pessoal' : 'Outros',
          splitAmong: split,
          autoDeductFromCashBox: true,
          createdBy: 'luna',
        }
      },
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // WHATSAPP
  // ══════════════════════════════════════════════════════════════════════════
  'whatsapp.enviar_mensagem': {
    title: 'Enviar Mensagem WhatsApp',
    description: 'Preencha os dados para enviar uma mensagem.',
    fields: {
      chatName: {
        label: 'Chat',
        type: 'select',
        required: true,
        options: [
          { value: '', label: 'Selecionar...' },
          { value: 'Production', label: 'Production' },
          { value: 'Dev', label: 'Dev' },
          { value: 'Test', label: 'Test' },
        ],
      },
      text: {
        label: 'Mensagem',
        type: 'textarea',
        required: true,
        placeholder: 'Sua mensagem...',
        rows: 4,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/whatsapp/send',
      transform: (values) => ({
        chatName: values.chatName,
        text: values.text,
      }),
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ORÇAMENTOS
  // ══════════════════════════════════════════════════════════════════════════
  'orcamento.criar': {
    title: 'Novo Orçamento',
    description: 'Crie uma nova proposta comercial.',
    fields: {
      clientName: {
        label: 'Cliente',
        type: 'text',
        required: true,
        placeholder: 'Nome do cliente',
      },
      projectName: {
        label: 'Projeto',
        type: 'text',
        required: true,
        placeholder: 'Nome do projeto',
      },
      value: {
        label: 'Valor (R$)',
        type: 'text',
        required: true,
        placeholder: '0,00',
      },
      description: {
        label: 'Descrição',
        type: 'textarea',
        required: false,
        placeholder: 'Escopo do projeto...',
        rows: 4,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/quotes',
      transform: (values) => ({
        clientName: values.clientName,
        projectName: values.projectName,
        value: parseFloat(values.value.replace(',', '.')),
        description: values.description || '',
        status: 'draft',
      }),
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SISTEMA
  // ══════════════════════════════════════════════════════════════════════════
  'sistema.ajuda': {
    title: 'Ajuda da Luna',
    description: 'Posso ajudar com: emails, tarefas, projetos, clientes, financeiro, WhatsApp, orçamentos, leads e ideias.\n\nTente dizer algo como:\n• "cria tarefa urgente para revisar o site"\n• "quanto temos no caixa"\n• "manda zap pro cliente"\n• "faz proposta para o projeto Nexo"',
    isInfo: true,
  },

  'sistema.status': {
    title: 'Status do Sistema',
    description: 'Redirecionando para o painel de status...',
    isRedirect: true,
    redirectTo: '/luna',
  },

  'sistema.navegar': {
    title: 'Navegação',
    description: 'Para onde você quer ir?',
    fields: {
      destino: {
        label: 'Página',
        type: 'select',
        required: true,
        options: [
          { value: '', label: 'Selecionar...' },
          { value: '/dashboard', label: 'Dashboard' },
          { value: '/tarefas', label: 'Tarefas' },
          { value: '/email', label: 'Email' },
          { value: '/whatsapp', label: 'WhatsApp' },
          { value: '/financeiro', label: 'Financeiro' },
          { value: '/financeiro/caixa', label: 'Caixa' },
          { value: '/clientes', label: 'Clientes' },
          { value: '/orcamentos', label: 'Orçamentos' },
          { value: '/leads', label: 'Leads' },
          { value: '/ideias', label: 'Ideias' },
          { value: '/luna', label: 'Luna' },
        ],
      },
    },
    isRedirect: true,
    redirectTo: (values) => values.destino,
  },
}

// ── Fallback para intents sem schema ──

export function getSchema(intent) {
  if (!intent || intent === 'None') {
    return {
      title: 'Não entendi',
      description: 'Não consegui entender o que você precisa. Tente ser mais específico ou digite "ajuda" para ver o que posso fazer.',
      isInfo: true,
    }
  }
  return INTENT_SCHEMAS[intent] || {
    title: intent,
    description: 'Ação detectada, mas ainda não tenho um formulário específico para este comando. Você pode executar manualmente.',
    isInfo: true,
  }
}

/**
 * Verifica se um intent tem campos de formulário editáveis.
 * Usado pelo LunaFloatingButton para decidir entre SmartFormModal ou chat fallback.
 */
export function hasFormFields(intent) {
  if (!intent || intent === 'None') return false
  const schema = INTENT_SCHEMAS[intent]
  return !!(schema && schema.fields && Object.keys(schema.fields).length > 0)
}

/**
 * Verifica se um intent existe no schema registry.
 */
export function isKnownIntent(intent) {
  if (!intent || intent === 'None') return false
  return !!INTENT_SCHEMAS[intent]
}


