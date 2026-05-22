/**
 * NEXO Dashboard — PostgreSQL-Only Datastore
 * ZERO fallback to JSON. PostgreSQL is the single source of truth.
 * If DATABASE_URL is missing, the process exits immediately.
 */
const db = require('./db');

// ── FATAL: No PostgreSQL, no service ──
if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL is not defined.');
  console.error('   PostgreSQL is the only supported persistence layer.');
  console.error('   Set DATABASE_URL and restart the server.');
  process.exit(1);
}

// ── Change notification hook (for WebSocket broadcasts) ──
let changeCallback = null;

function onChange(callback) {
  changeCallback = callback;
}

function notifyChange(entity, data) {
  if (typeof changeCallback === 'function') {
    try {
      changeCallback(entity, data);
    } catch (e) {
      console.error('[datastore-pg] Change notification error:', e.message);
    }
  }
}

// ============================================================
// USERS
// ============================================================
async function getUsers() {
  const rows = await db.query('SELECT id, name, role, color, password FROM users');
  const users = {};
  rows.forEach(r => {
    users[r.id] = { name: r.name, role: r.role, color: r.color, password: r.password };
  });
  return { users, active: 'abner' };
}

async function saveUser(id, userData) {
  await db.run(
    `INSERT INTO users (id,name,role,color,password) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET name=$2, role=$3, color=$4, password=$5, updated_at=NOW()`,
    [id, userData.name, userData.role, userData.color, userData.password]
  );
  notifyChange('users', await getUsers());
}

// ============================================================
// TASKS
// ============================================================
async function getTasks() {
  const rows = await db.query('SELECT * FROM tasks ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    taskType: r.task_type,
    dueDate: r.due_date,
    addedBy: r.added_by,
    assignedTo: r.assigned_to,
    source: r.source,
    comments: r.comments,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  }));
}

async function saveTask(task) {
  await db.run(
    `INSERT INTO tasks (id,title,description,status,priority,task_type,due_date,added_by,assigned_to,source,comments,created_at,updated_at,started_at,completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (id) DO UPDATE SET
       title=$2, description=$3, status=$4, priority=$5, task_type=$6,
       due_date=$7, added_by=$8, assigned_to=$9, source=$10, comments=$11,
       updated_at=$13, started_at=$14, completed_at=$15`,
    [
      task.id, task.title, task.description, task.status, task.priority, task.taskType,
      task.dueDate, task.addedBy, task.assignedTo, task.source,
      JSON.stringify(task.comments || []),
      task.createdAt, task.updatedAt, task.startedAt, task.completedAt
    ]
  );
  notifyChange('tasks', await getTasks());
  return task;
}

async function deleteTask(taskId) {
  await db.run('DELETE FROM tasks WHERE id=$1', [taskId]);
  notifyChange('tasks', await getTasks());
  return true;
}

// ============================================================
// COMPANY TASKS
// ============================================================
async function getCompanyTasks() {
  const rows = await db.query('SELECT * FROM company_tasks ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    taskType: r.task_type,
    dueDate: r.due_date,
    addedBy: r.added_by,
    assignedTo: r.assigned_to,
    source: r.source,
    comments: r.comments,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  }));
}

async function saveCompanyTask(task) {
  await db.run(
    `INSERT INTO company_tasks (id,title,description,status,priority,task_type,due_date,added_by,assigned_to,source,comments,created_at,updated_at,started_at,completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (id) DO UPDATE SET
       title=$2, description=$3, status=$4, priority=$5, task_type=$6,
       due_date=$7, added_by=$8, assigned_to=$9, source=$10, comments=$11,
       updated_at=$13, started_at=$14, completed_at=$15`,
    [
      task.id, task.title, task.description, task.status, task.priority, task.taskType,
      task.dueDate, task.addedBy, task.assignedTo, task.source,
      JSON.stringify(task.comments || []),
      task.createdAt, task.updatedAt, task.startedAt, task.completedAt
    ]
  );
  notifyChange('companyTasks', await getCompanyTasks());
  return task;
}

// ============================================================
// PAYMENTS
// ============================================================
async function getPayments() {
  const rows = await db.query('SELECT * FROM payments ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    clientId: r.client_id,
    clientName: r.client_name,
    projectId: r.project_id,
    projectName: r.project_name,
    amount: { value: parseFloat(r.amount_value), currency: r.amount_currency },
    status: r.status,
    dueDate: r.due_date,
    paidDate: r.paid_date,
    installments: r.installments,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function savePayment(payment) {
  await db.run(
    `INSERT INTO payments (id,name,client_id,client_name,project_id,project_name,amount_value,amount_currency,status,due_date,paid_date,installments,notes,created_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (id) DO UPDATE SET
       name=$2, client_id=$3, client_name=$4, project_id=$5, project_name=$6,
       amount_value=$7, amount_currency=$8, status=$9, due_date=$10, paid_date=$11,
       installments=$12, notes=$13, created_by=$14, updated_at=$16`,
    [
      payment.id, payment.name, payment.clientId, payment.clientName,
      payment.projectId, payment.projectName,
      payment.amount?.value ?? payment.amount ?? 0,
      payment.amount?.currency ?? 'EUR',
      payment.status, payment.dueDate, payment.paidDate,
      JSON.stringify(payment.installments || []),
      payment.notes, payment.createdBy,
      payment.createdAt, payment.updatedAt
    ]
  );
  notifyChange('payments', await getPayments());
  return payment;
}

// ============================================================
// EXPENSES
// ============================================================
async function getExpenses() {
  const rows = await db.query('SELECT * FROM expenses ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    amount: { value: parseFloat(r.amount_value), currency: r.amount_currency },
    costPerPerson: { value: parseFloat(r.cost_per_person_value), currency: r.cost_per_person_currency },
    type: r.type,
    period: r.period,
    periodLabel: r.period_label,
    startDate: r.start_date,
    renewDate: r.renew_date,
    endDate: r.end_date,
    category: r.category,
    categoryLabel: r.category_label,
    splitAmong: r.split_among,
    paidBy: r.paid_by,
    fullyPaid: r.fully_paid,
    autoDeductFromCashBox: r.auto_deduct_from_cash_box,
    notes: r.notes,
    attachments: r.attachments,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function saveExpense(expense) {
  await db.run(
    `INSERT INTO expenses (id,name,description,amount_value,amount_currency,cost_per_person_value,cost_per_person_currency,type,period,period_label,start_date,renew_date,end_date,category,category_label,split_among,paid_by,fully_paid,auto_deduct_from_cash_box,notes,attachments,created_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     ON CONFLICT (id) DO UPDATE SET
       name=$2, description=$3, amount_value=$4, amount_currency=$5,
       cost_per_person_value=$6, cost_per_person_currency=$7, type=$8, period=$9,
       period_label=$10, start_date=$11, renew_date=$12, end_date=$13,
       category=$14, category_label=$15, split_among=$16, paid_by=$17,
       fully_paid=$18, auto_deduct_from_cash_box=$19, notes=$20,
       attachments=$21, created_by=$22, updated_at=$24`,
    [
      expense.id, expense.name, expense.description,
      expense.amount?.value ?? expense.amount ?? 0,
      expense.amount?.currency ?? 'EUR',
      expense.costPerPerson?.value ?? 0,
      expense.costPerPerson?.currency ?? 'EUR',
      expense.type, expense.period, expense.periodLabel,
      expense.startDate, expense.renewDate, expense.endDate,
      expense.category, expense.categoryLabel,
      JSON.stringify(expense.splitAmong || []),
      JSON.stringify(expense.paidBy || {}),
      expense.fullyPaid ?? false,
      expense.autoDeductFromCashBox ?? true,
      expense.notes,
      JSON.stringify(expense.attachments || []),
      expense.createdBy, expense.createdAt, expense.updatedAt
    ]
  );
  notifyChange('expenses', await getExpenses());
  return expense;
}

// ============================================================
// CASH BOX
// ============================================================
async function getCashBox() {
  const row = await db.get('SELECT * FROM cash_box WHERE id=1');
  if (!row) return { balance: { value: 0, currency: 'EUR' }, history: [] };
  return {
    balance: { value: parseFloat(row.balance_value), currency: row.balance_currency },
    monthlyIncome: { value: parseFloat(row.monthly_income_value), currency: row.monthly_income_currency },
    monthlyExpenses: { value: parseFloat(row.monthly_expenses_value), currency: row.monthly_expenses_currency },
    projectedBalance: { value: parseFloat(row.projected_balance_value), currency: row.projected_balance_currency },
    projectionMonths: row.projection_months,
    incomingPayments: row.incoming_payments,
    outgoingExpenses: row.outgoing_expenses,
    history: row.history,
    lastUpdated: row.last_updated,
  };
}

async function saveCashBox(data) {
  await db.run(
    `INSERT INTO cash_box (id,balance_value,balance_currency,monthly_income_value,monthly_income_currency,monthly_expenses_value,monthly_expenses_currency,projected_balance_value,projected_balance_currency,projection_months,incoming_payments,outgoing_expenses,history,last_updated)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO UPDATE SET
       balance_value=$2, balance_currency=$3, monthly_income_value=$4, monthly_income_currency=$5,
       monthly_expenses_value=$6, monthly_expenses_currency=$7, projected_balance_value=$8,
       projected_balance_currency=$9, projection_months=$10, incoming_payments=$11,
       outgoing_expenses=$12, history=$13, last_updated=$14`,
    [
      1,
      data.balance?.value ?? data.balance ?? 0,
      data.balance?.currency ?? 'EUR',
      data.monthlyIncome?.value ?? 0,
      data.monthlyIncome?.currency ?? 'EUR',
      data.monthlyExpenses?.value ?? 0,
      data.monthlyExpenses?.currency ?? 'EUR',
      data.projectedBalance?.value ?? 0,
      data.projectedBalance?.currency ?? 'EUR',
      data.projectionMonths ?? 3,
      JSON.stringify(data.incomingPayments || []),
      JSON.stringify(data.outgoingExpenses || []),
      JSON.stringify(data.history || []),
      data.lastUpdated || new Date().toISOString()
    ]
  );
  notifyChange('cashBox', await getCashBox());
  return data;
}

// ============================================================
// QUOTES
// ============================================================
async function getQuotes() {
  const rows = await db.query('SELECT * FROM quotes ORDER BY created_at DESC');
  return rows.map(r => ({
    quoteId: r.id,
    projectId: r.project_id,
    projectName: r.project_name,
    clientName: r.client_name,
    clientId: r.client_id,
    status: r.status,
    statusLabel: r.status_label,
    totalAmount: { value: parseFloat(r.total_amount_value), currency: r.total_amount_currency },
    monthlyFee: { value: parseFloat(r.monthly_fee_value), currency: r.monthly_fee_currency },
    year1Investment: { value: parseFloat(r.year1_investment_value), currency: r.year1_investment_currency },
    discountUpfront: { percent: parseFloat(r.discount_percent), amount: parseFloat(r.discount_amount), currency: r.discount_currency },
    createdAt: r.created_at,
    sentAt: r.sent_at,
    validUntil: r.valid_until,
    githubUrl: r.github_url,
    items: r.items,
  }));
}

async function saveQuote(quote) {
  await db.run(
    `INSERT INTO quotes (id,project_id,project_name,client_name,client_id,status,status_label,total_amount_value,total_amount_currency,monthly_fee_value,monthly_fee_currency,year1_investment_value,year1_investment_currency,discount_percent,discount_amount,discount_currency,created_at,sent_at,valid_until,github_url,items,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     ON CONFLICT (id) DO UPDATE SET
       project_id=$2, project_name=$3, client_name=$4, client_id=$5, status=$6,
       status_label=$7, total_amount_value=$8, total_amount_currency=$9,
       monthly_fee_value=$10, monthly_fee_currency=$11, year1_investment_value=$12,
       year1_investment_currency=$13, discount_percent=$14, discount_amount=$15,
       discount_currency=$16, created_at=$17, sent_at=$18, valid_until=$19,
       github_url=$20, items=$21, updated_at=$22`,
    [
      quote.quoteId || quote.id, quote.projectId, quote.projectName, quote.clientName, quote.clientId,
      quote.status, quote.statusLabel,
      quote.totalAmount?.value ?? 0,
      quote.totalAmount?.currency ?? 'EUR',
      quote.monthlyFee?.value ?? 0,
      quote.monthlyFee?.currency ?? 'EUR',
      quote.year1Investment?.value ?? 0,
      quote.year1Investment?.currency ?? 'EUR',
      quote.discountUpfront?.percent ?? 0,
      quote.discountUpfront?.amount ?? 0,
      quote.discountUpfront?.currency ?? 'EUR',
      quote.createdAt, quote.sentAt, quote.validUntil,
      quote.githubUrl, JSON.stringify(quote.items || []),
      new Date().toISOString()
    ]
  );
  notifyChange('quotes', await getQuotes());
  return quote;
}

// ============================================================
// MEMBERS
// ============================================================
async function getMembers() {
  const rows = await db.query('SELECT * FROM members ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    role: r.role,
    skills: r.skills,
    sharePercent: parseFloat(r.share_percent),
    status: r.status,
    projects: r.projects,
    email: r.email,
    phone: r.phone,
    country: r.country,
    joinedAt: r.joined_at,
    note: r.note,
  }));
}

// ============================================================
// SETTINGS / GENERIC JSONB
// ============================================================
async function getSettings(key) {
  const row = await db.get('SELECT value FROM settings WHERE key=$1', [key]);
  return row?.value ?? null;
}

async function setSettings(key, value) {
  await db.run(
    'INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()',
    [key, JSON.stringify(value)]
  );
  notifyChange('settings', { key, value });
}

// ============================================================
// IDEAS
// ============================================================
async function getIdeas() {
  const rows = await db.query('SELECT * FROM ideas ORDER BY created_at DESC');
  const ideas = rows.map(r => ({
    id: r.id, title: r.title, summary: r.summary, status: r.status,
    category: r.category, priority: r.priority, author: r.author,
    tags: r.tags || [], blocks: r.blocks || [], metadata: r.metadata || {},
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
  return { ideas };
}

async function saveIdea(idea) {
  await db.run(
    `INSERT INTO ideas (id,title,summary,status,category,priority,author,tags,blocks,metadata,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       title=$2, summary=$3, status=$4, category=$5, priority=$6,
       author=$7, tags=$8, blocks=$9, metadata=$10, updated_at=$12`,
    [idea.id, idea.title, idea.summary, idea.status, idea.category, idea.priority,
     idea.author, JSON.stringify(idea.tags||[]), JSON.stringify(idea.blocks||[]),
     JSON.stringify(idea.metadata||{}), idea.createdAt, idea.updatedAt]
  );
  notifyChange('ideas', await getIdeas());
  return idea;
}

// ============================================================
// LEADS
// ============================================================
async function getLeads() {
  const rows = await db.query('SELECT * FROM leads ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id, name: r.name, email: r.email, phone: r.phone,
    company: r.company, source: r.source, status: r.status,
    notes: r.notes, metadata: r.metadata || {},
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

async function saveLead(lead) {
  await db.run(
    `INSERT INTO leads (id,name,email,phone,company,source,status,notes,metadata,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       name=$2, email=$3, phone=$4, company=$5, source=$6,
       status=$7, notes=$8, metadata=$9, updated_at=$11`,
    [lead.id, lead.name, lead.email, lead.phone, lead.company, lead.source,
     lead.status, lead.notes, JSON.stringify(lead.metadata||{}), lead.createdAt, lead.updatedAt]
  );
  notifyChange('leads', await getLeads());
  return lead;
}

async function deleteLead(id) {
  await db.run('DELETE FROM leads WHERE id=$1', [id]);
  notifyChange('leads', await getLeads());
  return true;
}

// ============================================================
// SECURITY LOGS
// ============================================================
async function getSecurityLogs() {
  const rows = await db.query('SELECT * FROM security_logs ORDER BY created_at DESC');
  const events = rows.map(r => ({
    id: r.id, eventType: r.event_type, userId: r.user_id, ip: r.ip,
    location: r.location, userAgent: r.user_agent, success: r.success,
    details: r.details || {}, createdAt: r.created_at,
  }));
  return { version: '1.0', events };
}

async function saveSecurityLog(event) {
  await db.run(
    `INSERT INTO security_logs (id,event_type,user_id,ip,location,user_agent,success,details,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO NOTHING`,
    [event.id, event.eventType, event.userId, event.ip, event.location,
     event.userAgent, event.success, JSON.stringify(event.details||{}), event.createdAt]
  );
  notifyChange('securityLogs', await getSecurityLogs());
  return event;
}

// ============================================================
// NOTIFICATIONS
// ============================================================
async function getNotifications() {
  const rows = await db.query('SELECT * FROM notifications ORDER BY timestamp DESC');
  const notifications = rows.map(r => ({
    id: r.id, type: r.type, title: r.title, message: r.message,
    severity: r.severity, read: r.read, timestamp: r.timestamp,
    metadata: r.metadata || {}, createdAt: r.created_at,
  }));
  return { version: '1.0', notifications };
}

async function saveNotification(n) {
  await db.run(
    `INSERT INTO notifications (id,type,title,message,severity,read,timestamp,metadata,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET
       type=$2, title=$3, message=$4, severity=$5, read=$6, timestamp=$7, metadata=$8`,
    [n.id, n.type, n.title, n.message, n.severity, n.read, n.timestamp,
     JSON.stringify(n.metadata||{}), n.createdAt || n.timestamp]
  );
  notifyChange('notifications', await getNotifications());
  return n;
}

// ============================================================
// LINKS
// ============================================================
async function getLinks() {
  const rows = await db.query('SELECT * FROM links ORDER BY created_at DESC');
  return { links: rows.map(r => ({ ...r, createdAt: r.created_at })) };
}

async function saveLink(link) {
  await db.run(
    `INSERT INTO links (id,url,author,timestamp,chat,notes,manual,preview,platform,patterns,icon,color,category,label,hostname,enriched_at,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO UPDATE SET
       url=$2, author=$3, timestamp=$4, chat=$5, notes=$6, manual=$7,
       preview=$8, platform=$9, patterns=$10, icon=$11, color=$12,
       category=$13, label=$14, hostname=$15, enriched_at=$16`,
    [link.id, link.url, link.author, link.timestamp, link.chat, link.notes,
     link.manual, JSON.stringify(link.preview||{}), link.platform,
     JSON.stringify(link.patterns||[]), link.icon, link.color, link.category,
     link.label, link.hostname, link.enrichedAt, link.createdAt]
  );
  notifyChange('links', await getLinks());
  return link;
}

// ============================================================
// TRANSACTIONS
// ============================================================
async function getTransactions() {
  const rows = await db.query('SELECT * FROM transactions ORDER BY recorded_at DESC');
  return rows.map(r => ({ ...r, recordedAt: r.recorded_at, deletedAt: r.deleted_at, deletedBy: r.deleted_by }));
}

async function saveTransaction(t) {
  await db.run(
    `INSERT INTO transactions (id,date,type,amount,description,category,balance_after,recorded_by,recorded_at,note,source,is_active,deleted_at,deleted_by,metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (id) DO UPDATE SET
       date=$2, type=$3, amount=$4, description=$5, category=$6,
       balance_after=$7, recorded_by=$8, recorded_at=$9, note=$10,
       source=$11, is_active=$12, deleted_at=$13, deleted_by=$14, metadata=$15`,
    [t.id, t.date, t.type, t.amount, t.description, t.category, t.balanceAfter,
     t.recordedBy, t.recordedAt, t.note, t.source, t.isActive ?? true,
     t.deletedAt, t.deletedBy, JSON.stringify(t.metadata||{})]
  );
  notifyChange('transactions', await getTransactions());
  return t;
}

// ============================================================
// WORKSPACE CLIENTS
// ============================================================
async function getWorkspaceClients() {
  const rows = await db.query('SELECT * FROM workspace_clients ORDER BY criado_em DESC');
  return {
    clientes: rows.map(r => ({
      id: r.id, nome: r.name, caminho: r.path, status: r.status,
      cor: r.color, responsavel: r.responsavel, tipo: r.tipo,
      dataInicio: r.data_inicio, orcamentoTotal: r.orcamento_total,
      moeda: r.moeda, tags: r.tags || [], anotacoes: r.anotacoes,
      metadata: r.metadata || {}, criadoEm: r.criado_em, atualizadoEm: r.atualizado_em,
    }))
  };
}

async function saveWorkspaceClient(client) {
  await db.run(
    `INSERT INTO workspace_clients (id,name,path,status,color,responsavel,tipo,data_inicio,orcamento_total,moeda,tags,anotacoes,metadata,criado_em,atualizado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (id) DO UPDATE SET
       name=$2, path=$3, status=$4, color=$5, responsavel=$6, tipo=$7,
       data_inicio=$8, orcamento_total=$9, moeda=$10, tags=$11,
       anotacoes=$12, metadata=$13, atualizado_em=$15`,
    [client.id, client.nome, client.caminho, client.status, client.cor,
     client.responsavel, client.tipo, client.dataInicio, client.orcamentoTotal,
     client.moeda, JSON.stringify(client.tags||[]), client.anotacoes,
     JSON.stringify(client.metadata||{}), client.criadoEm, client.atualizadoEm]
  );
  notifyChange('workspaceClients', await getWorkspaceClients());
  return client;
}

async function deleteWorkspaceClient(id) {
  await db.run('DELETE FROM workspace_clients WHERE id=$1', [id]);
  notifyChange('workspaceClients', await getWorkspaceClients());
  return true;
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  onChange,
  getUsers, saveUser,
  getTasks, saveTask, deleteTask,
  getCompanyTasks, saveCompanyTask,
  getPayments, savePayment,
  getExpenses, saveExpense,
  getCashBox, saveCashBox,
  getQuotes, saveQuote,
  getMembers,
  getSettings, setSettings,
  getIdeas, saveIdea,
  getLeads, saveLead, deleteLead,
  getSecurityLogs, saveSecurityLog,
  getNotifications, saveNotification,
  getLinks, saveLink,
  getTransactions, saveTransaction,
  getWorkspaceClients, saveWorkspaceClient, deleteWorkspaceClient,
};
