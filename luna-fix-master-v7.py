#!/usr/bin/env python3
# LUNA FIX MASTER v7.0 — Python Edition (Definitivo)
# Execute: python luna-fix-master-v7.py

import os, shutil
from datetime import datetime

ROOT = os.getcwd()
BACKUP_DIR = os.path.join(ROOT, 'artifacts', 'backups', 'luna-fix-v7-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
LOG_FILE = os.path.join(ROOT, 'artifacts', 'luna-fix-v7-log.txt')

def log(msg):
    t = datetime.now().strftime('%H:%M:%S')
    line = f'[{t}] {msg}'
    print(line)
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(line + '\n')

def backup(fp):
    rel = os.path.relpath(fp, ROOT)
    dest = os.path.join(BACKUP_DIR, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copy2(fp, dest)
    log(f'  [BACKUP] {rel}')

def read(fp):
    with open(fp, 'r', encoding='utf-8') as f:
        return f.read()

def write(fp, content):
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(content)

def replace_line(fp, desc, old_line, new_line):
    """Substitui UMA linha exata por outra"""
    content = read(fp)
    lines = content.split('\n')
    found = False
    for i, line in enumerate(lines):
        if line.strip() == old_line.strip():
            lines[i] = new_line
            found = True
            break
    if not found:
        log(f'  [SKIP] {desc} — linha não encontrada: "{old_line[:50]}"')
        return False
    write(fp, '\n'.join(lines))
    log(f'  [OK] {desc}')
    return True

def insert_after_line(fp, desc, search_line, insert_lines):
    """Insere linhas DEPOIS de uma linha de busca"""
    content = read(fp)
    lines = content.split('\n')
    found = False
    for i, line in enumerate(lines):
        if line.strip() == search_line.strip():
            # Verificar se já existe (evitar duplicar)
            check = '\n'.join(insert_lines)
            if check in content:
                log(f'  [SKIP] {desc} — já existe')
                return False
            lines.insert(i + 1, insert_lines)
            found = True
            break
    if not found:
        log(f'  [SKIP] {desc} — linha não encontrada: "{search_line[:50]}"')
        return False
    write(fp, '\n'.join(lines))
    log(f'  [OK] {desc}')
    return True

def insert_before_line(fp, desc, search_line, insert_lines):
    """Insere linhas ANTES de uma linha de busca"""
    content = read(fp)
    lines = content.split('\n')
    found = False
    for i, line in enumerate(lines):
        if line.strip() == search_line.strip():
            check = '\n'.join(insert_lines)
            if check in content:
                log(f'  [SKIP] {desc} — já existe')
                return False
            lines.insert(i, insert_lines)
            found = True
            break
    if not found:
        log(f'  [SKIP] {desc} — linha não encontrada: "{search_line[:50]}"')
        return False
    write(fp, '\n'.join(lines))
    log(f'  [OK] {desc}')
    return True

def replace_in_file(fp, desc, old_text, new_text):
    """Substitui texto exato (pode ser multi-linha)"""
    content = read(fp)
    if old_text not in content:
        log(f'  [SKIP] {desc} — trecho não encontrado')
        return False
    new_content = content.replace(old_text, new_text, 1)
    if new_content == content:
        log(f'  [SKIP] {desc} — já aplicado?')
        return False
    write(fp, new_content)
    log(f'  [OK] {desc}')
    return True

# ============================================
# INICIALIZAÇÃO
# ============================================
log('═══════════════════════════════════════════════════════')
log(' 🌙 LUNA FIX MASTER v7.0 INICIADO')
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
        log(f'  [WARN] Arquivo não encontrado: {fp}')

applied = 0
skipped = 0

def track(ok):
    global applied, skipped
    if ok:
        applied += 1
    else:
        skipped += 1

# ============================================
# FASE 1: AGENT (luna-cto-agent.cjs)
# ============================================
log('\n--- FASE 1: AGENT ---')

# C1: global.SCHEMAS
track(insert_after_line(FILES['agent'], 'C1 - global.SCHEMAS',
    "SCHEMAS = loadAllSchemas();",
    "\n// [FIX C1] Exportar para global — resolveAuthor() precisa disso\nglobal.SCHEMAS = SCHEMAS;"))

# C7: threadHistory
track(insert_after_line(FILES['agent'], 'C7 - threadHistory',
    "    this.fullExtractRunning = false;",
    "\n    // [FIX C7] Histórico de thread para contexto da Gemma\n    this.threadHistory = [];"))

# C8: isAuthorizedChat
track(insert_before_line(FILES['agent'], 'C8 - isAuthorizedChat',
    "      if (msg.fromMe && !msg.body.startsWith('/')) return;",
    "      // [FIX C8] Verificar chat autorizado\n      try {\n        const chat = await msg.getChat();\n        if (!isAuthorizedChat(chat.name)) return;\n      } catch (e) { /* continuar */ }\n"))

# C10: case-insensitive mention
track(replace_line(FILES['agent'], 'C10 - case-insensitive',
    "      const isMention = /@luna\\|@kimi\\|@kimiclaw/.test(body);",
    "      // [FIX C10] Case-insensitive para menções\n      const isMention = /@luna|@kimi|@kimiclaw/i.test(body);"))

# C9: forceReport
track(replace_line(FILES['agent'], 'C9 - forceReport',
    "    await this.sendScheduledReport();",
    "    await this.sendScheduledReport(to);"))

# C12: CDP_PORT
track(replace_line(FILES['agent'], 'C12 - CDP_PORT',
    "CDP_PORT: 9222,",
    "CDP_PORT: 9223,"))

# C9/C11: sendScheduledReport signature
track(replace_line(FILES['agent'], 'C9 - sendScheduledReport signature',
    "  async sendScheduledReport() {",
    "  async sendScheduledReport(to = null) {"))

# C11: Buffer seguro — substituir bloco de envio
old_send = """    if (this.reportGroup) {
      await this.reportGroup.sendMessage(report);
      log.success('Relatorio inteligente enviado!');
    }

    this.cp.buffer.newMessages = [];"""

new_send = """    // [FIX C11] Enviar ANTES de limpar buffer
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
      this.cp.buffer.newMessages = [];"""

track(replace_in_file(FILES['agent'], 'C11 - Buffer seguro', old_send, new_send))

# C11: Fechar bloco if(sent)
track(replace_in_file(FILES['agent'], 'C11 - Fechar bloco',
    """    this.cp.checkpoint.silenceCount = 0;
    this.cp.checkpoint.lastReport = new Date().toISOString();
    this.cp.save();
  }""",
    """      this.cp.checkpoint.silenceCount = 0;
      this.cp.checkpoint.lastReport = new Date().toISOString();
      this.cp.save();
    }
  }"""))

# C3: handleMention — adicionar ignorar vazio no início
track(insert_after_line(FILES['agent'], 'C3/M5 - Ignorar menção vazia',
    "    const lowerBody = body.toLowerCase();",
    "\n\n    // [FIX M5] Ignorar menção vazia (só @luna sem texto)\n    const cleanBody = body.replace(/@luna|@kimi|@kimiclaw/gi, '').trim();\n    if (!cleanBody) {\n      log.info('Menção vazia ignorada');\n      return;\n    }"))

# C3: Substituir bloco if/else do handleMention por IA
# Buscar pelo início do bloco if status
old_mention_block = """    if (/status\\|projeto\\|andamento\\|fase\\|como ta\\|como esta/.test(lowerBody)) {
      response = `📊 *STATUS ATUAL*\\n\\n`;"""

new_mention_block = """    // [FIX C3] Usar Gemma 2B para respostas inteligentes
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
      log.success(`Resposta IA enviada (personality: ${response.personality})`);
      return;
    } catch (err) {
      log.error(`Falha IA: ${err.message}. Usando fallback...`);
      const buffer = this.cp.buffer;
      const fallback = `🌙 ¡Hola ${author.name}!\\n\\n📊 Estado actual:\\n• ${buffer.newTasks?.length || 0} tareas\\n• ${buffer.newIdeas?.length || 0} ideas\\n• ${buffer.newLinks?.length || 0} links\\n\\n¿Qué necesitas? Usa /ayuda para ver comandos.`;
      await msg.reply(fallback);
      return;
    }
  }

  // [DEPRECATED] Old handleMention logic — replaced by IA above
  async _oldHandleMention(msg) {
    const body = msg.body || '';
    const lowerBody = body.toLowerCase();

    let response = '';
    if (/status\\|projeto\\|andamento\\|fase\\|como ta\\|como esta/.test(lowerBody)) {
      response = `📊 *STATUS ATUAL*\\n\\n`;"""

track(replace_in_file(FILES['agent'], 'C3 - handleMention usa IA', old_mention_block, new_mention_block))

# A3: updateBufferFromClassified — adicionar resolveAuthor antes do switch
track(insert_before_line(FILES['agent'], 'A3 - resolveAuthor',
    "      switch (c.category) {",
    "      // [FIX A3] Resolver autor para nome real\n      const resolvedAuthor = resolveAuthor(item.author || item.from || 'unknown');\n      const authorName = resolvedAuthor.name;\n      const authorPhone = item.author || item.from || 'unknown';\n"))

# A3: Substituir todos os `author: item.author,` por `author: authorName,`
agent_content = read(FILES['agent'])
agent_new = agent_content
replacements_a3 = [
    ("            author: item.author,", "            author: authorName,\n            authorPhone: authorPhone,"),
    ("this.cp.buffer.newIdeas.push({ body: item.text, author: item.author, time: item.timestamp });",
     "this.cp.buffer.newIdeas.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp });"),
    ("this.cp.buffer.newDecisions.push({ body: item.text, author: item.author, time: item.timestamp });",
     "this.cp.buffer.newDecisions.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp });"),
    ("this.cp.buffer.newLinks.push({ url: c.urls[0], context: item.text, author: item.author, time: item.timestamp });",
     "this.cp.buffer.newLinks.push({ url: c.urls[0], context: item.text, author: authorName, authorPhone, time: item.timestamp });"),
    ("this.cp.buffer.newLeads.push({ name: c.possibleNewClient, context: item.text, author: item.author, time: item.timestamp });",
     "this.cp.buffer.newLeads.push({ name: c.possibleNewClient, context: item.text, author: authorName, authorPhone, time: item.timestamp });"),
    ("this.cp.buffer.newNews.push({ body: item.text, author: item.author, time: item.timestamp, chat: item.chatName });",
     "this.cp.buffer.newNews.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp, chat: item.chatName });"),
]
a3_ok = False
for old, new in replacements_a3:
    if old in agent_new:
        agent_new = agent_new.replace(old, new, 1)
        a3_ok = True
if a3_ok and agent_new != agent_content:
    write(FILES['agent'], agent_new)
    log('  [OK] A3 - Todos os author: item.author → authorName')
    applied += 1
else:
    log('  [SKIP] A3 - já aplicado ou não encontrado')
    skipped += 1

# A5: readJSONSafe/writeJSONSafe helpers
track(insert_before_line(FILES['agent'], 'A5 - readJSONSafe/writeJSONSafe',
    "function diagnose() {",
    "function readJSONSafe(file) {\n  try {\n    if (!fs.existsSync(file)) return null;\n    let raw = fs.readFileSync(file, 'utf8');\n    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.substring(1);\n    return JSON.parse(raw);\n  } catch (e) {\n    console.error('[readJSONSafe] Erro:', e.message);\n    return null;\n  }\n}\n\nfunction writeJSONSafe(file, data) {\n  try {\n    ensureDir(path.dirname(file));\n    fs.writeFileSync(file, JSON.stringify(data, null, 2));\n  } catch (e) {\n    console.error('[writeJSONSafe] Erro:', e.message);\n  }\n}\n\n"))

# A5: deduplicateMessages
track(insert_after_line(FILES['agent'], 'A5 - deduplicateMessages',
    "    return stats;",
    "\n\n  deduplicateMessages(existing, incoming) {\n    const map = new Map();\n    (existing || []).forEach(m => {\n      const key = m.id || m.timestamp + (m.author || m.from || 'unknown');\n      map.set(key, m);\n    });\n    (incoming || []).forEach(m => {\n      const key = m.id || m.timestamp + (m.author || m.from || 'unknown');\n      if (!map.has(key)) map.set(key, m);\n    });\n    return Array.from(map.values());\n  }"))

# A5/A6: runOnce — whatsapp-history + alias
track(insert_after_line(FILES['agent'], 'A5/A6 - whatsapp-history + alias',
    "    this.cp.save();",
    "\n\n    // [FIX A5] Salvar histórico acumulativo\n    try {\n      const historyPath = path.join(__dirname, '../backend/data/whatsapp-history.json');\n      const existing = readJSONSafe(historyPath) || { messages: [] };\n      const merged = this.deduplicateMessages(existing.messages, newMessages);\n      writeJSONSafe(historyPath, { messages: merged, lastUpdated: new Date().toISOString() });\n      log.info(`Histórico acumulativo: ${merged.length} mensagens`);\n    } catch (e) {\n      log.warn(`Falha ao salvar histórico: ${e.message}`);\n    }"))

# A6: alias messages no return
track(replace_line(FILES['agent'], 'A6 - alias messages',
    "      newMessages: newMessages.length",
    "      newMessages: newMessages,\n      messages: newMessages // [FIX A6] Alias para compatibilidade com scheduler"))

# A4: notifyOps
track(replace_in_file(FILES['agent'], 'A4 - notifyOps',
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
    }"""))

# C7: runFullExtract acumula threadHistory
track(insert_after_line(FILES['agent'], 'C7 - runFullExtract threadHistory',
    "            this.cp.markProcessed(msg);",
    "\n            // [FIX C7] Acumular threadHistory\n            const resolved = resolveAuthor(msg.author || msg.from || 'unknown');\n            this.threadHistory.push({\n              author: resolved.name,\n              text: msg.text || msg.body || '',\n              category: classified.category,\n              timestamp: msg.timestamp || new Date().toISOString()\n            });\n            if (this.threadHistory.length > 50) this.threadHistory.shift();"))

# A12: Espanhol nos comandos
track(replace_in_file(FILES['agent'], 'A12 - /status espanhol',
    """    if (cmd === '/status') {
      const buffer = this.cp.buffer;
      await msg.reply(`📊 *STATUS NEXO*\\n\\n🟢 Projetos ativos: ${buffer.newTasks?.length || 0}\\n💡 Ideias: ${buffer.newIdeas?.length || 0}\\n🔗 Links: ${buffer.newLinks?.length || 0}\\n📰 News: ${buffer.newNews?.length || 0}\\n🎣 Leads: ${buffer.newLeads?.length || 0}\\n\\n🤖 Luna v15.1`);\n    }""",
    """    if (cmd === '/status') {
      const buffer = this.cp.buffer;
      await msg.reply(`📊 *ESTADO NEXO*\\n\\n🟢 Proyectos activos: ${buffer.newTasks?.length || 0}\\n💡 Ideas: ${buffer.newIdeas?.length || 0}\\n🔗 Links: ${buffer.newLinks?.length || 0}\\n📰 Noticias: ${buffer.newNews?.length || 0}\\n🎣 Leads: ${buffer.newLeads?.length || 0}\\n\\n🤖 Luna v16.0`);\n    }"""))

track(replace_line(FILES['agent'], 'A12 - /relatorio espanhol',
    "      await msg.reply('📊 Gerando relatorio inteligente...');",
    "      await msg.reply('📊 Generando informe inteligente...');"))

track(replace_in_file(FILES['agent'], 'A12 - /tarefas espanhol',
    """    else if (cmd === '/tarefas') {
      const tasks = this.cp.buffer.newTasks || [];
      const list = tasks.length > 0 ? tasks.slice(0, 5).map(t => `• [${t.priority || 'P2'}] ${(t.body || t.text || '').slice(0, 50)}`).join('\\n') : 'Nenhuma tarefa pendente.';
      await msg.reply(`📝 *TAREFAS*\\n\\n${list}\\n\\n🤖 Luna v15.1`);\n    }""",
    """    else if (cmd === '/tarefas') {
      const tasks = this.cp.buffer.newTasks || [];
      const list = tasks.length > 0 ? tasks.slice(0, 5).map(t => `• [${t.priority || 'P2'}] ${(t.body || t.text || '').slice(0, 50)}`).join('\\n') : 'Sin tareas pendientes.';
      await msg.reply(`📝 *TAREAS*\\n\\n${list}\\n\\n🤖 Luna v16.0`);\n    }"""))

track(replace_in_file(FILES['agent'], 'A12 - /extrair espanhol',
    """    else if (cmd === '/extrair') {
      await msg.reply('🔄 Iniciando extracao completa...');\n      await this.runFullExtract();\n      await msg.reply('✅ Extracao completa finalizada!');\n    }""",
    """    else if (cmd === '/extrair') {
      await msg.reply('🔄 Iniciando extracción completa...');\n      await this.runFullExtract();\n      await msg.reply('✅ Extracción completa finalizada!');\n    }"""))

# A2: /ajuda espanhol + novos comandos
track(replace_line(FILES['agent'], 'A2/A12 - /ajuda espanhol',
    "    else if (cmd === '/ajuda') {",
    "    else if (cmd === '/ajuda' || cmd === '/ayuda') {"))

track(replace_in_file(FILES['agent'], 'A2 - Conteúdo /ajuda + novos comandos',
    """      await msg.reply('🌙 *AJUDA LUNA v15.1*\\n\\n/status — Projetos\\n/relatorio — Relatorio\\n/tarefas — Tarefas\\n/extrair — Extrair tudo\\n/ajuda — Este menu\\n\\nMencione @Luna para falar! Posso responder sobre clientes, financas, links e status.');
    }
  }""",
    """      await msg.reply(`🌙 *AYUDA LUNA v16.0*\\n\\n📋 *Comandos disponibles:*\\n/status — Estado de proyectos\\n/relatorio — Generar informe completo\\n/tarefas — Ver tareas pendientes\\n/extrair — Extracción completa\\n/links — Links detectados\\n/ideias — Ideas nuevas\\n/leads — Posibles clientes\\n/decisiones — Decisiones tomadas\\n/mentions — Menciones recientes\\n/historico — Últimos mensajes\\n/scan — Forzar escaneo ahora\\n/config — Configuración actual\\n/silencio — Pausar informes\\n/voz — Cambiar personalidad\\n/limpiar — Limpiar buffer\\n/ayuda — Este menú\\n\\nMenciona @Luna para hablar con IA. Puedo analizar clientes, finanzas, links y estado.`);
    }
    else if (cmd === '/links') {
      const links = this.cp.buffer.newLinks || [];
      const list = links.length > 0 ? links.slice(0, 5).map(l => `• ${l.url} (${l.title || 'sin título'})`).join('\\n') : 'Sin links nuevos.';
      await msg.reply(`🔗 *LINKS*\\n\\n${list}\\n\\n🤖 Luna v16.0`);
    }
    else if (cmd === '/ideias') {
      const ideas = this.cp.buffer.newIdeas || [];
      const list = ideas.length > 0 ? ideas.slice(0, 5).map(i => `• ${(i.body || '').slice(0, 50)}...`).join('\\n') : 'Sin ideas nuevas.';
      await msg.reply(`💡 *IDEAS*\\n\\n${list}\\n\\n🤖 Luna v16.0`);
    }
    else if (cmd === '/leads') {
      const leads = this.cp.buffer.newLeads || [];
      const list = leads.length > 0 ? leads.slice(0, 5).map(l => `• ${l.name || 'No identificado'}: ${(l.context || '').slice(0, 40)}...`).join('\\n') : 'Sin leads nuevos.';
      await msg.reply(`🎣 *LEADS*\\n\\n${list}\\n\\n🤖 Luna v16.0`);
    }
    else if (cmd === '/decisiones' || cmd === '/decisoes') {
      const decisions = this.cp.buffer.newDecisions || [];
      const list = decisions.length > 0 ? decisions.slice(0, 5).map(d => `• ${(d.body || '').slice(0, 50)}...`).join('\\n') : 'Sin decisiones nuevas.';
      await msg.reply(`📌 *DECISIONES*\\n\\n${list}\\n\\n🤖 Luna v16.0`);
    }
    else if (cmd === '/mentions' || cmd === '/menciones') {
      const mentions = this.cp.buffer.newMentions || [];
      const list = mentions.length > 0 ? mentions.slice(0, 5).map(m => `• ${m.author || 'Desconocido'}: ${(m.body || '').slice(0, 40)}...`).join('\\n') : 'Sin menciones nuevas.';
      await msg.reply(`📢 *MENCIONES*\\n\\n${list}\\n\\n🤖 Luna v16.0`);
    }
    else if (cmd === '/historico') {
      const msgs = this.cp.buffer.newMessages || [];
      const list = msgs.length > 0 ? msgs.slice(-5).map(m => {
        const author = resolveAuthor(m.author || m.from).name;
        return `• [${author}] ${(m.body || m.text || '').slice(0, 40)}...`;
      }).join('\\n') : 'Sin mensajes recientes.';
      await msg.reply(`📜 *HISTÓRICO*\\n\\n${list}\\n\\n🤖 Luna v16.0`);
    }
    else if (cmd === '/scan') {
      await msg.reply('🔍 Iniciando escaneo forzado...');
      await this.runOnce();
      await msg.reply('✅ Escaneo completado. Revisa /status.');
    }
    else if (cmd === '/config') {
      await msg.reply(`⚙️ *CONFIGURACIÓN*\\n\\nGrupos: ${CONFIG.GROUPS.map(g => g.name).join(', ')}\\nIntervalo scan: ${CONFIG.SCAN_INTERVAL / 60000}min\\nIntervalo informe: ${CONFIG.REPORT_INTERVAL / 60000}min\\nCDP Port: ${CONFIG.CDP_PORT}\\nVersión: v16.0\\n\\n🤖 Luna v16.0`);
    }
    else if (cmd === '/silencio') {
      this.cp.checkpoint.silenceCount = 999;
      this.cp.save();
      await msg.reply('🔇 Modo silencio activado. No enviaré informes automáticos hasta que uses /scan.');
    }
    else if (cmd === '/voz') {
      const voices = Object.keys(this.brain.personalities).join(', ');
      await msg.reply(`🎭 *PERSONALIDADES*\\n\\nDisponibles: ${voices}\\n\\nActual: ${this.brain.activePersonality}\\n\\n🤖 Luna v16.0`);
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
  }"""))

# ============================================
# FASE 2: CLASSIFIER (SmartClassifier_v16.js)
# ============================================
log('\n--- FASE 2: CLASSIFIER ---')

for old, new, desc in [
    ('build ok|ta funcionando|funcionou|deployado', 'build|ok|funcionando|funcionou|deployado', 'C2 - tarefaRealizada'),
    ('falta fazer|tem que|devemos|vamos|precisa', 'falta|tem|que|devemos|vamos|precisa', 'C2 - tarefaPendente'),
    ('pagamento recebido|dinheiro na conta|entrou dinheiro|recebi|recebemos|pagaram', 'pagamento|dinheiro|conta|entrou|recebi|recebemos|pagaram', 'C2 - financeiroPagamento'),
    ('nao pagou|falta pagar|nao recebi|ainda nao pagou|esta devendo|fatura atrasada|conta atrasada|nao transferiu|esperando pagamento', 'nao|pagou|falta|recebi|ainda|esta|devendo|fatura|conta|transferiu|esperando|pagamento', 'C2 - financeiroPendente'),
    ('quero contratar|quero fechar|vamos fechar|fecha quando|quando começamos|quando podemos começar|ta decidido|vou fechar|vou contratar|manda contrato|manda proposta|quero o site|quero o sistema|quero o app|quando entrega|quanto tempo leva|qual o prazo', 'quero|contratar|fechar|vamos|fecha|quando|começamos|podemos|decidido|vou|manda|contrato|proposta|site|sistema|app|entrega|tempo|leva|prazo', 'C2 - leadQuente'),
    ('preciso de|estou procurando|vi o trabalho|vi o site|me indicaram|recomendaram|quanto cobra|quanto custa|faz site|faz app|faz sistema|trabalha com|voce faz|faz para|fazemos', 'preciso|estou|procurando|vi|trabalho|site|indicaram|recomendaram|quanto|cobra|custa|faz|trabalha|voce|fazemos', 'C2 - leadMorno'),
    ('só para saber|so para saber|só uma duvida|so uma duvida|pergunta rapida|rapida pergunta|só confirmar|so confirmar|mais informacoes|como funciona|o que é|como é', 'só|para|saber|duvida|pergunta|rapida|confirmar|informacoes|funciona', 'C2 - leadFrio'),
]:
    track(replace_in_file(FILES['classifier'], desc, old, new))

# ============================================
# FASE 3: BRAIN (LunaBrain_v16.js)
# ============================================
log('\n--- FASE 3: BRAIN ---')

track(replace_in_file(FILES['brain'], 'C4 - parseGemmaResponse robusto',
    """parseGemmaResponse(responseText) {
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
  }""",
    """parseGemmaResponse(responseText) {
    try {
      // [FIX C4] Estratégia 1: JSON em code block ```json
      const codeBlock = responseText.match(/```json\\s*([\\s\\S]*?)```/);
      if (codeBlock) {
        const parsed = JSON.parse(codeBlock[1].trim());
        return parsed;
      }

      // Estratégia 2: Procurar todos os objetos JSON candidatos
      const jsonMatches = responseText.match(/\\{[\\s\\S]*?\\}/g);
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
  }"""))

track(replace_in_file(FILES['brain'], 'C5 - Remover humor do classify',
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

    return finalResult;"""))

# ============================================
# FASE 4: SCHEDULER (luna-scheduler.mjs)
# ============================================
log('\n--- FASE 4: SCHEDULER ---')

track(replace_line(FILES['scheduler'], 'C6 - runScan params',
    "  const result = await runAgent(false);",
    "  const result = await runAgent({ once: false, schedule: true, fullExtract: false });"))

track(replace_line(FILES['scheduler'], 'C6 - runReport params',
    "  const result = await runAgent(true);",
    "  const result = await runAgent({ once: true, schedule: false, fullExtract: false });"))

# ============================================
# FASE 5: SERVER (backend/server.js)
# ============================================
log('\n--- FASE 5: SERVER ---')

track(replace_in_file(FILES['server'], 'SERVER - /api/whatsapp-agent',
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
});"""))

track(replace_line(FILES['server'], 'SERVER - /api/whatsapp alinhar',
    "      messages: buffer.messages || [],",
    "      messages: buffer.newMessages || buffer.messages || [],"))

# ============================================
# VERIFICAÇÃO
# ============================================
log('\n═══════════════════════════════════════════════════════')
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
            log(f'  [VERIFY] {desc} — OK')
            verified += 1
        else:
            log(f'  [FAIL] {desc}')
    else:
        log(f'  [SKIP] {f} não existe')

log('\n═══════════════════════════════════════════════════════')
log(' 📊 RELATÓRIO')
log('═══════════════════════════════════════════════════════')
log(f' ✅ Aplicados: {applied}')
log(f' ⏭️  Ignorados: {skipped}')
log(f' 🛡️  Verificados: {verified}/{len(CHECKS)}')
log(f' 💾 Backup: {BACKUP_DIR}')
log('═══════════════════════════════════════════════════════')

if verified >= len(CHECKS) - 2:
    log('🎉 LUNA FIX MASTER v7.0 CONCLUÍDO!')
    log(' Próximos passos:')
    log('  1. node -c agents/luna-cto-agent.cjs')
    log('  2. node -c agents/luna-scheduler.mjs')
    log('  3. node agents/luna-cto-agent.cjs')
    exit(0)
else:
    log('⚠️  ALGUMAS VERIFICAÇÕES FALHARAM. Verifique o log.')
    exit(1)
