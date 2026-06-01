/**
 * LunaModuleSuggestions — Sugestões e comandos de ajuda contextual por módulo.
 *
 * Cada página do NEXO tem suas próprias sugestões rápidas e comandos de ajuda.
 * O RouteHarvester detecta a página atual e o LunaFloatingButton usa este mapa.
 */

export const MODULE_SUGGESTIONS = {
  dashboard: {
    label: 'Dashboard',
    quick: [
      'resumo do dia',
      'tarefas pendentes',
      'saldo do caixa',
      'leads novos',
    ],
    help: [
      { cmd: 'resumo do dia', desc: 'Panorama geral: tarefas, financeiro, leads, menções' },
      { cmd: 'tarefas pendentes', desc: 'Lista suas tarefas não concluídas' },
      { cmd: 'tarefas P0', desc: 'Mostra tarefas críticas (prioridade máxima)' },
      { cmd: 'saldo do caixa', desc: 'Quanto temos disponível no caixa' },
      { cmd: 'leads novos', desc: 'Leads que entraram recentemente no pipeline' },
      { cmd: 'gastos do mês', desc: 'Total de despesas do mês atual' },
      { cmd: 'criar tarefa', desc: 'Adiciona uma nova tarefa ao sistema' },
    ],
  },

  operations: {
    label: 'Operações',
    quick: [
      'status das operações',
      'alertas de segurança',
      'resumo do dia',
      'tarefas P0',
      'verificar menções',
    ],
    help: [
      { cmd: 'status das operações', desc: 'Visão geral do centro de operações' },
      { cmd: 'alertas de segurança', desc: 'Alertas ativos e logs de segurança' },
      { cmd: 'resumo do dia', desc: 'Panorama geral do NEXO agora' },
      { cmd: 'tarefas P0', desc: 'Tarefas críticas que precisam de atenção imediata' },
      { cmd: 'verificar menções', desc: 'Onde você foi mencionado' },
      { cmd: 'criar tarefa', desc: 'Adiciona tarefa com prioridade e responsável' },
      { cmd: 'listar projetos', desc: 'Status de todos os projetos ativos' },
      { cmd: 'leads em negociação', desc: 'Leads que estão perto de fechar' },
    ],
  },

  finance: {
    label: 'Financeiro',
    quick: [
      'saldo do caixa',
      'adicionar despesa',
      'receitas do mês',
      'gastos do mês',
      'quanto temos no caixa',
    ],
    help: [
      { cmd: 'saldo do caixa', desc: 'Valor atual disponível' },
      { cmd: 'adicionar despesa', desc: 'Registra uma nova despesa com categoria' },
      { cmd: 'registrar pagamento', desc: 'Adiciona uma receita/entrada' },
      { cmd: 'receitas do mês', desc: 'Total de entradas no mês atual' },
      { cmd: 'gastos do mês', desc: 'Total de despesas no mês atual' },
      { cmd: 'extrato financeiro', desc: 'Histórico completo de transações' },
      { cmd: 'próximos pagamentos', desc: 'Receitas agendadas/pendentes' },
      { cmd: 'divisão dos founders', desc: 'Quanto cada um deve receber' },
      { cmd: 'extrato financeiro', desc: 'Histórico completo de transações' },
      { cmd: 'balanço do mês', desc: 'Receitas vs despesas do mês' },
      { cmd: 'projeção de caixa', desc: 'Previsão financeira futura' },
      { cmd: 'reconciliar caixa', desc: 'Conferência e fechamento do caixa' },
      { cmd: 'histórico do caixa', desc: 'Evolução do caixa ao longo do tempo' },
    ],
  },

  tasks: {
    label: 'Tarefas',
    quick: [
      'minhas tarefas',
      'criar tarefa urgente',
      'tarefas P0',
      'concluir tarefa',
      'tarefas do projeto',
    ],
    help: [
      { cmd: 'minhas tarefas', desc: 'Tarefas atribuídas a você' },
      { cmd: 'criar tarefa', desc: 'Nova tarefa com título, prioridade e responsável' },
      { cmd: 'criar tarefa urgente', desc: 'Tarefa com prioridade alta/P0' },
      { cmd: 'tarefas P0', desc: 'Tarefas críticas pendentes' },
      { cmd: 'tarefas P1', desc: 'Tarefas importantes pendentes' },
      { cmd: 'concluir tarefa', desc: 'Marca uma tarefa como feita' },
      { cmd: 'excluir tarefa', desc: 'Remove uma tarefa do sistema' },
      { cmd: 'tarefas atrasadas', desc: 'Tarefas com prazo vencido' },
      { cmd: 'tarefas por projeto', desc: 'Filtra tarefas por projeto/cliente' },
      { cmd: 'tarefas por responsável', desc: 'Filtra tarefas por pessoa' },
      { cmd: 'tarefas concluídas', desc: 'Histórico de tarefas feitas' },
    ],
  },

  workspace: {
    label: 'Workspace',
    quick: [
      'listar clientes',
      'abrir workspace do cliente',
      'criar pasta',
      'upload de arquivo',
      'projetos do cliente',
    ],
    help: [
      { cmd: 'listar clientes', desc: 'Todos os clientes com workspace ativo' },
      { cmd: 'listar leads', desc: 'Leads no pipeline (não convertidos)' },
      { cmd: 'converter lead', desc: 'Transforma lead em cliente com workspace' },
      { cmd: 'criar cliente workspace', desc: 'Novo cliente com estrutura de pastas' },
      { cmd: 'abrir workspace', desc: 'Navega para a pasta de um cliente' },
      { cmd: 'projetos do cliente', desc: 'Lista projetos vinculados ao cliente' },
      { cmd: 'servidores de demo', desc: 'Status dos servidores de desenvolvimento' },
    ],
  },

  leads: {
    label: 'Leads',
    quick: [
      'leads em negociação',
      'leads novos',
      'adicionar lead',
      'converter lead',
      'pipeline de vendas',
    ],
    help: [
      { cmd: 'leads em negociação', desc: 'Leads próximos de fechar' },
      { cmd: 'leads novos', desc: 'Entraram recentemente no pipeline' },
      { cmd: 'adicionar lead', desc: 'Registra novo potencial cliente' },
      { cmd: 'converter lead', desc: 'Muda status para ganho e cria workspace' },
      { cmd: 'pipeline de vendas', desc: 'Visão geral do funil' },
      { cmd: 'proposta enviada', desc: 'Leads aguardando aprovação de orçamento' },
      { cmd: 'valor total do pipeline', desc: 'Soma dos orçamentos em negociação' },
    ],
  },

  email: {
    label: 'Email',
    quick: [
      'emails não lidos',
      'responder último email',
      'resumo de thread',
      'rascunhos pendentes',
      'emails arquivados',
    ],
    help: [
      { cmd: 'emails não lidos', desc: 'Caixa de entrada com mensagens novas' },
      { cmd: 'responder email', desc: 'Gera resposta com IA Gemini' },
      { cmd: 'resumo de thread', desc: 'Resumo com action items e sentiment' },
      { cmd: 'rascunhos pendentes', desc: 'Drafts da Luna aguardando aprovação' },
      { cmd: 'action items para tarefas', desc: 'Converte action items do email em tarefas' },
      { cmd: 'enviar email', desc: 'Compor e enviar nova mensagem' },
      { cmd: 'analisar segurança', desc: 'Verifica se email é suspeito/phishing' },
    ],
  },

  ideas: {
    label: 'Ideias',
    quick: [
      'minhas ideias',
      'criar ideia de projeto',
      'brainstorm com IA',
      'converter ideia em tarefa',
      'ideias por categoria',
    ],
    help: [
      { cmd: 'minhas ideias', desc: 'Todas as ideias que você criou' },
      { cmd: 'criar ideia', desc: 'Nova ideia com título e descrição' },
      { cmd: 'brainstorm com IA', desc: 'Chat com Gemini para expandir a ideia' },
      { cmd: 'converter ideia em tarefa', desc: 'Transforma uma ideia em tarefa acionável' },
      { cmd: 'ideias por categoria', desc: 'Filtra por categoria (produto, marketing, etc)' },
      { cmd: 'templates de ideias', desc: 'Ideias base para começar' },
    ],
  },

  projects: {
    label: 'Projetos',
    quick: [
      'listar projetos',
      'status do projeto',
      ' demos do cliente',
      'servidores de desenvolvimento',
      'projetos no github',
    ],
    help: [
      { cmd: 'listar projetos', desc: 'Todos os projetos ativos e arquivados' },
      { cmd: 'status do projeto', desc: 'Em qual etapa o projeto está' },
      { cmd: 'iniciar servidor demo', desc: 'Roda o servidor de desenvolvimento' },
      { cmd: 'parar servidor demo', desc: 'Desliga o servidor de desenvolvimento' },
      { cmd: 'logs do servidor', desc: 'Terminal SSE com logs em tempo real' },
      { cmd: 'projetos no github', desc: 'Repos vinculados no GitHub' },
      { cmd: 'deploys na vercel', desc: 'Status dos projetos na Vercel' },
    ],
  },

  clients: {
    label: 'Clientes',
    quick: [
      'listar clientes',
      'dados do cliente',
      'orcamentos do cliente',
      'projetos do cliente',
      'contato do cliente',
    ],
    help: [
      { cmd: 'listar clientes', desc: 'Todos os clientes externos' },
      { cmd: 'dados do cliente', desc: 'Informações de contato e contrato' },
      { cmd: 'orcamentos do cliente', desc: 'Propostas enviadas e valores' },
      { cmd: 'projetos do cliente', desc: 'Projetos vinculados' },
      { cmd: 'adicionar cliente', desc: 'Registra novo cliente externo' },
      { cmd: 'atualizar cliente', desc: 'Modifica dados do cliente' },
    ],
  },

  budgets: {
    label: 'Orçamentos',
    quick: [
      'listar orçamentos',
      'orçamentos pendentes',
      'criar orçamento',
      'aprovar orçamento',
      'valor total de orçamentos',
    ],
    help: [
      { cmd: 'listar orçamentos', desc: 'Todos os orçamentos do sistema' },
      { cmd: 'orçamentos pendentes', desc: 'Aguardando aprovação do cliente' },
      { cmd: 'criar orçamento', desc: 'Novo orçamento com itens e valores' },
      { cmd: 'aprovar orçamento', desc: 'Muda status para aprovado' },
      { cmd: 'valor total', desc: 'Soma de todos os orçamentos ativos' },
    ],
  },

  changelog: {
    label: 'Changelog',
    quick: [
      'últimas atualizações',
      'novas features',
      'bug fixes',
      'marcar tudo como lido',
    ],
    help: [
      { cmd: 'últimas atualizações', desc: 'Mudanças mais recentes do sistema' },
      { cmd: 'novas features', desc: 'Funcionalidades adicionadas recentemente' },
      { cmd: 'bug fixes', desc: 'Correções aplicadas' },
      { cmd: 'marcar tudo como lido', desc: 'Limpa notificações do changelog' },
    ],
  },

  luna: {
    label: 'Luna',
    quick: [
      'comandos disponíveis',
      'o que você pode fazer',
      'ajuda',
      'status do sistema',
    ],
    help: [
      { cmd: 'ajuda', desc: 'Lista comandos do módulo atual' },
      { cmd: 'status do sistema', desc: 'Panorama geral do NEXO' },
      { cmd: 'criar tarefa', desc: 'Adiciona tarefa ao sistema' },
      { cmd: 'adicionar despesa', desc: 'Registra despesa no financeiro' },
            { cmd: 'responder email', desc: 'Gera resposta com IA' },
      { cmd: 'listar projetos', desc: 'Status dos projetos' },
      { cmd: 'saldo do caixa', desc: 'Financeiro atual' },
    ],
  },

  // Fallback para módulos não mapeados
  unknown: {
    label: 'Geral',
    quick: [
      'status do sistema',
      'criar tarefa',
      'saldo do caixa',
      'listar projetos',
      'ajuda',
    ],
    help: [
      { cmd: 'ajuda', desc: 'Mostra comandos disponíveis' },
      { cmd: 'status do sistema', desc: 'Panorama geral do NEXO' },
      { cmd: 'criar tarefa', desc: 'Adiciona tarefa' },
      { cmd: 'saldo do caixa', desc: 'Quanto temos disponível' },
      { cmd: 'listar projetos', desc: 'Status dos projetos ativos' },
      { cmd: 'leads novos', desc: 'Potenciais clientes recentes' },
          ],
  },
}

/**
 * Retorna sugestões para o módulo atual.
 */
export function getSuggestionsForModule(moduleId) {
  return MODULE_SUGGESTIONS[moduleId] || MODULE_SUGGESTIONS.unknown
}

/**
 * Formata a ajuda como texto para o chat.
 */
export function formatHelpForModule(moduleId) {
  const mod = getSuggestionsForModule(moduleId)
  let text = `📍 **${mod.label}** — Comandos disponíveis:\n\n`
  mod.help.forEach((h, i) => {
    text += `${i + 1}. **${h.cmd}** — ${h.desc}\n`
  })
  text += `\n💡 Dica: clique em qualquer sugestão abaixo ou digite o comando.`
  return text
}
