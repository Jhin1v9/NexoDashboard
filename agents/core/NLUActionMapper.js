/**
 * ═════════════════════════════════════════════════════════════════════════════
 * NLU ACTION MAPPER — NEXO Dashboard Pro
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Mapeia intents do motor NLU (node-nlp) para ações do ActionExecutor.
 * Extrai entities do NLU e converte em parâmetros estruturados.
 *
 * Arquitetura: NLU Intent → Action Type + Params → ActionExecutor
 */

// ═════════════════════════════════════════════════════════════════════════════
// MAPEAMENTO: Intent NLU → Tipo de Ação do ActionExecutor
// ═════════════════════════════════════════════════════════════════════════════

const INTENT_TO_ACTION = {
  // EMAIL
  'email.responder': { type: 'responder_email', needsConfirmation: false },
  'email.resumir': { type: 'resumir_thread_email', needsConfirmation: false },
  'email.analisar': { type: 'analizar_email', needsConfirmation: false },
  'email.criar_rascunho': { type: 'gerar_rascunho_email', needsConfirmation: false },
  'email.enviar': { type: 'enviar_email', needsConfirmation: false },
  'email.arquivar': { type: 'arquivar_email', needsConfirmation: false },
  'email.mover_lixeira': { type: 'mover_para_lixeira', needsConfirmation: false },
  'email.marcar_importante': { type: 'favoritar_email', needsConfirmation: false },
  'email.marcar_lido': { type: 'marcar_email_lido', needsConfirmation: false },
  'email.listar_nao_lidos': { type: 'consultar_emails', needsConfirmation: false },
  'email.sincronizar': { type: 'consultar_emails', needsConfirmation: false },

  // TAREFAS
  'tarefa.criar': { type: 'criar_tarefa', needsConfirmation: true },
  'tarefa.listar': { type: 'consultar_tarefas', needsConfirmation: false },
  'tarefa.atualizar': { type: 'atualizar_tarefa', needsConfirmation: false },
  'tarefa.deletar': { type: 'excluir_tarefa', needsConfirmation: true },
  'tarefa.concluir': { type: 'confirmar_tarefa', needsConfirmation: false },
  'tarefa.atribuir': { type: 'atualizar_tarefa', needsConfirmation: false },
  'tarefa.adicionar_comentario': { type: 'adicionar_comentario', needsConfirmation: false },

  // PROJETOS
  'projeto.criar': { type: 'criar_projeto', needsConfirmation: true },
  'projeto.listar': { type: 'listar_projetos', needsConfirmation: false },
  'projeto.atualizar': { type: 'atualizar_projeto', needsConfirmation: false },
  'projeto.deletar': { type: 'excluir_projeto', needsConfirmation: true },
  'projeto.adicionar_cliente': { type: 'adicionar_cliente_workspace', needsConfirmation: false },
  'projeto.ver_status': { type: 'consultar_status', needsConfirmation: false },

  // CLIENTES
  'cliente.criar': { type: 'criar_cliente', needsConfirmation: true },
  'cliente.listar': { type: 'listar_clientes', needsConfirmation: false },
  'cliente.buscar': { type: 'listar_clientes', needsConfirmation: false },
  'cliente.atualizar': { type: 'atualizar_cliente', needsConfirmation: false },
  'cliente.deletar': { type: 'excluir_cliente', needsConfirmation: true },

  // FINANCEIRO
  'financeiro.consultar_caixa': { type: 'consultar_caixa', needsConfirmation: false },
  'financeiro.adicionar_receita': { type: 'registrar_pagamento', needsConfirmation: true },
  'financeiro.adicionar_despesa': { type: 'registrar_despesa', needsConfirmation: true },
  'financeiro.listar_pagamentos': { type: 'listar_pagamentos', needsConfirmation: false },
  'financeiro.listar_despesas': { type: 'listar_despesas', needsConfirmation: false },
  'financeiro.projetar_caixa': { type: 'projecao_caixa', needsConfirmation: false },
  'financeiro.ver_balanco': { type: 'consultar_financeiro', needsConfirmation: false },

  // WHATSAPP
  'whatsapp.enviar_mensagem': { type: 'enviar_mensagem_whatsapp', needsConfirmation: false },
  'whatsapp.responder_cliente': { type: 'enviar_mensagem_whatsapp', needsConfirmation: false },
  'whatsapp.ver_historico': { type: 'ver_historico_whatsapp', needsConfirmation: false },
  'whatsapp.sincronizar': { type: 'escanear_whatsapp', needsConfirmation: false },
  'whatsapp.marcar_nao_lido': { type: 'limpar_buffer_whatsapp', needsConfirmation: false },

  // ORÇAMENTOS
  'orcamento.criar': { type: 'criar_orcamento', needsConfirmation: true },
  'orcamento.listar': { type: 'listar_orcamentos', needsConfirmation: false },
  'orcamento.atualizar': { type: 'atualizar_orcamento', needsConfirmation: false },
  'orcamento.enviar_cliente': { type: 'enviar_email', needsConfirmation: false },
  'orcamento.aprovar': { type: 'atualizar_orcamento', needsConfirmation: false },
  'orcamento.rejeitar': { type: 'atualizar_orcamento', needsConfirmation: false },

  // LEADS
  'lead.criar': { type: 'criar_lead', needsConfirmation: true },
  'lead.listar': { type: 'consultar_leads', needsConfirmation: false },
  'lead.atualizar_status': { type: 'atualizar_lead', needsConfirmation: false },
  'lead.converter': { type: 'converter_lead', needsConfirmation: true },
  'lead.deletar': { type: 'excluir_lead', needsConfirmation: true },

  // IDEIAS
  'ideia.criar': { type: 'criar_ideia', needsConfirmation: true },
  'ideia.listar': { type: 'listar_ideias', needsConfirmation: false },
  'ideia.atualizar': { type: 'atualizar_ideia', needsConfirmation: false },
  'ideia.deletar': { type: 'excluir_ideia', needsConfirmation: true },
  'ideia.converter_tarefa': { type: 'converter_ideia_em_tarefa', needsConfirmation: true },
  'ideia.adicionar_comentario': { type: 'comentar_ideia', needsConfirmation: false },

  // LINKS
  'link.listar': { type: 'listar_links', needsConfirmation: false },
  'link.adicionar': { type: 'adicionar_link', needsConfirmation: false },
  'link.excluir': { type: 'excluir_link', needsConfirmation: true },

  // SISTEMA
  'sistema.ajuda': { type: 'ideia', needsConfirmation: false },
  'sistema.status': { type: 'consultar_status', needsConfirmation: false },
  'sistema.navegar': { type: 'ideia', needsConfirmation: false },
  'sistema.notificacoes': { type: 'listar_notificacoes', needsConfirmation: false },
};

// ═════════════════════════════════════════════════════════════════════════════
// EXTRACTORS: Extrai parâmetros das entities do NLU
// ═════════════════════════════════════════════════════════════════════════════

const ENTITY_EXTRACTORS = {
  // Email
  'email.responder': (entities, text) => ({
    emailId: entities.find(e => e.type === 'email_id')?.value || extractEmailId(text),
    resposta: entities.find(e => e.type === 'mensagem')?.value || extractAfterKeyword(text, ['com', 'dizendo', 'falando']),
  }),
  'email.enviar': (entities, text) => ({
    para: entities.find(e => e.type === 'email')?.value || entities.find(e => e.type === 'contato')?.value || extractEmail(text),
    assunto: entities.find(e => e.type === 'assunto')?.value || extractAfterKeyword(text, ['assunto', 'sobre', 'referente a']),
    mensagem: entities.find(e => e.type === 'mensagem')?.value || text,
  }),
  'email.arquivar': (entities, text) => ({
    emailId: entities.find(e => e.type === 'email_id')?.value || extractEmailId(text),
  }),
  'email.mover_lixeira': (entities, text) => ({
    emailId: entities.find(e => e.type === 'email_id')?.value || extractEmailId(text),
  }),
  'email.marcar_importante': (entities, text) => ({
    emailId: entities.find(e => e.type === 'email_id')?.value || extractEmailId(text),
  }),

  // Tarefas
  'tarefa.criar': (entities, text) => {
    const titulo = entities.find(e => e.type === 'tarefa')?.value ||
                   entities.find(e => e.type === 'acao')?.value ||
                   extractAfterKeyword(text, ['tarefa', 'criar', 'fazer', 'preciso']);
    const responsavel = entities.find(e => e.type === 'pessoa')?.value || extractPerson(text);
    const prioridade = extractPriority(text);
    return {
      titulo,
      responsavel,
      prioridade,
      descricao: text,
    };
  },
  'tarefa.concluir': (entities, text) => ({
    titulo: entities.find(e => e.type === 'tarefa')?.value || text,
  }),
  'tarefa.atribuir': (entities, text) => ({
    titulo: entities.find(e => e.type === 'tarefa')?.value || text,
    responsavel: entities.find(e => e.type === 'pessoa')?.value || extractPerson(text),
  }),

  // Financeiro
  'financeiro.adicionar_receita': (entities, text) => ({
    valor: entities.find(e => e.type === 'valor')?.value || extractValue(text),
    descricao: entities.find(e => e.type === 'descricao')?.value || entities.find(e => e.type === 'cliente')?.value || text,
    cliente: entities.find(e => e.type === 'cliente')?.value || extractAfterKeyword(text, ['de', 'do', 'da']),
  }),
  'financeiro.adicionar_despesa': (entities, text) => ({
    valor: entities.find(e => e.type === 'valor')?.value || extractValue(text),
    descricao: entities.find(e => e.type === 'descricao')?.value || text,
    categoria: entities.find(e => e.type === 'categoria')?.value || 'outro',
  }),

  // Leads
  'lead.criar': (entities, text) => ({
    nome: entities.find(e => e.type === 'pessoa')?.value || entities.find(e => e.type === 'lead')?.value || extractAfterKeyword(text, ['lead', 'chamado', 'nome']),
    email: entities.find(e => e.type === 'email')?.value || extractEmail(text),
    telefone: entities.find(e => e.type === 'telefone')?.value || extractPhone(text),
  }),

  // Ideias
  'ideia.criar': (entities, text) => ({
    titulo: entities.find(e => e.type === 'ideia')?.value || extractAfterKeyword(text, ['ideia', 'criar']),
    tipo: 'brainstorm',
    descricao: text,
  }),
  'ideia.listar': () => ({}),
  'projeto.listar': () => ({}),
  'link.listar': () => ({}),
  'sistema.notificacoes': () => ({}),
  'whatsapp.verificar_mencoes': () => ({}),
  'email.marcar_lido': (entities, text) => ({
    emailId: entities.find(e => e.type === 'email_id')?.value || extractEmailId(text),
  }),

  // WhatsApp
  'whatsapp.enviar_mensagem': (entities, text) => ({
    numero: entities.find(e => e.type === 'telefone')?.value || extractPhone(text),
    mensagem: entities.find(e => e.type === 'mensagem')?.value || text,
  }),
};

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS de extração
// ═════════════════════════════════════════════════════════════════════════════

function extractEmail(text) {
  const match = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  return match ? match[0] : null;
}

function extractEmailId(text) {
  // Tenta extrair ID de email (hexadecimal do Gmail)
  const match = text.match(/\b([a-f0-9]{16})\b/);
  return match ? match[1] : null;
}

function extractPhone(text) {
  const match = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/);
  return match ? match[0] : null;
}

function extractValue(text) {
  const match = text.match(/(?:€|R\$|\$)?\s*(\d+(?:[.,]\d{1,2})?)/);
  return match ? parseFloat(match[1].replace(',', '.')) : null;
}

function extractPerson(text) {
  const names = ['abner', 'nonoke', 'enoque', 'elias'];
  const lower = text.toLowerCase();
  for (const name of names) {
    if (lower.includes(name)) return name;
  }
  return null;
}

function extractPriority(text) {
  const lower = text.toLowerCase();
  if (lower.includes('urgente') || lower.includes('critico') || lower.includes('p0')) return 'P0';
  if (lower.includes('alta') || lower.includes('importante') || lower.includes('p1')) return 'P1';
  if (lower.includes('baixa') || lower.includes('p2')) return 'P2';
  return 'P2';
}

function extractAfterKeyword(text, keywords) {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx !== -1) {
      const after = text.slice(idx + kw.length).trim();
      if (after) return after.replace(/^[\s:,-]+/, '').slice(0, 100);
    }
  }
  return text.slice(0, 100);
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN: Converte resultado NLU em ação do ActionExecutor
// ═════════════════════════════════════════════════════════════════════════════

function mapNLUToAction(nluResult) {
  const { intent, entities, score, text } = nluResult;

  if (!intent || intent === 'None') {
    return null;
  }

  const mapping = INTENT_TO_ACTION[intent];
  if (!mapping) {
    return null;
  }

  // Extrai parâmetros das entities
  let params = {};
  const extractor = ENTITY_EXTRACTORS[intent];
  if (extractor) {
    try {
      params = extractor(entities || [], text || '');
    } catch (e) {
      console.error(`[NLUActionMapper] Erro extraindo entities para ${intent}:`, e.message);
    }
  }

  // Limpa parâmetros nulos/undefined
  Object.keys(params).forEach(key => {
    if (params[key] === null || params[key] === undefined) {
      delete params[key];
    }
  });

  return {
    type: mapping.type,
    params,
    needsConfirmation: mapping.needsConfirmation,
    source: 'nlu',
    nluIntent: intent,
    nluScore: score,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// BATCH: Converte múltiplos resultados (caso de múltiplas intenções)
// ═════════════════════════════════════════════════════════════════════════════

function mapNLUResults(nluResult) {
  // NLU retorna uma intent principal
  const action = mapNLUToAction(nluResult);
  if (!action) return { actions: [], intent: null, score: 0 };

  return {
    actions: [action],
    intent: action.nluIntent,
    score: action.nluScore,
    needsConfirmation: action.needsConfirmation,
    source: 'nlu',
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
  mapNLUToAction,
  mapNLUResults,
  INTENT_TO_ACTION,
  // Helpers expostos para testes
  extractEmail,
  extractEmailId,
  extractPhone,
  extractValue,
  extractPerson,
  extractPriority,
};
