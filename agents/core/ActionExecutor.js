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
      case 'excluir_tarefa':
        return await this.deleteTask(action.params, authorName);
      case 'excluir_pagamento':
        return await this.deletePayment(action.params, authorName);
      case 'excluir_despesa':
        return await this.deleteExpense(action.params, authorName);
      case 'excluir_lead':
        return await this.deleteLead(action.params, authorName);
      case 'consultar_emails':
        return await this.queryEmails(action.params);
      case 'atualizar_tarefa':
        return await this.updateTask(action.params, authorName);
      case 'listar_clientes':
        return await this.listClients(action.params);
      case 'criar_cliente':
        return await this.createClient(action.params, authorName);
      case 'atualizar_cliente':
        return await this.updateClient(action.params, authorName);
      case 'excluir_cliente':
        return await this.deleteClient(action.params, authorName);
      case 'listar_projetos':
        return await this.listProjects(action.params);
      case 'atualizar_lead':
        return await this.updateLead(action.params, authorName);
      case 'converter_lead':
        return await this.convertLead(action.params, authorName);
      case 'consultar_caixa':
        return await this.queryCashBox(action.params);
      case 'criar_ideia':
        return await this.createIdea(action.params, authorName);
      case 'listar_ideias':
        return await this.listIdeas(action.params);
      case 'atualizar_ideia':
        return await this.updateIdea(action.params, authorName);
      case 'excluir_ideia':
        return await this.deleteIdea(action.params, authorName);
      case 'converter_ideia_em_tarefa':
        return await this.convertIdeaToTask(action.params, authorName);
      case 'enviar_mensagem_whatsapp':
        return await this.sendWhatsAppMessage(action.params, authorName);
      case 'listar_emails':
        return await this.listEmails(action.params);
      case 'ler_email':
        return await this.readEmail(action.params);
      case 'criar_orcamento':
        return await this.createQuote(action.params, authorName);
      case 'atualizar_orcamento':
        return await this.updateQuote(action.params, authorName);
      case 'deletar_orcamento':
        return await this.deleteQuote(action.params, authorName);
      case 'listar_orcamentos':
        return await this.listQuotes(action.params);
      case 'criar_projeto':
        return await this.createProject(action.params, authorName);
      case 'atualizar_projeto':
        return await this.updateProject(action.params, authorName);
      case 'adicionar_cliente_workspace':
        return await this.addWorkspaceClient(action.params, authorName);
      case 'atualizar_cliente_workspace':
        return await this.updateWorkspaceClient(action.params, authorName);
      case 'enviar_email':
        return await this.sendEmail(action.params, authorName);
      case 'responder_email':
        return await this.replyEmail(action.params, authorName);
      case 'gerar_rascunho_email':
        return await this.draftEmail(action.params, authorName);
      case 'controlar_servico':
        return await this.controlService(action.params);
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

    // Fallback: salvar no clients-registry (schema dir)
    const clientsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
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
      const entryData = apiResult.entry || {};
      const dist = entryData.distribution || {};
      const splits = {};
      if (dist.splits && Array.isArray(dist.splits)) {
        dist.splits.forEach(s => {
          let key = s.recipientId;
          if (key === 'nexo-digital') key = 'empresa';
          else if (key === 'nexo-abner-001') key = 'abner';
          else if (key === 'nexo-enoque-001') key = 'nonoke';
          else if (key === 'nexo-elias-pessoal') key = 'elias';
          if (key) splits[key] = s.amount;
        });
      }
      return {
        type: 'payment',
        id: entryData.id || apiResult.id,
        amount,
        de,
        source: 'api',
        splits: Object.keys(splits).length > 0 ? splits : undefined
      };
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

    return {
      type: 'payment',
      id,
      amount,
      de,
      source: 'file',
      splits: { abner: share, nonoke: share, elias: share, empresa: share }
    };
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
  // AÇÕES: Destrutivas (Delete)
  // ============================================================
  async deleteTask(params, authorName) {
    const titulo = params.titulo || params.id || '';
    if (!titulo) throw new Error('Informe a tarefa para excluir');

    const tasksFile = path.join(this.dataDir, 'tasks.json');
    const tasks = this.readJson(tasksFile, []);

    const idx = tasks.findIndex(t => {
      if (params.id && t.id === params.id) return true;
      const taskTitle = (t.titulo || t.title || '').toLowerCase();
      const searchTitle = titulo.toLowerCase();
      return taskTitle.includes(searchTitle) || searchTitle.includes(taskTitle.slice(0, 30));
    });

    if (idx === -1) throw new Error(`Tarefa "${titulo}" não encontrada`);

    const removed = tasks.splice(idx, 1)[0];
    this.writeJson(tasksFile, tasks);

    return { type: 'task_deleted', id: removed.id, titulo: removed.title || removed.titulo, source: 'file' };
  }

  async deletePayment(params, authorName) {
    const search = params.id || params.de || params.cliente || '';
    if (!search) throw new Error('Informe o pagamento para excluir');

    const cashFile = path.join(this.dataDir, 'cash-box.json');
    const cash = this.readJson(cashFile, { balance: { value: 0, currency: 'EUR' }, history: [] });

    const idx = cash.history.findIndex(h => {
      if (h.id === search) return true;
      const src = (h.source || h.description || '').toLowerCase();
      return src.includes(search.toLowerCase());
    });

    if (idx === -1) throw new Error(`Pagamento "${search}" não encontrado`);

    const removed = cash.history.splice(idx, 1)[0];
    // Reverte o saldo
    if (removed.type === 'payment_received') {
      cash.balance.value = parseFloat(((cash.balance?.value || 0) - removed.amount).toFixed(2));
    }
    this.writeJson(cashFile, cash);

    return { type: 'payment_deleted', id: removed.id, amount: removed.amount, source: 'file' };
  }

  async deleteExpense(params, authorName) {
    const search = params.id || params.para || params.descricao || '';
    if (!search) throw new Error('Informe a despesa para excluir');

    const cashFile = path.join(this.dataDir, 'cash-box.json');
    const cash = this.readJson(cashFile, { balance: { value: 0, currency: 'EUR' }, history: [] });

    const idx = cash.history.findIndex(h => {
      if (h.id === search) return true;
      const src = (h.source || h.description || '').toLowerCase();
      return src.includes(search.toLowerCase());
    });

    if (idx === -1) throw new Error(`Despesa "${search}" não encontrada`);

    const removed = cash.history.splice(idx, 1)[0];
    // Reverte o saldo
    if (removed.type === 'expense') {
      cash.balance.value = parseFloat(((cash.balance?.value || 0) + removed.amount).toFixed(2));
    }
    this.writeJson(cashFile, cash);

    return { type: 'expense_deleted', id: removed.id, amount: removed.amount, source: 'file' };
  }

  async deleteLead(params, authorName) {
    const search = params.nome || params.id || '';
    if (!search) throw new Error('Informe o lead para excluir');

    const clientsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
    const registry = this.readJson(clientsFile, { clients: {}, schema: { version: '16.1.0' } });

    const idToDelete = Object.keys(registry.clients || {}).find(id => {
      if (id === search) return true;
      const c = registry.clients[id];
      const name = (c.displayName || c.name || '').toLowerCase();
      return name.includes(search.toLowerCase());
    });

    if (!idToDelete) throw new Error(`Lead "${search}" não encontrado`);

    const removed = registry.clients[idToDelete];
    delete registry.clients[idToDelete];
    this.writeJson(clientsFile, registry);

    return { type: 'lead_deleted', id: idToDelete, nome: removed.displayName || removed.name, source: 'file' };
  }

  async queryEmails(params) {
    const apiResult = await this.apiGet('/email/messages?maxResults=10');
    if (apiResult && !apiResult.error && Array.isArray(apiResult.messages)) {
      const unread = apiResult.messages.filter(m => !m.read);
      return {
        type: 'emails',
        filtro: params.filtro || 'todos',
        total: apiResult.messages.length,
        naoLidos: unread.length,
        items: apiResult.messages.slice(0, 5).map(m => ({
          id: m.id,
          subject: m.subject || '(sem assunto)',
          from: m.from || 'Desconhecido',
          snippet: m.snippet || m.body?.slice(0, 100) || '',
          unread: !m.read
        }))
      };
    }

    // Fallback: retorna vazio se API falhar
    return { type: 'emails', filtro: params.filtro || 'todos', total: 0, naoLidos: 0, items: [], source: 'fallback' };
  }

  // ============================================================
  // AÇÕES: Status/Consulta
  // ============================================================
  async getStatus(params) {
    const filtro = params.filtro || 'geral';

    const tasksFile = path.join(this.dataDir, 'tasks.json');
    const clientsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
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
      const entryData = apiResult.entry || {};
      const dist = entryData.distribution || {};
      const splits = {};
      if (dist.splits && Array.isArray(dist.splits)) {
        dist.splits.forEach(s => {
          let key = s.recipientId;
          if (key === 'nexo-digital') key = 'empresa';
          else if (key === 'nexo-abner-001') key = 'abner';
          else if (key === 'nexo-enoque-001') key = 'nonoke';
          else if (key === 'nexo-elias-pessoal') key = 'elias';
          if (key) splits[key] = s.amount;
        });
      }
      return {
        type: 'payment_split',
        amount,
        client,
        applied: true,
        source: 'api',
        id: entryData.id || apiResult.id,
        splits: Object.keys(splits).length > 0 ? splits : undefined
      };
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

  async apiDelete(endpoint) {
    try {
      const headers = {};
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const fetchPromise = fetch(`${this.apiBase}${endpoint}`, { method: 'DELETE', headers });
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

  // ============================================================
  // AÇÕES EXPANDIDAS: Tarefas
  // ============================================================
  async updateTask(params, authorName) {
    const id = params.id;
    const titulo = params.titulo || params.title;
    if (!id && !titulo) throw new Error('ID ou título da tarefa necessário');

    const tasksFile = path.join(this.dataDir, 'tasks.json');
    const tasks = this.readJson(tasksFile, []);
    let task = tasks.find(t => t.id === id);
    if (!task && titulo) task = tasks.find(t => (t.title || t.titulo || '').toLowerCase().includes(titulo.toLowerCase()));
    if (!task) throw new Error('Tarefa não encontrada');

    if (params.titulo || params.title) task.title = params.titulo || params.title;
    if (params.descricao || params.description) task.description = params.descricao || params.description;
    if (params.prioridade || params.priority) {
      const priorityMap = { P0: 'high', P1: 'medium', P2: 'low' };
      task.priority = priorityMap[params.prioridade] || params.priority || task.priority;
    }
    if (params.responsavel || params.assignedTo !== undefined) task.assignedTo = params.responsavel || params.assignedTo;
    if (params.prazo || params.dueDate) task.dueDate = params.prazo || params.dueDate;
    if (params.status) task.status = params.status;
    task.updatedAt = new Date().toISOString();

    const apiResult = await this.apiPut(`/tasks/${task.id}`, task);
    if (apiResult && !apiResult.error) {
      this.writeJson(tasksFile, tasks);
      return { type: 'task_updated', id: task.id, title: task.title, source: 'api' };
    }

    this.writeJson(tasksFile, tasks);
    return { type: 'task_updated', id: task.id, title: task.title, source: 'file' };
  }

  // ============================================================
  // AÇÕES EXPANDIDAS: Clientes
  // ============================================================
  async listClients(params) {
    const apiResult = await this.apiGet('/workspace/clients');
    if (apiResult && !apiResult.error && Array.isArray(apiResult)) {
      return { type: 'clients', items: apiResult, source: 'api' };
    }
    const clientsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
    const data = this.readJson(clientsFile, { clients: {} });
    const items = Object.values(data.clients || {});
    return { type: 'clients', items, source: 'file' };
  }

  async createClient(params, authorName) {
    const client = {
      id: `client_${Date.now()}`,
      name: params.nome || params.name || 'Cliente sem nome',
      email: params.email || '',
      phone: params.telefone || params.phone || '',
      type: params.tipo || 'lead',
      status: params.status || 'ativo',
      notes: params.notas || params.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const apiResult = await this.apiPost('/workspace/clients', client);
    if (apiResult && !apiResult.error) {
      return { type: 'client', id: client.id, name: client.name, source: 'api' };
    }

    const clientsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
    const data = this.readJson(clientsFile, { clients: {} });
    data.clients = data.clients || {};
    data.clients[client.id] = client;
    this.writeJson(clientsFile, data);
    return { type: 'client', id: client.id, name: client.name, source: 'file' };
  }

  async updateClient(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID do cliente necessário');
    const updates = {};
    if (params.nome || params.name) updates.name = params.nome || params.name;
    if (params.email) updates.email = params.email;
    if (params.telefone || params.phone) updates.phone = params.telefone || params.phone;
    if (params.status) updates.status = params.status;
    if (params.notas || params.notes) updates.notes = params.notas || params.notes;
    updates.updatedAt = new Date().toISOString();

    const apiResult = await this.apiPut(`/workspace/clients/${id}`, updates);
    if (apiResult && !apiResult.error) return { type: 'client_updated', id, source: 'api' };

    const clientsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
    const data = this.readJson(clientsFile, { clients: {} });
    if (data.clients[id]) {
      Object.assign(data.clients[id], updates);
      this.writeJson(clientsFile, data);
      return { type: 'client_updated', id, name: data.clients[id].name, source: 'file' };
    }
    throw new Error('Cliente não encontrado');
  }

  async deleteClient(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID do cliente necessário');

    const apiResult = await this.apiDelete(`/workspace/clients/${id}`);
    if (apiResult && !apiResult.error) return { type: 'client_deleted', id, source: 'api' };

    const clientsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
    const data = this.readJson(clientsFile, { clients: {} });
    const name = data.clients[id]?.name;
    delete data.clients[id];
    this.writeJson(clientsFile, data);
    return { type: 'client_deleted', id, name, source: 'file' };
  }

  // ============================================================
  // AÇÕES EXPANDIDAS: Projetos
  // ============================================================
  async listProjects(params) {
    const apiResult = await this.apiGet('/projects');
    if (apiResult && !apiResult.error && apiResult.projects) {
      return { type: 'projects', items: apiResult.projects, source: 'api' };
    }
    const projectsFile = path.join(this.dataDir, 'schema', 'projects-registry.json');
    const data = this.readJson(projectsFile, { projects: {} });
    return { type: 'projects', items: Object.values(data.projects || {}), source: 'file' };
  }

  // ============================================================
  // AÇÕES EXPANDIDAS: Leads
  // ============================================================
  async updateLead(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID do lead necessário');
    const updates = {};
    if (params.nome || params.name) updates.name = params.nome || params.name;
    if (params.email) updates.email = params.email;
    if (params.telefone || params.phone) updates.phone = params.telefone || params.phone;
    if (params.status) updates.status = params.status;
    if (params.pipelineStatus) updates.pipelineStatus = params.pipelineStatus;
    updates.updatedAt = new Date().toISOString();

    const apiResult = await this.apiPut(`/leads/${id}`, updates);
    if (apiResult && !apiResult.error) return { type: 'lead_updated', id, source: 'api' };

    const leadsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
    const data = this.readJson(leadsFile, { clients: {} });
    const lead = Object.values(data.clients || {}).find(c => c.id === id && (c.type === 'lead' || c.status === 'potencial'));
    if (lead) {
      Object.assign(lead, updates);
      this.writeJson(leadsFile, data);
      return { type: 'lead_updated', id, name: lead.name || lead.displayName, source: 'file' };
    }
    throw new Error('Lead não encontrado');
  }

  async convertLead(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID do lead necessário');

    const apiResult = await this.apiPost(`/leads/${id}/convert`, {});
    if (apiResult && !apiResult.error) return { type: 'lead_converted', id, source: 'api' };

    const leadsFile = path.join(this.dataDir, 'schema', 'clients-registry.json');
    const data = this.readJson(leadsFile, { clients: {} });
    if (data.clients[id]) {
      data.clients[id].type = 'cliente';
      data.clients[id].status = 'ativo';
      data.clients[id].convertedAt = new Date().toISOString();
      this.writeJson(leadsFile, data);
      return { type: 'lead_converted', id, name: data.clients[id].name, source: 'file' };
    }
    throw new Error('Lead não encontrado');
  }

  // ============================================================
  // AÇÕES EXPANDIDAS: Caixa
  // ============================================================
  async queryCashBox(params) {
    const apiResult = await this.apiGet('/cash-box');
    if (apiResult && !apiResult.error) {
      return { type: 'cash_box', balance: apiResult.balance, history: apiResult.history?.slice(-5), source: 'api' };
    }
    const cashFile = path.join(this.dataDir, 'cash-box.json');
    const data = this.readJson(cashFile, { balance: { value: 0, currency: 'EUR' }, history: [] });
    return { type: 'cash_box', balance: data.balance, history: data.history?.slice(-5), source: 'file' };
  }

  // ============================================================
  // AÇÕES EXPANDIDAS: Ideias
  // ============================================================
  async createIdea(params, authorName) {
    const idea = {
      id: `idea_${Date.now()}`,
      title: params.titulo || params.title || 'Ideia sem título',
      content: params.conteudo || params.content || '',
      status: params.status || 'draft',
      priority: params.prioridade || 'medium',
      tags: params.tags || [],
      author: authorName?.toLowerCase() || 'sistema',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const apiResult = await this.apiPost('/ideas', idea);
    if (apiResult && apiResult.success) {
      return { type: 'idea', id: apiResult.data?.id || idea.id, title: idea.title, source: 'api' };
    }

    const ideasFile = path.join(this.dataDir, 'ideas-registry.json');
    const data = this.readJson(ideasFile, { _schema: 'ideas-v1', ideas: [], templates: [], categories: [] });
    data.ideas = data.ideas || [];
    data.ideas.push(idea);
    this.writeJson(ideasFile, data);
    return { type: 'idea', id: idea.id, title: idea.title, source: 'file' };
  }

  async listIdeas(params) {
    const apiResult = await this.apiGet('/ideas');
    if (apiResult && apiResult.success && apiResult.data?.ideas) {
      return { type: 'ideas', items: apiResult.data.ideas, source: 'api' };
    }
    const ideasFile = path.join(this.dataDir, 'ideas-registry.json');
    const data = this.readJson(ideasFile, { ideas: [] });
    return { type: 'ideas', items: data.ideas || [], source: 'file' };
  }

  async updateIdea(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID da ideia necessário');
    const updates = {};
    if (params.titulo || params.title) updates.title = params.titulo || params.title;
    if (params.conteudo || params.content) updates.content = params.conteudo || params.content;
    if (params.status) updates.status = params.status;
    if (params.prioridade || params.priority) updates.priority = params.prioridade || params.priority;
    if (params.tags) updates.tags = params.tags;
    updates.updatedAt = new Date().toISOString();

    const apiResult = await this.apiPut(`/ideas/${id}`, updates);
    if (apiResult && apiResult.success) return { type: 'idea_updated', id, source: 'api' };

    const ideasFile = path.join(this.dataDir, 'ideas-registry.json');
    const data = this.readJson(ideasFile, { ideas: [] });
    const idea = (data.ideas || []).find(i => i.id === id);
    if (idea) {
      Object.assign(idea, updates);
      this.writeJson(ideasFile, data);
      return { type: 'idea_updated', id, title: idea.title, source: 'file' };
    }
    throw new Error('Ideia não encontrada');
  }

  async deleteIdea(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID da ideia necessário');

    const apiResult = await this.apiDelete(`/ideas/${id}`);
    if (apiResult && apiResult.success) return { type: 'idea_deleted', id, source: 'api' };

    const ideasFile = path.join(this.dataDir, 'ideas-registry.json');
    const data = this.readJson(ideasFile, { ideas: [] });
    const idx = (data.ideas || []).findIndex(i => i.id === id);
    if (idx >= 0) {
      const title = data.ideas[idx].title;
      data.ideas.splice(idx, 1);
      this.writeJson(ideasFile, data);
      return { type: 'idea_deleted', id, title, source: 'file' };
    }
    throw new Error('Ideia não encontrada');
  }

  async convertIdeaToTask(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID da ideia necessário');

    const apiResult = await this.apiPost(`/ideas/${id}/convert-task`, { assignedTo: params.responsavel || null });
    if (apiResult && apiResult.success) {
      return { type: 'idea_converted', id, taskId: apiResult.data?.taskId, source: 'api' };
    }

    const ideasFile = path.join(this.dataDir, 'ideas-registry.json');
    const data = this.readJson(ideasFile, { ideas: [] });
    const idea = (data.ideas || []).find(i => i.id === id);
    if (!idea) throw new Error('Ideia não encontrada');

    const taskResult = await this.createTask({
      titulo: idea.title,
      descricao: idea.content,
      prioridade: idea.priority || 'P2',
      responsavel: params.responsavel || null
    }, authorName);

    idea.status = 'converted';
    idea.convertedToTaskId = taskResult.id;
    idea.updatedAt = new Date().toISOString();
    this.writeJson(ideasFile, data);

    return { type: 'idea_converted', id, taskId: taskResult.id, source: 'file' };
  }

  // ============================================================
  // AÇÕES EXPANDIDAS: WhatsApp
  // ============================================================
  async sendWhatsAppMessage(params, authorName) {
    const to = params.para || params.to;
    const text = params.texto || params.text || params.mensagem || params.message;
    if (!to || !text) throw new Error('Número e mensagem necessários');

    const apiResult = await this.apiPost('/whatsapp/send', { to, body: text });
    if (apiResult && !apiResult.error) {
      return { type: 'whatsapp_sent', to, text: text.substring(0, 50), source: 'api' };
    }
    throw new Error('Não foi possível enviar mensagem via WhatsApp');
  }

  // ============================================================
  // AÇÕES EXPANDIDAS: Email
  // ============================================================
  async listEmails(params) {
    const query = params.label || params.filtro || 'INBOX';
    const apiResult = await this.apiGet(`/email/messages?labelIds=${query}&maxResults=10`);
    if (apiResult && !apiResult.error && apiResult.messages) {
      const items = apiResult.messages.map(m => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        unread: m.labelIds?.includes('UNREAD') || m.unread
      }));
      const naoLidos = items.filter(i => i.unread).length;
      return { type: 'emails', total: items.length, naoLidos, items, source: 'api' };
    }
    return { type: 'emails', total: 0, naoLidos: 0, items: [], source: 'api' };
  }

  async readEmail(params) {
    const id = params.id;
    if (!id) throw new Error('ID do email necessário');
    const apiResult = await this.apiGet(`/email/messages/${id}`);
    if (apiResult && !apiResult.error) {
      return { type: 'email', id, from: apiResult.from, subject: apiResult.subject, body: apiResult.body?.substring(0, 500), source: 'api' };
    }
    throw new Error('Email não encontrado');
  }

  // ============================================================
  // AÇÕES EXPANDIDAS: Orçamentos
  // ============================================================
  async createQuote(params, authorName) {
    const quote = {
      id: `quote_${Date.now()}`,
      clientName: params.cliente || params.clientName || 'Cliente',
      title: params.titulo || params.title || 'Orçamento',
      description: params.descricao || params.description || '',
      amount: parseFloat(params.valor || params.amount || 0),
      status: params.status || 'pending',
      createdBy: authorName?.toLowerCase() || 'sistema',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const apiResult = await this.apiPost('/quotes', quote);
    if (apiResult && !apiResult.error) {
      return { type: 'quote', id: quote.id, title: quote.title, amount: quote.amount, source: 'api' };
    }

    const quotesFile = path.join(this.dataDir, 'quotes.json');
    const data = this.readJson(quotesFile, []);
    data.push(quote);
    this.writeJson(quotesFile, data);
    return { type: 'quote', id: quote.id, title: quote.title, amount: quote.amount, source: 'file' };
  }

  async listQuotes(params) {
    const apiResult = await this.apiGet('/quotes');
    if (apiResult && !apiResult.error && Array.isArray(apiResult)) {
      return { type: 'quotes', items: apiResult, source: 'api' };
    }
    const quotesFile = path.join(this.dataDir, 'quotes.json');
    const data = this.readJson(quotesFile, []);
    return { type: 'quotes', items: data, source: 'file' };
  }

  async updateQuote(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID do orçamento é obrigatório');
    const updates = {
      title: params.titulo || params.title,
      description: params.descricao || params.description,
      amount: params.valor !== undefined ? parseFloat(params.valor) : params.amount !== undefined ? parseFloat(params.amount) : undefined,
      status: params.status,
      updatedAt: new Date().toISOString()
    };
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    const apiResult = await this.apiPut(`/quotes/${id}`, updates);
    if (apiResult && !apiResult.error) {
      return { type: 'quote_updated', id, changes: Object.keys(updates), source: 'api' };
    }

    const quotesFile = path.join(this.dataDir, 'quotes.json');
    const data = this.readJson(quotesFile, []);
    const idx = data.findIndex(q => q.id === id);
    if (idx === -1) throw new Error(`Orçamento ${id} não encontrado`);
    data[idx] = { ...data[idx], ...updates };
    this.writeJson(quotesFile, data);
    return { type: 'quote_updated', id, changes: Object.keys(updates), source: 'file' };
  }

  async deleteQuote(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID do orçamento é obrigatório');

    const apiResult = await this.apiDelete(`/quotes/${id}`);
    if (apiResult && !apiResult.error) {
      return { type: 'quote_deleted', id, source: 'api' };
    }

    const quotesFile = path.join(this.dataDir, 'quotes.json');
    const data = this.readJson(quotesFile, []);
    const filtered = data.filter(q => q.id !== id);
    if (filtered.length === data.length) throw new Error(`Orçamento ${id} não encontrado`);
    this.writeJson(quotesFile, filtered);
    return { type: 'quote_deleted', id, source: 'file' };
  }

  // ============================================================
  // AÇÕES: Projetos
  // ============================================================
  async createProject(params, authorName) {
    const project = {
      id: params.id || `proj_${Date.now()}`,
      codename: params.codename || params.id || `proj_${Date.now()}`,
      name: params.nome || params.name || 'Novo Projeto',
      type: params.tipo || params.type || 'web',
      status: params.status || 'planejamento',
      priority: params.prioridade || params.priority || 'medium',
      progress: params.progresso || params.progress || 0,
      description: params.descricao || params.description || '',
      createdBy: authorName?.toLowerCase() || 'sistema',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Projetos não têm endpoint REST dedicado — salvar direto no registry
    const registryFile = path.join(this.dataDir, 'schema', 'projects-registry.json');
    const registry = this.readJson(registryFile, { projects: {} });
    registry.projects = registry.projects || {};
    registry.projects[project.id] = project;
    this.writeJson(registryFile, registry);
    return { type: 'project', id: project.id, name: project.name, source: 'file' };
  }

  async updateProject(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID do projeto é obrigatório');
    const updates = {
      name: params.nome || params.name,
      type: params.tipo || params.type,
      status: params.status,
      priority: params.prioridade || params.priority,
      progress: params.progresso !== undefined ? parseInt(params.progresso) : params.progress !== undefined ? parseInt(params.progress) : undefined,
      description: params.descricao || params.description,
      updatedAt: new Date().toISOString()
    };
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    const registryFile = path.join(this.dataDir, 'schema', 'projects-registry.json');
    const registry = this.readJson(registryFile, { projects: {} });
    registry.projects = registry.projects || {};
    if (!registry.projects[id]) throw new Error(`Projeto ${id} não encontrado`);
    registry.projects[id] = { ...registry.projects[id], ...updates };
    this.writeJson(registryFile, registry);
    return { type: 'project_updated', id, changes: Object.keys(updates), source: 'file' };
  }

  // ============================================================
  // AÇÕES: Workspace Clientes
  // ============================================================
  async addWorkspaceClient(params, authorName) {
    const client = {
      id: params.id || `ws_${Date.now()}`,
      nome: params.nome || params.name || 'Novo Cliente',
      status: params.status || 'ativo',
      dataInicio: params.dataInicio || new Date().toISOString().slice(0, 10),
      responsavel: params.responsavel || authorName?.toLowerCase() || 'sistema',
      orcamentoTotal: parseFloat(params.orcamentoTotal || params.orcamento || 0),
      moeda: params.moeda || 'EUR',
      cor: params.cor || '#3b82f6',
      tags: params.tags || [],
      anotacoes: params.anotacoes || params.notes || ''
    };

    const apiResult = await this.apiPost('/workspace/clients', client);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'workspace_client', id: client.id, name: client.nome, source: 'api' };
    }

    // Fallback: salvar direto no workspace index
    const wsFile = path.join(this.dataDir, 'workspace', 'workspace-index.json');
    const ws = this.readJson(wsFile, { clientes: {} });
    ws.clientes = ws.clientes || {};
    ws.clientes[client.id] = client;
    this.writeJson(wsFile, ws);
    return { type: 'workspace_client', id: client.id, name: client.nome, source: 'file' };
  }

  async updateWorkspaceClient(params, authorName) {
    const id = params.id;
    if (!id) throw new Error('ID do cliente workspace é obrigatório');
    const updates = {
      nome: params.nome || params.name,
      status: params.status,
      responsavel: params.responsavel,
      orcamentoTotal: params.orcamentoTotal !== undefined ? parseFloat(params.orcamentoTotal) : undefined,
      moeda: params.moeda,
      cor: params.cor,
      tags: params.tags,
      anotacoes: params.anotacoes || params.notes,
      updatedAt: new Date().toISOString()
    };
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    const apiResult = await this.apiPut(`/workspace/clients/${id}`, updates);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'workspace_client_updated', id, changes: Object.keys(updates), source: 'api' };
    }

    const wsFile = path.join(this.dataDir, 'workspace', 'workspace-index.json');
    const ws = this.readJson(wsFile, { clientes: {} });
    ws.clientes = ws.clientes || {};
    if (!ws.clientes[id]) throw new Error(`Cliente workspace ${id} não encontrado`);
    ws.clientes[id] = { ...ws.clientes[id], ...updates };
    this.writeJson(wsFile, ws);
    return { type: 'workspace_client_updated', id, changes: Object.keys(updates), source: 'file' };
  }

  // ============================================================
  // AÇÕES: Email
  // ============================================================
  async sendEmail(params, authorName) {
    const payload = {
      to: params.para || params.to,
      subject: params.assunto || params.subject,
      text: params.texto || params.text || params.body,
      html: params.html,
      cc: params.cc,
      bcc: params.bcc
    };
    if (!payload.to || !payload.subject) {
      throw new Error('Destinatário (para/to) e assunto (assunto/subject) são obrigatórios');
    }

    const apiResult = await this.apiPost('/email/messages/send', payload);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'email_sent', to: payload.to, subject: payload.subject, source: 'api' };
    }
    throw new Error('Falha ao enviar email — serviço de email pode estar offline');
  }

  async replyEmail(params, authorName) {
    const payload = {
      to: params.para || params.to,
      subject: params.assunto || params.subject,
      text: params.texto || params.text || params.body,
      html: params.html,
      threadId: params.threadId,
      inReplyTo: params.inReplyTo || params.messageId
    };
    if (!payload.to || !payload.subject) {
      throw new Error('Destinatário (para/to) e assunto (assunto/subject) são obrigatórios');
    }

    const apiResult = await this.apiPost('/email/messages/send', payload);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'email_replied', to: payload.to, subject: payload.subject, threadId: payload.threadId, source: 'api' };
    }
    throw new Error('Falha ao responder email — serviço de email pode estar offline');
  }

  async draftEmail(params, authorName) {
    const payload = {
      to: params.para || params.to,
      subject: params.assunto || params.subject,
      text: params.texto || params.text || params.body,
      html: params.html,
      cc: params.cc,
      bcc: params.bcc
    };
    if (!payload.to || !payload.subject) {
      throw new Error('Destinatário (para/to) e assunto (assunto/subject) são obrigatórios');
    }

    const apiResult = await this.apiPost('/email/drafts', payload);
    if (apiResult && !apiResult.error && apiResult.success !== false) {
      return { type: 'email_draft', to: payload.to, subject: payload.subject, source: 'api' };
    }
    throw new Error('Falha ao criar rascunho de email — serviço de email pode estar offline');
  }

  // ============================================================
  // AÇÕES EXPANDIDAS: Sistema
  // ============================================================
  async controlService(params) {
    const action = params.acao || params.action;
    const service = params.servico || params.service;
    if (!action) throw new Error('Ação necessária (start/stop/restart/status)');

    const apiResult = await this.apiPost('/system/control', { action, service });
    if (apiResult && !apiResult.error) {
      return { type: 'service_control', action, service, result: apiResult, source: 'api' };
    }
    return { type: 'service_control', action, service, result: 'offline', source: 'fallback' };
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
        case 'task_deleted':
          parts.push(`tarefa "${res.titulo || res.title}" excluída`);
          break;
        case 'payment_deleted':
          parts.push(`pagamento de €${res.amount} excluído`);
          break;
        case 'expense_deleted':
          parts.push(`despesa de €${res.amount} excluída`);
          break;
        case 'lead_deleted':
          parts.push(`lead "${res.nome || res.displayName}" excluído`);
          break;
        case 'emails':
          parts.push(`📧 Emails: ${res.total} total (${res.naoLidos} não lidos)`);
          if (res.items?.length > 0) {
            parts.push(res.items.map(e => `  • ${e.unread ? '🆕 ' : ''}${e.from}: "${e.subject}"`).join('\n'));
          }
          break;
        case 'comment':
          parts.push(`comentário na tarefa "${res.taskTitle || res.title || res.titulo}"`);
          break;
        case 'status_update':
          parts.push(`status da tarefa "${res.taskTitle || res.title || res.titulo}" atualizado para ${res.status}`);
          break;
        case 'quote':
          parts.push(`orçamento "${res.title}" de €${res.amount}`);
          break;
        case 'quote_updated':
          parts.push(`orçamento ${res.id} atualizado (${res.changes?.join(', ')})`);
          break;
        case 'quote_deleted':
          parts.push(`orçamento ${res.id} excluído`);
          break;
        case 'project':
          parts.push(`projeto "${res.name}" criado`);
          break;
        case 'project_updated':
          parts.push(`projeto ${res.id} atualizado (${res.changes?.join(', ')})`);
          break;
        case 'workspace_client':
          parts.push(`cliente workspace "${res.name}" adicionado`);
          break;
        case 'workspace_client_updated':
          parts.push(`cliente workspace ${res.id} atualizado (${res.changes?.join(', ')})`);
          break;
        case 'email_sent':
          parts.push(`📧 email enviado para ${res.to}: "${res.subject}"`);
          break;
        case 'email_replied':
          parts.push(`📧 resposta enviada para ${res.to}: "${res.subject}"`);
          break;
        case 'email_draft':
          parts.push(`📧 rascunho criado para ${res.to}: "${res.subject}"`);
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
