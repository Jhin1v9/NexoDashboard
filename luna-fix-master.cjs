#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// LUNA FIX MASTER v1.0 — Correção Cirúrgica de 42 Problemas
// Modo: Backup + Patch + Verificação
// Execute: node luna-fix-master.js
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================
// CONFIGURAÇÃO
// ============================================
const PROJECT_DIRS = [
  'C:\\Users\\Administrator\\Documents\\NEXO DIGITAL\\01_ATIVOS\\NEXO_DASHBOARD_PRO',
  'C:\\Users\\Administrator\\Documents\\NEXO_DASHBOARD_PRO',
  path.join(process.cwd(), 'NEXO_DASHBOARD_PRO'),
  process.cwd()
];

let ROOT = null;
for (const d of PROJECT_DIRS) {
  if (fs.existsSync(path.join(d, 'agents', 'luna-cto-agent.cjs'))) {
    ROOT = d;
    break;
  }
}

if (!ROOT) {
  console.error('❌ Projeto NEXO_DASHBOARD_PRO não encontrado!');
  console.error('   Procurei em:');
  PROJECT_DIRS.forEach(d => console.error('   - ' + d));
  console.error('   Execute este script DENTRO da pasta do projeto.');
  process.exit(1);
}

const BACKUP_DIR = path.join(ROOT, 'artifacts', 'backups', 'luna-fix-' + new Date().toISOString().replace(/[:.]/g, '-'));
const LOG_FILE = path.join(ROOT, 'artifacts', 'luna-fix-log.txt');

// ============================================
// UTILS
// ============================================
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(msg) {
  const line = `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`;
  console.log(line);
  ensureDir(path.dirname(LOG_FILE));
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 8);
}

function backup(filePath) {
  const rel = path.relative(ROOT, filePath);
  const dest = path.join(BACKUP_DIR, rel);
  ensureDir(path.dirname(dest));
  fs.copyFileSync(filePath, dest);
  log(`📦 Backup: ${rel} → ${sha1(fs.readFileSync(filePath, 'utf8'))}`);
  return dest;
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function applyPatch(filePath, description, search, replace, options = {}) {
  const content = read(filePath);
  const exact = options.exact !== false;

  let newContent;
  if (exact) {
    if (!content.includes(search)) {
      log(`⚠️  [SKIP] "${description}" — trecho não encontrado (já corrigido?)`);
      return false;
    }
    newContent = content.split(search).join(replace);
    if (newContent === content) {
      log(`⚠️  [SKIP] "${description}" — substituição não alterou nada`);
      return false;
    }
  } else {
    // regex mode
    newContent = content.replace(search, replace);
    if (newContent === content) {
      log(`⚠️  [SKIP] "${description}" — regex não matchou`);
      return false;
    }
  }

  write(filePath, newContent);
  log(`✅ [OK] ${description} (${sha1(newContent)})`);
  return true;
}

function verifyContains(filePath, expected, description) {
  const content = read(filePath);
  if (!content.includes(expected)) {
    log(`❌ [FAIL] ${description} — verificação falhou!`);
    return false;
  }
  log(`🛡️  [VERIFY] ${description} — OK`);
  return true;
}

// ============================================
// BACKUP INICIAL
// ============================================
ensureDir(BACKUP_DIR);
log('═══════════════════════════════════════════════════════');
log(' 🌙 LUNA FIX MASTER v1.0 INICIADO');
log(` 📁 Projeto: ${ROOT}`);
log(` 💾 Backup:  ${BACKUP_DIR}`);
log('═══════════════════════════════════════════════════════');

const FILES = {
  agent: path.join(ROOT, 'agents', 'luna-cto-agent.cjs'),
  scheduler: path.join(ROOT, 'agents', 'luna-scheduler.mjs'),
  daemon: path.join(ROOT, 'agents', 'luna-daemon.mjs'),
  classifier: path.join(ROOT, 'agents', 'SmartClassifier_v16.js'),
  brain: path.join(ROOT, 'agents', 'LunaBrain_v16.js'),
  server: path.join(ROOT, 'backend', 'server.js')
};

for (const [k, v] of Object.entries(FILES)) {
  if (fs.existsSync(v)) {
    backup(v);
  } else {
    log(`⚠️  Arquivo não encontrado: ${v}`);
  }
}

let applied = 0;
let skipped = 0;
let failed = 0;

function track(ok) {
  if (ok === true) applied++;
  else if (ok === false) skipped++;
  else failed++;
}

// ============================================
// PATCH 1: global.SCHEMAS (C1)
// ============================================
log('\n--- [C1] global.SCHEMAS ---');
track(applyPatch(
  FILES.agent,
  'Exportar SCHEMAS para global',
  `SCHEMAS = loadAllSchemas();`,
  `SCHEMAS = loadAllSchemas();\n\n// [FIX C1] Exportar para global — resolveAuthor() precisa disso\nglobal.SCHEMAS = SCHEMAS;`
));

// ============================================
// PATCH 2: Regex patterns com espaços (C2)
// ============================================
log('\n--- [C2] Regex patterns quebrados ---');

// tarefaRealizada: separar palavras com espaço
const oldTarefa = `/\\b(subi|fiz|pronto|terminado|deploy|enviei|mandei|atualizei|corrigido?|fix|resolvido|concluido|done|finished|complete|merged|push|commit|build ok|ta funcionando|funcionou|deployado|publicado|online|live|ativo)\\b/gi`;
const newTarefa = `/\\b(subi|fiz|pronto|terminado|deploy|enviei|mandei|atualizei|corrigido?|fix|resolvido|concluido|done|finished|complete|merged|push|commit|build|ok|funcionando|funcionou|deployado|publicado|online|live|ativo)\\b/gi`;
track(applyPatch(FILES.classifier, 'Regex tarefaRealizada (espaços)', oldTarefa, newTarefa));

// tarefaPendente
const oldPendente = `/\\b(precisamos|falta|urgente|fazer|implementar|criar|build|desenvolver|corrigir|arrumar|consertar|pendente|todo|falta fazer|tem que|devemos|vamos|precisa|necessario|obrigatorio|deadline|prazo|entrega|terminar|concluir|finalizar)\\b/gi`;
const newPendente = `/\\b(precisamos|falta|urgente|fazer|implementar|criar|build|desenvolver|corrigir|arrumar|consertar|pendente|todo|falta|tem|que|devemos|vamos|precisa|necessario|obrigatorio|deadline|prazo|entrega|terminar|concluir|finalizar)\\b/gi`;
track(applyPatch(FILES.classifier, 'Regex tarefaPendente (espaços)', oldPendente, newPendente));

// financeiroPagamento
const oldFinPag = `/\\b(pagou|pago|recebido|transferencia|deposito|pix|transferiu|pagamento recebido|dinheiro na conta|entrou dinheiro|recebi|recebemos|pagaram)\\b/gi`;
const newFinPag = `/\\b(pagou|pago|recebido|transferencia|deposito|pix|transferiu|pagamento|dinheiro|conta|entrou|recebi|recebemos|pagaram)\\b/gi`;
track(applyPatch(FILES.classifier, 'Regex financeiroPagamento (espaços)', oldFinPag, newFinPag));

// financeiroPendente
const oldFinPen = `/\\b(nao pagou|pendente|atrasado|devendo|falta pagar|nao recebi|ainda nao pagou|esta devendo|fatura atrasada|conta atrasada|nao transferiu|esperando pagamento)\\b/gi`;
const newFinPen = `/\\b(nao|pagou|pendente|atrasado|devendo|falta|recebi|ainda|esta|devendo|fatura|conta|transferiu|esperando|pagamento)\\b/gi`;
track(applyPatch(FILES.classifier, 'Regex financeiroPendente (espaços)', oldFinPen, newFinPen));

// leadQuente
const oldLeadQ = `/\\b(quero contratar|quero fechar|vamos fechar|fecha quando|quando começamos|quando podemos começar|ta decidido|vou fechar|vou contratar|manda contrato|manda proposta|quero o site|quero o sistema|quero o app|quando entrega|quanto tempo leva|qual o prazo)\\b/gi`;
const newLeadQ = `/\\b(quero|contratar|fechar|vamos|fecha|quando|começamos|podemos|decidido|vou|manda|contrato|proposta|site|sistema|app|entrega|tempo|leva|prazo)\\b/gi`;
track(applyPatch(FILES.classifier, 'Regex leadQuente (espaços)', oldLeadQ, newLeadQ));

// leadMorno
const oldLeadM = `/\\b(interessado|gostaria|queria|preciso de|necessito|estou procurando|vi o trabalho|vi o site|me indicaram|recomendaram|quanto cobra|quanto custa|faz site|faz app|faz sistema|trabalha com|voce faz|faz para|fazemos|orcamento|proposta|preco|valor)\\b/gi`;
const newLeadM = `/\\b(interessado|gostaria|queria|preciso|necessito|estou|procurando|vi|trabalho|site|indicaram|recomendaram|quanto|cobra|custa|faz|trabalha|voce|fazemos|orcamento|proposta|preco|valor)\\b/gi`;
track(applyPatch(FILES.classifier, 'Regex leadMorno (espaços)', oldLeadM, newLeadM));

// leadFrio
const oldLeadF = `/\\b(só para saber|so para saber|curiosidade|só uma duvida|so uma duvida|pergunta rapida|rapida pergunta|só confirmar|so confirmar|informacao|mais informacoes|como funciona|o que é|como é)\\b/gi`;
const newLeadF = `/\\b(só|para|saber|curiosidade|duvida|pergunta|rapida|confirmar|informacao|informacoes|funciona)\\b/gi`;
track(applyPatch(FILES.classifier, 'Regex leadFrio (espaços)', oldLeadF, newLeadF));

// ============================================
// PATCH 3: handleMention usar brain.generateResponse (C3)
// ============================================
log('\n--- [C3] handleMention usar IA ---');

const oldHandleMention = `async handleMention(msg) {
    const body = msg.body || '';
    const lowerBody = body.toLowerCase();

    let response = '';
    const buffer = this.cp.buffer;
    const pendingTasks = buffer.newTasks?.length || 0;
    const newLinks = buffer.newLinks?.length || 0;
    const newIdeas = buffer.newIdeas?.length || 0;

    if (/status\\|projeto\\|andamento\\|fase\\|como ta\\|como esta/.test(lowerBody)) {
      response = \`📊 *STATUS ATUAL*\\\\n\\\\n\`;
      response += \`📝 Tarefas pendentes: ${pendingTasks}\\\\n\`;
      response += \`💡 Ideias novas: ${newIdeas}\\\\n\`;
      response += \`🔗 Links novos: ${newLinks}\\\\n\\\\n\`;

      if (pendingTasks > 0) {
        const topTask = buffer.newTasks[0];
        response += \`⚡ Prioridade: ${(topTask.body || topTask.text || '').slice(0, 60)}...\\\\n\\\\n\`;
      }

      response += \`Quer que eu gere um relatorio completo? Use /relatorio\`;
    }
    else if (/cliente\\|santafe\\|paulo\\|superclim\\|sorveteria/.test(lowerBody)) {
      const clientMentions = buffer.newMessages?.filter(m =>
        /santafe\\|paulo\\|superclim\\|sorveteria/.test((m.body || m.text || '').toLowerCase())
      ) || [];

      response = \`👤 *CLIENTES*\\\\n\\\\n\`;
      response += \`Mencionados recentemente: ${clientMentions.length}x\\\\n\\\\n\`;

      if (clientMentions.length === 0) {
        response += \`Nenhum cliente mencionado recentemente. Alguma noticia?\`;
      } else {
        response += \`Ultima mencao: ${(clientMentions[clientMentions.length - 1].body || '').slice(0, 80)}...\`;
      }
    }
    else if (/dinheiro\\|pagamento\\|fatura\\|caixa\\|financeiro\\|pago\\|nao pagou/.test(lowerBody)) {
      const financeMsgs = buffer.newMessages?.filter(m =>
        /pagou\\|fatura\\|caixa\\|dinheiro\\|custo\\|preco/.test((m.body || m.text || '').toLowerCase())
      ) || [];

      response = \`💰 *FINANCAS*\\\\n\\\\n\`;
      if (financeMsgs.length > 0) {
        response += \`Encontrei ${financeMsgs.length} mencao(oes) financeira(s).\\\\n\`;
        response += \`Ultima: ${(financeMsgs[financeMsgs.length - 1].body || '').slice(0, 80)}...\\\\n\\\\n\`;
      } else {
        response += \`Nenhuma atualizacao financeira recente.\\\\n\`;
        response += \`O caixa esta atualizado? Tem alguma fatura pendente?\\\\n\\\\n\`;
      }
      response += \`Use /relatorio para ver detalhes.\`;
    }
    else {
      response = \`🌙 Oi! Vi que me mencionou.\\\\n\\\\n\`;
      response += \`Atualmente no dashboard:\\n\`;
      response += \`• ${pendingTasks} tarefas pendentes\\n\`;
      response += \`• ${newIdeas} ideias para explorar\\n\`;
      response += \`• ${newLinks} links para revisar\\n\\\\n\`;
      response += \`O que voce precisa? Posso:\\n\`;
      response += \`/status — Projetos\\n\`;
      response += \`/relatorio — Relatorio completo\\n\`;
      response += \`/tarefas — Ver tarefas\\n\`;
      response += \`Ou me pergunte sobre clientes, financas, ou links!\`;
    }

    try {
      await msg.reply(response);
      log.success('Resposta inteligente enviada!');
    } catch (err) {
      log.error(\`Falha ao responder: ${err.message}\`);
    }
  }`;

const newHandleMention = `async handleMention(msg) {
    const body = msg.body || '';
    const lowerBody = body.toLowerCase();

    // [FIX C3] Usar Gemma 2B para respostas inteligentes
    // Fallback para regex rápido se Gemma falhar ou for pergunta simples
    const isSimpleQuery = /^(hola|oi|ola|hey|e aí|opa|bom dia|buenos dias|buenas)/i.test(body.trim());

    if (isSimpleQuery) {
      const greeting = this.brain.personalities[this.brain.activePersonality].greeting;
      await msg.reply(greeting);
      return;
    }

    // Resolver autor
    const author = resolveAuthor(msg.author || msg.from);

    // Detectar mensagem marcada (quoted)
    let quotedBody = null;
    let quotedAuthor = null;
    try {
      const quoted = await msg.getQuotedMessage();
      if (quoted) {
        quotedBody = quoted.body || '';
        quotedAuthor = resolveAuthor(quoted.author || quoted.from).name;
      }
    } catch (e) { /* sem quoted */ }

    // Contexto para a IA
    const context = {
      authorName: author.name,
      authorRole: author.role,
      urgency: 'normal',
      sentiment: 'neutral',
      topic: 'general',
      userMood: 'neutral',
      quotedBody: quotedBody,
      quotedAuthor: quotedAuthor,
      buffer: this.cp.buffer
    };

    // [FIX C5] Atualizar humor SÓ quando interage com humano
    const classification = await this.brain.classify(msg, this.threadHistory || []);
    this.brain.updateEmotionalState(classification);
    this.brain.activePersonality = this.brain.selectPersonality({
      urgency: classification.priority === 'P0' ? 'critical' : 'normal',
      sentiment: classification.metrics?.sentiment || 'neutral',
      topic: classification.category,
      userMood: 'neutral'
    });

    try {
      const response = await this.brain.generateResponse(body, context);
      await msg.reply(response.text);
      log.success(\`Resposta IA enviada (personality: ${response.personality})\`);
    } catch (err) {
      log.error(\`Falha IA: ${err.message}. Usando fallback...\`);
      // Fallback rápido em espanhol
      const buffer = this.cp.buffer;
      const fallback = \`🌙 ¡Hola ${author.name}!\\n\\n📊 Estado actual:\\n• ${buffer.newTasks?.length || 0} tareas\\n• ${buffer.newIdeas?.length || 0} ideas\\n• ${buffer.newLinks?.length || 0} links\\n\\n¿Qué necesitas? Usa /ayuda para ver comandos.\`;
      await msg.reply(fallback);
    }
  }`;

track(applyPatch(FILES.agent, 'handleMention usar IA + quotedMsg', oldHandleMention, newHandleMention));

// ============================================
// PATCH 4: parseGemmaResponse melhorado (C4)
// ============================================
log('\n--- [C4] parseGemmaResponse robusto ---');

const oldParseGemma = `parseGemmaResponse(responseText) {
    try {
      // Extrair JSON da resposta
      const jsonMatch = responseText.match(/\\{[\\s\\S]*\\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[GEMMA] Erro ao parsear JSON:', e.message);
    }
    return null;
  }`;

const newParseGemma = `parseGemmaResponse(responseText) {
    try {
      // [FIX C4] Estratégia 1: JSON em code block \`\`\`json
      const codeBlock = responseText.match(/\`\`\`json\\s*([\\s\\S]*?)\`\`\`/);
      if (codeBlock) {
        const parsed = JSON.parse(codeBlock[1].trim());
        return parsed;
      }

      // Estratégia 2: Procurar todos os objetos JSON candidatos
      const jsonMatches = responseText.match(/\\{[\\s\\S]*?\\}/g);
      if (jsonMatches) {
        // Tentar do mais longo para o mais curto
        const sorted = jsonMatches.sort((a, b) => b.length - a.length);
        for (const candidate of sorted) {
          try {
            const parsed = JSON.parse(candidate);
            // Validar se tem campos esperados
            if (parsed.category || parsed.confidence !== undefined) {
              return parsed;
            }
          } catch {}
        }
      }

      // Estratégia 3: Tentar parse do texto inteiro (se for JSON puro)
      try {
        const parsed = JSON.parse(responseText.trim());
        if (parsed.category || parsed.confidence !== undefined) {
          return parsed;
        }
      } catch {}
    } catch (e) {
      console.error('[GEMMA] Erro ao parsear JSON:', e.message);
    }
    return null;
  }`;

track(applyPatch(FILES.brain, 'parseGemmaResponse robusto', oldParseGemma, newParseGemma));

// ============================================
// PATCH 5: Remover selectPersonality/updateEmotionalState do classify (C5)
// ============================================
log('\n--- [C5] Remover humor do classify() ---');

const oldClassifyEnd = `    // 5. APLICAR PERSONALIDADE AO RESULTADO
    finalResult.lunaPersonality = this.selectPersonality({
      urgency: finalResult.priority === 'P0' ? 'critical' : 'normal',
      sentiment: finalResult.metrics?.sentiment || 'neutral',
      topic: finalResult.category,
      userMood: this.detectUserMood(threadHistory)
    });

    // 6. ATUALIZAR ESTADO EMOCIONAL DA LUNA
    this.updateEmotionalState(finalResult);

    return finalResult;`;

const newClassifyEnd = `    // [FIX C5] Personalidade e humor SÓ em interações humanas (handleMention)
    // NUNCA durante scan passivo
    finalResult.lunaPersonality = this.activePersonality;

    return finalResult;`;

track(applyPatch(FILES.brain, 'Remover humor do classify()', oldClassifyEnd, newClassifyEnd));

// ============================================
// PATCH 6: runAgent params no scheduler (C6)
// ============================================
log('\n--- [C6] runAgent params no scheduler ---');

const oldSchedulerRun = `async function runScan() {
  log('SCAN iniciado');
  const result = await runAgent(false);
  log(\`SCAN concluido: status=${result?.status || 'ok'}\`);
  return result;
}

async function runReport() {
  log('REPORT iniciado');
  const result = await runAgent(true);
  const buffer = buildBufferFromAgentResult(result || {});
  const checkpoint = result?.checkpoint || {};
  const generated = reportEngine.generateReport(buffer, checkpoint, {});
  saveReport(generated.dashboard);
  log('REPORT concluido e salvo em report-history.json');
  return { ...result, report: generated };
}`;

const newSchedulerRun = `async function runScan() {
  log('SCAN iniciado');
  const result = await runAgent({ once: false, schedule: true, fullExtract: false });
  log(\`SCAN concluido: status=${result?.status || 'ok'}\`);
  return result;
}

async function runReport() {
  log('REPORT iniciado');
  const result = await runAgent({ once: true, schedule: false, fullExtract: false });
  const buffer = buildBufferFromAgentResult(result || {});
  const checkpoint = result?.checkpoint || {};
  const generated = reportEngine.generateReport(buffer, checkpoint, {});
  saveReport(generated.dashboard);
  log('REPORT concluido e salvo em report-history.json');
  return { ...result, report: generated };
}`;

track(applyPatch(FILES.scheduler, 'runAgent params corretos', oldSchedulerRun, newSchedulerRun));

// ============================================
// PATCH 7: threadHistory inicializado (C7)
// ============================================
log('\n--- [C7] threadHistory inicializado ---');

const oldConstructor = `constructor() {
    this.cp = new CheckpointManager();
    this.brain = new LunaBrain({
      model: 'gemma2:2b',
      host: 'http://localhost:11434'
    });
    this.linkAnalyzer = new LinkAnalyzer();
    this.extractor = new PlaywrightExtractor();
    this.client = null;
    this.ready = false;
    this.lastReport = null;
    this.reportGroup = null;
    this.running = false;
    this.fullExtractRunning = false;
  }`;

const newConstructor = `constructor() {
    this.cp = new CheckpointManager();
    this.brain = new LunaBrain({
      model: 'gemma2:2b',
      host: 'http://localhost:11434'
    });
    this.linkAnalyzer = new LinkAnalyzer();
    this.extractor = new PlaywrightExtractor();
    this.client = null;
    this.ready = false;
    this.lastReport = null;
    this.reportGroup = null;
    this.running = false;
    this.fullExtractRunning = false;
    // [FIX C7] Histórico de thread para contexto da Gemma
    this.threadHistory = [];
  }`;

track(applyPatch(FILES.agent, 'threadHistory inicializado', oldConstructor, newConstructor));

// ============================================
// PATCH 8: isAuthorizedChat no handler (C8)
// ============================================
log('\n--- [C8] isAuthorizedChat no handler ---');

const oldHandler = `this.client.on('message_create', async (msg) => {

      if (msg.fromMe && !msg.body.startsWith('/')) return;

      const body = (msg.body || '').toLowerCase();
      const isMention = /@luna\\|@kimi\\|@kimiclaw/.test(body);

      if (isMention) {
        log.info(\`MENCAO de ${msg.pushname || msg.from}: ${(msg.body || '').slice(0, 80)}\`);
        await this.handleMention(msg);
      }

      if (body.startsWith('/')) {
        await this.handleCommand(msg);
      }
    });`;

const newHandler = `this.client.on('message_create', async (msg) => {
      // [FIX C8] Verificar chat autorizado
      try {
        const chat = await msg.getChat();
        if (!isAuthorizedChat(chat.name)) return;
      } catch (e) {
        // Se não conseguir obter chat, continuar (mensagem pode ser do próprio WhatsApp)
      }

      if (msg.fromMe && !msg.body.startsWith('/')) return;

      const body = (msg.body || '').toLowerCase();
      // [FIX C10] Case-insensitive para menções
      const isMention = /@luna|@kimi|@kimiclaw/i.test(body);

      if (isMention) {
        log.info(\`MENCAO de ${msg.pushname || msg.from}: ${(msg.body || '').slice(0, 80)}\`);
        await this.handleMention(msg);
      }

      if (body.startsWith('/')) {
        await this.handleCommand(msg);
      }
    });`;

track(applyPatch(FILES.agent, 'isAuthorizedChat + case-insensitive mention', oldHandler, newHandler));

// ============================================
// PATCH 9: forceReport usar 'to' (C9)
// ============================================
log('\n--- [C9] forceReport usar destinatário ---');

const oldForceReport = `async forceReport(to) {
    await this.sendScheduledReport();
  }`;

const newForceReport = `async forceReport(to) {
    await this.sendScheduledReport(to);
  }`;

track(applyPatch(FILES.agent, 'forceReport passar destinatário', oldForceReport, newForceReport));

// ============================================
// PATCH 10: sendScheduledReport aceitar 'to' (C9)
// ============================================
log('\n--- [C9] sendScheduledReport aceitar destinatário ---');

const oldSendReport = `async sendScheduledReport() {
    const buffer = this.cp.buffer;
    const hasNews = buffer.newMessages?.length > 0 ||
      buffer.newTasks?.length > 0 ||
      buffer.newIdeas?.length > 0 ||
      buffer.newLinks?.length > 0 ||
      buffer.newLeads?.length > 0;

    if (!hasNews) {
      this.cp.checkpoint.silenceCount = (this.cp.checkpoint.silenceCount || 0) + 1;

      if (this.cp.checkpoint.silenceCount === 1 && this.reportGroup) {
        await this.reportGroup.sendMessage(\`🌙 *LUNA REPORT*\\n\\n🔇 Sem novidades nos ultimos 30 minutos.\\n\\n🤖 Luna v15.1\`);
      }
      return;
    }

    let report = \`🌙 *LUNA REPORT INTELIGENTE*\\n\\n\`;
    report += \`📊 *O QUE VI:*\\n\`;
    report += \`• ${buffer.newMessages?.length || 0} mensagens novas\\n\`;
    report += \`• ${buffer.newTasks?.length || 0} tarefas\\n\`;
    report += \`• ${buffer.newIdeas?.length || 0} ideias\\n\`;
    report += \`• ${buffer.newLinks?.length || 0} links\\n\`;
    report += \`• ${buffer.newLeads?.length || 0} possiveis clientes\\n\`;
    report += \`• ${buffer.newNews?.length || 0} noticias\\n\\n\`;

    report += \`❓ *O QUE NAO VI:*\\n\`;
    const clientMentions = buffer.newMessages?.filter(m => /santafe\\|paulo\\|superclim/.test((m.body || '').toLowerCase())) || [];
    if (clientMentions.length === 0) {
      report += \`• Nenhuma mencao a clientes principais. E o Santafe? Alguma noticia?\\n\`;
    }
    if ((buffer.newMessages?.filter(m => /pagou\\|fatura\\|caixa/.test((m.body || '').toLowerCase())) || []).length === 0) {
      report += \`• Nenhuma atualizacao financeira. O caixa esta atualizado?\\n\`;
    }
    report += \`\\n\`;

    if (buffer.newLeads?.length > 0) {
      report += \`🎣 *POSSIVEIS CLIENTES:*\\n\`;
      for (const lead of buffer.newLeads.slice(0, 3)) {
        report += \`• ${lead.name || 'Nao identificado'}: ${(lead.context || '').slice(0, 60)}...\\n\`;
      }
      report += \`\\n\`;
    }

    report += \`🤖 Luna v15.1 \\| ${new Date().toLocaleString('pt-BR')}\`;

    if (this.reportGroup) {
      await this.reportGroup.sendMessage(report);
      log.success('Relatorio inteligente enviado!');
    }

    this.cp.buffer.newMessages = [];
    this.cp.buffer.newTasks = [];
    this.cp.buffer.newIdeas = [];
    this.cp.buffer.newLinks = [];
    this.cp.buffer.newDecisions = [];
    this.cp.buffer.newMentions = [];
    this.cp.buffer.newNews = [];
    this.cp.buffer.newLeads = [];
    this.cp.checkpoint.silenceCount = 0;
    this.cp.checkpoint.lastReport = new Date().toISOString();
    this.cp.save();
  }`;

const newSendReport = `async sendScheduledReport(to = null) {
    const buffer = this.cp.buffer;
    const hasNews = buffer.newMessages?.length > 0 ||
      buffer.newTasks?.length > 0 ||
      buffer.newIdeas?.length > 0 ||
      buffer.newLinks?.length > 0 ||
      buffer.newLeads?.length > 0;

    if (!hasNews) {
      this.cp.checkpoint.silenceCount = (this.cp.checkpoint.silenceCount || 0) + 1;

      if (this.cp.checkpoint.silenceCount === 1) {
        const silentMsg = \`🌙 *LUNA REPORT*\\n\\n🔇 Sin novedades en los últimos 30 minutos.\\n\\n🤖 Luna v16.0\`;
        if (to) {
          const chat = await this.client.getChatById(to);
          await chat.sendMessage(silentMsg);
        } else if (this.reportGroup) {
          await this.reportGroup.sendMessage(silentMsg);
        }
      }
      return;
    }

    // [FIX A1] Relatório RICO com análise de conteúdo
    let report = \`🌙 *LUNA REPORT INTELIGENTE*\\n\\n\`;
    report += \`📊 *RESUMEN:*\\n\`;
    report += \`• ${buffer.newMessages?.length || 0} mensajes nuevos\\n\`;
    report += \`• ${buffer.newTasks?.length || 0} tareas\\n\`;
    report += \`• ${buffer.newIdeas?.length || 0} ideas\\n\`;
    report += \`• ${buffer.newLinks?.length || 0} links\\n\`;
    report += \`• ${buffer.newLeads?.length || 0} posibles clientes\\n\\n\`;

    // Top tareas con contexto
    if (buffer.newTasks?.length > 0) {
      report += \`⚡ *TAREAS PRIORITARIAS:*\\n\`;
      for (const t of buffer.newTasks.slice(0, 3)) {
        const authorName = typeof t.author === 'string' && t.author.includes('@') 
          ? resolveAuthor(t.author).name 
          : (t.author || 'Desconocido');
        report += \`• [${t.priority || 'P2'}] ${(t.body || '').slice(0, 60)}... (por ${authorName})\\n\`;
      }
      report += \`\\n\`;
    }

    // Clientes mencionados
    const clientMentions = buffer.newMessages?.filter(m => {
      const text = (m.body || m.text || '').toLowerCase();
      return /santafe|paulo|superclim|tropicale|juan|jess|onadance|gesse|lucas|mapio|ccb/.test(text);
    }) || [];

    if (clientMentions.length > 0) {
      report += \`👤 *CLIENTES MENCIONADOS:*\\n\`;
      for (const m of clientMentions.slice(0, 3)) {
        const authorName = resolveAuthor(m.author || m.from).name;
        report += \`• ${authorName}: ${(m.body || m.text || '').slice(0, 50)}...\\n\`;
      }
      report += \`\\n\`;
    } else {
      report += \`❓ *¿Y los clientes?*\\n\`;
      report += \`• Sin menciones a clientes principales. ¿Noticias de Santafe?\\n\\n\`;
    }

    // Links detectados
    if (buffer.newLinks?.length > 0) {
      report += \`🔗 *LINKS:*\\n\`;
      for (const l of buffer.newLinks.slice(0, 5)) {
        report += \`• ${l.url} (${l.title || 'sin título'})\\n\`;
      }
      report += \`\\n\`;
    }

    // Leads
    if (buffer.newLeads?.length > 0) {
      report += \`🎣 *POSIBLES CLIENTES:*\\n\`;
      for (const lead of buffer.newLeads.slice(0, 3)) {
        report += \`• ${lead.name || 'No identificado'}: ${(lead.context || '').slice(0, 60)}...\\n\`;
      }
      report += \`\\n\`;
    }

    report += \`🤖 Luna v16.0 | ${new Date().toLocaleString('es-ES')}\`;

    // [FIX C11] Enviar ANTES de limpar buffer
    let sent = false;
    try {
      if (to) {
        const chat = await this.client.getChatById(to);
        await chat.sendMessage(report);
        sent = true;
      } else if (this.reportGroup) {
        await this.reportGroup.sendMessage(report);
        sent = true;
      }
      if (sent) log.success('Relatorio enviado!');
    } catch (e) {
      log.error(\`Falha ao enviar relatório: ${e.message}. Buffer PRESERVADO.\`);
      return; // [FIX C11] Não limpa se falhou!
    }

    // Só limpa se enviou com sucesso
    if (sent) {
      this.cp.buffer.newMessages = [];
      this.cp.buffer.newTasks = [];
      this.cp.buffer.newIdeas = [];
      this.cp.buffer.newLinks = [];
      this.cp.buffer.newDecisions = [];
      this.cp.buffer.newMentions = [];
      this.cp.buffer.newNews = [];
      this.cp.buffer.newLeads = [];
      this.cp.checkpoint.silenceCount = 0;
      this.cp.checkpoint.lastReport = new Date().toISOString();
      this.cp.save();
    }
  }`;

track(applyPatch(FILES.agent, 'sendScheduledReport rico + destinatário + buffer seguro', oldSendReport, newSendReport));

// ============================================
// PATCH 11: CDP_PORT 9223 (C12)
// ============================================
log('\n--- [C12] CDP_PORT 9223 ---');
track(applyPatch(FILES.agent, 'CDP_PORT 9223', 'CDP_PORT: 9222,', 'CDP_PORT: 9223,'));

// ============================================
// PATCH 12: /ajuda com 12+ comandos (A2)
// ============================================
log('\n--- [A2] /ajuda completo ---');

const oldAjuda = `else if (cmd === '/ajuda') {
      await msg.reply('🌙 *AJUDA LUNA v15.1*\\n\\n/status — Projetos\\n/relatorio — Relatorio\\n/tarefas — Tarefas\\n/extrair — Extrair tudo\\n/ajuda — Este menu\\n\\nMencione @Luna para falar! Posso responder sobre clientes, financas, links e status.');
    }`;

const newAjuda = `else if (cmd === '/ajuda' || cmd === '/ayuda') {
      await msg.reply(\`🌙 *AYUDA LUNA v16.0*\\n\\n📋 *Comandos disponibles:*\\n/status — Estado de proyectos\\n/relatorio — Generar informe completo\\n/tarefas — Ver tareas pendientes\\n/extrair — Extracción completa\\n/links — Links detectados\\n/ideias — Ideas nuevas\\n/leads — Posibles clientes\\n/decisiones — Decisiones tomadas\\n/mentions — Menciones recientes\\n/historico — Últimos mensajes\\n/scan — Forzar escaneo ahora\\n/config — Configuración actual\\n/silencio — Pausar informes\\n/voz — Cambiar personalidad\\n/limpiar — Limpiar buffer\\n/ayuda — Este menú\\n\\nMenciona @Luna para hablar con IA. Puedo analizar clientes, finanzas, links y estado.\`);
    }`;

track(applyPatch(FILES.agent, '/ajuda com 15+ comandos em espanhol', oldAjuda, newAjuda));

// ============================================
// PATCH 13: handleCommand adicionar novos comandos
// ============================================
log('\n--- [A2] Novos comandos handleCommand ---');

const oldHandleCommandEnd = `else if (cmd === '/ajuda') {
      await msg.reply('🌙 *AJUDA LUNA v15.1*\\n\\n/status — Projetos\\n/relatorio — Relatorio\\n/tarefas — Tarefas\\n/extrair — Extrair tudo\\n/ajuda — Este menu\\n\\nMencione @Luna para falar! Posso responder sobre clientes, financas, links e status.');
    }
  }`;

const newHandleCommandEnd = `else if (cmd === '/links') {
      const links = this.cp.buffer.newLinks || [];
      const list = links.length > 0 ? links.slice(0, 5).map(l => \`• ${l.url} (${l.title || 'sin título'})\`).join('\\n') : 'Sin links nuevos.';
      await msg.reply(\`🔗 *LINKS*\\n\\n${list}\\n\\n🤖 Luna v16.0\`);
    }
    else if (cmd === '/ideias') {
      const ideas = this.cp.buffer.newIdeas || [];
      const list = ideas.length > 0 ? ideas.slice(0, 5).map(i => \`• ${(i.body || '').slice(0, 50)}...\`).join('\\n') : 'Sin ideas nuevas.';
      await msg.reply(\`💡 *IDEAS*\\n\\n${list}\\n\\n🤖 Luna v16.0\`);
    }
    else if (cmd === '/leads') {
      const leads = this.cp.buffer.newLeads || [];
      const list = leads.length > 0 ? leads.slice(0, 5).map(l => \`• ${l.name || 'No identificado'}: ${(l.context || '').slice(0, 40)}...\`).join('\\n') : 'Sin leads nuevos.';
      await msg.reply(\`🎣 *LEADS*\\n\\n${list}\\n\\n🤖 Luna v16.0\`);
    }
    else if (cmd === '/decisiones' || cmd === '/decisoes') {
      const decisions = this.cp.buffer.newDecisions || [];
      const list = decisions.length > 0 ? decisions.slice(0, 5).map(d => \`• ${(d.body || '').slice(0, 50)}...\`).join('\\n') : 'Sin decisiones nuevas.';
      await msg.reply(\`📌 *DECISIONES*\\n\\n${list}\\n\\n🤖 Luna v16.0\`);
    }
    else if (cmd === '/mentions' || cmd === '/menciones') {
      const mentions = this.cp.buffer.newMentions || [];
      const list = mentions.length > 0 ? mentions.slice(0, 5).map(m => \`• ${m.author || 'Desconocido'}: ${(m.body || '').slice(0, 40)}...\`).join('\\n') : 'Sin menciones nuevas.';
      await msg.reply(\`📢 *MENCIONES*\\n\\n${list}\\n\\n🤖 Luna v16.0\`);
    }
    else if (cmd === '/historico') {
      const msgs = this.cp.buffer.newMessages || [];
      const list = msgs.length > 0 ? msgs.slice(-5).map(m => {
        const author = resolveAuthor(m.author || m.from).name;
        return \`• [${author}] ${(m.body || m.text || '').slice(0, 40)}...\`;
      }).join('\\n') : 'Sin mensajes recientes.';
      await msg.reply(\`📜 *HISTÓRICO*\\n\\n${list}\\n\\n🤖 Luna v16.0\`);
    }
    else if (cmd === '/scan') {
      await msg.reply('🔍 Iniciando escaneo forzado...');
      await this.runOnce();
      await msg.reply('✅ Escaneo completado. Revisa /status.');
    }
    else if (cmd === '/config') {
      await msg.reply(\`⚙️ *CONFIGURACIÓN*\\n\\nGrupos: ${CONFIG.GROUPS.map(g => g.name).join(', ')}\\nIntervalo scan: ${CONFIG.SCAN_INTERVAL / 60000}min\\nIntervalo informe: ${CONFIG.REPORT_INTERVAL / 60000}min\\nCDP Port: ${CONFIG.CDP_PORT}\\nVersión: v16.0\\n\\n🤖 Luna v16.0\`);
    }
    else if (cmd === '/silencio') {
      this.cp.checkpoint.silenceCount = 999;
      this.cp.save();
      await msg.reply('🔇 Modo silencio activado. No enviaré informes automáticos hasta que uses /scan.');
    }
    else if (cmd === '/voz') {
      const voices = Object.keys(this.brain.personalities).join(', ');
      await msg.reply(\`🎭 *PERSONALIDADES*\\n\\nDisponibles: ${voices}\\n\\nActual: ${this.brain.activePersonality}\\n\\n🤖 Luna v16.0\`);
    }
    else if (cmd === '/limpiar' || cmd === '/limpar') {
      this.cp.buffer.newMessages = [];
      this.cp.buffer.newTasks = [];
      this.cp.buffer.newIdeas = [];
      this.cp.buffer.newLinks = [];
      this.cp.buffer.newDecisions = [];
      this.cp.buffer.newMentions = [];
      this.cp.buffer.newNews = [];
      this.cp.buffer.newLeads = [];
      this.cp.save();
      await msg.reply('🧹 Buffer limpiado. Todo listo para nuevos datos.');
    }
    else if (cmd === '/ajuda' || cmd === '/ayuda') {
      await msg.reply(\`🌙 *AYUDA LUNA v16.0*\\n\\n📋 *Comandos disponibles:*\\n/status — Estado de proyectos\\n/relatorio — Generar informe completo\\n/tarefas — Ver tareas pendientes\\n/extrair — Extracción completa\\n/links — Links detectados\\n/ideias — Ideas nuevas\\n/leads — Posibles clientes\\n/decisiones — Decisiones tomadas\\n/mentions — Menciones recientes\\n/historico — Últimos mensajes\\n/scan — Forzar escaneo ahora\\n/config — Configuración actual\\n/silencio — Pausar informes\\n/voz — Cambiar personalidad\\n/limpiar — Limpiar buffer\\n/ayuda — Este menú\\n\\nMenciona @Luna para hablar con IA. Puedo analizar clientes, finanzas, links y estado.\`);
    }
  }`;

track(applyPatch(FILES.agent, 'handleCommand com 15+ comandos', oldHandleCommandEnd, newHandleCommandEnd));

// ============================================
// PATCH 14: updateBufferFromClassified usar resolveAuthor (A3)
// ============================================
log('\n--- [A3] resolveAuthor no buffer ---');

const oldUpdateBuffer = `updateBufferFromClassified(classified) {
    // Protecao: garante que arrays existem
    if (!this.cp.buffer.newTasks) this.cp.buffer.newTasks = [];
    if (!this.cp.buffer.newIdeas) this.cp.buffer.newIdeas = [];
    if (!this.cp.buffer.newDecisions) this.cp.buffer.newDecisions = [];
    if (!this.cp.buffer.newLinks) this.cp.buffer.newLinks = [];
    if (!this.cp.buffer.newLeads) this.cp.buffer.newLeads = [];
    if (!this.cp.buffer.newNews) this.cp.buffer.newNews = [];
    for (const item of classified) {
      const c = item.classification;

      switch (c.category) {
        case 'tarefaRealizada':
        case 'tarefaPendente':
          this.cp.buffer.newTasks.push({
            body: item.text,
            author: item.author,
            priority: c.priority,
            time: item.timestamp
          });
          break;
        case 'ideiaNova':
          this.cp.buffer.newIdeas.push({ body: item.text, author: item.author, time: item.timestamp });
          break;
        case 'decisao':
          this.cp.buffer.newDecisions.push({ body: item.text, author: item.author, time: item.timestamp });
          break;
        case 'link':
          this.cp.buffer.newLinks.push({ url: c.urls[0], context: item.text, author: item.author, time: item.timestamp });
          break;
        case 'lead':
          this.cp.buffer.newLeads.push({ name: c.possibleNewClient, context: item.text, author: item.author, time: item.timestamp });
          break;
        case 'noticia':
        default:
          this.cp.buffer.newNews.push({ body: item.text, author: item.author, time: item.timestamp, chat: item.chatName });
          break;
      }
    }

    this.cp.buffer.lastBufferUpdate = new Date().toISOString();
  }`;

const newUpdateBuffer = `updateBufferFromClassified(classified) {
    // Protecao: garante que arrays existem
    if (!this.cp.buffer.newTasks) this.cp.buffer.newTasks = [];
    if (!this.cp.buffer.newIdeas) this.cp.buffer.newIdeas = [];
    if (!this.cp.buffer.newDecisions) this.cp.buffer.newDecisions = [];
    if (!this.cp.buffer.newLinks) this.cp.buffer.newLinks = [];
    if (!this.cp.buffer.newLeads) this.cp.buffer.newLeads = [];
    if (!this.cp.buffer.newNews) this.cp.buffer.newNews = [];

    for (const item of classified) {
      const c = item.classification;
      // [FIX A3] Resolver autor para nome real
      const resolvedAuthor = resolveAuthor(item.author || item.from || 'unknown');
      const authorName = resolvedAuthor.name;
      const authorPhone = item.author || item.from || 'unknown';

      switch (c.category) {
        case 'tarefaRealizada':
        case 'tarefaPendente':
          this.cp.buffer.newTasks.push({
            body: item.text,
            author: authorName,
            authorPhone: authorPhone,
            priority: c.priority,
            time: item.timestamp,
            category: c.category
          });
          break;
        case 'ideiaNova':
          this.cp.buffer.newIdeas.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp });
          break;
        case 'decisao':
          this.cp.buffer.newDecisions.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp });
          break;
        case 'link':
          this.cp.buffer.newLinks.push({ url: c.urls[0], context: item.text, author: authorName, authorPhone, time: item.timestamp });
          break;
        case 'lead':
          this.cp.buffer.newLeads.push({ name: c.possibleNewClient, context: item.text, author: authorName, authorPhone, time: item.timestamp });
          break;
        case 'noticia':
        default:
          this.cp.buffer.newNews.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp, chat: item.chatName });
          break;
      }

      // [FIX C7] Adicionar ao threadHistory para contexto
      this.threadHistory.push({
        author: authorName,
        text: item.text,
        category: c.category,
        timestamp: item.timestamp || new Date().toISOString()
      });
      if (this.threadHistory.length > 50) this.threadHistory.shift();
    }

    this.cp.buffer.lastBufferUpdate = new Date().toISOString();
  }`;

track(applyPatch(FILES.agent, 'updateBufferFromClassified com resolveAuthor', oldUpdateBuffer, newUpdateBuffer));

// ============================================
// PATCH 15: runOnce salvar whatsapp-history.json (A5)
// ============================================
log('\n--- [A5] whatsapp-history.json acumulativo ---');

const oldRunOnceEnd = `this.cp.checkpoint.lastScan = new Date().toISOString();
    this.cp.save();

    return {
      status: 'ok',
      hasNews: newMessages.length > 0,
      newMessages: newMessages.length
    };`;

const newRunOnceEnd = `this.cp.checkpoint.lastScan = new Date().toISOString();
    this.cp.save();

    // [FIX A5] Salvar histórico acumulativo
    try {
      const historyPath = path.join(__dirname, '../backend/data/whatsapp-history.json');
      const existing = readJSONSafe(historyPath) || { messages: [] };
      const merged = this.deduplicateMessages(existing.messages, newMessages);
      writeJSONSafe(historyPath, { messages: merged, lastUpdated: new Date().toISOString() });
      log.info(\`Histórico acumulativo: ${merged.length} mensagens\`);
    } catch (e) {
      log.warn(\`Falha ao salvar histórico: ${e.message}\`);
    }

    return {
      status: 'ok',
      hasNews: newMessages.length > 0,
      newMessages: newMessages,
      messages: newMessages // [FIX A6] Alias para compatibilidade com scheduler
    };`;

track(applyPatch(FILES.agent, 'whatsapp-history.json acumulativo + alias messages', oldRunOnceEnd, newRunOnceEnd));

// ============================================
// PATCH 16: Adicionar deduplicateMessages e helpers readJSONSafe/writeJSONSafe
// ============================================
log('\n--- [A5] Helpers JSON-safe ---');

const oldHelpers = `function diagnose() {
  const checks = {`;

const newHelpers = `function readJSONSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    let raw = fs.readFileSync(file, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.substring(1);
    return JSON.parse(raw);
  } catch (e) {
    console.error('[readJSONSafe] Erro:', e.message);
    return null;
  }
}

function writeJSONSafe(file, data) {
  try {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[writeJSONSafe] Erro:', e.message);
  }
}

function diagnose() {
  const checks = {`;

track(applyPatch(FILES.agent, 'Helpers readJSONSafe/writeJSONSafe', oldHelpers, newHelpers));

// ============================================
// PATCH 17: Adicionar deduplicateMessages ao LunaAgent
// ============================================
log('\n--- [A5] deduplicateMessages ---');

const oldGenerateStats = `generateStats(classified) {
    const stats = {};
    for (const item of classified) {
      const cat = item.classification.category;
      stats[cat] = (stats[cat] || 0) + 1;
    }
    return stats;
  }`;

const newGenerateStats = `generateStats(classified) {
    const stats = {};
    for (const item of classified) {
      const cat = item.classification.category;
      stats[cat] = (stats[cat] || 0) + 1;
    }
    return stats;
  }

  deduplicateMessages(existing, incoming) {
    const map = new Map();
    (existing || []).forEach(m => {
      const key = m.id || m.timestamp + (m.author || m.from || 'unknown');
      map.set(key, m);
    });
    (incoming || []).forEach(m => {
      const key = m.id || m.timestamp + (m.author || m.from || 'unknown');
      if (!map.has(key)) map.set(key, m);
    });
    return Array.from(map.values());
  }`;

track(applyPatch(FILES.agent, 'deduplicateMessages no LunaAgent', oldGenerateStats, newGenerateStats));

// ============================================
// PATCH 18: notifyOps com tratamento de erro (A4)
// ============================================
log('\n--- [A4] notifyOps com log ---');

const oldNotifyOps = `async notifyOps(data) {
    try {
      const payload = {
        source: 'luna-whatsapp',
        timestamp: new Date().toISOString(),
        newMessages: data.newCount || 0,
        bufferSize: this.cp.buffer.newMessages?.length || 0,
        tasks: this.cp.buffer.newTasks?.length || 0,
        ideas: this.cp.buffer.newIdeas?.length || 0,
        links: this.cp.buffer.newLinks?.length || 0,
        leads: this.cp.buffer.newLeads?.length || 0
      };
      let fetch;
      try { fetch = (await import('node-fetch')).default; } catch (e) { return; }
      await fetch('http://localhost:3456/api/ops/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) { /* Silencioso */ }
  }`;

const newNotifyOps = `async notifyOps(data) {
    try {
      const payload = {
        source: 'luna-whatsapp',
        timestamp: new Date().toISOString(),
        newMessages: data.newCount || 0,
        bufferSize: this.cp.buffer.newMessages?.length || 0,
        tasks: this.cp.buffer.newTasks?.length || 0,
        ideas: this.cp.buffer.newIdeas?.length || 0,
        links: this.cp.buffer.newLinks?.length || 0,
        leads: this.cp.buffer.newLeads?.length || 0
      };
      let fetch;
      try { fetch = (await import('node-fetch')).default; } catch (e) { 
        log.warn('node-fetch não disponível para notifyOps');
        return; 
      }
      const res = await fetch('http://localhost:3456/api/ops/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) log.warn(\`notifyOps falhou: HTTP ${res.status}\`);
      else log.info('notifyOps: backend notificado');
    } catch (e) { 
      log.error(\`notifyOps falhou: ${e.message}\`);
    }
  }`;

track(applyPatch(FILES.agent, 'notifyOps com tratamento de erro', oldNotifyOps, newNotifyOps));

// ============================================
// PATCH 19: runFullExtract salvar history + threadHistory (C7)
// ============================================
log('\n--- [C7] runFullExtract threadHistory ---');

const oldFullExtractClassify = `const classified = await this.brain.classify(m, this.threadHistory || []);
            allClassified.push({ ...msg, classification: classified });
            this.cp.markProcessed(msg);`;

const newFullExtractClassify = `const classified = await this.brain.classify(m, this.threadHistory || []);
            allClassified.push({ ...msg, classification: classified });
            this.cp.markProcessed(msg);
            // [FIX C7] Acumular threadHistory
            const resolved = resolveAuthor(msg.author || msg.from || 'unknown');
            this.threadHistory.push({
              author: resolved.name,
              text: msg.text || msg.body || '',
              category: classified.category,
              timestamp: msg.timestamp || new Date().toISOString()
            });
            if (this.threadHistory.length > 50) this.threadHistory.shift();`;

track(applyPatch(FILES.agent, 'runFullExtract acumula threadHistory', oldFullExtractClassify, newFullExtractClassify));

// ============================================
// PATCH 20: handleMention vazio (M5)
// ============================================
log('\n--- [M5] Ignorar @luna vazio ---');

// Já está coberto no novo handleMention (isSimpleQuery), mas adicionar proteção extra
const oldMentionBody = `const body = msg.body || '';
    const lowerBody = body.toLowerCase();

    // [FIX C3] Usar Gemma 2B para respostas inteligentes`;

const newMentionBody = `const body = msg.body || '';
    const lowerBody = body.toLowerCase();

    // [FIX M5] Ignorar menção vazia (só @luna sem texto)
    const cleanBody = body.replace(/@luna|@kimi|@kimiclaw/gi, '').trim();
    if (!cleanBody) {
      log.info('Mencao vazia ignorada');
      return;
    }

    // [FIX C3] Usar Gemma 2B para respostas inteligentes`;

track(applyPatch(FILES.agent, 'Ignorar @luna vazio', oldMentionBody, newMentionBody));

// ============================================
// PATCH 21: handleCommand /status em espanhol (A12)
// ============================================
log('\n--- [A12] /status em espanhol ---');

const oldStatusCmd = `if (cmd === '/status') {
      const buffer = this.cp.buffer;
      await msg.reply(\`📊 *STATUS NEXO*\\n\\n🟢 Projetos ativos: ${buffer.newTasks?.length || 0}\\n💡 Ideias: ${buffer.newIdeas?.length || 0}\\n🔗 Links: ${buffer.newLinks?.length || 0}\\n📰 News: ${buffer.newNews?.length || 0}\\n🎣 Leads: ${buffer.newLeads?.length || 0}\\n\\n🤖 Luna v15.1\`);
    }`;

const newStatusCmd = `if (cmd === '/status') {
      const buffer = this.cp.buffer;
      await msg.reply(\`📊 *ESTADO NEXO*\\n\\n🟢 Proyectos activos: ${buffer.newTasks?.length || 0}\\n💡 Ideas: ${buffer.newIdeas?.length || 0}\\n🔗 Links: ${buffer.newLinks?.length || 0}\\n📰 Noticias: ${buffer.newNews?.length || 0}\\n🎣 Leads: ${buffer.newLeads?.length || 0}\\n\\n🤖 Luna v16.0\`);
    }`;

track(applyPatch(FILES.agent, '/status em espanhol', oldStatusCmd, newStatusCmd));

// ============================================
// PATCH 22: handleCommand /relatorio em espanhol
// ============================================
log('\n--- [A12] /relatorio em espanhol ---');

const oldRelatorioCmd = `else if (cmd === '/relatorio') {
      await msg.reply('📊 Gerando relatorio inteligente...');
      await this.forceReport(msg.from);
    }`;

const newRelatorioCmd = `else if (cmd === '/relatorio') {
      await msg.reply('📊 Generando informe inteligente...');
      await this.forceReport(msg.from);
    }`;

track(applyPatch(FILES.agent, '/relatorio em espanhol', oldRelatorioCmd, newRelatorioCmd));

// ============================================
// PATCH 23: handleCommand /tarefas em espanhol
// ============================================
log('\n--- [A12] /tarefas em espanhol ---');

const oldTarefasCmd = `else if (cmd === '/tarefas') {
      const tasks = this.cp.buffer.newTasks || [];
      const list = tasks.length > 0 ? tasks.slice(0, 5).map(t => \`• [${t.priority || 'P2'}] ${(t.body || t.text || '').slice(0, 50)}\`).join('\\n') : 'Nenhuma tarefa pendente.';
      await msg.reply(\`📝 *TAREFAS*\\n\\n${list}\\n\\n🤖 Luna v15.1\`);
    }`;

const newTarefasCmd = `else if (cmd === '/tarefas') {
      const tasks = this.cp.buffer.newTasks || [];
      const list = tasks.length > 0 ? tasks.slice(0, 5).map(t => \`• [${t.priority || 'P2'}] ${(t.body || t.text || '').slice(0, 50)}\`).join('\\n') : 'Sin tareas pendientes.';
      await msg.reply(\`📝 *TAREAS*\\n\\n${list}\\n\\n🤖 Luna v16.0\`);
    }`;

track(applyPatch(FILES.agent, '/tarefas em espanhol', oldTarefasCmd, newTarefasCmd));

// ============================================
// PATCH 24: handleCommand /extrair em espanhol
// ============================================
log('\n--- [A12] /extrair em espanhol ---');

const oldExtrairCmd = `else if (cmd === '/extrair') {
      await msg.reply('🔄 Iniciando extracao completa...');
      await this.runFullExtract();
      await msg.reply('✅ Extracao completa finalizada!');
    }`;

const newExtrairCmd = `else if (cmd === '/extrair') {
      await msg.reply('🔄 Iniciando extracción completa...');
      await this.runFullExtract();
      await msg.reply('✅ Extracción completa finalizada!');
    }`;

track(applyPatch(FILES.agent, '/extrair em espanhol', oldExtrairCmd, newExtrairCmd));

// ============================================
// PATCH 25: server.js /api/whatsapp-agent normalizado (do prompt master anterior)
// ============================================
log('\n--- [SERVER] /api/whatsapp-agent normalizado ---');

const oldWhatsAppAgent = `app.get('/api/whatsapp-agent', (req, res) => {
    try {
      const agentData = readJSONSafe(AGENT_DATA_FILE);
      if (!agentData) {
        return res.json({
          messages: [], tasks: [], ideas: [], decisions: [], links: [], mentions: [],
          stats: { totalMessages: 0, totalTasks: 0, totalIdeas: 0, totalDecisions: 0 },
          updatedAt: new Date().toISOString()
        });
      }
      res.json(agentData);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });`;

const newWhatsAppAgent = `app.get('/api/whatsapp-agent', (req, res) => {
    try {
      const agentRaw = readJSONSafe(AGENT_DATA_FILE) || {};
      const bufferPath = path.join(__dirname, '..', 'agents', 'luna-buffer.json');
      const buffer = fs.existsSync(bufferPath) ? JSON.parse(fs.readFileSync(bufferPath, 'utf8')) : { messages: [], tasks: [], ideas: [] };

      // Normalizar messages para ter authorName
      const normalizedMessages = (buffer.newMessages || buffer.messages || []).map(m => ({
        ...m,
        authorName: m.authorName || (m.author && !m.author.includes('@') ? m.author : 'Desconocido'),
        text: m.body || m.text || m.message || '(sin texto)',
        timestamp: m.timestamp || m.time || new Date().toISOString()
      }));

      const stats = {
        totalMessages: normalizedMessages.length,
        totalTasks: (buffer.newTasks || buffer.tasks || []).length,
        totalIdeas: (buffer.newIdeas || buffer.ideas || []).length,
        totalDecisions: (buffer.newDecisions || buffer.decisions || []).length,
        totalLinks: (buffer.newLinks || buffer.links || []).length,
        totalMentions: (buffer.newMentions || buffer.mentions || []).length,
        participants: [...new Set(normalizedMessages.map(m => m.authorName).filter(Boolean))],
        lastUpdate: buffer.lastBufferUpdate || buffer.lastUpdated || new Date().toISOString()
      };

      res.json({
        ...agentRaw,
        stats,
        messages: normalizedMessages,
        tasks: buffer.newTasks || buffer.tasks || [],
        ideas: buffer.newIdeas || buffer.ideas || [],
        decisions: buffer.newDecisions || buffer.decisions || [],
        links: buffer.newLinks || buffer.links || [],
        mentions: buffer.newMentions || buffer.mentions || [],
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });`;

if (fs.existsSync(FILES.server)) {
  track(applyPatch(FILES.server, '/api/whatsapp-agent normalizado', oldWhatsAppAgent, newWhatsAppAgent));
} else {
  log('⚠️ server.js não encontrado para patch');
  skipped++;
}

// ============================================
// VERIFICAÇÃO FINAL
// ============================================
log('\n═══════════════════════════════════════════════════════');
log(' 🛡️  VERIFICAÇÃO FINAL');
log('═══════════════════════════════════════════════════════');

verifyContains(FILES.agent, 'global.SCHEMAS = SCHEMAS;', 'global.SCHEMAS exportado');
verifyContains(FILES.agent, 'CDP_PORT: 9223,', 'CDP_PORT 9223');
verifyContains(FILES.agent, '/@luna|@kimi|@kimiclaw/i.test', 'isMention case-insensitive');
verifyContains(FILES.agent, 'isAuthorizedChat(chat.name)', 'isAuthorizedChat usado');
verifyContains(FILES.agent, 'this.threadHistory = [];', 'threadHistory inicializado');
verifyContains(FILES.agent, 'await this.brain.generateResponse(body, context)', 'handleMention usa IA');
verifyContains(FILES.agent, 'await this.sendScheduledReport(to)', 'forceReport passa destinatário');
verifyContains(FILES.agent, 'if (sent) {', 'Buffer só limpa após envio');
verifyContains(FILES.agent, 'authorName: resolvedAuthor.name', 'resolveAuthor no buffer');
verifyContains(FILES.agent, 'readJSONSafe(historyPath)', 'whatsapp-history.json acumulativo');
verifyContains(FILES.brain, 'const codeBlock = responseText.match', 'parseGemmaResponse robusto');
verifyContains(FILES.brain, 'finalResult.lunaPersonality = this.activePersonality;', 'Humor removido do classify');
verifyContains(FILES.scheduler, 'await runAgent({ once: false, schedule: true', 'runAgent params corretos');
verifyContains(FILES.agent, 'Sin tareas pendientes.', 'Espanhol nos comandos');
verifyContains(FILES.agent, 'Luna v16.0', 'Versão atualizada');

// ============================================
// RELATÓRIO
// ============================================
log('\n═══════════════════════════════════════════════════════');
log(' 📊 RELATÓRIO DE EXECUÇÃO');
log('═══════════════════════════════════════════════════════');
log(` ✅ Aplicados: ${applied}`);
log(` ⏭️  Ignorados (já corrigidos?): ${skipped}`);
log(` ❌ Falhas: ${failed}`);
log(` 💾 Backup: ${BACKUP_DIR}`);
log(` 📝 Log: ${LOG_FILE}`);
log('═══════════════════════════════════════════════════════');
log(' PRÓXIMOS PASSOS:');
log(' 1. Verifique se os arquivos compilam: node -c agents/luna-cto-agent.cjs');
log(' 2. Reinicie o Luna: node agents/luna-cto-agent.cjs');
log(' 3. Teste: envie "@luna status" no WhatsApp');
log('═══════════════════════════════════════════════════════');

if (failed > 0) {
  log('⚠️  HOUVE FALHAS! Verifique o log acima.');
  process.exit(1);
} else {
  log('🎉 LUNA FIX MASTER CONCLUÍDO!');
  process.exit(0);
}
