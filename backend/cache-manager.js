/**
 * Cache Manager Assíncrono para dados externos (GitHub, Vercel, CLI Tools)
 * Usa spawn com timeout + file-based persistence
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ALLOWED_SHELL_COMMANDS = new Set([
  'node', 'npm', 'npx', 'git', 'gh', 'vercel', 'supabase', 'python', 'python3', 'php'
]);

function isValidArg(arg) {
  return typeof arg === 'string' && arg.length > 0 && !/[;&|<>$`\n\r]/.test(arg);
}

class CacheManager {
  constructor(dataDir, defaultTTL = 600000) { // 10 minutos default
    this.dataDir = dataDir;
    this.defaultTTL = defaultTTL;
    this.memory = new Map();
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  }

  _file(key) { return path.join(this.dataDir, `${key}_cache.json`); }

  /**
   * Busca entrada no cache (memória → arquivo)
   */
  get(key) {
    // 1. Tenta memória
    const mem = this.memory.get(key);
    if (mem && Date.now() - mem.ts < mem.ttl) return { data: mem.data, fresh: true, source: 'memory' };
    // 2. Tenta arquivo
    try {
      const file = this._file(key);
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Date.now() - raw.ts < raw.ttl) {
          this.memory.set(key, raw);
          return { data: raw.data, fresh: true, source: 'file' };
        }
        return { data: raw.data, fresh: false, source: 'file', stale: true };
      }
    } catch (e) {
      console.warn(`[CacheManager] Falha ao ler cache de ${key}: ${e.message}`);
    }
    return null;
  }

  /**
   * Salva entrada no cache (memória + arquivo)
   */
  set(key, data, ttl = this.defaultTTL) {
    const entry = { data, ts: Date.now(), ttl };
    this.memory.set(key, entry);
    try {
      fs.writeFileSync(this._file(key), JSON.stringify(entry, null, 2));
    } catch (e) {
      console.warn(`[CacheManager] Falha ao salvar cache de ${key}: ${e.message}`);
    }
  }

  /**
   * Invalida uma chave do cache (memória + arquivo)
   */
  invalidate(key) {
    this.memory.delete(key);
    try {
      const file = this._file(key);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (e) {
      console.warn(`[CacheManager] Falha ao invalidar cache de ${key}: ${e.message}`);
    }
  }

  /**
   * Executa comando via spawn com timeout e retorna resultado.
   * Não utiliza shell=true; comandos e argumentos são validados contra whitelist.
   */
  async spawn(command, args = [], options = {}, timeout = 15000) {
    // Validação de comando
    const cmdName = path.basename(command);
    if (!ALLOWED_SHELL_COMMANDS.has(cmdName)) {
      console.warn(`[CacheManager] Comando não permitido: ${command}`);
      return { ok: false, error: `Comando não permitido: ${command}` };
    }
    if (!Array.isArray(args) || !args.every(isValidArg)) {
      console.warn(`[CacheManager] Argumentos inválidos para ${command}`);
      return { ok: false, error: 'Argumentos inválidos' };
    }

    console.warn(`[CacheManager] Executando shell: ${command} ${args.join(' ')}`);

    return new Promise((resolve) => {
      const proc = spawn(command, args, { ...options, shell: false });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill();
        resolve({ ok: false, error: 'timeout', output: stdout, stderr });
      }, timeout);

      proc.stdout.on('data', (d) => stdout += d.toString());
      proc.stderr.on('data', (d) => stderr += d.toString());

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({ ok: true, data: stdout.trim(), stderr: stderr.trim(), code });
        } else {
          resolve({ ok: false, error: 'exit_code', code, output: stdout, stderr });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({ ok: false, error: err.message });
      });
    });
  }
}

module.exports = CacheManager;

