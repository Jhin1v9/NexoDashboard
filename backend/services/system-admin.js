/**
 * System Admin Service
 * Capacidades administrativas do PC para Luna
 * v1.0 - 2026-05-23
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Whitelist de comandos shell permitidos (com prefixo exato)
const ALLOWED_SHELL_COMMANDS = [
  'ps ', 'pgrep ', 'pkill ', 'kill ', 'top ', 'htop ', 'df ', 'du ', 'free ', 'uptime ', 'who ', 'w ', 'last ', 'uname ', 'ls ', 'll ', 'cat ', 'head ', 'tail ', 'grep ', 'find ', 'wc ', 'which ', 'whereis ', 'ping ', 'curl ', 'wget ', 'netstat ', 'ss ', 'ip ', 'ifconfig ', 'nmcli ', 'systemctl ', 'service ', 'journalctl ', 'pm2 ', 'crontab ', 'env ', 'printenv ', 'lsusb ', 'lspci ', 'lsblk ', 'fdisk ', 'blkid ', 'mount ', 'df ', 'npm ', 'node ', 'git status', 'git log', 'git diff', 'git branch', 'git remote', 'npx ', 'python3 ', 'python ', 'pip ', 'pip3 ', 'tar ', 'zip ', 'unzip ', 'gzip ', 'gunzip ', 'cp ', 'mv ', 'rm ', 'mkdir ', 'rmdir ', 'touch ', 'chmod ', 'chown ', 'nano ', 'vim ', 'code ', 'xdg-open ', 'open ', 'ls -', 'll -', 'cat ', 'tail -', 'head -', 'ps -', 'pgrep -', 'df -', 'du -', 'free -', 'uptime', 'who', 'w', 'uname', 'env', 'printenv', 'lsusb', 'lspci', 'lsblk', 'mount', 'npm -', 'node -', 'npx -', 'git --', 'pm2 -', 'systemctl --', 'journalctl -', 'crontab -', 'ping -', 'curl -', 'wget -', 'netstat -', 'ss -', 'ip -', 'tar -', 'zip -', 'unzip -', 'python3 -', 'pip3 -', 'mkdir -', 'rmdir -', 'touch -', 'chmod -', 'chown -'
];

// Comandos BLOQUEADOS (nunca permitir, mesmo que contenham prefixos acima)
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//, /rm\s+.*\*\s*\//, />\s*\/dev\/null.*\bsda/,
  /mkfs\.*/, /dd\s+if=.*of=\/dev\/sda/, /:\(\)\{ :\|:& };:/
];

// Serviços systemd que podem ser gerenciados (whitelist)
const ALLOWED_SYSTEMD_SERVICES = [
  'nexo-dashboard', 'nexo', 'luna', 'nginx', 'apache2', 'httpd',
  'mysql', 'mysqld', 'mariadb', 'postgresql', 'postgres', 'redis',
  'mongodb', 'mongod', 'ssh', 'sshd', 'cron', 'crond', 'docker',
  'containerd', 'snapd', 'NetworkManager', 'network-manager',
  'bluetooth', 'cups', 'cups-browsed', 'avahi-daemon'
];

// Diretórios permitidos para navegação de arquivos
const ALLOWED_FS_ROOTS = [
  os.homedir(),
  '/tmp',
  '/var/log',
  '/opt',
  '/usr/local',
  '/etc/nginx',
  '/etc/apache2',
  '/etc/ssh',
  process.cwd()
];

class SystemAdmin {
  constructor() {
    this.lastMetrics = null;
    this.metricsTimestamp = 0;
  }

  // ─── VALIDAÇÃO DE SEGURANÇA ───

  isCommandAllowed(cmd) {
    const trimmed = cmd.trim();
    if (!trimmed) return false;
    // Verifica padrões bloqueados
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) return false;
    }
    // Verifica whitelist
    for (const prefix of ALLOWED_SHELL_COMMANDS) {
      if (trimmed.startsWith(prefix)) return true;
    }
    // Comandos exatos permitidos
    const exactAllowed = ['uptime', 'who', 'w', 'uname', 'env', 'printenv', 'lsusb', 'lspci', 'lsblk', 'mount', 'df', 'free'];
    if (exactAllowed.includes(trimmed)) return true;
    return false;
  }

  isPathAllowed(targetPath) {
    const resolved = path.resolve(targetPath);
    // Sempre permite o diretório de trabalho atual e subdiretórios do projeto
    const cwd = process.cwd();
    if (resolved.startsWith(cwd)) return true;
    // Verifica roots permitidos
    for (const root of ALLOWED_FS_ROOTS) {
      if (resolved.startsWith(path.resolve(root))) return true;
    }
    return false;
  }

  isSystemdServiceAllowed(serviceName) {
    const base = serviceName.replace(/\.service$/, '');
    return ALLOWED_SYSTEMD_SERVICES.includes(base);
  }

  // ─── MÉTRICAS DO SISTEMA ───

  async getMetrics() {
    const now = Date.now();
    // Cache por 3 segundos
    if (this.lastMetrics && (now - this.metricsTimestamp) < 3000) {
      return this.lastMetrics;
    }

    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();

    // Uptime formatado
    const uptimeSec = os.uptime();
    const uptimeH = Math.floor(uptimeSec / 3600);
    const uptimeM = Math.floor((uptimeSec % 3600) / 60);
    const uptimeS = Math.floor(uptimeSec % 60);

    // Info de disco
    let diskInfo = [];
    try {
      const { stdout } = await execAsync("df -h -x tmpfs -x devtmpfs --output=source,size,used,avail,pcent,target");
      diskInfo = stdout.split('\n').slice(1).filter(Boolean).map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          filesystem: parts[0],
          size: parts[1],
          used: parts[2],
          available: parts[3],
          usePercent: parts[4],
          mount: parts.slice(5).join(' ')
        };
      });
    } catch (e) {
      diskInfo = [{ error: e.message }];
    }

    // Temperatura (se disponível)
    let temperature = null;
    try {
      const tempPaths = [
        '/sys/class/thermal/thermal_zone0/temp',
        '/sys/class/hwmon/hwmon0/temp1_input'
      ];
      for (const p of tempPaths) {
        if (fs.existsSync(p)) {
          const raw = parseInt(fs.readFileSync(p, 'utf8'));
          temperature = raw > 1000 ? raw / 1000 : raw;
          break;
        }
      }
    } catch (e) { /* ignore */ }

    // Rede
    const networkInterfaces = os.networkInterfaces();
    const network = {};
    for (const [iface, addrs] of Object.entries(networkInterfaces)) {
      network[iface] = addrs.map(a => ({
        family: a.family,
        address: a.address,
        internal: a.internal
      }));
    }

    const metrics = {
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: {
        seconds: uptimeSec,
        formatted: `${uptimeH}h ${uptimeM}m ${uptimeS}s`
      },
      cpu: {
        count: cpus.length,
        model: cpus[0]?.model || 'unknown',
        speed: cpus[0]?.speed || 0,
        loadAvg1m: loadAvg[0],
        loadAvg5m: loadAvg[1],
        loadAvg15m: loadAvg[2],
        usagePercent: Math.round((loadAvg[0] / cpus.length) * 100)
      },
      memory: {
        total: totalMem,
        totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(2),
        free: freeMem,
        freeGB: (freeMem / 1024 / 1024 / 1024).toFixed(2),
        used: usedMem,
        usedGB: (usedMem / 1024 / 1024 / 1024).toFixed(2),
        usedPercent: Math.round((usedMem / totalMem) * 100)
      },
      disk: diskInfo,
      temperature,
      network
    };

    this.lastMetrics = metrics;
    this.metricsTimestamp = now;
    return metrics;
  }

  // ─── PROCESSOS ───

  async listProcesses(options = {}) {
    const { sortBy = 'cpu', limit = 20 } = options;
    try {
      // Usa ps com formato personalizado
      const cmd = `ps -eo pid,ppid,user,pcpu,pmem,etime,comm,args --sort=-${sortBy} | head -n ${limit + 1}`;
      const { stdout } = await execAsync(cmd, { timeout: 10000 });
      const lines = stdout.split('\n').filter(Boolean);
      const headers = lines[0].trim().split(/\s+/);
      const processes = lines.slice(1).map(line => {
        // Parse cuidadoso porque args pode ter espaços
        const match = line.trim().match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
        if (!match) return null;
        return {
          pid: parseInt(match[1]),
          ppid: parseInt(match[2]),
          user: match[3],
          cpu: parseFloat(match[4]),
          mem: parseFloat(match[5]),
          elapsed: match[6],
          command: match[7],
          args: match[8].trim()
        };
      }).filter(Boolean);
      return { processes, count: processes.length };
    } catch (e) {
      return { error: e.message, processes: [] };
    }
  }

  async killProcess(pid, signal = 'SIGTERM') {
    const numericPid = parseInt(pid);
    if (isNaN(numericPid) || numericPid <= 0) {
      return { success: false, error: 'PID inválido' };
    }
    // Proteção: não matar processos de sistema críticos (PID < 100 ou nosso próprio processo)
    if (numericPid < 100) {
      return { success: false, error: 'Não é permitido matar processos de sistema (PID < 100)' };
    }
    if (numericPid === process.pid) {
      return { success: false, error: 'Não posso me matar 🙃' };
    }
    try {
      process.kill(numericPid, signal);
      return { success: true, pid: numericPid, signal };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ─── SERVIÇOS PM2 ───

  async pm2List() {
    try {
      const { stdout } = await execAsync('pm2 jlist', { timeout: 10000 });
      const list = JSON.parse(stdout);
      return {
        success: true,
        processes: list.map(p => ({
          name: p.name,
          pid: p.pid,
          pmId: p.pm_id,
          status: p.pm2_env.status,
          uptime: p.pm2_env.pm_uptime,
          restartCount: p.pm2_env.restart_time,
          cpu: p.monit?.cpu,
          memory: p.monit?.memory,
          instances: p.pm2_env.instances,
          execMode: p.pm2_env.exec_mode
        }))
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async pm2Action(action, nameOrId) {
    const allowedActions = ['start', 'stop', 'restart', 'reload', 'delete', 'flush', 'logs'];
    if (!allowedActions.includes(action)) {
      return { success: false, error: `Ação PM2 não permitida: ${action}` };
    }
    try {
      const cmd = `pm2 ${action} ${nameOrId}`;
      const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
      return { success: true, action, target: nameOrId, output: stdout || stderr };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ─── SERVIÇOS SYSTEMD ───

  async systemdStatus(serviceName) {
    if (!this.isSystemdServiceAllowed(serviceName)) {
      return { success: false, error: `Serviço não permitido: ${serviceName}` };
    }
    try {
      const { stdout } = await execAsync(`systemctl status ${serviceName} --no-pager -l`, { timeout: 10000 });
      const lines = stdout.split('\n');
      const activeLine = lines.find(l => l.includes('Active:'));
      const loadedLine = lines.find(l => l.includes('Loaded:'));
      const mainPidLine = lines.find(l => l.includes('Main PID:'));
      return {
        success: true,
        service: serviceName,
        active: activeLine?.includes('active (running)') || false,
        statusText: activeLine?.trim() || 'unknown',
        loaded: loadedLine?.trim() || 'unknown',
        mainPid: mainPidLine?.match(/Main PID:\s*(\d+)/)?.[1] || null
      };
    } catch (e) {
      // systemctl status retorna código != 0 quando serviço está inativo
      const stdout = e.stdout || '';
      const lines = stdout.split('\n');
      const activeLine = lines.find(l => l.includes('Active:'));
      return {
        success: true,
        service: serviceName,
        active: false,
        statusText: activeLine?.trim() || e.message,
        loaded: lines.find(l => l.includes('Loaded:'))?.trim() || 'unknown',
        mainPid: null
      };
    }
  }

  async systemdAction(action, serviceName) {
    const allowedActions = ['start', 'stop', 'restart', 'reload', 'enable', 'disable', 'status'];
    if (!allowedActions.includes(action)) {
      return { success: false, error: `Ação systemd não permitida: ${action}` };
    }
    if (!this.isSystemdServiceAllowed(serviceName)) {
      return { success: false, error: `Serviço não permitido: ${serviceName}` };
    }
    try {
      const cmd = `sudo -n systemctl ${action} ${serviceName}`;
      const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
      return { success: true, action, service: serviceName, output: stdout || stderr };
    } catch (e) {
      return { success: false, error: e.message, stderr: e.stderr };
    }
  }

  // ─── SHELL SEGURO ───

  async executeShell(command, options = {}) {
    const { timeout = 30000, cwd } = options;
    if (!this.isCommandAllowed(command)) {
      return {
        success: false,
        error: 'Comando não permitido. Use apenas comandos de monitoramento e administração do sistema.',
        command
      };
    }
    try {
      const execOptions = { timeout, encoding: 'utf8' };
      if (cwd && this.isPathAllowed(cwd)) execOptions.cwd = cwd;
      const { stdout, stderr } = await execAsync(command, execOptions);
      return {
        success: true,
        command,
        stdout: stdout?.slice(0, 50000) || '',
        stderr: stderr?.slice(0, 10000) || '',
        exitCode: 0
      };
    } catch (e) {
      return {
        success: false,
        command,
        error: e.message,
        stdout: e.stdout?.slice(0, 50000) || '',
        stderr: e.stderr?.slice(0, 10000) || '',
        exitCode: e.code || 1
      };
    }
  }

  // ─── FILE SYSTEM ───

  async listDirectory(dirPath) {
    const target = dirPath || os.homedir();
    if (!this.isPathAllowed(target)) {
      return { success: false, error: `Acesso negado ao diretório: ${target}` };
    }
    try {
      const entries = fs.readdirSync(target, { withFileTypes: true });
      const items = entries.map(e => {
        const fullPath = path.join(target, e.name);
        let stats = null;
        try { stats = fs.statSync(fullPath); } catch (err) { /* ignore permission errors */ }
        return {
          name: e.name,
          type: e.isDirectory() ? 'directory' : e.isSymbolicLink() ? 'link' : 'file',
          size: stats?.size || 0,
          modified: stats?.mtime?.toISOString() || null,
          mode: stats?.mode?.toString(8).slice(-3) || null
        };
      });
      return { success: true, path: target, items };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async readFile(filePath, options = {}) {
    const { lines = 100, offset = 0 } = options;
    if (!this.isPathAllowed(filePath)) {
      return { success: false, error: `Acesso negado ao arquivo: ${filePath}` };
    }
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 5 * 1024 * 1024) {
        return { success: false, error: 'Arquivo muito grande (>5MB). Use tail/head.' };
      }
      const content = fs.readFileSync(filePath, 'utf8');
      const allLines = content.split('\n');
      const selected = allLines.slice(offset, offset + lines);
      return {
        success: true,
        path: filePath,
        size: stats.size,
        totalLines: allLines.length,
        lines: selected.length,
        offset,
        content: selected.join('\n')
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async tailFile(filePath, lines = 50) {
    if (!this.isPathAllowed(filePath)) {
      return { success: false, error: `Acesso negado ao arquivo: ${filePath}` };
    }
    try {
      const { stdout } = await execAsync(`tail -n ${lines} "${filePath}"`, { timeout: 10000 });
      return { success: true, path: filePath, lines, content: stdout };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async findFiles(dirPath, pattern, maxDepth = 3) {
    if (!this.isPathAllowed(dirPath)) {
      return { success: false, error: `Acesso negado ao diretório: ${dirPath}` };
    }
    try {
      const cmd = `find "${dirPath}" -maxdepth ${maxDepth} -name "${pattern}" -type f 2>/dev/null | head -n 100`;
      const { stdout } = await execAsync(cmd, { timeout: 15000 });
      const files = stdout.split('\n').filter(Boolean);
      return { success: true, dir: dirPath, pattern, files, count: files.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ─── CRON / AGENDAMENTO ───

  async listCronJobs() {
    try {
      const { stdout } = await execAsync('crontab -l 2>/dev/null || echo "# no crontab"', { timeout: 5000 });
      const lines = stdout.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      const jobs = lines.map((line, idx) => {
        const parts = line.trim().split(/\s+/);
        return {
          id: idx,
          schedule: parts.slice(0, 5).join(' '),
          command: parts.slice(5).join(' '),
          raw: line
        };
      });
      return { success: true, jobs, count: jobs.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async addCronJob(schedule, command) {
    // Validação básica do schedule (5 campos)
    const scheduleParts = schedule.trim().split(/\s+/);
    if (scheduleParts.length !== 5) {
      return { success: false, error: 'Schedule inválido. Use formato cron: "* * * * *"' };
    }
    // Verifica se o comando é permitido
    if (!this.isCommandAllowed(command)) {
      return { success: false, error: 'Comando não permitido para cron.' };
    }
    try {
      const { stdout: current } = await execAsync('crontab -l 2>/dev/null || true', { timeout: 5000 });
      const newCrontab = current.trim() + `\n# Adicionado por Luna em ${new Date().toISOString()}\n${schedule} ${command}\n`;
      // Usa echo + crontab - para evitar arquivo temporário
      await execAsync(`echo '${newCrontab.replace(/'/g, "'\"'\"'")}' | crontab -`, { timeout: 5000 });
      return { success: true, schedule, command };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async removeCronJob(jobId) {
    try {
      const { stdout: current } = await execAsync('crontab -l 2>/dev/null || true', { timeout: 5000 });
      const lines = current.split('\n');
      let jobIdx = 0;
      const newLines = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() && !line.startsWith('#')) {
          if (jobIdx === jobId) {
            jobIdx++;
            continue; // pula o job a remover
          }
          jobIdx++;
        }
        newLines.push(line);
      }
      const newCrontab = newLines.join('\n') + '\n';
      await execAsync(`echo '${newCrontab.replace(/'/g, "'\"'\"'")}' | crontab -`, { timeout: 5000 });
      return { success: true, removedId: jobId };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ─── LOGS DO SISTEMA ───

  async getSystemLogs(service, lines = 50) {
    try {
      let cmd;
      if (service) {
        if (!this.isSystemdServiceAllowed(service)) {
          return { success: false, error: `Serviço não permitido: ${service}` };
        }
        cmd = `journalctl -u ${service} -n ${lines} --no-pager`;
      } else {
        cmd = `journalctl -n ${lines} --no-pager`;
      }
      const { stdout } = await execAsync(cmd, { timeout: 15000 });
      return { success: true, service: service || 'all', lines, content: stdout };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ─── RESUMO RÁPIDO ───

  async getHealthSummary() {
    const metrics = await this.getMetrics();
    const pm2 = await this.pm2List();
    const processes = await this.listProcesses({ limit: 5 });

    const issues = [];
    if (metrics.memory.usedPercent > 85) issues.push(`⚠️ Memória alta: ${metrics.memory.usedPercent}%`);
    if (metrics.cpu.loadAvg1m > metrics.cpu.count * 1.5) issues.push(`⚠️ Carga CPU alta: ${metrics.cpu.loadAvg1m.toFixed(2)}`);
    if (pm2.processes?.some(p => p.status !== 'online')) {
      issues.push(`⚠️ PM2: ${pm2.processes.filter(p => p.status !== 'online').map(p => p.name).join(', ')} offline`);
    }

    return {
      success: true,
      summary: {
        uptime: metrics.uptime.formatted,
        memory: `${metrics.memory.usedGB}/${metrics.memory.totalGB} GB (${metrics.memory.usedPercent}%)`,
        cpuLoad: `${metrics.cpu.loadAvg1m.toFixed(2)} (${metrics.cpu.usagePercent}%)`,
        pm2Running: pm2.processes?.length || 0,
        topProcesses: processes.processes?.slice(0, 5).map(p => `${p.command}(${p.pid}): ${p.cpu}% CPU, ${p.mem}% MEM`) || [],
        issues: issues.length ? issues : ['✅ Tudo ok']
      },
      metrics
    };
  }
}

module.exports = new SystemAdmin();
