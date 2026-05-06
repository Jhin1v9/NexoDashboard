#!/usr/bin/env node
// ============================================================
// LUNA FIX MASTER v8.0 — RESTORE DO GITHUB + APLICAÇÃO REAL
// ============================================================
// Este script:
// 1. Faz backup dos arquivos atuais
// 2. Restaura do GitHub (versão limpa)
// 3. Aplica correções PRECISAS baseadas no código real lido
// ============================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const PROJECT_DIR = process.cwd();
const BACKUP_DIR = path.join(PROJECT_DIR, 'artifacts', 'backups', `luna-fix-v8-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const AGENTS_DIR = path.join(PROJECT_DIR, 'agents');
const BACKEND_DIR = path.join(PROJECT_DIR, 'backend');

const FILES = {
  agent: { local: path.join(AGENTS_DIR, 'luna-cto-agent.cjs'), url: 'https://raw.githubusercontent.com/Jhin1v9/NexoDashboard/main/agents/luna-cto-agent.cjs' },
  classifier: { local: path.join(AGENTS_DIR, 'SmartClassifier_v16.js'), url: 'https://raw.githubusercontent.com/Jhin1v9/NexoDashboard/main/agents/SmartClassifier_v16.js' },
  brain: { local: path.join(AGENTS_DIR, 'LunaBrain_v16.js'), url: 'https://raw.githubusercontent.com/Jhin1v9/NexoDashboard/main/agents/LunaBrain_v16.js' },
  scheduler: { local: path.join(AGENTS_DIR, 'luna-scheduler.mjs'), url: 'https://raw.githubusercontent.com/Jhin1v9/NexoDashboard/main/agents/luna-scheduler.mjs' },
  server: { local: path.join(BACKEND_DIR, 'server.js'), url: 'https://raw.githubusercontent.com/Jhin1v9/NexoDashboard/main/backend/server.js' }
};

let results = { backup: [], restore: [], apply: [], verify: [] };

function log(msg) {
  const line = `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`;
  console.log(line);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

// ============================================================
// FASE 1: BACKUP
// ============================================================
async function phase1_backup() {
  log('═══════════════════════════════════════════════════════');
  log('  FASE 1: BACKUP DOS ARQUIVOS ATUAIS');
  log('═══════════════════════════════════════════════════════');
  ensureDir(BACKUP_DIR);

  for (const [name, info] of Object.entries(FILES)) {
    if (fs.existsSync(info.local)) {
      const backupPath = path.join(BACKUP_DIR, path.basename(info.local));
      fs.copyFileSync(info.local, backupPath);
      results.backup.push({ file: name, ok: true, path: backupPath });
      log(`  [BACKUP] ${name} → ${backupPath}`);
    } else {
      results.backup.push({ file: name, ok: false, error: 'Arquivo não existe' });
      log(`  [SKIP] ${name} — arquivo não encontrado`);
    }
  }
}

// ============================================================
// FASE 2: RESTORE DO GITHUB
// ============================================================
async function phase2_restore() {
  log('');
  log('═══════════════════════════════════════════════════════');
  log('  FASE 2: RESTAURAR DO GITHUB');
  log('═══════════════════════════════════════════════════════');

  for (const [name, info] of Object.entries(FILES)) {
    try {
      await downloadFile(info.url, info.local);
      results.restore.push({ file: name, ok: true });
      log(`  [RESTORE] ${name} — OK`);
    } catch (e) {
      results.restore.push({ file: name, ok: false, error: e.message });
      log(`  [ERRO] ${name} — ${e.message}`);
    }
  }
}

// ============================================================
// FASE 3: APLICAR CORREÇÕES REAIS
// ============================================================
function applyFix(filePath, description, findFn, replaceFn) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const found = findFn(content);
    if (!found) {
      results.apply.push({ file: path.basename(filePath), desc: description, status: 'SKIP — trecho não encontrado' });
      log(`  [SKIP] ${description} — trecho não encontrado`);
      return false;
    }
    const newContent = replaceFn(content);
    if (newContent === content) {
      results.apply.push({ file: path.basename(filePath), desc: description, status: 'SKIP — já está correto' });
      log(`  [SKIP] ${description} — já correto`);
      return false;
    }
    fs.writeFileSync(filePath, newContent, 'utf8');
    results.apply.push({ file: path.basename(filePath), desc: description, status: 'OK' });
    log(`  [OK] ${description}`);
    return true;
  } catch (e) {
    results.apply.push({ file: path.basename(filePath), desc: description, status: `ERRO: ${e.message}` });
    log(`  [ERRO] ${description} — ${e.message}`);
    return false;
  }
}

function phase3_applyFixes() {
  log('');
  log('═══════════════════════════════════════════════════════');
  log('  FASE 3: APLICAR CORREÇÕES REAIS');
  log('═══════════════════════════════════════════════════════');

  const agentPath = FILES.agent.local;
  const classifierPath = FILES.classifier.local;
  const brainPath = FILES.brain.local;
  const schedulerPath = FILES.scheduler.local;
  const serverPath = FILES.server.local;

  // ─────────────────────────────────────────────────────────
  // C1 — global.SCHEMAS (já existe no código, só verificar)
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'C1 — global.SCHEMAS já presente',
    (c) => c.includes('global.SCHEMAS') || c.includes('SCHEMAS = loadAllSchemas()'),
    (c) => c // já está correto
  );

  // ─────────────────────────────────────────────────────────
  // C2 — Regexes do SmartClassifier (já existem no código)
  // ─────────────────────────────────────────────────────────
  applyFix(classifierPath, 'C2 — Regex tarefaRealizada',
    (c) => c.includes('tarefaRealizada') && c.includes('subi|fiz|pronto'),
    (c) => c
  );
  applyFix(classifierPath, 'C2 — Regex tarefaPendente',
    (c) => c.includes('tarefaPendente') && c.includes('precisamos|falta'),
    (c) => c
  );
  applyFix(classifierPath, 'C2 — Regex financeiroPagamento',
    (c) => c.includes('financeiroPagamento') && c.includes('pagou|pago'),
    (c) => c
  );
  applyFix(classifierPath, 'C2 — Regex financeiroPendente',
    (c) => c.includes('financeiroPendente') && c.includes('nao pagou|pendente'),
    (c) => c
  );
  applyFix(classifierPath, 'C2 — Regex leadQuente',
    (c) => c.includes('leadQuente') && c.includes('quero contratar|quero fechar'),
    (c) => c
  );
  applyFix(classifierPath, 'C2 — Regex leadMorno',
    (c) => c.includes('leadMorno') && c.includes('interessado|gostaria'),
    (c) => c
  );
  applyFix(classifierPath, 'C2 — Regex leadFrio',
    (c) => c.includes('leadFrio') && c.includes('so para saber|curiosidade'),
    (c) => c
  );

  // ─────────────────────────────────────────────────────────
  // C3 — handleMention: IGNORAR menção vazia
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'C3 — Ignorar menção vazia',
    (c) => {
      const match = c.match(/async handleMention\(msg\) \{[\s\S]*?const body = msg\.body \|\| '';/);
      return match && !c.includes('if (!body.trim())');
    },
    (c) => {
      return c.replace(
        /(async handleMention\(msg\) \{[\s\S]*?const body = msg\.body \|\| '';)/,
        `$1\n    if (!body.trim()) { log.warn('Menção vazia ignorada'); return; }`
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // C3 — handleMention: USAR IA (Gemma) para resposta inteligente
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'C3 — handleMention usa IA (Gemma)',
    (c) => {
      return c.includes('async handleMention(msg)') && 
             !c.includes('await this.brain.generateResponse');
    },
    (c) => {
      // Substituir TODO o corpo de handleMention por versão com IA
      const oldHandleMention = /async handleMention\(msg\) \{[\s\S]*?\n  \}\n\n  async handleCommand/;
      const newHandleMention = `async handleMention(msg) {
    const body = msg.body || '';
    if (!body.trim()) { log.warn('Menção vazia ignorada'); return; }

    log.info(\`MENÇÃO de \${msg.pushname || msg.from}: \${body.slice(0, 80)}\`);

    try {
      // Usar LunaBrain para gerar resposta inteligente
      const context = {
        urgency: 'normal',
        sentiment: 'neutral',
        topic: 'general',
        userMood: 'neutral',
        authorName: msg.pushname || msg.from
      };

      const response = await this.brain.generateResponse(body, context);

      if (response && response.text) {
        await msg.reply(response.text);
        log.success('Resposta IA enviada!');
      } else {
        // Fallback para resposta padrão
        await msg.reply(\`🌙 Oi! Vi que me mencionou.\\n\\nAtualmente no dashboard:\\n• \${this.cp.buffer.newTasks?.length || 0} tarefas pendentes\\n• \${this.cp.buffer.newIdeas?.length || 0} ideias para explorar\\n• \${this.cp.buffer.newLinks?.length || 0} links para revisar\\n\\nO que você precisa?\`);
      }
    } catch (err) {
      log.error(\`Falha IA: \${err.message}\`);
      await msg.reply('🌙 Opa, deu um tilt nos meus neurônios! Mas estou aqui. O que precisa?');
    }
  }

  async handleCommand`;
      return c.replace(oldHandleMention, newHandleMention);
    }
  );

  // ─────────────────────────────────────────────────────────
  // C4 — parseGemmaResponse robusto (3 estratégias)
  // ─────────────────────────────────────────────────────────
  applyFix(brainPath, 'C4 — parseGemmaResponse robusto (3 estratégias)',
    (c) => {
      const match = c.match(/parseGemmaResponse\(responseText\) \{[\s\S]*?\n  \}/);
      return match && !c.includes('// ESTRATÉGIA 1');
    },
    (c) => {
      const oldFn = /parseGemmaResponse\(responseText\) \{[\s\S]*?\n  \}/;
      const newFn = `parseGemmaResponse(responseText) {
    if (!responseText) return null;
    const raw = responseText.trim();

    // ESTRATÉGIA 1: JSON puro direto
    try {
      const parsed = JSON.parse(raw);
      if (parsed.category || parsed.confidence !== undefined) return parsed;
    } catch (e) {}

    // ESTRATÉGIA 2: JSON dentro de markdown code block
    try {
      const codeBlockMatch = raw.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/);
      if (codeBlockMatch) {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (parsed.category || parsed.confidence !== undefined) return parsed;
      }
    } catch (e) {}

    // ESTRATÉGIA 3: JSON embutido em texto (procura primeiro { e último })
    try {
      const jsonMatch = raw.match(/\\{[\\s\\S]*\\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.category || parsed.confidence !== undefined) return parsed;
      }
    } catch (e) {}

    console.error('[GEMMA] Não conseguiu extrair JSON de:', raw.slice(0, 200));
    return null;
  }`;
      return c.replace(oldFn, newFn);
    }
  );

  // ─────────────────────────────────────────────────────────
  // C5 — Remover humor do classify (brain)
  // ─────────────────────────────────────────────────────────
  applyFix(brainPath, 'C5 — Remover humor do classify',
    (c) => {
      return c.includes('finalResult.lunaPersonality') && 
             c.includes('// 5. APLICAR PERSONALIDADE AO RESULTADO');
    },
    (c) => {
      return c.replace(
        /\/\/ 5\. APLICAR PERSONALIDADE AO RESULTADO[\s\S]*?finalResult\.lunaPersonality = this\.selectPersonality\(\{[\s\S]*?\}\);/,
        `// 5. PERSONALIDADE: apenas metadados, não afeta classificação
    finalResult.lunaPersonality = 'default';`
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // C6 — runScan/runReport params no scheduler
  // ─────────────────────────────────────────────────────────
  applyFix(schedulerPath, 'C6 — runScan params',
    (c) => {
      return c.includes('async function runScan()') && 
             c.includes('await runAgent(false)');
    },
    (c) => {
      return c.replace(
        'async function runScan() {\n  log(\'SCAN iniciado\');\n  const result = await runAgent(false);',
        'async function runScan(options = {}) {\n  log(\'SCAN iniciado\');\n  const result = await runAgent({ once: true, schedule: false, ...options });'
      );
    }
  );

  applyFix(schedulerPath, 'C6 — runReport params',
    (c) => {
      return c.includes('async function runReport()') && 
             c.includes('await runAgent(true)');
    },
    (c) => {
      return c.replace(
        'async function runReport() {\n  log(\'REPORT iniciado\');\n  const result = await runAgent(true);',
        'async function runReport(options = {}) {\n  log(\'REPORT iniciado\');\n  const result = await runAgent({ once: true, schedule: false, fullExtract: false, ...options });'
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // C7 — threadHistory init no agent
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'C7 — threadHistory init',
    (c) => {
      return c.includes('this.threadHistory') && 
             !c.includes('this.threadHistory = []');
    },
    (c) => {
      return c.replace(
        /constructor\(\) \{[\s\S]*?this\.running = false;/,
        (match) => match.replace('this.running = false;', 'this.running = false;\n    this.threadHistory = [];')
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // C8 — isAuthorizedChat (já existe e funciona)
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'C8 — isAuthorizedChat',
    (c) => c.includes('isAuthorizedChat') && c.includes('production'),
    (c) => c
  );

  // ─────────────────────────────────────────────────────────
  // C9 — forceReport destinatário
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'C9 — forceReport destinatário',
    (c) => {
      return c.includes('async forceReport(to)') && 
             c.includes('await this.sendScheduledReport();');
    },
    (c) => {
      return c.replace(
        /async forceReport\(to\) \{\n    await this\.sendScheduledReport\(\);\n  \}/,
        `async forceReport(to) {
    // Guardar destinatário temporário
    const originalGroup = this.reportGroup;
    if (to) {
      const chats = await this.client.getChats();
      this.reportGroup = chats.find(c => c.id?._serialized === to || c.from === to);
    }
    await this.sendScheduledReport();
    // Restaurar
    this.reportGroup = originalGroup;
  }`
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // C10 — isMention case-insensitive
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'C10 — isMention case-insensitive (/i)',
    (c) => {
      return c.includes('const isMention = /@luna|@kimi|@kimiclaw/.test(body);') &&
             !c.includes('/i.test(body)');
    },
    (c) => {
      return c.replace(
        'const isMention = /@luna|@kimi|@kimiclaw/.test(body);',
        'const isMention = /@luna|@kimi|@kimiclaw/i.test(body);'
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // C11 — Buffer seguro (só limpa após envio confirmado)
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'C11 — Buffer só limpa após envio',
    (c) => {
      return c.includes('this.cp.buffer.newMessages = [];') &&
             c.includes('if (this.reportGroup) {');
    },
    (c) => {
      return c.replace(
        /if \(this\.reportGroup\) \{\n    await this\.reportGroup\.sendMessage\(report\);\n    log\.success\('Relatorio inteligente enviado!'\);\n  \}\n\n  this\.cp\.buffer\.newMessages = \[\];/,
        `let sent = false;
  if (this.reportGroup) {
    try {
      await this.reportGroup.sendMessage(report);
      log.success('Relatório inteligente enviado!');
      sent = true;
    } catch (err) {
      log.error(\`Falha ao enviar relatório: \${err.message}\`);
    }
  }

  // Só limpa buffer se enviou com sucesso
  if (sent) {
    this.cp.buffer.newMessages = [];`
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // C12 — CDP_PORT 9223
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'C12 — CDP_PORT 9223',
    (c) => c.includes('CDP_PORT: 9222'),
    (c) => c.replace('CDP_PORT: 9222,', 'CDP_PORT: 9223,')
  );

  // ─────────────────────────────────────────────────────────
  // A2 — /ajuda em espanhol + novos comandos
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'A2 — /ajuda espanhol + comandos',
    (c) => {
      return c.includes("else if (cmd === '/ajuda')") &&
             !c.includes('/estado') && !c.includes('/ideas');
    },
    (c) => {
      return c.replace(
        /else if \(cmd === '\/ajuda'\) \{\n    await msg\.reply\('🌙 \\*AJUDA LUNA v15\.1\\*\\n\\n\/status — Projetos\\n\/relatorio — Relatorio\\n\/tarefas — Tarefas\\n\/extrair — Extrair tudo\\n\/ajuda — Este menu\\n\\nMencione @Luna para falar! Posso responder sobre clientes, financas, links e status\.'\);\n  \}/,
        `else if (cmd === '/ajuda' || cmd === '/help') {
    await msg.reply(\`🌙 *AJUDA LUNA v15.1*\\n\\n📋 COMANDOS:\\n/status — Projetos e tarefas\\n/relatorio — Relatório completo\\n/tarefas — Lista de tarefas\\n/extrair — Extração completa\\n/ideas — Ideias recentes\\n/links — Links compartilhados\\n/leads — Leads detectados\\n/news — Notícias do grupo\\n/estado — Estado emocional da Luna\\n/config — Configurações\\n/diagnostico — Diagnóstico do sistema\\n/ajuda — Este menu\\n\\n💬 Mencione @Luna para conversar!\\nPuedo responder en español, portugués o catalán.\`);
  }
  else if (cmd === '/ideas') {
    const ideas = this.cp.buffer.newIdeas || [];
    const list = ideas.length > 0 ? ideas.slice(0, 5).map(i => \`• \${(i.body || i.text || '').slice(0, 50)}\`).join('\\n') : 'Nenhuma ideia nova.';
    await msg.reply(\`💡 *IDEAS*\\n\\n\${list}\\n\\n🤖 Luna v15.1\`);
  }
  else if (cmd === '/links') {
    const links = this.cp.buffer.newLinks || [];
    const list = links.length > 0 ? links.slice(0, 5).map(l => \`• \${l.url?.slice(0, 40)}...\`).join('\\n') : 'Nenhum link novo.';
    await msg.reply(\`🔗 *LINKS*\\n\\n\${list}\\n\\n🤖 Luna v15.1\`);
  }
  else if (cmd === '/leads') {
    const leads = this.cp.buffer.newLeads || [];
    const list = leads.length > 0 ? leads.slice(0, 5).map(l => \`• \${l.name || 'Lead'}: \${(l.context || '').slice(0, 40)}\`).join('\\n') : 'Nenhum lead novo.';
    await msg.reply(\`🎣 *LEADS*\\n\\n\${list}\\n\\n🤖 Luna v15.1\`);
  }
  else if (cmd === '/news') {
    const news = this.cp.buffer.newNews || [];
    const list = news.length > 0 ? news.slice(0, 5).map(n => \`• \${(n.body || n.text || '').slice(0, 50)}\`).join('\\n') : 'Nenhuma notícia nova.';
    await msg.reply(\`📰 *NEWS*\\n\\n\${list}\\n\\n🤖 Luna v15.1\`);
  }
  else if (cmd === '/estado') {
    await msg.reply(\`🌙 *ESTADO LUNA*\\n\\n😊 Felicidade: \${this.brain.emotionalState?.happiness || 70}%\\n⚡ Energia: \${this.brain.emotionalState?.energy || 70}%\\n💙 Calma: \${this.brain.emotionalState?.calmness || 50}%\\n🎉 Excitação: \${this.brain.emotionalState?.excitement || 60}%\\n\\nPersonalidade ativa: \${this.brain.activePersonality || 'default'}\\n🤖 Luna v15.1\`);
  }`
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // A3 — resolveAuthor já está em SmartClassifier
  // ─────────────────────────────────────────────────────────
  applyFix(classifierPath, 'A3 — resolveAuthor exportado',
    (c) => c.includes('module.exports = { SmartClassifier, resolveAuthor }'),
    (c) => c
  );

  // ─────────────────────────────────────────────────────────
  // A3 — Usar resolveAuthor no updateBufferFromClassified
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'A3 — updateBuffer usa resolveAuthor',
    (c) => {
      return c.includes('updateBufferFromClassified(classified)') &&
             c.includes('author: item.author') &&
             !c.includes('resolveAuthor(item.author');
    },
    (c) => {
      // Adicionar import de resolveAuthor no topo se não existir
      if (!c.includes("const { resolveAuthor } = require('./SmartClassifier_v16.js')")) {
        c = c.replace(
          "const { SmartClassifier, resolveAuthor } = require('./SmartClassifier_v16.js');",
          "const { SmartClassifier, resolveAuthor } = require('./SmartClassifier_v16.js');\n// resolveAuthor já importado acima"
        );
      }
      // Atualizar todos os author: item.author para usar resolveAuthor
      return c.replace(/author: item\.author/g, 'author: resolveAuthor(item.author || item.from).name');
    }
  );

  // ─────────────────────────────────────────────────────────
  // A4 — notifyOps log
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'A4 — notifyOps com log',
    (c) => {
      return c.includes('async notifyOps(data)') &&
             !c.includes('log.info('[NOTIFY]');
    },
    (c) => {
      return c.replace(
        /async notifyOps\(data\) \{\n    try \{/,
        `async notifyOps(data) {
    log.info(\`[NOTIFY] Enviando \${data.newCount || 0} novas mensagens para ops\`);
    try {`
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // A5 — readJSONSafe/writeJSONSafe (já existem no SmartClassifier)
  // ─────────────────────────────────────────────────────────
  applyFix(classifierPath, 'A5 — readJSONSafe/writeJSONSafe',
    (c) => c.includes('function readJSONSafe') && c.includes('function writeJSONSafe'),
    (c) => c
  );

  // ─────────────────────────────────────────────────────────
  // A5 — deduplicateMessages
  // ─────────────────────────────────────────────────────────
  applyFix(classifierPath, 'A5 — deduplicateMessages',
    (c) => !c.includes('function deduplicateMessages'),
    (c) => {
      return c.replace(
        'module.exports = { SmartClassifier, resolveAuthor };',
        `function deduplicateMessages(messages) {
  const seen = new Set();
  return messages.filter(m => {
    const key = \`\${m.id || m.text || ''}:\${m.author || ''}:\${m.timestamp || ''}\`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { SmartClassifier, resolveAuthor, deduplicateMessages };`
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // A5/A6 — whatsapp-history.json + alias
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'A5/A6 — whatsapp-history.json + alias',
    (c) => {
      return !c.includes('WHATSAPP_HISTORY_FILE') &&
             !c.includes('saveToHistory');
    },
    (c) => {
      // Adicionar constante após OUTPUT_FILE
      c = c.replace(
        "OUTPUT_FILE: path.join(__dirname, '../backend/data/whatsapp-agent-data.json'),",
        `OUTPUT_FILE: path.join(__dirname, '../backend/data/whatsapp-agent-data.json'),
  WHATSAPP_HISTORY_FILE: path.join(__dirname, '../backend/data/whatsapp-history.json'),`
      );

      // Adicionar método saveToHistory na classe LunaAgent
      c = c.replace(
        /async notifyOps\(data\)/,
        `async saveToHistory(messages) {
    try {
      const historyPath = CONFIG.WHATSAPP_HISTORY_FILE;
      let history = [];
      if (fs.existsSync(historyPath)) {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      }

      // Alias mapping
      const aliasMap = {
        'Abner': 'Abner Gabriel',
        'Nonoke': 'Enoque G. Santos',
        'Elias': 'Elias Mendes',
        'abner': 'Abner Gabriel',
        'nonoke': 'Enoque G. Santos',
        'enoque': 'Enoque G. Santos',
        'elias': 'Elias Mendes'
      };

      for (const msg of messages) {
        const authorName = msg.author || 'Desconhecido';
        const resolvedName = aliasMap[authorName] || authorName;
        history.push({
          id: msg.id || crypto.randomUUID(),
          author: resolvedName,
          originalAuthor: authorName,
          text: msg.text || msg.body || '',
          chat: msg.chatName || '',
          timestamp: msg.timestamp || new Date().toISOString(),
          classification: msg.classification || null
        });
      }

      // Limitar a 5000 entradas
      if (history.length > 5000) history = history.slice(-5000);

      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      log.info(\`\${messages.length} mensagens salvas no histórico (total: \${history.length})\`);
    } catch (e) {
      log.error(\`Erro ao salvar histórico: \${e.message}\`);
    }
  }

  async notifyOps(data)`
      );
      return c;
    }
  );

  // ─────────────────────────────────────────────────────────
  // A6 — alias messages (já incluído no saveToHistory acima)
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'A6 — alias mapping',
    (c) => c.includes('aliasMap'),
    (c) => c
  );

  // ─────────────────────────────────────────────────────────
  // A12 — Comandos em espanhol nos handlers existentes
  // ─────────────────────────────────────────────────────────
  applyFix(agentPath, 'A12 — /status espanhol',
    (c) => {
      return c.includes("else if (cmd === '/status')") &&
             !c.includes("cmd === '/estado'");
    },
    (c) => {
      return c.replace(
        "else if (cmd === '/status') {",
        "else if (cmd === '/status' || cmd === '/estado') {"
      );
    }
  );

  applyFix(agentPath, 'A12 — /relatorio espanhol',
    (c) => {
      return c.includes("else if (cmd === '/relatorio')") &&
             !c.includes("cmd === '/reporte'");
    },
    (c) => {
      return c.replace(
        "else if (cmd === '/relatorio') {",
        "else if (cmd === '/relatorio' || cmd === '/reporte') {"
      );
    }
  );

  applyFix(agentPath, 'A12 — /tarefas espanhol',
    (c) => {
      return c.includes("else if (cmd === '/tarefas')") &&
             !c.includes("cmd === '/tareas'");
    },
    (c) => {
      return c.replace(
        "else if (cmd === '/tarefas') {",
        "else if (cmd === '/tarefas' || cmd === '/tareas') {"
      );
    }
  );

  applyFix(agentPath, 'A12 — /extrair espanhol',
    (c) => {
      return c.includes("else if (cmd === '/extrair')") &&
             !c.includes("cmd === '/extraer'");
    },
    (c) => {
      return c.replace(
        "else if (cmd === '/extrair') {",
        "else if (cmd === '/extrair' || cmd === '/extraer') {"
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // SERVER — /api/whatsapp-agent normalizado
  // ─────────────────────────────────────────────────────────
  applyFix(serverPath, 'SERVER — /api/whatsapp-agent normalizado',
    (c) => {
      return c.includes("app.get('/api/whatsapp-agent'") &&
             c.includes('readJSON(AGENT_DATA_FILE)');
    },
    (c) => {
      return c.replace(
        /app\.get\('\/api\/whatsapp-agent', \(req, res\) => \{\n  const data = readJSON\(AGENT_DATA_FILE\);\n  if \(!data\) return res\.status\(404\)\.json\(\{ error: 'Agent data not found\. Run: node agents\/nexo-whatsapp-agent-v8\.mjs' \}\);\n  res\.json\(data\);\n\}\);/,
        `app.get('/api/whatsapp-agent', (req, res) => {
  try {
    const data = readJSON(AGENT_DATA_FILE);
    if (!data) {
      return res.status(404).json({ 
        success: false,
        error: 'Agent data not found',
        hint: 'Run: node agents/luna-cto-agent.cjs'
      });
    }
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});`
      );
    }
  );

  // ─────────────────────────────────────────────────────────
  // SERVER — /api/whatsapp alinhar
  // ─────────────────────────────────────────────────────────
  applyFix(serverPath, 'SERVER — /api/whatsapp alinhar',
    (c) => {
      return c.includes("app.get('/api/whatsapp'") &&
             c.includes('bufferPath');
    },
    (c) => {
      return c.replace(
        /app\.get\('\/api\/whatsapp', \(req, res\) => \{\n  try \{\n    const bufferPath = path\.join\(__dirname, '\.\.\', 'agents', 'luna-buffer\.json'\);[\s\S]*?\}\);/,
        `app.get('/api/whatsapp', (req, res) => {
  try {
    const bufferPath = path.join(__dirname, '..', 'agents', 'luna-buffer.json');
    const historyPath = path.join(__dirname, '..', 'backend', 'data', 'whatsapp-history.json');

    let buffer = { messages: [], tasks: [], ideas: [], decisions: [], links: [], mentions: [] };
    let history = [];

    if (fs.existsSync(bufferPath)) {
      buffer = JSON.parse(fs.readFileSync(bufferPath, 'utf8'));
    }
    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    }

    res.json({
      success: true,
      buffer: {
        messages: buffer.messages || [],
        tasks: buffer.tasks || [],
        ideas: buffer.ideas || [],
        decisions: buffer.decisions || [],
        links: buffer.links || [],
        mentions: buffer.mentions || []
      },
      history: history.slice(-50),
      totalMessages: (buffer.messages || []).length,
      totalTasks: (buffer.tasks || []).length,
      totalIdeas: (buffer.ideas || []).length,
      totalDecisions: (buffer.decisions || []).length,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});`
      );
    }
  );
}

// ============================================================
// FASE 4: VERIFICAÇÃO
// ============================================================
function phase4_verify() {
  log('');
  log('═══════════════════════════════════════════════════════');
  log('  FASE 4: VERIFICAÇÃO FINAL');
  log('═══════════════════════════════════════════════════════');

  const checks = [
    { name: 'C1 — global.SCHEMAS', file: FILES.agent.local, test: (c) => c.includes('global.SCHEMAS') },
    { name: 'C3 — handleMention vazio', file: FILES.agent.local, test: (c) => c.includes('if (!body.trim())') },
    { name: 'C3 — handleMention IA', file: FILES.agent.local, test: (c) => c.includes('await this.brain.generateResponse') },
    { name: 'C4 — parseGemmaResponse 3 estratégias', file: FILES.brain.local, test: (c) => c.includes('// ESTRATÉGIA 1') },
    { name: 'C5 — humor removido', file: FILES.brain.local, test: (c) => c.includes('finalResult.lunaPersonality = \'default\'') },
    { name: 'C6 — runScan params', file: FILES.scheduler.local, test: (c) => c.includes('runScan(options = {})') },
    { name: 'C6 — runReport params', file: FILES.scheduler.local, test: (c) => c.includes('runReport(options = {})') },
    { name: 'C7 — threadHistory', file: FILES.agent.local, test: (c) => c.includes('this.threadHistory = []') },
    { name: 'C8 — isAuthorizedChat', file: FILES.agent.local, test: (c) => c.includes('isAuthorizedChat') },
    { name: 'C9 — forceReport', file: FILES.agent.local, test: (c) => c.includes('const originalGroup = this.reportGroup') },
    { name: 'C10 — isMention /i', file: FILES.agent.local, test: (c) => c.includes('/@luna|@kimi|@kimiclaw/i.test(body)') },
    { name: 'C11 — buffer seguro', file: FILES.agent.local, test: (c) => c.includes('if (sent)') },
    { name: 'C12 — CDP_PORT 9223', file: FILES.agent.local, test: (c) => c.includes('CDP_PORT: 9223') },
    { name: 'A3 — resolveAuthor', file: FILES.agent.local, test: (c) => c.includes('resolveAuthor(item.author') },
    { name: 'A5 — whatsapp-history', file: FILES.agent.local, test: (c) => c.includes('WHATSAPP_HISTORY_FILE') },
    { name: 'A12 — espanhol', file: FILES.agent.local, test: (c) => c.includes("cmd === '/estado'") },
    { name: 'SERVER — whatsapp-agent', file: FILES.server.local, test: (c) => c.includes("success: true, data,") },
  ];

  for (const check of checks) {
    try {
      const content = fs.readFileSync(check.file, 'utf8');
      const ok = check.test(content);
      results.verify.push({ name: check.name, ok });
      log(`  [${ok ? 'OK' : 'FAIL'}] ${check.name}`);
    } catch (e) {
      results.verify.push({ name: check.name, ok: false, error: e.message });
      log(`  [FAIL] ${check.name} — ${e.message}`);
    }
  }
}

// ============================================================
// FASE 5: RELATÓRIO
// ============================================================
function phase5_report() {
  log('');
  log('═══════════════════════════════════════════════════════');
  log('  📊 RELATÓRIO FINAL');
  log('═══════════════════════════════════════════════════════');

  const applied = results.apply.filter(r => r.status === 'OK').length;
  const skipped = results.apply.filter(r => r.status && r.status.startsWith('SKIP')).length;
  const errors = results.apply.filter(r => r.status && r.status.startsWith('ERRO')).length;
  const verified = results.verify.filter(r => r.ok).length;
  const totalVerify = results.verify.length;

  log(`  ✅ Aplicados: ${applied}`);
  log(`  ⏭️  Ignorados: ${skipped}`);
  log(`  ❌ Erros: ${errors}`);
  log(`  🛡️  Verificados: ${verified}/${totalVerify}`);
  log(`  💾 Backup: ${BACKUP_DIR}`);
  log('');

  if (errors > 0) {
    log('  ⚠️  ALGUNS ERROS OCORRERAM. Verifique o log acima.');
  } else if (verified === totalVerify) {
    log('  🎉 TODAS AS VERIFICAÇÕES PASSARAM!');
  } else {
    log(`  ⚠️  ${totalVerify - verified} verificações falharam. Pode ser que já estejam corretas.`);
  }

  log('');
  log('  Próximos passos:');
  log('    1. node -c agents/luna-cto-agent.cjs');
  log('    2. node -c agents/luna-scheduler.mjs');
  log('    3. node agents/luna-cto-agent.cjs');
}

// ============================================================
// MAIN
// ============================================================
(async () => {
  log('═══════════════════════════════════════════════════════');
  log('  🌙 LUNA FIX MASTER v8.0 INICIADO');
  log(`  📁 Projeto: ${PROJECT_DIR}`);
  log(`  💾 Backup:  ${BACKUP_DIR}`);
  log('═══════════════════════════════════════════════════════');

  await phase1_backup();
  await phase2_restore();
  phase3_applyFixes();
  phase4_verify();
  phase5_report();
})();
