const fs = require('fs');
const path = require('path');

// ============================================
// AUTHOR RESOLVER v16.0 (movido de luna-cto-agent.cjs)
// ============================================
function resolveAuthorAlias(value) {
  const raw = (value || '').toString().trim();
  const key = raw.toLowerCase();
  const aliases = {
    abner: { id: 'nexo-abner-001', name: 'Abner Gabriel', fullName: 'Abner Gabriel Mendes', role: 'CEO', isNexo: true, isFounder: true },
    'abner gabriel': { id: 'nexo-abner-001', name: 'Abner Gabriel', fullName: 'Abner Gabriel Mendes', role: 'CEO', isNexo: true, isFounder: true },
    nonoke: { id: 'nexo-enoque-001', name: 'Enoque G. Santos', fullName: 'Enoque G Santos Clemente', role: 'CEO', isNexo: true, isFounder: true },
    enoque: { id: 'nexo-enoque-001', name: 'Enoque G. Santos', fullName: 'Enoque G Santos Clemente', role: 'CEO', isNexo: true, isFounder: true },
    'e.g.santos': { id: 'nexo-enoque-001', name: 'Enoque G. Santos', fullName: 'Enoque G Santos Clemente', role: 'CEO', isNexo: true, isFounder: true },
    elias: { id: 'nexo-elias-001', name: 'Elias Mendes', fullName: 'Elias Mendes', role: 'CEO', isNexo: true, isFounder: true },
    'elias mendes': { id: 'nexo-elias-001', name: 'Elias Mendes', fullName: 'Elias Mendes', role: 'CEO', isNexo: true, isFounder: true },
    paulo: { id: 'paulo-santafe', name: 'Paulo (Web)', fullName: 'Paulo', role: 'Cliente', isNexo: false },
    superclim: { id: 'SUPERCLIM', name: 'Superclim.es', fullName: 'Superclim.es', role: 'Cliente', isNexo: false },
    nexo: { id: 'NEXO-DIGITAL', name: 'NEXO Digital', fullName: 'NEXO Digital', role: 'Empresa', isNexo: true }
  };

  if (!aliases[key]) return null;
  return { ...aliases[key], isAdmin: false, confidence: 0.9, alias: raw };
}

function resolveAuthor(phoneId) {
  const alias = resolveAuthorAlias(phoneId);
  if (alias) return alias;
  const phone = (phoneId || '').toString();

  if (!global.SCHEMAS || !global.SCHEMAS.contacts || !global.SCHEMAS.contacts.contacts) {
    return {
      id: null,
      name: "Desconhecido",
      fullName: null,
      role: null,
      isNexo: false,
      confidence: 0
    };
  }

  const contacts = global.SCHEMAS.contacts.contacts;
  
  if (contacts[phone]) {
    const c = contacts[phone];
    return {
      id: c.id,
      name: c.displayName || c.name || c.shortName,
      fullName: c.fullName,
      role: c.role,
      isNexo: c.isNexo,
      isFounder: c.isFounder,
      isAdmin: c.isAdmin,
      confidence: 1.0
    };
  }

  const normalized = phone.replace('@c.us', '').replace('+', '');
  for (const [key, c] of Object.entries(contacts)) {
    const keyNorm = key.replace('@c.us', '').replace('+', '');
    if (keyNorm === normalized) {
      return {
        id: c.id,
        name: c.displayName || c.name || c.shortName,
        fullName: c.fullName,
        role: c.role,
        isNexo: c.isNexo,
        isFounder: c.isFounder,
        isAdmin: c.isAdmin,
        confidence: 0.95
      };
    }
  }

  const last8 = normalized.slice(-8);
  for (const [key, c] of Object.entries(contacts)) {
    const keyNorm = key.replace('@c.us', '').replace('+', '');
    if (keyNorm.slice(-8) === last8) {
      return {
        id: c.id,
        name: c.displayName || c.name || c.shortName,
        fullName: c.fullName,
        role: c.role,
        isNexo: c.isNexo,
        isFounder: c.isFounder,
        isAdmin: c.isAdmin,
        confidence: 0.7
      };
    }
  }

  const schemaAlias = resolveAuthorAlias(normalized);
  if (schemaAlias) return schemaAlias;

  return {
    id: null,
    name: "Desconhecido",
    fullName: null,
    role: null,
    isNexo: false,
    confidence: 0,
    unknownPhone: phone
  };
}

// ============================================
// HELPERS BOM-SAFE
// ============================================
function readJSONSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    let raw = fs.readFileSync(file, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.substring(1);
    return JSON.parse(raw);
  } catch (e) {
    console.error('[readJSONSafe] Erro:', e.message);
    return null;
  }
}

function writeJSONSafe(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[writeJSONSafe] Erro:', e.message);
  }
}

class SmartClassifier {
  constructor() {
    // ============================================
    // NEXO v16.0 — CLASSIFICADOR INTELIGENTE
    // Hybrid: Regex Blindado (QI+200) + Context Scoring + Learning
    // ============================================

    // Clientes conhecidos do schema (para detecção de menção)
    this.knownClients = [
      { id: 'paulo-santafe', name: 'Paulo', company: 'SantaFe Construcciones', aliases: ['santafe', 'santa fe', 'paulo', 'construcciones'] },
      { id: 'juan-tropicale', name: 'Juan', company: 'Sorveteria Tropicale', aliases: ['juan', 'tropicale', 'sorveteria', 'heladeria'] },
      { id: 'jess-onadance', name: 'Jess', company: 'Onadance', aliases: ['jess', 'onadance', 'dança'] },
      { id: 'gesse-reformas', name: 'Gesse', company: 'ReformasMachado', aliases: ['gesse', 'reformas', 'machado'] },
      { id: 'lucas-mapio', name: 'Lucas', company: 'Mapio', aliases: ['lucas', 'mapio'] },
      { id: 'irmaos-ccb', name: 'Irmãos CCB', company: 'CCB', aliases: ['ccb', 'irmaos', 'construcao civil'] }
    ];

    // Membros NEXO (para atribuição de tarefas)
    this.nexoMembers = [
      { id: 'nexo-abner-001', name: 'Abner', aliases: ['abner', 'abner gabriel'], role: 'CEO' },
      { id: 'nexo-enoque-001', name: 'Enoque', aliases: ['enoque', 'nonoke', 'e.g.santos'], role: 'CEO' },
      { id: 'nexo-elias-001', name: 'Elias', aliases: ['elias', 'elias mendes'], role: 'CEO' }
    ];

    // Projetos ativos (para detecção de contexto)
    this.activeProjects = [
      { id: 'SANTAFE-CONSTRUCCIONES', name: 'SantaFe Construcciones', aliases: ['santafe', 'site santafe', 'web santafe', 'landing santafe'] },
      { id: 'NEXO-DASHBOARD', name: 'NEXO Dashboard Pro', aliases: ['dashboard', 'nexo dashboard', 'luna', 'agente'] },
      { id: 'TPV-SORVETERIA', name: 'TPV Sorveteria', aliases: ['tpv', 'sorveteria', 'tropicale', 'ponto de venda'] },
      { id: 'BOOL-BILLAR', name: 'Bool/Billar Bool', aliases: ['bool', 'billar', 'sinuca', 'pool'] },
      { id: 'TRUCO-PWA', name: 'Truco PWA', aliases: ['truco', 'cartas', 'jogo'] },
      { id: 'SUPERCLIM', name: 'Superclim.es', aliases: ['superclim', 'limpeza', 'impermeabilizacao'] }
    ];

    // ============================================
    // PATTERNS v16.0 — Regex com Context Scoring
    // Cada pattern tem: regex, peso, categoria, icon, label
    // ============================================
    this.patterns = {
      // TAREFAS REALIZADAS (alta confiança)
      tarefaRealizada: {
        regex: /\b(subi|fiz|pronto|terminado|deploy|enviei|mandei|atualizei|corrigido?|fix|resolvido|concluido|done|finished|complete|merged|push|commit|build ok|ta funcionando|funcionou|deployado|publicado|online|live|ativo)\b/gi,
        weight: 85,
        category: 'tarefaRealizada',
        icon: '✅',
        label: 'Tarefa Realizada',
        priority: 'P2'
      },

      // TAREFAS PENDENTES (alta confiança)
      tarefaPendente: {
        regex: /\b(precisamos|falta|urgente|fazer|implementar|criar|build|desenvolver|corrigir|arrumar|consertar|pendente|todo|falta fazer|tem que|devemos|vamos|precisa|necessario|obrigatorio|deadline|prazo|entrega|terminar|concluir|finalizar)\b/gi,
        weight: 80,
        category: 'tarefaPendente',
        icon: '📋',
        label: 'Tarefa Pendente',
        priority: 'P1'
      },

      // BUG/ERRO (crítico)
      bug: {
        regex: /\b(bug|erro|crash|quebrou|travou|nao funciona|nao ta funcionando|bugado|problema|falha|exception|error|broken|fail|timeout|loop infinito|tela branca|nao carrega)\b/gi,
        weight: 95,
        category: 'bug',
        icon: '🐛',
        label: 'Bug Crítico',
        priority: 'P0'
      },

      // FEEDBACK POSITIVO
      feedbackPositivo: {
        regex: /\b(bonito|gostei|show|top|perfeito|excelente|otimo|genial|massa|legal|bom|boa|incrivel|fantastico|muito bom|ficou otimo|ficou bom|curti|amei|parabens|congrats|nice|great|awesome|love it)\b/gi,
        weight: 40,
        category: 'feedbackPositivo',
        icon: '👍',
        label: 'Feedback Positivo',
        priority: 'P3'
      },

      // FEEDBACK NEGATIVO
      feedbackNegativo: {
        regex: /\b(ruim|nao gostei|errado|horrivel|pessimo|terrivel|nao funciona|bugado|lento|travando|demora|demorado|frustrante|decepcionante|nao serve|inutil|worst|bad|hate|dislike)\b/gi,
        weight: 60,
        category: 'feedbackNegativo',
        icon: '👎',
        label: 'Feedback Negativo',
        priority: 'P2'
      },

      // IDEIA NOVA
      ideiaNova: {
        regex: /\b(que tal|e se|poderiamos|sugestao|ideia|proposta|seria bom|interessante|que acha|o que acha|podemos|vamos fazer|que tal a gente|seria legal|seria otimo|pensando aqui|tive uma ideia|nova funcionalidade|feature|melhoria|upgrade)\b/gi,
        weight: 55,
        category: 'ideiaNova',
        icon: '💡',
        label: 'Ideia Nova',
        priority: 'P2'
      },

      // DECISÃO
      decisao: {
        regex: /\b(vamos|decidimos|ficou acordado|aprovado|confirmado|bora|vai ser|sera|definido|ok|okay|fechado|combinado|decidido|resolvido|aprovamos|confirmamos|vamos com|vamos de|ficou definido|ficou combinado|fechou|ta decidido)\b/gi,
        weight: 70,
        category: 'decisao',
        icon: '📌',
        label: 'Decisão',
        priority: 'P1'
      },

      // FINANCEIRO — PAGAMENTO
      financeiroPagamento: {
        regex: /\b(pagou|pago|recebido|transferencia|deposito|pix|transferiu|pagamento recebido|dinheiro na conta|entrou dinheiro|recebi|recebemos|pagaram)\b/gi,
        weight: 90,
        category: 'financeiro',
        icon: '💰',
        label: 'Pagamento Recebido',
        priority: 'P1'
      },

      // FINANCEIRO — PENDENTE/ATRASADO
      financeiroPendente: {
        regex: /\b(nao pagou|pendente|atrasado|devendo|falta pagar|nao recebi|ainda nao pagou|esta devendo|fatura atrasada|conta atrasada|nao transferiu|esperando pagamento)\b/gi,
        weight: 95,
        category: 'financeiro',
        icon: '⚠️',
        label: 'Pagamento Pendente',
        priority: 'P0'
      },

      // FINANCEIRO — ORÇAMENTO
      financeiroOrcamento: {
        regex: /\b(orcamento|presupuesto|budget|cotacao|proposta comercial|valor|preco|custo|quanto custa|quanto fica|qual o valor|me passa o orcamento|manda o orcamento|precisa de orcamento)\b/gi,
        weight: 85,
        category: 'financeiro',
        icon: '📊',
        label: 'Orçamento',
        priority: 'P0'
      },

      // LEAD QUENTE (alta intenção de compra)
      leadQuente: {
        regex: /\b(quero contratar|quero fechar|vamos fechar|fecha quando|quando começamos|quando podemos começar|ta decidido|vou fechar|vou contratar|manda contrato|manda proposta|quero o site|quero o sistema|quero o app|quando entrega|quanto tempo leva|qual o prazo)\b/gi,
        weight: 95,
        category: 'lead',
        icon: '🔥',
        label: 'Lead Quente',
        priority: 'P0'
      },

      // LEAD MORNO (interesse inicial)
      leadMorno: {
        regex: /\b(interessado|gostaria|queria|preciso de|necessito|estou procurando|vi o trabalho|vi o site|me indicaram|recomendaram|quanto cobra|quanto custa|faz site|faz app|faz sistema|trabalha com|voce faz|faz para|fazemos|orçamento|proposta|preco|valor)\b/gi,
        weight: 65,
        category: 'lead',
        icon: '🎯',
        label: 'Lead Interessado',
        priority: 'P1'
      },

      // LEAD FRIO (só curiosidade)
      leadFrio: {
        regex: /\b(só para saber|so para saber|curiosidade|só uma duvida|so uma duvida|pergunta rapida|rapida pergunta|só confirmar|so confirmar|informacao|mais informacoes|como funciona|o que é|como é)\b/gi,
        weight: 30,
        category: 'lead',
        icon: '❄️',
        label: 'Lead Curioso',
        priority: 'P3'
      },

      // MENÇÃO A PROJETO
      projetoMencionado: {
        regex: /\b(dashboard|nexo dashboard|luna|agente|tpv|sorveteria|bool|billar|sinuca|truco|superclim|santafe|construcciones|onadance|mapio|ccb)\b/gi,
        weight: 45,
        category: 'projeto',
        icon: '🚀',
        label: 'Projeto Mencionado',
        priority: 'P2'
      },

      // LINK COMPARTILHADO
      linkCompartilhado: {
        regex: /(https?:\/\/[^\s]+)/gi,
        weight: 35,
        category: 'link',
        icon: '🔗',
        label: 'Link Compartilhado',
        priority: 'P3'
      },

      // REUNIÃO/AGENDAMENTO
      reuniao: {
        regex: /\b(reuniao|call|video|zoom|meet|teams|ligacao|ligar|marcar|agendar|quarta|quinta|sexta|segunda|terca|amanha|hoje as|as \d{1,2}h|hora marcada|horario)\b/gi,
        weight: 60,
        category: 'reuniao',
        icon: '📅',
        label: 'Reunião/Agendamento',
        priority: 'P2'
      },

      // DOCUMENTO/ARQUIVO
      documento: {
        regex: /\b(pdf|doc|docx|xls|xlsx|csv|json|xml|zip|rar|anexo|arquivo|documento|planilha|contrato|proposta|briefing|especificacao)\b/gi,
        weight: 40,
        category: 'documento',
        icon: '📎',
        label: 'Documento',
        priority: 'P3'
      },

      // URGÊNCIA EXPLÍCITA
      urgencia: {
        regex: /\b(urgente|urgencia|emergencia|critico|critica|grave|importantissimo|muito importante|prioridade maxima|asap|agora|ja|imediatamente|hoje|não pode esperar|não adia)\b/gi,
        weight: 100,
        category: 'urgencia',
        icon: '🚨',
        label: 'Urgência',
        priority: 'P0'
      }
    };

    // ============================================
    // LEARNING ENGINE — Feedback Loop
    // Aprende com correções manuais do dashboard
    // ============================================
    this.learningFile = path.join(__dirname, '..', 'backend', 'data', 'runtime', 'luna-learning.json');
    this.learnedWeights = this.loadLearning();
  }

  // ============================================
  // MÉTODO PRINCIPAL: classify()
  // ============================================
  async classify(msg) {
    const text = (msg.text || msg.body || '').toLowerCase();
    const rawText = msg.text || msg.body || '';
    const author = resolveAuthor(msg.author || msg.from);
    const timestamp = msg.time || msg.timestamp || new Date().toISOString();

    // 1. SCORING POR PATTERN
    const scores = this.calculateScores(text);

    // 2. DETECÇÃO DE ENTIDADES (clientes, projetos, membros)
    const entities = await this.detectEntities(text);

    // 3. DETECÇÃO DE VALOR MONETÁRIO
    const financial = this.extractFinancial(text);

    // 4. DETECÇÃO DE PRAZO/DATA
    const deadline = this.extractDeadline(text);

    // 5. ATRIBUIÇÃO DE TAREFA
    const assignment = this.detectAssignment(text);

    // 6. CÁLCULO DE PRIORIDADE FINAL
    const finalScore = this.calculateFinalScore(scores, entities, financial, author);

    // 7. MONTAR RESULTADO
    const primaryMatch = scores.length > 0 ? scores[0] : null;

    return {
      // Categoria principal
      category: primaryMatch ? primaryMatch.category : 'noticia',
      subCategories: scores.slice(1, 3).map(s => s.category),
      icon: primaryMatch ? primaryMatch.icon : '📰',
      label: primaryMatch ? primaryMatch.label : 'Notícia',
      priority: this.calculatePriorityLabel(finalScore, primaryMatch),
      confidence: primaryMatch ? Math.min(primaryMatch.score / 100, 1) : 0.1,

      // Autor
      author: author,

      // Entidades detectadas
      entities: {
        clients: entities.clients,
        projects: entities.projects,
        members: entities.members,
        urls: entities.urls,
        emails: entities.emails,
        phones: entities.phones
      },
      urls: entities.urls.map(link => link.url || link),

      // Dados de negócio
      business: {
        clientId: entities.clients.length > 0 ? entities.clients[0].id : null,
        clientName: entities.clients.length > 0 ? entities.clients[0].name : null,
        projectId: entities.projects.length > 0 ? entities.projects[0].id : null,
        projectName: entities.projects.length > 0 ? entities.projects[0].name : null,
        assignedTo: assignment.assignedTo,
        assignedToName: assignment.assignedToName,
        deadline: deadline,
        financialValue: financial.value,
        financialCurrency: financial.currency,
        isNewLead: entities.isNewLead,
        leadScore: entities.leadScore,
        lead: entities.lead
      },
      possibleNewClient: entities.lead?.name || null,

      // Conteúdo
      text: rawText,
      cleanText: this.cleanText(text),
      timestamp: timestamp,

      // Métricas
      metrics: {
        wordCount: text.split(/\s+/).length,
        hasQuestion: text.includes('?'),
        hasActionItem: primaryMatch ? ['tarefaRealizada', 'tarefaPendente', 'bug'].includes(primaryMatch.category) : false,
        requiresFollowUp: this.needsFollowUp(primaryMatch, entities),
        urgencyScore: finalScore,
        patternMatches: scores.length
      },

      // Scoring detalhado (para debug/auditoria)
      scoring: {
        totalScore: finalScore,
        patternScores: scores.map(s => ({ category: s.category, score: s.score })),
        entityBonus: entities.bonus,
        financialBonus: financial.bonus,
        authorBonus: author.isFounder ? 10 : 0
      }
    };
  }

  // ============================================
  // SCORING ENGINE
  // ============================================
  calculateScores(text) {
    const scores = [];

    for (const [key, pattern] of Object.entries(this.patterns)) {
      const matches = text.match(pattern.regex);
      if (matches && matches.length > 0) {
        // Score baseado no peso do pattern + número de matches
        let score = pattern.weight;
        score += (matches.length - 1) * 5; // +5 por match adicional

        // Aplicar pesos aprendidos
        if (this.learnedWeights[key]) {
          score *= this.learnedWeights[key].multiplier;
        }

        scores.push({
          category: pattern.category,
          icon: pattern.icon,
          label: pattern.label,
          priority: pattern.priority,
          score: Math.min(score, 150), // Cap em 150
          matches: matches.length,
          pattern: key
        });
      }
    }

    // Ordenar por score decrescente
    return scores.sort((a, b) => b.score - a.score);
  }

  // ============================================
  // DETECÇÃO DE ENTIDADES
  // ============================================
  async detectEntities(text) {
    const result = {
      clients: [],
      projects: [],
      members: [],
      urls: [],
      emails: [],
      phones: [],
      bonus: 0,
      isNewLead: false,
      leadScore: 0,
      lead: null
    };

    // Detectar clientes
    for (const client of this.knownClients) {
      if (client.aliases.some(alias => text.includes(alias))) {
        result.clients.push(client);
        result.bonus += 15;
      }
    }

    // Detectar projetos
    for (const project of this.activeProjects) {
      if (project.aliases.some(alias => text.includes(alias))) {
        result.projects.push(project);
        result.bonus += 10;
      }
    }

    // Detectar membros NEXO
    for (const member of this.nexoMembers) {
      if (member.aliases.some(alias => text.includes(alias))) {
        result.members.push(member);
        result.bonus += 5;
      }
    }

    // Detectar URLs
    const urlMatches = text.match(/(https?:\/\/[^\s]+)/gi);
    if (urlMatches) {
      result.urls = await Promise.all(
        [...new Set(urlMatches.map(url => url.replace(/[.,;!?)]$/, '')))]
          .map(url => this.fetchLinkContext(url))
      );
    }

    // Detectar emails
    const emailMatches = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
    if (emailMatches) result.emails = emailMatches;

    // Detectar telefones
    const phoneMatches = text.match(/(\+?\d{9,15})/g);
    if (phoneMatches) result.phones = phoneMatches;

    // Calcular lead score
    result.leadScore = this.calculateLeadScore(text);
    result.isNewLead = result.leadScore >= 40 && result.clients.length === 0;
    if (result.isNewLead) {
      result.lead = this.buildLeadObject(text, result.leadScore, result.members);
    }

    return result;
  }

  async fetchLinkContext(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'NEXO-Luna/16.0' }
      });
      const contentType = response.headers.get('content-type') || '';
      const type = this.detectLinkType(url, contentType);
      let title = this.defaultLinkTitle(url, type);

      if (contentType.includes('text/html')) {
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch) title = titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 120);
      }

      return { url, title, type, fetchedAt: new Date().toISOString() };
    } catch (e) {
      return {
        url,
        title: 'Titulo nao disponivel',
        type: this.detectLinkType(url, ''),
        fetchedAt: new Date().toISOString(),
        error: e.name === 'AbortError' ? 'timeout' : e.message
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  detectLinkType(url, contentType = '') {
    const lower = (url || '').toLowerCase();
    if (contentType.includes('pdf') || lower.endsWith('.pdf')) return 'PDF';
    if (lower.includes('instagram.com')) return 'Instagram';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube';
    if (lower.includes('drive.google.com')) return 'Google Drive';
    return 'Site';
  }

  defaultLinkTitle(url, type) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return `${type}: ${host}`;
    } catch {
      return 'Titulo nao disponivel';
    }
  }

  buildLeadObject(text, score, members = []) {
    const temperature = score >= 70 ? 'quente' : score >= 50 ? 'morno' : 'frio';
    const nameMatch = text.match(/\b(?:sou|me chamo|meu nome e|aqui e)\s+([a-zA-ZÀ-ÿ]{2,}(?:\s+[a-zA-ZÀ-ÿ]{2,})?)/i);
    const rawName = nameMatch ? nameMatch[1].trim() : '';
    const name = rawName
      .split(/\s+/)
      .filter(part => !/^(quero|preciso|gostaria|busco|orcamento|orçamento|presupuesto)$/i.test(part))
      .join(' ');

    return {
      name: name || 'Lead nao identificado',
      context: text.slice(0, 240),
      temperature,
      detectedBy: members[0]?.name || null,
      detectedAt: new Date().toISOString(),
      status: 'novo',
      priority: temperature === 'quente' ? 'P0' : temperature === 'morno' ? 'P1' : 'P2'
    };
  }

  // ============================================
  // LEAD SCORING
  // ============================================
  calculateLeadScore(text) {
    let score = 0;

    const signals = [
      { keywords: ['orcamento', 'presupuesto', 'budget', 'cotacao', 'proposta', 'valor', 'preco', 'custo'], weight: 25 },
      { keywords: ['prazo', 'quando', 'urgente', 'deadline', 'para quando', 'esta semana', 'proximo mes', 'amanha'], weight: 20 },
      { keywords: ['web', 'site', 'app', 'aplicativo', 'sistema', 'tpv', 'faturacao', 'seo', 'landing page', 'dashboard'], weight: 30 },
      { keywords: ['meu numero', 'meu email', 'whatsapp', 'ligar', 'contactar', 'falar comigo', 'me liga'], weight: 15 },
      { keywords: ['indicou', 'me falou', 'recomendou', 'vi o trabalho', 'vi o site'], weight: 20 }
    ];

    for (const signal of signals) {
      const matched = signal.keywords.filter(k => text.includes(k));
      if (matched.length > 0) {
        score += signal.weight;
      }
    }

    // Bônus por combinação
    if (text.includes('orcamento') && text.includes('site')) score += 15;
    if (text.includes('prazo') && text.includes('quanto')) score += 10;

    return Math.min(score, 100);
  }

  // ============================================
  // EXTRACÃO FINANCEIRA
  // ============================================
  extractFinancial(text) {
    const result = { value: null, currency: 'EUR', bonus: 0 };

    // Detectar valor monetário
    const valueMatch = text.match(/(\d+(?:[.,]\d{2})?)\s*(€|eur|euros?|reais?|rs|\$)/i);
    if (valueMatch) {
      result.value = parseFloat(valueMatch[1].replace(',', '.'));
      result.currency = valueMatch[2].toUpperCase().startsWith('€') ? 'EUR' : 'BRL';
      result.bonus = 20;
    }

    return result;
  }

  // ============================================
  // EXTRACÃO DE PRAZO
  // ============================================
  extractDeadline(text) {
    const patterns = {
      'amanha': this.addDays(1),
      'depois de amanha': this.addDays(2),
      'esta semana': this.addDays(3),
      'proxima semana': this.addDays(7),
      'proximo mes': this.addDays(30),
      'ate sexta': this.getNextFriday(),
      'ate segunda': this.getNextMonday(),
      'hoje': new Date().toISOString().split('T')[0]
    };

    for (const [pattern, date] of Object.entries(patterns)) {
      if (text.includes(pattern)) return date;
    }

    // Detectar data específica (DD/MM ou DD/MM/YYYY)
    const dateMatch = text.match(/(\d{1,2})[\/](\d{1,2})(?:[\/](\d{2,4}))?/);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      const year = dateMatch[3] || new Date().getFullYear();
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  // ============================================
  // ATRIBUIÇÃO DE TAREFA
  // ============================================
  detectAssignment(text) {
    const result = { assignedTo: null, assignedToName: null };

    for (const member of this.nexoMembers) {
      if (member.aliases.some(alias => text.includes(alias))) {
        // Verificar se é atribuição explícita
        const assignmentPatterns = [
          new RegExp(`(${member.aliases.join('|')})\s+(faz|faz a|faz o|faz isso|faz pra|faz para|resolve|resolve o|resolve a|cuida|cuida do|cuida da|pega|pega o|pega a)`, 'i'),
          new RegExp(`(faz|faz a|faz o|resolve|cuida|pega)\s+(${member.aliases.join('|')})`, 'i')
        ];

        if (assignmentPatterns.some(p => p.test(text))) {
          result.assignedTo = member.id;
          result.assignedToName = member.name;
          break;
        }
      }
    }

    return result;
  }

  // ============================================
  // CÁLCULO DE PRIORIDADE FINAL
  // ============================================
  calculateFinalScore(scores, entities, financial, author) {
    let score = 0;

    // Score do pattern principal
    if (scores.length > 0) score += scores[0].score;

    // Bônus de entidades
    score += entities.bonus;

    // Bônus financeiro
    score += financial.bonus;

    // Bônus de fundador
    if (author.isFounder) score += 10;

    // Penalidade por baixa confiança
    if (scores.length > 0 && scores[0].matches === 1) score *= 0.8;

    return Math.min(Math.round(score), 200);
  }

  calculatePriorityLabel(finalScore, primaryMatch) {
    if (finalScore >= 100) return 'P0';
    if (finalScore >= 70) return 'P1';
    if (finalScore >= 40) return 'P2';
    return primaryMatch ? primaryMatch.priority : 'P3';
  }

  needsFollowUp(primaryMatch, entities) {
    if (!primaryMatch) return false;
    if (primaryMatch.category === 'lead' && entities.leadScore >= 50) return true;
    if (primaryMatch.category === 'tarefaPendente' && !entities.members.some(m => m.assigned)) return true;
    if (primaryMatch.category === 'financeiroPendente') return true;
    return false;
  }

  // ============================================
  // LEARNING ENGINE
  // ============================================
  loadLearning() {
    const data = readJSONSafe(this.learningFile);
    if (data && data.weights) {
      console.log('[LEARNING] Pesos carregados:', Object.keys(data.weights).length, 'patterns');
      return data.weights;
    }
    console.log('[LEARNING] Nenhum aprendizado anterior');
    return {};
  }

  saveLearning() {
    const data = { weights: this.learnedWeights, updatedAt: new Date().toISOString() };
    writeJSONSafe(this.learningFile, data);
    console.log('[LEARNING] Aprendizado salvo');
  }

  learnFromCorrection(messageId, correctCategory, previousCategory) {
    // Aumentar peso do pattern correto
    for (const [key, pattern] of Object.entries(this.patterns)) {
      if (pattern.category === correctCategory) {
        if (!this.learnedWeights[key]) {
          this.learnedWeights[key] = { multiplier: 1.0, corrections: 0 };
        }
        this.learnedWeights[key].multiplier += 0.1;
        this.learnedWeights[key].corrections++;
      }
      // Diminuir peso do pattern incorreto
      if (pattern.category === previousCategory) {
        if (!this.learnedWeights[key]) {
          this.learnedWeights[key] = { multiplier: 1.0, corrections: 0 };
        }
        this.learnedWeights[key].multiplier = Math.max(0.5, this.learnedWeights[key].multiplier - 0.05);
      }
    }

    this.saveLearning();
    console.log(`[LEARNING] Correção aprendida: ${previousCategory} → ${correctCategory}`);
  }

  // ============================================
  // HELPERS
  // ============================================
  cleanText(text) {
    return text
      .replace(/[^\w\sáéíóúàèìòùãõâêîôûçÁÉÍÓÚÀÈÌÒÙÃÕÂÊÎÔÛÇ]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  getNextFriday() {
    const d = new Date();
    const day = d.getDay();
    const diff = (5 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  getNextMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = (1 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }
}

function deduplicateMessages(messages) {
  const seen = new Set();
  return messages.filter(m => {
    const key = `${m.id || m.text || ''}:${m.author || ''}:${m.timestamp || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { SmartClassifier, resolveAuthor, deduplicateMessages };
