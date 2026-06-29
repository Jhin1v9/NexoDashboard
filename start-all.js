#!/usr/bin/env node
/**
 * NEXO Digital Pro + Luna Web — Unified Launcher v1.0
 * Inicia AMBOS os backends com um único comando:
 *   node start-all.js
 * 
 * Portas:
 *   - Nexo Dashboard API: 3456
 *   - Luna Config Server:  3458
 *   - Luna Web (Vite):     5173  (iniciado automaticamente se disponível)
 */

const { spawn } = require('child_process');
const path = require('path');

const COLORS = {
  nexo: '\x1b[36m',      // Cyan
  luna: '\x1b[35m',      // Magenta
  vite: '\x1b[33m',      // Yellow
  info: '\x1b[32m',      // Green
  error: '\x1b[31m',     // Red
  warn: '\x1b[33m',      // Yellow
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
};

function timestamp() {
  const now = new Date();
  return `${COLORS.dim}${now.toLocaleTimeString('pt-BR')}${COLORS.reset}`;
}

function log(service, color, msg) {
  const prefix = `${COLORS.bold}[${color}${service.toUpperCase()}${COLORS.reset}${COLORS.bold}]${COLORS.reset}`;
  console.log(`${timestamp()} ${prefix} ${msg}`);
}

const processes = [];

function startService(name, color, cmd, args, cwd, env = {}) {
  log('launcher', COLORS.info, `Iniciando ${name}...`);
  
  const proc = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'pipe'
  });

  proc.stdout.on('data', (data) => {
    data.toString().trim().split('\n').forEach(line => {
      if (line.trim()) log(name, color, line.trim());
    });
  });

  proc.stderr.on('data', (data) => {
    data.toString().trim().split('\n').forEach(line => {
      if (line.trim()) log(name, COLORS.error, line.trim());
    });
  });

  proc.on('error', (err) => {
    log(name, COLORS.error, `ERRO: ${err.message}`);
  });

  proc.on('exit', (code, signal) => {
    log(name, COLORS.warn, `Encerrado (code=${code}, signal=${signal})`);
  });

  processes.push({ name, proc, color });
  return proc;
}

// ── HEADER ──
console.log(`
${COLORS.bold}${COLORS.info}
╔══════════════════════════════════════════════════════════════╗
║     NEXO DIGITAL PRO + LUNA WEB — Unified Launcher v1.0      ║
╠══════════════════════════════════════════════════════════════╣
║  Dashboard API:  http://localhost:3456                        ║
║  Luna Chat API:  http://localhost:3458                        ║
║  Luna Web UI:    http://localhost:5173                        ║
╚══════════════════════════════════════════════════════════════╝
${COLORS.reset}`);

// ── START SERVICES ──

// 1. Nexo Dashboard Backend (porta 3456)
const nexoBackend = path.resolve(__dirname, 'backend');
startService('nexo', COLORS.nexo, 'node', ['server.js'], nexoBackend, {
  PORT: '3456',
  BIND_IP: '127.0.0.1'
});

// 2. Luna Web Server (porta 3458)
const lunaBackend = path.resolve(__dirname, 'backend');
startService('luna', COLORS.luna, 'node', ['luna-server.js'], lunaBackend);

// 3. Luna Web Vite (porta 5173) — opcional, só se node_modules existir
const lunaWeb = path.resolve(__dirname, 'agents', 'luna-web');
const viteBin = path.join(lunaWeb, 'node_modules', '.bin', 'vite');
if (require('fs').existsSync(viteBin)) {
  startService('vite', COLORS.vite, viteBin, ['--host'], lunaWeb);
} else {
  log('launcher', COLORS.warn, 'Vite não encontrado em luna-web/node_modules — UI não será iniciada');
}

// ── GRACEFUL SHUTDOWN ──
function shutdown(signal) {
  log('launcher', COLORS.warn, `Recebido ${signal}. Encerrando todos os serviços...`);
  processes.forEach(({ name, proc }) => {
    log('launcher', COLORS.dim, `Enviando SIGTERM para ${name} (PID: ${proc.pid})`);
    proc.kill('SIGTERM');
  });
  
  // Force kill após 5s se ainda estiverem rodando
  setTimeout(() => {
    processes.forEach(({ name, proc }) => {
      if (!proc.killed) {
        log('launcher', COLORS.error, `Force kill ${name} (PID: ${proc.pid})`);
        proc.kill('SIGKILL');
      }
    });
    process.exit(0);
  }, 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

log('launcher', COLORS.info, 'Todos os serviços iniciados! Pressione Ctrl+C para encerrar.');
