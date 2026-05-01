/**
 * NEXO DASHBOARD PRO - Backend Server
 * Express + WebSocket + File-based persistence
 * Self-hosted, VPN-only
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

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
    const days = (Date.now() - new Date(t.createdAt).getTime()) / (1000*60*60*24);
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

// CLI Tools status
app.get('/api/tools', (req, res) => {
  const { execSync } = require('child_process');
  const tools = [
    { name: 'Node.js', cmd: 'node --version' },
    { name: 'npm', cmd: 'npm --version' },
    { name: 'Git', cmd: 'git --version' },
    { name: 'GitHub CLI', cmd: 'gh --version' },
    { name: 'Vercel CLI', cmd: 'vercel --version' },
    { name: 'Supabase CLI', cmd: 'supabase --version' }
  ];
  const results = tools.map(t => {
    try {
      const out = execSync(t.cmd, { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0];
      return { name: t.name, version: out, ok: true };
    } catch {
      return { name: t.name, version: null, ok: false };
    }
  });
  res.json(results);
});

// GitHub repos (mock if not auth'd)
app.get('/api/github-repos', (req, res) => {
  res.json({ repos: [], message: 'Configure GitHub CLI para ver repos' });
});

// Vercel projects (mock)
app.get('/api/vercel-projects', (req, res) => {
  res.json({ projects: [], message: 'Configure Vercel CLI para ver projetos' });
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

// Git push helper
app.post('/api/git-push', (req, res) => {
  const { execSync } = require('child_process');
  try {
    const cwd = req.body.cwd || NEXO_BASE;
    execSync('git add .', { cwd, encoding: 'utf8' });
    execSync(`git commit -m "${req.body.message || 'update'}"`, { cwd, encoding: 'utf8' });
    execSync('git push', { cwd, encoding: 'utf8' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Run allowed commands
app.post('/api/run', (req, res) => {
  const { execSync } = require('child_process');
  const ALLOWED = ['node --version', 'npm --version', 'git status', 'git log --oneline -5'];
  const cmd = req.body.cmd;
  if (!ALLOWED.includes(cmd)) return res.status(403).json({ error: 'Command not allowed' });
  try {
    const out = execSync(cmd, { encoding: 'utf8', timeout: 10000 });
    res.json({ output: out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Catch-all -> SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start
server.listen(PORT, BIND_IP, () => {
  console.log(`🔥 NEXO DASHBOARD PRO rodando em http://${BIND_IP}:${PORT}`);
});
