import { runAgent } from './luna-cto-agent.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LunaReportEngine = require('./luna-report-engine.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_HISTORY_FILE = path.join(__dirname, '..', 'backend', 'data', 'report-history.json');
const LOG_FILE = path.join(__dirname, '..', 'backend', 'data', 'luna-scheduler.log');
const PID_FILE = path.join(__dirname, '..', 'artifacts', 'luna-scheduler.pid');

const SCAN_INTERVAL_MS = 10 * 60 * 1000;
const REPORT_INTERVAL_MS = 30 * 60 * 1000;
const reportEngine = new LunaReportEngine({ reportInterval: 30 });

function nowISO() { return new Date().toISOString(); }
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}
function log(msg) {
  const line = `[${new Date().toLocaleString('pt-BR')}] ${msg}`;
  console.log(line);
  ensureDir(path.dirname(LOG_FILE));
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function buildBufferFromAgentResult(result) {
  return {
    messages: result.messages || [],
    tasks: result.tasks || [],
    ideas: result.ideas || [],
    decisions: result.decisions || [],
    links: result.links || [],
    mentions: result.mentions || [],
    sentiment: result.sentiment || { positive: 0, negative: 0, urgent: 0 }
  };
}

function saveReport(reportObj) {
  const data = readJson(REPORT_HISTORY_FILE, { reports: [] });
  data.reports.push(reportObj);
  if (data.reports.length > 300) data.reports = data.reports.slice(-300);
  writeJson(REPORT_HISTORY_FILE, data);
}

const IS_HEADLESS = process.argv.includes('--headless');

async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/**
 * Wrapper com retry/backoff exponencial para evitar crash loop quando o profile
 * do Chrome/WhatsApp está temporariamente bloqueado.
 */
async function runWithRetry(label, fn, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const isLockError = e.message && (
        e.message.includes('browser is already running') ||
        e.message.includes('SingletonLock') ||
        e.message.includes('userDataDir')
      );
      log(`${label} ERRO (tentativa ${attempt}/${maxAttempts}): ${e.message}`);
      if (attempt === maxAttempts) break;
      const delay = isLockError ? 5000 * attempt : 2000 * attempt;
      log(`${label} Aguardando ${delay}ms antes de retry...`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function runScan(options = {}) {
  log('SCAN iniciado');
  const result = await runWithRetry('SCAN', () => runAgent({ once: true, schedule: false, headless: IS_HEADLESS, ...options }));
  log(`SCAN concluido: status=${result?.status || 'ok'}`);
  return result;
}

async function runReport(options = {}) {
  log('REPORT iniciado');
  const result = await runWithRetry('REPORT', () => runAgent({ once: true, schedule: false, fullExtract: false, headless: IS_HEADLESS, ...options }));
  const buffer = buildBufferFromAgentResult(result || {});
  const checkpoint = result?.checkpoint || {};
  const generated = reportEngine.generateReport(buffer, checkpoint, {});
  saveReport(generated.dashboard);
  log('REPORT concluido e salvo em report-history.json');
  return { ...result, report: generated };
}

async function runMentionsOnly() {
  log('CHECK MENTIONS iniciado');
  const result = await runWithRetry('MENTIONS', () => runAgent({ once: true, schedule: false, headless: IS_HEADLESS, mentionsOnly: true }));
  log('CHECK MENTIONS concluido');
  return result;
}

async function runLinksOnly() {
  log('CHECK LINKS iniciado');
  const result = await runWithRetry('LINKS', () => runAgent({ once: true, schedule: false, headless: IS_HEADLESS, linksOnly: true }));
  log('CHECK LINKS concluido');
  return result;
}

async function mainLoop() {
  ensureDir(path.dirname(PID_FILE));
  fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');
  ensureDir(path.dirname(REPORT_HISTORY_FILE));
  if (!fs.existsSync(REPORT_HISTORY_FILE)) writeJson(REPORT_HISTORY_FILE, { reports: [] });

  log('LUNA Scheduler iniciado (scan=10m, report=30m)');
  let lastReport = Date.now();
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;

  while (true) {
    try {
      const dueReport = (Date.now() - lastReport) >= REPORT_INTERVAL_MS;
      if (dueReport) {
        await runReport();
        lastReport = Date.now();
      } else {
        await runScan();
      }
      consecutiveFailures = 0;
    } catch (e) {
      consecutiveFailures++;
      log(`ERRO no ciclo principal: ${e.message} (falhas consecutivas: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        log('ERRO FATAL: número máximo de falhas consecutivas atingido. Encerrando para evitar loop infinito.');
        process.exit(1);
      }
      // Backoff progressivo antes do próximo ciclo
      await sleep(Math.min(30000, 5000 * consecutiveFailures));
    }
    await sleep(SCAN_INTERVAL_MS);
  }
}

const args = new Set(process.argv.slice(2));
(async () => {
  try {
    if (args.has('--force-scan')) {
      await runScan();
      return;
    }
    if (args.has('--force-report')) {
      await runReport();
      return;
    }
    if (args.has('--check-mentions')) {
      await runMentionsOnly();
      return;
    }
    if (args.has('--check-links')) {
      await runLinksOnly();
      return;
    }
    await mainLoop();
  } catch (e) {
    log(`ERRO FATAL: ${e.message}`);
    process.exit(1);
  }
})();
