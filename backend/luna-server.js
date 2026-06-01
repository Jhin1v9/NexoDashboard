/**
 * Luna Web Server — Standalone server for Luna Web chat
 * Runs on port 3458 locally. NOT deployed to Render.
 * 
 * v5.1 — Unificado: inclui todas as features do antigo config-server.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
const PORT = process.env.LUNA_PORT || 3458;
const LUNA_DIR = path.resolve(__dirname, '../../.luna-kernel');
const RUNTIME_PATH = path.join(LUNA_DIR, '.luna-runtime.json');

// ── Load Luna Kernel .env (same as old config-server.cjs) ──
const lunaEnvPath = path.join(LUNA_DIR, '.env');
if (fs.existsSync(lunaEnvPath)) {
  fs.readFileSync(lunaEnvPath, 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  });
}

// Write runtime config so frontend dev server can discover our port
fs.writeFileSync(RUNTIME_PATH, JSON.stringify({ apiPort: PORT, apiUrl: `http://localhost:${PORT}` }));
const JWT_SECRET = process.env.JWT_SECRET || 'nexo-test-secret-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// ── Auth helpers (copied from Dashboard server.js) ──
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Não autorizado' });
  }
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    // Load full user data from users.json
    const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const user = usersData.users?.[decoded.userId.toLowerCase()];
    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuário não encontrado' });
    }
    req.user = { id: decoded.userId, name: user.name || decoded.userId, role: user.role || 'User', color: user.color };
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Token inválido' });
  }
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function validateCredentials(username, password) {
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const user = data.users?.[username.toLowerCase()];
    if (!user) return null;
    const match = await bcrypt.compare(password, user.passwordHash || user.password);
    if (!match) return null;
    return { id: username.toLowerCase(), name: user.name || username, role: user.role || 'User', color: user.color };
  } catch (e) {
    console.error('Auth error:', e.message);
    return null;
  }
}

// ── Luna Chat Routes ──
const { router: lunaChatRouter, setupAuth: setupLunaAuth } = require('./luna-chat-routes');

// ── Dashboard Routes (shared with Luna Web tools) ──
const leadsRouter = require('./routes/leads');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS para desenvolvimento
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Auth setup
setupLunaAuth({ validateCredentials, generateToken, requireAuth });
app.use(lunaChatRouter);

// Dashboard tool routes (available to Luna Web)
app.use('/api/leads', leadsRouter);
const lunaToolsRouter = require('./routes/luna-tools');
app.use(lunaToolsRouter);

// Static files
const STATIC_DIR = path.join(__dirname, '../../.luna-kernel/luna-web/dist');
console.log('[Luna Server] Serving static from:', STATIC_DIR, 'exists:', fs.existsSync(STATIC_DIR));
console.log('[Luna Server] Assets exists:', fs.existsSync(path.join(STATIC_DIR, 'assets')));
console.log('[Luna Server] __dirname:', __dirname);
app.use(express.static(STATIC_DIR));

// Health — MUST be before SPA fallback
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'luna-web', timestamp: new Date().toISOString() });
});

// Legacy config panel fallback (from old config-server.cjs)
app.get('/config.html', (req, res) => {
  const configPath = path.join(LUNA_DIR, 'config.html');
  if (fs.existsSync(configPath)) {
    res.sendFile(configPath);
  } else {
    res.status(404).send('config.html not found');
  }
});

// SPA fallback — MUST be after all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../.luna-kernel/luna-web/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🌙 Luna Web rodando em http://localhost:${PORT}`);
  console.log(`   luna-dir: ${LUNA_DIR}`);
  console.log(`   runtime:  ${RUNTIME_PATH}`);
  console.log('');
  console.log('   Endpoints:');
  console.log('   - Chat:    POST /api/chat | GET /api/chat/stream (SSE)');
  console.log('   - Sessions: GET /api/chat/sessions | POST /api/chat/session');
  console.log('   - Config:  GET/POST /api/config');
  console.log('   - Tests:   GET /api/test/* | POST /api/system/*');
  console.log('   - Legacy:  GET /config.html');
  console.log('');
  console.log('   Frontend:');
  console.log('   - Serves luna-web/dist/ (SPA fallback)');
  console.log('');
});
