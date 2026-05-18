// ============================================================
// ACTION EXECUTOR v19.0 — MODO CONCIERGE
// Executa ações no backend NEXO via API REST direta
// Cria tarefas, leads, registra pagamentos/despesas
// ============================================================

const fs = require('fs');
const path = require('path');

class ActionExecutor {
  constructor(config = {}) {
    this.apiBase = config.apiBase || 'http://localhost:3456/api';
    this.apiKey = config.apiKey || null;
    this.timeout = config.timeout || 10000;
    this.dataDir = config.dataDir || path.join(__dirname, '../../backend/data');

    // Cache em memória dos dados
    this.cache = {
      tasks: null,
      leads: null,
      cash: null,
      lastFetch: 0
    };

    // Config de integrações (para flags como ignoreWhatsApp)
    this.integrations = this._loadIntegrationsConfig();
  }

  _loadIntegrationsConfig() {
    try {
      const configPath = path.join(this.dataDir, 'config', 'integrations-config.json');
      if (fs.existsSync(configPath)) {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) {
      console.error('[ActionExecutor] Erro ao ler integrations-config:', e.message);
    }
    return {};
  }

  // ============================================================
  // API PÚBLICA: execute()
  // Recebe ações do IntentParser e executa cada uma
  // ============================================================
  async execute(actions, context = {}) {
    const results = [];
    const authorName = context.authorName || 'Sistema';

    for (const action of actions) {
      try {
        const result = await this.executeSingle(action, authorName);
        results.push({ action, status: 'success', result });
      } catch (err) {
        results.push({ action, status: 'error', error: err.message });
      }
    }

    return {
      allSuccess: results.every(r => r.status === 'success'),
      results,
      summary: this.buildSummary(results)
    };
  }

  async executeSingle(action, authorName) {
    switch (action.type) {
      case 'criar_tarefa':
        return await this.createTask(action.params, authorName);
      case 'criar_lead':
        return await this.createLead(action.params, authorName);
      case 'registrar_pagamento':
        return await this.createPayment(action.params, authorName);
      case 'registrar_pagamento_com_split':
        return await this.createPaymentWithSplit(action.params, authorName);
      case 'registrar_despesa':
        return await this.createExpense(action.params, authorName);
      case 'registrar_despesa_com_split':
        return await this.createExpenseWithSplit(action.params, authorName);
      case 'confirmar_tarefa':
        return await this.completeTask(action.params, authorName);
      case 'adicionar_comentario':
        return await this.addTaskComment(action.params, authorName);
      case 'atualizar_status':
        return await this.updateTaskStatus(action.params, authorName);
      case 'consultar_status':
        return await this.getStatus(action.params);
      case 'consultar_tarefas':
        return await this.queryTasks(action.params);
      case 'consultar_leads':
        return await this.queryLeads(action.params);
      case 'consultar_financeiro':
        return await this.queryFinance(action.params);
      case 'consultar_whatsapp':
        return await this.queryWhatsApp(action.params);
      case 'verificar_mencoes':
        return await this.checkMentions(action.params);
      case 'ideia':
        return await this.saveIdea(action.params, authorName);
      case 'link':
        return await this.saveLink(action.params, authorName);
      default:
        throw new Error(`Ação não suportada: ${action.type}`);
    }
  }

  // ============================================================
  // AÇÕES: Tarefas
  // ============================================================
  async createTask(params, authorName) {
    const title = params.titulo || params.descricao || params.title || 'Tarefa sem título';
    const description = params.descricao || params.description || title;
    // Mapeia P0/P1/P2 para high/medium/low do backend
    const priorityMap = { P0: 'high', P1: 'medium', P2: 'low' };
    const priority = priorityMap[params.prioridade] || params.priority || 'medium';
    const assignedTo = params.responsavel || params.assignedTo || null;
    const addedBy = authorName?.toLowerCase() || 'sistema';

    const task = {
      id: Date.now().toString(),
      title,
      description,
      priority,
      status: 'pending',
      taskType: 'one_time',
      dueDate: null,
      assignedTo,
      addedBy,
      source: 'luna',
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Tentar via API primeiro
    const apiResult = await this.apiPost('/tasks', task);
    if (apiResult && !apiResult.error && !apiResult.success === false) {
      return { type: 'task', id: task.id, title, assignedTo, source: 'api' };
    }

    // Fallback: salvar direto no JSON
    const tasksFile = path.join(this.dataDir, 'tasks.json');
    const tasks = this.readJson(tasksFile, []);
    tasks.push(task);
    this.writeJson(tasksFile, tasks);
    // Broadcast para atualizar o dashboard
    try {
      if (global.broadcast) global.broadcast({ type: 'tasks', data: tasks });
    } catch {}

    return { type: 'task', id: task.id, title, assignedTo, source: 'file' };
  }

  async completeTask(params, authorName) {
    const titulo = params.titulo || '';

    // Buscar tarefa similar
    const tasksFile = path.join(this.dataDir, 'tasks.json');
    const tasks = this.readJson(tasksFile, []);

    // Procura por similaridade no título
    const match = tasks.find(t => {
      const taskTitle = (t.titulo || t.body || '').toLowerCase();
      const searchTitle = titulo.toLowerCase();
      return taskTitle.includes(searchTitle) || searchTitle.includes(taskTitle.slice(0, 30));
    });

    if (match) {
      match.status = 'concluida';
      match.dataConclusao = new Date().toISOString();
      match.concluidoPor = authorName;
      this.writeJson(tasksFile, tasks);
      return { type: 'task_done', id: match.id, titulo: match.titulo, source: 'file' };
    }

    // Se não achou, cria como tarefa concluída
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      titulo,
      status: 'concluida',
      responsavel: authorName,
      criadoPor: authorName,
      dataCriacao: new Date().toISOString(),
      dataConclusao: new Date().toISOString(),
      concluidoPor: authorName,
      origem: 'whatsapp_luna'
    };
    tasks.push(task);
    this.writeJson(tasksFile, tasks);

    return { type: 'task_done', id: task.id, titulo, source: 'file_created' };
  }

  async addTaskComment(params, authorName) {
    const taskTitle = params.taskTitle || '';
    const commentText = params.commentText || '';

    const tasksFile = path.join(this.dataDir, 'tasks.json');
    const tasks = this.readJson(tasksFile, []);

    const match = tasks.find(t => {
      const tTitle = (t.titulo || t.title || t.body || '').toLowerCase();
      const searchTitle = taskTitle.toLowerCase();
      return tTitle.includes(searchTitle) || searchTitle.includes(tTitle.slice(0, 30));
    });

    if (!match) {
      throw new Error(`Tarefa "${taskTitle}" não encontrada`);
    }

    const comment = {
      text: commentText,
      author: authorName,
      createdAt: new Date().toISOString()
    };

    const apiResult = await this.apiPost(`/tasks/${match.id}/comments`, comment);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'comment', taskId: match.id, taskTitle: match.title || match.titulo, text: commentText, source: 'api' };
    }

    match.comments = match.comments || [];
    match.comments.push(comment);
    match.updatedAt = new Date().toISOString();
    this.writeJson(tasksFile, tasks);

    return { type: 'comment', taskId: match.id, taskTitle: match.title || match.titulo, text: commentText, source: 'file' };
  }

  async updateTaskStatus(params, authorName) {
    const taskTitle = params.taskTitle || '';
    const status = params.status || 'pending';

    const tasksFile = path.join(this.dataDir, 'tasks.json');
    const tasks = this.readJson(tasksFile, []);

    const match = tasks.find(t => {
      const tTitle = (t.titulo || t.title || t.body || '').toLowerCase();
      const searchTitle = taskTitle.toLowerCase();
      return tTitle.includes(searchTitle) || searchTitle.includes(tTitle.slice(0, 30));
    });

    if (!match) {
      throw new Error(`Tarefa "${taskTitle}" não encontrada`);
    }

    const apiResult = await this.apiPut(`/tasks/${match.id}`, { status });
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'status_update', taskId: match.id, taskTitle: match.title || match.titulo, status, source: 'api' };
    }

    match.status = status;
    if (status === 'in_progress' && !match.startedAt) {
      match.startedAt = new Date().toISOString();
    }
    if (status === 'completed' && !match.completedAt) {
      match.completedAt = new Date().toISOString();
    }
    match.updatedAt = new Date().toISOString();
    this.writeJson(tasksFile, tasks);

    return { type: 'status_update', taskId: match.id, taskTitle: match.title || match.titulo, status, source: 'file' };
  }

  // ============================================================
  // AÇÕES: Leads
  // ============================================================
  async createLead(params, authorName) {
    const displayName = params.nome || params.cliente || params.displayName || 'Lead não identificado';
    const notes = params.contexto || params.descricao || params.notes || `Lead registrado por ${authorName}`;
    const phone = params.telefone || params.phone || '';
    const email = params.email || '';

    const lead = {
      displayName,
      email,
      phone,
      source: 'luna',
      notes,
      assignedTo: params.assignedTo || null,
      tags: []
    };

    const apiResult = await this.apiPost('/leads', lead);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'lead', id: apiResult.lead?.id || apiResult.id, displayName, source: 'api' };
    }

    // Fallback: salvar no clients-registry
    const clientsFile = path.join(this.dataDir, 'clients-registry.json');
    const registry = this.readJson(clientsFile, { clients: {}, schema: { version: '16.1.0' } });
    const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    registry.clients[id] = {
      displayName,
      email,
      phone,
      source: 'luna',
      type: 'lead',
      status: 'potencial',
      pipelineStatus: 'novo',
      estimatedValue: 0,
      currency: 'EUR',
      notes,
      assignedTo: params.assignedTo || null,
      tags: [],
      createdAt: new Date().toISOString()
    };
    this.writeJson(clientsFile, registry);

    return { type: 'lead', id, displayName, source: 'file' };
  }

  // ============================================================
  // AÇÕES: Financeiro
  // ============================================================
  async createPayment(params, authorName) {
    const amount = parseFloat(params.valor) || 0;
    const de = params.de || params.cliente || params.from || 'Não identificado';
    const description = params.descricao || params.description || `Pagamento de ${de}`;

    if (amount <= 0) throw new Error('Valor do pagamento inválido');

    const entry = {
      amount,
      description,
      date: new Date().toISOString().slice(0, 10),
      source: de,
      category: 'receita',
      note: `Registrado por ${authorName} via Luna`,
      applyImmediately: true,
      recordedBy: authorName
    };

    const apiResult = await this.apiPost('/cash-box/payments', entry);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'payment', id: apiResult.entry?.id || apiResult.id, amount, de, source: 'api' };
    }

    // Fallback manual com distribuição 4-way
    const cashFile = path.join(this.dataDir, 'cash-box.json');
    const cash = this.readJson(cashFile, { balance: { value: 0, currency: 'EUR' }, history: [] });
    const oldBalance = parseFloat((cash.balance?.value || 0).toFixed(2));
    const newBalance = parseFloat((oldBalance + amount).toFixed(2));
    const id = `etx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    cash.balance = { value: newBalance, currency: 'EUR' };
    cash.history = cash.history || [];
    const share = parseFloat((amount * 0.25).toFixed(2));
    const now = new Date().toISOString();
    cash.history.push({
      id,
      date: new Date().toISOString().slice(0, 10),
      type: 'payment_received',
      amount,
      source: de,
      description,
      balanceAfter: newBalance,
      recordedBy: authorName,
      recordedAt: now,
      applyImmediately: true,
      distribution: [
        { recipient: 'Abner', amount: share, type: 'founder_share' },
        { recipient: 'Nonoke', amount: share, type: 'founder_share' },
        { recipient: 'Elias', amount: share, type: 'founder_share' },
        { recipient: 'NEXO Digital', amount: share, type: 'reinvestment' }
      ]
    });
    this.writeJson(cashFile, cash);

    return { type: 'payment', id, amount, de, source: 'file' };
  }

  async createExpense(params, authorName) {
    const amount = parseFloat(params.valor) || 0;
    const para = params.para || params.descricao || params.description || params.to || 'Despesa';
    const description = params.descricao || params.description || para;

    if (amount <= 0) throw new Error('Valor da despesa inválido');

    const entry = {
      type: 'expense',
      amount,
      description,
      date: new Date().toISOString().slice(0, 10),
      category: 'despesa',
      note: `Registrado por ${authorName} via Luna`,
      recordedBy: authorName
    };

    const apiResult = await this.apiPost('/cash-box/entries', entry);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'expense', id: apiResult.entry?.id || apiResult.id, amount, para, source: 'api' };
    }

    // Fallback manual
    const cashFile = path.join(this.dataDir, 'cash-box.json');
    const cash = this.readJson(cashFile, { balance: { value: 0, currency: 'EUR' }, history: [] });
    const oldBalance = parseFloat((cash.balance?.value || 0).toFixed(2));
    const newBalance = parseFloat((oldBalance - amount).toFixed(2));
    const id = `etx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    cash.balance = { value: newBalance, currency: 'EUR' };
    cash.history = cash.history || [];
    cash.history.push({
      id,
      date: new Date().toISOString().slice(0, 10),
      type: 'expense',
      amount,
      source: para,
      description,
      balanceAfter: newBalance,
      recordedBy: authorName,
      recordedAt: new Date().toISOString()
    });
    this.writeJson(cashFile, cash);

    return { type: 'expense', id, amount, para, source: 'file' };
  }

  // ============================================================
  // AÇÕES: Ideias e Links (low-risk, auto-save)
  // ============================================================
  async saveIdea(params, authorName) {
    const texto = params.texto || params.descricao || 'Ideia';

    const idea = {
      id: `idea_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      body: texto,
      author: authorName,
      time: new Date().toISOString(),
      origem: 'whatsapp_luna'
    };

    const ideasFile = path.join(this.dataDir, 'ideas.json');
    const ideas = this.readJson(ideasFile, []);
    ideas.push(idea);
    this.writeJson(ideasFile, ideas);

    return { type: 'idea', id: idea.id, texto, source: 'file' };
  }

  async saveLink(params, authorName) {
    const url = params.url || '';
    const contexto = params.contexto || params.descricao || '';

    if (!url) throw new Error('URL não fornecida');

    const link = {
      id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      url,
      context: contexto,
      author: authorName,
      time: new Date().toISOString(),
      origem: 'whatsapp_luna'
    };

    const linksFile = path.join(this.dataDir, 'links.json');
    const links = this.readJson(linksFile, []);
    links.push(link);
    this.writeJson(linksFile, links);

    return { type: 'link', id: link.id, url, source: 'file' };
  }

  // ============================================================
  // AÇÕES: Status/Consulta
  // ============================================================
  async getStatus(params) {
    const filtro = params.filtro || 'geral';

    const tasksFile = path.join(this.dataDir, 'tasks.json');
    const clientsFile = path.join(this.dataDir, 'clients-registry.json');
    const cashFile = path.join(this.dataDir, 'cash-box.json');

    const tasks = this.readJson(tasksFile, []);
    const clientsRegistry = this.readJson(clientsFile, { clients: {} });
    const leads = Object.values(clientsRegistry.clients || {}).filter(c => c.type === 'lead' || c.status === 'potencial');
    const cash = this.readJson(cashFile, { balance: { value: 0, currency: 'EUR' }, history: [] });

    const pendentes = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    const p0 = pendentes.filter(t => (t.priority || '').toLowerCase() === 'high' || (t.prioridade || '').toUpperCase() === 'P0');
    const p1 = pendentes.filter(t => (t.priority || '').toLowerCase() === 'medium' || (t.prioridade || '').toUpperCase() === 'P1');

    const saldo = cash.balance?.value || 0;

    return {
      type: 'status',
      filtro,
      tarefas: { total: tasks.length, pendentes: pendentes.length, p0: p0.length, p1: p1.length },
      leads: { total: leads.length, novos: leads.filter(l => l.pipelineStatus === 'novo' || l.status === 'novo').length },
      financeiro: { saldo }
    };
  }

  // ============================================================
  // AÇÕES: Consultas avançadas (Consciência do Dashboard)
  // ============================================================
  async queryTasks(params) {
    const tasksFile = path.join(this.dataDir, 'tasks.json');
    const companyTasksFile = path.join(this.dataDir, 'company-tasks.json');
    const tasks = this.readJson(tasksFile, []);
    const companyTasksRaw = this.readJson(companyTasksFile, {});
    const companyTasks = Array.isArray(companyTasksRaw) ? companyTasksRaw : Object.values(companyTasksRaw.categories || {}).flatMap(c => c.tasks || []);
    const all = [...tasks, ...companyTasks];
    const filtro = params.filtro || 'pendentes';

    let result = all;
    if (filtro === 'pendentes') result = all.filter(t => t.status !== 'completed' && t.status !== 'done' && !t.completed);
    if (filtro === 'p0') result = all.filter(t => (t.priority === 'P0' || t.priority === 'high' || t.prioridade === 'P0'));
    if (filtro === 'hoje') {
      const today = new Date().toISOString().slice(0, 10);
      result = all.filter(t => t.dueDate && t.dueDate.startsWith(today));
    }

    return {
      type: 'tasks',
      filtro,
      total: result.length,
      items: result.slice(0, 10).map(t => ({
        id: t.id,
        title: t.title || t.titulo || 'Sem título',
        priority: t.priority || t.prioridade || 'P2',
        status: t.status || 'pending',
        assignedTo: t.assignedTo || t.responsavel || null
      }))
    };
  }

  async queryLeads(params) {
    const clientsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
    const clients = this.readJson(clientsFile, { clients: {} });
    const all = Object.values(clients.clients || {});
    const leads = all.filter(c => c.type === 'lead' || c.status === 'potencial' || c.pipelineStatus);
    const filtro = params.filtro || 'todos';

    let result = leads;
    if (filtro === 'novos') result = leads.filter(l => l.pipelineStatus === 'novo' || l.status === 'novo');
    if (filtro === 'proposta') result = leads.filter(l => l.pipelineStatus === 'proposta' || l.status === 'proposta');

    return {
      type: 'leads',
      filtro,
      total: result.length,
      items: result.slice(0, 10).map(l => ({
        id: l.id,
        name: l.name || l.nome || 'Lead',
        pipelineStatus: l.pipelineStatus || l.status || 'novo'
      }))
    };
  }

  async queryFinance(params) {
    const cashFile = path.join(this.dataDir, 'cash-box.json');
    const paymentsFile = path.join(this.dataDir, 'payments.json');
    const expensesFile = path.join(this.dataDir, 'expenses.json');

    const cash = this.readJson(cashFile, { balance: { value: 0 }, history: [] });
    const payments = this.readJson(paymentsFile, []);
    const expenses = this.readJson(expensesFile, []);

    const pendingPayments = payments.filter(p => p.status !== 'paid' && p.status !== 'received');
    const totalPending = pendingPayments.reduce((s, p) => s + parseFloat(p.totalAmount || p.amount || 0), 0);

    const today = new Date();
    const monthPrefix = today.toISOString().slice(0, 7);
    const monthlyExpenses = expenses.filter(e => {
      const d = e.date || e.createdAt || '';
      return d.startsWith(monthPrefix);
    });
    const totalExpenses = monthlyExpenses.reduce((s, e) => s + parseFloat(e.amount || e.valor || 0), 0);

    return {
      type: 'finance',
      caixa: cash.balance?.value || 0,
      recebimentosPendentes: totalPending,
      clientesPendentes: pendingPayments.length,
      gastosMes: totalExpenses,
      transacoes: cash.history?.slice(-5).map(h => ({
        type: h.type,
        amount: h.amount,
        description: h.description || h.note || ''
      })) || []
    };
  }

  async queryWhatsApp(params) {
    const wcfg = this.integrations.whatsapp || {};
    const ignoreAll = wcfg.ignored === true;
    const ignoreMessages = wcfg.ignoreMessages !== false;
    const ignoreLinks = wcfg.ignoreLinks === true;
    const ignoreMentions = wcfg.ignoreMentions === true;

    if (ignoreAll) {
      return { type: 'whatsapp', ignored: true, mensagensNovas: 0, linksPendentes: 0, mencoesTotais: 0, mencoesPendentes: 0, mencoesRecentes: [] };
    }

    const bufferFile = path.join(this.dataDir, 'luna-buffer.json');
    const historyFile = path.join(this.dataDir, 'whatsapp-history.json');
    const buffer = this.readJson(bufferFile, { newMessages: [], newLinks: [], mentions: [] });
    const history = this.readJson(historyFile, []);

    const mentions = history.filter(m => /@(?:LUNA|KIMI|KIMICLAW)/i.test(m.body || m.text || ''));
    const pendingMentions = mentions.filter(m => !m.responded);

    return {
      type: 'whatsapp',
      mensagensNovas: ignoreMessages ? 0 : (buffer.newMessages?.length || 0),
      linksPendentes: ignoreLinks ? 0 : (buffer.newLinks?.length || 0),
      mencoesTotais: ignoreMentions ? 0 : mentions.length,
      mencoesPendentes: ignoreMentions ? 0 : pendingMentions.length,
      mencoesRecentes: ignoreMentions ? [] : pendingMentions.slice(0, 5).map(m => ({
        from: m.author || m.from || 'Desconhecido',
        text: (m.body || m.text || '').slice(0, 100)
      }))
    };
  }

  async checkMentions(params) {
    const wcfg = this.integrations.whatsapp || {};
    if (wcfg.ignored === true) {
      return { type: 'whatsapp', ignored: true, mensagensNovas: 0, linksPendentes: 0, mencoesTotais: 0, mencoesPendentes: 0, mencoesRecentes: [] };
    }
    return await this.queryWhatsApp(params);
  }

  // ============================================================
  // AÇÕES: Financeiro Avançado (Split Automático)
  // ============================================================
  async createPaymentWithSplit(params, authorName) {
    const amount = parseFloat(params.valor) || 0;
    const client = params.de || params.cliente || params.from || 'Cliente';
    const description = params.descricao || `Pagamento de ${client}`;
    if (amount <= 0) throw new Error('Valor inválido');

    const entry = {
      amount,
      description,
      source: client,
      date: new Date().toISOString().slice(0, 10),
      applyImmediately: true,
      note: `Registrado por ${authorName} via Luna (com split automático)`
    };

    const apiResult = await this.apiPost('/cash-box/payments', entry);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'payment_split', amount, client, applied: true, source: 'api', id: apiResult.id || apiResult.entry?.id };
    }

    // Fallback: escreve no cash-box.json manualmente com split
    const cashFile = path.join(this.dataDir, 'cash-box.json');
    const cash = this.readJson(cashFile, { balance: { value: 0 }, history: [] });
    const share = parseFloat((amount / 4).toFixed(2));
    const remaining = parseFloat((amount - share * 3).toFixed(2));

    cash.balance.value = parseFloat(((cash.balance?.value || 0) + remaining).toFixed(2));
    cash.history.push({
      type: 'payment_received',
      amount,
      description: `${description} (split 25%)`,
      date: new Date().toISOString(),
      recordedBy: authorName,
      distribution: [
        { recipient: 'Abner', amount: share, type: 'founder_share' },
        { recipient: 'Nonoke', amount: share, type: 'founder_share' },
        { recipient: 'Elias', amount: share, type: 'founder_share' },
        { recipient: 'NEXO Digital', amount: remaining, type: 'reinvestment' }
      ]
    });
    this.writeJson(cashFile, cash);

    return { type: 'payment_split', amount, client, applied: true, source: 'file', splits: { abner: share, nonoke: share, elias: share, empresa: remaining } };
  }

  async createExpenseWithSplit(params, authorName) {
    const amount = parseFloat(params.valor) || 0;
    const description = params.descricao || params.para || 'Despesa';
    const splitAmong = params.splitAmong || ['abner', 'nonoke', 'elias'];
    if (amount <= 0) throw new Error('Valor inválido');

    const entry = {
      name: description,
      amount,
      description,
      date: new Date().toISOString().slice(0, 10),
      type: 'one_time',
      splitAmong,
      paidBy: {},
      autoDeductFromCashBox: true,
      note: `Registrado por ${authorName} via Luna`
    };

    splitAmong.forEach(pid => {
      entry.paidBy[pid] = { paid: false, amount: parseFloat((amount / splitAmong.length).toFixed(2)), paidAt: null, method: null };
    });

    const apiResult = await this.apiPost('/expenses', entry);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'expense_split', amount, description, splitAmong, source: 'api', id: apiResult.id || apiResult.expense?.id };
    }

    // Fallback: cash-box.json
    const cashFile = path.join(this.dataDir, 'cash-box.json');
    const cash = this.readJson(cashFile, { balance: { value: 0 }, history: [] });
    cash.balance.value = parseFloat(((cash.balance?.value || 0) - amount).toFixed(2));
    cash.history.push({
      type: 'expense',
      amount,
      description: `${description} (split entre ${splitAmong.join(', ')})`,
      date: new Date().toISOString(),
      recordedBy: authorName
    });
    this.writeJson(cashFile, cash);

    return { type: 'expense_split', amount, description, splitAmong, source: 'file' };
  }

  // ============================================================
  // API HELPERS
  // ============================================================
  async apiPost(endpoint, data) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const fetchPromise = fetch(`${this.apiBase}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), this.timeout)
      );

      const res = await Promise.race([fetchPromise, timeoutPromise]);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { error: `HTTP ${res.status}: ${text}` };
      }

      return await res.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  async apiGet(endpoint) {
    try {
      const headers = {};
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const fetchPromise = fetch(`${this.apiBase}${endpoint}`, { headers });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), this.timeout)
      );

      const res = await Promise.race([fetchPromise, timeoutPromise]);

      if (!res.ok) return { error: `HTTP ${res.status}` };
      return await res.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  async apiPut(endpoint, data) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const fetchPromise = fetch(`${this.apiBase}${endpoint}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), this.timeout)
      );

      const res = await Promise.race([fetchPromise, timeoutPromise]);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { error: `HTTP ${res.status}: ${text}` };
      }

      return await res.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  // ============================================================
  // FILE HELPERS
  // ============================================================
  readJson(filePath, defaultValue = []) {
    try {
      if (!fs.existsSync(filePath)) return defaultValue;
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.trim()) return defaultValue;
      return JSON.parse(content);
    } catch {
      return defaultValue;
    }
  }

  writeJson(filePath, data) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error(`[ActionExecutor] Erro ao salvar ${filePath}:`, err.message);
    }
  }

  // ============================================================
  // SUMMARY BUILDER
  // ============================================================
  buildSummary(results) {
    const parts = [];
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    for (const r of results) {
      if (r.status !== 'success') continue;
      const res = r.result;
      switch (res.type) {
        case 'task':
          parts.push(`tarefa "${res.title || res.titulo}"`);
          break;
        case 'task_done':
          parts.push(`tarefa "${res.title || res.titulo}" como concluída`);
          break;
        case 'lead':
          parts.push(`lead "${res.displayName || res.nome}"`);
          break;
        case 'payment':
          parts.push(`pagamento de €${res.amount || res.valor} de ${res.de || res.from || 'cliente'}`);
          break;
        case 'expense':
          parts.push(`despesa de €${res.amount || res.valor} para ${res.para || res.to || 'fornecedor'}`);
          break;
        case 'idea':
          parts.push(`ideia anotada`);
          break;
        case 'link':
          parts.push(`link salvo`);
          break;
        case 'comment':
          parts.push(`comentário na tarefa "${res.taskTitle || res.title || res.titulo}"`);
          break;
        case 'status_update':
          parts.push(`status da tarefa "${res.taskTitle || res.title || res.titulo}" atualizado para ${res.status}`);
          break;
      }
    }

    return {
      text: parts.length > 0 ? parts.join(', ') : 'Nenhuma ação executada',
      successCount,
      errorCount,
      total: results.length
    };
  }
}

module.exports = { ActionExecutor };
