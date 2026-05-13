#!/usr/bin/env node
/**
 * Monitor de Reports do BugDetector Pro
 * 
 * Uso:
 *   node monitor-reports.js              # Monitora em tempo real
 *   node monitor-reports.js --list       # Lista todos os reports
 *   node monitor-reports.js --watch      # Modo watch (padrão)
 *   node monitor-reports.js --latest     # Mostra o report mais recente
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, 'backend', 'data', 'reports');

// Cores para terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function ensureDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    log('📁 Pasta reports criada', 'green');
  }
}

function getReports() {
  ensureDir();
  return fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.json') || f.endsWith('.md'))
    .map(f => {
      const stat = fs.statSync(path.join(REPORTS_DIR, f));
      return {
        filename: f,
        size: (stat.size / 1024).toFixed(1) + ' KB',
        createdAt: stat.birthtime,
        isNew: (Date.now() - stat.birthtime.getTime()) < 60000 // < 1 min
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function formatReport(report) {
  const lines = [];
  lines.push(`${'='.repeat(70)}`);
  lines.push(`🐛 BUG REPORT`);
  lines.push(`${'='.repeat(70)}`);
  
  if (report.id) lines.push(`ID:        ${report.id}`);
  if (report.timestamp) lines.push(`Data:      ${new Date(report.timestamp).toLocaleString('pt-BR')}`);
  if (report.type) lines.push(`Tipo:      ${report.type}`);
  if (report.severity) lines.push(`Severidade: ${report.severity}`);
  if (report.status) lines.push(`Status:    ${report.status}`);
  if (report.url) lines.push(`URL:       ${report.url}`);
  if (report.pageTitle) lines.push(`Página:    ${report.pageTitle}`);
  
  lines.push(`${'-'.repeat(70)}`);
  
  if (report.description) {
    lines.push(`📝 Descrição:`);
    lines.push(report.description);
    lines.push('');
  }
  
  if (report.markdownReport) {
    lines.push(`🧠 Análise IA (Markdown):`);
    lines.push(report.markdownReport.substring(0, 500) + '...');
    lines.push('');
  }
  
  if (report.element) {
    lines.push(`🎯 Elemento: ${report.element.tag || 'N/A'}`);
    if (report.element.selector) lines.push(`   Seletor: ${report.element.selector}`);
  }
  
  if (report.aiAnalysis) {
    lines.push(`🧠 IA Análise:`);
    lines.push(`   Categoria: ${report.aiAnalysis.category || 'N/A'}`);
    lines.push(`   Severidade: ${report.aiAnalysis.severity || 'N/A'}`);
    lines.push(`   Confiança: ${report.aiAnalysis.confidence || 'N/A'}%`);
    if (report.aiAnalysis.rootCause) {
      lines.push(`   Causa Raiz: ${report.aiAnalysis.rootCause}`);
    }
  }
  
  if (report.consoleLogs && report.consoleLogs.length > 0) {
    lines.push(`📋 Console Logs: ${report.consoleLogs.length} entradas`);
  }
  
  if (report.networkRequests && report.networkRequests.length > 0) {
    lines.push(`🌐 Requisições: ${report.networkRequests.length}`);
  }
  
  lines.push(`${'='.repeat(70)}`);
  return lines.join('\n');
}

function listReports() {
  const reports = getReports();
  
  if (reports.length === 0) {
    log('📭 Nenhum report encontrado', 'yellow');
    return;
  }
  
  log(`📊 Total de reports: ${reports.length}\n`, 'bright');
  
  reports.forEach((r, i) => {
    const newBadge = r.isNew ? `${colors.green}[NOVO]${colors.reset} ` : '';
    const color = r.filename.endsWith('.md') ? 'cyan' : 'blue';
    log(`${i + 1}. ${newBadge}${colors[color]}${r.filename}${colors.reset}`, 'reset');
    log(`   Tamanho: ${r.size} | Criado: ${r.createdAt.toLocaleString('pt-BR')}`);
    log('');
  });
}

function showLatest() {
  const reports = getReports();
  if (reports.length === 0) {
    log('📭 Nenhum report encontrado', 'yellow');
    return;
  }
  
  const latest = reports[0];
  const filepath = path.join(REPORTS_DIR, latest.filename);
  
  log(`📄 Último report: ${latest.filename}\n`, 'bright');
  
  if (latest.filename.endsWith('.json')) {
    const report = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    console.log(formatReport(report));
  } else {
    console.log(fs.readFileSync(filepath, 'utf8'));
  }
}

function watchMode() {
  log('👁️  Modo monitoramento ativado', 'green');
  log(`📁 Observando: ${REPORTS_DIR}\n`);
  log('Aguardando novos reports... (Ctrl+C para sair)\n', 'yellow');
  
  let knownFiles = new Set(fs.readdirSync(REPORTS_DIR));
  
  const interval = setInterval(() => {
    try {
      const currentFiles = fs.readdirSync(REPORTS_DIR);
      const newFiles = currentFiles.filter(f => !knownFiles.has(f));
      
      if (newFiles.length > 0) {
        newFiles.forEach(filename => {
          log(`\n🔔 NOVO REPORT DETECTADO!`, 'green');
          log(`   Arquivo: ${filename}`, 'bright');
          
          const filepath = path.join(REPORTS_DIR, filename);
          
          if (filename.endsWith('.json')) {
            try {
              const report = JSON.parse(fs.readFileSync(filepath, 'utf8'));
              console.log('\n' + formatReport(report));
            } catch (e) {
              log(`   Erro ao ler JSON: ${e.message}`, 'red');
            }
          } else if (filename.endsWith('.md')) {
            const content = fs.readFileSync(filepath, 'utf8');
            log(`   Preview:\n${content.substring(0, 300)}...`, 'cyan');
          }
          
          log(`\n${'─'.repeat(70)}\n`, 'yellow');
        });
        
        knownFiles = new Set(currentFiles);
      }
    } catch (e) {
      // Pasta pode não existir ainda
    }
  }, 2000);
  
  process.on('SIGINT', () => {
    clearInterval(interval);
    log('\n👋 Monitor encerrado', 'yellow');
    process.exit(0);
  });
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--list') || args.includes('-l')) {
  listReports();
} else if (args.includes('--latest')) {
  showLatest();
} else if (args.includes('--watch') || args.includes('-w') || args.length === 0) {
  watchMode();
} else if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colors.bright}BugDetector Reports Monitor${colors.reset}

Uso: node monitor-reports.js [opção]

Opções:
  --watch, -w     Modo monitoramento em tempo real (padrão)
  --list, -l      Lista todos os reports
  --latest        Mostra o report mais recente
  --help, -h      Mostra esta ajuda

Exemplos:
  node monitor-reports.js --watch    # Monitora novos reports
  node monitor-reports.js --list     # Lista todos os reports
  node monitor-reports.js --latest   # Mostra o último report
`);
} else {
  watchMode();
}
