/**
 * NEXO DASHBOARD PRO - Backend Server
 * Express + WebSocket + File-based persistence
 * Self-hosted, VPN-only
 * 
 * REFACTOR: execSync removido, spawn assíncrono + cache robusto
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const cron = require('node-cron');

// ── Cache + External Services (assíncrono, non-blocking) ──
const CacheManager = require('./cache-manager');
const ExternalServices = require('./external-services');
const cache = new CacheManager(path.join(__dirname, 'cache'));
const external = new ExternalServices(cache);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Config
const PORT = process.env.PORT || 3456;
const BIND_IP = process.env.BIND_IP || '127.0.0.1';
const NEXO_BASE = process.env.NEXO_BASE_PATH || 'C:\\Users\\Administrator\\Documents\\NEXO DIGITAL';
const CLIENTES_DIR = path.join(NEXO_BASE, 'CLIENTES');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// --- Helpers ---
const readJSON = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
};
const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// --- Data Files ---
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GH_USERS_FILE = path.join(DATA_DIR, 'github_users.json');
const VC_USERS_FILE = path.join(DATA_DIR, 'vercel_users.json');
const WAPP_FILE = path.join(DATA_DIR, 'whatsapp-tasks.json');

// Init defaults
if (!fs.existsSync(TASKS_FILE)) writeJSON(TASKS_FILE, []);
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, { active: 'abner', users: { abner: { name: 'Abner', role: 'Admin', color: '#3742fa' }, nonoke: { name: 'Nonoke', role: 'Admin', color: '#2ed573' }, elias: { name: 'Elias', role: 'Admin', color: '#ffa502' } } });
if (!fs.existsSync(GH_USERS_FILE)) writeJSON(GH_USERS_FILE, {});
if (!fs.existsSync(VC_USERS_FILE)) writeJSON(VC_USERS_FILE, {});
if (!fs.existsSync(WAPP_FILE)) writeJSON(WAPP_FILE, []);

// --- Scanner ---
const ALLOWED_CLIENTS = ['JUAN_SORVETERIA_TROPICALE', 'PAULO_SANTAFE'];

function scanClients() {
  const clients = [];
  if (!fs.existsSync(CLIENTES_DIR)) return clients;

  for (const name of ALLOWED_CLIENTS) {
    const clientPath = path.join(CLIENTES_DIR, name);
    if (!fs.existsSync(clientPath)) continue;

    const folders = ['CODIGO', 'DEMOS', 'ENTREGAS', 'PROMPTS', 'RELATORIOS'];
    let health = 0;
    const folderStatus = {};

    for (const f of folders) {
      const fp = path.join(clientPath, f);
      const exists = fs.existsSync(fp);
      folderStatus[f] = exists;
      if (exists) health += 20;
    }

    // Check recency
    const relPath = path.join(clientPath, 'RELATORIOS');
    if (fs.existsSync(relPath)) {
      const files = fs.readdirSync(relPath);
      if (files.length > 0) health += Math.min(files.length * 2, 10);
    }

    clients.push({
      id: name,
      name: name.replace(/_/g, ' '),
      health: Math.min(health, 100),
      folders: folderStatus,
      path: clientPath
    });
  }
  return clients;
}

function getPredictions(clients) {
  const predictions = [];
  const stale = clients.filter(c => c.health < 50);
  if (stale.length > 0) predictions.push({ type: 'warning', msg: `${stale.length} cliente(s) com health < 50%` });

  const tasks = readJSON(TASKS_FILE) || [];
  const pending = tasks.filter(t => !t.completed);
  if (pending.length > 10) predictions.push({ type: 'danger', msg: `Sprint overload: ${pending.length} tarefas pendentes` });

  const oldTasks = tasks.filter(t => {
    if (!t.createdAt) return false;
    const days = (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return days > 14 && !t.completed;
  });
  if (oldTasks.length > 0) predictions.push({ type: 'warning', msg: `${oldTasks.length} tarefas stale (>14 dias)` });

  return predictions;
}

// --- WebSocket ---
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', time: new Date().toISOString() }));
});

// --- API Routes ---

// State
app.get('/api/state', (req, res) => {
  const clients = scanClients();
  const tasks = readJSON(TASKS_FILE) || [];
  const users = readJSON(USERS_FILE);
  res.json({ clients, tasks, users, predictions: getPredictions(clients), timestamp: new Date().toISOString() });
});

// Tasks
app.get('/api/tasks', (req, res) => res.json(readJSON(TASKS_FILE) || []));

app.post('/api/tasks', (req, res) => {
  const tasks = readJSON(TASKS_FILE) || [];
  const task = { id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  tasks.push(task);
  writeJSON(TASKS_FILE, tasks);
  broadcast({ type: 'tasks', data: tasks });
  res.json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  let tasks = readJSON(TASKS_FILE) || [];
  tasks = tasks.map(t => t.id === req.params.id ? { ...t, ...req.body, updatedAt: new Date().toISOString() } : t);
  writeJSON(TASKS_FILE, tasks);
  broadcast({ type: 'tasks', data: tasks });
  res.json(tasks.find(t => t.id === req.params.id));
});

app.delete('/api/tasks/:id', (req, res) => {
  let tasks = readJSON(TASKS_FILE) || [];
  tasks = tasks.filter(t => t.id !== req.params.id);
  writeJSON(TASKS_FILE, tasks);
  broadcast({ type: 'tasks', data: tasks });
  res.json({ ok: true });
});

// Users
app.get('/api/users', (req, res) => res.json(readJSON(USERS_FILE)));

app.post('/api/users/switch', (req, res) => {
  const users = readJSON(USERS_FILE);
  if (users.users[req.body.user]) {
    users.active = req.body.user;
    writeJSON(USERS_FILE, users);
  }
  res.json(users);
});

// CLI Tools status (assíncrono, spawn, cacheado)
app.get('/api/tools', async (req, res) => {
  try {
    const result = await external.getToolsStatus();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GitHub repos (assíncrono, spawn, cacheado)
app.get('/api/github-repos', async (req, res) => {
  try {
    const result = await external.getGitHubRepos();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Vercel projects (assíncrono, spawn, cacheado)
app.get('/api/vercel-projects', async (req, res) => {
  try {
    const result = await external.getVercelProjects();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Predictions
app.get('/api/predictions', (req, res) => {
  res.json(getPredictions(scanClients()));
});

// WhatsApp tasks
app.get('/api/whatsapp', (req, res) => res.json(readJSON(WAPP_FILE) || []));
app.post('/api/whatsapp', (req, res) => {
  const msgs = readJSON(WAPP_FILE) || [];
  msgs.push({ ...req.body, id: Date.now().toString(), time: new Date().toISOString() });
  writeJSON(WAPP_FILE, msgs);
  res.json({ ok: true });
});

// External refresh (força refresh manual de serviço externo)
app.post('/api/external/refresh', async (req, res) => {
  const { service } = req.body; // 'github', 'vercel', 'tools'
  try {
    const result = await external.refreshExternal(service);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Git push helper (spawn assíncrono, timeout 30s)
app.post('/api/git-push', async (req, res) => {
  const cwd = req.body.cwd || NEXO_BASE;
  const message = req.body.message || 'update';

  try {
    // git add .
    const addResult = await cache.spawn('git', ['add', '.'], { cwd }, 30000);
    if (!addResult.ok) {
      return res.status(500).json({ ok: false, error: `git add falhou: ${addResult.error || addResult.stderr}` });
    }

    // git commit
    const commitResult = await cache.spawn('git', ['commit', '-m', message], { cwd }, 30000);
    // commit retorna 1 se não há mudanças — isso é aceitável
    if (!commitResult.ok && !commitResult.stderr?.includes('nothing to commit')) {
      return res.status(500).json({ ok: false, error: `git commit falhou: ${commitResult.error || commitResult.stderr}` });
    }

    // git push
    const pushResult = await cache.spawn('git', ['push'], { cwd }, 30000);
    if (!pushResult.ok) {
      return res.status(500).json({ ok: false, error: `git push falhou: ${pushResult.error || pushResult.stderr}` });
    }

    res.json({ ok: true, output: pushResult.data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Run allowed commands (spawn assíncrono, timeout 10s)
app.post('/api/run', async (req, res) => {
  const ALLOWED = ['node --version', 'npm --version', 'git status', 'git log --oneline -5'];
  const cmd = req.body.cmd;
  if (!ALLOWED.includes(cmd)) return res.status(403).json({ error: 'Command not allowed' });

  try {
    const [command, ...args] = cmd.split(' ');
    const result = await cache.spawn(command, args, {}, 10000);
    if (result.ok) {
      res.json({ output: result.data });
    } else {
      res.status(500).json({ error: result.error || result.stderr, output: result.output });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// === FINANCIAL MODULE — NEXO Dashboard Pro =================================
// ============================================================================

// --- Financial Data Files ---
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const EXPENSES_FILE = path.join(DATA_DIR, 'expenses.json');
const EXPENSE_TEMPLATES_FILE = path.join(DATA_DIR, 'expense-templates.json');
const CASH_BOX_FILE = path.join(DATA_DIR, 'cash-box.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');

// Init financial defaults if missing
if (!fs.existsSync(PAYMENTS_FILE)) writeJSON(PAYMENTS_FILE, []);
if (!fs.existsSync(EXPENSES_FILE)) writeJSON(EXPENSES_FILE, []);
if (!fs.existsSync(EXPENSE_TEMPLATES_FILE)) writeJSON(EXPENSE_TEMPLATES_FILE, []);
if (!fs.existsSync(CASH_BOX_FILE)) writeJSON(CASH_BOX_FILE, { balance: { value: 0, currency: 'EUR' }, lastUpdated: new Date().toISOString(), monthlyIncome: { value: 0, currency: 'EUR' }, monthlyExpenses: { value: 0, currency: 'EUR' }, projectedBalance: { value: 0, currency: 'EUR' }, projectionMonths: 3, incomingPayments: [], outgoingExpenses: [], history: [], alerts: [], settings: { lowBalanceMultiplier: 2, currency: 'EUR', autoDeductRecurring: true, projectionMonths: 3 } });
if (!fs.existsSync(ALERTS_FILE)) writeJSON(ALERTS_FILE, []);

// --- Financial Helpers ---
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function getPaymentTotalInBase(payment) {
  if (payment.totalAmount.currency === 'EUR') return payment.totalAmount.value;
  if (payment.equivalentEUR) return payment.equivalentEUR.value;
  return payment.totalAmount.value;
}

function getTxValueInBase(tx, payment) {
  if (tx.amount.currency === 'EUR') return tx.amount.value;
  if (payment.totalAmount.currency === tx.amount.currency) {
    const baseTotal = getPaymentTotalInBase(payment);
    return (tx.amount.value / payment.totalAmount.value) * baseTotal;
  }
  return tx.amount.value;
}

function recalcPaymentStatus(payment) {
  const totalBase = getPaymentTotalInBase(payment);
  const receivedBase = (payment.transactions || []).reduce((sum, tx) => sum + getTxValueInBase(tx, payment), 0);
  if (receivedBase <= 0) return 'pending';
  if (receivedBase >= totalBase) return 'paid';
  return 'partial';
}

function recalcRevenueSplit(payment) {
  const totalBase = getPaymentTotalInBase(payment);
  const receivedBase = (payment.transactions || []).reduce((sum, tx) => sum + getTxValueInBase(tx, payment), 0);
  const split = payment.revenueSplit || [];
  split.forEach(s => {
    if (s.type === 'company') {
      s.received = receivedBase > 0;
    } else {
      const shareAmount = (s.percent / 100) * totalBase;
      s.received = receivedBase >= shareAmount;
    }
  });
}

function recalcExpenseFullyPaid(expense) {
  const split = expense.splitAmong || [];
  if (split.length === 0) { expense.fullyPaid = true; return; }
  expense.fullyPaid = split.every(pid => expense.paidBy && expense.paidBy[pid] && expense.paidBy[pid].paid);
}

function addCashBoxEntry(entry) {
  const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, history: [] };
  cashBox.history = cashBox.history || [];
  cashBox.balance = cashBox.balance || { value: 0, currency: 'EUR' };
  cashBox.history.push(entry);
  cashBox.lastUpdated = nowISO();
  writeJSON(CASH_BOX_FILE, cashBox);
  return cashBox;
}

function getEquivalentMonthly(expense) {
  if (expense.type !== 'recurring') return 0;
  const val = expense.amount ? (expense.amount.value || 0) : 0;
  switch (expense.period) {
    case 'monthly': return val;
    case 'quarterly': return val / 3;
    case 'annual': return val / 12;
    default: return val;
  }
}

// ============================================================================
// === PAYMENTS (Receitas) ===================================================
// ============================================================================

// GET all payments
app.get('/api/payments', async (req, res) => {
  try {
    const payments = readJSON(PAYMENTS_FILE) || [];
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET payment by id
app.get('/api/payments/:id', async (req, res) => {
  try {
    const payments = readJSON(PAYMENTS_FILE) || [];
    const payment = payments.find(p => p.paymentId === req.params.id || p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new payment
app.post('/api/payments', async (req, res) => {
  try {
    const payments = readJSON(PAYMENTS_FILE) || [];
    const payment = {
      paymentId: req.body.paymentId || generateId('pay'),
      id: req.body.id || req.body.paymentId || generateId('pay'),
      clientId: req.body.clientId || null,
      clientName: req.body.clientName || '',
      clientShortName: req.body.clientShortName || '',
      projectName: req.body.projectName || '',
      projectId: req.body.projectId || '',
      description: req.body.description || '',
      totalAmount: req.body.totalAmount || { value: 0, currency: 'EUR' },
      equivalentEUR: req.body.equivalentEUR || null,
      status: 'pending',
      paymentTerms: req.body.paymentTerms || { type: 'full', splits: [] },
      methodPreferred: req.body.methodPreferred || null,
      methodAccepted: req.body.methodAccepted || ['transfer', 'card', 'cash', 'bizum'],
      revenueSplit: req.body.revenueSplit || [],
      transactions: [],
      notes: req.body.notes || '',
      links: req.body.links || {},
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    payments.push(payment);
    writeJSON(PAYMENTS_FILE, payments);
    broadcast({ type: 'payments', data: payments });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update payment
app.put('/api/payments/:id', async (req, res) => {
  try {
    let payments = readJSON(PAYMENTS_FILE) || [];
    const idx = payments.findIndex(p => p.paymentId === req.params.id || p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Payment not found' });
    payments[idx] = { ...payments[idx], ...req.body, updatedAt: nowISO() };
    writeJSON(PAYMENTS_FILE, payments);
    broadcast({ type: 'payments', data: payments });
    res.json(payments[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST transaction to payment (recalcula status automaticamente)
app.post('/api/payments/:id/transactions', async (req, res) => {
  try {
    let payments = readJSON(PAYMENTS_FILE) || [];
    const idx = payments.findIndex(p => p.paymentId === req.params.id || p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Payment not found' });
    const payment = payments[idx];

    const tx = {
      id: req.body.id || generateId('tx'),
      date: req.body.date || new Date().toISOString().slice(0, 10),
      amount: req.body.amount || { value: 0, currency: 'EUR' },
      method: req.body.method || 'transfer',
      methodLabel: req.body.methodLabel || 'Transferência',
      paidBy: req.body.paidBy || '',
      phase: req.body.phase || 1,
      notes: req.body.notes || '',
      proofOfPayment: req.body.proofOfPayment || null,
      recordedBy: req.body.recordedBy || 'system',
      recordedAt: nowISO()
    };
    payment.transactions = payment.transactions || [];
    payment.transactions.push(tx);

    // Recalc status
    const oldStatus = payment.status;
    payment.status = recalcPaymentStatus(payment);
    payment.updatedAt = nowISO();

    // Recalc revenue split
    recalcRevenueSplit(payment);

    // If status changed to paid or partial, add company share to cash box
    if (oldStatus === 'pending' && (payment.status === 'partial' || payment.status === 'paid')) {
      const txBase = getTxValueInBase(tx, payment);
      const companyShare = txBase * 0.25;
      const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' } };
      const oldBalance = cashBox.balance.value;
      const newBalance = oldBalance + companyShare;
      cashBox.balance.value = parseFloat(newBalance.toFixed(2));
      cashBox.lastUpdated = nowISO();
      cashBox.history = cashBox.history || [];
      cashBox.history.push({
        id: generateId('etx'),
        date: tx.date || new Date().toISOString().slice(0, 10),
        type: 'income',
        amount: parseFloat(companyShare.toFixed(2)),
        source: `${payment.clientShortName || 'Cliente'} — empresa (25%)`,
        balanceAfter: cashBox.balance.value,
        recordedBy: tx.recordedBy || 'system',
        recordedAt: nowISO()
      });
      writeJSON(CASH_BOX_FILE, cashBox);
      broadcast({ type: 'cashbox', data: cashBox });
    }

    writeJSON(PAYMENTS_FILE, payments);
    broadcast({ type: 'payments', data: payments });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET payment split
app.get('/api/payments/:id/split', async (req, res) => {
  try {
    const payments = readJSON(PAYMENTS_FILE) || [];
    const payment = payments.find(p => p.paymentId === req.params.id || p.id === req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment.revenueSplit || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST mark split person as received
app.post('/api/payments/:id/split/:personId/receive', async (req, res) => {
  try {
    let payments = readJSON(PAYMENTS_FILE) || [];
    const idx = payments.findIndex(p => p.paymentId === req.params.id || p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Payment not found' });
    const payment = payments[idx];
    payment.revenueSplit = payment.revenueSplit || [];
    const sIdx = payment.revenueSplit.findIndex(s => s.personId === req.params.personId);
    if (sIdx === -1) return res.status(404).json({ error: 'Person not found in split' });
    payment.revenueSplit[sIdx].received = true;
    payment.updatedAt = nowISO();
    writeJSON(PAYMENTS_FILE, payments);
    broadcast({ type: 'payments', data: payments });
    res.json(payment.revenueSplit[sIdx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// === EXPENSES (Despesas) =====================================================
// ============================================================================

// GET all expenses
app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = readJSON(EXPENSES_FILE) || [];
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new expense
app.post('/api/expenses', async (req, res) => {
  try {
    const expenses = readJSON(EXPENSES_FILE) || [];
    const splitAmong = req.body.splitAmong || [];
    const amountVal = req.body.amount ? (req.body.amount.value || 0) : 0;
    const costPerPerson = splitAmong.length > 0 ? parseFloat((amountVal / splitAmong.length).toFixed(2)) : amountVal;

    const paidBy = {};
    splitAmong.forEach(pid => {
      paidBy[pid] = { paid: false, amount: costPerPerson, paidAt: null, method: null };
    });

    const expense = {
      id: req.body.id || generateId('exp'),
      name: req.body.name || '',
      description: req.body.description || '',
      amount: req.body.amount || { value: 0, currency: 'EUR' },
      costPerPerson: { value: costPerPerson, currency: req.body.amount ? (req.body.amount.currency || 'EUR') : 'EUR' },
      type: req.body.type || 'one_time',
      period: req.body.period || null,
      periodLabel: req.body.periodLabel || '',
      startDate: req.body.startDate || null,
      renewDate: req.body.renewDate || null,
      endDate: req.body.endDate || null,
      category: req.body.category || 'others',
      categoryLabel: req.body.categoryLabel || 'Outros',
      splitAmong,
      paidBy,
      fullyPaid: false,
      autoDeductFromCashBox: req.body.autoDeductFromCashBox !== undefined ? req.body.autoDeductFromCashBox : true,
      notes: req.body.notes || '',
      attachments: [],
      createdBy: req.body.createdBy || 'system',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    expenses.push(expense);
    writeJSON(EXPENSES_FILE, expenses);

    // Update cash box if auto-deduct
    if (expense.autoDeductFromCashBox && amountVal > 0) {
      const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, history: [] };
      const oldBalance = cashBox.balance.value;
      const newBalance = oldBalance - amountVal;
      cashBox.balance.value = parseFloat(newBalance.toFixed(2));
      cashBox.lastUpdated = nowISO();
      cashBox.history = cashBox.history || [];
      cashBox.history.push({
        id: generateId('etx'),
        date: new Date().toISOString().slice(0, 10),
        type: 'expense',
        amount: amountVal,
        source: `${expense.name} — dedução do caixa`,
        balanceAfter: cashBox.balance.value,
        recordedBy: 'system',
        recordedAt: nowISO()
      });
      writeJSON(CASH_BOX_FILE, cashBox);
      broadcast({ type: 'cashbox', data: cashBox });
    }

    broadcast({ type: 'expenses', data: expenses });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update expense
app.put('/api/expenses/:id', async (req, res) => {
  try {
    let expenses = readJSON(EXPENSES_FILE) || [];
    const idx = expenses.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Expense not found' });
    const oldExpense = expenses[idx];
    const updated = { ...oldExpense, ...req.body, updatedAt: nowISO() };

    // Recalc costPerPerson if amount or splitAmong changed
    if (req.body.amount || req.body.splitAmong) {
      const splitAmong = updated.splitAmong || [];
      const amountVal = updated.amount ? (updated.amount.value || 0) : 0;
      updated.costPerPerson = { value: splitAmong.length > 0 ? parseFloat((amountVal / splitAmong.length).toFixed(2)) : amountVal, currency: updated.amount ? (updated.amount.currency || 'EUR') : 'EUR' };
      const newPaidBy = {};
      splitAmong.forEach(pid => {
        const oldEntry = (oldExpense.paidBy && oldExpense.paidBy[pid]) || { paid: false, paidAt: null, method: null };
        newPaidBy[pid] = { ...oldEntry, amount: updated.costPerPerson.value };
      });
      updated.paidBy = newPaidBy;
      recalcExpenseFullyPaid(updated);
    }

    expenses[idx] = updated;
    writeJSON(EXPENSES_FILE, expenses);
    broadcast({ type: 'expenses', data: expenses });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE expense
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    let expenses = readJSON(EXPENSES_FILE) || [];
    const expense = expenses.find(e => e.id === req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    expenses = expenses.filter(e => e.id !== req.params.id);
    writeJSON(EXPENSES_FILE, expenses);
    broadcast({ type: 'expenses', data: expenses });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST pay expense share
app.post('/api/expenses/:id/pay', async (req, res) => {
  try {
    let expenses = readJSON(EXPENSES_FILE) || [];
    const idx = expenses.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Expense not found' });
    const expense = expenses[idx];
    const { personId, method } = req.body;
    if (!personId) return res.status(400).json({ error: 'personId required' });
    expense.paidBy = expense.paidBy || {};
    expense.paidBy[personId] = {
      paid: true,
      amount: expense.costPerPerson ? (expense.costPerPerson.value || 0) : 0,
      paidAt: nowISO(),
      method: method || 'transfer'
    };
    recalcExpenseFullyPaid(expense);
    expense.updatedAt = nowISO();
    writeJSON(EXPENSES_FILE, expenses);
    broadcast({ type: 'expenses', data: expenses });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET expense templates
app.get('/api/expenses/templates', async (req, res) => {
  try {
    const templates = readJSON(EXPENSE_TEMPLATES_FILE) || [];
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create/use expense template
app.post('/api/expenses/templates', async (req, res) => {
  try {
    let templates = readJSON(EXPENSE_TEMPLATES_FILE) || [];
    const template = {
      id: req.body.id || generateId('tmpl'),
      name: req.body.name || '',
      defaultAmount: req.body.defaultAmount || { value: 0, currency: 'EUR' },
      defaultPeriod: req.body.defaultPeriod || 'monthly',
      defaultCategory: req.body.defaultCategory || 'others',
      defaultSplitAmong: req.body.defaultSplitAmong || [],
      autoCreate: req.body.autoCreate !== undefined ? req.body.autoCreate : false,
      autoCreateDaysBefore: req.body.autoCreateDaysBefore || 7,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      usageCount: 1,
      lastUsedAt: nowISO(),
      createdAt: nowISO()
    };
    templates.push(template);
    writeJSON(EXPENSE_TEMPLATES_FILE, templates);
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET search templates (fuzzy partial match on name)
app.get('/api/expenses/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    const templates = readJSON(EXPENSE_TEMPLATES_FILE) || [];
    const expenses = readJSON(EXPENSES_FILE) || [];
    const results = [];
    templates.forEach(t => {
      if (t.name && t.name.toLowerCase().includes(q)) results.push({ type: 'template', ...t });
    });
    expenses.forEach(e => {
      if (e.name && e.name.toLowerCase().includes(q)) results.push({ type: 'expense', ...e });
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// === CASH BOX ================================================================
// ============================================================================

// GET cash box
app.get('/api/cash-box', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' } };
    res.json(cashBox);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET cash box projection (6 meses)
app.get('/api/cash-box/projection', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, incomingPayments: [], outgoingExpenses: [] };
    const payments = readJSON(PAYMENTS_FILE) || [];
    const expenses = readJSON(EXPENSES_FILE) || [];
    const months = parseInt(req.query.months || '6', 10);
    const projection = [];
    let runningBalance = cashBox.balance ? (cashBox.balance.value || 0) : 0;
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = monthDate.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

      let incoming = 0;
      (cashBox.incomingPayments || []).forEach(p => {
        if (!p.expectedDate) return;
        const d = new Date(p.expectedDate);
        if (d >= monthStart && d <= monthEnd) {
          incoming += (p.amount || 0) * (p.probability !== undefined ? p.probability : 1);
        }
      });

      payments.forEach(p => {
        if (p.status === 'paid') return;
        (p.paymentTerms && p.paymentTerms.splits || []).forEach(split => {
          if (!split.dueDate) return;
          const d = new Date(split.dueDate);
          if (d >= monthStart && d <= monthEnd && split.status !== 'paid') {
            const baseAmount = getPaymentTotalInBase(p);
            incoming += (baseAmount * (split.percent || 0) / 100);
          }
        });
      });

      let outgoing = 0;
      (cashBox.outgoingExpenses || []).forEach(e => {
        outgoing += e.equivalentMonthly || 0;
      });
      expenses.forEach(e => {
        if (e.type === 'recurring') outgoing += getEquivalentMonthly(e);
      });

      runningBalance = runningBalance + incoming - outgoing;
      projection.push({
        monthIndex: i,
        monthLabel,
        monthStart: monthStart.toISOString().slice(0, 10),
        monthEnd: monthEnd.toISOString().slice(0, 10),
        incoming: parseFloat(incoming.toFixed(2)),
        outgoing: parseFloat(outgoing.toFixed(2)),
        projectedBalance: parseFloat(runningBalance.toFixed(2))
      });
    }

    res.json({ projection, baseBalance: cashBox.balance.value, currency: cashBox.balance.currency || 'EUR', months });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST manual cash box adjustment
app.post('/api/cash-box/adjust', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, history: [] };
    const adjustment = req.body.amount || 0;
    const oldBalance = cashBox.balance.value;
    const newBalance = oldBalance + adjustment;
    cashBox.balance.value = parseFloat(newBalance.toFixed(2));
    cashBox.lastUpdated = nowISO();
    cashBox.history = cashBox.history || [];
    cashBox.history.push({
      id: generateId('etx'),
      date: new Date().toISOString().slice(0, 10),
      type: adjustment >= 0 ? 'income' : 'expense',
      amount: Math.abs(adjustment),
      source: req.body.reason || 'Ajuste manual',
      balanceAfter: cashBox.balance.value,
      recordedBy: req.body.recordedBy || 'system',
      recordedAt: nowISO()
    });
    writeJSON(CASH_BOX_FILE, cashBox);
    broadcast({ type: 'cashbox', data: cashBox });
    res.json(cashBox);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET cash box history
app.get('/api/cash-box/history', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { history: [] };
    res.json(cashBox.history || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// === FINANCE SUMMARY =========================================================
// ============================================================================

app.get('/api/finance/summary', async (req, res) => {
  try {
    const payments = readJSON(PAYMENTS_FILE) || [];
    const expenses = readJSON(EXPENSES_FILE) || [];
    const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, monthlyIncome: { value: 0 }, monthlyExpenses: { value: 0 } };
    const alerts = readJSON(ALERTS_FILE) || [];

    let totalExpected = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let overduePayments = 0;

    payments.forEach(p => {
      const baseTotal = getPaymentTotalInBase(p);
      totalExpected += baseTotal;
      const received = (p.transactions || []).reduce((sum, tx) => sum + getTxValueInBase(tx, p), 0);
      totalReceived += received;
      totalPending += (baseTotal - received);

      (p.paymentTerms && p.paymentTerms.splits || []).forEach(split => {
        if (split.status === 'paid') return;
        if (split.dueDate) {
          const due = new Date(split.dueDate);
          const daysOverdue = Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24));
          if (daysOverdue > 3) overduePayments++;
        }
      });
    });

    let monthlyExpenses = 0;
    expenses.forEach(e => {
      if (e.type === 'recurring') monthlyExpenses += getEquivalentMonthly(e);
    });

    const summary = {
      totalExpected: parseFloat(totalExpected.toFixed(2)),
      totalReceived: parseFloat(totalReceived.toFixed(2)),
      totalPending: parseFloat(totalPending.toFixed(2)),
      cashBoxBalance: parseFloat((cashBox.balance ? (cashBox.balance.value || 0) : 0).toFixed(2)),
      monthlyIncome: parseFloat((cashBox.monthlyIncome ? (cashBox.monthlyIncome.value || 0) : 0).toFixed(2)),
      monthlyExpenses: parseFloat(monthlyExpenses.toFixed(2)),
      activeClients: payments.length,
      overduePayments,
      alerts: alerts.slice(0, 10)
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// === CRON JOBS ===============================================================
// ============================================================================

function checkAndGenerateAlerts() {
  try {
    const payments = readJSON(PAYMENTS_FILE) || [];
    const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0 }, monthlyExpenses: { value: 0 }, settings: { lowBalanceMultiplier: 2 } };
    const expenses = readJSON(EXPENSES_FILE) || [];
    const alerts = [];
    const now = new Date();

    payments.forEach(p => {
      (p.paymentTerms && p.paymentTerms.splits || []).forEach(split => {
        if (!split.dueDate || split.status === 'paid') return;
        const due = new Date(split.dueDate);
        const daysDiff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 3) {
          alerts.push({
            id: generateId('alert'),
            type: 'overdue',
            severity: 'high',
            message: `${p.clientShortName || 'Cliente'} — ${split.label || 'Pagamento'} atrasado há ${daysDiff} dias`,
            relatedId: p.paymentId || p.id,
            relatedType: 'payment',
            createdAt: nowISO()
          });
        } else if (daysDiff >= -2 && daysDiff <= 0) {
          alerts.push({
            id: generateId('alert'),
            type: 'due_soon',
            severity: 'medium',
            message: `${p.clientShortName || 'Cliente'} — ${split.label || 'Pagamento'} vence em ${Math.abs(daysDiff)} dia(s)`,
            relatedId: p.paymentId || p.id,
            relatedType: 'payment',
            createdAt: nowISO()
          });
        }
      });
    });

    const balance = cashBox.balance ? (cashBox.balance.value || 0) : 0;
    const monthlyExp = cashBox.monthlyExpenses ? (cashBox.monthlyExpenses.value || 0) : 0;
    const multiplier = cashBox.settings ? (cashBox.settings.lowBalanceMultiplier || 2) : 2;
    if (balance < (monthlyExp * multiplier)) {
      alerts.push({
        id: generateId('alert'),
        type: 'low_cash',
        severity: balance < monthlyExp ? 'high' : 'medium',
        message: `Caixa baixo: €${balance.toFixed(2)} < €${(monthlyExp * multiplier).toFixed(2)} (${multiplier}x gastos mensais)`,
        relatedId: 'cash-box',
        relatedType: 'cashbox',
        createdAt: nowISO()
      });
    }

    expenses.forEach(e => {
      if (!e.renewDate) return;
      const renew = new Date(e.renewDate);
      const daysToRenew = Math.floor((renew.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToRenew <= 7 && daysToRenew > 0) {
        alerts.push({
          id: generateId('alert'),
          type: 'expense_renewal_soon',
          severity: 'medium',
          message: `${e.name} — renovação em ${daysToRenew} dia(s) (${e.renewDate})`,
          relatedId: e.id,
          relatedType: 'expense',
          createdAt: nowISO()
        });
      } else if (daysToRenew <= 0) {
        alerts.push({
          id: generateId('alert'),
          type: 'expense_renewal_overdue',
          severity: 'high',
          message: `${e.name} — renovação vencida (${e.renewDate})`,
          relatedId: e.id,
          relatedType: 'expense',
          createdAt: nowISO()
        });
      }
    });

    writeJSON(ALERTS_FILE, alerts);
    broadcast({ type: 'alerts', data: alerts });
    console.log(`[CRON] Alerts checked at ${nowISO()}: ${alerts.length} alertas gerados`);
  } catch (err) {
    console.error('[CRON] Error generating alerts:', err.message);
  }
}

function deductRecurringExpenses() {
  try {
    const expenses = readJSON(EXPENSES_FILE) || [];
    const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, history: [], monthlyExpenses: { value: 0, currency: 'EUR' }, outgoingExpenses: [] };
    let totalDeducted = 0;
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    expenses.forEach(e => {
      if (e.type !== 'recurring' || !e.autoDeductFromCashBox) return;
      const deduction = getEquivalentMonthly(e);
      if (deduction <= 0) return;

      const alreadyDeducted = (cashBox.history || []).some(h => {
        if (!h.source || !h.source.includes(e.name)) return false;
        const hDate = new Date(h.date || h.recordedAt || 0);
        const hMonthKey = `${hDate.getFullYear()}-${String(hDate.getMonth() + 1).padStart(2, '0')}`;
        const hType = h.type === 'expense' || h.type === 'recurring_deduction';
        return hMonthKey === thisMonthKey && hType;
      });

      if (!alreadyDeducted) {
        totalDeducted += deduction;
        cashBox.balance.value = parseFloat((cashBox.balance.value - deduction).toFixed(2));
        cashBox.history.push({
          id: generateId('etx'),
          date: new Date().toISOString().slice(0, 10),
          type: 'recurring_deduction',
          amount: parseFloat(deduction.toFixed(2)),
          source: `${e.name} — dedução mensal (${e.period || 'recorrente'})`,
          balanceAfter: cashBox.balance.value,
          recordedBy: 'system',
          recordedAt: nowISO()
        });
      }
    });

    let monthlyExpenses = 0;
    expenses.forEach(e => {
      if (e.type === 'recurring') monthlyExpenses += getEquivalentMonthly(e);
    });
    cashBox.monthlyExpenses = { value: parseFloat(monthlyExpenses.toFixed(2)), currency: 'EUR' };

    cashBox.outgoingExpenses = expenses
      .filter(e => e.type === 'recurring')
      .map(e => ({
        expenseId: e.id,
        name: e.name,
        amount: e.amount ? (e.amount.value || 0) : 0,
        frequency: e.period || 'monthly',
        equivalentMonthly: parseFloat(getEquivalentMonthly(e).toFixed(2)),
        note: e.notes || ''
      }));

    cashBox.lastUpdated = nowISO();
    writeJSON(CASH_BOX_FILE, cashBox);
    broadcast({ type: 'cashbox', data: cashBox });
    console.log(`[CRON] Recurring expenses deducted at ${nowISO()}: total=€${totalDeducted.toFixed(2)}`);
  } catch (err) {
    console.error('[CRON] Error deducting recurring expenses:', err.message);
  }
}

// Schedule: every 6 hours
const alertCron = cron.schedule('0 */6 * * *', () => {
  checkAndGenerateAlerts();
});

// Schedule: 1st day of each month at 00:00
const expenseCron = cron.schedule('0 0 1 * *', () => {
  deductRecurringExpenses();
});

// Run alert check once on startup
setTimeout(() => {
  checkAndGenerateAlerts();
}, 3000);

console.log('[FINANCE] Financial module loaded. Cron jobs scheduled.');

// Catch-all -> SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start
server.listen(PORT, BIND_IP, () => {
  console.log(`🔥 NEXO DASHBOARD PRO rodando em http://${BIND_IP}:${PORT}`);
});

// ── Background Refresh: tools a cada 10 min ──
setInterval(() => {
  external.refreshExternal('tools').catch(() => {});
}, 10 * 60 * 1000);
