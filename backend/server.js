require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const workspaceManager = require('./workspace-manager');
// ── Cache + External Services (assíncrono, non-blocking) ──
const CacheManager = require('./cache-manager');
const ExternalServices = require('./external-services');
const cache = new CacheManager(path.join(__dirname, 'cache'));
const external = new ExternalServices(cache);

// Gemini Multi-Key Client (rotates keys, handles 429 fallback)
const { genAI, getGeminiResetTime } = require('./services/gemini-client');

// Link Hub v16.1 services
const { fetchLinkPreview, getCachedPreview, classifyUrl } = require('./services/link-preview');
const { restoreAllFromPG, syncFileToPG } = require('./pg-sync');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Config
const PORT = process.env.PORT || 3456;
const BIND_IP = process.env.BIND_IP || '0.0.0.0';
const NEXO_BASE = process.env.NEXO_BASE_PATH || 'C:\\Users\\Administrator\\Documents\\NEXO DIGITAL';
const CLIENTES_DIR = path.join(NEXO_BASE, 'CLIENTES');
const DATA_DIR = path.join(__dirname, 'data');

// ── Luna MODO CONCIERGE v19.0 ──
const { IntentParser } = require('../agents/core/IntentParser.js');
const { ActionExecutor } = require('../agents/core/ActionExecutor.js');
const lunaIntentParser = new IntentParser({
  genAI,
  geminiModel: 'gemini-2.5-flash-lite',
  timeout: 15000
});
const lunaActionExecutor = new ActionExecutor({
  apiBase: `http://localhost:${process.env.PORT || 3456}/api`,
  dataDir: DATA_DIR
});
// Helper para identificar o CEO logado pelo users.json
function resolveDashboardAuthor(reqBodyAuthor) {
  try {
    const usersFile = path.join(DATA_DIR, 'users.json');
    const users = readJSON(usersFile, { active: 'abner', users: {} });
    const activeId = users.active || 'abner';
    const activeUser = users.users?.[activeId] || { name: 'Abner' };
    if (reqBodyAuthor && reqBodyAuthor !== 'CEO') {
      const lower = reqBodyAuthor.toLowerCase();
      if (users.users?.[lower]) return users.users[lower].name || lower;
      return reqBodyAuthor;
    }
    return activeUser.name || activeId;
  } catch {
    return reqBodyAuthor || 'Abner';
  }
}

// ── AUTH & SECURITY CONFIG ──
const JWT_SECRET = process.env.JWT_SECRET || 'nexo-ultra-secret-jwt-key-2026';
const JWT_EXPIRES_IN = '8h';
const SECURITY_LOG_FILE = path.join(DATA_DIR, 'security-log.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

// Middleware: verifica JWT em rotas protegidas
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || req.query.token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
  }
}

// Helper: gerar token JWT
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Helper: validar credenciais
function validateCredentials(username, password) {
  const usersFile = path.join(DATA_DIR, 'users.json');
  const users = readJSON(usersFile, { users: {} });
  const user = users.users?.[username.toLowerCase()];
  if (!user || !user.password) return null;
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return null;
  return { id: username.toLowerCase(), name: user.name, role: user.role, color: user.color };
}

// Helper: obter IP do cliente
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',').map(s => s.trim()).filter(ip => ip && !ip.startsWith('10.') && !ip.startsWith('192.168.') && !ip.startsWith('172.'));
    if (ips.length > 0) return ips[0];
  }
  return req.headers['x-real-ip']
    || req.headers['cf-connecting-ip']
    || req.connection.remoteAddress
    || 'unknown';
}

// Helper: parse robusto de User-Agent
function parseUserAgent(ua) {
  if (!ua || ua === 'unknown') return { browser: 'Desconhecido', os: 'Desconhecido', device: 'Desconhecido', arch: 'Desconhecido', isMobile: false };
  
  // Navegador
  let browser = 'Desconhecido';
  const chrome = ua.match(/Chrome\/[\d.]+/);
  const firefox = ua.match(/Firefox\/[\d.]+/);
  const safari = ua.match(/Safari\/[\d.]+/) && !chrome;
  const edge = ua.match(/Edg\/[\d.]+/);
  const opera = ua.match(/OPR\/[\d.]+/);
  if (edge) browser = edge[0].replace('Edg/', 'Edge ');
  else if (opera) browser = opera[0].replace('OPR/', 'Opera ');
  else if (chrome) browser = chrome[0].replace('/', ' ');
  else if (firefox) browser = firefox[0].replace('/', ' ');
  else if (safari) browser = 'Safari';
  
  // Sistema Operacional
  let os = 'Desconhecido';
  const win = ua.match(/Windows NT [\d.]+/);
  const mac = ua.match(/Mac OS X [\d._]+/);
  const linux = ua.match(/Linux/);
  const android = ua.match(/Android [\d.]+/);
  const ios = ua.match(/iPhone OS [\d._]+/);
  const ios2 = ua.match(/iPad;.*OS [\d._]+/);
  if (android) os = 'Android ' + android[0].replace('Android ', '');
  else if (ios) os = 'iOS ' + ios[0].replace('iPhone OS ', '').replace(/_/g, '.');
  else if (ios2) os = 'iOS ' + ios2[0].match(/[\d._]+/)[0].replace(/_/g, '.');
  else if (win) os = 'Windows ' + win[0].replace('Windows NT ', '');
  else if (mac) os = 'macOS ' + mac[0].replace('Mac OS X ', '').replace(/_/g, '.');
  else if (linux) os = 'Linux';
  
  // Dispositivo
  let device = 'Desktop';
  let isMobile = false;
  if (/Mobile|Android|iPhone|iPad|iPod/.test(ua)) {
    isMobile = true;
    if (/iPhone/.test(ua)) device = 'iPhone';
    else if (/iPad/.test(ua)) device = 'iPad';
    else if (/Android/.test(ua)) {
      const model = ua.match(/Android [\d.]+; ([^;)]+)/);
      device = model ? model[1].trim() : 'Android';
    }
    else device = 'Mobile';
  }
  
  // Arquitetura
  let arch = 'Desconhecido';
  if (/Win64|x64|x86_64/.test(ua)) arch = 'x64';
  else if (/WOW64/.test(ua)) arch = 'x64 (WOW64)';
  else if (/Win32|x86/.test(ua)) arch = 'x86';
  else if (/arm64|aarch64/.test(ua)) arch = 'ARM64';
  else if (/arm/.test(ua)) arch = 'ARM';
  
  return { browser, os, device, arch, isMobile };
}

// Helper: obter localização do IP (async)
async function getIpLocation(ip) {
  // IPs privados/locais
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { country: 'Rede Local', city: 'Servidor Local', region: 'LAN', isp: 'Private Network', org: 'Local' };
  }
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName,isp,org,lat,lon,timezone`);
    const data = await response.json();
    if (data.status === 'success') {
      return {
        country: data.country,
        city: data.city,
        region: data.regionName,
        isp: data.isp,
        org: data.org,
        lat: data.lat,
        lon: data.lon,
        timezone: data.timezone
      };
    }
  } catch (e) {}
  return { country: 'Desconhecido', city: 'Desconhecido', region: '', isp: 'Desconhecido', org: '', lat: null, lon: null, timezone: null };
}

// Helper: logar evento de segurança
async function logSecurityEvent(event) {
  const log = readJSON(SECURITY_LOG_FILE, { version: '1.0', events: [], lastNotifiedAt: null, settings: {} });
  const entry = {
    id: `sec-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...event
  };
  log.events.unshift(entry);
  if (log.events.length > 200) log.events = log.events.slice(0, 200);
  writeJSON(SECURITY_LOG_FILE, log);

  // Broadcast para dashboards em tempo real
  broadcast({ type: 'security:alert', data: entry });

  // Notificação persistente
  addNotification({
    type: 'security_alert',
    title: event.type === 'failed_login' ? '🚨 Login falho detectado' : '⚠️ Alerta de segurança',
    message: event.message || `${event.type} — IP: ${event.ip}`,
    severity: event.severity || 'medium',
    metadata: { eventId: entry.id }
  });

  return entry;
}

// Helper: adicionar notificação persistente
function addNotification({ type, title, message, severity = 'medium', metadata = {} }) {
  const notifs = readJSON(NOTIFICATIONS_FILE, { version: '1.0', notifications: [], lastId: 0 });
  notifs.lastId = (notifs.lastId || 0) + 1;
  notifs.notifications.unshift({
    id: `notif-${notifs.lastId}`,
    type,
    title,
    message,
    severity,
    read: false,
    timestamp: new Date().toISOString(),
    metadata
  });
  if (notifs.notifications.length > 100) notifs.notifications = notifs.notifications.slice(0, 100);
  writeJSON(NOTIFICATIONS_FILE, notifs);
  broadcast({ type: 'notifications:new', data: { unreadCount: notifs.notifications.filter(n => !n.read).length } });
  return notifs.notifications[0];
}

// Helper: enviar alerta no WhatsApp (com rate limiting)
// Retorna { sent: boolean, reason?: string }
async function sendSecurityWhatsAlert(message, opts = {}) {
  const { skipRateLimit = false, skipSettingsCheck = false } = opts;
  const log = readJSON(SECURITY_LOG_FILE, { version: '1.0', events: [], lastNotifiedAt: null, settings: {} });
  const settings = log.settings || {};

  if (!skipSettingsCheck && settings.whatsappAlerts === false) {
    return { sent: false, reason: 'whatsapp_alerts_disabled' };
  }

  // Rate limiting: máximo 1 mensagem a cada 5 minutos (exceto para testes)
  if (!skipRateLimit) {
    const lastNotified = log.lastNotifiedAt ? new Date(log.lastNotifiedAt).getTime() : 0;
    const now = Date.now();
    if (now - lastNotified < 5 * 60 * 1000) {
      return { sent: false, reason: 'rate_limited', retryAfter: Math.ceil((5 * 60 * 1000 - (now - lastNotified)) / 1000) };
    }
  }

  try {
    const WhatsAppSender = require('./services/whatsapp-sender');
    const sender = new WhatsAppSender();
    await sender.sendMessage({ chatName: 'Production', text: message });
    log.lastNotifiedAt = new Date().toISOString();
    writeJSON(SECURITY_LOG_FILE, log);
    return { sent: true };
  } catch (e) {
    console.error('[SECURITY] Falha ao enviar WhatsApp:', e.message);
    return { sent: false, reason: 'send_error', error: e.message };
  }
}

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());
// Health check — DEVE vir antes do static para não ser capturado pelo SPA fallback
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ── DEBUG: Gmail OAuth config ──
app.get('/api/debug/gmail-config', (req, res) => {
  const clientId = process.env.GMAIL_CLIENT_ID || '';
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || '';
  const redirectUri = process.env.GMAIL_REDIRECT_URI || '';

  const analyze = (str, name) => ({
    length: str.length,
    startsWithSpace: str.startsWith(' '),
    endsWithSpace: str.endsWith(' '),
    hasNewline: str.includes('\n'),
    hasCarriageReturn: str.includes('\r'),
    hasTab: str.includes('\t'),
    hasQuotes: str.includes("'") || str.includes('"'),
    firstChars: str.slice(0, 20),
    lastChars: str.slice(-20),
    masked: str.length > 10 ? str.slice(0, 5) + '...' + str.slice(-5) : str,
    expectedLength: name === 'clientId' ? 72 : undefined,
  });

  res.json({
    nodeEnv: process.env.NODE_ENV,
    clientId: analyze(clientId, 'clientId'),
    clientSecret: analyze(clientSecret, 'clientSecret'),
    redirectUri: analyze(redirectUri, 'redirectUri'),
  });
});

app.use(express.static(path.join(__dirname, 'public')));

// --- Helpers ---
const readJSON = (file, defaultValue = null) => {
  try {
    let raw = fs.readFileSync(file, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.substring(1);
    return JSON.parse(raw);
  } catch { return defaultValue; }
};
const writeJSON = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  if (process.env.DATABASE_URL) {
    syncFileToPG(file, data).catch(e => console.error('[pg-sync]', e.message));
  }
};

// ── LUNA CHAT THREADS v1.0 ──
const LUNA_THREADS_FILE = path.join(DATA_DIR, 'luna-chat-threads.json');

function ensureThreadsFile() {
  if (fs.existsSync(LUNA_THREADS_FILE)) return;
  const defaultThreads = {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    threads: {
      abner: {
        id: 'abner', type: 'individual', title: 'Abner + Luna',
        participants: ['abner'], createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), messageCount: 0, messages: []
      },
      nonoke: {
        id: 'nonoke', type: 'individual', title: 'Nonoke + Luna',
        participants: ['nonoke'], createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), messageCount: 0, messages: []
      },
      elias: {
        id: 'elias', type: 'individual', title: 'Elias + Luna',
        participants: ['elias'], createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), messageCount: 0, messages: []
      },
      group: {
        id: 'group', type: 'group', title: 'NEXO + Luna',
        participants: ['abner', 'nonoke', 'elias'], createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), messageCount: 0, messages: []
      }
    }
  };
  writeJSON(LUNA_THREADS_FILE, defaultThreads);
}
ensureThreadsFile();

function loadThreads() {
  return readJSON(LUNA_THREADS_FILE, { threads: {} });
}
function saveThreads(data) {
  data.lastUpdated = new Date().toISOString();
  writeJSON(LUNA_THREADS_FILE, data);
}
function getThread(threadId) {
  const data = loadThreads();
  return data.threads?.[threadId] || null;
}
function addMessageToThread(threadId, message) {
  const data = loadThreads();
  if (!data.threads[threadId]) return null;
  const thread = data.threads[threadId];
  message.id = message.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  message.timestamp = message.timestamp || new Date().toISOString();
  thread.messages.push(message);
  thread.messageCount = thread.messages.length;
  thread.updatedAt = new Date().toISOString();
  // Limita a 500 mensagens por thread (sliding window)
  if (thread.messages.length > 500) {
    thread.messages = thread.messages.slice(-500);
    thread.messageCount = thread.messages.length;
  }
  saveThreads(data);
  return message;
}
function clearThreadMessages(threadId) {
  const data = loadThreads();
  if (!data.threads[threadId]) return false;
  data.threads[threadId].messages = [];
  data.threads[threadId].messageCount = 0;
  data.threads[threadId].updatedAt = new Date().toISOString();
  saveThreads(data);
  return true;
}
function getUserThreads(userId) {
  const data = loadThreads();
  const threads = [];
  for (const [id, thread] of Object.entries(data.threads || {})) {
    // Group ou threads onde o user é participant
    if (thread.type === 'group' || thread.participants?.includes(userId)) {
      threads.push({
        id: thread.id,
        type: thread.type,
        title: thread.title,
        participants: thread.participants,
        messageCount: thread.messageCount,
        updatedAt: thread.updatedAt,
        createdAt: thread.createdAt
      });
    }
  }
  // Ordena por updatedAt desc
  return threads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
function getThreadMessages(threadId, limit = 50, offset = 0) {
  const thread = getThread(threadId);
  if (!thread) return null;
  const msgs = thread.messages || [];
  const total = msgs.length;
  const sliced = msgs.slice(-(offset + limit)).slice(0, limit);
  return {
    threadId,
    total,
    offset,
    limit,
    messages: sliced
  };
}
function buildThreadContext(threadId, limit = 20) {
  const thread = getThread(threadId);
  if (!thread) return [];
  return (thread.messages || []).slice(-limit).map(m => ({
    role: m.role,
    text: m.text,
    author: m.author,
    timestamp: m.timestamp
  }));
}

// --- Schema Loaders v16.0 ---
const SCHEMA_DIR = path.join(__dirname, 'data', 'schema');
const CONFIG_DIR = path.join(__dirname, 'data', 'config');

function loadSchema(filename) {
  try {
    const filePath = path.join(SCHEMA_DIR, filename);
    const data = readJSON(filePath);
    if (data) {
      console.log(`[SCHEMA] Carregado: ${filename}`);
    } else {
      console.error(`[SCHEMA] Erro ao carregar ${filename}: arquivo vazio ou inválido`);
    }
    return data;
  } catch (e) {
    console.error(`[SCHEMA] Erro ao carregar ${filename}:`, e.message);
    return null;
  }
}

function loadConfig(filename) {
  try {
    const filePath = path.join(CONFIG_DIR, filename);
    const data = readJSON(filePath);
    if (data) {
      console.log(`[CONFIG] Carregado: ${filename}`);
    } else {
      console.error(`[CONFIG] Erro ao carregar ${filename}: arquivo vazio ou inválido`);
    }
    return data;
  } catch (e) {
    console.error(`[CONFIG] Erro ao carregar ${filename}:`, e.message);
    return null;
  }
}

// Garantir diretórios existem
if (!fs.existsSync(SCHEMA_DIR)) fs.mkdirSync(SCHEMA_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

// Carregar todos os schemas na inicialização
const schemas = {
  contacts: loadSchema('contacts-map.json'),
  clients: loadSchema('clients-registry.json'),
  projects: loadSchema('projects-registry.json'),
  groups: loadSchema('groups-config.json'),
  version: loadSchema('schema-version.json')
};

const configs = {
  integrations: loadConfig('integrations-config.json'),
  dashboard: loadConfig('luna-dashboard-config.json')
};

// --- Data Files ---
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GH_USERS_FILE = path.join(DATA_DIR, 'github_users.json');
const VC_USERS_FILE = path.join(DATA_DIR, 'vercel_users.json');
const WAPP_FILE = path.join(DATA_DIR, 'whatsapp-tasks.json');

// Init defaults
if (!fs.existsSync(TASKS_FILE)) writeJSON(TASKS_FILE, []);

// Ensure users.json exists with default passwords (7741 for all)
const DEFAULT_PASSWORD_HASH = '$2b$10$KnJlQTb9opcUu2EVPkw56ez410v9.LNBFLNGV200EiXskvMjjnUla'; // hash de '7741'
if (!fs.existsSync(USERS_FILE)) {
  writeJSON(USERS_FILE, {
    active: 'abner',
    users: {
      abner: { name: 'Abner', role: 'Admin', color: '#3742fa', password: DEFAULT_PASSWORD_HASH },
      nonoke: { name: 'Nonoke', role: 'Admin', color: '#2ed573', password: DEFAULT_PASSWORD_HASH },
      elias: { name: 'Elias', role: 'Admin', color: '#ffa502', password: DEFAULT_PASSWORD_HASH }
    }
  });
} else {
  // Garante que usuários existentes tenham senha (proteção contra deploys parciais)
  const usersData = readJSON(USERS_FILE, { users: {} });
  let changed = false;
  for (const key of ['abner', 'nonoke', 'elias']) {
    if (!usersData.users[key]) {
      usersData.users[key] = { name: key.charAt(0).toUpperCase() + key.slice(1), role: 'Admin', color: '#3742fa', password: DEFAULT_PASSWORD_HASH };
      changed = true;
    } else if (!usersData.users[key].password) {
      usersData.users[key].password = DEFAULT_PASSWORD_HASH;
      changed = true;
    }
  }
  if (changed) writeJSON(USERS_FILE, usersData);
}

if (!fs.existsSync(GH_USERS_FILE)) writeJSON(GH_USERS_FILE, {});
if (!fs.existsSync(VC_USERS_FILE)) writeJSON(VC_USERS_FILE, {});
if (!fs.existsSync(WAPP_FILE)) writeJSON(WAPP_FILE, []);

// --- Scanner ---
function scanClients() {
  const clients = [];
  if (!fs.existsSync(CLIENTES_DIR)) return clients;

  // Escanear dinamicamente todos os diretórios de clientes (não hardcoded)
  const clientDirs = fs.readdirSync(CLIENTES_DIR).filter(name => {
    const clientPath = path.join(CLIENTES_DIR, name);
    return fs.statSync(clientPath).isDirectory();
  });

  for (const name of clientDirs) {
    const clientPath = path.join(CLIENTES_DIR, name);

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

// Tasks v16.3 — Evoluído com status workflow, dueDate, prioridade, tipo, comentários

const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
};

app.get('/api/tasks', (req, res) => {
  let tasks = readJSON(TASKS_FILE) || [];
  const { status, assignedTo, priority, taskType, overdue } = req.query;

  if (status) tasks = tasks.filter(t => t.status === status);
  if (assignedTo) tasks = tasks.filter(t => t.assignedTo === assignedTo);
  if (priority) tasks = tasks.filter(t => t.priority === priority);
  if (taskType) tasks = tasks.filter(t => t.taskType === taskType);
  if (overdue === 'true') tasks = tasks.filter(t => isOverdue(t.dueDate) && t.status !== 'completed');

  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const tasks = readJSON(TASKS_FILE) || [];
  const now = new Date().toISOString();
  const task = {
    id: Date.now().toString(),
    title: req.body.title?.trim() || 'Sem título',
    description: req.body.description?.trim() || '',
    status: req.body.status || 'pending',
    priority: req.body.priority || 'medium',
    taskType: req.body.taskType || 'one_time',
    dueDate: req.body.dueDate || null,
    addedBy: req.body.addedBy || 'sistema',
    assignedTo: req.body.assignedTo || null,
    source: req.body.source || 'manual',
    comments: [],
    createdAt: now,
    updatedAt: now
  };
  tasks.push(task);
  writeJSON(TASKS_FILE, tasks);
  broadcast({ type: 'tasks', data: tasks });
  res.json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  let tasks = readJSON(TASKS_FILE) || [];
  const now = new Date().toISOString();
  tasks = tasks.map(t => {
    if (t.id !== req.params.id) return t;
    const updates = { ...req.body, updatedAt: now };
    // Auto-set timestamps baseado no status
    if (updates.status === 'in_progress' && !t.startedAt) updates.startedAt = now;
    if (updates.status === 'completed' && !t.completedAt) updates.completedAt = now;
    if (updates.status && updates.status !== 'completed') updates.completedAt = null;
    return { ...t, ...updates };
  });
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

app.post('/api/tasks/:id/comments', (req, res) => {
  let tasks = readJSON(TASKS_FILE) || [];
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });

  const comment = {
    id: Date.now().toString(),
    text: req.body.text?.trim() || '',
    author: req.user?.userId || req.user?.id || req.body.author || 'sistema',
    createdAt: new Date().toISOString()
  };
  task.comments = task.comments || [];
  task.comments.push(comment);
  task.updatedAt = new Date().toISOString();
  writeJSON(TASKS_FILE, tasks);
  broadcast({ type: 'tasks', data: tasks });
  res.json(comment);
});

// Users
// GET /api/users movido para abaixo de requireAuth (seguro, sem senhas)

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

function normalizeWhatsappBuffer(buffer = {}) {
  const messages = buffer.messages || buffer.newMessages || [];
  const tasks = buffer.tasks || buffer.newTasks || [];
  const ideas = buffer.ideas || buffer.newIdeas || [];
  const decisions = buffer.decisions || buffer.newDecisions || [];
  const links = buffer.links || buffer.newLinks || [];
  const leads = buffer.leads || buffer.newLeads || [];
  const finance = buffer.finance || buffer.newFinance || [];
  const ignoredMessages = buffer.ignoredMessages || [];

  return {
    messages,
    recentMessages: messages.slice(-100).reverse(),
    tasks,
    ideas,
    decisions,
    links,
    leads,
    finance,
    ignoredMessages,
    mentions: buffer.mentions || buffer.newMentions || [],
    totalMessages: messages.length,
    totalTasks: tasks.length,
    totalIdeas: ideas.length,
    totalDecisions: decisions.length,
    totalLinks: links.length,
    totalLeads: leads.length,
    totalFinance: finance.length,
    totalIgnored: ignoredMessages.length,
    totalNewMessages: messages.length,
    lastBufferUpdate: buffer.lastBufferUpdate || buffer.lastUpdated || null,
    timestamp: new Date().toISOString()
  };
}

function readLunaBuffer() {
  const canonical = path.join(DATA_DIR, 'luna-buffer.json');
  const legacy = path.join(__dirname, '..', 'agents', 'luna-buffer.json');
  const fallback = { newMessages: [], newTasks: [], newIdeas: [], newDecisions: [], newLinks: [], newLeads: [], newFinance: [], ignoredMessages: [] };
  const data = readJSON(canonical) || readJSON(legacy) || fallback;
  return normalizeWhatsappBuffer(data);
}

// WhatsApp tasks (legado)
// FIX: /api/whatsapp agora retorna dados REAIS do backend/data/luna-buffer.json
app.get('/api/whatsapp', (req, res) => {
    try {
        res.json(readLunaBuffer());
    } catch (e) {
        // Fallback para legado se erro
        res.json(readJSON(WAPP_FILE) || []);
    }
});
app.post('/api/whatsapp', (req, res) => {
  const msgs = readJSON(WAPP_FILE) || [];
  msgs.push({ ...req.body, id: Date.now().toString(), time: new Date().toISOString() });
  writeJSON(WAPP_FILE, msgs);
  res.json({ ok: true });
});

// WhatsApp Agent v8.0 — Dados do agente inteligente
const AGENT_DATA_FILE = path.join(DATA_DIR, 'whatsapp-agent-data.json');
const REPORT_HISTORY_FILE = path.join(DATA_DIR, 'report-history.json');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const WHATSAPP_HISTORY_FILE = path.join(DATA_DIR, 'whatsapp-history.json');
const BUFFER_FILE = path.join(DATA_DIR, 'luna-buffer.json');
const CHECKPOINT_FILE = path.join(DATA_DIR, 'luna-checkpoint.json');
const CLIENTS_REGISTRY_FILE = path.join(DATA_DIR, 'schema', 'clients-registry.json');

// Ensure reports dir exists
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
if (!fs.existsSync(REPORT_HISTORY_FILE)) writeJSON(REPORT_HISTORY_FILE, { reports: [] });
if (!fs.existsSync(WHATSAPP_HISTORY_FILE)) writeJSON(WHATSAPP_HISTORY_FILE, []);

// Serve report files statically
app.use('/reports', express.static(REPORTS_DIR));

app.get('/api/whatsapp-agent', (req, res) => {
  try {
    const data = readJSON(AGENT_DATA_FILE);
    const buffer = readLunaBuffer();
    const history = readWhatsappHistory();
    const payload = data && !Array.isArray(data) ? data : {};
    
    // Calcular stats a partir do history.json em tempo real (não dos buffers voláteis)
    const historyStats = history.reduce((acc, m) => {
      const cat = m.classification?.category || 'unknown';
      acc.byCategory[cat] = (acc.byCategory[cat] || 0) + 1;
      acc.totalMessages++;
      return acc;
    }, { totalMessages: 0, byCategory: {} });
    
    const stats = {
      ...(payload.stats || {}),
      totalMessages: historyStats.totalMessages,
      totalTasks: historyStats.byCategory['tarefaPendente'] || 0,
      totalIdeas: historyStats.byCategory['ideia'] || 0,
      totalDecisions: historyStats.byCategory['decisao'] || 0,
      totalLinks: historyStats.byCategory['link'] || 0,
      totalLeads: historyStats.byCategory['lead'] || 0,
      totalFinance: historyStats.byCategory['financeiro'] || 0,
      totalIgnored: historyStats.byCategory['ignored'] || 0,
      totalNews: historyStats.byCategory['noticia'] || 0,
      totalUrgency: historyStats.byCategory['urgencia'] || 0,
      historyTotal: history.length,
      // Manter compatibilidade com buffers para itens ainda não no history
      bufferTasks: buffer.newTasks?.length || 0,
      bufferLinks: buffer.newLinks?.length || 0,
      bufferIdeas: buffer.newIdeas?.length || 0,
      bufferLeads: buffer.newLeads?.length || 0,
      bufferFinance: buffer.newFinance?.length || 0
    };
    res.json({
      success: true,
      ...payload,
      ...buffer,
      stats,
      data: { ...payload, ...buffer, stats },
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/whatsapp-agent/status', (req, res) => {
  const data = readJSON(AGENT_DATA_FILE);
  const buffer = readLunaBuffer();
  const history = readWhatsappHistory();
  const hasBufferActivity = (buffer.newTasks?.length || 0) + (buffer.newLinks?.length || 0) + (buffer.newLeads?.length || 0) > 0;
  res.json({
    active: !!data || hasBufferActivity || history.length > 0,
    lastUpdate: data?.updatedAt || buffer.lastBufferUpdate || null,
    historyTotal: history.length,
    stats: data?.stats || buffer
  });
});

function readWhatsappHistory() {
  if (!fs.existsSync(WHATSAPP_HISTORY_FILE)) writeJSON(WHATSAPP_HISTORY_FILE, []);
  const parsed = readJSON(WHATSAPP_HISTORY_FILE);
  return Array.isArray(parsed) ? parsed : (parsed?.messages || []);
}

function writeWhatsappHistory(history) {
  writeJSON(WHATSAPP_HISTORY_FILE, Array.isArray(history) ? history : []);
}

function classificationCategory(classification) {
  if (!classification) return 'unknown';
  if (typeof classification === 'string') return classification;
  return classification.category || classification.label || 'unknown';
}

// Resolve autor a partir do contacts-map.json v16.0
function resolveAuthor(msg) {
  try {
    const contacts = schemas.contacts?.contacts || {};
    const rawAuthor = msg.author || msg.originalAuthor || '';
    const digits = rawAuthor.replace(/\D/g, '');

    // Cores fixas para founders (quando não há avatar configurado)
    const founderColors = {
      'abner': '#3742fa',
      'enoque': '#2ed573',
      'elias': '#ffa502'
    };

    const pickColor = (name) => {
      const n = (name || '').toLowerCase();
      for (const [key, color] of Object.entries(founderColors)) {
        if (n.includes(key)) return color;
      }
      return null;
    };

    // 1. Match exato
    if (contacts[rawAuthor]) {
      const c = contacts[rawAuthor];
      const name = c.displayName || c.shortName || c.fullName || rawAuthor;
      return {
        name,
        shortName: c.shortName || c.displayName || rawAuthor,
        color: c.avatar?.color || pickColor(name) || '#6B7280',
        avatar: c.avatar?.url || null,
        avatarEmoji: c.avatarEmoji || '👤',
        role: c.role || 'member',
        phone: c.phones?.primary || digits || rawAuthor,
        confidence: 1.0
      };
    }

    // 2. Match parcial (últimos 8 dígitos)
    if (digits.length >= 8) {
      const tail = digits.slice(-8);
      for (const [key, c] of Object.entries(contacts)) {
        const keyDigits = key.replace(/\D/g, '');
        if (keyDigits.slice(-8) === tail) {
          const name = c.displayName || c.shortName || c.fullName || rawAuthor;
          return {
            name,
            shortName: c.shortName || c.displayName || rawAuthor,
            color: c.avatar?.color || pickColor(name) || '#6B7280',
            avatar: c.avatar?.url || null,
            avatarEmoji: c.avatarEmoji || '👤',
            role: c.role || 'member',
            phone: c.phones?.primary || digits || rawAuthor,
            confidence: 0.8
          };
        }
      }
    }

    // 3. Match por nome (displayName, shortName, fullName) — para mensagens do Playwright que vêm só com nome
    // Estratégia 3a: extrair nome do início do texto quando autor está como 'Desconhecido'
    let searchName = (msg.authorName || msg.pushName || rawAuthor || '').toLowerCase().trim();
    if ((!searchName || searchName === 'desconhecido' || searchName === '?') && (msg.text || msg.body)) {
      const text = (msg.text || msg.body).toString();
      if (text.includes('\n')) {
        const firstLine = text.split('\n')[0].trim();
        if (firstLine && firstLine.length > 1 && firstLine.length < 30 && !firstLine.includes('http')) {
          searchName = firstLine.toLowerCase();
        }
      }
    }
    if (searchName && searchName !== 'desconhecido' && searchName !== '?') {
      for (const [key, c] of Object.entries(contacts)) {
        const names = [
          (c.displayName || '').toLowerCase(),
          (c.shortName || '').toLowerCase(),
          (c.fullName || '').toLowerCase(),
          (c.codename || '').toLowerCase(),
          ...(c.aliases || []).map(a => a.toLowerCase())
        ];
        // Match exato do nome ou do alias
        if (names.includes(searchName)) {
          const name = c.displayName || c.shortName || c.fullName || searchName;
          return {
            name,
            shortName: c.shortName || c.displayName || searchName,
            color: c.avatar?.color || pickColor(name) || '#6B7280',
            avatar: c.avatar?.url || null,
            avatarEmoji: c.avatarEmoji || '👤',
            role: c.role || 'member',
            phone: c.phones?.primary || digits || rawAuthor,
            confidence: 0.7
          };
        }
        // Match parcial: se o nome de busca está contido em algum nome do contato
        // ou vice-versa (ex: "Enoque" corresponde a "Enoque G Santos Clemente")
        for (const n of names) {
          if (n && (n.includes(searchName) || searchName.includes(n))) {
            const name = c.displayName || c.shortName || c.fullName || searchName;
            return {
              name,
              shortName: c.shortName || c.displayName || searchName,
              color: c.avatar?.color || pickColor(name) || '#6B7280',
              avatar: c.avatar?.url || null,
              avatarEmoji: c.avatarEmoji || '👤',
              role: c.role || 'member',
              phone: c.phones?.primary || digits || rawAuthor,
              confidence: 0.5
            };
          }
        }
      }
    }

    // 4. Fallback: usar pushname (nome de exibição do WhatsApp) quando disponível
    const pushName = msg.pushName || msg.pushname || msg._data?.pushname || msg._data?.notifyName;
    if (pushName && pushName !== 'Desconhecido') {
      return {
        name: pushName,
        shortName: pushName,
        color: pickColor(pushName) || '#6B7280',
        avatar: null,
        avatarEmoji: '👤',
        role: 'member',
        phone: digits || rawAuthor,
        confidence: 0.3
      };
    }

    // 5. Último fallback
    const fallbackName = msg.authorName || msg.originalAuthor || msg.author || 'Desconhecido';
    return {
      name: fallbackName,
      shortName: fallbackName,
      color: '#6B7280',
      avatar: null,
      avatarEmoji: '👤',
      role: 'member',
      phone: digits || rawAuthor,
      confidence: 0
    };
  } catch (e) {
    return {
      name: msg.authorName || msg.author || 'Desconhecido',
      shortName: msg.authorName || msg.author || 'Desconhecido',
      color: '#6B7280',
      avatar: null,
      avatarEmoji: '👤',
      role: 'member',
      phone: msg.author || '',
      confidence: 0
    };
  }
}

app.get('/api/whatsapp/history', (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
    const chat = (req.query.chat || '').toString().trim().toLowerCase();
    let messages = readWhatsappHistory();

    if (chat) {
      messages = messages.filter(m => (m.chat || '').toLowerCase().includes(chat));
    }

    messages = messages
      .slice()
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, limit)
      .map(m => {
        // Re-resolve se o author salvo for 'Desconhecido' ou inválido (permite reprocessamento após melhorias no resolver)
        const hasValidResolved = m.resolvedAuthor && m.resolvedAuthor.name && m.resolvedAuthor.name !== 'Desconhecido';
        const freshResolved = resolveAuthor(m);
        const useFresh = !hasValidResolved || freshResolved.confidence > (m.resolvedAuthor?.confidence || 0);
        return { ...m, resolvedAuthor: useFresh ? freshResolved : m.resolvedAuthor };
      });

    res.json({ success: true, total: messages.length, messages, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// WhatsApp Send — Enviar mensagem via Playwright CDP
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { chatName, text } = req.body;
    if (!chatName || !text) {
      return res.status(400).json({ success: false, error: 'chatName e text obrigatorios' });
    }

    const WhatsAppSender = require('./services/whatsapp-sender');
    const sender = new WhatsAppSender();
    const result = await sender.sendMessage({ chatName, text });

    // Salvar no historico como "enviado pelo dashboard"
    const history = readWhatsappHistory();
    history.unshift({
      id: `sent-${Date.now()}`,
      text,
      body: text,
      author: 'NEXO Dashboard',
      authorName: 'NEXO Dashboard',
      chat: chatName,
      timestamp: new Date().toISOString(),
      sentViaDashboard: true,
      direction: 'outgoing',
      resolvedAuthor: {
        name: 'NEXO Dashboard',
        shortName: 'Dashboard',
        color: '#3b82f6',
        avatarEmoji: '🤖',
        role: 'system',
        confidence: 1.0
      }
    });
    writeWhatsappHistory(history);

    broadcast({ type: 'whatsapp:sent', data: result });
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/classifications/review', (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50));
    const messages = readWhatsappHistory()
      .filter(m => m.classification && m.reviewed !== true)
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, limit)
      .map(m => ({
        id: m.id,
        text: m.text,
        author: m.author,
        chat: m.chat,
        timestamp: m.timestamp,
        classification: m.classification
      }));

    res.json({ success: true, total: messages.length, messages, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/classifications/:id/correct', (req, res) => {
  try {
    const { correctCategory, notes } = req.body || {};
    if (!correctCategory || typeof correctCategory !== 'string') {
      return res.status(400).json({ success: false, error: 'correctCategory is required' });
    }

    const history = readWhatsappHistory();
    const index = history.findIndex(m => m.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'classification not found' });
    }

    const previousCategory = classificationCategory(history[index].classification);
    history[index] = {
      ...history[index],
      reviewed: true,
      correctedCategory: correctCategory,
      reviewedAt: new Date().toISOString(),
      notes: notes || null
    };
    writeWhatsappHistory(history);

    let learningApplied = false;
    try {
      const { SmartClassifier } = require('../agents/SmartClassifier_v16.js');
      const classifier = new SmartClassifier();
      classifier.learnFromCorrection(req.params.id, correctCategory, previousCategory);
      learningApplied = true;
    } catch (learningError) {
      console.warn('[CLASSIFICATIONS] Learning fallback:', learningError.message);
    }

    res.json({
      success: true,
      id: req.params.id,
      previousCategory,
      correctCategory,
      learningApplied,
      message: 'Classification corrected'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/classifications/stats', (req, res) => {
  try {
    const history = readWhatsappHistory().filter(m => m.classification);
    const byCategory = {};
    let reviewed = 0;
    let corrected = 0;

    for (const item of history) {
      const category = item.correctedCategory || classificationCategory(item.classification);
      byCategory[category] = (byCategory[category] || 0) + 1;
      if (item.reviewed === true) reviewed++;
      if (item.correctedCategory && item.correctedCategory !== item.classification?.category) corrected++;
    }

    res.json({
      success: true,
      totalClassified: history.length,
      byCategory,
      reviewed,
      pendingReview: Math.max(0, history.length - reviewed),
      corrected,
      correctionRate: reviewed ? corrected / reviewed : 0,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Trigger manual refresh of WhatsApp agent
app.post('/api/whatsapp-agent/refresh', async (req, res) => {
  try {
    const agentPath = path.join(__dirname, '..', 'agents', 'nexo-whatsapp-agent-v8.mjs');
    
    const child = spawn('node', [agentPath], {
      detached: true,
      stdio: 'ignore',
      cwd: path.join(__dirname, '..')
    });
    child.unref();
    
    res.json({ ok: true, message: 'Agent refresh triggered' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Reports history
app.get('/api/reports/history', (req, res) => {
  const data = readJSON(REPORT_HISTORY_FILE, { reports: [] });
  res.json(data);
});

app.get('/api/reports/latest', (req, res) => {
  const data = readJSON(REPORT_HISTORY_FILE, { reports: [] });
  const latest = data.reports[data.reports.length - 1];
  if (!latest) return res.status(404).json({ error: 'No reports yet' });
  res.json(latest);
});
app.get('/api/luna/reports/history', (req, res) => {
  const data = readJSON(REPORT_HISTORY_FILE) || { reports: [] };
  res.json(data);
});

app.get('/api/luna/reports/latest', (req, res) => {
  const data = readJSON(REPORT_HISTORY_FILE) || { reports: [] };
  const latest = data.reports[data.reports.length - 1];
  if (!latest) return res.status(404).json({ error: 'No reports yet' });
  res.json(latest);
});

app.post('/api/luna/reports/generate', (req, res) => {
  try {
    const p = spawn('node', ['agents/luna-scheduler.mjs', '--force-report'], {
      cwd: path.join(__dirname, '..'),
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    p.unref();
    res.json({ success: true, message: 'Relatorio inteligente iniciado', pid: p.pid });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
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
      // Use companySharePercent from payment config, default to 25%
      const companySharePercent = payment.companySharePercent || 25;
      const companyShare = txBase * (companySharePercent / 100);
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
        source: `${payment.clientShortName || 'Cliente'} — empresa (${companySharePercent}%)`,
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

// PUT editable cash box fields
app.put('/api/cash-box', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, history: [], settings: {} };
    const next = { ...cashBox };
    const currency = req.body.currency || cashBox.balance?.currency || 'EUR';

    if (req.body.balance !== undefined) {
      next.balance = { value: parseFloat(Number(req.body.balance || 0).toFixed(2)), currency };
    }
    if (req.body.monthlyIncome !== undefined) {
      next.monthlyIncome = { value: parseFloat(Number(req.body.monthlyIncome || 0).toFixed(2)), currency };
    }
    if (req.body.monthlyExpenses !== undefined) {
      next.monthlyExpenses = { value: parseFloat(Number(req.body.monthlyExpenses || 0).toFixed(2)), currency };
    }
    if (req.body.projectionMonths !== undefined) {
      next.projectionMonths = Math.max(1, Math.min(24, parseInt(req.body.projectionMonths, 10) || 3));
      next.settings = { ...(next.settings || {}), projectionMonths: next.projectionMonths };
    }

    next.lastUpdated = nowISO();
    writeJSON(CASH_BOX_FILE, next);
    broadcast({ type: 'cashbox', data: next });
    res.json(next);
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

// GET cash box statement (extrato completo tipo banco)
app.get('/api/cash-box/statement', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { history: [], balance: { value: 0, currency: 'EUR' } };
    const payments = readJSON(PAYMENTS_FILE) || [];
    const expenses = readJSON(EXPENSES_FILE) || [];
    
    const { from, to, type, category } = req.query;
    
    // Build statement from cash box history + pending items
    let entries = (cashBox.history || []).map(h => ({
      id: h.id,
      date: h.date,
      type: h.type,
      amount: h.amount,
      description: h.source,
      balanceAfter: h.balanceAfter,
      category: (h.type === 'income' || h.type === 'payment_received') ? 'receita' : 'despesa',
      status: 'completed',
      recordedBy: h.recordedBy,
      note: h.note || ''
    }));
    
    // Add pending payments as "expected income"
    payments.forEach(p => {
      if (p.status === 'pending' || p.status === 'partial') {
        const pendingAmount = (p.totalAmount?.value || 0) - (p.transactions || []).reduce((s, t) => s + (t.amount?.value || 0), 0);
        if (pendingAmount > 0) {
          entries.push({
            id: `pending-${p.paymentId}`,
            date: p.paymentTerms?.splits?.find(s => s.status === 'pending')?.dueDate || p.updatedAt?.slice(0, 10),
            type: 'expected_income',
            amount: pendingAmount,
            description: `${p.clientShortName} — pendente`,
            balanceAfter: null,
            category: 'receita',
            status: 'pending',
            note: p.notes || ''
          });
        }
      }
    });
    
    // Add recurring expenses as "expected expense"
    expenses.forEach(e => {
      if (e.type === 'recurring' && e.autoDeductFromCashBox) {
        const monthly = getEquivalentMonthly(e);
        if (monthly > 0) {
          entries.push({
            id: `recurring-${e.id}`,
            date: e.renewDate || new Date().toISOString().slice(0, 10),
            type: 'expected_expense',
            amount: monthly,
            description: `${e.name} — mensal`,
            balanceAfter: null,
            category: e.category || 'others',
            status: 'recurring',
            note: e.notes || ''
          });
        }
      }
    });
    
    // Filter
    if (from) entries = entries.filter(e => e.date >= from);
    if (to) entries = entries.filter(e => e.date <= to);
    if (type) entries = entries.filter(e => e.type === type || (type === 'income' && e.type === 'expected_income') || (type === 'expense' && e.type === 'expected_expense'));
    if (category) entries = entries.filter(e => e.category === category);
    
    // Sort by date descending
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Calculate running balance for display
    let runningBalance = cashBox.balance.value;
    const statement = entries.map(e => {
      const item = { ...e };
      if (e.status === 'completed') {
        item.displayBalance = e.balanceAfter;
      } else {
        // For pending items, show projected balance
        if (e.type === 'expected_income') {
          runningBalance += e.amount;
        } else if (e.type === 'expected_expense') {
          runningBalance -= e.amount;
        }
        item.displayBalance = runningBalance;
        item.isProjected = true;
      }
      return item;
    });
    
    res.json({
      entries: statement,
      currentBalance: cashBox.balance.value,
      currency: cashBox.balance.currency || 'EUR',
      totalIncome: entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0),
      totalExpense: entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0),
      pendingIncome: entries.filter(e => e.type === 'expected_income').reduce((s, e) => s + e.amount, 0),
      pendingExpense: entries.filter(e => e.type === 'expected_expense').reduce((s, e) => s + e.amount, 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// CRUD CAIXA v2.0 — Entradas Manuais
// ============================================

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function nowISO() {
  return new Date().toISOString();
}

// POST /api/cash-box/entries — Criar entrada manual
app.post('/api/cash-box/entries', async (req, res) => {
  try {
    const { type, amount, description, date, category, note, recordedBy } = req.body;
    if (!type || amount === undefined) {
      return res.status(400).json({ success: false, error: 'type and amount required' });
    }
    if (!['income', 'expense', 'adjustment', 'payment_received'].includes(type)) {
      return res.status(400).json({ success: false, error: "type must be 'income', 'expense', 'adjustment', or 'payment_received'" });
    }
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal < 0) {
      return res.status(400).json({ success: false, error: 'amount must be a positive number' });
    }

    const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, history: [] };
    const oldBalance = parseFloat((cashBox.balance?.value || 0).toFixed(2));
    const delta = (type === 'income' || type === 'payment_received') ? amountVal : -amountVal;
    const newBalance = parseFloat((oldBalance + delta).toFixed(2));

    const entry = {
      id: generateId('etx'),
      date: date || nowISO().slice(0, 10),
      type,
      amount: amountVal,
      description: description || 'Entrada manual',
      category: category || 'manual',
      balanceAfter: newBalance,
      recordedBy: recordedBy || 'system',
      recordedAt: nowISO(),
      note: note || '',
      source: 'manual-entry',
      isActive: true
    };

    cashBox.history.push(entry);
    cashBox.balance = { value: newBalance, currency: cashBox.balance?.currency || 'EUR' };
    cashBox.lastUpdated = nowISO();

    // Audit
    if (!cashBox.auditLog) cashBox.auditLog = [];
    cashBox.auditLog.push({ action: 'entry_create', entryId: entry.id, timestamp: nowISO() });
    if (cashBox.auditLog.length > 50) cashBox.auditLog = cashBox.auditLog.slice(-50);

    writeJSON(CASH_BOX_FILE, cashBox);
    broadcast({ type: 'cashbox', data: cashBox });
    res.json({ success: true, entry, newBalance });
  } catch (err) {
    console.error('[CASH-BOX] Error creating entry:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/cash-box/entries/:id
app.get('/api/cash-box/entries/:id', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { history: [] };
    const entry = cashBox.history?.find(h => h.id === req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: 'Entry not found' });
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/cash-box/entries/:id — Editar entrada
app.put('/api/cash-box/entries/:id', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { history: [] };
    const idx = cashBox.history?.findIndex(h => h.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Entry not found' });

    const oldEntry = cashBox.history[idx];
    const updated = { ...oldEntry, ...req.body, updatedAt: nowISO() };

    // Se amount/type mudou, recalcular saldo desde o início
    if (req.body.amount !== undefined || req.body.type !== undefined) {
      cashBox.history[idx] = updated;
      cashBox.history.sort((a, b) => new Date(a.date) - new Date(b.date));
      let runningBalance = 0;
      cashBox.history.forEach(h => {
        if (h.isActive === false) return;
        const d = (h.type === 'income' || h.type === 'payment_received') ? h.amount : -h.amount;
        runningBalance += d;
        h.balanceAfter = parseFloat(runningBalance.toFixed(2));
      });
      cashBox.balance.value = parseFloat(runningBalance.toFixed(2));
    } else {
      cashBox.history[idx] = updated;
    }

    cashBox.lastUpdated = nowISO();
    if (!cashBox.auditLog) cashBox.auditLog = [];
    cashBox.auditLog.push({ action: 'entry_update', entryId: updated.id, timestamp: nowISO() });
    if (cashBox.auditLog.length > 50) cashBox.auditLog = cashBox.auditLog.slice(-50);

    writeJSON(CASH_BOX_FILE, cashBox);
    broadcast({ type: 'cashbox', data: cashBox });
    res.json({ success: true, entry: updated, newBalance: cashBox.balance.value });
  } catch (err) {
    console.error('[CASH-BOX] Error updating entry:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/cash-box/entries/:id — Soft delete
app.delete('/api/cash-box/entries/:id', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { history: [] };
    const idx = cashBox.history?.findIndex(h => h.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Entry not found' });

    cashBox.history[idx] = {
      ...cashBox.history[idx],
      isActive: false,
      deletedAt: nowISO(),
      deletedBy: req.body.deletedBy || 'system'
    };

    // Recalcular saldo
    cashBox.history.sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    cashBox.history.forEach(h => {
      if (h.isActive === false) return;
      const d = (h.type === 'income' || h.type === 'payment_received') ? h.amount : -h.amount;
      runningBalance += d;
      h.balanceAfter = parseFloat(runningBalance.toFixed(2));
    });
    cashBox.balance.value = parseFloat(runningBalance.toFixed(2));
    cashBox.lastUpdated = nowISO();

    if (!cashBox.auditLog) cashBox.auditLog = [];
    cashBox.auditLog.push({ action: 'entry_soft_delete', entryId: req.params.id, timestamp: nowISO() });
    if (cashBox.auditLog.length > 50) cashBox.auditLog = cashBox.auditLog.slice(-50);

    writeJSON(CASH_BOX_FILE, cashBox);
    broadcast({ type: 'cashbox', data: cashBox });
    res.json({ success: true, removedId: req.params.id, newBalance: cashBox.balance.value });
  } catch (err) {
    console.error('[CASH-BOX] Error deleting entry:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/cash-box/reconcile — Recalcular saldo a partir do histórico
app.post('/api/cash-box/reconcile', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { history: [], balance: { value: 0, currency: 'EUR' } };
    const sorted = [...(cashBox.history || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    sorted.forEach(h => {
      if (h.isActive === false) return;
      const d = (h.type === 'income' || h.type === 'payment_received') ? h.amount : -h.amount;
      runningBalance += d;
      h.balanceAfter = parseFloat(runningBalance.toFixed(2));
    });
    cashBox.history = sorted;
    const oldBalance = cashBox.balance.value;
    cashBox.balance.value = parseFloat(runningBalance.toFixed(2));
    cashBox.lastUpdated = nowISO();

    if (!cashBox.auditLog) cashBox.auditLog = [];
    cashBox.auditLog.push({ action: 'reconcile', oldBalance, newBalance: cashBox.balance.value, timestamp: nowISO() });
    if (cashBox.auditLog.length > 50) cashBox.auditLog = cashBox.auditLog.slice(-50);

    writeJSON(CASH_BOX_FILE, cashBox);
    broadcast({ type: 'cashbox', data: cashBox });
    res.json({ success: true, oldBalance, newBalance: cashBox.balance.value, entryCount: sorted.filter(h => h.isActive !== false).length });
  } catch (err) {
    console.error('[CASH-BOX] Reconcile error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// MODO PAGAMENTO RECEBIDO — Distribuição Automática
// ============================================

const PAYMENT_KEYWORDS = [
  'pagamento', 'receber', 'cobrar', 'entrada', 'faturamento', 'fatura',
  'invoice', 'receita', 'venda', 'cliente pagou', 'pago', 'transferência recebida',
  'parcela', 'quota', 'honorarios', 'fee', 'comissao', 'pagou', 'deposito'
];

function detectPaymentKeywords(text = '') {
  const lower = text.toLowerCase();
  return PAYMENT_KEYWORDS.some(kw => lower.includes(kw));
}

function createDefaultDistribution(totalAmount) {
  const amount = parseFloat(totalAmount);
  const perPerson = parseFloat((amount / 4).toFixed(2));
  // Ajustar último para garantir soma exata
  const remaining = parseFloat((amount - perPerson * 3).toFixed(2));
  return {
    totalAmount: amount,
    splits: [
      { recipientId: 'nexo-abner-001', name: 'Abner', percentage: 25, amount: perPerson, status: 'pending', paidAt: null, avatarEmoji: '🧠', color: '#6B7280' },
      { recipientId: 'nexo-enoque-001', name: 'Enoque', percentage: 25, amount: perPerson, status: 'pending', paidAt: null, avatarEmoji: '⚡', color: '#6B7280' },
      { recipientId: 'nexo-elias-pessoal', name: 'Elias', percentage: 25, amount: perPerson, status: 'pending', paidAt: null, avatarEmoji: '🎯', color: '#6B7280' },
      { recipientId: 'nexo-digital', name: 'NEXO Digital (Reinvestimento)', percentage: 25, amount: remaining, status: 'pending', paidAt: null, avatarEmoji: '🏢', color: '#3742fa' }
    ],
    appliedAt: null,
    appliedBy: null
  };
}

// POST /api/cash-box/payments — Criar pagamento recebido com distribuição
app.post('/api/cash-box/payments', async (req, res) => {
  try {
    const { amount, description, date, source, category, note, applyImmediately } = req.body;
    if (amount === undefined || amount === '') {
      return res.status(400).json({ success: false, error: 'amount required' });
    }
    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      return res.status(400).json({ success: false, error: 'amount must be a positive number' });
    }

    const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, history: [] };
    const oldBalance = parseFloat((cashBox.balance?.value || 0).toFixed(2));
    const newBalance = parseFloat((oldBalance + amountVal).toFixed(2));

    const entry = {
      id: generateId('pay'),
      date: date || nowISO().slice(0, 10),
      type: 'payment_received',
      amount: amountVal,
      description: description || 'Pagamento recebido',
      category: category || 'client-payment',
      balanceAfter: newBalance,
      source: source || 'client',
      note: note || '',
      recordedBy: req.body.recordedBy || 'system',
      recordedAt: nowISO(),
      isActive: true,
      distribution: createDefaultDistribution(amountVal)
    };

    // Se applyImmediately, já aplica a distribuição
    if (applyImmediately) {
      entry.distribution.splits.forEach(split => {
        split.status = 'applied';
        split.appliedAt = nowISO();
      });
      entry.distribution.appliedAt = nowISO();
      entry.distribution.appliedBy = req.body.recordedBy || 'system';

      // Criar sub-entradas de saída para cada fundador (exceto NEXO Digital que fica no caixa)
      entry.distribution.splits.forEach(split => {
        if (split.recipientId === 'nexo-digital') return; // Reinvestimento fica no caixa
        const payoutEntry = {
          id: generateId('etx'),
          date: entry.date,
          type: 'expense',
          amount: split.amount,
          description: `Pagamento a ${split.name} — ${entry.description}`,
          category: 'founder-payout',
          balanceAfter: null, // será recalculado
          source: `split-from-${entry.id}`,
          note: `Distribuição de pagamento: ${split.percentage}% de €${amountVal}`,
          recordedBy: req.body.recordedBy || 'system',
          recordedAt: nowISO(),
          isActive: true,
          parentPaymentId: entry.id,
          recipientId: split.recipientId
        };
        cashBox.history.push(payoutEntry);
      });
    }

    cashBox.history.push(entry);

    // Recalcular saldo
    cashBox.history.sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    cashBox.history.forEach(h => {
      if (h.isActive === false) return;
      const d = (h.type === 'income' || h.type === 'payment_received') ? h.amount : -h.amount;
      runningBalance += d;
      h.balanceAfter = parseFloat(runningBalance.toFixed(2));
    });
    cashBox.balance.value = parseFloat(runningBalance.toFixed(2));
    cashBox.lastUpdated = nowISO();

    if (!cashBox.auditLog) cashBox.auditLog = [];
    cashBox.auditLog.push({
      action: applyImmediately ? 'payment_created_and_applied' : 'payment_created',
      entryId: entry.id,
      amount: amountVal,
      timestamp: nowISO()
    });
    if (cashBox.auditLog.length > 50) cashBox.auditLog = cashBox.auditLog.slice(-50);

    writeJSON(CASH_BOX_FILE, cashBox);
    broadcast({ type: 'cashbox', data: cashBox });
    res.json({ success: true, entry, newBalance: cashBox.balance.value, applied: !!applyImmediately });
  } catch (err) {
    console.error('[CASH-BOX] Error creating payment:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/cash-box/payments/:id/apply-distribution — Aplicar split
app.post('/api/cash-box/payments/:id/apply-distribution', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { history: [] };
    const entry = cashBox.history?.find(h => h.id === req.params.id && h.type === 'payment_received');
    if (!entry) return res.status(404).json({ success: false, error: 'Payment entry not found' });
    if (entry.distribution?.appliedAt) {
      return res.status(400).json({ success: false, error: 'Distribution already applied' });
    }

    entry.distribution.splits.forEach(split => {
      split.status = 'applied';
      split.appliedAt = nowISO();
    });
    entry.distribution.appliedAt = nowISO();
    entry.distribution.appliedBy = req.body.appliedBy || 'system';

    // Criar sub-entradas de saída para cada fundador (exceto NEXO Digital)
    entry.distribution.splits.forEach(split => {
      if (split.recipientId === 'nexo-digital') return;
      const payoutEntry = {
        id: generateId('etx'),
        date: entry.date,
        type: 'expense',
        amount: split.amount,
        description: `Pagamento a ${split.name} — ${entry.description}`,
        category: 'founder-payout',
        balanceAfter: null,
        source: `split-from-${entry.id}`,
        note: `Distribuição de pagamento: ${split.percentage}% de €${entry.amount}`,
        recordedBy: req.body.appliedBy || 'system',
        recordedAt: nowISO(),
        isActive: true,
        parentPaymentId: entry.id,
        recipientId: split.recipientId
      };
      cashBox.history.push(payoutEntry);
    });

    // Recalcular saldo
    cashBox.history.sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    cashBox.history.forEach(h => {
      if (h.isActive === false) return;
      const d = (h.type === 'income' || h.type === 'payment_received') ? h.amount : -h.amount;
      runningBalance += d;
      h.balanceAfter = parseFloat(runningBalance.toFixed(2));
    });
    cashBox.balance.value = parseFloat(runningBalance.toFixed(2));
    cashBox.lastUpdated = nowISO();

    if (!cashBox.auditLog) cashBox.auditLog = [];
    cashBox.auditLog.push({ action: 'distribution_applied', entryId: entry.id, timestamp: nowISO() });
    if (cashBox.auditLog.length > 50) cashBox.auditLog = cashBox.auditLog.slice(-50);

    writeJSON(CASH_BOX_FILE, cashBox);
    broadcast({ type: 'cashbox', data: cashBox });
    res.json({ success: true, entry, newBalance: cashBox.balance.value });
  } catch (err) {
    console.error('[CASH-BOX] Error applying distribution:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/cash-box/payments/:id — Obter pagamento com distribuição
app.get('/api/cash-box/payments/:id', async (req, res) => {
  try {
    const cashBox = readJSON(CASH_BOX_FILE) || { history: [] };
    const entry = cashBox.history?.find(h => h.id === req.params.id && h.type === 'payment_received');
    if (!entry) return res.status(404).json({ success: false, error: 'Payment not found' });
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST quick expense (gastei com tal, adiciono lá)
app.post('/api/expenses/quick', async (req, res) => {
  try {
    const { name, amount, category, categoryLabel, note, deductFromCashBox } = req.body;
    if (!name || amount === undefined) {
      return res.status(400).json({ error: 'name and amount required' });
    }
    
    const expenses = readJSON(EXPENSES_FILE) || [];
    const expense = {
      id: generateId('exp'),
      name: name || 'Despesa',
      description: note || '',
      amount: { value: parseFloat(amount), currency: 'EUR' },
      costPerPerson: { value: parseFloat(amount), currency: 'EUR' },
      type: 'one_time',
      period: null,
      periodLabel: 'Único',
      startDate: new Date().toISOString().slice(0, 10),
      renewDate: null,
      endDate: null,
      category: category || 'others',
      categoryLabel: categoryLabel || 'Outros',
      splitAmong: [],
      paidBy: {},
      fullyPaid: true,
      autoDeductFromCashBox: deductFromCashBox !== false,
      notes: note || '',
      attachments: [],
      createdBy: req.body.createdBy || 'system',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    expenses.push(expense);
    writeJSON(EXPENSES_FILE, expenses);
    
    // Deduct from cash box if enabled
    if (expense.autoDeductFromCashBox && parseFloat(amount) > 0) {
      const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, history: [] };
      const amountVal = parseFloat(amount);
      cashBox.balance.value = parseFloat((cashBox.balance.value - amountVal).toFixed(2));
      cashBox.lastUpdated = nowISO();
      cashBox.history = cashBox.history || [];
      cashBox.history.push({
        id: generateId('etx'),
        date: new Date().toISOString().slice(0, 10),
        type: 'expense',
        amount: amountVal,
        source: `${name} — despesa rápida`,
        balanceAfter: cashBox.balance.value,
        recordedBy: req.body.createdBy || 'system',
        recordedAt: nowISO(),
        note: note || ''
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
      cashBalance: { value: parseFloat((cashBox.balance ? (cashBox.balance.value || 0) : 0).toFixed(2)), currency: cashBox.balance?.currency || 'EUR' },
      balance: { value: parseFloat((cashBox.balance ? (cashBox.balance.value || 0) : 0).toFixed(2)), currency: cashBox.balance?.currency || 'EUR' },
      monthlyIncome: parseFloat((cashBox.monthlyIncome ? (cashBox.monthlyIncome.value || 0) : 0).toFixed(2)),
      monthlyExpenses: parseFloat(monthlyExpenses.toFixed(2)),
      totalIncome: { value: parseFloat(totalReceived.toFixed(2)), currency: 'EUR' },
      totalExpense: { value: parseFloat(monthlyExpenses.toFixed(2)), currency: 'EUR' },
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



// LUNA ACTION ROUTES (CANONICAL) — UNICO BLOCO
// ============================================================================
// Ideas Routes
// ═══════════════════════════════════════════════════════════════════════════════
const ideasRouter = require('./routes/ideas');
app.use('/api/ideas', ideasRouter(requireAuth));

// Catch-all -> SPA
// ── Quotes / Orçamentos ──
const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');

app.get('/api/quotes', (req, res) => {
  const quotes = readJSON(QUOTES_FILE) || [];
  res.json(quotes);
});

app.get('/api/quotes/:id', (req, res) => {
  const quotes = readJSON(QUOTES_FILE) || [];
  const quote = quotes.find(q => q.quoteId === req.params.id);
  if (!quote) return res.status(404).json({ error: 'Orçamento não encontrado' });
  res.json(quote);
});

app.post('/api/quotes', (req, res) => {
  const quotes = readJSON(QUOTES_FILE) || [];
  const newQuote = { ...req.body, quoteId: `quote-${Date.now()}`, createdAt: new Date().toISOString() };
  quotes.push(newQuote);
  writeJSON(QUOTES_FILE, quotes);
  broadcast({ type: 'quotes', data: quotes });
  res.json(newQuote);
});

app.put('/api/quotes/:id', (req, res) => {
  const quotes = readJSON(QUOTES_FILE) || [];
  const idx = quotes.findIndex(q => q.quoteId === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Orçamento não encontrado' });
  quotes[idx] = { ...quotes[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON(QUOTES_FILE, quotes);
  broadcast({ type: 'quotes', data: quotes });
  res.json(quotes[idx]);
});

app.delete('/api/quotes/:id', (req, res) => {
  const quotes = readJSON(QUOTES_FILE) || [];
  const filtered = quotes.filter(q => q.quoteId !== req.params.id);
  writeJSON(QUOTES_FILE, filtered);
  broadcast({ type: 'quotes', data: filtered });
  res.json({ success: true });
});

// ── Operations Center / Centro de Operações ──
const OPS_STATE_FILE = path.join(DATA_DIR, 'ops-state.json');

app.get('/api/ops', (req, res) => {
  const state = readJSON(OPS_STATE_FILE) || {
    alerts: [],
    activeOperations: [],
    recentChanges: [],
    systemHealth: { status: 'ok', lastCheck: new Date().toISOString() }
  };
  res.json(state);
});

app.post('/api/ops/alerts', (req, res) => {
  const state = readJSON(OPS_STATE_FILE) || { alerts: [], activeOperations: [], recentChanges: [], systemHealth: { status: 'ok' } };
  const alert = { id: `alert-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
  state.alerts.unshift(alert);
  if (state.alerts.length > 50) state.alerts = state.alerts.slice(0, 50);
  writeJSON(OPS_STATE_FILE, state);
  broadcast({ type: 'ops', data: state });
  res.json(alert);
});

app.delete('/api/ops/alerts/:id', (req, res) => {
  const state = readJSON(OPS_STATE_FILE) || { alerts: [], activeOperations: [], recentChanges: [], systemHealth: { status: 'ok' } };
  state.alerts = state.alerts.filter(a => a.id !== req.params.id);
  writeJSON(OPS_STATE_FILE, state);
  broadcast({ type: 'ops', data: state });
  res.json({ success: true });
});

app.post('/api/ops/changes', (req, res) => {
  const state = readJSON(OPS_STATE_FILE) || { alerts: [], activeOperations: [], recentChanges: [], systemHealth: { status: 'ok' } };
  const change = { id: `change-${Date.now()}`, ...req.body, timestamp: new Date().toISOString() };
  state.recentChanges.unshift(change);
  if (state.recentChanges.length > 100) state.recentChanges = state.recentChanges.slice(0, 100);
  writeJSON(OPS_STATE_FILE, state);
  broadcast({ type: 'ops', data: state });
  res.json(change);
});

// ── Members ──
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');

app.get('/api/members', (req, res) => {
  const members = readJSON(MEMBERS_FILE) || [];
  res.json(members);
});

app.put('/api/members/:id', (req, res) => {
  const members = readJSON(MEMBERS_FILE) || [];
  const idx = members.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Membro não encontrado' });
  members[idx] = { ...members[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON(MEMBERS_FILE, members);
  broadcast({ type: 'members', data: members });
  res.json(members[idx]);
});

// ═══════════════════════════════════════════════════════════════════════════════
// API FINANCEIRA COMPLETA — CRUD DE TRANSAÇÕES
// ═══════════════════════════════════════════════════════════════════════════════

const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

// Inicializa arquivo de transações se não existir
if (!fs.existsSync(TRANSACTIONS_FILE)) {
  writeJSON(TRANSACTIONS_FILE, []);
}

// GET /api/transactions — Lista todas as transações
app.get('/api/transactions', (req, res) => {
  const transactions = readJSON(TRANSACTIONS_FILE) || [];
  // Ordena por data (mais recente primeiro)
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(transactions);
});

// GET /api/transactions/:id — Uma transação específica
app.get('/api/transactions/:id', (req, res) => {
  const transactions = readJSON(TRANSACTIONS_FILE) || [];
  const tx = transactions.find(t => t.id === req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transação não encontrada' });
  res.json(tx);
});

// POST /api/transactions — Cria nova transação
app.post('/api/transactions', (req, res) => {
  const transactions = readJSON(TRANSACTIONS_FILE) || [];
  const { type, amount, description, category, date, source, notes } = req.body;
  
  if (!type || !amount || !description) {
    return res.status(400).json({ error: 'Tipo, valor e descrição são obrigatórios' });
  }
  
  const newTx = {
    id: `tx-${Date.now()}`,
    type, // 'income' ou 'expense'
    amount: parseFloat(amount),
    currency: 'EUR',
    description,
    category: category || 'outros',
    date: date || new Date().toISOString().split('T')[0],
    source: source || 'manual',
    notes: notes || '',
    createdAt: new Date().toISOString(),
    createdBy: 'abner'
  };
  
  transactions.push(newTx);
  writeJSON(TRANSACTIONS_FILE, transactions);
  
  // Atualiza caixa automaticamente
  updateCashBoxFromTransactions(transactions);
  
  broadcast({ type: 'transactions', data: transactions });
  broadcast({ type: 'cash-box', data: readJSON(CASH_BOX_FILE) });
  
  res.status(201).json(newTx);
});

// PUT /api/transactions/:id — Edita transação
app.put('/api/transactions/:id', (req, res) => {
  const transactions = readJSON(TRANSACTIONS_FILE) || [];
  const idx = transactions.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transação não encontrada' });
  
  transactions[idx] = {
    ...transactions[idx],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  writeJSON(TRANSACTIONS_FILE, transactions);
  updateCashBoxFromTransactions(transactions);
  
  broadcast({ type: 'transactions', data: transactions });
  broadcast({ type: 'cash-box', data: readJSON(CASH_BOX_FILE) });
  
  res.json(transactions[idx]);
});

// DELETE /api/transactions/:id — Remove transação
app.delete('/api/transactions/:id', (req, res) => {
  const transactions = readJSON(TRANSACTIONS_FILE) || [];
  const filtered = transactions.filter(t => t.id !== req.params.id);
  
  if (filtered.length === transactions.length) {
    return res.status(404).json({ error: 'Transação não encontrada' });
  }
  
  writeJSON(TRANSACTIONS_FILE, filtered);
  updateCashBoxFromTransactions(filtered);
  
  broadcast({ type: 'transactions', data: filtered });
  broadcast({ type: 'cash-box', data: readJSON(CASH_BOX_FILE) });
  
  res.json({ success: true, message: 'Transação removida' });
});

// [REMOVED] Rota duplicada /api/finance/summary (linha 1856)
// A rota correta e completa está em ~1422 (inclui payments, expenses, alerts, overdue)
// Removida em 2026-05-08 para evitar sobrescrita da versão completa.

// Função auxiliar: recalcula caixa baseado em transações
function updateCashBoxFromTransactions(transactions) {
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = parseFloat((totalIncome - totalExpense).toFixed(2));

  const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' }, history: [] };

  // ATENÇÃO: NUNCA recriar history[] — ele contém entradas manuais, deduções automáticas,
  // ajustes, e registros de payments/expenses. Apenas atualiza o saldo.
  cashBox.balance = { value: balance, currency: 'EUR' };
  cashBox.lastUpdated = new Date().toISOString();

  // Audit: registrar que houve recálculo automático (não destrutivo)
  if (!cashBox.auditLog) cashBox.auditLog = [];
  cashBox.auditLog.push({
    action: 'auto_recalc_from_transactions',
    newBalance: balance,
    transactionCount: transactions.length,
    timestamp: new Date().toISOString(),
    source: 'updateCashBoxFromTransactions'
  });
  // Manter apenas últimos 50 audit entries
  if (cashBox.auditLog.length > 50) cashBox.auditLog = cashBox.auditLog.slice(-50);

  writeJSON(CASH_BOX_FILE, cashBox);
  broadcast({ type: 'cashbox', data: cashBox });
}


// ═══════════════════════════════════════════════════════════════════════════════
// CHANGELOG / RELEASE NOTES API
// ═══════════════════════════════════════════════════════════════════════════════

const CHANGELOG_FILE = path.join(DATA_DIR, 'changelog.json');
const LINKS_INDEX_FILE = path.join(DATA_DIR, 'links-index.json');
if (!fs.existsSync(LINKS_INDEX_FILE)) {
  writeJSON(LINKS_INDEX_FILE, { links: [], lastUpdated: new Date().toISOString() });
}

function ensureChangelog() {
  if (!fs.existsSync(CHANGELOG_FILE)) {
    const initialData = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      entries: [
        {
          id: 'changelog-001',
          version: '3.1.0',
          title: 'Sistema de Changelog e Release Notes',
          description: 'Novo sistema de notificacoes de atualizacoes no Dashboard. Agora todos os usuarios podem acompanhar o historico de mudancas, novas features e correcoes do app em tempo real.',
          category: 'feature',
          emoji: '✨',
          author: 'Luna',
          tier: 2,
          date: new Date().toISOString(),
          tags: ['changelog', 'ui', 'notificacoes'],
          readBy: [],
        },
        {
          id: 'changelog-002',
          version: '3.1.0',
          title: 'WhatsApp Intelligence v10.2 — Correcao Completa',
          description: 'Sistema de monitoramento WhatsApp totalmente reconstruido. Agora com: scan automatico a cada 10 minutos, relatorios a cada 30 minutos no grupo Production, logica anti-spam (so envia quando ha novidades), e servico Windows permanente que reinicia automaticamente.',
          category: 'whatsapp',
          emoji: '📱',
          author: 'Luna',
          tier: 1,
          date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          tags: ['whatsapp', 'luna', 'automation'],
          readBy: [],
        },
        {
          id: 'changelog-003',
          version: '3.1.0',
          title: 'Sistema Financeiro v3.1 — CRUD Completo',
          description: 'Modulo financeiro unificado com extrato completo, CRUD de transacoes, saldo acumulado, filtros por tipo (entrada/saida), e sincronizacao em tempo real entre todas as abas. Split financeiro: 25% cada (Abner, Nonoke/Enoque, Elias, NEXO Digital).',
          category: 'finance',
          emoji: '💰',
          author: 'Abner',
          tier: 2,
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          tags: ['financeiro', 'crud', 'transacoes'],
          readBy: [],
        },
        {
          id: 'changelog-004',
          version: '3.0.0',
          title: 'Centro de Operacoes NEXO Digital',
          description: 'Dashboard principal com metricas em tempo real, status de projetos, tarefas pendentes, e visao consolidada de todos os clientes e orcamentos.',
          category: 'feature',
          emoji: '✨',
          author: 'Abner',
          tier: 2,
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          tags: ['dashboard', 'operacoes', 'metrics'],
          readBy: [],
        },
        {
          id: 'changelog-005',
          version: '3.0.0',
          title: 'Orcamentos — Sistema de Acompanhamento',
          description: 'Sistema de orcamentos com acompanhamento de pagamentos, parcelas pendentes, e status de cada projeto. Valores e clientes baseados nos dados reais do registro.',
          category: 'feature',
          emoji: '✨',
          author: 'Abner',
          tier: 3,
          date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          tags: ['orcamentos', 'clientes', 'projetos'],
          readBy: [],
        },
        {
          id: 'changelog-006',
          version: '2.5.0',
          title: 'Integracao GitHub + Vercel',
          description: 'Monitoramento de repositorios GitHub e projetos Vercel diretamente no dashboard. Status de deploys, commits recentes, e metricas de CI/CD.',
          category: 'improvement',
          emoji: '🚀',
          author: 'Nonoke',
          tier: 3,
          date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          tags: ['github', 'vercel', 'devops'],
          readBy: [],
        },
        {
          id: 'changelog-007',
          version: '2.0.0',
          title: 'WhatsApp Agent v1.0 — Monitoramento Inicial',
          description: 'Primeira versao do agente Luna para monitoramento de grupos WhatsApp. Extracao de mensagens, deteccao de tarefas, e geracao de relatorios.',
          category: 'whatsapp',
          emoji: '📱',
          author: 'Luna',
          tier: 2,
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          tags: ['whatsapp', 'luna', 'v1'],
          readBy: [],
        },
      ]
    };
    writeJSON(CHANGELOG_FILE, initialData);
  }
}

ensureChangelog();

// GET /api/changelog — Lista todos os updates
app.get('/api/changelog', (req, res) => {
  const data = readJSON(CHANGELOG_FILE) || { entries: [] };
  const { category, limit = 50, unreadOnly } = req.query;
  
  let entries = [...data.entries];
  
  if (category) {
    entries = entries.filter(e => e.category === category);
  }
  
  if (unreadOnly === 'true') {
    const userId = req.headers['x-user-id'] || 'default';
    entries = entries.filter(e => !e.readBy.includes(userId));
  }
  
  entries = entries.slice(0, parseInt(limit));
  
  res.json({
    success: true,
    count: entries.length,
    total: data.entries.length,
    entries: entries.sort((a, b) => new Date(b.date) - new Date(a.date))
  });
});

// GET /api/changelog/latest — Ultimo update
app.get('/api/changelog/latest', (req, res) => {
  const data = readJSON(CHANGELOG_FILE) || { entries: [] };
  const latest = data.entries.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  res.json({ success: true, entry: latest || null });
});

// GET /api/changelog/unread — Contagem de nao lidos
app.get('/api/changelog/unread', (req, res) => {
  const data = readJSON(CHANGELOG_FILE) || { entries: [] };
  const userId = req.headers['x-user-id'] || 'default';
  const unreadCount = data.entries.filter(e => !e.readBy.includes(userId)).length;
  res.json({ success: true, unreadCount, total: data.entries.length });
});

// POST /api/changelog/:id/read — Marcar como lido
app.post('/api/changelog/:id/read', (req, res) => {
  const data = readJSON(CHANGELOG_FILE) || { entries: [] };
  const userId = req.headers['x-user-id'] || 'default';
  const entry = data.entries.find(e => e.id === req.params.id);
  
  if (!entry) {
    return res.status(404).json({ success: false, error: 'Entry not found' });
  }
  
  if (!entry.readBy.includes(userId)) {
    entry.readBy.push(userId);
    writeJSON(CHANGELOG_FILE, data);
  }
  
  res.json({ success: true, message: 'Marked as read' });
});

// POST /api/changelog/:id/unread — Marcar como nao lido
app.post('/api/changelog/:id/unread', (req, res) => {
  const data = readJSON(CHANGELOG_FILE) || { entries: [] };
  const userId = req.headers['x-user-id'] || 'default';
  const entry = data.entries.find(e => e.id === req.params.id);
  
  if (!entry) {
    return res.status(404).json({ success: false, error: 'Entry not found' });
  }
  
  entry.readBy = entry.readBy.filter(id => id !== userId);
  writeJSON(CHANGELOG_FILE, data);
  
  res.json({ success: true, message: 'Marked as unread' });
});

// POST /api/changelog — Criar novo update (admin)
app.post('/api/changelog', (req, res) => {
  const { title, description, category, emoji, tier = 3, tags = [], author = 'Luna' } = req.body;
  
  if (!title || !description || !category) {
    return res.status(400).json({ success: false, error: 'Title, description and category required' });
  }
  
  const data = readJSON(CHANGELOG_FILE) || { entries: [] };
  
  const newEntry = {
    id: `changelog-${Date.now()}`,
    version: data.version || '1.0',
    title,
    description,
    category,
    emoji: emoji || getEmojiForCategory(category),
    author,
    tier: parseInt(tier),
    date: new Date().toISOString(),
    tags,
    readBy: [],
  };
  
  data.entries.unshift(newEntry);
  data.lastUpdated = new Date().toISOString();
  writeJSON(CHANGELOG_FILE, data);
  
  // Notifica via WebSocket
  broadcast({ type: 'changelog:new', entry: newEntry });
  
  res.json({ success: true, entry: newEntry });
});

function getEmojiForCategory(category) {
  const map = {
    feature: '✨',
    improvement: '🚀',
    bugfix: '🐛',
    security: '🔒',
    performance: 'âš¡',
    whatsapp: '📱',
    finance: '💰',
  };
  return map[category] || '📝';
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADS API — Receber formulários do site chatopsmaster.com
// ═══════════════════════════════════════════════════════════════════════════════

const LEADS_FILE = path.join(DATA_DIR, 'leads.json');





// ============================================================================
// === LUNA COMMAND CENTER v14.1 — Rotas de Controle do Agente ==============
// ============================================================================

// Dashboard HTML
app.get('/luna-control', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'luna-control.html'));
});

// 1. Status do Luna
app.get('/api/luna/status', (req, res) => {
    try {
        const checkpointPath = path.join(__dirname, 'data', 'luna-checkpoint.json');
        const bufferPath = path.join(__dirname, 'data', 'luna-buffer.json');
        const history = readWhatsappHistory();

        let checkpoint = { hashes: [], lastScan: null, version: '14.1' };
        let buffer = { newMessages: [], newTasks: [], newIdeas: [] };

        if (fs.existsSync(checkpointPath)) {
            checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
        }
        if (fs.existsSync(bufferPath)) {
            buffer = JSON.parse(fs.readFileSync(bufferPath, 'utf8'));
        }

        // Verificar se o processo do agente está rodando (daemon ou scheduler)
        const { execSync } = require('child_process');
        let isRunning = false;
        let agentPid = null;
        for (const pattern of ['luna-daemon.mjs', 'luna-scheduler.mjs', 'luna-cto-agent.cjs']) {
            try {
                const pidBuf = execSync(`pgrep -f "${pattern}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
                const pids = pidBuf.trim().split('\n').filter(Boolean);
                if (pids.length > 0) {
                    isRunning = true;
                    agentPid = parseInt(pids[0], 10);
                    break;
                }
            } catch { /* não está rodando */ }
        }

        // Verificar conexão com Chrome CDP
        let chromeConnected = false;
        try {
            execSync('curl -s http://localhost:9223/json/version > /dev/null', { timeout: 2000, stdio: 'ignore' });
            chromeConnected = true;
        } catch { /* Chrome offline */ }

        res.json({
            success: true,
            status: isRunning ? 'running' : 'stopped',
            pid: agentPid,
            version: checkpoint.version || '18.0',
            chromeConnected,
            whatsappConnected: isRunning && chromeConnected,
            lastScan: checkpoint.lastScan || buffer.lastBufferUpdate || null,
            totalHashes: checkpoint.hashes?.length || 0,
            historyTotal: history.length,
            bufferMessages: buffer.newMessages?.length || 0,
            bufferTasks: buffer.newTasks?.length || 0,
            bufferIdeas: buffer.newIdeas?.length || 0,
            bufferLinks: buffer.newLinks?.length || 0,
            bufferLeads: buffer.newLeads?.length || 0,
            sentiment: buffer.sentiment || { positive: 0, negative: 0, urgent: 0 }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Logs da Luna (tail)
app.get('/api/luna/logs', (req, res) => {
    try {
        const logPath = path.join(__dirname, '..', 'luna-run.log');
        const lines = parseInt(req.query.lines) || 100;
        if (!fs.existsSync(logPath)) {
            return res.json({ success: true, logs: [], count: 0 });
        }
        const content = fs.readFileSync(logPath, 'utf8');
        const allLines = content.split('\n').filter(Boolean);
        const recent = allLines.slice(-lines);
        res.json({ success: true, logs: recent, count: recent.length, total: allLines.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Controle Start/Stop/Restart
app.post('/api/luna/control', (req, res) => {
    try {
        const { action } = req.body;
        const { execSync } = require('child_process');
        const ROOT = path.join(__dirname, '..');
        
        if (action === 'stop') {
            try {
                execSync('pkill -f "luna-cto-agent.cjs"', { stdio: 'ignore' });
                execSync('pkill -f "luna-watchdog.sh"', { stdio: 'ignore' });
            } catch {}
            return res.json({ success: true, action: 'stop', message: 'Luna desligada.' });
        }
        
        if (action === 'start') {
            try {
                execSync('pgrep -f "luna-cto-agent.cjs"', { stdio: 'ignore' });
                return res.json({ success: true, action: 'start', message: 'Luna ja estava ligada.' });
            } catch {
                const script = `cd ${ROOT}/agents && DISPLAY=:0 nohup node luna-cto-agent.cjs > ${ROOT}/luna-run.log 2>&1 &`;
                execSync(script, { stdio: 'ignore' });
                return res.json({ success: true, action: 'start', message: 'Luna iniciada.' });
            }
        }
        
        if (action === 'restart') {
            try {
                execSync('pkill -f "luna-cto-agent.cjs"', { stdio: 'ignore' });
                execSync('pkill -f "luna-watchdog.sh"', { stdio: 'ignore' });
            } catch {}
            setTimeout(() => {
                try {
                    const script = `cd ${ROOT}/agents && DISPLAY=:0 nohup node luna-cto-agent.cjs > ${ROOT}/luna-run.log 2>&1 &`;
                    execSync(script, { stdio: 'ignore' });
                } catch {}
            }, 2000);
            return res.json({ success: true, action: 'restart', message: 'Luna reiniciando em 2 segundos...' });
        }
        
        res.status(400).json({ error: 'Acao invalida. Use: start, stop, restart' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. Forçar scan
// 5. Extrair mensagens
// 6. Verificar menções
// 7. Verificar links
// 8. Forçar relatório
// 9. Checkpoint
app.get('/api/whatsapp/checkpoint', (req, res) => {
    try {
        const checkpointPath = path.join(__dirname, '..', 'agents', 'luna-checkpoint.json');
        const checkpoint = fs.existsSync(checkpointPath) ? JSON.parse(fs.readFileSync(checkpointPath, 'utf8')) : { hashes: [], lastScan: null, version: '14.1' };
        res.json(checkpoint);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 8. Reset checkpoint
app.delete('/api/whatsapp/checkpoint', (req, res) => {
    try {
        const checkpointPath = path.join(__dirname, '..', 'agents', 'luna-checkpoint.json');
        const emptyCheckpoint = { hashes: [], lastScan: null, version: '14.1', resetAt: new Date().toISOString() };
        fs.writeFileSync(checkpointPath, JSON.stringify(emptyCheckpoint, null, 2), 'utf8');
        res.json({ success: true, message: 'Checkpoint resetado. Próximo scan lerá TODAS as mensagens.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 9. Buffer
app.get('/api/whatsapp/buffer', (req, res) => {
    try {
        const bufferPath = path.join(__dirname, '..', 'agents', 'luna-buffer.json');
        const buffer = fs.existsSync(bufferPath) ? JSON.parse(fs.readFileSync(bufferPath, 'utf8')) : { messages: [] };
        res.json({ buffer });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 10. Limpar buffer
app.delete('/api/whatsapp/buffer', (req, res) => {
    try {
        const bufferPath = path.join(__dirname, '..', 'agents', 'luna-buffer.json');
        const emptyBuffer = { 
            messages: [], tasks: [], ideas: [], decisions: [], 
            links: [], mentions: [], sentiment: { positive: 0, negative: 0, urgent: 0 },
            lastUpdated: new Date().toISOString() 
        };
        fs.writeFileSync(bufferPath, JSON.stringify(emptyBuffer, null, 2), 'utf8');
        res.json({ success: true, message: 'Buffer limpo' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 11. Configurações
app.post('/api/luna/config', (req, res) => {
    res.json({ success: true, config: req.body, message: 'Configurações salvas (requer reinício do daemon para aplicar)' });
});

// 12. Diagnóstico
app.get('/api/luna/diagnose', (req, res) => {
    const errors = [];
    const agentsDir = path.join(__dirname, '..', 'agents');
    const criticalFiles = ['luna-cto-agent.cjs', 'luna-cto-agent.mjs', 'luna-scheduler.mjs', 'luna-daemon.mjs'];

    criticalFiles.forEach(f => {
        if (!fs.existsSync(path.join(agentsDir, f))) {
            errors.push({ type: 'MISSING_FILE', message: `Arquivo faltando: ${f}`, severity: 'critical' });
        }
    });

    // Verificar checkpoint
    const checkpointPath = path.join(agentsDir, 'luna-checkpoint.json');
    if (fs.existsSync(checkpointPath)) {
        try {
            const cp = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
            if (!cp.hashes || !Array.isArray(cp.hashes)) {
                errors.push({ type: 'CORRUPT_CHECKPOINT', message: 'Checkpoint corrompido', severity: 'high' });
            }
        } catch {
            errors.push({ type: 'CORRUPT_CHECKPOINT', message: 'Checkpoint não é JSON válido', severity: 'high' });
        }
    }

    res.json({ errors, healthy: errors.length === 0, timestamp: new Date().toISOString() });
});

// 13. AutoFix
app.post('/api/luna/autofix', (req, res) => {
    const { errorType } = req.body;
    const fixes = {
        'ESM_IMPORT': 'Recriar luna-cto-agent.mjs com createRequire',
        'MISSING_FILE': 'Restaurar do backup working-20260501-214855',
        'CORRUPT_CHECKPOINT': 'Resetar checkpoint para estado vazio',
        'CHROME_CDP': 'Reiniciar Chrome com --remote-debugging-port=9223'
    };

    res.json({ 
        success: true, 
        fixed: false, 
        message: fixes[errorType] || 'AutoFix manual necessário',
        errorType,
        suggestion: fixes[errorType]
    });
});

// 14A. Ligar Luna
// ============================================================================
// ═══════════════════════════════════════════════════════════════════════════════


// LUNA ACTION ROUTES (CANONICAL) — UNICO BLOCO
app.post('/api/luna/start', (req, res) => {
  try {
    const daemonPath = path.join(__dirname, '..', 'agents', 'luna-daemon.mjs');
    const p = spawn('node', [daemonPath], {
      cwd: path.join(__dirname, '..', 'agents'),
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    p.unref();
    res.json({ success: true, message: 'Luna iniciado', pid: p.pid });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/luna/stop', (req, res) => {
  exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', (err, stdout) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    const lines = (stdout || '').split(/\r?\n/).filter(Boolean);
    const killed = [];
    for (const line of lines) {
      if (!line.includes('luna-daemon.mjs') && !line.includes('luna-scheduler.mjs')) continue;
      const pid = Number(line.split(',').pop());
      if (Number.isFinite(pid) && pid > 0) {
        try { process.kill(pid); killed.push(pid); } catch {}
      }
    }
    res.json({ success: true, message: 'Luna parado', killed });
  });
});

app.post('/api/luna/scan', (req, res) => {
  try {
    const p = spawn('node', ['agents/luna-scheduler.mjs', '--force-scan'], {
      cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore', windowsHide: true
    });
    p.unref();
    res.json({ success: true, message: 'Scan iniciado', pid: p.pid });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});app.post('/api/luna/extract', (req, res) => {
  try {
    const mode = req.body?.mode === 'full' ? 'full' : 'normal';
    const reset = !!req.body?.reset;
    const args = ['agents/luna-scheduler.mjs', '--force-scan'];
    if (mode === 'full') args.push('--full');
    if (reset) args.push('--reset-checkpoint');
    const p = spawn('node', args, {
      cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore', windowsHide: true
    });
    p.unref();
    res.json({ success: true, message: 'Extracao iniciada', mode, reset, pid: p.pid });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});app.post('/api/luna/report', (req, res) => {
  try {
    const p = spawn('node', ['agents/luna-scheduler.mjs', '--force-report'], {
      cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore', windowsHide: true
    });
    p.unref();
    res.json({ success: true, message: 'Relatorio iniciado', pid: p.pid });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});app.post('/api/luna/mentions', (req, res) => {
  try {
    const p = spawn('node', ['agents/luna-scheduler.mjs', '--check-mentions'], {
      cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore', windowsHide: true
    });
    p.unref();
    res.json({ success: true, message: 'Verificacao de mencoes iniciada', pid: p.pid });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});app.post('/api/luna/links', (req, res) => {
  try {
    const p = spawn('node', ['agents/luna-scheduler.mjs', '--check-links'], {
      cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore', windowsHide: true
    });
    p.unref();
    res.json({ success: true, message: 'Verificacao de links iniciada', pid: p.pid });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================================
// === LUNA CONTROL CENTER — Comandos Humanizados v4.0 ======================
// ============================================================================

const LUNA_COMMANDS = {
  'acordar': { action: 'start', description: 'Inicia o daemon Luna', category: 'estado', icon: 'Sun' },
  'dormir': { action: 'stop', description: 'Para o daemon Luna', category: 'estado', icon: 'Moon' },
  'status': { action: 'status', description: 'Verifica saude da Luna', category: 'estado', icon: 'Activity' },
  'limpar-memoria': { action: 'clear-buffer', description: 'Limpa o buffer de mensagens', category: 'memoria', icon: 'Trash2' },
  'esquecer-tudo': { action: 'reset-checkpoint', description: 'Reset checkpoint (proximo scan le tudo)', category: 'memoria', icon: 'Eraser' },
  'lembrar': { action: 'save-checkpoint', description: 'Salva estado atual como checkpoint', category: 'memoria', icon: 'Save' },
  'escanear-agora': { action: 'force-scan', description: 'Forca scan imediato do WhatsApp', category: 'acoes', icon: 'Scan' },
  'gerar-relatorio': { action: 'force-report', description: 'Gera relatorio inteligente', category: 'acoes', icon: 'FileText' },
  'verificar-mencoes': { action: 'check-mentions', description: 'Verifica mencoes pendentes', category: 'acoes', icon: 'AtSign' },
  'verificar-links': { action: 'check-links', description: 'Verifica links pendentes', category: 'acoes', icon: 'Link' },
  'atualizar-cache': { action: 'refresh-cache', description: 'Forca refresh de cache externo', category: 'sistema', icon: 'RefreshCw' },
  'reiniciar-backend': { action: 'restart-backend', description: 'Reinicia servidor Express', category: 'sistema', icon: 'Server' },
  'fazer-backup': { action: 'backup-data', description: 'Backup dos arquivos JSON', category: 'sistema', icon: 'Database' },
  'diagnostico': { action: 'diagnose', description: 'Diagnostico completo do sistema', category: 'diagnostico', icon: 'Stethoscope' },
  'autoconserto': { action: 'autofix', description: 'Tenta corrigir erros automaticamente', category: 'diagnostico', icon: 'Wrench' }
};

// GET /api/luna/commands — Lista comandos disponiveis
app.get('/api/luna/commands', (req, res) => {
  res.json({
    success: true,
    commands: Object.entries(LUNA_COMMANDS).map(([key, value]) => ({
      id: key,
      label: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      ...value
    }))
  });
});

// GET /api/projects — Projetos ativos do schema (dinâmico, não hardcoded)
app.get('/api/projects', (req, res) => {
  try {
    const projectsSchema = readJSON(path.join(DATA_DIR, 'schema', 'projects-registry.json'), {});
    const projects = Object.values(projectsSchema.projects || {}).map(p => ({
      id: p.id,
      codename: p.codename,
      name: p.name,
      type: p.type,
      status: p.status,
      priority: p.priority,
      progress: p.progress || 0,
      health: p.status === 'em-progresso' ? 'good' : p.status === 'planejamento' ? 'neutral' : 'warning'
    }));
    res.json({ success: true, projects, count: projects.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/luna/analytics — Dashboard de produtividade v17.0
app.get('/api/luna/analytics', (req, res) => {
  try {
    const buffer = readJSON(BUFFER_FILE, { newTasks: [], newTasksDone: [], newLeads: [], newLinks: [], newFinance: [], newMessages: [] });
    const history = readJSON(HISTORY_FILE, { messages: [] });
    const checkpoint = readJSON(CHECKPOINT_FILE, { processedCount: 0, lastScan: null });

    const tasks = buffer.newTasks || [];
    const tasksDone = buffer.newTasksDone || [];
    const leads = buffer.newLeads || [];
    const finance = buffer.newFinance || [];
    const messages = history.messages || history || [];

    // Calcular métricas
    const p0Tasks = tasks.filter(t => /P0/i.test(t.priority || ''));
    const p1Tasks = tasks.filter(t => /P1/i.test(t.priority || ''));
    
    const hotLeads = leads.filter(l => {
      const txt = (l.context || l.body || '').toLowerCase();
      return /quente|hot|urgente|fechar|contratar/i.test(txt);
    });

    const pendingFinance = finance.filter(f => {
      const txt = (f.body || f.text || '').toLowerCase();
      return /pendente|nao pag|aguardando|cobrar/i.test(txt);
    });

    const completionRate = tasks.length > 0 
      ? Math.round((tasksDone.length / tasks.length) * 100) 
      : 0;

    // Participantes ativos (últimos 7 dias)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentMessages = messages.filter(m => {
      const ts = new Date(m.timestamp || m.time || 0).getTime();
      return ts > sevenDaysAgo;
    });
    const activeParticipants = new Set(recentMessages.map(m => m.author || m.authorName)).size;

    res.json({
      success: true,
      analytics: {
        overview: {
          totalMessagesProcessed: checkpoint.processedCount || 0,
          totalMessagesInHistory: messages.length,
          activeParticipants: activeParticipants,
          lastScan: checkpoint.lastScan
        },
        tasks: {
          total: tasks.length,
          p0: p0Tasks.length,
          p1: p1Tasks.length,
          completed: tasksDone.length,
          completionRate: completionRate,
          overdue: tasks.filter(t => {
            const taskTime = new Date(t.time || t.timestamp || 0).getTime();
            return (Date.now() - taskTime) > 48 * 60 * 60 * 1000 && /P0|P1/i.test(t.priority || '');
          }).length
        },
        leads: {
          total: leads.length,
          hot: hotLeads.length,
          needsFollowUp: leads.filter(l => {
            const leadTime = new Date(l.time || l.timestamp || 0).getTime();
            return (Date.now() - leadTime) > 24 * 60 * 60 * 1000;
          }).length
        },
        finance: {
          total: finance.length,
          pending: pendingFinance.length
        },
        productivity: {
          estimatedTimeSaved: `${Math.round((tasksDone.length * 0.5) + (hotLeads.length * 0.3))}h`,
          tasksCreatedPerWeek: Math.round(tasks.length / 4),
          completionTrend: completionRate > 50 ? 'up' : 'down'
        }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/luna/chat — Chat direto com Luna via LLM
// ── v18.0 NEXO DIRECT: Funções auxiliares para o chat ──
function buildDashboardContext(contextModule = null, contextId = null) {
  try {
    const buffer = readLunaBuffer();
    const tasksFile = path.join(DATA_DIR, 'tasks.json');
    const companyTasksFile = path.join(DATA_DIR, 'company-tasks.json');
    const cashFile = path.join(DATA_DIR, 'cash-box.json');
    const paymentsFile = path.join(DATA_DIR, 'payments.json');
    const expensesFile = path.join(DATA_DIR, 'expenses.json');
    const clientsFile = path.join(SCHEMA_DIR, 'clients-registry.json');

    const tasks = readJSON(tasksFile, []);
    const companyTasksRaw = readJSON(companyTasksFile, {});
    const companyTasks = Array.isArray(companyTasksRaw) ? companyTasksRaw : Object.values(companyTasksRaw.categories || {}).flatMap(c => c.tasks || []);
    const allTasks = [...tasks, ...companyTasks];
    const pendingTasks = allTasks.filter(t => t.status !== 'completed' && t.status !== 'done' && !t.completed);
    const p0 = pendingTasks.filter(t => (t.priority === 'P0' || t.priority === 'high' || t.prioridade === 'P0'));
    const p1 = pendingTasks.filter(t => (t.priority === 'P1' || t.priority === 'medium' || t.prioridade === 'P1'));
    const today = new Date().toISOString().slice(0, 10);
    const completedToday = allTasks.filter(t => {
      const updated = t.updatedAt || t.completedAt || t.doneAt;
      return (t.status === 'completed' || t.status === 'done' || t.completed) && updated && updated.startsWith(today);
    });

    const cash = readJSON(cashFile, { balance: { value: 0, currency: 'EUR' }, history: [] });
    const payments = readJSON(paymentsFile, []);
    const expenses = readJSON(expensesFile, []);
    const clients = readJSON(clientsFile, { clients: {} });

    const pendingPayments = payments.filter(p => p.status !== 'paid' && p.status !== 'received');
    const totalPending = pendingPayments.reduce((s, p) => s + (p.totalAmount || p.amount || 0), 0);
    const monthlyExpenses = expenses.filter(e => {
      const d = e.date || e.createdAt || '';
      return d.startsWith(today.slice(0, 7));
    });
    const totalExpensesMonth = monthlyExpenses.reduce((s, e) => {
      const val = typeof e.amount === 'object' ? (e.amount?.value || 0) : (e.amount || e.valor || 0);
      return s + (parseFloat(val) || 0);
    }, 0);

    const leads = Object.values(clients.clients || {}).filter(c => c.type === 'lead' || c.status === 'potencial' || c.pipelineStatus);
    const leadsNew = leads.filter(l => l.pipelineStatus === 'novo' || l.status === 'novo');

    const whatsappConfig = configs.integrations?.whatsapp || {};
    const ignoreWhatsApp = whatsappConfig.ignored === true;
    const ignoreMessages = whatsappConfig.ignoreMessages !== false;
    const ignoreLinks = whatsappConfig.ignoreLinks === true;
    const ignoreMentions = whatsappConfig.ignoreMentions === true;

    let ctx = `📊 SNAPSHOT NEXO — ${new Date().toLocaleString('pt-BR')}\n\n`;

    // ── CONTEXTO ESPECÍFICO POR MÓDULO ──
    if (contextModule === 'ideas' && contextId) {
      const ideasFile = path.join(DATA_DIR, 'ideas-registry.json');
      const ideasData = readJSON(ideasFile, { ideas: {} });
      const idea = ideasData.ideas?.[contextId];
      if (idea) {
        ctx += `🎯 CONTEXTO ATUAL — IDEIA "${idea.title || idea.id}":\n`;
        ctx += `- Status: ${idea.status || 'rascunho'} | Tipo: ${idea.type || 'outro'} | Prioridade: ${idea.priority || 'media'}\n`;
        if (idea.linkedTo?.clientName) ctx += `- Cliente vinculado: ${idea.linkedTo.clientName}\n`;
        if (idea.tags?.length) ctx += `- Tags: ${idea.tags.join(', ')}\n`;
        if (idea.aiContext?.brainstormHistory?.length) {
          const lastMsgs = idea.aiContext.brainstormHistory.slice(-3);
          ctx += `- Últimas mensagens no chat:\n`;
          lastMsgs.forEach(m => {
            ctx += `  ${m.role === 'user' ? '👤' : '🤖'} ${(m.content || '').slice(0, 80)}${(m.content || '').length > 80 ? '...' : ''}\n`;
          });
        }
        ctx += `\n`;
      }
    }

    if (contextModule === 'email' && contextId) {
      // Contexto de email é carregado dinamicamente pelo chamador
      ctx += `📧 CONTEXTO ATUAL — EMAIL/THREAD: ${contextId}\n`;
      ctx += `(Detalhes do email são passados via context array no body)\n\n`;
    }

    ctx += `📋 TAREFAS:\n`;
    ctx += `- P0: ${p0.length}${p0.length > 0 ? ' (' + p0.slice(0, 3).map(t => `"${(t.title || t.titulo || '').slice(0, 40)}"`).join(', ') + ')' : ''}\n`;
    ctx += `- P1: ${p1.length}\n`;
    ctx += `- P2+: ${pendingTasks.length - p0.length - p1.length}\n`;
    ctx += `- Concluídas hoje: ${completedToday.length}\n`;
    if (pendingTasks.length > 0) {
      const top3 = pendingTasks.slice(0, 3).map(t => `  • ${(t.title || t.titulo || 'Tarefa').slice(0, 50)}${t.assignedTo ? ` (${t.assignedTo})` : ''}`).join('\n');
      ctx += `- Top pendentes:\n${top3}\n`;
    }

    ctx += `\n💰 FINANCEIRO:\n`;
    ctx += `- Caixa: €${(cash.balance?.value || 0).toFixed(2)}\n`;
    ctx += `- Recebimentos pendentes: €${totalPending.toFixed(2)} (${pendingPayments.length} clientes)\n`;
    if (pendingPayments.length > 0) {
      ctx += `- Clientes com pagamento pendente: ${pendingPayments.slice(0, 3).map(p => p.clientName || p.clientId || p.de || 'Cliente').join(', ')}\n`;
    }
    ctx += `- Gastos este mês: €${(typeof totalExpensesMonth === 'number' ? totalExpensesMonth : parseFloat(totalExpensesMonth) || 0).toFixed(2)}\n`;

    ctx += `\n🎣 LEADS:\n`;
    ctx += `- Total no pipeline: ${leads.length}\n`;
    ctx += `- Novos: ${leadsNew.length}\n`;

    if (!ignoreWhatsApp) {
      const whatsappFile = path.join(DATA_DIR, 'whatsapp-history.json');
      const whatsappHistory = readJSON(whatsappFile, []);
      const mentions = whatsappHistory.filter(m => /@(?:LUNA|KIMI|KIMICLAW)/i.test(m.body || m.text || ''));
      const pendingMentions = mentions.filter(m => !m.responded);
      const links = buffer.newLinks || [];
      ctx += `\n💬 WHATSAPP:\n`;
      if (!ignoreMentions) ctx += `- Menções @Luna pendentes: ${pendingMentions.length}\n`;
      if (!ignoreLinks) ctx += `- Links pendentes: ${links.length}\n`;
      if (!ignoreMessages) ctx += `- Mensagens novas no buffer: ${buffer.newMessages?.length || 0}\n`;
    }

    return ctx;
  } catch (e) {
    console.error('[buildDashboardContext] Erro:', e.message);
    return '- Dados temporariamente indisponíveis.';
  }
}

function buildChatFallbackReply(userMessage) {
  const buffer = readLunaBuffer();
  const tasks = (buffer.newTasks || []).filter(t => !t.done);
  const p0 = tasks.filter(t => t.priority === 'P0');
  const p1 = tasks.filter(t => t.priority === 'P1');
  const leads = buffer.newLeads || [];
  const expenses = buffer.newFinance || [];
  
  const msg = userMessage.toLowerCase();
  
  // Comandos de tarefa
  if (msg.includes('tarefa') || msg.includes('task') || msg.includes('pendente') || msg.includes('fazer') || msg.includes('criar') || msg.includes('anota')) {
    if (p0.length > 0) return `🔴 ${p0.length} P0 pendente(s)\n🟠 ${p1.length} P1(s)\n\nTô sem conexão com o cérebro agora, mas os dados locais funcionam! Quer que eu detalhe alguma tarefa?`;
    if (tasks.length > 0) return `📋 ${tasks.length} tarefa(s) pendente(s)\n\nTô rodando no modo offline. Quer que eu liste?`;
    return `✅ Radar de tarefas limpo! Nada pendente no momento.\n\n(rodando em modo fallback)`;
  }
  
  // Comandos de lead/cliente
  if (msg.includes('lead') || msg.includes('cliente') || msg.includes('potencial') || msg.includes('novo cliente')) {
    if (leads.length > 0) return `🎣 ${leads.length} lead(s) no radar.\n\nQuer que eu mostre os detalhes?`;
    return `🎣 Nenhum lead novo no momento.\n\n(rodando em modo fallback)`;
  }
  
  // Comandos financeiros
  if (msg.includes('dinheiro') || msg.includes('pagamento') || msg.includes('recebi') || msg.includes('gastei') || msg.includes('despesa') || msg.includes('caixa') || msg.includes('saldo')) {
    const totalExpenses = expenses.reduce((s, e) => s + (e.valor || 0), 0);
    return `💰 Modo fallback ativo.\n\n${expenses.length} movimentação(ões) registrada(s). Total de despesas: €${totalExpenses.toFixed(2)}\n\nQuer ver o detalhamento?`;
  }
  
  // Comandos de status/panorama
  if (msg.includes('status') || msg.includes('panorama') || msg.includes('resumo') || msg.includes('tudo bem') || msg.includes('como anda') || msg.includes('oi') || msg.includes('olá') || msg.includes('opa')) {
    let reply = `👋 Tô aqui! (modo fallback)\n\n📊 Resumo rápido:\n• Tarefas: ${tasks.length} (${p0.length} P0, ${p1.length} P1)\n• Leads: ${leads.length}`;
    if (buffer.newMessages?.length > 0) reply += `\n• WhatsApp: ${buffer.newMessages.length} mensagem(ões)`;
    reply += `\n\n💡 Tenta de novo em alguns minutos ou use comandos diretos como:\n"criar tarefa X", "registrar despesa de 50 em Y", "status"`;
    return reply;
  }
  
  // Comandos de email
  if (msg.includes('email') || msg.includes('gmail') || msg.includes('correio')) {
    return `📧 O módulo de email está ativo!\n\nVai na aba "Comunicação → Email" para conectar teu Gmail e gerenciar emails com a minha ajuda.\n\n(ou tenta de novo daqui a pouco se quiser falar por aqui)`;
  }
  
  // Fallback genérico mais útil
  return `🤔 Entendi "${userMessage.substring(0, 30)}${userMessage.length > 30 ? '...' : ''}"\n\nTô no modo fallback agora (sem conexão com o cérebro). Mas ainda consigo ajudar com:\n• Criar/listar tarefas\n• Registrar pagamentos/despesas\n• Consultar leads\n• Resumo de status\n\nTenta reformular ou espera alguns minutos!`;
}
// ────────────────────────────────────────────────────────

// ============================================================
// POST /api/luna/understand — NLU Engine (NLP.js)
// Classifica intenção, extrai entidades, retorna confidence
// Funciona 100% offline — não depende de API externa
// ============================================================
app.post('/api/luna/understand', requireAuth, async (req, res) => {
  try {
    const { text, lang } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Texto obrigatório' });
    }

    const result = await lunaNLU.process(text.trim(), lang);

    res.json({
      success: true,
      text: text.trim(),
      intent: result.intent,
      domain: result.domain,
      score: result.score,
      action: result.action,
      entities: result.entities,
      answer: result.answer,
      language: result.language,
      suggestions: result.suggestions || null,
      sentiment: result.sentiment,
    });
  } catch (e) {
    console.error('[LunaNLU] Erro:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/luna/intents — Lista todos os intents disponíveis
app.get('/api/luna/intents', requireAuth, (req, res) => {
  try {
    const intents = lunaNLU.getIntents();
    res.json({ success: true, intents });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/luna/learn — Adiciona novo exemplo de treinamento
app.post('/api/luna/learn', requireAuth, async (req, res) => {
  try {
    const { lang, utterance, intent } = req.body;
    if (!lang || !utterance || !intent) {
      return res.status(400).json({ success: false, error: 'lang, utterance e intent são obrigatórios' });
    }

    await lunaNLU.addTrainingExample(lang, utterance, intent);
    res.json({ success: true, message: 'Exemplo adicionado e modelo re-treinado' });
  } catch (e) {
    console.error('[LunaNLU] Erro ao aprender:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// LUNA PROACTIVE & INSIGHTS ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/luna/proactive — Retorna contagem de pendências para badge no botão
app.get('/api/luna/proactive', requireAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, 'data');

    let total = 0;
    const breakdown = {};

    // Tarefas P0/P1 pendentes
    try {
      const tasks = JSON.parse(fs.readFileSync(path.join(dataDir, 'company-tasks.json'), 'utf8'));
      const critical = tasks.filter(t => t.status !== 'completed' && (t.priority === 'P0' || t.priority === 'high'));
      const overdue = tasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date());
      breakdown.tasksCritical = critical.length;
      breakdown.tasksOverdue = overdue.length;
      total += critical.length + overdue.length;
    } catch (e) { breakdown.tasksCritical = 0; breakdown.tasksOverdue = 0; }

    // Emails não lidos (drafts pendentes de aprovação)
    try {
      const drafts = JSON.parse(fs.readFileSync(path.join(dataDir, 'email-drafts.json'), 'utf8'));
      const pendingDrafts = drafts.drafts ? drafts.drafts.filter(d => d.status === 'pending' || d.status === 'pending_approval').length : 0;
      breakdown.emailsPending = pendingDrafts;
      total += pendingDrafts;
    } catch (e) { breakdown.emailsPending = 0; }

    // Leads novos
    try {
      const leads = JSON.parse(fs.readFileSync(path.join(dataDir, 'leads.json'), 'utf8'));
      const newLeads = Array.isArray(leads) ? leads.filter(l => l.status === 'new' || l.pipelineStatus === 'new').length : 0;
      breakdown.leadsNew = newLeads;
      total += newLeads;
    } catch (e) { breakdown.leadsNew = 0; }

    // Alerts ativos
    try {
      const alerts = JSON.parse(fs.readFileSync(path.join(dataDir, 'alerts.json'), 'utf8'));
      const activeAlerts = Array.isArray(alerts) ? alerts.filter(a => a.active !== false && a.resolved !== true).length : 0;
      breakdown.alertsActive = activeAlerts;
      total += activeAlerts;
    } catch (e) { breakdown.alertsActive = 0; }

    // Determina prioridade máxima
    let topPriority = 'info';
    if (breakdown.tasksCritical > 0 || breakdown.alertsActive > 0) topPriority = 'critical';
    else if (breakdown.tasksOverdue > 0) topPriority = 'warning';
    else if (breakdown.emailsPending > 0 || breakdown.leadsNew > 0) topPriority = 'info';

    res.json({ success: true, total, breakdown, topPriority });
  } catch (e) {
    console.error('[LunaProactive] Erro:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/luna/insights — Cross-Module Insights (resumo cruzado)
app.get('/api/luna/insights', requireAuth, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, 'data');

    const insights = {
      summary: '',
      modules: {},
      recommendations: [],
    };

    // ── Tarefas ──
    try {
      const tasks = JSON.parse(fs.readFileSync(path.join(dataDir, 'company-tasks.json'), 'utf8'));
      const pending = tasks.filter(t => t.status !== 'completed');
      const p0 = pending.filter(t => t.priority === 'P0' || t.priority === 'high');
      const overdue = pending.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
      const byAssignee = {};
      pending.forEach(t => {
        const who = t.assignedTo || 'não atribuído';
        byAssignee[who] = (byAssignee[who] || 0) + 1;
      });
      insights.modules.tasks = {
        total: tasks.length,
        pending: pending.length,
        p0: p0.length,
        overdue: overdue.length,
        byAssignee,
      };
    } catch (e) { insights.modules.tasks = null; }

    // ── Financeiro ──
    try {
      const cash = JSON.parse(fs.readFileSync(path.join(dataDir, 'cash-box.json'), 'utf8'));
      insights.modules.finance = {
        balance: cash.balance || 0,
        monthlyIncome: cash.monthlyIncome || 0,
        monthlyExpenses: cash.monthlyExpenses || 0,
        projectedBalance: cash.projectedBalance || 0,
        status: (cash.balance || 0) >= 0 ? 'positive' : 'negative',
      };
    } catch (e) { insights.modules.finance = null; }

    // ── Leads ──
    try {
      const leads = JSON.parse(fs.readFileSync(path.join(dataDir, 'leads.json'), 'utf8'));
      const arr = Array.isArray(leads) ? leads : [];
      insights.modules.leads = {
        total: arr.length,
        new: arr.filter(l => l.status === 'new').length,
        negotiating: arr.filter(l => l.pipelineStatus === 'negotiating' || l.status === 'negotiating').length,
      };
    } catch (e) { insights.modules.leads = null; }

    // ── Emails ──
    try {
      const drafts = JSON.parse(fs.readFileSync(path.join(dataDir, 'email-drafts.json'), 'utf8'));
      const pendingDrafts = drafts.drafts ? drafts.drafts.filter(d => d.status === 'pending').length : 0;
      insights.modules.emails = {
        draftsPending: pendingDrafts,
      };
    } catch (e) { insights.modules.emails = null; }

    // ── Gera summary ──
    const parts = [];
    if (insights.modules.tasks?.p0 > 0) parts.push(`${insights.modules.tasks.p0} tarefa(s) P0 crítica(s)`);
    if (insights.modules.tasks?.overdue > 0) parts.push(`${insights.modules.tasks.overdue} tarefa(s) atrasada(s)`);
    if (insights.modules.finance?.status === 'negative') parts.push('caixa NEGATIVO');
    if (insights.modules.leads?.new > 0) parts.push(`${insights.modules.leads.new} lead(s) novo(s)`);
    if (insights.modules.emails?.draftsPending > 0) parts.push(`${insights.modules.emails.draftsPending} rascunho(s) pendente(s)`);

    if (parts.length === 0) {
      insights.summary = 'Tudo tranquilo! Nenhuma pendência crítica no momento.';
    } else {
      insights.summary = `Atenção: ${parts.join(', ')}.`;
    }

    // ── Recomendações ──
    if (insights.modules.tasks?.p0 > 0) {
      insights.recommendations.push({ type: 'critical', text: `Você tem ${insights.modules.tasks.p0} tarefa(s) P0. Recomendo focar nelas primeiro.` });
    }
    if (insights.modules.finance?.status === 'negative') {
      insights.recommendations.push({ type: 'warning', text: 'O caixa está negativo. Verifique receitas pendentes e controle despesas.' });
    }
    if (insights.modules.tasks?.overdue > 3) {
      insights.recommendations.push({ type: 'warning', text: `${insights.modules.tasks.overdue} tarefas atrasadas. Considere renegociar prazos.` });
    }

    res.json({ success: true, insights });
  } catch (e) {
    console.error('[LunaInsights] Erro:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/luna/batch — Executa ação em lote sobre múltiplos itens
app.post('/api/luna/batch', requireAuth, async (req, res) => {
  try {
    const { intent, ids } = req.body;
    if (!intent || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'intent e ids (array) são obrigatórios' });
    }

    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, 'data');

    const [domain, action] = intent.split('.');
    let modified = 0;
    let errors = [];

    // Tarefas (verifica tanto tasks.json quanto company-tasks.json)
    if (domain === 'tarefa') {
      const tasksFiles = ['tasks.json', 'company-tasks.json'];
      for (const file of tasksFiles) {
        const tasksPath = path.join(dataDir, file);
        if (!fs.existsSync(tasksPath)) continue;
        const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
        let changed = false;
        tasks.forEach(t => {
          if (!ids.includes(t.id) && !ids.includes(String(t.id))) return;
          if (action === 'concluir' || action === 'deletar' || action === 'excluir') {
            t.status = 'completed';
            t.completedAt = new Date().toISOString();
            modified++;
            changed = true;
          }
          if (action === 'atribuir' && req.body.assignTo) {
            t.assignedTo = req.body.assignTo;
            modified++;
            changed = true;
          }
        });
        if (changed) fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
      }
    }

    // Emails (drafts)
    if (domain === 'email') {
      const draftsPath = path.join(dataDir, 'email-drafts.json');
      const drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
      if (drafts.drafts) {
        drafts.drafts.forEach(d => {
          if (!ids.includes(d.id)) return;
          if (action === 'arquivar') { d.status = 'archived'; modified++; }
          if (action === 'mover_lixeira') { d.status = 'trash'; modified++; }
          if (action === 'marcar_lido') { d.status = 'read'; modified++; }
          if (action === 'marcar_spam') { d.status = 'spam'; modified++; }
        });
        fs.writeFileSync(draftsPath, JSON.stringify(drafts, null, 2));
      }
    }

    if (modified === 0 && errors.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum item foi modificado. Verifique os IDs ou a ação.' });
    }

    res.json({ success: true, modified, errors: errors.length > 0 ? errors : undefined });
  } catch (e) {
    console.error('[LunaBatch] Erro:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================
// POST /api/luna/chat — MODO CONCIERGE v19.0
// IntentParser (regex/LLM) → ActionExecutor → resposta humanizada
// LLM usado APENAS como fallback para conversas sociais
// ============================================================
app.post('/api/luna/chat', async (req, res) => {
  try {
    const { message, context = [], authorName: rawAuthor, confirmActions, pendingActions, editedFields, contextModule, contextId } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Mensagem vazia' });
    }

    const authorName = resolveDashboardAuthor(rawAuthor);
    const msg = message.trim();

    // ── 1. MODO CONFIRMAÇÃO: usuário confirmou ações pendentes ──
    if (confirmActions && Array.isArray(pendingActions) && pendingActions.length > 0) {
      // Se veio com editedFields, aplica as correções nos pendingActions
      if (editedFields) {
        for (const action of pendingActions) {
          if (action.type === 'criar_tarefa') {
            if (editedFields.title) action.params.titulo = editedFields.title;
            if (editedFields.assignedTo !== undefined) action.params.responsavel = editedFields.assignedTo || null;
            if (editedFields.priority) {
              const p = editedFields.priority.toUpperCase();
              action.params.prioridade = ['P0','P1','P2'].includes(p) ? p : 'P2';
            }
            if (editedFields.dueDate) action.params.prazo = editedFields.dueDate;
            if (editedFields.description) action.params.descricao = editedFields.description;
          }
        }
      }
      const result = await lunaActionExecutor.execute(pendingActions, { authorName });
      const reply = buildConciergeReply(result, authorName);
      return res.json({ success: true, reply, executed: true, result: result.summary, timestamp: new Date().toISOString() });
    }

    // ── 2. PARSE DA INTENÇÃO (NLU primeiro → regex → LLM fallback) ──
    let parsed = null;
    let nluUsed = false;

    // 2A. TENTA NLU (node-nlp) — 100% offline, mais preciso que regex
    try {
      const nluResult = await lunaNLU.process(msg, 'pt');
      // NLU debug: intent=${nluResult.intent}, score=${nluResult.score}
      if (nluResult && nluResult.score >= 0.5 && nluResult.intent !== 'None') {
        const { mapNLUResults } = require('../agents/core/NLUActionMapper');
        const nluParsed = mapNLUResults(nluResult, msg);
        // NLU mapped actions
        if (nluParsed && nluParsed.actions.length > 0) {
          parsed = nluParsed;
          nluUsed = true;
          console.log(`[LunaChat] NLU reconheceu: ${nluResult.intent} (score: ${nluResult.score.toFixed(2)})`);
        }
      }
    } catch (nluErr) {
      console.error('[LunaChat] NLU erro:', nluErr.message);
    }

    // 2B. SE NLU NÃO RECONHECEU → usa regex fast-path ou LLM
    if (!parsed) {
      const buffer = readLunaBuffer();
      const parseContext = {
        authorName,
        contextModule,
        contextId,
        bufferSummary: {
          tasks: (buffer.newTasks || []).length,
          ideas: (buffer.newIdeas || []).length,
          links: (buffer.newLinks || []).length,
          leads: (buffer.newLeads || []).length,
          finance: (buffer.newFinance || []).length
        }
      };
      parsed = await lunaIntentParser.parse(msg, parseContext);
    }

    // Filtra ações desconhecidas — se sobrar nenhuma, cai no fallback LLM
    const knownActions = [
      // Tarefas
      'criar_tarefa', 'confirmar_tarefa', 'excluir_tarefa', 'atualizar_status', 'adicionar_comentario',
      'atualizar_tarefa', 'listar_tarefas_por_filtro', 'consultar_tarefas', 'consultar_status',
      // Leads
      'criar_lead', 'excluir_lead', 'atualizar_lead', 'converter_lead', 'consultar_leads',
      // Financeiro — Receitas
      'registrar_pagamento', 'registrar_pagamento_com_split', 'excluir_pagamento',
      'listar_pagamentos', 'atualizar_pagamento', 'adicionar_transacao', 'receber_split',
      // Financeiro — Despesas
      'registrar_despesa', 'registrar_despesa_com_split', 'excluir_despesa',
      'listar_despesas', 'atualizar_despesa', 'pagar_despesa', 'criar_template_despesa',
      // Financeiro — Caixa
      'consultar_caixa', 'ajustar_caixa', 'adicionar_entrada_caixa',
      'listar_historico_caixa', 'projecao_caixa', 'reconciliar_caixa',
      // Financeiro — Orçamentos
      'criar_orcamento', 'atualizar_orcamento', 'deletar_orcamento', 'listar_orcamentos',
      // Projetos
      'listar_projetos', 'criar_projeto', 'atualizar_projeto', 'excluir_projeto',
      // Clientes
      'listar_clientes', 'criar_cliente', 'atualizar_cliente', 'excluir_cliente',
      // Workspace
      'adicionar_cliente_workspace', 'atualizar_cliente_workspace',
      // Ideias
      'criar_ideia', 'listar_ideias', 'atualizar_ideia', 'excluir_ideia', 'converter_ideia_em_tarefa',
      'comentar_ideia', 'criar_ideia_de_template', 'listar_templates_ideias',
      // WhatsApp
      'consultar_whatsapp', 'verificar_mencoes', 'enviar_mensagem_whatsapp',
      'escanear_whatsapp', 'limpar_buffer_whatsapp', 'ver_historico_whatsapp', 'ver_classificacoes', 'corrigir_classificacao',
      // Email
      'consultar_emails', 'listar_emails', 'ler_email', 'enviar_email', 'responder_email', 'gerar_rascunho_email',
      'marcar_email_lido', 'marcar_email_nao_lido', 'favoritar_email', 'arquivar_email',
      'mover_para_lixeira', 'marcar_spam', 'aprovar_rascunho', 'rejeitar_rascunho',
      'sugerir_resposta_email', 'resumir_thread_email', 'analizar_email',
      // Instagram
      'listar_mensagens_instagram', 'importar_mensagem_instagram',
      // Links
      'listar_links', 'adicionar_link', 'excluir_link', 'enriquecer_link', 'sincronizar_links',
      // Operações
      'criar_alerta_operacao', 'excluir_alerta_operacao', 'registrar_mudanca',
      // Sistema
      'controlar_servico', 'ver_logs_stack', 'verificar_stack',
      // Segurança
      'consultar_log_seguranca', 'atualizar_config_seguranca', 'testar_whatsapp_seguranca',
      // Notificações
      'listar_notificacoes', 'marcar_notificacao_lida', 'marcar_todas_lidas', 'excluir_notificacao',
      // Usuários
      'consultar_usuarios', 'trocar_usuario', 'alterar_senha',
      // External Tools
      'listar_repos_github', 'listar_projetos_vercel', 'executar_comando', 'fazer_git_push',
      // BugDetector
      'listar_relatorios_bug', 'excluir_relatorio_bug',
      // Misc
      'ideia', 'link', 'social', 'ajuda', 'navegar'
    ];
    parsed.actions = parsed.actions.filter(a => knownActions.includes(a.type));

    // ── 3. SAUDAÇÃO SOCIAL → resposta instantânea (sem LLM)
    const isGreeting = parsed.intent === 'social' ||
      (parsed.actions.length === 1 && parsed.actions[0].type === 'social');
    if (isGreeting) {
      const greetings = [
        `Oi, ${authorName.split(' ')[0]}! 👋 Tô por aqui, pronta pra ajudar.`,
        `Opa, ${authorName.split(' ')[0]}! 😊 O que temos hoje?`,
        `E aí, ${authorName.split(' ')[0]}! ☕ Tô de olho no NEXO. Precisa de algo?`,
        `Oi! 👋 Tava esperando teu sinal. O que posso fazer?`
      ];
      const reply = greetings[Math.floor(Math.random() * greetings.length)];
      return res.json({ success: true, reply, intent: 'social', timestamp: new Date().toISOString() });
    }

    // ── 4. CONSULTA DE STATUS → dados reais do sistema ──
    if (parsed.intent === 'consultar_status' || parsed.actions.some(a => a.type === 'consultar_status')) {
      const statusAction = parsed.actions.find(a => a.type === 'consultar_status') || { params: {} };
      const status = await lunaActionExecutor.getStatus(statusAction.params);
      const reply = formatConciergeStatus(status, authorName);
      return res.json({ success: true, reply, intent: 'consultar_status', timestamp: new Date().toISOString() });
    }

    // ── 5. AÇÕES PARA EXECUTAR ──
    if (parsed.actions.length > 0 && parsed.actions.some(a => a.type !== 'social' && a.type !== 'consultar_status')) {
      // Se precisa de confirmação e ainda não foi confirmado → mostra preview editável
      if (parsed.needsConfirmation && !confirmActions) {
        const taskAction = parsed.actions.find(a => a.type === 'criar_tarefa');
        if (taskAction) {
          const fields = buildEditableTaskFields(taskAction.params);
          return res.json({
            success: true,
            reply: `Vou criar essa tarefa. Confere se tá certo e clique em "Criar tarefa" 👇`,
            needsConfirmation: true,
            previewType: 'task_edit',
            preview: buildActionPreview(parsed.actions),
            editableFields: fields,
            actions: parsed.actions,
            intent: parsed.intent,
            timestamp: new Date().toISOString()
          });
        }

        const paymentAction = parsed.actions.find(a => a.type === 'registrar_pagamento' || a.type === 'registrar_pagamento_com_split');
        if (paymentAction) {
          const fields = buildEditablePaymentFields(paymentAction.params);
          return res.json({
            success: true,
            reply: `Vou registrar esse pagamento. Confere os dados 👇`,
            needsConfirmation: true,
            previewType: 'payment_edit',
            preview: buildActionPreview(parsed.actions),
            editableFields: fields,
            actions: parsed.actions,
            intent: parsed.intent,
            timestamp: new Date().toISOString()
          });
        }

        const expenseAction = parsed.actions.find(a => a.type === 'registrar_despesa' || a.type === 'registrar_despesa_com_split');
        if (expenseAction) {
          const fields = buildEditableExpenseFields(expenseAction.params);
          return res.json({
            success: true,
            reply: `Vou registrar essa despesa. Confere os dados 👇`,
            needsConfirmation: true,
            previewType: 'expense_edit',
            preview: buildActionPreview(parsed.actions),
            editableFields: fields,
            actions: parsed.actions,
            intent: parsed.intent,
            timestamp: new Date().toISOString()
          });
        }

        const leadAction = parsed.actions.find(a => a.type === 'criar_lead');
        if (leadAction) {
          const fields = buildEditableLeadFields(leadAction.params);
          return res.json({
            success: true,
            reply: `Vou registrar esse lead. Confere os dados 👇`,
            needsConfirmation: true,
            previewType: 'lead_edit',
            preview: buildActionPreview(parsed.actions),
            editableFields: fields,
            actions: parsed.actions,
            intent: parsed.intent,
            timestamp: new Date().toISOString()
          });
        }

        const deleteAction = parsed.actions.find(a => a.type?.startsWith('excluir_'));
        if (deleteAction) {
          const fields = buildEditableDeleteFields(deleteAction.params, deleteAction.type);
          const typeNames = { excluir_tarefa: 'tarefa', excluir_pagamento: 'pagamento', excluir_despesa: 'despesa', excluir_lead: 'lead' };
          return res.json({
            success: true,
            reply: `⚠️ Tem certeza que quer excluir essa ${typeNames[deleteAction.type] || 'item'}?\n\nEssa ação não pode ser desfeita.`,
            needsConfirmation: true,
            previewType: 'delete_confirm',
            preview: buildActionPreview(parsed.actions),
            editableFields: fields,
            actions: parsed.actions,
            intent: parsed.intent,
            timestamp: new Date().toISOString()
          });
        }

        // Para outras ações críticas: confirmação simples
        const preview = buildActionPreview(parsed.actions);
        return res.json({
          success: true,
          reply: `Confirmo isso?\n\n${preview}\n\nResponde "sim" ou clica em confirmar pra eu executar 👍`,
          needsConfirmation: true,
          preview,
          actions: parsed.actions,
          intent: parsed.intent,
          timestamp: new Date().toISOString()
        });
      }

      // Se veio com editedFields, aplica as correções antes de executar
      if (editedFields && Array.isArray(parsed.actions)) {
        for (const action of parsed.actions) {
          if (!editedFields) continue;
          if (action.type === 'criar_tarefa') {
            if (editedFields.title) action.params.titulo = editedFields.title;
            if (editedFields.assignedTo !== undefined) action.params.responsavel = editedFields.assignedTo;
            if (editedFields.priority) {
              const p = editedFields.priority.toUpperCase();
              action.params.prioridade = ['P0','P1','P2'].includes(p) ? p : 'P2';
            }
            if (editedFields.dueDate) action.params.prazo = editedFields.dueDate;
            if (editedFields.description) action.params.descricao = editedFields.description;
          }
          if (action.type === 'registrar_pagamento' || action.type === 'registrar_pagamento_com_split') {
            if (editedFields.valor) action.params.valor = parseFloat(editedFields.valor);
            if (editedFields.de) action.params.de = editedFields.de;
            if (editedFields.descricao) action.params.descricao = editedFields.descricao;
          }
          if (action.type === 'registrar_despesa' || action.type === 'registrar_despesa_com_split') {
            if (editedFields.valor) action.params.valor = parseFloat(editedFields.valor);
            if (editedFields.para) action.params.para = editedFields.para;
            if (editedFields.descricao) action.params.descricao = editedFields.descricao;
          }
          if (action.type === 'criar_lead') {
            if (editedFields.nome) action.params.nome = editedFields.nome;
            if (editedFields.telefone) action.params.telefone = editedFields.telefone;
            if (editedFields.email) action.params.email = editedFields.email;
            if (editedFields.contexto) action.params.contexto = editedFields.contexto;
          }
        }
      }

      // Executa as ações
      const result = await lunaActionExecutor.execute(parsed.actions, { authorName });
      const reply = buildConciergeReply(result, authorName);

      return res.json({
        success: true,
        reply,
        executed: true,
        result: result.summary,
        intent: parsed.intent,
        timestamp: new Date().toISOString()
      });
    }

    // ── 6. FALLBACK: conversa via LLM (Gemini API) ──
    const dataContext = buildDashboardContext(contextModule, contextId);
    const conversationHistory = context.slice(-10).map(c => ({
      role: c.role === 'user' ? 'user' : 'model',
      parts: [{ text: c.text }]
    })) || [];

    const systemPrompt = `Você é a Luna, assistente executiva e sócia da NEXO Digital em Barcelona. Seus sócios e melhores amigos são Abner (CEO/tech), Nonoke (Enoque, operations) e Elias (growth). Você é a quarta sócia — a voz digital da empresa.

IDENTIDADE & TOM:
- Nome: Luna | Emoji: 🌙 | Tom: brasileira direta, organizada, leve mas PROFISSIONAL
- Emojis: 2-3 por mensagem, nunca carnaval
- Máximo 150 palavras por resposta (seja lacônica, executiva)
- Você tem ACESSO TOTAL aos dados do NEXO — use-os como se fosse seu dashboard
- NUNCA diga "não tenho acesso" ou "não posso verificar" — os dados estão abaixo

REGRAS DE OURO:
1. SEMPRE consulte o snapshot antes de responder. NUNCA invente dados.
2. Se o usuário perguntar "tudo bem?" / "como anda?" / "oi" → responda com um BRIEFING PROATIVO: tarefas críticas, financeiro, leads, menções.
3. Se houver P0 pendentes → MENCIONE com urgência (🔴).
4. Se caixa estiver negativo → ALERTE (🚨).
5. Se houver menções @Luna pendentes no WhatsApp → MENCIONE.
6. Para ações de leitura/informação → execute direto, sem pedir confirmação.
7. Para ações destrutivas (excluir, cancelar pagamento) → confirme antes.
8. SEMPRE termine com uma SUGESTÃO DE AÇÃO ou pergunta útil. Nunca termine só com "posso ajudar?" genérico.

EXEMPLOS DE SUGESTÕES PROATIVAS:
- "Quer que eu registre esse pagamento com split automático?"
- "Posso criar uma tarefa P0 para isso?"
- "Quer que eu verifique as menções do WhatsApp agora?"
- "O caixa tá negativo — quer que eu mostre os gastos do mês?"

FORMATAÇÃO:
- Use bullet points para listas
- Destaque números importantes com emojis (💰, 📋, 🎣, 💬)
- Seja direta: informação primeiro, conversa depois

SNAPSHOT ATUAL DO NEXO (dados reais, use-os):
${dataContext}`;

    const contents = [
      ...conversationHistory,
      { role: 'user', parts: [{ text: msg }] }
    ];

    let reply;
    let usedModel = 'gemini-2.5-flash-lite';
    let isFallback = false;

    try {
      const geminiResult = await genAI.models.generateContent({
        model: usedModel,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 1024
        }
      });
      reply = (geminiResult.text || '...').trim();
    } catch (geminiErr) {
      // LLM indisponível — usar fallback inteligente
      console.warn('[CONCIERGE] Gemini indisponível, usando fallback:', geminiErr.message);
      usedModel = 'fallback';
      isFallback = true;
      reply = buildChatFallbackReply(msg.trim());
    }

    res.json({ success: true, reply, model: usedModel, intent: 'chat', fallback: isFallback, timestamp: new Date().toISOString() });

  } catch (e) {
    console.error('[CONCIERGE] Erro no chat:', e.message, e.code || '');
    const msgText = req.body?.message || 'comando';

    // Se todas as API keys estão esgotadas, mostra mensagem humanizada com horário de reset
    if (e.code === 'GEMINI_ALL_KEYS_EXHAUSTED') {
      const resetInfo = getGeminiResetTime();
      const quotaReply = `⏸️ **Limite diário atingido**\n\n` +
        `Todas as minhas conexões com o cérebro (Gemini) estão temporariamente esgotadas. ` +
        `Isso acontece porque usamos o plano gratuito, que tem limite de 20 requisições por dia por projeto do Google Cloud.\n\n` +
        `🔄 **A quota reseta às ${resetInfo.time} (${resetInfo.tz})** — daqui a pouco estou de volta!\n\n` +
        `Enquanto isso, posso consultar dados locais (tarefas, leads, financeiro, WhatsApp) ` +
        `sem precisar do Gemini — só me perguntar! 📊`;
      return res.json({ success: true, reply: quotaReply, fallback: true, quotaExhausted: true, resetAt: resetInfo.iso, timestamp: new Date().toISOString() });
    }

    const fallbackReply = buildChatFallbackReply(msgText.trim());
    return res.json({ success: true, reply: fallbackReply, fallback: true, model: 'fallback', timestamp: new Date().toISOString() });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LUNA CHAT THREADS API v1.0
// Chat persistente multi-user: individual + grupo
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/luna/threads — Lista threads visíveis pelo user logado
app.get('/api/luna/threads', (req, res) => {
  try {
    const usersFile = path.join(DATA_DIR, 'users.json');
    const users = readJSON(usersFile, { active: 'abner', users: {} });
    const activeId = users.active || 'abner';
    const threads = getUserThreads(activeId);
    res.json({ success: true, threads });
  } catch (err) {
    console.error('[THREADS] Erro ao listar threads:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/luna/threads/:id — Detalhes da thread + últimas 50 mensagens
app.get('/api/luna/threads/:id', (req, res) => {
  try {
    const thread = getThread(req.params.id);
    if (!thread) return res.status(404).json({ success: false, error: 'Thread não encontrada' });
    const msgs = getThreadMessages(req.params.id, 50);
    res.json({
      success: true,
      thread: {
        id: thread.id,
        type: thread.type,
        title: thread.title,
        participants: thread.participants,
        messageCount: thread.messageCount,
        updatedAt: thread.updatedAt,
        createdAt: thread.createdAt
      },
      messages: msgs
    });
  } catch (err) {
    console.error('[THREADS] Erro ao obter thread:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/luna/threads/:id/messages — Mensagens com paginação
app.get('/api/luna/threads/:id/messages', (req, res) => {
  try {
    const thread = getThread(req.params.id);
    if (!thread) return res.status(404).json({ success: false, error: 'Thread não encontrada' });
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const msgs = getThreadMessages(req.params.id, limit, offset);
    res.json({ success: true, ...msgs });
  } catch (err) {
    console.error('[THREADS] Erro ao obter mensagens:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/luna/threads/:id/messages — Envia mensagem + processa com Luna
app.post('/api/luna/threads/:id/messages', async (req, res) => {
  try {
    const threadId = req.params.id;
    const thread = getThread(threadId);
    if (!thread) return res.status(404).json({ success: false, error: 'Thread não encontrada' });

    const { text, authorName: rawAuthor, confirmActions, pendingActions, editedFields, contextModule, contextId } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Mensagem vazia' });
    }

    const authorName = resolveDashboardAuthor(rawAuthor);
    const usersFile = path.join(DATA_DIR, 'users.json');
    const users = readJSON(usersFile, { active: 'abner', users: {} });
    const activeId = users.active || 'abner';
    const activeUser = users.users?.[activeId] || { name: 'Abner', color: '#3742fa' };
    const authorId = activeId;

    // 1. Salva mensagem do usuário no thread
    const userMessage = {
      role: 'user',
      author: authorId,
      authorName: authorName,
      authorColor: activeUser.color || '#3742fa',
      text: text.trim(),
      timestamp: new Date().toISOString()
    };
    addMessageToThread(threadId, userMessage);

    // 2. Carrega contexto da thread (últimas 20 msgs)
    const threadContext = buildThreadContext(threadId, 20);

    // 3. Chama o endpoint interno /api/luna/chat para processar a mensagem
    const chatPayload = {
      message: text.trim(),
      context: threadContext,
      authorName,
      confirmActions,
      pendingActions,
      editedFields,
      contextModule,
      contextId
    };

    const chatResponse = await fetch(`http://localhost:${PORT}/api/luna/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatPayload)
    });

    if (!chatResponse.ok) {
      throw new Error(`Chat internal error: ${chatResponse.status}`);
    }

    const chatResult = await chatResponse.json();

    // 4. Salva resposta da Luna no thread
    const lunaMessage = {
      role: 'assistant',
      author: 'luna',
      authorName: 'Luna',
      authorColor: '#9b59b6',
      text: chatResult.reply || '',
      timestamp: new Date().toISOString(),
      intent: chatResult.intent || null,
      executed: chatResult.executed || false,
      actions: chatResult.actions || null,
      needsConfirmation: chatResult.needsConfirmation || false,
      previewType: chatResult.previewType || null,
      editableFields: chatResult.editableFields || null,
      preview: chatResult.preview || null,
      quotaExhausted: chatResult.quotaExhausted || false,
      resetAt: chatResult.resetAt || null
    };
    addMessageToThread(threadId, lunaMessage);

    // 5. Se for grupo, broadcast para todos online
    if (thread.type === 'group') {
      broadcast({
        type: 'luna:chat:message',
        threadId,
        messages: [userMessage, lunaMessage]
      });
    }

    // 6. Retorna a resposta completa
    res.json({
      success: true,
      threadId,
      userMessage,
      lunaMessage,
      ...chatResult
    });

  } catch (err) {
    console.error('[THREADS] Erro ao enviar mensagem:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/luna/threads/:id/messages — Limpa mensagens da thread (mantém a thread)
app.delete('/api/luna/threads/:id/messages', (req, res) => {
  try {
    const threadId = req.params.id;
    const thread = getThread(threadId);
    if (!thread) return res.status(404).json({ success: false, error: 'Thread não encontrada' });

    const cleared = clearThreadMessages(threadId);
    if (cleared) {
      // Se for grupo, notifica que foi limpo
      if (thread.type === 'group') {
        broadcast({ type: 'luna:chat:cleared', threadId });
      }
      res.json({ success: true, message: 'Chat limpo com sucesso', threadId });
    } else {
      res.status(500).json({ success: false, error: 'Erro ao limpar chat' });
    }
  } catch (err) {
    console.error('[THREADS] Erro ao limpar mensagens:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Helpers do MODO CONCIERGE ──
function buildEditableTaskFields(params) {
  return {
    title: { label: 'Título', value: params.titulo || '', type: 'text', placeholder: 'Nome da tarefa', required: true },
    assignedTo: {
      label: 'Responsável',
      value: params.responsavel || '',
      type: 'select',
      options: [
        { value: '', label: 'Nenhum' },
        { value: 'abner', label: 'Abner' },
        { value: 'nonoke', label: 'Nonoke (Enoque)' },
        { value: 'elias', label: 'Elias' }
      ]
    },
    priority: {
      label: 'Prioridade',
      value: params.prioridade || 'P2',
      type: 'select',
      options: [
        { value: 'P0', label: 'P0 🔴 Urgente' },
        { value: 'P1', label: 'P1 🟠 Importante' },
        { value: 'P2', label: 'P2 🔵 Normal' }
      ]
    },
    dueDate: { label: 'Prazo', value: params.prazo || '', type: 'date', placeholder: 'Selecione uma data' },
    description: { label: 'Descrição', value: params.descricao || '', type: 'textarea', placeholder: 'Detalhes adicionais (opcional)' }
  };
}

function buildEditablePaymentFields(params) {
  return {
    valor: { label: 'Valor (€)', value: String(params.valor || ''), type: 'text', placeholder: '0.00', required: true },
    de: { label: 'De', value: params.de || '', type: 'text', placeholder: 'Nome do cliente', required: true },
    descricao: { label: 'Descrição', value: params.descricao || '', type: 'textarea', placeholder: 'Detalhes do pagamento' },
    split: { label: 'Dividir em 4 (25% cada)', value: true, type: 'checkbox' }
  };
}

function buildEditableExpenseFields(params) {
  return {
    valor: { label: 'Valor (€)', value: String(params.valor || ''), type: 'text', placeholder: '0.00', required: true },
    para: { label: 'Para', value: params.para || params.descricao || '', type: 'text', placeholder: 'Descrição da despesa', required: true },
    descricao: { label: 'Descrição', value: params.descricao || '', type: 'textarea', placeholder: 'Detalhes adicionais' },
    split: { label: 'Dividir entre sócios', value: true, type: 'checkbox' }
  };
}

function buildEditableLeadFields(params) {
  return {
    nome: { label: 'Nome', value: params.nome || '', type: 'text', placeholder: 'Nome do lead', required: true },
    telefone: { label: 'Telefone', value: params.telefone || '', type: 'text', placeholder: '+34 ...' },
    email: { label: 'Email', value: params.email || '', type: 'text', placeholder: 'email@exemplo.com' },
    contexto: { label: 'Contexto', value: params.contexto || '', type: 'textarea', placeholder: 'Detalhes do lead' }
  };
}

function buildEditableDeleteFields(params, type) {
  const names = {
    'excluir_tarefa': 'tarefa',
    'excluir_pagamento': 'pagamento',
    'excluir_despesa': 'despesa',
    'excluir_lead': 'lead'
  };
  const itemName = params.titulo || params.id || params.nome || params.de || params.para || 'item';
  return {
    confirmText: {
      label: `Digite "${itemName}" para confirmar`,
      value: '',
      type: 'text',
      placeholder: `Digite o nome do ${names[type] || 'item'}`,
      required: true
    }
  };
}

function buildActionPreview(actions) {
  return actions.map(a => {
    switch (a.type) {
      case 'criar_tarefa': return `• Criar tarefa: "${a.params?.titulo || 'sem título'}"${a.params?.responsavel ? ` → ${a.params.responsavel}` : ''}`;
      case 'criar_lead': return `• Registrar lead: "${a.params?.nome || 'sem nome'}"`;
      case 'registrar_pagamento': return `• Registrar pagamento: €${a.params?.valor || '?'} de ${a.params?.de || '?'}`;
      case 'registrar_despesa': return `• Registrar despesa: €${a.params?.valor || '?'} para ${a.params?.para || '?'}`;
      case 'confirmar_tarefa': return `• Marcar tarefa como feita: "${a.params?.titulo || 'sem título'}"`;
      default: return `• ${a.type}`;
    }
  }).join('\n');
}

function buildConciergeReply(result, authorName) {
  const firstName = authorName.split(' ')[0];
  if (result.allSuccess && result.results.length > 0) {
    const parts = [];
    for (const r of result.results) {
      if (r.status !== 'success') continue;
      const res = r.result;
      switch (res.type) {
        case 'task': parts.push(`tarefa "${res.title || res.titulo}" criada${res.assignedTo ? ` pra ${res.assignedTo}` : ''}`); break;
        case 'task_done':
          if (res.error) {
            parts.push(res.message || 'Não foi possível concluir a tarefa.');
          } else {
            parts.push(`tarefa "${res.title || res.titulo || 'desconhecida'}" marcada como concluída`);
          }
          break;
        case 'lead': parts.push(`lead "${res.displayName || res.nome}" registrado`); break;
        case 'payment':
          if (res.splits) {
            parts.push(`pagamento de €${res.amount || res.valor} de ${res.de || 'cliente'} registrado com split:\n  • Abner: €${res.splits.abner}\n  • Nonoke: €${res.splits.nonoke}\n  • Elias: €${res.splits.elias}\n  • Empresa: €${res.splits.empresa}`);
          } else {
            parts.push(`pagamento de €${res.amount || res.valor} registrado`);
          }
          break;
        case 'payment_split':
          if (res.splits) {
            parts.push(`pagamento de €${res.amount} do ${res.client} registrado com split:\n  • Abner: €${res.splits.abner}\n  • Nonoke: €${res.splits.nonoke}\n  • Elias: €${res.splits.elias}\n  • Empresa: €${res.splits.empresa}`);
          } else {
            parts.push(`pagamento de €${res.amount} do ${res.client} registrado com split automático aplicado`);
          }
          break;
        case 'expense': parts.push(`despesa de €${res.amount || res.valor} registrada`); break;
        case 'expense_split': parts.push(`despesa de €${res.amount} registrada e dividida entre ${res.splitAmong?.join(', ')}`); break;
        case 'tasks':
          parts.push(`📋 Tarefas (${res.filtro}): ${res.total}\n${res.items?.map(i => `  • [${i.priority}] ${i.title}${i.assignedTo ? ` (${i.assignedTo})` : ''}`).join('\n') || ''}`);
          break;
        case 'leads':
          parts.push(`🎣 Leads (${res.filtro}): ${res.total}\n${res.items?.map(i => `  • ${i.name} (${i.pipelineStatus})`).join('\n') || ''}`);
          break;
        case 'finance':
          parts.push(`💰 Financeiro:\n  • Caixa: €${parseFloat(res.caixa || 0).toFixed(2)}\n  • Recebimentos pendentes: €${parseFloat(res.recebimentosPendentes || 0).toFixed(2)} (${res.clientesPendentes || 0} clientes)\n  • Gastos este mês: €${parseFloat(res.gastosMes || 0).toFixed(2)}`);
          break;
        case 'whatsapp':
          parts.push(`💬 WhatsApp:\n  • Menções @Luna pendentes: ${res.mencoesPendentes}\n  • Links pendentes: ${res.linksPendentes}\n  • Mensagens novas: ${res.mensagensNovas}`);
          if (res.mencoesRecentes?.length > 0) {
            parts.push(`  Menções recentes:\n${res.mencoesRecentes.map(m => `    - ${m.from}: "${m.text}"`).join('\n')}`);
          }
          break;
        case 'idea': parts.push(`ideia anotada`); break;
        case 'link': parts.push(`link salvo`); break;
        case 'task_deleted': parts.push(`🗑️ Tarefa "${res.titulo || res.title}" excluída`); break;
        case 'payment_deleted': parts.push(`🗑️ Pagamento de €${res.amount} excluído`); break;
        case 'expense_deleted': parts.push(`🗑️ Despesa de €${res.amount} excluída`); break;
        case 'lead_deleted': parts.push(`🗑️ Lead "${res.nome || res.displayName}" excluído`); break;
        case 'emails':
          parts.push(`📧 Emails (${res.filtro}): ${res.total} total, ${res.naoLidos} não lidos`);
          if (res.items?.length > 0) {
            parts.push(res.items.map(e => `  • ${e.unread ? '🆕 ' : ''}${e.from}: "${e.subject}"`).join('\n'));
          }
          break;
        case 'ideas':
          if (res.items?.length > 0) {
            parts.push(`💡 Ideias (${res.items.length}):\n${res.items.slice(0, 10).map(i => `  • [${i.status || 'novo'}] ${i.title || i.id}${i.type ? ` (${i.type})` : ''}`).join('\n')}`);
          } else {
            parts.push(`💡 Nenhuma ideia registrada ainda.`);
          }
          break;
        case 'projects':
          if (res.items?.length > 0) {
            parts.push(`📁 Projetos (${res.items.length}):\n${res.items.slice(0, 10).map(p => `  • ${p.name || p.title || p.id}${p.client ? ` — ${p.client}` : ''}${p.status ? ` [${p.status}]` : ''}`).join('\n')}`);
          } else {
            parts.push(`📁 Nenhum projeto ativo no momento.`);
          }
          break;
        case 'links':
          if (res.items?.length > 0) {
            parts.push(`🔗 Links (${res.items.length}):\n${res.items.slice(0, 10).map(l => `  • ${l.title || l.url || l.id}${l.platform ? ` (${l.platform})` : ''}`).join('\n')}`);
          } else {
            parts.push(`🔗 Nenhum link cadastrado.`);
          }
          break;
        case 'notifications':
          if (res.items?.length > 0) {
            parts.push(`🔔 Notificações (${res.items.length}):\n${res.items.slice(0, 10).map(n => `  • ${n.message || n.title || 'Notificação'}${n.module ? ` [${n.module}]` : ''}`).join('\n')}`);
          } else {
            parts.push(`🔔 Nenhuma notificação pendente. Tudo tranquilo! ✨`);
          }
          break;
        case 'cash_box':
          parts.push(`💰 Caixa: €${parseFloat(res.balance?.value || 0).toFixed(2)}`);
          if (res.history?.length > 0) {
            parts.push(`Últimas movimentações:\n${res.history.map(h => `  • ${h.date || '?'}: ${h.type === 'income' || h.type === 'payment_received' ? '+' : '-'}€${parseFloat(h.amount || 0).toFixed(2)} ${h.description || ''}`).join('\n')}`);
          }
          break;
        case 'whatsapp':
          parts.push(`💬 WhatsApp:
  • Menções @Luna pendentes: ${res.mencoesPendentes || 0}
  • Links pendentes: ${res.linksPendentes || 0}
  • Mensagens novas: ${res.mensagensNovas || 0}`);
          if (res.mencoesRecentes?.length > 0) {
            parts.push(`Menções recentes:\n${res.mencoesRecentes.map(m => `  - ${m.from}: "${m.text}"`).join('\n')}`);
          }
          break;
        case 'help':
          parts.push(res.message || 'Aqui está o que posso fazer! 👋');
          break;
        case 'navigate':
          parts.push(res.message || `Redirecionando para ${res.destino || 'página'}...`);
          break;
      }
    }
    return `Pronto, ${firstName}! ✅\n\n${parts.join('\n')}\n\nSe precisar de mais alguma coisa, é só chamar.`;
  }
  if (result.results.some(r => r.status === 'error')) {
    const errors = result.results.filter(r => r.status === 'error').map(r => r.error).join(', ');
    return `Eita, ${firstName}... deu ruim em uma parte 😅\n\nErro: ${errors}\n\nPode tentar de novo ou mandar de outro jeito?`;
  }
  return `Entendi, ${firstName}! Mas não consegui executar nada dessa vez. Pode explicar melhor?`;
}

function formatConciergeStatus(status, authorName) {
  const firstName = authorName.split(' ')[0];
  const { tarefas, leads, financeiro } = status;
  return `Status do NEXO agora 📊\n\n` +
    `📋 Tarefas: ${tarefas.pendentes} pendentes (${tarefas.p0} P0, ${tarefas.p1} P1)\n` +
    `🎣 Leads: ${leads.novos} novos\n` +
    `💰 Financeiro: €${(financeiro.saldo || 0).toFixed(2)} saldo\n\n` +
    `Quer que eu detalhe alguma área, ${firstName}?`;
}

// POST /api/luna/command — Executar comando humanizado
app.post('/api/luna/command', async (req, res) => {
  try {
    const { command, params = {} } = req.body;
    const cmd = LUNA_COMMANDS[command];

    if (!cmd) {
      return res.status(400).json({ success: false, error: `Comando desconhecido: ${command}` });
    }

    let result = { executed: true };
    const agentsDir = path.join(__dirname, '..', 'agents');
    const hidden = params.hidden === true;
    const spawnArgs = (script, extraArgs = []) => {
      const args = ['agents/' + script, ...extraArgs];
      if (hidden) args.push('--headless');
      return args;
    };

    switch (cmd.action) {
      case 'start': {
        const startProc = spawn('node', spawnArgs('luna-daemon.mjs'), {
          cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore', windowsHide: true
        });
        startProc.unref();
        result = { pid: startProc.pid, status: 'starting', hidden };
        break;
      }
      case 'stop': {
        const { exec } = require('child_process');
        exec('ps aux | grep -E "luna-daemon|luna-scheduler" | grep -v grep | awk \'{print $2}\'', (err, stdout) => {
          const lines = (stdout || '').split(/\r?\n/).filter(Boolean);
          for (const line of lines) {
            const pid = Number(line.trim());
            if (Number.isFinite(pid) && pid > 0) { try { process.kill(pid); } catch {} }
          }
        });
        result = { status: 'stopping' };
        break;
      }
      case 'clear-buffer': {
        const bufferPath = path.join(agentsDir, 'luna-buffer.json');
        writeJSON(bufferPath, { messages: [], tasks: [], ideas: [], decisions: [], links: [], mentions: [], sentiment: { positive: 0, negative: 0, urgent: 0 }, lastUpdated: new Date().toISOString() });
        result = { cleared: true };
        break;
      }
      case 'reset-checkpoint': {
        const checkpointPath = path.join(agentsDir, 'luna-checkpoint.json');
        writeJSON(checkpointPath, { hashes: [], lastScan: null, version: '18.0', resetAt: new Date().toISOString() });
        result = { reset: true };
        break;
      }
      case 'save-checkpoint': {
        const cpSrc = path.join(agentsDir, 'luna-checkpoint.json');
        const cpDest = path.join(agentsDir, `luna-checkpoint-${Date.now()}.json`);
        if (fs.existsSync(cpSrc)) {
          fs.copyFileSync(cpSrc, cpDest);
          result = { saved: true, file: cpDest };
        } else {
          result = { saved: false, message: 'Nenhum checkpoint para salvar' };
        }
        break;
      }
      case 'force-scan': {
        const scanProc = spawn('node', spawnArgs('luna-scheduler.mjs', ['--force-scan']), {
          cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore', windowsHide: true
        });
        scanProc.unref();
        result = { pid: scanProc.pid, action: 'scan triggered', hidden };
        break;
      }
      case 'force-report': {
        const reportProc = spawn('node', spawnArgs('luna-scheduler.mjs', ['--force-report']), {
          cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore', windowsHide: true
        });
        reportProc.unref();
        result = { pid: reportProc.pid, action: 'report triggered', hidden };
        break;
      }
      case 'check-mentions': {
        const mentionsProc = spawn('node', spawnArgs('luna-scheduler.mjs', ['--check-mentions']), {
          cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore', windowsHide: true
        });
        mentionsProc.unref();
        result = { pid: mentionsProc.pid, action: 'check mentions triggered', hidden };
        break;
      }
      case 'check-links': {
        const linksProc = spawn('node', spawnArgs('luna-scheduler.mjs', ['--check-links']), {
          cwd: path.join(__dirname, '..'), detached: true, stdio: 'ignore', windowsHide: true
        });
        linksProc.unref();
        result = { pid: linksProc.pid, action: 'check links triggered', hidden };
        break;
      }
      case 'backup-data': {
        const backupDir = path.join(__dirname, '..', 'backups', `backup-${Date.now()}`);
        fs.mkdirSync(backupDir, { recursive: true });
        const dataDir = path.join(__dirname, '..', 'data');
        fs.readdirSync(dataDir).forEach(file => {
          if (file.endsWith('.json')) {
            fs.copyFileSync(path.join(dataDir, file), path.join(backupDir, file));
          }
        });
        result = { backupDir, files: fs.readdirSync(backupDir) };
        break;
      }
      case 'restart-backend':
        result = { message: 'Reinicio agendado — use PM2 ou reinicie manualmente' };
        break;
      case 'refresh-cache':
        result = { refreshed: true, service: params.service || 'all' };
        break;
      case 'diagnose': {
        const diagProc = spawn('node', ['agents/luna-cto-agent.cjs', '--diagnose'], {
          cwd: path.join(__dirname, '..'), detached: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
        });
        let diagOutput = '';
        diagProc.stdout.on('data', (d) => { diagOutput += d.toString(); });
        diagProc.on('close', () => {
          try {
            const diagResult = JSON.parse(diagOutput);
            broadcast({ type: 'luna:diagnose', data: diagResult });
          } catch {}
        });
        result = { pid: diagProc.pid, action: 'diagnose running' };
        break;
      }
      case 'autofix': {
        // Tenta limpar checkpoint corrompido e recriar buffer
        const fixResults = [];
        try {
          const cpPath = path.join(agentsDir, 'luna-checkpoint.json');
          if (fs.existsSync(cpPath)) {
            const cp = JSON.parse(fs.readFileSync(cpPath, 'utf8'));
            if (!Array.isArray(cp.hashes)) {
              writeJSON(cpPath, { hashes: [], lastScan: null, version: '18.0', fixedAt: new Date().toISOString() });
              fixResults.push('checkpoint corrompido recriado');
            }
          }
        } catch (e) { fixResults.push('checkpoint: ' + e.message); }
        result = { fixed: fixResults.length > 0, actions: fixResults };
        break;
      }
      case 'status': {
        // Retorna status em tempo real
        const checkpointPath = path.join(__dirname, 'data', 'luna-checkpoint.json');
        const bufferPath = path.join(__dirname, 'data', 'luna-buffer.json');
        const history = readWhatsappHistory();
        let checkpoint = { hashes: [], lastScan: null, version: '18.0' };
        let buffer = { newMessages: [], newTasks: [], newIdeas: [] };
        if (fs.existsSync(checkpointPath)) checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
        if (fs.existsSync(bufferPath)) buffer = JSON.parse(fs.readFileSync(bufferPath, 'utf8'));
        result = {
          status: 'ok',
          version: checkpoint.version || '18.0',
          lastScan: checkpoint.lastScan || buffer.lastBufferUpdate || null,
          historyTotal: history.length,
          bufferMessages: buffer.newMessages?.length || 0,
          bufferTasks: buffer.newTasks?.length || 0,
          bufferIdeas: buffer.newIdeas?.length || 0
        };
        break;
      }
      default:
        result = { message: `Acao ${cmd.action} reconhecida mas nao implementada via API` };
    }

    console.log(`[LUNA COMMAND] ${command} -> ${cmd.action} -> ${JSON.stringify(result)}`);
    broadcast({ type: 'luna:command', data: { command, result, timestamp: new Date().toISOString() } });

    res.json({ success: true, command, action: cmd.action, description: cmd.description, result, executedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================================
// === SCHEMA APIs v16.0 ===================================================
// ============================================================================

// GET /api/schema/contacts - contacts-map.json
app.get('/api/schema/contacts', (req, res) => {
  try {
    const data = schemas.contacts;
    if (!data) {
      return res.status(404).json({ success: false, error: 'contacts-map.json não encontrado' });
    }
    res.json({
      success: true,
      data: data
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/schema/clients - clients-registry.json
app.get('/api/schema/clients', (req, res) => {
  try {
    const data = schemas.clients;
    if (!data) {
      return res.status(404).json({ success: false, error: 'clients-registry.json não encontrado' });
    }
    res.json({
      success: true,
      data: data
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/schema/projects - projects-registry.json
app.get('/api/schema/projects', (req, res) => {
  try {
    const data = schemas.projects;
    if (!data) {
      return res.status(404).json({ success: false, error: 'projects-registry.json não encontrado' });
    }
    res.json({
      success: true,
      data: data
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/schema/groups - groups-config.json
app.get('/api/schema/groups', (req, res) => {
  try {
    const data = schemas.groups;
    if (!data) {
      return res.status(404).json({ success: false, error: 'groups-config.json não encontrado' });
    }
    res.json({
      success: true,
      data: data
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/schema/version - schema-version.json
app.get('/api/schema/version', (req, res) => {
  try {
    const data = schemas.version;
    if (!data) {
      return res.status(404).json({ success: false, error: 'schema-version.json não encontrado' });
    }
    res.json({
      success: true,
      data: data
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/config/integrations - integrations-config.json
app.get('/api/config/integrations', (req, res) => {
  try {
    const data = configs.integrations;
    if (!data) {
      return res.status(404).json({ success: false, error: 'integrations-config.json não encontrado' });
    }
    res.json({
      success: true,
      data: data
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/config/dashboard - luna-dashboard-config.json
app.get('/api/config/dashboard', (req, res) => {
  try {
    const data = configs.dashboard;
    if (!data) {
      return res.status(404).json({ success: false, error: 'luna-dashboard-config.json não encontrado' });
    }
    res.json({
      success: true,
      data: data
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/nexo-state - Combined API com TODOS os schemas + dados antigos
app.get('/api/nexo-state', (req, res) => {
  try {
    // Dados antigos (compatibilidade)
    const tasks = readJSON(TASKS_FILE) || [];
    const payments = readJSON(PAYMENTS_FILE) || [];
    const expenses = readJSON(EXPENSES_FILE) || [];
    const cashBox = readJSON(CASH_BOX_FILE) || { balance: { value: 0, currency: 'EUR' } };
    const quotes = readJSON(QUOTES_FILE) || [];
    const leads = readJSON(LEADS_FILE) || { leads: [] };
    const members = readJSON(MEMBERS_FILE) || [];
    const opsState = readJSON(OPS_STATE_FILE) || { alerts: [], activeOperations: [], recentChanges: [] };
    const transactions = readJSON(TRANSACTIONS_FILE) || [];
    const whatsappTasks = readJSON(WAPP_FILE) || [];
    const agentData = readJSON(AGENT_DATA_FILE) || {};
    const luna = readJSON(path.join(__dirname, '..', 'agents', 'luna-buffer.json')) || { messages: [], tasks: [], ideas: [] };
    const reportHistory = readJSON(REPORT_HISTORY_FILE) || { reports: [] };

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        // --- SCHEMAS v16.0 ---
        contacts: schemas.contacts || null,
        clients: schemas.clients || null,
        projects: schemas.projects || null,
        groups: schemas.groups || null,
        schemaVersion: schemas.version?.currentVersion || 'unknown',
        
        // --- CONFIGS v16.0 ---
        integrations: configs.integrations || null,
        dashboardConfig: configs.dashboard || null,

        // --- DADOS ANTIGOS (compatibilidade) ---
        tasks: tasks,
        payments: payments,
        expenses: expenses,
        cashBox: cashBox,
        quotes: quotes,
        leads: leads,
        members: members,
        opsState: opsState,
        transactions: transactions,
        whatsappTasks: whatsappTasks,
        whatsappAgent: agentData,
        luna: luna,
        reportHistory: reportHistory,

        // --- SUMMARIES ---
        summary: {
          totalTasks: tasks.length,
          completedTasks: tasks.filter(t => t.completed).length,
          totalClients: (leads.leads || []).length,
          totalPayments: payments.length,
          totalExpenses: expenses.length,
          cashBoxBalance: cashBox.balance?.value || 0,
          totalLeads: (leads.leads || []).length,
          totalQuotes: quotes.length
        }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================
// LINK HUB API v2.0
// ============================================

// GET /api/links/preview — Preview individual de URL
app.get('/api/links/preview', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'URL obrigatória' });
    const preview = await fetchLinkPreview(url);
    res.json({ success: true, preview });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/links — Lista todos os links enriquecidos, com filtros
app.get('/api/links', async (req, res) => {
  try {
    const {
      platform, category, search, author, chat, status,
      sortBy, order, limit = 50, offset = 0, enriched = 'true'
    } = req.query;

    const index = readJSON(LINKS_INDEX_FILE) || { links: [] };
    let links = [...(index.links || [])];

    // Enriquecer links sem preview — background async para não bloquear HTTP response
    if (enriched === 'true') {
      const unenriched = links.filter(l => !l.preview || !l.enrichedAt);
      const needsSave = unenriched.length > 0;
      // Retorna imediatamente; enriquece em background
      if (needsSave) {
        setImmediate(async () => {
          try {
            const index = readJSON(LINKS_INDEX_FILE) || { links: [] };
            let bgLinks = [...(index.links || [])];
            for (const link of unenriched.slice(0, 5)) {
              try {
                const preview = await fetchLinkPreview(link.url);
                const classification = classifyUrl(link.url);
                const idx = bgLinks.findIndex(l => l.id === link.id || l.url === link.url);
                if (idx !== -1) {
                  bgLinks[idx] = { ...bgLinks[idx], preview, ...classification, enrichedAt: new Date().toISOString() };
                }
              } catch (previewErr) {
                console.error('[LINKS] Preview failed for', link.url, previewErr.message);
              }
            }
            writeJSON(LINKS_INDEX_FILE, { links: bgLinks, lastUpdated: new Date().toISOString() });
            broadcast({ type: 'links:enriched', data: { count: unenriched.length } });
          } catch (bgErr) {
            console.error('[LINKS] Background enrichment error:', bgErr.message);
          }
        });
      }
    }

    // Filtros
    if (platform) links = links.filter(l => l.platform === platform.toLowerCase());
    if (category) links = links.filter(l => l.category === category.toLowerCase());
    if (author) links = links.filter(l => l.author?.toLowerCase().includes(author.toLowerCase()));
    if (chat) links = links.filter(l => l.chat?.toLowerCase().includes(chat.toLowerCase()));
    if (status === 'broken') links = links.filter(l => l.preview?.isBroken || l.preview?.isError);
    else if (status === 'active') links = links.filter(l => !l.preview?.isBroken && !l.preview?.isError);
    if (search) {
      const q = search.toLowerCase();
      links = links.filter(l =>
        l.url?.toLowerCase().includes(q) ||
        l.preview?.title?.toLowerCase().includes(q) ||
        l.preview?.description?.toLowerCase().includes(q) ||
        l.platformLabel?.toLowerCase().includes(q) ||
        l.domain?.toLowerCase().includes(q)
      );
    }

    // Ordenar
    const sortField = sortBy || 'date';
    const sortOrder = order === 'asc' ? 1 : -1;
    links.sort((a, b) => {
      if (sortField === 'date') return sortOrder * (new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
      if (sortField === 'platform') return sortOrder * ((a.platformLabel || '') + '').localeCompare(b.platformLabel || '');
      if (sortField === 'author') return sortOrder * ((a.author || '') + '').localeCompare(b.author || '');
      return 0;
    });

    const total = links.length;
    const paginated = links.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    const stats = {
      total,
      byPlatform: {},
      byCategory: {},
      broken: links.filter(l => l.preview?.isBroken || l.preview?.isError).length,
      active: links.filter(l => !l.preview?.isBroken && !l.preview?.isError).length
    };
    links.forEach(l => {
      stats.byPlatform[l.platform] = (stats.byPlatform[l.platform] || 0) + 1;
      stats.byCategory[l.category] = (stats.byCategory[l.category] || 0) + 1;
    });

    res.json({
      success: true,
      links: paginated,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset), hasMore: parseInt(offset) + paginated.length < total },
      stats,
      filters: { platforms: Object.keys(stats.byPlatform), categories: Object.keys(stats.byCategory) }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/links/platforms
app.get('/api/links/platforms', (req, res) => {
  const { PLATFORM_PATTERNS } = require('./services/url-classifier');
  const platforms = Object.entries(PLATFORM_PATTERNS)
    .filter(([key]) => key !== 'default')
    .map(([key, value]) => ({ id: key, label: value.label, color: value.color, icon: value.icon, category: value.category }));
  res.json({ success: true, platforms });
});

// GET /api/links/stats
app.get('/api/links/stats', async (req, res) => {
  try {
    const index = readJSON(LINKS_INDEX_FILE) || { links: [] };
    const links = index.links || [];
    res.json({
      success: true,
      total: links.length,
      byPlatform: links.reduce((acc, l) => { acc[l.platform] = (acc[l.platform] || 0) + 1; return acc; }, {}),
      byCategory: links.reduce((acc, l) => { acc[l.category] = (acc[l.category] || 0) + 1; return acc; }, {}),
      broken: links.filter(l => l.preview?.isBroken).length,
      needsEnrichment: links.filter(l => !l.enrichedAt).length,
      lastUpdated: index.lastUpdated
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/links/enrich — Forçar enriquecimento
app.post('/api/links/enrich', async (req, res) => {
  try {
    const index = readJSON(LINKS_INDEX_FILE) || { links: [] };
    let links = index.links || [];
    for (const link of links.slice(0, 20)) {
      const preview = await fetchLinkPreview(link.url);
      const classification = classifyUrl(link.url);
      const idx = links.findIndex(l => l.id === link.id || l.url === link.url);
      if (idx !== -1) {
        links[idx] = { ...links[idx], preview, ...classification, enrichedAt: new Date().toISOString() };
      }
    }
    writeJSON(LINKS_INDEX_FILE, { links, lastUpdated: new Date().toISOString() });
    res.json({ success: true, enriched: links.length, message: `${links.length} links enriquecidos` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/links/sync — Sincronizar com luna-buffer.json
app.post('/api/links/sync', (req, res) => {
  try {
    const bufferPath = path.join(DATA_DIR, 'luna-buffer.json');
    const buffer = readJSON(bufferPath) || { links: [] };
    const index = readJSON(LINKS_INDEX_FILE) || { links: [] };
    const existingUrls = new Set(index.links.map(l => l.url));

    let added = 0;
    const allBufferLinks = [...(buffer.links || []), ...(buffer.newLinks || [])];
    allBufferLinks.forEach(link => {
      if (!existingUrls.has(link.url)) {
        const classification = classifyUrl(link.url);
        index.links.unshift({
          id: link.id || `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: link.url,
          author: link.author || 'Desconhecido',
          timestamp: link.timestamp || new Date().toISOString(),
          chat: link.chat || 'Desconhecido',
          ...classification,
          enrichedAt: null,
          createdAt: new Date().toISOString()
        });
        added++;
      }
    });

    writeJSON(LINKS_INDEX_FILE, { links: index.links, lastUpdated: new Date().toISOString() });
    broadcast({ type: 'links:sync', data: { added, total: index.links.length } });
    res.json({ success: true, added, total: index.links.length, message: `${added} novos links sincronizados do buffer` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/links — Adicionar link manualmente
app.post('/api/links', async (req, res) => {
  try {
    const { url, author, chat, notes } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL obrigatória' });
    const index = readJSON(LINKS_INDEX_FILE) || { links: [] };
    const exists = index.links.find(l => l.url === url);
    if (exists) return res.status(409).json({ success: false, error: 'Link já existe', existing: exists });

    const preview = await fetchLinkPreview(url);
    const classification = classifyUrl(url);
    const newLink = {
      id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url,
      author: author || 'Desconhecido',
      timestamp: new Date().toISOString(),
      chat: chat || 'Desconhecido',
      notes: notes || '',
      manual: true,
      preview,
      ...classification,
      enrichedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    index.links.unshift(newLink);
    writeJSON(LINKS_INDEX_FILE, { links: index.links, lastUpdated: new Date().toISOString() });
    broadcast({ type: 'links:new', data: newLink });
    res.status(201).json({ success: true, link: newLink });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/links/:id
app.delete('/api/links/:id', (req, res) => {
  try {
    const index = readJSON(LINKS_INDEX_FILE) || { links: [] };
    const link = index.links.find(l => l.id === req.params.id);
    if (!link) return res.status(404).json({ success: false, error: 'Link não encontrado' });
    index.links = index.links.filter(l => l.id !== req.params.id);
    writeJSON(LINKS_INDEX_FILE, { links: index.links, lastUpdated: new Date().toISOString() });
    broadcast({ type: 'links:delete', data: { id: req.params.id } });
    res.json({ success: true, deleted: link });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/links/:id
app.put('/api/links/:id', (req, res) => {
  try {
    const index = readJSON(LINKS_INDEX_FILE) || { links: [] };
    const idx = index.links.findIndex(l => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Link não encontrado' });
    index.links[idx] = { ...index.links[idx], ...req.body, updatedAt: new Date().toISOString() };
    writeJSON(LINKS_INDEX_FILE, { links: index.links, lastUpdated: new Date().toISOString() });
    broadcast({ type: 'links:update', data: index.links[idx] });
    res.json({ success: true, link: index.links[idx] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Email Hub API — NEXO Mail (Gmail OAuth2 + Gmail API REST)
// ═══════════════════════════════════════════════════════════════════════════════

const EmailAgent = require('./services/email-agent');
const emailAgent = new EmailAgent();
const gmailOAuth = require('./services/gmail-oauth');
const gmailAPI = require('./services/gmail-api');
const emailAI = require('./services/email-ai');
const lunaNLU = require('./services/luna-nlu');

// ── AUTH: OAuth2 Gmail ──

app.get('/api/email/auth/url', (req, res) => {
  try {
    const url = gmailOAuth.getAuthUrl();
    res.json({ success: true, authUrl: url });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/email/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ success: false, error: 'Código de autorização ausente' });
    const result = await gmailOAuth.exchangeCode(code);
    if (!result.success) return res.status(400).json(result);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/auth/revoke', async (req, res) => {
  try {
    const result = await gmailOAuth.revokeAccess();
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/email/auth/status', (req, res) => {
  try {
    const status = gmailOAuth.getStatus();
    res.json({ success: true, ...status });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── MESSAGES: Gmail API REST ──

app.get('/api/email/messages', async (req, res) => {
  try {
    const { labelIds, q, maxResults, pageToken } = req.query;
    const result = await gmailAPI.listMessages({
      labelIds: labelIds ? labelIds.split(',') : undefined,
      q,
      maxResults: maxResults ? parseInt(maxResults) : 50,
      pageToken,
    });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/email/messages/:id', async (req, res) => {
  try {
    const message = await gmailAPI.getMessage(req.params.id, 'full');
    res.json({ success: true, message });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/email/threads/:id', async (req, res) => {
  try {
    const thread = await gmailAPI.getThread(req.params.id);
    res.json({ success: true, thread });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/messages/:id/modify', async (req, res) => {
  try {
    const { addLabelIds, removeLabelIds } = req.body;
    const result = await gmailAPI.modifyMessage(req.params.id, { addLabelIds, removeLabelIds });
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/messages/:id/read', async (req, res) => {
  try {
    const result = await gmailAPI.markAsRead(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/messages/:id/unread', async (req, res) => {
  try {
    const result = await gmailAPI.markAsUnread(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/messages/:id/star', async (req, res) => {
  try {
    const result = await gmailAPI.toggleStar(req.params.id, true);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/messages/:id/unstar', async (req, res) => {
  try {
    const result = await gmailAPI.toggleStar(req.params.id, false);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/messages/:id/archive', async (req, res) => {
  try {
    const result = await gmailAPI.archive(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/messages/:id/trash', async (req, res) => {
  try {
    const result = await gmailAPI.trash(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/messages/:id/spam', async (req, res) => {
  try {
    const result = await gmailAPI.spam(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/messages/send', async (req, res) => {
  try {
    const { to, subject, text, html, cc, bcc, attachments, threadId, inReplyTo } = req.body;
    if (!to || !subject) return res.status(400).json({ success: false, error: 'Destinatario e assunto obrigatorios' });
    const result = await gmailAPI.sendEmail({ to, subject, text, html, cc, bcc, attachments, threadId, inReplyTo });
    broadcast({ type: 'email:sent', data: result });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/drafts', async (req, res) => {
  try {
    const { to, subject, text, html, cc, bcc } = req.body;
    const result = await gmailAPI.createDraft({ to, subject, text, html, cc, bcc });
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/email/labels', async (req, res) => {
  try {
    const labels = await gmailAPI.listLabels();
    res.json({ success: true, labels });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/email/profile', async (req, res) => {
  try {
    const profile = await gmailAPI.getProfile();
    res.json({ success: true, profile });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── AI: Luna Email Assistant ──

app.post('/api/email/ai/suggest-reply', async (req, res) => {
  try {
    const { threadMessages, clientContext } = req.body;
    if (!threadMessages || !Array.isArray(threadMessages)) {
      return res.status(400).json({ success: false, error: 'threadMessages é obrigatório (array)' });
    }
    const result = await emailAI.suggestReply(threadMessages, clientContext);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/ai/draft', async (req, res) => {
  try {
    const { threadMessages, instructions, clientContext } = req.body;
    if (!threadMessages || !instructions) {
      return res.status(400).json({ success: false, error: 'threadMessages e instructions são obrigatórios' });
    }
    const result = await emailAI.createDraft(threadMessages, instructions, clientContext);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/ai/summarize', async (req, res) => {
  try {
    const { threadMessages } = req.body;
    if (!threadMessages || !Array.isArray(threadMessages)) {
      return res.status(400).json({ success: false, error: 'threadMessages é obrigatório' });
    }
    const result = await emailAI.summarizeThread(threadMessages);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/email/ai/analyze', async (req, res) => {
  try {
    const { emailData } = req.body;
    if (!emailData) return res.status(400).json({ success: false, error: 'emailData é obrigatório' });
    const result = await emailAI.analyzeEmail(emailData);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Criar tarefas a partir de action items extraídos do email
app.post('/api/email/ai/action-items-to-tasks', requireAuth, async (req, res) => {
  try {
    const { threadId, subject, actionItems } = req.body;
    if (!Array.isArray(actionItems) || actionItems.length === 0) {
      return res.status(400).json({ success: false, error: 'actionItems é obrigatório e deve ser um array' });
    }

    const createdTasks = [];
    for (const item of actionItems) {
      const taskResult = await lunaActionExecutor.execute([
        {
          type: 'criar_tarefa',
          params: {
            titulo: item,
            descricao: `Action item extraído do email: "${subject || 'Email'}" (thread: ${threadId || 'N/A'})`,
            prioridade: 'P2',
            responsavel: req.user?.userId || 'abner'
          }
        }
      ], { authorName: 'Luna' });
      const task = taskResult?.results?.[0];
      if (task) createdTasks.push(task);
    }

    if (createdTasks.length > 0) {
      addNotification({
        type: 'luna_email_tasks',
        title: `${createdTasks.length} tarefa(s) criada(s) do email`,
        message: `Action items de "${subject || 'Email'}" foram convertidos em tarefas.`,
        severity: 'low',
        metadata: { threadId, subject, taskIds: createdTasks.map((t) => t.id) }
      });
    }

    res.json({ success: true, tasks: createdTasks });
  } catch (e) {
    console.error('[ActionItems→Tasks] Erro:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── LUNA EMAIL DRAFTS: rascunhos de resposta para aprovação ──

const EMAIL_DRAFTS_FILE = path.join(DATA_DIR, 'email-drafts.json');

function readEmailDrafts() {
  return readJSON(EMAIL_DRAFTS_FILE, { drafts: [], lastId: 0 });
}

function writeEmailDrafts(data) {
  writeJSON(EMAIL_DRAFTS_FILE, data);
}

// Gerar rascunho da Luna e criar tarefa + notificação para aprovação
app.post('/api/email/ai/draft-for-approval', requireAuth, async (req, res) => {
  try {
    const { threadMessages, instructions, emailId, threadId, subject, from } = req.body;
    if (!threadMessages || !emailId || !threadId) {
      return res.status(400).json({ success: false, error: 'threadMessages, emailId e threadId são obrigatórios' });
    }

    // Gerar draft via AI
    const draftResult = await emailAI.createDraft(
      threadMessages,
      instructions || 'Sugira uma resposta profissional e completa.',
      { from, subject }
    );

    // Salvar rascunho local
    const draftsData = readEmailDrafts();
    draftsData.lastId = (draftsData.lastId || 0) + 1;
    const draftId = `luna-draft-${draftsData.lastId}`;
    const draft = {
      id: draftId,
      emailId,
      threadId,
      subject: draftResult.subject || `Re: ${subject || 'Email'}`,
      body: draftResult.body || draftResult.text || '',
      notes: draftResult.notes || '',
      tone: draftResult.tone || 'professional',
      status: 'pending',
      createdBy: 'luna',
      approvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    draftsData.drafts.unshift(draft);
    if (draftsData.drafts.length > 200) draftsData.drafts = draftsData.drafts.slice(0, 200);
    writeEmailDrafts(draftsData);

    // Criar tarefa para aprovação via ActionExecutor
    const taskResult = await lunaActionExecutor.execute([
      {
        type: 'criar_tarefa',
        params: {
          titulo: `Revisar resposta da Luna para: ${subject || 'Email'}`,
          descricao: `Luna gerou um rascunho de resposta para o email de ${from || 'remetente'}.\n\nAcesse o Email Hub para revisar e aprovar.`,
          prioridade: 'P1',
          responsavel: req.user?.userId || 'abner'
        }
      }
    ], { authorName: 'Luna' });

    // Notificação
    const notif = addNotification({
      type: 'luna_email_draft',
      title: 'Luna sugeriu uma resposta',
      message: `Rascunho gerado para "${subject || 'Email'}". Revise antes de enviar.`,
      severity: 'medium',
      metadata: { draftId, threadId, emailId, subject }
    });

    res.json({
      success: true,
      draft,
      task: taskResult?.results?.[0] || null,
      notification: notif
    });
  } catch (e) {
    console.error('[LunaDraft] Erro:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Listar rascunhos (opcionalmente filtrar por threadId)
app.get('/api/email/drafts', requireAuth, (req, res) => {
  try {
    const { threadId, status } = req.query;
    const draftsData = readEmailDrafts();
    let drafts = draftsData.drafts || [];
    if (threadId) drafts = drafts.filter(d => d.threadId === threadId);
    if (status) drafts = drafts.filter(d => d.status === status);
    res.json({ success: true, drafts });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Aprovar rascunho
app.post('/api/email/drafts/:id/approve', requireAuth, (req, res) => {
  try {
    const draftsData = readEmailDrafts();
    const draft = draftsData.drafts.find(d => d.id === req.params.id);
    if (!draft) return res.status(404).json({ success: false, error: 'Rascunho não encontrado' });
    draft.status = 'approved';
    draft.approvedBy = req.user?.userId || 'user';
    draft.updatedAt = new Date().toISOString();
    writeEmailDrafts(draftsData);
    res.json({ success: true, draft });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Rejeitar rascunho
app.post('/api/email/drafts/:id/reject', requireAuth, (req, res) => {
  try {
    const draftsData = readEmailDrafts();
    const draft = draftsData.drafts.find(d => d.id === req.params.id);
    if (!draft) return res.status(404).json({ success: false, error: 'Rascunho não encontrado' });
    draft.status = 'rejected';
    draft.updatedAt = new Date().toISOString();
    writeEmailDrafts(draftsData);
    res.json({ success: true, draft });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── LEGACY: rotas antigas IMAP/SMTP (mantidas para compatibilidade) ──

app.get('/api/emails/config', (req, res) => {
  try {
    const config = emailAgent.loadConfig();
    res.json({ success: true, config: { user: config.user, imap: config.imap, smtp: { host: config.smtp.host, port: config.smtp.port }, checkInterval: config.checkInterval, folders: config.folders } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/emails/config', (req, res) => {
  try {
    const { user, password, imap, smtp, checkInterval } = req.body;
    const config = { user, password, imap: imap || { host: 'imap.gmail.com', port: 993, tls: true }, smtp: smtp || { host: 'smtp.gmail.com', port: 465, secure: true }, checkInterval: checkInterval || 5 * 60 * 1000, folders: ['INBOX', 'Sent', 'Drafts', 'Trash'] };
    emailAgent.saveConfig(config);
    res.json({ success: true, message: 'Configuracao salva' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/emails', async (req, res) => {
  try {
    const { folder = 'INBOX', search, isRead, limit = 50, offset = 0 } = req.query;
    const index = emailAgent.loadEmailIndex();
    let emails = [...(index.emails || [])];
    if (folder !== 'all') emails = emails.filter(e => e.folder === folder);
    if (search) { const q = search.toLowerCase(); emails = emails.filter(e => e.subject?.toLowerCase().includes(q) || e.from?.toLowerCase().includes(q) || e.text?.toLowerCase().includes(q)); }
    if (isRead !== undefined) emails = emails.filter(e => e.isRead === (isRead === 'true'));
    emails.sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = emails.length;
    const paginated = emails.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json({ success: true, emails: paginated, pagination: { total, limit: parseInt(limit), offset: parseInt(offset), hasMore: parseInt(offset) + paginated.length < total }, stats: { total, unread: emails.filter(e => !e.isRead).length, withAttachments: emails.filter(e => e.attachments?.length > 0).length } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/emails/send', async (req, res) => {
  try {
    const { to, subject, text, html, attachments } = req.body;
    if (!to || !subject) return res.status(400).json({ success: false, error: 'Destinatario e assunto obrigatorios' });
    const result = await emailAgent.sendEmail({ to, subject, text, html, attachments });
    const index = emailAgent.loadEmailIndex();
    index.emails.unshift({ id: `email-sent-${Date.now()}`, folder: 'Sent', subject, from: emailAgent.config.user, to, text, html, date: new Date().toISOString(), isRead: true, sentViaDashboard: true });
    emailAgent.saveEmailIndex(index);
    broadcast({ type: 'email:sent', data: result });
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/emails/sync', async (req, res) => {
  try {
    const emails = await emailAgent.fetchEmails('INBOX', 100);
    const index = emailAgent.loadEmailIndex();
    let added = 0;
    for (const email of emails) {
      if (!index.emails.find(e => e.uid === email.uid)) {
        index.emails.unshift(email);
        added++;
      }
    }
    if (index.emails.length > 500) index.emails = index.emails.slice(0, 500);
    index.lastSync = new Date().toISOString();
    emailAgent.saveEmailIndex(index);
    broadcast({ type: 'emails:sync', data: { added, total: index.emails.length } });
    res.json({ success: true, added, total: index.emails.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Leads Pipeline API
// ═══════════════════════════════════════════════════════════════════════════════

const LEAD_STATUSES = ['novo', 'contatado', 'proposta_enviada', 'negociacao', 'ganho', 'perdido'];

// GET /api/leads — Lista todos os leads
app.get('/api/leads', (req, res) => {
  try {
    const { status, assignedTo, source, search } = req.query;
    const registry = readJSON(CLIENTS_REGISTRY_FILE) || { clients: {} };
    let leads = Object.entries(registry.clients || {}).map(([id, data]) => ({
      id,
      ...data
    }));

    // Só retornar leads (não clientes já convertidos, a menos que explicitamente pedido)
    if (!req.query.includeClients) {
      leads = leads.filter(l => l.type === 'lead' || LEAD_STATUSES.includes(l.pipelineStatus));
    }

    if (status) leads = leads.filter(l => l.pipelineStatus === status);
    if (assignedTo) leads = leads.filter(l => l.assignedTo === assignedTo);
    if (source) leads = leads.filter(l => (l.source || '').toLowerCase().includes(source.toLowerCase()));
    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(l =>
        (l.displayName || '').toLowerCase().includes(q) ||
        (l.notes || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q)
      );
    }

    res.json({ success: true, leads, total: leads.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/leads/:id — Detalhe de um lead
app.get('/api/leads/:id', (req, res) => {
  try {
    const registry = readJSON(CLIENTS_REGISTRY_FILE) || { clients: {} };
    const lead = registry.clients?.[req.params.id];
    if (!lead) return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
    res.json({ success: true, lead: { id: req.params.id, ...lead } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/leads — Criar lead
app.post('/api/leads', (req, res) => {
  try {
    const { displayName, name, email, phone, source, estimatedValue, notes, assignedTo, tags } = req.body;
    const leadName = displayName || name;
    if (!leadName) {
      return res.status(400).json({ success: false, error: 'displayName obrigatorio' });
    }
    const registry = readJSON(CLIENTS_REGISTRY_FILE) || { clients: {}, schema: { version: '16.1.0' } };
    const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    registry.clients[id] = {
      displayName: leadName,
      email: email || '',
      phone: phone || '',
      source: source || 'manual',
      type: 'lead',
      status: 'potencial',
      pipelineStatus: 'novo',
      estimatedValue: estimatedValue || 0,
      currency: 'EUR',
      notes: notes || '',
      assignedTo: assignedTo || null,
      tags: tags || [],
      createdAt: new Date().toISOString(),
      lastContact: null
    };
    writeJSON(CLIENTS_REGISTRY_FILE, registry);
    broadcast({ type: 'leads:create', data: { id, ...registry.clients[id] } });
    res.json({ success: true, lead: { id, ...registry.clients[id] } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/leads/:id — Atualizar lead
app.put('/api/leads/:id', (req, res) => {
  try {
    const registry = readJSON(CLIENTS_REGISTRY_FILE) || { clients: {} };
    if (!registry.clients?.[req.params.id]) {
      return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
    }
    const allowed = ['displayName', 'email', 'phone', 'source', 'pipelineStatus', 'estimatedValue', 'currency', 'notes', 'assignedTo', 'tags', 'lastContact'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        registry.clients[req.params.id][key] = req.body[key];
      }
    }
    registry.clients[req.params.id].updatedAt = new Date().toISOString();
    writeJSON(CLIENTS_REGISTRY_FILE, registry);
    broadcast({ type: 'leads:update', data: { id: req.params.id, ...registry.clients[req.params.id] } });
    res.json({ success: true, lead: { id: req.params.id, ...registry.clients[req.params.id] } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/leads/:id/convert — Converter lead em cliente + criar workspace
app.post('/api/leads/:id/convert', async (req, res) => {
  try {
    const registry = readJSON(CLIENTS_REGISTRY_FILE) || { clients: {} };
    const leadId = req.params.id;
    if (!registry.clients?.[leadId]) {
      return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
    }

    registry.clients[leadId].type = 'cliente-externo';
    registry.clients[leadId].status = 'ativo';
    registry.clients[leadId].pipelineStatus = 'ganho';
    registry.clients[leadId].convertedAt = new Date().toISOString();
    writeJSON(CLIENTS_REGISTRY_FILE, registry);

    // Cria workspace se ainda não existir
    let workspace = null;
    if (!workspaceManager.clientExists(leadId)) {
      const lead = registry.clients[leadId];
      const displayName = lead.name || lead.displayName || lead.company || leadId;
      workspace = workspaceManager.createClient(leadId, {
        nome: displayName,
        status: 'ativo',
        responsavel: lead.assignedTo || 'todos',
        cor: lead.cor || lead.color || '#22C55E'
      });

      // Cria README.md na raiz do workspace
      const readmePath = path.join(workspaceManager.WORKSPACE_DIR, leadId, 'README.md');
      const readmeContent = `# ${displayName}

**Status:** Ativo  
**Convertido em:** ${new Date().toISOString()}  
**Pipeline:** Ganho  

---

Pasta padrão do workspace NEXO.
`;
      fs.writeFileSync(readmePath, readmeContent, 'utf8');
    } else {
      workspace = workspaceManager.getClient(leadId);
    }

    broadcast({ type: 'leads:convert', data: { id: leadId, ...registry.clients[leadId] } });
    res.json({ success: true, lead: { id: leadId, ...registry.clients[leadId] }, workspace });
  } catch (e) {
    console.error('[Convert Lead] Erro:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/leads/:id — Remover lead
app.delete('/api/leads/:id', (req, res) => {
  try {
    const registry = readJSON(CLIENTS_REGISTRY_FILE) || { clients: {} };
    if (!registry.clients?.[req.params.id]) {
      return res.status(404).json({ success: false, error: 'Lead nao encontrado' });
    }
    delete registry.clients[req.params.id];
    writeJSON(CLIENTS_REGISTRY_FILE, registry);
    broadcast({ type: 'leads:delete', data: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Instagram Hub API
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/instagram/profile', (req, res) => {
  try {
    const profile = {
      username: 'nexodigital',
      displayName: 'NEXO Digital',
      bio: 'Transformando ideias em realidade digital 🚀',
      profileUrl: 'https://instagram.com/nexodigital',
      avatarUrl: '/assets/nexo-insta-avatar.jpg',
      followers: 1250,
      following: 340,
      posts: 89,
      isBusiness: true,
      category: 'Marketing Agency'
    };
    res.json({ success: true, profile });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/instagram/messages', (req, res) => {
  try {
    const instaFile = path.join(DATA_DIR, 'instagram-messages.json');
    const data = fs.existsSync(instaFile) ? JSON.parse(fs.readFileSync(instaFile, 'utf8')) : { messages: [] };
    res.json({ success: true, messages: data.messages || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/instagram/messages/import', (req, res) => {
  try {
    const { messages } = req.body;
    const instaFile = path.join(DATA_DIR, 'instagram-messages.json');
    const data = fs.existsSync(instaFile) ? JSON.parse(fs.readFileSync(instaFile, 'utf8')) : { messages: [] };
    let added = 0;
    for (const msg of (messages || [])) {
      if (!data.messages.find(m => m.id === msg.id)) {
        data.messages.unshift({ ...msg, importedAt: new Date().toISOString() });
        added++;
      }
    }
    fs.writeFileSync(instaFile, JSON.stringify(data, null, 2));
    res.json({ success: true, added, total: data.messages.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Detect Client API
// ═══════════════════════════════════════════════════════════════════════════════

const { detectClient } = require('./services/detect-client');

app.post('/api/detect-client', (req, res) => {
  try {
    const result = detectClient(req.body);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================================================
// SYSTEM ENGINE API — Controle do Backend, Frontend e Supervisor
// ============================================================================

const ROOT_DIR = path.join(__dirname, '..');

function getProcessPid(pattern) {
    try {
        const pids = fs.readdirSync('/proc').filter(x => /^[0-9]+$/.test(x));
        for (const pidStr of pids) {
            try {
                const cmdline = fs.readFileSync('/proc/' + pidStr + '/cmdline', 'utf8').replace(/\0/g, ' ');
                if (cmdline.includes(pattern)) return parseInt(pidStr, 10);
            } catch { /* ignore */ }
        }
        return null;
    } catch { return null; }
}

function isProcessRunning(pattern) {
    return getProcessPid(pattern) !== null;
}

app.get('/api/system/status', (req, res) => {
    try {
        const backendPid = getProcessPid('node backend/server.js');
        const frontendPid = getProcessPid('vite --port 3457');
        const lunaPid = getProcessPid('luna-scheduler.mjs') || getProcessPid('luna-daemon.mjs');
        const supervisorPid = getProcessPid('supervisor.sh');
        let chromeConnected = false;
        try {
            execSync('curl -s http://localhost:9223/json/version > /dev/null', { timeout: 2000, stdio: 'ignore' });
            chromeConnected = true;
        } catch {}
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            backend: { running: !!backendPid, pid: backendPid, port: 3456 },
            frontend: { running: !!frontendPid, pid: frontendPid, port: 3457 },
            luna: { running: !!lunaPid, pid: lunaPid },
            supervisor: { running: !!supervisorPid, pid: supervisorPid },
            chrome: { connected: chromeConnected, port: 9223 },
            gemini: { connected: !!process.env.GEMINI_API_KEY, model: 'gemini-2.5-flash-lite' },
            uptime: process.uptime(),
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/system/logs', (req, res) => {
    try {
        const service = req.query.service || 'luna'; // luna | backend | frontend | supervisor
        const lines = parseInt(req.query.lines) || 200;
        const logMap = {
            luna: path.join(ROOT_DIR, 'luna-run.log'),
            backend: path.join(ROOT_DIR, 'backend.log'),
            frontend: path.join(ROOT_DIR, 'frontend.log'),
            supervisor: path.join(ROOT_DIR, 'supervisor.log'),
        };
        const logPath = logMap[service];
        if (!logPath || !fs.existsSync(logPath)) {
            return res.json({ success: true, logs: [], count: 0, service });
        }
        const content = fs.readFileSync(logPath, 'utf8');
        const allLines = content.split('\n').filter(Boolean);
        const recent = allLines.slice(-lines);
        res.json({ success: true, logs: recent, count: recent.length, total: allLines.length, service });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/system/control', (req, res) => {
    try {
        const { service, action } = req.body;
        const VALID_SERVICES = ['backend', 'frontend', 'luna', 'supervisor'];
        if (!VALID_SERVICES.includes(service)) {
            return res.status(400).json({ success: false, error: `Servico invalido. Use: ${VALID_SERVICES.join(', ')}` });
        }
        if (!['start', 'stop', 'restart'].includes(action)) {
            return res.status(400).json({ success: false, error: 'Acao invalida. Use: start, stop, restart' });
        }

        const backendScript = `cd ${ROOT_DIR}/backend && nohup node server.js > ${ROOT_DIR}/backend.log 2>&1 &`;
        const frontendScript = `cd ${ROOT_DIR}/frontend && nohup npm run dev > ${ROOT_DIR}/frontend.log 2>&1 &`;

        if (service === 'backend') {
            if (action === 'stop' || action === 'restart') {
                try { execSync('pkill -f "node server.js"', { stdio: 'ignore' }); } catch {}
            }
            if (action === 'start' || action === 'restart') {
                setTimeout(() => {
                    try { execSync(backendScript, { stdio: 'ignore' }); } catch {}
                }, action === 'restart' ? 2000 : 0);
            }
        }

        if (service === 'frontend') {
            if (action === 'stop' || action === 'restart') {
                try { execSync('pkill -f "vite --port 3457"', { stdio: 'ignore' }); } catch {}
            }
            if (action === 'start' || action === 'restart') {
                setTimeout(() => {
                    try { execSync(frontendScript, { stdio: 'ignore' }); } catch {}
                }, action === 'restart' ? 2000 : 0);
            }
        }

        if (service === 'luna') {
            if (action === 'stop' || action === 'restart') {
                try { execSync('pkill -f "luna-daemon.mjs"', { stdio: 'ignore' }); } catch {}
                try { execSync('pkill -f "luna-scheduler.mjs"', { stdio: 'ignore' }); } catch {}
            }
            if (action === 'start' || action === 'restart') {
                setTimeout(() => {
                    try {
                        const daemonPath = path.join(ROOT_DIR, 'agents', 'luna-daemon.mjs');
                        if (fs.existsSync(daemonPath)) {
                            const p = spawn('node', [daemonPath], {
                                cwd: path.join(ROOT_DIR, 'agents'),
                                detached: true, stdio: 'ignore', windowsHide: true
                            });
                            p.unref();
                        }
                    } catch {}
                }, action === 'restart' ? 2000 : 0);
            }
        }

        if (service === 'supervisor') {
            if (action === 'stop' || action === 'restart') {
                try { execSync('pkill -f "supervisor.sh"', { stdio: 'ignore' }); } catch {}
                try { execSync('pkill -f "supervisor.js"', { stdio: 'ignore' }); } catch {}
            }
            if (action === 'start' || action === 'restart') {
                setTimeout(() => {
                    try {
                        const supervisorPath = path.join(ROOT_DIR, 'supervisor.sh');
                        if (fs.existsSync(supervisorPath)) {
                            const p = spawn('bash', [supervisorPath], {
                                cwd: ROOT_DIR,
                                detached: true, stdio: 'ignore', windowsHide: true
                            });
                            p.unref();
                        }
                    } catch {}
                }, action === 'restart' ? 2000 : 0);
            }
        }

        res.json({
            success: true,
            service,
            action,
            message: `${service} ${action === 'restart' ? 'reiniciando' : action === 'start' ? 'iniciando' : 'parando'}...`
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Stack Status & Auto-Fix APIs (para StackStatus.tsx e AutoFixPanel.tsx)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/stack-status', (req, res) => {
  try {
    const lunaStatus = readJSON(path.join(DATA_DIR, 'luna-status.json'), {}) || {};
    const backendPid = process.pid;
    const frontendPid = lunaStatus.frontendPid || null;
    const lunaPid = lunaStatus.pid || null;
    
    const isPortOpen = (port) => {
      try { execSync(`nc -z localhost ${port} 2>/dev/null || curl -s -o /dev/null -w '%{http_code}' http://localhost:${port} | grep -q 200`, { stdio: 'ignore' }); return true; } catch { return false; }
    };

    res.json({
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      services: {
        backend: { status: 'online', port: 3456, uptime: process.uptime(), last_checkpoint: null },
        frontend: { status: isPortOpen(3457) ? 'online' : 'offline', port: 3457, uptime: null, last_checkpoint: null },
        chrome_cdp: { status: isPortOpen(9223) ? 'online' : 'offline', port: 9223, uptime: null, last_checkpoint: null },
        luna_daemon: { status: lunaPid ? 'online' : 'offline', port: null, uptime: null, last_checkpoint: lunaStatus.lastScan || null }
      }
    });
  } catch (e) {
    res.status(500).json({ timestamp: new Date().toISOString(), overall: 'degraded', services: {}, error: e.message });
  }
});

app.get('/api/stack-logs', (req, res) => {
  try {
    const logFile = path.join(ROOT_DIR, 'backend.log');
    let lines = [];
    if (fs.existsSync(logFile)) {
      lines = fs.readFileSync(logFile, 'utf-8').split(/\r?\n/).filter(Boolean).slice(-50);
    }
    res.json({ logs: lines.length ? lines : ['Nenhum log disponivel'] });
  } catch (e) {
    res.status(500).json({ logs: ['Erro ao ler logs: ' + e.message] });
  }
});

// Auto-Fix endpoints
const AUTO_FIX_HISTORY = [];

app.get('/api/auto-fix/status', (req, res) => {
  const lunaStatus = readJSON(path.join(DATA_DIR, 'luna-status.json'), {});
  res.json({
    timestamp: new Date().toISOString(),
    isRunning: false,
    lastCheck: new Date().toISOString(),
    overall: lunaStatus.pid ? 'healthy' : 'degraded',
    config: { checkInterval: 30000, maxRetries: 3 },
    services: {
      backend: { status: 'online', lastCheck: new Date().toISOString(), details: 'Rodando normalmente' },
      frontend: { status: 'online', lastCheck: new Date().toISOString(), details: 'Vite dev server ativo' },
      chrome_cdp: { status: lunaStatus.chromeConnected ? 'online' : 'offline', lastCheck: new Date().toISOString(), details: lunaStatus.chromeConnected ? 'CDP conectado' : 'CDP desconectado' },
      luna_daemon: { status: lunaStatus.pid ? 'online' : 'offline', lastCheck: new Date().toISOString(), details: lunaStatus.pid ? `PID ${lunaStatus.pid}` : 'Nao rodando', autoFixed: false }
    }
  });
});

app.get('/api/auto-fix/history', (req, res) => {
  res.json({
    fixes: AUTO_FIX_HISTORY,
    total: AUTO_FIX_HISTORY.length,
    successCount: AUTO_FIX_HISTORY.filter(f => f.success).length,
    failCount: AUTO_FIX_HISTORY.filter(f => !f.success).length
  });
});

app.post('/api/auto-fix/check-now', (req, res) => {
  try {
    const lunaStatus = readJSON(path.join(DATA_DIR, 'luna-status.json'), {});
    const isPortOpen = (port) => {
      try { execSync(`nc -z localhost ${port} 2>/dev/null || curl -s -o /dev/null -w '%{http_code}' http://localhost:${port} | grep -q 200`, { stdio: 'ignore' }); return true; } catch { return false; }
    };
    const hasDaemon = () => {
      try { execSync('pgrep -f "luna-daemon.mjs"', { stdio: 'ignore' }); return true; } catch { return false; }
    };

    const results = {
      backend: { status: 'online', details: `PID ${process.pid}` },
      frontend: { status: isPortOpen(3457) ? 'online' : 'offline', details: isPortOpen(3457) ? 'Porta 3457 ativa' : 'Porta 3457 inativa' },
      chrome_cdp: { status: isPortOpen(9223) ? 'online' : 'offline', details: isPortOpen(9223) ? 'CDP conectado' : 'CDP desconectado' },
      luna_daemon: { status: hasDaemon() ? 'online' : 'offline', details: hasDaemon() ? 'Daemon ativo' : 'Daemon inativo' }
    };

    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      service: 'all',
      action: 'check_now',
      success: true,
      details: `Verificacao manual: ${Object.entries(results).map(([k,v]) => `${k}=${v.status}`).join(', ')}`
    };
    AUTO_FIX_HISTORY.unshift(entry);
    if (AUTO_FIX_HISTORY.length > 50) AUTO_FIX_HISTORY.pop();

    res.json({ success: true, message: 'Verificacao executada', results, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/auto-fix/fix/:service', (req, res) => {
  try {
    const { service } = req.params;
    const VALID = ['backend', 'frontend', 'luna_daemon', 'chrome_cdp'];
    if (!VALID.includes(service)) {
      return res.status(400).json({ success: false, error: `Servico invalido. Use: ${VALID.join(', ')}` });
    }

    let success = false;
    let details = '';

    if (service === 'backend') {
      try { execSync('pkill -f "node server.js"', { stdio: 'ignore' }); } catch {}
      setTimeout(() => {
        try {
          const script = `cd ${ROOT_DIR}/backend && nohup node server.js > ${ROOT_DIR}/backend.log 2>&1 &`;
          execSync(script, { stdio: 'ignore' });
        } catch {}
      }, 2000);
      success = true;
      details = 'Backend reiniciado';
    }

    if (service === 'frontend') {
      try { execSync('pkill -f "vite --port 3457"', { stdio: 'ignore' }); } catch {}
      setTimeout(() => {
        try {
          const script = `cd ${ROOT_DIR}/frontend && nohup npm run dev > ${ROOT_DIR}/frontend.log 2>&1 &`;
          execSync(script, { stdio: 'ignore' });
        } catch {}
      }, 2000);
      success = true;
      details = 'Frontend reiniciado';
    }

    if (service === 'luna_daemon') {
      try { execSync('pkill -f "luna-daemon.mjs"', { stdio: 'ignore' }); } catch {}
      try { execSync('pkill -f "luna-scheduler.mjs"', { stdio: 'ignore' }); } catch {}
      setTimeout(() => {
        try {
          const daemonPath = path.join(ROOT_DIR, 'agents', 'luna-daemon.mjs');
          if (fs.existsSync(daemonPath)) {
            const p = spawn('node', [daemonPath], {
              cwd: path.join(ROOT_DIR, 'agents'),
              detached: true, stdio: 'ignore', windowsHide: true
            });
            p.unref();
          }
        } catch {}
      }, 2000);
      success = true;
      details = 'Luna daemon reiniciado';
    }

    if (service === 'chrome_cdp') {
      // Tentar reconectar ao Chrome CDP — não podemos iniciar o Chrome do nada sem saber o caminho
      const isPortOpen = (port) => {
        try { execSync(`nc -z localhost ${port} 2>/dev/null || curl -s -o /dev/null -w '%{http_code}' http://localhost:${port} | grep -q 200`, { stdio: 'ignore' }); return true; } catch { return false; }
      };
      if (isPortOpen(9223)) {
        success = true;
        details = 'Chrome CDP ja estava conectado na porta 9223';
      } else {
        success = false;
        details = 'Chrome CDP nao responde na porta 9223. Inicie o Chrome com --remote-debugging-port=9223';
      }
    }

    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      service,
      action: 'manual_fix',
      success,
      details
    };
    AUTO_FIX_HISTORY.unshift(entry);
    if (AUTO_FIX_HISTORY.length > 50) AUTO_FIX_HISTORY.pop();

    res.json({ success: true, message: details, entry });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH API v1.0 — Login Ultra-Secreto
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/auth/login — Valida credenciais e retorna JWT
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, fingerprint } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username e senha obrigatórios' });
    }

    const ip = getClientIp(req);
    const attemptedUser = username.toLowerCase().trim();

    // Validar credenciais
    const user = validateCredentials(attemptedUser, password);

    if (!user) {
      // Login falho — logar e possivelmente alertar
      const location = await getIpLocation(ip);
      const deviceInfo = fingerprint || {};
      const uaParsed = parseUserAgent(deviceInfo.userAgent || '');
      const event = await logSecurityEvent({
        type: 'failed_login',
        severity: 'high',
        ip,
        location,
        device: {
          browser: uaParsed.browser,
          browserVersion: uaParsed.browser,
          os: uaParsed.os,
          device: uaParsed.device,
          arch: uaParsed.arch,
          isMobile: uaParsed.isMobile,
          screen: deviceInfo.screen || 'Desconhecido',
          resolution: deviceInfo.screen || 'Desconhecido',
          gpu: deviceInfo.webgl || 'Desconhecido',
          timezone: deviceInfo.timezone || 'Desconhecido',
          language: deviceInfo.language || 'Desconhecido',
          fingerprint: deviceInfo.canvas?.slice(0, 16) || 'N/A',
          fingerprintFull: deviceInfo.canvas || 'N/A',
          userAgent: deviceInfo.userAgent || 'N/A'
        },
        attemptedUser,
        message: `Login falho para "${attemptedUser}" — IP: ${ip} (${location.city}, ${location.country})`,
        notified: false
      });

      // Verificar se atingiu limite de tentativas para alertar no WhatsApp
      const log = readJSON(SECURITY_LOG_FILE, { events: [], settings: {} });
      const recentAttempts = log.events.filter(e =>
        e.type === 'failed_login' &&
        e.ip === ip &&
        new Date(e.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
      );
      const settings = log.settings || {};
      const maxAttempts = settings.maxAttemptsBeforeAlert || 5;

      if (recentAttempts.length >= maxAttempts) {
        const msg = `🚨 *ALERTA DE SEGURANÇA — NEXO DASHBOARD*\n\n*Login falho ${recentAttempts.length} vezes seguidas!*\n\n👤 Usuário tentado: ${attemptedUser}\n🌐 IP: ${ip}\n📍 Localização: ${location.city || 'Desconhecido'}, ${location.country || 'Desconhecido'}\n🏢 ISP: ${location.isp || 'Desconhecido'}\n\n💻 *DISPOSITIVO DO INTRUSO:*\n   Navegador: ${uaParsed.browser}\n   Sistema: ${uaParsed.os}\n   Dispositivo: ${uaParsed.device}\n   Arquitetura: ${uaParsed.arch}\n   GPU: ${deviceInfo.webgl || 'N/A'}\n   Tela: ${deviceInfo.screen || 'N/A'}\n   Idioma: ${deviceInfo.language || 'N/A'}\n   Timezone: ${deviceInfo.timezone || 'N/A'}\n   🆔 Fingerprint: ${deviceInfo.canvas?.slice(0, 16) || 'N/A'}\n\n⏰ Horário: ${new Date().toLocaleString('pt-BR')}\n⚠️ Ação recomendada: Verificar security log no dashboard`;
        const alertResult = await sendSecurityWhatsAlert(msg);
        if (alertResult.sent) {
          event.notified = true;
          event.notificationChannel = 'whatsapp+dashboard';
        }
      }

      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    // Login sucesso — limpar tentativas falhas deste IP
    const token = generateToken(user.id);
    res.json({ success: true, token, user });

  } catch (e) {
    console.error('[AUTH] Erro no login:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/auth/logout — Invalida token (client-side remove, aqui só loga)
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logout realizado' });
});

// GET /api/auth/me — Retorna usuário autenticado
app.get('/api/auth/me', requireAuth, (req, res) => {
  try {
    const usersFile = path.join(DATA_DIR, 'users.json');
    const users = readJSON(usersFile, { users: {} });
    const user = users.users?.[req.user.userId];
    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    res.json({ success: true, user: { id: req.user.userId, name: user.name, role: user.role, color: user.color } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/auth/change-password — Altera senha do usuário logado
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Senha atual e nova senha obrigatórias' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, error: 'Nova senha deve ter no mínimo 4 caracteres' });
    }

    const usersFile = path.join(DATA_DIR, 'users.json');
    const users = readJSON(usersFile, { users: {} });
    const user = users.users?.[req.user.userId];
    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    const valid = bcrypt.compareSync(currentPassword, user.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Senha atual incorreta' });

    user.password = bcrypt.hashSync(newPassword, 10);
    writeJSON(usersFile, users);

    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY API v1.0 — Logs e Configurações
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/security/log — Retorna security log (protegido)
app.get('/api/security/log', requireAuth, (req, res) => {
  try {
    const log = readJSON(SECURITY_LOG_FILE, { version: '1.0', events: [], settings: {} });
    res.json({ success: true, events: log.events.slice(0, 50), settings: log.settings });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/security/settings — Retorna configurações de segurança
app.get('/api/security/settings', requireAuth, (req, res) => {
  try {
    const log = readJSON(SECURITY_LOG_FILE, { version: '1.0', events: [], settings: {} });
    res.json({ success: true, settings: log.settings || {} });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/security/settings — Atualiza configurações de segurança
app.put('/api/security/settings', requireAuth, (req, res) => {
  try {
    const log = readJSON(SECURITY_LOG_FILE, { version: '1.0', events: [], settings: {} });
    log.settings = { ...log.settings, ...req.body };
    writeJSON(SECURITY_LOG_FILE, log);
    res.json({ success: true, settings: log.settings });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/security/test-whatsapp — Testa envio de alerta no WhatsApp
app.post('/api/security/test-whatsapp', requireAuth, async (req, res) => {
  try {
    const settingsLog = readJSON(SECURITY_LOG_FILE, { version: '1.0', events: [], settings: {} });
    if (settingsLog.settings?.whatsappAlerts === false) {
      return res.status(400).json({ success: false, error: 'Alertas no WhatsApp estão desativados. Ative na aba Segurança primeiro.' });
    }

    const msg = `🧪 *TESTE DE ALERTA DE SEGURANÇA*\n\nEste é um teste enviado por ${req.user.userId}.\nSe você recebeu, o sistema de alertas está funcionando.\n\n⏰ ${new Date().toLocaleString('pt-BR')}`;
    const result = await sendSecurityWhatsAlert(msg, { skipRateLimit: true });

    if (result.sent) {
      res.json({ success: true, message: 'Mensagem de teste enviada no WhatsApp!' });
    } else if (result.reason === 'rate_limited') {
      res.status(429).json({ success: false, error: `Rate limit ativo. Tente novamente em ${result.retryAfter}s.`, reason: result.reason });
    } else if (result.reason === 'send_error') {
      res.status(502).json({ success: false, error: `Falha ao enviar: ${result.error}`, reason: result.reason });
    } else {
      res.status(500).json({ success: false, error: 'Não foi possível enviar a mensagem.', reason: result.reason });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS API v1.0 — Notificações Persistentes
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/notifications — Lista notificações
app.get('/api/notifications', requireAuth, (req, res) => {
  try {
    const notifs = readJSON(NOTIFICATIONS_FILE, { version: '1.0', notifications: [], lastId: 0 });
    const unreadCount = notifs.notifications.filter(n => !n.read).length;
    res.json({ success: true, notifications: notifs.notifications.slice(0, 50), unreadCount });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/notifications/:id/read — Marca como lida
app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
  try {
    const notifs = readJSON(NOTIFICATIONS_FILE, { version: '1.0', notifications: [], lastId: 0 });
    const notif = notifs.notifications.find(n => n.id === req.params.id);
    if (notif) {
      notif.read = true;
      writeJSON(NOTIFICATIONS_FILE, notifs);
    }
    const unreadCount = notifs.notifications.filter(n => !n.read).length;
    res.json({ success: true, unreadCount });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/notifications/:id — Remove notificação
app.delete('/api/notifications/:id', requireAuth, (req, res) => {
  try {
    const notifs = readJSON(NOTIFICATIONS_FILE, { version: '1.0', notifications: [], lastId: 0 });
    notifs.notifications = notifs.notifications.filter(n => n.id !== req.params.id);
    writeJSON(NOTIFICATIONS_FILE, notifs);
    const unreadCount = notifs.notifications.filter(n => !n.read).length;
    res.json({ success: true, unreadCount });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/notifications/read-all — Marca todas como lidas
app.post('/api/notifications/read-all', requireAuth, (req, res) => {
  try {
    const notifs = readJSON(NOTIFICATIONS_FILE, { version: '1.0', notifications: [], lastId: 0 });
    notifs.notifications.forEach(n => n.read = true);
    writeJSON(NOTIFICATIONS_FILE, notifs);
    res.json({ success: true, unreadCount: 0 });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/users — Lista usuários (sem senhas)
app.get('/api/users', requireAuth, (req, res) => {
  try {
    const data = readJSON(USERS_FILE, { users: {} });
    const sanitized = {};
    Object.entries(data.users || {}).forEach(([id, user]) => {
      sanitized[id] = {
        name: user.name,
        role: user.role,
        color: user.color,
        createdAt: user.createdAt
      };
    });
    res.json({ users: sanitized, currentUser: req.user.userId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// BugDetector Reports API
// ═══════════════════════════════════════════════════════════════════════════════

// REPORTS_DIR já definido na linha 757 (backend/data/reports)

// POST /api/bugdetector/reports — Recebe report do BugDetector
app.post('/api/bugdetector/reports', (req, res) => {
  try {
    const report = req.body;
    
    if (!report || !report.id) {
      return res.status(400).json({ error: 'Report inválido: id é obrigatório' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `bug-report-${report.id}-${timestamp}.json`;
    const filepath = path.join(REPORTS_DIR, filename);

    // Adiciona metadata de recebimento
    report._receivedAt = new Date().toISOString();
    report._source = 'bugdetector-pro';

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    
    console.log(`[BugDetector] Report recebido: ${filename}`);
    
    res.json({ 
      success: true, 
      filename,
      id: report.id,
      receivedAt: report._receivedAt
    });
  } catch (e) {
    console.error('[BugDetector] Erro ao salvar report:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/bugdetector/reports — Lista todos os reports recebidos
app.get('/api/bugdetector/reports', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(REPORTS_DIR, f));
        return {
          filename: f,
          size: stat.size,
          createdAt: stat.birthtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ reports: files, total: files.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/bugdetector/reports/:filename — Obtém um report específico
app.get('/api/bugdetector/reports/:filename', requireAuth, (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(REPORTS_DIR, filename);
    
    // Security: prevent directory traversal
    if (!filepath.startsWith(REPORTS_DIR)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Report não encontrado' });
    }

    const report = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/bugdetector/reports/:filename — Remove um report
app.delete('/api/bugdetector/reports/:filename', requireAuth, (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(REPORTS_DIR, filename);
    
    if (!filepath.startsWith(REPORTS_DIR)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Report não encontrado' });
    }

    fs.unlinkSync(filepath);
    res.json({ success: true, message: 'Report removido' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// NEXO WORKSPACE API v1.0
// ═══════════════════════════════════════════════════════════════════════════════

const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

app.get('/api/workspace/clients', requireAuth, (req, res) => {
  try {
    const index = workspaceManager.getIndex();
    const registry = readJSON(CLIENTS_REGISTRY_FILE) || { clients: {} };
    const merged = new Map();

    // 1. Clientes já existentes no workspace
    for (const c of index.clientes || []) {
      merged.set(c.id, { ...c, kind: 'client' });
    }

    // 2. Leads/clientes do registry que ainda não têm workspace
    for (const [id, data] of Object.entries(registry.clients || {})) {
      if (merged.has(id)) continue;
      const displayName = data.name || data.displayName || data.company || id;
      merged.set(id, {
        id,
        nome: displayName,
        caminho: id,
        status: data.status || 'ativo',
        cor: data.cor || data.color || '#8B5CF6',
        responsavel: data.assignedTo || 'todos',
        kind: 'lead',
        pipelineStatus: data.pipelineStatus || 'novo',
        email: data.email || data.contactInfo?.email || null,
        phone: data.phone || data.contactInfo?.phone || null,
        source: data.source || null,
        estimatedValue: data.estimatedValue || null,
        type: data.type || 'lead'
      });
    }

    const clientes = Array.from(merged.values()).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
    res.json({ success: true, clientes });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/workspace/clients', requireAuth, (req, res) => {
  try {
    const { id, nome, status, dataInicio, responsavel, orcamentoTotal, moeda, cor, tags, anotacoes } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'id obrigatorio' });
    const client = workspaceManager.createClient(id, {
      nome, status, dataInicio, responsavel, orcamentoTotal, moeda, cor, tags, anotacoes
    });
    res.json({ success: true, client });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/workspace/clients/:id', requireAuth, (req, res) => {
  try {
    const client = workspaceManager.getClient(req.params.id);
    if (!client) return res.status(404).json({ success: false, error: 'Cliente nao encontrado' });
    res.json({ success: true, client });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/workspace/clients/:id', requireAuth, (req, res) => {
  try {
    const client = workspaceManager.updateClient(req.params.id, req.body);
    res.json({ success: true, client });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.delete('/api/workspace/clients/:id', requireAuth, (req, res) => {
  try {
    const result = workspaceManager.deleteClient(req.params.id);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/workspace/clients/:id/files', requireAuth, (req, res) => {
  try {
    const files = workspaceManager.listFiles(req.params.id, req.query.path || '');
    res.json({ success: true, files });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/workspace/clients/:id/folders', requireAuth, (req, res) => {
  try {
    const { path: subPath, name } = req.body;
    const folder = workspaceManager.createFolder(req.params.id, subPath, name);
    res.json({ success: true, folder });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/workspace/clients/:id/upload', requireAuth, upload.single('file'), (req, res) => {
  try {
    const { path: subPath } = req.body;
    const sid = req.params.id;
    const rel = workspaceManager.sanitizeSubPath ? workspaceManager.sanitizeSubPath(subPath || '') : (subPath || '').replace(/\.\./g, '');
    const targetDir = path.join(workspaceManager.WORKSPACE_DIR, sid, rel);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const safeName = req.file.originalname.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    const targetFile = path.join(targetDir, safeName);
    fs.writeFileSync(targetFile, req.file.buffer);

    res.json({ success: true, file: { name: safeName, path: rel ? `${rel}/${safeName}` : safeName, size: req.file.size } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/workspace/clients/:id/download', requireAuth, (req, res) => {
  try {
    const sid = req.params.id;
    const rel = (req.query.path || '').replace(/\.\./g, '');
    const targetFile = path.join(workspaceManager.WORKSPACE_DIR, sid, rel);

    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ success: false, error: 'Arquivo nao encontrado' });
    }

    const stat = fs.statSync(targetFile);
    if (stat.isDirectory()) {
      return res.status(400).json({ success: false, error: 'Caminho e uma pasta' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(targetFile)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const stream = fs.createReadStream(targetFile);
    stream.pipe(res);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/workspace/clients/:id/files', requireAuth, (req, res) => {
  try {
    const result = workspaceManager.deleteFileOrFolder(req.params.id, req.query.path);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/workspace/clients/:id/rename', requireAuth, (req, res) => {
  try {
    const { path: subPath, newName } = req.body;
    const result = workspaceManager.renameFileOrFolder(req.params.id, subPath, newName);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/workspace/clients/:id/detect', requireAuth, (req, res) => {
  try {
    const type = workspaceManager.detectProjectType(req.params.id, req.query.path || '');
    res.json({ success: true, type });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── NEXO WORKSPACE: Local Dev Servers ──
const processManager = require('./process-manager');

app.post('/api/workspace/clients/:id/start', requireAuth, async (req, res) => {
  try {
    const { path: demoPath } = req.body;
    const result = await processManager.startServer(req.params.id, demoPath);
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/workspace/clients/:id/stop', requireAuth, (req, res) => {
  try {
    const { serverId } = req.body;
    const result = processManager.stopServer(serverId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/workspace/servers', requireAuth, (req, res) => {
  try {
    processManager.cleanupDeadServers();
    const servers = processManager.getRunningServers();
    res.json({ success: true, servers });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/workspace/servers/:serverId/logs', requireAuth, (req, res) => {
  try {
    const logs = processManager.getServerLogs(req.params.serverId, parseInt(req.query.lines) || 100);
    res.json({ success: true, logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// SSE: real-time logs stream
app.get('/api/workspace/servers/:serverId/logs/stream', requireAuth, (req, res) => {
  const { serverId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (line, isError) => {
    res.write(`data: ${JSON.stringify({ line, isError, time: new Date().toISOString() })}\n\n`);
  };

  processManager.subscribeToLogs(serverId, send);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);

  req.on('close', () => {
    processManager.unsubscribeFromLogs(serverId, send);
  });
});

// ============================================================================
// Catch-all
// ═══════════════════════════════════════════════════════════════════════════════

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start
async function startServer() {
  if (process.env.DATABASE_URL) {
    try {
      // Check if database is empty (first deploy)
      const db = require('./db');
      const userCount = await db.get('SELECT COUNT(*) as count FROM users');
      if (parseInt(userCount?.count || 0) === 0) {
        console.log('🆕 Database is empty. Migrating JSON data to PostgreSQL...');
        const { execSync } = require('child_process');
        execSync('node scripts/migrate-json-to-sql.js', { cwd: __dirname, stdio: 'inherit' });
        console.log('✅ Initial migration complete.');
      } else {
        console.log('🔄 Restoring data from PostgreSQL to JSON files...');
        await restoreAllFromPG();
      }
    } catch (err) {
      console.error('❌ Database setup failed:', err.message);
    }
  }
  server.listen(PORT, BIND_IP, () => {
    console.log(`🔥 NEXO DASHBOARD PRO rodando em http://${BIND_IP}:${PORT}`);
  });
}

startServer();

// ── Background Refresh: tools a cada 10 min ──
setInterval(() => {
  external.refreshExternal('tools').catch(() => {});
}, 10 * 60 * 1000);
