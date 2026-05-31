/**
 * Luna Web Server — Standalone server for Luna Web chat
 * Runs on port 3458 locally. NOT deployed to Render.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
const PORT = process.env.LUNA_PORT || 3458;
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

app.use(express.json());

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

// Static files
app.use(express.static(path.join(__dirname, '../../.luna-kernel/luna-web/dist')));

// Health — MUST be before SPA fallback
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'luna-web', timestamp: new Date().toISOString() });
});

// SPA fallback — MUST be after all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../.luna-kernel/luna-web/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🌙 Luna Web rodando em http://localhost:${PORT}`);
});
