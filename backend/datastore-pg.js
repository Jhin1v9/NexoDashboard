/**
 * NEXO Dashboard — PostgreSQL-Only Datastore
 * ZERO fallback to JSON. PostgreSQL is the single source of truth.
 * Schema 1:1 with server.js — zero adapters, zero translation.
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
function onChange(callback) { changeCallback = callback; }
function notifyChange(entity, data) {
  if (typeof changeCallback === 'function') {
    try { changeCallback(entity, data); } catch (e) {
      console.error('[datastore-pg] Change notification error:', e.message);
    }
  }
}

// ============================================================
// USERS
// ============================================================
async function getUsers() {
  const rows = await db.query('SELECT id, name, role, color, password, discord_id, created_at, updated_at FROM users');
  const users = {};
  rows.forEach(r => {
    users[r.id] = {
      name: r.name,
      role: r.role,
      color: r.color,
      password: r.password,
      discordId: r.discord_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  });
  return { users, active: 'abner' };
}

async function saveUser(id, userData) {
  await db.run(
    `INSERT INTO users (id, name, role, color, password, discord_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()), COALESCE($8, NOW()))
     ON CONFLICT (id) DO UPDATE SET
       name = $2, role = $3, color = $4, password = $5, discord_id = $6,
       updated_at = NOW()`,
    [id, userData.name, userData.role, userData.color, userData.password,
     userData.discordId || null, userData.createdAt, userData.updatedAt]
  );
  notifyChange('users', await getUsers());
}

// ============================================================
// TASKS
// ============================================================
async function getTasks() {
  const rows = await db.query('SELECT * FROM tasks ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id, title: r.title, description: r.description, status: r.status,
    priority: r.priority, taskType: r.task_type, dueDate: r.due_date,
    addedBy: r.added_by, assignedTo: r.assigned_to, source: r.source,
    comments: r.comments || [], createdAt: r.created_at, updatedAt: r.updated_at,
    startedAt: r.started_at, completedAt: r.completed_at
  }));
}

async function saveTask(task) {
  await db.run(
    `INSERT INTO tasks (id, title, description, status, priority, task_type, due_date, added_by, assigned_to, source, comments, created_at, updated_at, started_at, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (id) DO UPDATE SET
       title=$2, description=$3, status=$4, priority=$5, task_type=$6,
       due_date=$7, added_by=$8, assigned_to=$9, source=$10, comments=$11,
       updated_at=$13, started_at=$14, completed_at=$15`,
    [task.id, task.title, task.description, task.status, task.priority, task.taskType,
     task.dueDate, task.addedBy, task.assignedTo, task.source,
     JSON.stringify(task.comments || []), task.createdAt, task.updatedAt,
     task.startedAt, task.completedAt]
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
    id: r.id, title: r.title, description: r.description, status: r.status,
    priority: r.priority, taskType: r.task_type, dueDate: r.due_date,
    addedBy: r.added_by, assignedTo: r.assigned_to, source: r.source,
    comments: r.comments || [], createdAt: r.created_at, updatedAt: r.updated_at,
    startedAt: r.started_at, completedAt: r.completed_at
  }));
}

async function saveCompanyTask(task) {
  await db.run(
    `INSERT INTO company_tasks (id, title, description, status, priority, task_type, due_date, added_by, assigned_to, source, comments, created_at, updated_at, started_at, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (id) DO UPDATE SET
       title=$2, description=$3, status=$4, priority=$5, task_type=$6,
       due_date=$7, added_by=$8, assigned_to=$9, source=$10, comments=$11,
       updated_at=$13, started_at=$14, completed_at=$15`,
    [task.id, task.title, task.description, task.status, task.priority, task.taskType,
     task.dueDate, task.addedBy, task.assignedTo, task.source,
     JSON.stringify(task.comments || []), task.createdAt, task.updatedAt,
     task.startedAt, task.completedAt]
  );
  notifyChange('companyTasks', await getCompanyTasks());
  return task;
}

async function deleteCompanyTask(id) {
  await db.run('DELETE FROM company_tasks WHERE id=$1', [id]);
  notifyChange('companyTasks', await getCompanyTasks());
  return true;
}

// ============================================================
// PAYMENTS (schema real do server.js — NOMES REAIS)
// ============================================================
async function getPayments() {
  const rows = await db.query('SELECT * FROM payments ORDER BY created_at DESC');
  return rows.map(r => ({
    paymentId: r.payment_id, id: r.id, clientId: r.client_id,
    clientName: r.client_name, clientShortName: r.client_short_name,
    projectName: r.project_name, projectId: r.project_id,
    description: r.description, totalAmount: r.total_amount,
    equivalentEUR: r.equivalent_eur, status: r.status,
    paymentTerms: r.payment_terms, methodPreferred: r.method_preferred,
    methodAccepted: r.method_accepted, revenueSplit: r.revenue_split,
    transactions: r.transactions, notes: r.notes, links: r.links,
    companySharePercent: parseFloat(r.company_share_percent) || 25,
    createdAt: r.created_at, updatedAt: r.updated_at
  }));
}

async function savePayment(payment) {
  await db.run(
    `INSERT INTO payments (payment_id, id, client_id, client_name, client_short_name, project_name, project_id, description, total_amount, equivalent_eur, status, payment_terms, method_preferred, method_accepted, revenue_split, transactions, notes, links, company_share_percent, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     ON CONFLICT (payment_id) DO UPDATE SET
       id=$2, client_id=$3, client_name=$4, client_short_name=$5, project_name=$6,
       project_id=$7, description=$8, total_amount=$9, equivalent_eur=$10, status=$11,
       payment_terms=$12, method_preferred=$13, method_accepted=$14, revenue_split=$15,
       transactions=$16, notes=$17, links=$18, company_share_percent=$19, updated_at=$21`,
    [
      payment.paymentId || payment.id, payment.id || payment.paymentId,
      payment.clientId, payment.clientName, payment.clientShortName || '',
      payment.projectName, payment.projectId, payment.description || '',
      JSON.stringify(payment.totalAmount || { value: 0, currency: 'EUR' }),
      payment.equivalentEUR ? JSON.stringify(payment.equivalentEUR) : null,
      payment.status, JSON.stringify(payment.paymentTerms || { type: 'full', splits: [] }),
      payment.methodPreferred, JSON.stringify(payment.methodAccepted || ['transfer', 'card', 'cash', 'bizum']),
      JSON.stringify(payment.revenueSplit || []),
      JSON.stringify(payment.transactions || []),
      payment.notes || '', JSON.stringify(payment.links || {}),
      payment.companySharePercent || 25, payment.createdAt, payment.updatedAt
    ]
  );
  notifyChange('payments', await getPayments());
  return payment;
}

async function deletePayment(paymentId) {
  await db.run('DELETE FROM payments WHERE payment_id=$1', [paymentId]);
  notifyChange('payments', await getPayments());
  return true;
}

// ============================================================
// EXPENSES
// ============================================================
async function getExpenses() {
  const rows = await db.query('SELECT * FROM expenses ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id, name: r.name, description: r.description,
    amount: { value: parseFloat(r.amount_value), currency: r.amount_currency },
    costPerPerson: { value: parseFloat(r.cost_per_person_value), currency: r.cost_per_person_currency },
    type: r.type, period: r.period, periodLabel: r.period_label,
    startDate: r.start_date, renewDate: r.renew_date, endDate: r.end_date,
    category: r.category, categoryLabel: r.category_label,
    splitAmong: r.split_among || [], paidBy: r.paid_by || {},
    fullyPaid: r.fully_paid, autoDeductFromCashBox: r.auto_deduct_from_cash_box,
    notes: r.notes, attachments: r.attachments || [],
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at
  }));
}

async function saveExpense(expense) {
  await db.run(
    `INSERT INTO expenses (id, name, description, amount_value, amount_currency, cost_per_person_value, cost_per_person_currency, type, period, period_label, start_date, renew_date, end_date, category, category_label, split_among, paid_by, fully_paid, auto_deduct_from_cash_box, notes, attachments, created_by, created_at, updated_at)
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

async function deleteExpense(expenseId) {
  await db.run('DELETE FROM expenses WHERE id=$1', [expenseId]);
  notifyChange('expenses', await getExpenses());
  return true;
}
// ============================================================
// CASH BOX
// ============================================================
async function getCashBox() {
  const row = await db.get('SELECT * FROM cash_box WHERE id=1');
  if (!row) return {
    balance: { value: 0, currency: 'EUR' },
    monthlyIncome: { value: 0, currency: 'EUR' },
    monthlyExpenses: { value: 0, currency: 'EUR' },
    projectedBalance: { value: 0, currency: 'EUR' },
    projectionMonths: 3,
    incomingPayments: [],
    outgoingExpenses: [],
    history: [],
    lastUpdated: new Date().toISOString(),
    alerts: [],
    settings: { lowBalanceMultiplier: 2, currency: 'EUR', autoDeductRecurring: true, projectionMonths: 3 },
    auditLog: []
  };
  return {
    balance: { value: parseFloat(row.balance_value), currency: row.balance_currency },
    monthlyIncome: { value: parseFloat(row.monthly_income_value), currency: row.monthly_income_currency },
    monthlyExpenses: { value: parseFloat(row.monthly_expenses_value), currency: row.monthly_expenses_currency },
    projectedBalance: { value: parseFloat(row.projected_balance_value), currency: row.projected_balance_currency },
    projectionMonths: row.projection_months,
    incomingPayments: row.incoming_payments || [],
    outgoingExpenses: row.outgoing_expenses || [],
    history: row.history || [],
    lastUpdated: row.last_updated,
    alerts: row.alerts || [],
    settings: row.settings || { lowBalanceMultiplier: 2, currency: 'EUR', autoDeductRecurring: true, projectionMonths: 3 },
    auditLog: row.audit_log || []
  };
}

async function saveCashBox(data) {
  await db.run(
    `INSERT INTO cash_box (id, balance_value, balance_currency, monthly_income_value, monthly_income_currency, monthly_expenses_value, monthly_expenses_currency, projected_balance_value, projected_balance_currency, projection_months, incoming_payments, outgoing_expenses, history, last_updated, alerts, settings, audit_log)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO UPDATE SET
       balance_value=$2, balance_currency=$3, monthly_income_value=$4, monthly_income_currency=$5,
       monthly_expenses_value=$6, monthly_expenses_currency=$7, projected_balance_value=$8,
       projected_balance_currency=$9, projection_months=$10, incoming_payments=$11,
       outgoing_expenses=$12, history=$13, last_updated=$14, alerts=$15, settings=$16, audit_log=$17`,
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
      data.lastUpdated || new Date().toISOString(),
      JSON.stringify(data.alerts || []),
      JSON.stringify(data.settings || { lowBalanceMultiplier: 2, currency: 'EUR', autoDeductRecurring: true, projectionMonths: 3 }),
      JSON.stringify(data.auditLog || [])
    ]
  );
  notifyChange('cashBox', await getCashBox());
  return data;
}

// ============================================================
// QUOTES (schema real — NOMES REAIS)
// ============================================================
async function getQuotes() {
  const rows = await db.query('SELECT * FROM quotes ORDER BY created_at DESC');
  return rows.map(r => ({
    quoteId: r.quote_id, id: r.id, projectId: r.project_id,
    projectName: r.project_name, clientName: r.client_name,
    clientId: r.client_id, status: r.status, statusLabel: r.status_label,
    totalAmount: r.total_amount, monthlyFee: r.monthly_fee,
    year1Investment: r.year1_investment, discountUpfront: r.discount_upfront,
    items: r.items || [], githubUrl: r.github_url,
    createdAt: r.created_at, sentAt: r.sent_at,
    validUntil: r.valid_until, updatedAt: r.updated_at
  }));
}

async function saveQuote(quote) {
  await db.run(
    `INSERT INTO quotes (quote_id, id, project_id, project_name, client_name, client_id, status, status_label, total_amount, monthly_fee, year1_investment, discount_upfront, items, github_url, created_at, sent_at, valid_until, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (quote_id) DO UPDATE SET
       id=$2, project_id=$3, project_name=$4, client_name=$5, client_id=$6,
       status=$7, status_label=$8, total_amount=$9, monthly_fee=$10,
       year1_investment=$11, discount_upfront=$12, items=$13,
       github_url=$14, created_at=$15, sent_at=$16, valid_until=$17, updated_at=$18`,
    [
      quote.quoteId || quote.id, quote.id || quote.quoteId,
      quote.projectId, quote.projectName, quote.clientName, quote.clientId,
      quote.status, quote.statusLabel,
      JSON.stringify(quote.totalAmount || { value: 0, currency: 'EUR' }),
      JSON.stringify(quote.monthlyFee || { value: 0, currency: 'EUR' }),
      JSON.stringify(quote.year1Investment || { value: 0, currency: 'EUR' }),
      JSON.stringify(quote.discountUpfront || { percent: 0, amount: 0, currency: 'EUR' }),
      JSON.stringify(quote.items || []),
      quote.githubUrl, quote.createdAt, quote.sentAt, quote.validUntil,
      new Date().toISOString()
    ]
  );
  notifyChange('quotes', await getQuotes());
  return quote;
}

async function deleteQuote(quoteId) {
  await db.run('DELETE FROM quotes WHERE quote_id=$1', [quoteId]);
  notifyChange('quotes', await getQuotes());
  return true;
}

// ============================================================
// MEMBERS
// ============================================================
async function getMembers() {
  const rows = await db.query('SELECT * FROM members ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id, name: r.name, role: r.role, skills: r.skills || [],
    sharePercent: parseFloat(r.share_percent), status: r.status,
    projects: r.projects || [], email: r.email, phone: r.phone,
    country: r.country, joinedAt: r.joined_at, note: r.note,
    createdAt: r.created_at, updatedAt: r.updated_at
  }));
}

async function saveMember(member) {
  await db.run(
    `INSERT INTO members (id, name, role, skills, share_percent, status, projects, email, phone, country, joined_at, note, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO UPDATE SET
       name=$2, role=$3, skills=$4, share_percent=$5, status=$6,
       projects=$7, email=$8, phone=$9, country=$10, joined_at=$11,
       note=$12, updated_at=$14`,
    [member.id, member.name, member.role, JSON.stringify(member.skills || []),
     member.sharePercent, member.status, JSON.stringify(member.projects || []),
     member.email, member.phone, member.country, member.joinedAt,
     member.note, member.createdAt, member.updatedAt]
  );
  notifyChange('members', await getMembers());
  return member;
}

async function deleteMember(id) {
  await db.run('DELETE FROM members WHERE id = $1', [id]);
  notifyChange('members', await getMembers());
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
    'INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()',
    [key, JSON.stringify(value)]
  );
  notifyChange('settings', { key, value });
}

// ============================================================
// IDEAS (schema real — NOMES REAIS)
// ============================================================
async function getIdeas() {
  const rows = await db.query('SELECT * FROM ideas ORDER BY created_at DESC');
  const ideas = {};
  rows.forEach(r => {
    ideas[r.id] = {
      id: r.id, title: r.title, status: r.status, type: r.type,
      priority: r.priority, linkedTo: r.linked_to,
      content: r.content, aiContext: r.ai_context,
      tags: r.tags || [], createdBy: r.created_by,
      createdByName: r.created_by_name, createdAt: r.created_at,
      updatedAt: r.updated_at, collaborators: r.collaborators || [],
      comments: r.comments || [], attachments: r.attachments || [],
      versionHistory: r.version_history || [], summary: r.summary,
      dueDate: r.due_date, assignedTo: r.assigned_to,
      convertedTo: r.converted_to
    };
  });
  return { ideas };
}

async function saveIdea(idea) {
  await db.run(
    `INSERT INTO ideas (id, title, status, type, priority, linked_to, content, ai_context, tags, created_by, created_by_name, created_at, updated_at, collaborators, comments, attachments, version_history, summary, due_date, assigned_to, converted_to)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     ON CONFLICT (id) DO UPDATE SET
       title=$2, status=$3, type=$4, priority=$5, linked_to=$6,
       content=$7, ai_context=$8, tags=$9, created_by=$10,
       created_by_name=$11, updated_at=$13, collaborators=$14,
       comments=$15, attachments=$16, version_history=$17,
       summary=$18, due_date=$19, assigned_to=$20, converted_to=$21`,
    [idea.id, idea.title, idea.status, idea.type, idea.priority,
     JSON.stringify(idea.linkedTo || {}), JSON.stringify(idea.content || {}),
     JSON.stringify(idea.aiContext || { brainstormHistory: [], aiSuggestions: [], aiInsights: [] }),
     JSON.stringify(idea.tags || []), idea.createdBy, idea.createdByName,
     idea.createdAt, idea.updatedAt, JSON.stringify(idea.collaborators || []),
     JSON.stringify(idea.comments || []), JSON.stringify(idea.attachments || []),
     JSON.stringify(idea.versionHistory || []), idea.summary, idea.dueDate,
     idea.assignedTo, JSON.stringify(idea.convertedTo || {})]
  );
  notifyChange('ideas', await getIdeas());
  return idea;
}

async function deleteIdea(id) {
  await db.run('DELETE FROM ideas WHERE id = $1', [id]);
  notifyChange('ideas', await getIdeas());
}

// ============================================================
// LEADS (schema real — NOMES REAIS)
// ============================================================
async function getLeads() {
  const rows = await db.query('SELECT * FROM leads ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id, displayName: r.display_name, name: r.name,
    email: r.email, phone: r.phone, source: r.source,
    type: r.type, status: r.status, pipelineStatus: r.pipeline_status,
    estimatedValue: parseFloat(r.estimated_value), currency: r.currency,
    notes: r.notes, assignedTo: r.assigned_to,
    tags: r.tags || [], createdAt: r.created_at,
    lastContact: r.last_contact, convertedAt: r.converted_at
  }));
}

async function saveLead(lead) {
  await db.run(
    `INSERT INTO leads (id, display_name, name, email, phone, source, type, status, pipeline_status, estimated_value, currency, notes, assigned_to, tags, created_at, last_contact, converted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO UPDATE SET
       display_name=$2, name=$3, email=$4, phone=$5, source=$6,
       type=$7, status=$8, pipeline_status=$9, estimated_value=$10,
       currency=$11, notes=$12, assigned_to=$13, tags=$14,
       last_contact=$16, converted_at=$17`,
    [lead.id, lead.displayName, lead.name, lead.email, lead.phone,
     lead.source, lead.type, lead.status, lead.pipelineStatus,
     lead.estimatedValue, lead.currency, lead.notes, lead.assignedTo,
     JSON.stringify(lead.tags || []), lead.createdAt,
     lead.lastContact, lead.convertedAt]
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
// SECURITY LOGS (schema real — NOMES REAIS)
// ============================================================
async function getSecurityLogs() {
  const rows = await db.query('SELECT * FROM security_logs ORDER BY timestamp DESC');
  const events = rows.map(r => ({
    id: r.id, timestamp: r.timestamp, type: r.type,
    severity: r.severity, ip: r.ip, location: r.location,
    risk: r.risk, device: r.device, attemptedUser: r.attempted_user,
    message: r.message, notified: r.notified,
    notificationChannel: r.notification_channel,
    hasCameraPhoto: r.has_camera_photo, hasScreenshot: r.has_screenshot,
    cameraPhoto: r.camera_photo, screenshot: r.screenshot,
    intruderData: r.intruder_data
  }));
  return { version: '1.0', events };
}

async function saveSecurityLog(event) {
  await db.run(
    `INSERT INTO security_logs (id, timestamp, type, severity, ip, location, risk, device, attempted_user, message, notified, notification_channel, has_camera_photo, has_screenshot, camera_photo, screenshot, intruder_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO NOTHING`,
    [event.id, event.timestamp, event.type, event.severity, event.ip,
     JSON.stringify(event.location || {}), JSON.stringify(event.risk || {}),
     JSON.stringify(event.device || {}), event.attemptedUser, event.message,
     event.notified ?? false, event.notificationChannel,
     event.hasCameraPhoto ?? false, event.hasScreenshot ?? false,
     event.cameraPhoto, event.screenshot, JSON.stringify(event.intruderData || {})]
  );
  notifyChange('securityLogs', await getSecurityLogs());
  return event;
}

async function deleteSecurityLog(id) {
  await db.run('DELETE FROM security_logs WHERE id=$1', [id]);
  notifyChange('securityLogs', await getSecurityLogs());
  return true;
}

// ============================================================
// NOTIFICATIONS
// ============================================================
async function getNotifications() {
  const rows = await db.query('SELECT * FROM notifications ORDER BY timestamp DESC');
  const notifications = rows.map(r => ({
    id: r.id, type: r.type, title: r.title, message: r.message,
    severity: r.severity, read: r.read, timestamp: r.timestamp,
    metadata: r.metadata || {}, createdAt: r.created_at
  }));
  return { version: '1.0', notifications };
}

async function saveNotification(n) {
  await db.run(
    `INSERT INTO notifications (id, type, title, message, severity, read, timestamp, metadata, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET
       type=$2, title=$3, message=$4, severity=$5, read=$6, timestamp=$7, metadata=$8`,
    [n.id, n.type, n.title, n.message, n.severity, n.read, n.timestamp,
     JSON.stringify(n.metadata || {}), n.createdAt || n.timestamp]
  );
  notifyChange('notifications', await getNotifications());
  return n;
}

async function deleteNotification(id) {
  await db.run('DELETE FROM notifications WHERE id=$1', [id]);
  notifyChange('notifications', await getNotifications());
  return true;
}

// ============================================================
// LINKS
// ============================================================
async function getLinks() {
  const rows = await db.query('SELECT * FROM links ORDER BY created_at DESC');
  return { links: rows.map(r => ({
    id: r.id, url: r.url, author: r.author, timestamp: r.timestamp,
    chat: r.chat, notes: r.notes, manual: r.manual, preview: r.preview,
    platform: r.platform, patterns: r.patterns || [], icon: r.icon,
    color: r.color, category: r.category, label: r.label,
    hostname: r.hostname, enrichedAt: r.enriched_at, createdAt: r.created_at,
    updatedAt: r.updated_at
  })) };
}

async function saveLink(link) {
  await db.run(
    `INSERT INTO links (id, url, author, timestamp, chat, notes, manual, preview, platform, patterns, icon, color, category, label, hostname, enriched_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO UPDATE SET
       url=$2, author=$3, timestamp=$4, chat=$5, notes=$6, manual=$7,
       preview=$8, platform=$9, patterns=$10, icon=$11, color=$12,
       category=$13, label=$14, hostname=$15, enriched_at=$16`,
    [link.id, link.url, link.author, link.timestamp, link.chat, link.notes,
     link.manual, JSON.stringify(link.preview || {}), link.platform,
     JSON.stringify(link.patterns || []), link.icon, link.color, link.category,
     link.label, link.hostname, link.enrichedAt, link.createdAt]
  );
  notifyChange('links', await getLinks());
  return link;
}

async function deleteLink(id) {
  await db.run('DELETE FROM links WHERE id=$1', [id]);
  notifyChange('links', await getLinks());
  return true;
}

// ============================================================
// TRANSACTIONS (schema real — NOMES REAIS)
// ============================================================
async function getTransactions() {
  const rows = await db.query('SELECT * FROM transactions ORDER BY date DESC');
  return rows.map(r => ({
    id: r.id, date: r.date, type: r.type, amount: parseFloat(r.amount),
    currency: r.currency, description: r.description, category: r.category,
    balanceAfter: parseFloat(r.balance_after), recordedBy: r.recorded_by,
    recordedAt: r.recorded_at, notes: r.notes, source: r.source,
    isActive: r.is_active, deletedAt: r.deleted_at, deletedBy: r.deleted_by,
    metadata: r.metadata || {}, createdAt: r.created_at,
    createdBy: r.created_by, updatedAt: r.updated_at
  }));
}

async function saveTransaction(t) {
  await db.run(
    `INSERT INTO transactions (id, date, type, amount, currency, description, category, balance_after, recorded_by, recorded_at, notes, source, is_active, deleted_at, deleted_by, metadata, created_at, created_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     ON CONFLICT (id) DO UPDATE SET
       date=$2, type=$3, amount=$4, currency=$5, description=$6,
       category=$7, balance_after=$8, recorded_by=$9, recorded_at=$10,
       notes=$11, source=$12, is_active=$13, deleted_at=$14,
       deleted_by=$15, metadata=$16, updated_at=$19`,
    [t.id, t.date, t.type, t.amount, t.currency || 'EUR', t.description,
     t.category, t.balanceAfter, t.recordedBy, t.recordedAt,
     t.notes || '', t.source, t.isActive ?? true, t.deletedAt,
     t.deletedBy, JSON.stringify(t.metadata || {}), t.createdAt,
     t.createdBy || 'abner', t.updatedAt]
  );
  notifyChange('transactions', await getTransactions());
  return t;
}

async function deleteTransaction(id) {
  await db.run('DELETE FROM transactions WHERE id = $1', [id]);
  notifyChange('transactions', await getTransactions());
}

// ============================================================
// CHANGELOG (schema real — NOMES REAIS)
// ============================================================
async function getChangelog() {
  const rows = await db.query('SELECT * FROM changelog ORDER BY date DESC');
  const entries = rows.map(r => ({
    id: r.id, version: r.version, title: r.title,
    description: r.description, category: r.category,
    emoji: r.emoji, author: r.author, tier: r.tier,
    date: r.date, tags: r.tags || [], readBy: r.read_by || [],
    status: r.status || '❓ STATUS NÃO AVALIADO',
    statusDetail: r.status_detail || 'Esta funcionalidade ainda não foi revisada neste ciclo de testes.'
  }));
  return { version: '1.0', lastUpdated: new Date().toISOString(), entries };
}

async function saveChangelog(entry) {
  await db.run(
    `INSERT INTO changelog (id, version, title, description, category, emoji, author, tier, date, tags, read_by, status, status_detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET
       version=$2, title=$3, description=$4, category=$5, emoji=$6,
       author=$7, tier=$8, date=$9, tags=$10, read_by=$11, status=$12, status_detail=$13`,
    [entry.id, entry.version, entry.title, entry.description, entry.category,
     entry.emoji, entry.author, entry.tier, entry.date,
     JSON.stringify(entry.tags || []), JSON.stringify(entry.readBy || []),
     entry.status || '❓ STATUS NÃO AVALIADO',
     entry.statusDetail || 'Esta funcionalidade ainda não foi revisada neste ciclo de testes.']
  );
  notifyChange('changelog', await getChangelog());
  return entry;
}

async function deleteChangelog(id) {
  await db.run('DELETE FROM changelog WHERE id = $1', [id]);
  notifyChange('changelog', await getChangelog());
}

// ============================================================
// WHATSAPP HISTORY (schema real — NOMES REAIS)
// ============================================================
async function getWhatsappHistory() {
  const rows = await db.query('SELECT * FROM whatsapp_history ORDER BY timestamp DESC');
  return rows.map(r => ({
    id: r.id, text: r.text, body: r.body, author: r.author,
    authorName: r.author_name, chat: r.chat, chatName: r.chat_name,
    timestamp: r.timestamp, classification: r.classification,
    reviewed: r.reviewed, correctedCategory: r.corrected_category,
    notes: r.notes, sentViaDashboard: r.sent_via_dashboard,
    direction: r.direction, responded: r.responded,
    resolvedAuthor: r.resolved_author, createdAt: r.created_at
  }));
}

async function saveWhatsappMessage(msg) {
  await db.run(
    `INSERT INTO whatsapp_history (id, text, body, author, author_name, chat, chat_name, timestamp, classification, reviewed, corrected_category, notes, sent_via_dashboard, direction, responded, resolved_author, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO UPDATE SET
       text=$2, body=$3, author=$4, author_name=$5, chat=$6, chat_name=$7,
       timestamp=$8, classification=$9, reviewed=$10, corrected_category=$11,
       notes=$12, sent_via_dashboard=$13, direction=$14, responded=$15,
       resolved_author=$16`,
    [msg.id, msg.text, msg.body, msg.author, msg.authorName, msg.chat,
     msg.chatName, msg.timestamp, JSON.stringify(msg.classification || {}),
     msg.reviewed ?? false, msg.correctedCategory, msg.notes,
     msg.sentViaDashboard ?? false, msg.direction, msg.responded ?? false,
     JSON.stringify(msg.resolvedAuthor || {}), msg.createdAt || msg.timestamp]
  );
  notifyChange('whatsappHistory', await getWhatsappHistory());
  return msg;
}

async function saveWhatsappHistory(messages) {
  for (const msg of messages) {
    await db.run(
      `INSERT INTO whatsapp_history (id, text, body, author, author_name, chat, chat_name, timestamp, classification, reviewed, corrected_category, notes, sent_via_dashboard, direction, responded, resolved_author, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO UPDATE SET
         text=$2, body=$3, author=$4, author_name=$5, chat=$6, chat_name=$7,
         timestamp=$8, classification=$9, reviewed=$10, corrected_category=$11,
         notes=$12, sent_via_dashboard=$13, direction=$14, responded=$15,
         resolved_author=$16`,
      [msg.id, msg.text, msg.body, msg.author, msg.authorName, msg.chat,
       msg.chatName, msg.timestamp, JSON.stringify(msg.classification || {}),
       msg.reviewed ?? false, msg.correctedCategory, msg.notes,
       msg.sentViaDashboard ?? false, msg.direction, msg.responded ?? false,
       JSON.stringify(msg.resolvedAuthor || {}), msg.createdAt || msg.timestamp]
    );
  }
  notifyChange('whatsappHistory', await getWhatsappHistory());
  return messages;
}

async function deleteWhatsappMessage(id) {
  await db.run('DELETE FROM whatsapp_history WHERE id = $1', [id]);
  notifyChange('whatsappHistory', await getWhatsappHistory());
}

// ============================================================
// LUNA THREADS (schema real — NOMES REAIS)
// ============================================================
async function getLunaThreads() {
  const rows = await db.query('SELECT * FROM luna_threads ORDER BY updated_at DESC');
  const threads = {};
  rows.forEach(r => {
    threads[r.id] = {
      id: r.id, type: r.type, title: r.title,
      participants: r.participants || [],
      createdAt: r.created_at, updatedAt: r.updated_at,
      messageCount: r.message_count,
      messages: r.messages || []
    };
  });
  return { version: '1.0', lastUpdated: new Date().toISOString(), threads };
}

async function saveLunaThread(thread) {
  await db.run(
    `INSERT INTO luna_threads (id, type, title, participants, created_at, updated_at, message_count, messages)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET
       type=$2, title=$3, participants=$4, updated_at=$6,
       message_count=$7, messages=$8`,
    [thread.id, thread.type, thread.title, JSON.stringify(thread.participants || []),
     thread.createdAt, thread.updatedAt, thread.messageCount || 0,
     JSON.stringify(thread.messages || [])]
  );
  notifyChange('lunaThreads', await getLunaThreads());
  return thread;
}

async function saveLunaThreads(data) {
  for (const thread of Object.values(data.threads || {})) {
    await saveLunaThread(thread);
  }
  return data;
}

async function deleteLunaThread(id) {
  await db.run('DELETE FROM luna_threads WHERE id = $1', [id]);
  notifyChange('lunaThreads', await getLunaThreads());
}

// ============================================================
// LUNA BUFFER (schema real — NOMES REAIS)
// ============================================================
async function getLunaBuffer() {
  const row = await db.get('SELECT * FROM luna_buffer WHERE id=1');
  if (!row) return {
    newMessages: [], newTasks: [], newTasksDone: [],
    newIdeas: [], newDecisions: [], newLinks: [],
    newLeads: [], newFinance: [], ignoredMessages: [],
    newMentions: [], sentiment: { positive: 0, negative: 0, urgent: 0 },
    lastBufferUpdate: new Date().toISOString()
  };
  return {
    newMessages: row.new_messages || [],
    newTasks: row.new_tasks || [],
    newTasksDone: row.new_tasks_done || [],
    newIdeas: row.new_ideas || [],
    newDecisions: row.new_decisions || [],
    newLinks: row.new_links || [],
    newLeads: row.new_leads || [],
    newFinance: row.new_finance || [],
    ignoredMessages: row.ignored_messages || [],
    newMentions: row.new_mentions || [],
    sentiment: row.sentiment || { positive: 0, negative: 0, urgent: 0 },
    lastBufferUpdate: row.last_buffer_update
  };
}

async function saveLunaBuffer(data) {
  await db.run(
    `INSERT INTO luna_buffer (id, new_messages, new_tasks, new_tasks_done, new_ideas, new_decisions, new_links, new_leads, new_finance, ignored_messages, new_mentions, sentiment, last_buffer_update)
     VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       new_messages=$1, new_tasks=$2, new_tasks_done=$3, new_ideas=$4,
       new_decisions=$5, new_links=$6, new_leads=$7, new_finance=$8,
       ignored_messages=$9, new_mentions=$10, sentiment=$11, last_buffer_update=$12`,
    [
      JSON.stringify(data.newMessages || []),
      JSON.stringify(data.newTasks || []),
      JSON.stringify(data.newTasksDone || []),
      JSON.stringify(data.newIdeas || []),
      JSON.stringify(data.newDecisions || []),
      JSON.stringify(data.newLinks || []),
      JSON.stringify(data.newLeads || []),
      JSON.stringify(data.newFinance || []),
      JSON.stringify(data.ignoredMessages || []),
      JSON.stringify(data.newMentions || []),
      JSON.stringify(data.sentiment || { positive: 0, negative: 0, urgent: 0 }),
      data.lastBufferUpdate || new Date().toISOString()
    ]
  );
  notifyChange('lunaBuffer', await getLunaBuffer());
  return data;
}

// ============================================================
// WORKSPACE CLIENTS (schema real — NOMES REAIS)
// ============================================================
async function getWorkspaceClients() {
  const rows = await db.query('SELECT * FROM workspace_clients ORDER BY criado_em DESC');
  return {
    versao: '1.0',
    ultimaAtualizacao: new Date().toISOString(),
    clientes: rows.map(r => ({
      id: r.id, nome: r.nome, caminho: r.caminho,
      status: r.status, cor: r.cor, responsavel: r.responsavel,
      tipo: r.tipo, dataInicio: r.data_inicio,
      orcamentoTotal: parseFloat(r.orcamento_total), moeda: r.moeda,
      tags: r.tags || [], anotacoes: r.anotacoes,
      criadoEm: r.criado_em, atualizadoEm: r.atualizado_em
    }))
  };
}

async function saveWorkspaceClient(client) {
  await db.run(
    `INSERT INTO workspace_clients (id, nome, caminho, status, cor, responsavel, tipo, data_inicio, orcamento_total, moeda, tags, anotacoes, versao, ultima_atualizacao, criado_em, atualizado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (id) DO UPDATE SET
       nome=$2, caminho=$3, status=$4, cor=$5, responsavel=$6,
       tipo=$7, data_inicio=$8, orcamento_total=$9, moeda=$10,
       tags=$11, anotacoes=$12, versao=$13, ultima_atualizacao=$14,
       atualizado_em=$16`,
    [client.id, client.nome, client.caminho, client.status, client.cor,
     client.responsavel, client.tipo, client.dataInicio,
     client.orcamentoTotal, client.moeda, JSON.stringify(client.tags || []),
     client.anotacoes, '1.0', new Date().toISOString(),
     client.criadoEm, client.atualizadoEm]
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
  getCompanyTasks, saveCompanyTask, deleteCompanyTask,
  getPayments, savePayment, deletePayment,
  getExpenses, saveExpense, deleteExpense,
  getCashBox, saveCashBox,
  getQuotes, saveQuote, deleteQuote,
  getMembers, saveMember, deleteMember,
  getSettings, setSettings,
  getIdeas, saveIdea, deleteIdea,
  getLeads, saveLead, deleteLead,
  getSecurityLogs, saveSecurityLog, deleteSecurityLog,
  getNotifications, saveNotification, deleteNotification,
  getLinks, saveLink, deleteLink,
  getTransactions, saveTransaction, deleteTransaction,
  getChangelog, saveChangelog, deleteChangelog,
  getWhatsappHistory, saveWhatsappMessage, saveWhatsappHistory, deleteWhatsappMessage,
  getLunaThreads, saveLunaThread, saveLunaThreads, deleteLunaThread,
  getLunaBuffer, saveLunaBuffer,
  getWorkspaceClients, saveWorkspaceClient, deleteWorkspaceClient,
};
