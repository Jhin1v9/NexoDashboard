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
    extractEntities: (entities, text) => {
      const prio = extractEntity(entities, 'prioridade')
      let priority = 'medium'
      if (prio.includes('urgent') || prio.includes('alt')) priority = 'high'
      if (prio.includes('baix')) priority = 'low'
      // Tipo
      let type = 'one_time'
      const lower = (text || '').toLowerCase()
      if (/\b(diaria|diária|daily)\b/.test(lower)) type = 'daily'
      else if (/\b(semanal|weekly)\b/.test(lower)) type = 'weekly'
      else if (/\b(mensal|monthly)\b/.test(lower)) type = 'monthly'
      // Data
      let dueDate = ''
      const isoMatch = (text || '').match(/\b(\d{4}-\d{2}-\d{2})\b/)
      if (isoMatch) dueDate = isoMatch[1]
      else if (/\b(amanha|amanhã|tomorrow)\b/.test(lower)) {
        const d = new Date(); d.setDate(d.getDate() + 1); dueDate = d.toISOString().split('T')[0]
      } else if (/\b(hoje|today)\b/.test(lower)) {
        dueDate = new Date().toISOString().split('T')[0]
      }
      return { priority, type, dueDate }
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
    extractEntities: (entities) => ({
      to: extractEntity(entities, 'email') || extractEntity(entities, 'para'),
      subject: extractEntity(entities, 'assunto'),
      body: extractEntity(entities, 'mensagem'),
    }),
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
    extractEntities: (entities) => ({
      description: extractEntity(entities, 'descricao') || extractEntity(entities, 'cliente'),
      amount: extractEntity(entities, 'valor'),
      client: extractEntity(entities, 'cliente'),
    }),
  },

  'financeiro.listar_pagamentos': {
    title: 'Pagamentos Recebidos',
    description: 'Redirecionando para a lista de pagamentos...',
    isRedirect: true,
    redirectTo: '/financeiro',
  },

  'financeiro.listar_despesas': {
    title: 'Despesas',
    description: 'Redirecionando para a lista de despesas...',
    isRedirect: true,
    redirectTo: '/financeiro',
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
    extractEntities: (entities) => ({
      name: extractEntity(entities, 'descricao') || extractEntity(entities, 'nome'),
      amount: extractEntity(entities, 'valor'),
    }),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════

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
    extractEntities: (entities, text) => {
      const val = extractEntity(entities, 'valor') || extractEntity(entities, 'value')
      const client = extractEntity(entities, 'cliente')
      const project = extractEntity(entities, 'projeto')
      return {
        clientName: client || '',
        projectName: project || '',
        value: val || '',
      }
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SISTEMA
  // ══════════════════════════════════════════════════════════════════════════
  'sistema.ajuda': {
    title: 'Ajuda da Luna',
    description: 'Posso ajudar com: emails, tarefas, projetos, clientes, financeiro, orçamentos, leads e ideias.\n\nTente dizer algo como:\n• "cria tarefa urgente para revisar o site"\n• "quanto temos no caixa"\n• "manda zap pro cliente"\n• "faz proposta para o projeto Nexo"',
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

  'social': {
    title: 'Oi! 👋',
    description: 'Oi! Tô por aqui, pronta pra ajudar.\n\nPosso te ajudar com:\n• Criar tarefas, leads, ideias\n• Registrar pagamentos e despesas\n• Consultar caixa, projetos, links\n• Enviar emails\n• Verificar menções e notificações\n\nO que você precisa?',
    isInfo: true,
  },
  'email.resumir': {
    title: 'Resumir',
    description: 'Gerar resumo do conteúdo.',
    isInfo: true,
  },

  'email.analisar': {
    title: 'Analisar',
    description: 'Analisar conteúdo e fornecer insights.',
    isInfo: true,
  },

  'email.enviar': {
    title: 'Enviar',
    description: 'Enviar mensagem ou documento.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'email.enviar',
        confirmed: values.confirmar,
      }),
    },
  },

  'email.arquivar': {
    title: 'Arquivar',
    description: 'Mover item para arquivo.',
    isInfo: true,
  },

  'email.mover_lixeira': {
    title: 'Mover para Lixeira',
    description: 'Mover item para lixeira.',
    isInfo: true,
  },

  'email.marcar_lido': {
    title: 'Marcar como Lido',
    description: 'Marcar como lido.',
    isInfo: true,
  },

  'email.sincronizar': {
    title: 'Sincronizar',
    description: 'Sincronizar dados atualizados.',
    isInfo: true,
  },

  'tarefa.atribuir': {
    title: 'Atribuir',
    description: 'Atribuir a um responsável.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'tarefa.atribuir',
        confirmed: values.confirmar,
      }),
    },
  },


  'orcamento.enviar_cliente': {
    title: 'Enviar ao Cliente',
    description: 'Enviar ao cliente.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'orcamento.enviar_cliente',
        confirmed: values.confirmar,
      }),
    },
  },

  'projeto.listar': {
    title: 'Listar',
    description: 'Listar todos os itens disponíveis.',
    isInfo: true,
  },

  'projeto.criar': {
    title: 'Criar',
    description: 'Preencha os detalhes para criar um novo item.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'projeto.criar',
        confirmed: values.confirmar,
      }),
    },
  },

  'ideia.listar': {
    title: 'Listar',
    description: 'Listar todos os itens disponíveis.',
    isInfo: true,
  },

  'ideia.criar': {
    title: 'Criar',
    description: 'Preencha os detalhes para criar um novo item.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'ideia.criar',
        confirmed: values.confirmar,
      }),
    },
  },


  'link.listar': {
    title: 'Listar',
    description: 'Listar todos os itens disponíveis.',
    isInfo: true,
  },

  'link.adicionar': {
    title: 'Adicionar',
    description: 'Adicionar novo item.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'link.adicionar',
        confirmed: values.confirmar,
      }),
    },
  },

  'sistema.notificacoes': {
    title: 'Notificações',
    description: 'Ver notificações.',
    isInfo: true,
  },

  'email.listar_rascunhos': {
    title: 'Rascunhos Pendentes',
    description: 'Listar rascunhos pendentes de aprovação.',
    isInfo: true,
  },

  'email.aprovar_rascunho': {
    title: 'Aprovar Rascunho',
    description: 'Aprovar rascunho e enviar.',
    isInfo: true,
  },

  'email.rejeitar_rascunho': {
    title: 'Rejeitar Rascunho',
    description: 'Rejeitar rascunho.',
    isInfo: true,
  },

  'email.favoritar': {
    title: 'Favoritar',
    description: 'Marcar como favorito.',
    isInfo: true,
  },

  'email.desfavoritar': {
    title: 'Desfavoritar',
    description: 'Remover dos favoritos.',
    isInfo: true,
  },

  'email.marcar_spam': {
    title: 'Marcar como Spam',
    description: 'Marcar como spam.',
    isInfo: true,
  },

  'email.restaurar_lixeira': {
    title: 'Restaurar da Lixeira',
    description: 'Restaurar item da lixeira.',
    isInfo: true,
  },

  'email.listar_arquivados': {
    title: 'Emails Arquivados',
    description: 'Listar itens arquivados.',
    isInfo: true,
  },

  'email.listar_lixeira': {
    title: 'Lixeira',
    description: 'Listar itens na lixeira.',
    isInfo: true,
  },

  'email.listar_enviados': {
    title: 'Emails Enviados',
    description: 'Listar itens enviados.',
    isInfo: true,
  },

  'email.listar_com_estrela': {
    title: 'Emails com Estrela',
    description: 'Listar itens favoritos.',
    isInfo: true,
  },

  'tarefa.minhas': {
    title: 'Minhas Tarefas',
    description: 'Listar minhas tarefas.',
    isInfo: true,
  },

  'tarefa.atrasadas': {
    title: 'Tarefas Atrasadas',
    description: 'Listar tarefas atrasadas.',
    isInfo: true,
  },

  'tarefa.por_projeto': {
    title: 'Tarefas por Projeto',
    description: 'Filtrar tarefas por projeto.',
    isInfo: true,
  },

  'tarefa.por_responsavel': {
    title: 'Tarefas por Responsável',
    description: 'Filtrar tarefas por responsável.',
    isInfo: true,
  },

  'tarefa.concluidas': {
    title: 'Tarefas Concluídas',
    description: 'Listar tarefas concluídas.',
    isInfo: true,
  },

  'financeiro.extrato': {
    title: 'Extrato Financeiro',
    description: 'Visualizar extrato financeiro completo.',
    isInfo: true,
  },

  'financeiro.gastos_do_mes': {
    title: 'Gastos do Mês',
    description: 'Visualizar gastos do mês.',
    isInfo: true,
  },

  'financeiro.receitas_do_mes': {
    title: 'Receitas do Mês',
    description: 'Visualizar receitas do mês.',
    isInfo: true,
  },

  'financeiro.balanco': {
    title: 'Balanço',
    description: 'Visualizar balanço financeiro.',
    isInfo: true,
  },

  'financeiro.projecao': {
    title: 'Projeção',
    description: 'Visualizar projeção financeira.',
    isInfo: true,
  },

  'financeiro.historico_caixa': {
    title: 'Histórico do Caixa',
    description: 'Visualizar histórico do caixa.',
    isInfo: true,
  },

  'financeiro.reconciliar': {
    title: 'Reconciliar Caixa',
    description: 'Reconciliar caixa.',
    isInfo: true,
  },

  'financeiro.ajustar_caixa': {
    title: 'Ajustar Caixa',
    description: 'Ajustar saldo do caixa.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'financeiro.ajustar_caixa',
        confirmed: values.confirmar,
      }),
    },
  },

  'financeiro.pagar_despesa': {
    title: 'Pagar Despesa',
    description: 'Registrar pagamento de despesa.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'financeiro.pagar_despesa',
        confirmed: values.confirmar,
      }),
    },
  },

  'financeiro.split': {
    title: 'Split',
    description: 'Gerenciar split financeiro.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'financeiro.split',
        confirmed: values.confirmar,
      }),
    },
  },

  'financeiro.excluir_despesa': {
    title: 'Excluir Despesa',
    description: 'Excluir despesa registrada.',
    isInfo: true,
  },

  'financeiro.excluir_pagamento': {
    title: 'Excluir Pagamento',
    description: 'Excluir pagamento registrado.',
    isInfo: true,
  },

  'financeiro.atualizar_despesa': {
    title: 'Atualizar Despesa',
    description: 'Atualizar despesa.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'financeiro.atualizar_despesa',
        confirmed: values.confirmar,
      }),
    },
  },

  'financeiro.atualizar_pagamento': {
    title: 'Atualizar Pagamento',
    description: 'Atualizar pagamento.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'financeiro.atualizar_pagamento',
        confirmed: values.confirmar,
      }),
    },
  },








  'sistema.notificacoes_lidas': {
    title: 'Marcar Notificações como Lidas',
    description: 'Marcar todas as notificações como lidas.',
    isInfo: true,
  },

  'sistema.configuracoes': {
    title: 'Configurações',
    description: 'Abrir configurações.',
    isInfo: true,
  },

  'sistema.trocar_usuario': {
    title: 'Trocar Usuário',
    description: 'Trocar de usuário.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'sistema.trocar_usuario',
        confirmed: values.confirmar,
      }),
    },
  },

  'sistema.alterar_senha': {
    title: 'Alterar Senha',
    description: 'Alterar senha.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'sistema.alterar_senha',
        confirmed: values.confirmar,
      }),
    },
  },

  'sistema.usuarios': {
    title: 'Usuários',
    description: 'Listar usuários.',
    isInfo: true,
  },

  'sistema.changelog': {
    title: 'Changelog',
    description: 'Visualizar changelog.',
    isInfo: true,
  },

  'sistema.relatorios_bug': {
    title: 'Relatórios de Bug',
    description: 'Visualizar relatórios de bug.',
    isInfo: true,
  },

  'sistema.auto_fix': {
    title: 'Auto Fix',
    description: 'Executar auto fix.',
    isInfo: true,
  },

  'sistema.controlar_servico': {
    title: 'Controlar Serviço',
    description: 'Controlar serviço.',
    isInfo: true,
  },

  'workspace.listar_clientes': {
    title: 'Listar Clientes',
    description: 'Listar clientes do workspace.',
    isInfo: true,
  },

  'workspace.abrir': {
    title: 'Abrir',
    description: 'Abrir workspace.',
    isInfo: true,
  },

  'workspace.criar_cliente': {
    title: 'Criar Cliente',
    description: 'Criar novo cliente no workspace.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'workspace.criar_cliente',
        confirmed: values.confirmar,
      }),
    },
  },

  'workspace.criar_pasta': {
    title: 'Criar Pasta',
    description: 'Criar nova pasta.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'workspace.criar_pasta',
        confirmed: values.confirmar,
      }),
    },
  },

  'workspace.upload': {
    title: 'Upload',
    description: 'Fazer upload de arquivo.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'workspace.upload',
        confirmed: values.confirmar,
      }),
    },
  },

  'workspace.servidores': {
    title: 'Servidores',
    description: 'Visualizar status dos servidores.',
    isInfo: true,
  },

  'workspace.iniciar_demo': {
    title: 'Iniciar Demo',
    description: 'Iniciar servidor de demo.',
    isInfo: true,
  },

  'workspace.parar_demo': {
    title: 'Parar Demo',
    description: 'Parar servidor de demo.',
    isInfo: true,
  },

  'workspace.logs': {
    title: 'Logs',
    description: 'Visualizar logs.',
    isInfo: true,
  },




  'github.repos': {
    title: 'Repositórios',
    description: 'Listar repositórios.',
    isInfo: true,
  },

  'github.git_push': {
    title: 'Git Push',
    description: 'Executar git push.',
    isInfo: true,
  },

  'github.status': {
    title: 'Status',
    description: 'Verificar status atual.',
    isInfo: true,
  },

  'vercel.projetos': {
    title: 'Projetos na Vercel',
    description: 'Listar projetos na Vercel.',
    isInfo: true,
  },

  'vercel.status': {
    title: 'Status',
    description: 'Verificar status atual.',
    isInfo: true,
  },

  'seguranca.configuracoes': {
    title: 'Configurações',
    description: 'Abrir configurações.',
    isInfo: true,
  },

  'seguranca.logs': {
    title: 'Logs',
    description: 'Visualizar logs.',
    isInfo: true,
  },


  'seguranca.alerta': {
    title: 'Criar Alerta',
    description: 'Criar alerta.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'seguranca.alerta',
        confirmed: values.confirmar,
      }),
    },
  },

  'operacao.alerta': {
    title: 'Criar Alerta',
    description: 'Criar alerta.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'operacao.alerta',
        confirmed: values.confirmar,
      }),
    },
  },

  'operacao.excluir_alerta': {
    title: 'Excluir Alerta',
    description: 'Excluir alerta.',
    isInfo: true,
  },

  'operacao.mudanca': {
    title: 'Registrar Mudança',
    description: 'Registrar mudança no sistema.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'operacao.mudanca',
        confirmed: values.confirmar,
      }),
    },
  },

  'operacao.status': {
    title: 'Status',
    description: 'Verificar status atual.',
    isInfo: true,
  },

  'email.marcar_importante': {
    title: 'Marcar como Importante',
    description: 'Marcar como importante.',
    isInfo: true,
  },

  'tarefa.atualizar': {
    title: 'Atualizar',
    description: 'Atualizar informações do item selecionado.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'tarefa.atualizar',
        confirmed: values.confirmar,
      }),
    },
  },

  'tarefa.deletar': {
    title: 'Excluir',
    description: 'Confirmar exclusão do item.',
    isInfo: true,
  },

  'tarefa.adicionar_comentario': {
    title: 'Adicionar Comentário',
    description: 'Adicionar comentário.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'tarefa.adicionar_comentario',
        confirmed: values.confirmar,
      }),
    },
  },

  'projeto.atualizar': {
    title: 'Atualizar',
    description: 'Atualizar informações do item selecionado.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'projeto.atualizar',
        confirmed: values.confirmar,
      }),
    },
  },

  'projeto.deletar': {
    title: 'Excluir',
    description: 'Confirmar exclusão do item.',
    isInfo: true,
  },

  'projeto.adicionar_cliente': {
    title: 'adicionar_cliente',
    description: 'Executar ação: adicionar_cliente',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'projeto.adicionar_cliente',
        confirmed: values.confirmar,
      }),
    },
  },

  'projeto.ver_status': {
    title: 'ver_status',
    description: 'Executar ação: ver_status',
    isInfo: true,
  },

  'cliente.criar': {
    title: 'Criar',
    description: 'Preencha os detalhes para criar um novo item.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'cliente.criar',
        confirmed: values.confirmar,
      }),
    },
  },

  'cliente.listar': {
    title: 'Listar',
    description: 'Listar todos os itens disponíveis.',
    isInfo: true,
  },

  'cliente.buscar': {
    title: 'buscar',
    description: 'Executar ação: buscar',
    isInfo: true,
  },

  'cliente.atualizar': {
    title: 'Atualizar',
    description: 'Atualizar informações do item selecionado.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'cliente.atualizar',
        confirmed: values.confirmar,
      }),
    },
  },

  'cliente.deletar': {
    title: 'Excluir',
    description: 'Confirmar exclusão do item.',
    isInfo: true,
  },

  'financeiro.projetar_caixa': {
    title: 'Projetar Caixa',
    description: 'Projeção financeira futura.',
    isInfo: true,
  },

  'financeiro.ver_balanco': {
    title: 'Ver Balanço',
    description: 'Visualizar balanço financeiro.',
    isInfo: true,
  },




  'link.excluir': {
    title: 'Excluir',
    description: 'Excluir item selecionado.',
    isInfo: true,
  },

  'orcamento.listar': {
    title: 'Listar',
    description: 'Listar todos os itens disponíveis.',
    isInfo: true,
  },

  'orcamento.atualizar': {
    title: 'Atualizar',
    description: 'Atualizar informações do item selecionado.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'orcamento.atualizar',
        confirmed: values.confirmar,
      }),
    },
  },

  'orcamento.aprovar': {
    title: 'Aprovar',
    description: 'Aprovar item.',
    isInfo: true,
  },

  'orcamento.rejeitar': {
    title: 'Rejeitar',
    description: 'Rejeitar item.',
    isInfo: true,
  },

  'lead.criar': {
    title: 'Criar',
    description: 'Preencha os detalhes para criar um novo item.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'lead.criar',
        confirmed: values.confirmar,
      }),
    },
  },

  'lead.listar': {
    title: 'Listar',
    description: 'Listar todos os itens disponíveis.',
    isInfo: true,
  },

  'lead.atualizar_status': {
    title: 'Atualizar Status',
    description: 'Atualizar status do item.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'lead.atualizar_status',
        confirmed: values.confirmar,
      }),
    },
  },

  'lead.converter': {
    title: 'Converter',
    description: 'Converter para outro tipo.',
    isInfo: true,
  },

  'lead.deletar': {
    title: 'Excluir',
    description: 'Confirmar exclusão do item.',
    isInfo: true,
  },

  'ideia.atualizar': {
    title: 'Atualizar',
    description: 'Atualizar informações do item selecionado.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'ideia.atualizar',
        confirmed: values.confirmar,
      }),
    },
  },

  'ideia.deletar': {
    title: 'Excluir',
    description: 'Confirmar exclusão do item.',
    isInfo: true,
  },

  'ideia.converter_tarefa': {
    title: 'Converter em Tarefa',
    description: 'Converter ideia em tarefa.',
    isInfo: true,
  },

  'ideia.adicionar_comentario': {
    title: 'Adicionar Comentário',
    description: 'Adicionar comentário.',
    fields: {
      confirmar: {
        label: 'Confirmar ação',
        type: 'checkbox',
        required: true,
      },
    },
    submitConfig: {
      method: 'POST',
      endpoint: '/api/luna/action',
      transform: (values) => ({
        intent: 'ideia.adicionar_comentario',
        confirmed: values.confirmar,
      }),
    },
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


