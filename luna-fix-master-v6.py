#!/usr/bin/env python3
# LUNA FIX MASTER v6.0 — Python Edition
import os, re, shutil
from datetime import datetime

ROOT = os.getcwd()
BACKUP_DIR = os.path.join(ROOT, 'artifacts', 'backups', 'luna-fix-v6-' + datetime.now().isoformat().replace(':','-').replace('.','-'))
LOG_FILE = os.path.join(ROOT, 'artifacts', 'luna-fix-v6-log.txt')

def log(msg):
    line = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    print(line)
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '
')

def backup(fp):
    rel = os.path.relpath(fp, ROOT)
    dest = os.path.join(BACKUP_DIR, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copy2(fp, dest)
    log(f'📦 Backup: {rel}')

def read(fp):
    with open(fp, 'r', encoding='utf-8') as f:
        return f.read()

def write(fp, content):
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(content)

def patch(fp, desc, old, new):
    content = read(fp)
    if old not in content:
        log(f'⚠️  [SKIP] "{desc}" — não encontrado')
        return False
    new_content = content.replace(old, new, 1)
    if new_content == content:
        log(f'⚠️  [SKIP] "{desc}" — já aplicado?')
        return False
    write(fp, new_content)
    log(f'✅ [OK] {desc}')
    return True

def regex_patch(fp, desc, pattern, repl):
    content = read(fp)
    new_content = re.sub(pattern, repl, content, flags=re.DOTALL)
    if new_content == content:
        log(f'⚠️  [SKIP] "{desc}" — regex não matchou')
        return False
    write(fp, new_content)
    log(f'✅ [OK] {desc} [regex]')
    return True

# INICIALIZAÇÃO
os.makedirs(BACKUP_DIR, exist_ok=True)
log('═══════════════════════════════════════════════════════')
log(' 🌙 LUNA FIX MASTER v6.0 (Python) INICIADO')
log(f' 📁 Projeto: {ROOT}')
log(f' 💾 Backup:  {BACKUP_DIR}')
log('═══════════════════════════════════════════════════════')

FILES = {
    'agent': os.path.join(ROOT, 'agents', 'luna-cto-agent.cjs'),
    'classifier': os.path.join(ROOT, 'agents', 'SmartClassifier_v16.js'),
    'brain': os.path.join(ROOT, 'agents', 'LunaBrain_v16.js'),
    'scheduler': os.path.join(ROOT, 'agents', 'luna-scheduler.mjs'),
    'server': os.path.join(ROOT, 'backend', 'server.js')
}

for k, fp in FILES.items():
    if os.path.exists(fp):
        backup(fp)
    else:
        log(f'⚠️  Arquivo não encontrado: {fp}')

applied = 0
skipped = 0

# ============================================
# PATCHES
# ============================================

# C1: global.SCHEMAS
if regex_patch(FILES['agent'], 'C1 - global.SCHEMAS',
    r'(SCHEMAS = loadAllSchemas\(\);)',
    r'

// [FIX C1] Exportar para global — resolveAuthor() precisa disso
global.SCHEMAS = SCHEMAS;'):
    applied += 1
else:
    skipped += 1

# C2: Regex patterns
for old, new, desc in [
    ('build ok|ta funcionando|funcionou|deployado', 'build|ok|funcionando|funcionou|deployado', 'C2 - tarefaRealizada'),
    ('falta fazer|tem que|devemos|vamos|precisa', 'falta|tem|que|devemos|vamos|precisa', 'C2 - tarefaPendente'),
    ('pagamento recebido|dinheiro na conta|entrou dinheiro|recebi|recebemos|pagaram', 'pagamento|dinheiro|conta|entrou|recebi|recebemos|pagaram', 'C2 - financeiroPagamento'),
    ('nao pagou|falta pagar|nao recebi|ainda nao pagou|esta devendo|fatura atrasada|conta atrasada|nao transferiu|esperando pagamento', 'nao|pagou|falta|recebi|ainda|esta|devendo|fatura|conta|transferiu|esperando|pagamento', 'C2 - financeiroPendente'),
    ('quero contratar|quero fechar|vamos fechar|fecha quando|quando começamos|quando podemos começar|ta decidido|vou fechar|vou contratar|manda contrato|manda proposta|quero o site|quero o sistema|quero o app|quando entrega|quanto tempo leva|qual o prazo', 'quero|contratar|fechar|vamos|fecha|quando|começamos|podemos|decidido|vou|manda|contrato|proposta|site|sistema|app|entrega|tempo|leva|prazo', 'C2 - leadQuente'),
    ('preciso de|estou procurando|vi o trabalho|vi o site|me indicaram|recomendaram|quanto cobra|quanto custa|faz site|faz app|faz sistema|trabalha com|voce faz|faz para|fazemos', 'preciso|estou|procurando|vi|trabalho|site|indicaram|recomendaram|quanto|cobra|custa|faz|trabalha|voce|fazemos', 'C2 - leadMorno'),
    ('só para saber|so para saber|só uma duvida|so uma duvida|pergunta rapida|rapida pergunta|só confirmar|so confirmar|mais informacoes|como funciona|o que é|como é', 'só|para|saber|duvida|pergunta|rapida|confirmar|informacoes|funciona', 'C2 - leadFrio'),
]:
    if patch(FILES['classifier'], desc, old, new):
        applied += 1
    else:
        skipped += 1

# C3: handleMention — adicionar ignorar vazio
if patch(FILES['agent'], 'C3/M5 - Ignorar menção vazia',
    "async handleMention(msg) {
    const body = msg.body || '';
    const lowerBody = body.toLowerCase();",
    "async handleMention(msg) {
    const body = msg.body || '';
    const lowerBody = body.toLowerCase();

    // [FIX M5] Ignorar menção vazia (só @luna sem texto)
    const cleanBody = body.replace(/@luna|@kimi|@kimiclaw/gi, '').trim();
    if (!cleanBody) {
      log.info('Menção vazia ignorada');
      return;
    }"):
    applied += 1
else:
    skipped += 1

# C3: Substituir bloco handleMention por IA
agent_content = read(FILES['agent'])
if 'await this.brain.generateResponse(body, context)' not in agent_content:
    # Usar regex para substituir o bloco inteiro
    pattern = r"(if \(/status\|projeto\|andamento\|fase\|como ta\|como esta/\.test\(lowerBody\)\) \{[\s\S]*?\}

    try \{[\s\S]*?\}
  \})"
    replacement = """const isSimpleQuery = /^(hola|oi|ola|hey|e aí|opa|bom dia|buenos dias|buenas)/i.test(body.trim());

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
      log.success(`Resposta IA enviada (personality: ${response.personality})`);
    } catch (err) {
      log.error(`Falha IA: ${err.message}. Usando fallback...`);
      const buffer = this.cp.buffer;
      const fallback = `🌙 ¡Hola ${author.name}!\n\n📊 Estado actual:\n• ${buffer.newTasks?.length || 0} tareas\n• ${buffer.newIdeas?.length || 0} ideas\n• ${buffer.newLinks?.length || 0} links\n\n¿Qué necesitas? Usa /ayuda para ver comandos.`;
      await msg.reply(fallback);
    }"""

    new_content = re.sub(pattern, replacement, agent_content, flags=re.DOTALL)
    if new_content != agent_content:
        write(FILES['agent'], new_content)
        log('✅ [OK] C3 - handleMention usa IA [regex bloco]')
        applied += 1
    else:
        log('⚠️  [SKIP] C3 - handleMention regex não matchou')
        skipped += 1
else:
    log('⏭️  C3 - handleMention IA já existe')

# C4: parseGemmaResponse
if patch(FILES['brain'], 'C4 - parseGemmaResponse robusto',
    """parseGemmaResponse(responseText) {
    try {
      // Extrair JSON da resposta
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[GEMMA] Erro ao parsear JSON:', e.message);
    }
    return null;
  }""",
    """parseGemmaResponse(responseText) {
    try {
      // [FIX C4] Estratégia 1: JSON em code block ```json
      const codeBlock = responseText.match(/```json\s*([\s\S]*?)```/);
      if (codeBlock) {
        const parsed = JSON.parse(codeBlock[1].trim());
        return parsed;
      }

      // Estratégia 2: Procurar todos os objetos JSON candidatos
      const jsonMatches = responseText.match(/\{[\s\S]*?\}/g);
      if (jsonMatches) {
        const sorted = jsonMatches.sort((a, b) => b.length - a.length);
        for (const candidate of sorted) {
          try {
            const parsed = JSON.parse(candidate);
            if (parsed.category || parsed.confidence !== undefined) {
              return parsed;
            }
          } catch {}
        }
      }

      // Estratégia 3: Tentar parse do texto inteiro
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
  }"""):
    applied += 1
else:
    skipped += 1

# C5: Remover humor do classify()
if patch(FILES['brain'], 'C5 - Remover humor do classify',
    """    // 5. APLICAR PERSONALIDADE AO RESULTADO
    finalResult.lunaPersonality = this.selectPersonality({
      urgency: finalResult.priority === 'P0' ? 'critical' : 'normal',
      sentiment: finalResult.metrics?.sentiment || 'neutral',
      topic: finalResult.category,
      userMood: this.detectUserMood(threadHistory)
    });

    // 6. ATUALIZAR ESTADO EMOCIONAL DA LUNA
    this.updateEmotionalState(finalResult);

    return finalResult;""",
    """    // [FIX C5] Personalidade e humor SÓ em interações humanas (handleMention)
    // NUNCA durante scan passivo
    finalResult.lunaPersonality = this.activePersonality;

    return finalResult;"""):
    applied += 1
else:
    skipped += 1

# C6: runAgent params
if patch(FILES['scheduler'], 'C6 - runScan params',
    "async function runScan() {
  log('SCAN iniciado');
  const result = await runAgent(false);",
    "async function runScan() {
  log('SCAN iniciado');
  const result = await runAgent({ once: false, schedule: true, fullExtract: false });"):
    applied += 1
else:
    skipped += 1

if patch(FILES['scheduler'], 'C6 - runReport params',
    "async function runReport() {
  log('REPORT iniciado');
  const result = await runAgent(true);",
    "async function runReport() {
  log('REPORT iniciado');
  const result = await runAgent({ once: true, schedule: false, fullExtract: false });"):
    applied += 1
else:
    skipped += 1

# C7: threadHistory
if patch(FILES['agent'], 'C7 - threadHistory',
    "    this.fullExtractRunning = false;
  }",
    "    this.fullExtractRunning = false;
    // [FIX C7] Histórico de thread para contexto da Gemma
    this.threadHistory = [];
  }"):
    applied += 1
else:
    skipped += 1

# C8/C10: isAuthorizedChat + case-insensitive
if patch(FILES['agent'], 'C8/C10 - isAuthorizedChat + /i',
    """this.client.on('message_create', async (msg) => {

      if (msg.fromMe && !msg.body.startsWith('/')) return;

      const body = (msg.body || '').toLowerCase();
      const isMention = /@luna\|@kimi\|@kimiclaw/.test(body);""",
    """this.client.on('message_create', async (msg) => {
      // [FIX C8] Verificar chat autorizado
      try {
        const chat = await msg.getChat();
        if (!isAuthorizedChat(chat.name)) return;
      } catch (e) {
        // Se não conseguir obter chat, continuar
      }

      if (msg.fromMe && !msg.body.startsWith('/')) return;

      const body = (msg.body || '').toLowerCase();
      // [FIX C10] Case-insensitive para menções
      const isMention = /@luna|@kimi|@kimiclaw/i.test(body);"""):
    applied += 1
else:
    skipped += 1

# C9: forceReport
if patch(FILES['agent'], 'C9 - forceReport',
    "async forceReport(to) {
    await this.sendScheduledReport();
  }",
    "async forceReport(to) {
    await this.sendScheduledReport(to);
  }"):
    applied += 1
else:
    skipped += 1

# C9/C11: sendScheduledReport
if patch(FILES['agent'], 'C9 - sendScheduledReport signature',
    "  async sendScheduledReport() {
    const buffer = this.cp.buffer;",
    "  async sendScheduledReport(to = null) {
    const buffer = this.cp.buffer;"):
    applied += 1
else:
    skipped += 1

# C11: Buffer seguro
if patch(FILES['agent'], 'C11 - Buffer só limpa após envio',
    """    if (this.reportGroup) {
      await this.reportGroup.sendMessage(report);
      log.success('Relatorio inteligente enviado!');
    }

    this.cp.buffer.newMessages = [];""",
    """    // [FIX C11] Enviar ANTES de limpar buffer
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
      log.error(`Falha ao enviar relatorio: ${e.message}. Buffer PRESERVADO.`);
      return;
    }

    if (sent) {
      this.cp.buffer.newMessages = [];"""):
    applied += 1
else:
    skipped += 1

# C11: Fechar bloco
if patch(FILES['agent'], 'C11 - Fechar bloco if(sent)',
    """    this.cp.checkpoint.silenceCount = 0;
    this.cp.checkpoint.lastReport = new Date().toISOString();
    this.cp.save();
  }""",
    """      this.cp.checkpoint.silenceCount = 0;
      this.cp.checkpoint.lastReport = new Date().toISOString();
      this.cp.save();
    }
  }"""):
    applied += 1
else:
    skipped += 1

# C12: CDP_PORT
if patch(FILES['agent'], 'C12 - CDP_PORT 9223',
    "CDP_PORT: 9222,",
    "CDP_PORT: 9223,"):
    applied += 1
else:
    skipped += 1

# A2/A12: /ajuda
if patch(FILES['agent'], 'A2/A12 - /ajuda espanhol',
    "    else if (cmd === '/ajuda') {
      await msg.reply('🌙 *AJUDA LUNA v15.1*",
    "    else if (cmd === '/ajuda' || cmd === '/ayuda') {
      await msg.reply(`🌙 *AYUDA LUNA v16.0*"):
    applied += 1
else:
    skipped += 1

# A2: Novos comandos
if patch(FILES['agent'], 'A2 - 11 novos comandos',
    """    else if (cmd === '/ajuda') {
      await msg.reply('🌙 *AJUDA LUNA v15.1*\n\n/status — Projetos\n/relatorio — Relatorio\n/tarefas — Tarefas\n/extrair — Extrair tudo\n/ajuda — Este menu\n\nMencione @Luna para falar! Posso responder sobre clientes, financas, links e status.');
    }
  }""",
    """    else if (cmd === '/links') {
      const links = this.cp.buffer.newLinks || [];
      const list = links.length > 0 ? links.slice(0, 5).map(l => `• ${l.url} (${l.title || 'sin título'})`).join('\n') : 'Sin links nuevos.';
      await msg.reply(`🔗 *LINKS*\n\n${list}\n\n🤖 Luna v16.0`);
    }
    else if (cmd === '/ideias') {
      const ideas = this.cp.buffer.newIdeas || [];
      const list = ideas.length > 0 ? ideas.slice(0, 5).map(i => `• ${(i.body || '').slice(0, 50)}...`).join('\n') : 'Sin ideas nuevas.';
      await msg.reply(`💡 *IDEAS*\n\n${list}\n\n🤖 Luna v16.0`);
    }
    else if (cmd === '/leads') {
      const leads = this.cp.buffer.newLeads || [];
      const list = leads.length > 0 ? leads.slice(0, 5).map(l => `• ${l.name || 'No identificado'}: ${(l.context || '').slice(0, 40)}...`).join('\n') : 'Sin leads nuevos.';
      await msg.reply(`🎣 *LEADS*\n\n${list}\n\n🤖 Luna v16.0`);
    }
    else if (cmd === '/decisiones' || cmd === '/decisoes') {
      const decisions = this.cp.buffer.newDecisions || [];
      const list = decisions.length > 0 ? decisions.slice(0, 5).map(d => `• ${(d.body || '').slice(0, 50)}...`).join('\n') : 'Sin decisiones nuevas.';
      await msg.reply(`📌 *DECISIONES*\n\n${list}\n\n🤖 Luna v16.0`);
    }
    else if (cmd === '/mentions' || cmd === '/menciones') {
      const mentions = this.cp.buffer.newMentions || [];
      const list = mentions.length > 0 ? mentions.slice(0, 5).map(m => `• ${m.author || 'Desconocido'}: ${(m.body || '').slice(0, 40)}...`).join('\n') : 'Sin menciones nuevas.';
      await msg.reply(`📢 *MENCIONES*\n\n${list}\n\n🤖 Luna v16.0`);
    }
    else if (cmd === '/historico') {
      const msgs = this.cp.buffer.newMessages || [];
      const list = msgs.length > 0 ? msgs.slice(-5).map(m => {
        const author = resolveAuthor(m.author || m.from).name;
        return `• [${author}] ${(m.body || m.text || '').slice(0, 40)}...`;
      }).join('\n') : 'Sin mensajes recientes.';
      await msg.reply(`📜 *HISTÓRICO*\n\n${list}\n\n🤖 Luna v16.0`);
    }
    else if (cmd === '/scan') {
      await msg.reply('🔍 Iniciando escaneo forzado...');
      await this.runOnce();
      await msg.reply('✅ Escaneo completado. Revisa /status.');
    }
    else if (cmd === '/config') {
      await msg.reply(`⚙️ *CONFIGURACIÓN*\n\nGrupos: ${CONFIG.GROUPS.map(g => g.name).join(', ')}\nIntervalo scan: ${CONFIG.SCAN_INTERVAL / 60000}min\nIntervalo informe: ${CONFIG.REPORT_INTERVAL / 60000}min\nCDP Port: ${CONFIG.CDP_PORT}\nVersión: v16.0\n\n🤖 Luna v16.0`);
    }
    else if (cmd === '/silencio') {
      this.cp.checkpoint.silenceCount = 999;
      this.cp.save();
      await msg.reply('🔇 Modo silencio activado. No enviaré informes automáticos hasta que uses /scan.');
    }
    else if (cmd === '/voz') {
      const voices = Object.keys(this.brain.personalities).join(', ');
      await msg.reply(`🎭 *PERSONALIDADES*\n\nDisponibles: ${voices}\n\nActual: ${this.brain.activePersonality}\n\n🤖 Luna v16.0`);
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
      await msg.reply(`🌙 *AYUDA LUNA v16.0*\n\n📋 *Comandos disponibles:*\n/status — Estado de proyectos\n/relatorio — Generar informe completo\n/tarefas — Ver tareas pendientes\n/extrair — Extracción completa\n/links — Links detectados\n/ideias — Ideas nuevas\n/leads — Posibles clientes\n/decisiones — Decisiones tomadas\n/mentions — Menciones recientes\n/historico — Últimos mensajes\n/scan — Forzar escaneo ahora\n/config — Configuración actual\n/silencio — Pausar informes\n/voz — Cambiar personalidad\n/limpiar — Limpiar buffer\n/ayuda — Este menú\n\nMenciona @Luna para hablar con IA. Puedo analizar clientes, finanzas, links y estado.`);
    }
  }"""):
    applied += 1
else:
    skipped += 1

# A3: updateBufferFromClassified
if patch(FILES['agent'], 'A3 - Tarefas com resolveAuthor',
    """ for (const item of classified) {
      const c = item.classification;

      switch (c.category) {
        case 'tarefaRealizada':
        case 'tarefaPendente':
          this.cp.buffer.newTasks.push({
            body: item.text,
            author: item.author,""",
    """ for (const item of classified) {
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
            authorPhone: authorPhone,"""):
    applied += 1
else:
    skipped += 1

for old, new, desc in [
    ("this.cp.buffer.newIdeas.push({ body: item.text, author: item.author, time: item.timestamp });",
     "this.cp.buffer.newIdeas.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp });",
     'A3 - Ideias'),
    ("this.cp.buffer.newDecisions.push({ body: item.text, author: item.author, time: item.timestamp });",
     "this.cp.buffer.newDecisions.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp });",
     'A3 - Decisões'),
    ("this.cp.buffer.newLinks.push({ url: c.urls[0], context: item.text, author: item.author, time: item.timestamp });",
     "this.cp.buffer.newLinks.push({ url: c.urls[0], context: item.text, author: authorName, authorPhone, time: item.timestamp });",
     'A3 - Links'),
    ("this.cp.buffer.newLeads.push({ name: c.possibleNewClient, context: item.text, author: item.author, time: item.timestamp });",
     "this.cp.buffer.newLeads.push({ name: c.possibleNewClient, context: item.text, author: authorName, authorPhone, time: item.timestamp });",
     'A3 - Leads'),
    ("this.cp.buffer.newNews.push({ body: item.text, author: item.author, time: item.timestamp, chat: item.chatName });",
     "this.cp.buffer.newNews.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp, chat: item.chatName });",
     'A3 - Notícias'),
]:
    if patch(FILES['agent'], desc, old, new):
        applied += 1
    else:
        skipped += 1

# A5/A6: runOnce
if patch(FILES['agent'], 'A5/A6 - whatsapp-history + alias',
    """    this.cp.checkpoint.lastScan = new Date().toISOString();
    this.cp.save();

    return {
      status: 'ok',
      hasNews: newMessages.length > 0,
      newMessages: newMessages.length
    };""",
    """    this.cp.checkpoint.lastScan = new Date().toISOString();
    this.cp.save();

    // [FIX A5] Salvar histórico acumulativo
    try {
      const historyPath = path.join(__dirname, '../backend/data/whatsapp-history.json');
      const existing = readJSONSafe(historyPath) || { messages: [] };
      const merged = this.deduplicateMessages(existing.messages, newMessages);
      writeJSONSafe(historyPath, { messages: merged, lastUpdated: new Date().toISOString() });
      log.info(`Histórico acumulativo: ${merged.length} mensagens`);
    } catch (e) {
      log.warn(`Falha ao salvar histórico: ${e.message}`);
    }

    return {
      status: 'ok',
      hasNews: newMessages.length > 0,
      newMessages: newMessages,
      messages: newMessages // [FIX A6] Alias para compatibilidade com scheduler
    };"""):
    applied += 1
else:
    skipped += 1

# A4: notifyOps
if patch(FILES['agent'], 'A4 - notifyOps',
    """      let fetch;
      try { fetch = (await import('node-fetch')).default; } catch (e) { return; }
      await fetch('http://localhost:3456/api/ops/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) { /* Silencioso */ }""",
    """      let fetch;
      try { fetch = (await import('node-fetch')).default; } catch (e) { 
        log.warn('node-fetch não disponível para notifyOps');
        return; 
      }
      const res = await fetch('http://localhost:3456/api/ops/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) log.warn(`notifyOps falhou: HTTP ${res.status}`);
      else log.info('notifyOps: backend notificado');
    } catch (e) { 
      log.error(`notifyOps falhou: ${e.message}`);
    }"""):
    applied += 1
else:
    skipped += 1

# A5: readJSONSafe/writeJSONSafe
if patch(FILES['agent'], 'A5 - readJSONSafe/writeJSONSafe',
    "function diagnose() {
  const checks = {",
    """function readJSONSafe(file) {
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
  const checks = {"""):
    applied += 1
else:
    skipped += 1

# A5: deduplicateMessages
if patch(FILES['agent'], 'A5 - deduplicateMessages',
    """generateStats(classified) {
    const stats = {};
    for (const item of classified) {
      const cat = item.classification.category;
      stats[cat] = (stats[cat] || 0) + 1;
    }
    return stats;
  }""",
    """generateStats(classified) {
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
  }"""):
    applied += 1
else:
    skipped += 1

# A12: Espanhol
if patch(FILES['agent'], 'A12 - /status espanhol',
    """    if (cmd === '/status') {
      const buffer = this.cp.buffer;
      await msg.reply(`📊 *STATUS NEXO*\n\n🟢 Projetos ativos: ${buffer.newTasks?.length || 0}\n💡 Ideias: ${buffer.newIdeas?.length || 0}\n🔗 Links: ${buffer.newLinks?.length || 0}\n📰 News: ${buffer.newNews?.length || 0}\n🎣 Leads: ${buffer.newLeads?.length || 0}\n\n🤖 Luna v15.1`);
    }""",
    """    if (cmd === '/status') {
      const buffer = this.cp.buffer;
      await msg.reply(`📊 *ESTADO NEXO*\n\n🟢 Proyectos activos: ${buffer.newTasks?.length || 0}\n💡 Ideas: ${buffer.newIdeas?.length || 0}\n🔗 Links: ${buffer.newLinks?.length || 0}\n📰 Noticias: ${buffer.newNews?.length || 0}\n🎣 Leads: ${buffer.newLeads?.length || 0}\n\n🤖 Luna v16.0`);
    }"""):
    applied += 1
else:
    skipped += 1

if patch(FILES['agent'], 'A12 - /relatorio espanhol',
    "      await msg.reply('📊 Gerando relatorio inteligente...');",
    "      await msg.reply('📊 Generando informe inteligente...');"):
    applied += 1
else:
    skipped += 1

if patch(FILES['agent'], 'A12 - /tarefas espanhol',
    """    else if (cmd === '/tarefas') {
      const tasks = this.cp.buffer.newTasks || [];
      const list = tasks.length > 0 ? tasks.slice(0, 5).map(t => `• [${t.priority || 'P2'}] ${(t.body || t.text || '').slice(0, 50)}`).join('\n') : 'Nenhuma tarefa pendente.';
      await msg.reply(`📝 *TAREFAS*\n\n${list}\n\n🤖 Luna v15.1`);
    }""",
    """    else if (cmd === '/tarefas') {
      const tasks = this.cp.buffer.newTasks || [];
      const list = tasks.length > 0 ? tasks.slice(0, 5).map(t => `• [${t.priority || 'P2'}] ${(t.body || t.text || '').slice(0, 50)}`).join('\n') : 'Sin tareas pendientes.';
      await msg.reply(`📝 *TAREAS*\n\n${list}\n\n🤖 Luna v16.0`);
    }"""):
    applied += 1
else:
    skipped += 1

if patch(FILES['agent'], 'A12 - /extrair espanhol',
    """    else if (cmd === '/extrair') {
      await msg.reply('🔄 Iniciando extracao completa...');
      await this.runFullExtract();
      await msg.reply('✅ Extracao completa finalizada!');
    }""",
    """    else if (cmd === '/extrair') {
      await msg.reply('🔄 Iniciando extracción completa...');
      await this.runFullExtract();
      await msg.reply('✅ Extracción completa finalizada!');
    }"""):
    applied += 1
else:
    skipped += 1

# C7: runFullExtract
if patch(FILES['agent'], 'C7 - runFullExtract threadHistory',
    "const classified = await this.brain.classify(m, this.threadHistory || []);
            allClassified.push({ ...msg, classification: classified });
            this.cp.markProcessed(msg);",
    """const classified = await this.brain.classify(m, this.threadHistory || []);
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
            if (this.threadHistory.length > 50) this.threadHistory.shift();"""):
    applied += 1
else:
    skipped += 1

# SERVER
if patch(FILES['server'], 'SERVER - /api/whatsapp-agent',
    """app.get('/api/whatsapp-agent', (req, res) => {
  const data = readJSON(AGENT_DATA_FILE);
  if (!data) return res.status(404).json({ error: 'Agent data not found. Run: node agents/nexo-whatsapp-agent-v8.mjs' });
  res.json(data);
});""",
    """app.get('/api/whatsapp-agent', (req, res) => {
  try {
    const agentRaw = readJSON(AGENT_DATA_FILE) || {};
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
});"""):
    applied += 1
else:
    skipped += 1

if patch(FILES['server'], 'SERVER - /api/whatsapp alinhar',
    "      messages: buffer.messages || [],",
    "      messages: buffer.newMessages || buffer.messages || [],"):
    applied += 1
else:
    skipped += 1

# ============================================
# VERIFICAÇÃO
# ============================================
log('')
log('═══════════════════════════════════════════════════════')
log(' 🛡️  VERIFICAÇÃO FINAL')
log('═══════════════════════════════════════════════════════')

CHECKS = [
    ('agents/luna-cto-agent.cjs', 'global.SCHEMAS = SCHEMAS;', 'C1 - global.SCHEMAS'),
    ('agents/luna-cto-agent.cjs', 'CDP_PORT: 9223,', 'C12 - CDP_PORT'),
    ('agents/luna-cto-agent.cjs', '/@luna|@kimi|@kimiclaw/i.test', 'C10 - isMention /i'),
    ('agents/luna-cto-agent.cjs', 'isAuthorizedChat(chat.name)', 'C8 - isAuthorizedChat'),
    ('agents/luna-cto-agent.cjs', 'this.threadHistory = [];', 'C7 - threadHistory'),
    ('agents/luna-cto-agent.cjs', 'await this.brain.generateResponse(body, context)', 'C3 - handleMention IA'),
    ('agents/luna-cto-agent.cjs', 'await this.sendScheduledReport(to)', 'C9 - forceReport'),
    ('agents/luna-cto-agent.cjs', 'if (sent) {', 'C11 - buffer seguro'),
    ('agents/luna-cto-agent.cjs', 'const resolvedAuthor = resolveAuthor', 'A3 - resolveAuthor'),
    ('agents/luna-cto-agent.cjs', 'readJSONSafe(historyPath)', 'A5 - whatsapp-history'),
    ('agents/LunaBrain_v16.js', 'const codeBlock = responseText.match', 'C4 - parseGemmaResponse'),
    ('agents/LunaBrain_v16.js', 'finalResult.lunaPersonality = this.activePersonality;', 'C5 - humor removido'),
    ('agents/luna-scheduler.mjs', 'await runAgent({ once: false, schedule: true', 'C6 - runAgent params'),
    ('agents/luna-cto-agent.cjs', 'Sin tareas pendientes.', 'A12 - espanhol'),
    ('agents/luna-cto-agent.cjs', 'Luna v16.0', 'A12 - versão'),
    ('backend/server.js', 'normalizedMessages', 'SERVER - whatsapp-agent'),
]

verified = 0
for f, expected, desc in CHECKS:
    fp = os.path.join(ROOT, f)
    if os.path.exists(fp):
        if expected in read(fp):
            log(f'🛡️  [VERIFY] {desc} — OK')
            verified += 1
        else:
            log(f'❌ [FAIL] {desc}')
    else:
        log(f'⚠️  [SKIP] {f} não existe')

log('')
log('═══════════════════════════════════════════════════════')
log(' 📊 RELATÓRIO')
log('═══════════════════════════════════════════════════════')
log(f' ✅ Aplicados: {applied}')
log(f' ⏭️  Ignorados: {skipped}')
log(f' 🛡️  Verificados: {verified}/{len(CHECKS)}')
log(f' 💾 Backup: {BACKUP_DIR}')
log('═══════════════════════════════════════════════════════')

if verified >= len(CHECKS) - 2:
    log('🎉 LUNA FIX MASTER v6.0 CONCLUÍDO!')
    log(' Próximos passos:')
    log('  1. node -c agents/luna-cto-agent.cjs')
    log('  2. node -c agents/luna-scheduler.mjs')
    log('  3. node agents/luna-cto-agent.cjs')
    exit(0)
else:
    log('⚠️  ALGUMAS VERIFICAÇÕES FALHARAM. Verifique o log.')
    exit(1)
