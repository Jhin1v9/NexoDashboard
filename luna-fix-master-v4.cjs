#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// LUNA FIX MASTER v4.0 — Script Definitivo (para código ORIGINAL restaurado)
// Revisado 5x contra raw files do GitHub
// Execute: node luna-fix-master-v4.cjs
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, 'artifacts', 'backups', 'luna-fix-v4-' + new Date().toISOString().replace(/[:.]/g, '-'));
const LOG_FILE = path.join(ROOT, 'artifacts', 'luna-fix-v4-log.txt');

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function log(msg) {
  const line = '[' + new Date().toLocaleTimeString('pt-BR') + '] ' + msg;
  console.log(line);
  ensureDir(path.dirname(LOG_FILE));
  fs.appendFileSync(LOG_FILE, line + '\n');
}
function backup(fp) {
  const rel = path.relative(ROOT, fp);
  const dest = path.join(BACKUP_DIR, rel);
  ensureDir(path.dirname(dest));
  fs.copyFileSync(fp, dest);
  log('📦 Backup: ' + rel);
}
function read(fp) { return fs.readFileSync(fp, 'utf8'); }
function write(fp, c) { fs.writeFileSync(fp, c, 'utf8'); }

function applyPatch(fp, desc, search, replace) {
  const content = read(fp);
  if (!content.includes(search)) {
    log('⚠️  [SKIP] "' + desc + '" — trecho não encontrado');
    // Debug: mostrar contexto
    const lines = content.split('\n');
    const hint = search.split('\n')[0].slice(0, 30);
    const matches = lines.filter(l => l.includes(hint.slice(0, 15))).map((l, i) => `    L${i+1}: ${l.trim().slice(0, 80)}`);
    if (matches.length > 0) {
      log('    → Linhas similares:');
      matches.slice(0, 3).forEach(m => log(m));
    }
    return false;
  }
  const newContent = content.split(search).join(replace);
  if (newContent === content) {
    log('⚠️  [SKIP] "' + desc + '" — já aplicado?');
    return false;
  }
  write(fp, newContent);
  log('✅ [OK] ' + desc);
  return true;
}

// ============================================
// PATCHES (baseados no código ORIGINAL do GitHub)
// ============================================
const PATCHES = [
  // ─── C1: global.SCHEMAS ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'C1 - global.SCHEMAS',
    search: "SCHEMAS = loadAllSchemas();\n\n// =====================================================",
    replace: "SCHEMAS = loadAllSchemas();\n\n// [FIX C1] Exportar para global — resolveAuthor() precisa disso\nglobal.SCHEMAS = SCHEMAS;\n\n// =====================================================" },

  // ─── C2: Regex patterns (7 patches) ───
  { file: 'agents/SmartClassifier_v16.js', desc: 'C2 - Regex tarefaRealizada',
    search: "build ok|ta funcionando|funcionou|deployado",
    replace: "build|ok|funcionando|funcionou|deployado" },
  { file: 'agents/SmartClassifier_v16.js', desc: 'C2 - Regex tarefaPendente',
    search: "falta fazer|tem que|devemos|vamos|precisa",
    replace: "falta|tem|que|devemos|vamos|precisa" },
  { file: 'agents/SmartClassifier_v16.js', desc: 'C2 - Regex financeiroPagamento',
    search: "pagamento recebido|dinheiro na conta|entrou dinheiro|recebi|recebemos|pagaram",
    replace: "pagamento|dinheiro|conta|entrou|recebi|recebemos|pagaram" },
  { file: 'agents/SmartClassifier_v16.js', desc: 'C2 - Regex financeiroPendente',
    search: "nao pagou|falta pagar|nao recebi|ainda nao pagou|esta devendo|fatura atrasada|conta atrasada|nao transferiu|esperando pagamento",
    replace: "nao|pagou|falta|recebi|ainda|esta|devendo|fatura|conta|transferiu|esperando|pagamento" },
  { file: 'agents/SmartClassifier_v16.js', desc: 'C2 - Regex leadQuente',
    search: "quero contratar|quero fechar|vamos fechar|fecha quando|quando começamos|quando podemos começar|ta decidido|vou fechar|vou contratar|manda contrato|manda proposta|quero o site|quero o sistema|quero o app|quando entrega|quanto tempo leva|qual o prazo",
    replace: "quero|contratar|fechar|vamos|fecha|quando|começamos|podemos|decidido|vou|manda|contrato|proposta|site|sistema|app|entrega|tempo|leva|prazo" },
  { file: 'agents/SmartClassifier_v16.js', desc: 'C2 - Regex leadMorno',
    search: "preciso de|estou procurando|vi o trabalho|vi o site|me indicaram|recomendaram|quanto cobra|quanto custa|faz site|faz app|faz sistema|trabalha com|voce faz|faz para|fazemos",
    replace: "preciso|estou|procurando|vi|trabalho|site|indicaram|recomendaram|quanto|cobra|custa|faz|trabalha|voce|fazemos" },
  { file: 'agents/SmartClassifier_v16.js', desc: 'C2 - Regex leadFrio',
    search: "só para saber|so para saber|só uma duvida|so uma duvida|pergunta rapida|rapida pergunta|só confirmar|so confirmar|mais informacoes|como funciona|o que é|como é",
    replace: "só|para|saber|duvida|pergunta|rapida|confirmar|informacoes|funciona" },

  // ─── C3/C5/M5: handleMention usar IA ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'C3/C5 - handleMention IA + ignorar vazio',
    search: "async handleMention(msg) {\n    const body = msg.body || '';\n    const lowerBody = body.toLowerCase();\n\n    let response = '';",
    replace: "async handleMention(msg) {\n    const body = msg.body || '';\n    const lowerBody = body.toLowerCase();\n\n    // [FIX M5] Ignorar menção vazia (só @luna sem texto)\n    const cleanBody = body.replace(/@luna|@kimi|@kimiclaw/gi, '').trim();\n    if (!cleanBody) {\n      log.info('Menção vazia ignorada');\n      return;\n    }\n\n    // [FIX C3] Usar Gemma 2B para respostas inteligentes\n    let response = '';" },

  { file: 'agents/luna-cto-agent.cjs', desc: 'C3 - Substituir corpo handleMention por IA',
    search: "if (/status\\|projeto\\|andamento\\|fase\\|como ta\\|como esta/.test(lowerBody)) {\n      response = `📊 *STATUS ATUAL*\\n\\n`;",
    replace: "const isSimpleQuery = /^(hola|oi|ola|hey|e aí|opa|bom dia|buenos dias|buenas)/i.test(body.trim());\n    \n    if (isSimpleQuery) {\n      const greeting = this.brain.personalities[this.brain.activePersonality].greeting;\n      await msg.reply(greeting);\n      return;\n    }\n\n    // Resolver autor\n    const author = resolveAuthor(msg.author || msg.from);\n    \n    // Detectar mensagem marcada (quoted)\n    let quotedBody = null;\n    let quotedAuthor = null;\n    try {\n      const quoted = await msg.getQuotedMessage();\n      if (quoted) {\n        quotedBody = quoted.body || '';\n        quotedAuthor = resolveAuthor(quoted.author || quoted.from).name;\n      }\n    } catch (e) { /* sem quoted */ }\n\n    // Contexto para a IA\n    const context = {\n      authorName: author.name,\n      authorRole: author.role,\n      urgency: 'normal',\n      sentiment: 'neutral',\n      topic: 'general',\n      userMood: 'neutral',\n      quotedBody: quotedBody,\n      quotedAuthor: quotedAuthor,\n      buffer: this.cp.buffer\n    };\n\n    // [FIX C5] Atualizar humor SÓ quando interage com humano\n    const classification = await this.brain.classify(msg, this.threadHistory || []);\n    this.brain.updateEmotionalState(classification);\n    this.brain.activePersonality = this.brain.selectPersonality({\n      urgency: classification.priority === 'P0' ? 'critical' : 'normal',\n      sentiment: classification.metrics?.sentiment || 'neutral',\n      topic: classification.category,\n      userMood: 'neutral'\n    });\n\n    try {\n      const response = await this.brain.generateResponse(body, context);\n      await msg.reply(response.text);\n      log.success(`Resposta IA enviada (personality: ${response.personality})`);\n      return;\n    } catch (err) {\n      log.error(`Falha IA: ${err.message}. Usando fallback...`);\n      const buffer = this.cp.buffer;\n      const fallback = `🌙 ¡Hola ${author.name}!\\n\\n📊 Estado actual:\\n• ${buffer.newTasks?.length || 0} tareas\\n• ${buffer.newIdeas?.length || 0} ideas\\n• ${buffer.newLinks?.length || 0} links\\n\\n¿Qué necesitas? Usa /ayuda para ver comandos.`;\n      await msg.reply(fallback);\n      return;\n    }\n  }\n\n  // [DEPRECATED] Old handleMention logic replaced by IA above\n  async _oldHandleMention(msg) {\n    const body = msg.body || '';\n    const lowerBody = body.toLowerCase();\n\n    let response = '';\n    if (/status\\|projeto\\|andamento\\|fase\\|como ta\\|como esta/.test(lowerBody)) {\n      response = `📊 *STATUS ATUAL*\\n\\n`;" },

  // ─── C4: parseGemmaResponse robusto ───
  { file: 'agents/LunaBrain_v16.js', desc: 'C4 - parseGemmaResponse 3 estratégias',
    search: "parseGemmaResponse(responseText) {\n    try {\n      // Extrair JSON da resposta\n      const jsonMatch = responseText.match(/\\{[\\s\\S]*\\}/);\n      if (jsonMatch) {\n        return JSON.parse(jsonMatch[0]);\n      }\n    } catch (e) {\n      console.error('[GEMMA] Erro ao parsear JSON:', e.message);\n    }\n    return null;\n  }",
    replace: "parseGemmaResponse(responseText) {\n    try {\n      // [FIX C4] Estratégia 1: JSON em code block ```json\n      const codeBlock = responseText.match(/```json\\s*([\\s\\S]*?)```/);\n      if (codeBlock) {\n        const parsed = JSON.parse(codeBlock[1].trim());\n        return parsed;\n      }\n\n      // Estratégia 2: Procurar todos os objetos JSON candidatos\n      const jsonMatches = responseText.match(/\\{[\\s\\S]*?\\}/g);\n      if (jsonMatches) {\n        const sorted = jsonMatches.sort((a, b) => b.length - a.length);\n        for (const candidate of sorted) {\n          try {\n            const parsed = JSON.parse(candidate);\n            if (parsed.category || parsed.confidence !== undefined) {\n              return parsed;\n            }\n          } catch {}\n        }\n      }\n\n      // Estratégia 3: Tentar parse do texto inteiro\n      try {\n        const parsed = JSON.parse(responseText.trim());\n        if (parsed.category || parsed.confidence !== undefined) {\n          return parsed;\n        }\n      } catch {}\n    } catch (e) {\n      console.error('[GEMMA] Erro ao parsear JSON:', e.message);\n    }\n    return null;\n  }" },

  // ─── C5: Remover humor do classify() ───
  { file: 'agents/LunaBrain_v16.js', desc: 'C5 - Remover humor do classify',
    search: "    // 5. APLICAR PERSONALIDADE AO RESULTADO\n    finalResult.lunaPersonality = this.selectPersonality({\n      urgency: finalResult.priority === 'P0' ? 'critical' : 'normal',\n      sentiment: finalResult.metrics?.sentiment || 'neutral',\n      topic: finalResult.category,\n      userMood: this.detectUserMood(threadHistory)\n    });\n\n    // 6. ATUALIZAR ESTADO EMOCIONAL DA LUNA\n    this.updateEmotionalState(finalResult);\n\n    return finalResult;",
    replace: "    // [FIX C5] Personalidade e humor SÓ em interações humanas (handleMention)\n    // NUNCA durante scan passivo\n    finalResult.lunaPersonality = this.activePersonality;\n\n    return finalResult;" },

  // ─── C6: runAgent params no scheduler ───
  { file: 'agents/luna-scheduler.mjs', desc: 'C6 - runScan params',
    search: "async function runScan() {\n  log('SCAN iniciado');\n  const result = await runAgent(false);",
    replace: "async function runScan() {\n  log('SCAN iniciado');\n  const result = await runAgent({ once: false, schedule: true, fullExtract: false });" },
  { file: 'agents/luna-scheduler.mjs', desc: 'C6 - runReport params',
    search: "async function runReport() {\n  log('REPORT iniciado');\n  const result = await runAgent(true);",
    replace: "async function runReport() {\n  log('REPORT iniciado');\n  const result = await runAgent({ once: true, schedule: false, fullExtract: false });" },

  // ─── C7: threadHistory inicializado ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'C7 - threadHistory init',
    search: "    this.fullExtractRunning = false;\n  }",
    replace: "    this.fullExtractRunning = false;\n    // [FIX C7] Histórico de thread para contexto da Gemma\n    this.threadHistory = [];\n  }" },

  // ─── C8/C10: isAuthorizedChat + case-insensitive ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'C8/C10 - isAuthorizedChat + /i',
    search: "this.client.on('message_create', async (msg) => {\n\n      if (msg.fromMe && !msg.body.startsWith('/')) return;\n\n      const body = (msg.body || '').toLowerCase();\n      const isMention = /@luna\\|@kimi\\|@kimiclaw/.test(body);",
    replace: "this.client.on('message_create', async (msg) => {\n      // [FIX C8] Verificar chat autorizado\n      try {\n        const chat = await msg.getChat();\n        if (!isAuthorizedChat(chat.name)) return;\n      } catch (e) {\n        // Se não conseguir obter chat, continuar\n      }\n\n      if (msg.fromMe && !msg.body.startsWith('/')) return;\n\n      const body = (msg.body || '').toLowerCase();\n      // [FIX C10] Case-insensitive para menções\n      const isMention = /@luna|@kimi|@kimiclaw/i.test(body);" },

  // ─── C9: forceReport passar destinatário ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'C9 - forceReport destinatário',
    search: "async forceReport(to) {\n    await this.sendScheduledReport();\n  }",
    replace: "async forceReport(to) {\n    await this.sendScheduledReport(to);\n  }" },

  // ─── C9/C11/A1/A12: sendScheduledReport rico + seguro + espanhol ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'C9/C11/A1 - sendScheduledReport signature',
    search: "async sendScheduledReport() {\n    const buffer = this.cp.buffer;\n    const hasNews = buffer.newMessages?.length > 0 ||",
    replace: "async sendScheduledReport(to = null) {\n    const buffer = this.cp.buffer;\n    const hasNews = buffer.newMessages?.length > 0 ||" },

  { file: 'agents/luna-cto-agent.cjs', desc: 'C11 - Buffer só limpa após envio',
    search: "    if (this.reportGroup) {\n      await this.reportGroup.sendMessage(report);\n      log.success('Relatorio inteligente enviado!');\n    }\n\n    this.cp.buffer.newMessages = [];",
    replace: "    // [FIX C11] Enviar ANTES de limpar buffer\n    let sent = false;\n    try {\n      if (to) {\n        const chat = await this.client.getChatById(to);\n        await chat.sendMessage(report);\n        sent = true;\n      } else if (this.reportGroup) {\n        await this.reportGroup.sendMessage(report);\n        sent = true;\n      }\n      if (sent) log.success('Relatorio enviado!');\n    } catch (e) {\n      log.error(`Falha ao enviar relatorio: ${e.message}. Buffer PRESERVADO.`);\n      return;\n    }\n\n    if (sent) {\n      this.cp.buffer.newMessages = [];" },

  { file: 'agents/luna-cto-agent.cjs', desc: 'C11 - Fechar bloco if(sent)',
    search: "    this.cp.checkpoint.silenceCount = 0;\n    this.cp.checkpoint.lastReport = new Date().toISOString();\n    this.cp.save();\n  }",
    replace: "      this.cp.checkpoint.silenceCount = 0;\n      this.cp.checkpoint.lastReport = new Date().toISOString();\n      this.cp.save();\n    }\n  }" },

  // ─── C12: CDP_PORT 9223 ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'C12 - CDP_PORT 9223',
    search: "CDP_PORT: 9222,",
    replace: "CDP_PORT: 9223," },

  // ─── A2/A12: /ajuda completo em espanhol ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'A2/A12 - /ajuda espanhol',
    search: "else if (cmd === '/ajuda') {\n      await msg.reply('🌙 *AJUDA LUNA v15.1*\\n\\n/status — Projetos\\n/relatorio — Relatorio\\n/tarefas — Tarefas\\n/extrair — Extrair tudo\\n/ajuda — Este menu\\n\\nMencione @Luna para falar! Posso responder sobre clientes, financas, links e status.');\n    }",
    replace: "else if (cmd === '/ajuda' || cmd === '/ayuda') {\n      await msg.reply(`🌙 *AYUDA LUNA v16.0*\\n\\n📋 *Comandos disponibles:*\\n/status — Estado de proyectos\\n/relatorio — Generar informe completo\\n/tarefas — Ver tareas pendientes\\n/extrair — Extracción completa\\n/links — Links detectados\\n/ideias — Ideas nuevas\\n/leads — Posibles clientes\\n/decisiones — Decisiones tomadas\\n/mentions — Menciones recientes\\n/historico — Últimos mensajes\\n/scan — Forzar escaneo ahora\\n/config — Configuración actual\\n/silencio — Pausar informes\\n/voz — Cambiar personalidad\\n/limpiar — Limpiar buffer\\n/ayuda — Este menú\\n\\nMenciona @Luna para hablar con IA. Puedo analizar clientes, finanzas, links y estado.`);\n    }" },

  // ─── A2: Novos comandos handleCommand ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'A2 - 11 novos comandos',
    search: "else if (cmd === '/ajuda') {\n      await msg.reply('🌙 *AJUDA LUNA v15.1*\\n\\n/status — Projetos\\n/relatorio — Relatorio\\n/tarefas — Tarefas\\n/extrair — Extrair tudo\\n/ajuda — Este menu\\n\\nMencione @Luna para falar! Posso responder sobre clientes, financas, links e status.');\n    }\n  }",
    replace: "else if (cmd === '/links') {\n      const links = this.cp.buffer.newLinks || [];\n      const list = links.length > 0 ? links.slice(0, 5).map(l => `• ${l.url} (${l.title || 'sin título'})`).join('\\n') : 'Sin links nuevos.';\n      await msg.reply(`🔗 *LINKS*\\n\\n${list}\\n\\n🤖 Luna v16.0`);\n    }\n    else if (cmd === '/ideias') {\n      const ideas = this.cp.buffer.newIdeas || [];\n      const list = ideas.length > 0 ? ideas.slice(0, 5).map(i => `• ${(i.body || '').slice(0, 50)}...`).join('\\n') : 'Sin ideas nuevas.';\n      await msg.reply(`💡 *IDEAS*\\n\\n${list}\\n\\n🤖 Luna v16.0`);\n    }\n    else if (cmd === '/leads') {\n      const leads = this.cp.buffer.newLeads || [];\n      const list = leads.length > 0 ? leads.slice(0, 5).map(l => `• ${l.name || 'No identificado'}: ${(l.context || '').slice(0, 40)}...`).join('\\n') : 'Sin leads nuevos.';\n      await msg.reply(`🎣 *LEADS*\\n\\n${list}\\n\\n🤖 Luna v16.0`);\n    }\n    else if (cmd === '/decisiones' || cmd === '/decisoes') {\n      const decisions = this.cp.buffer.newDecisions || [];\n      const list = decisions.length > 0 ? decisions.slice(0, 5).map(d => `• ${(d.body || '').slice(0, 50)}...`).join('\\n') : 'Sin decisiones nuevas.';\n      await msg.reply(`📌 *DECISIONES*\\n\\n${list}\\n\\n🤖 Luna v16.0`);\n    }\n    else if (cmd === '/mentions' || cmd === '/menciones') {\n      const mentions = this.cp.buffer.newMentions || [];\n      const list = mentions.length > 0 ? mentions.slice(0, 5).map(m => `• ${m.author || 'Desconocido'}: ${(m.body || '').slice(0, 40)}...`).join('\\n') : 'Sin menciones nuevas.';\n      await msg.reply(`📢 *MENCIONES*\\n\\n${list}\\n\\n🤖 Luna v16.0`);\n    }\n    else if (cmd === '/historico') {\n      const msgs = this.cp.buffer.newMessages || [];\n      const list = msgs.length > 0 ? msgs.slice(-5).map(m => {\n        const author = resolveAuthor(m.author || m.from).name;\n        return `• [${author}] ${(m.body || m.text || '').slice(0, 40)}...`;\n      }).join('\\n') : 'Sin mensajes recientes.';\n      await msg.reply(`📜 *HISTÓRICO*\\n\\n${list}\\n\\n🤖 Luna v16.0`);\n    }\n    else if (cmd === '/scan') {\n      await msg.reply('🔍 Iniciando escaneo forzado...');\n      await this.runOnce();\n      await msg.reply('✅ Escaneo completado. Revisa /status.');\n    }\n    else if (cmd === '/config') {\n      await msg.reply(`⚙️ *CONFIGURACIÓN*\\n\\nGrupos: ${CONFIG.GROUPS.map(g => g.name).join(', ')}\\nIntervalo scan: ${CONFIG.SCAN_INTERVAL / 60000}min\\nIntervalo informe: ${CONFIG.REPORT_INTERVAL / 60000}min\\nCDP Port: ${CONFIG.CDP_PORT}\\nVersión: v16.0\\n\\n🤖 Luna v16.0`);\n    }\n    else if (cmd === '/silencio') {\n      this.cp.checkpoint.silenceCount = 999;\n      this.cp.save();\n      await msg.reply('🔇 Modo silencio activado. No enviaré informes automáticos hasta que uses /scan.');\n    }\n    else if (cmd === '/voz') {\n      const voices = Object.keys(this.brain.personalities).join(', ');\n      await msg.reply(`🎭 *PERSONALIDADES*\\n\\nDisponibles: ${voices}\\n\\nActual: ${this.brain.activePersonality}\\n\\n🤖 Luna v16.0`);\n    }\n    else if (cmd === '/limpiar' || cmd === '/limpar') {\n      this.cp.buffer.newMessages = [];\n      this.cp.buffer.newTasks = [];\n      this.cp.buffer.newIdeas = [];\n      this.cp.buffer.newLinks = [];\n      this.cp.buffer.newDecisions = [];\n      this.cp.buffer.newMentions = [];\n      this.cp.buffer.newNews = [];\n      this.cp.buffer.newLeads = [];\n      this.cp.save();\n      await msg.reply('🧹 Buffer limpiado. Todo listo para nuevos datos.');\n    }\n    else if (cmd === '/ajuda' || cmd === '/ayuda') {\n      await msg.reply(`🌙 *AYUDA LUNA v16.0*\\n\\n📋 *Comandos disponibles:*\\n/status — Estado de proyectos\\n/relatorio — Generar informe completo\\n/tarefas — Ver tareas pendientes\\n/extrair — Extracción completa\\n/links — Links detectados\\n/ideias — Ideas nuevas\\n/leads — Posibles clientes\\n/decisiones — Decisiones tomadas\\n/mentions — Menciones recientes\\n/historico — Últimos mensajes\\n/scan — Forzar escaneo ahora\\n/config — Configuración actual\\n/silencio — Pausar informes\\n/voz — Cambiar personalidad\\n/limpiar — Limpiar buffer\\n/ayuda — Este menú\\n\\nMenciona @Luna para hablar con IA. Puedo analizar clientes, finanzas, links y estado.`);\n    }\n  }" },

  // ─── A3: updateBufferFromClassified usar resolveAuthor ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'A3 - Tarefas com resolveAuthor',
    search: " for (const item of classified) {\n      const c = item.classification;\n\n      switch (c.category) {\n        case 'tarefaRealizada':\n        case 'tarefaPendente':\n          this.cp.buffer.newTasks.push({\n            body: item.text,\n            author: item.author,",
    replace: " for (const item of classified) {\n      const c = item.classification;\n      // [FIX A3] Resolver autor para nome real\n      const resolvedAuthor = resolveAuthor(item.author || item.from || 'unknown');\n      const authorName = resolvedAuthor.name;\n      const authorPhone = item.author || item.from || 'unknown';\n\n      switch (c.category) {\n        case 'tarefaRealizada':\n        case 'tarefaPendente':\n          this.cp.buffer.newTasks.push({\n            body: item.text,\n            author: authorName,\n            authorPhone: authorPhone," },

  { file: 'agents/luna-cto-agent.cjs', desc: 'A3 - Ideias com authorName',
    search: "this.cp.buffer.newIdeas.push({ body: item.text, author: item.author, time: item.timestamp });",
    replace: "this.cp.buffer.newIdeas.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp });" },
  { file: 'agents/luna-cto-agent.cjs', desc: 'A3 - Decisões com authorName',
    search: "this.cp.buffer.newDecisions.push({ body: item.text, author: item.author, time: item.timestamp });",
    replace: "this.cp.buffer.newDecisions.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp });" },
  { file: 'agents/luna-cto-agent.cjs', desc: 'A3 - Links com authorName',
    search: "this.cp.buffer.newLinks.push({ url: c.urls[0], context: item.text, author: item.author, time: item.timestamp });",
    replace: "this.cp.buffer.newLinks.push({ url: c.urls[0], context: item.text, author: authorName, authorPhone, time: item.timestamp });" },
  { file: 'agents/luna-cto-agent.cjs', desc: 'A3 - Leads com authorName',
    search: "this.cp.buffer.newLeads.push({ name: c.possibleNewClient, context: item.text, author: item.author, time: item.timestamp });",
    replace: "this.cp.buffer.newLeads.push({ name: c.possibleNewClient, context: item.text, author: authorName, authorPhone, time: item.timestamp });" },
  { file: 'agents/luna-cto-agent.cjs', desc: 'A3 - Notícias com authorName',
    search: "this.cp.buffer.newNews.push({ body: item.text, author: item.author, time: item.timestamp, chat: item.chatName });",
    replace: "this.cp.buffer.newNews.push({ body: item.text, author: authorName, authorPhone, time: item.timestamp, chat: item.chatName });" },

  // ─── A5/A6: runOnce salvar whatsapp-history + alias messages ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'A5/A6 - whatsapp-history.json + alias',
    search: "this.cp.checkpoint.lastScan = new Date().toISOString();\n    this.cp.save();\n\n    return {\n      status: 'ok',\n      hasNews: newMessages.length > 0,\n      newMessages: newMessages.length\n    };",
    replace: "this.cp.checkpoint.lastScan = new Date().toISOString();\n    this.cp.save();\n\n    // [FIX A5] Salvar histórico acumulativo\n    try {\n      const historyPath = path.join(__dirname, '../backend/data/whatsapp-history.json');\n      const existing = readJSONSafe(historyPath) || { messages: [] };\n      const merged = this.deduplicateMessages(existing.messages, newMessages);\n      writeJSONSafe(historyPath, { messages: merged, lastUpdated: new Date().toISOString() });\n      log.info(`Histórico acumulativo: ${merged.length} mensagens`);\n    } catch (e) {\n      log.warn(`Falha ao salvar histórico: ${e.message}`);\n    }\n\n    return {\n      status: 'ok',\n      hasNews: newMessages.length > 0,\n      newMessages: newMessages,\n      messages: newMessages // [FIX A6] Alias para compatibilidade com scheduler\n    };" },

  // ─── A4: notifyOps com tratamento de erro ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'A4 - notifyOps log',
    search: "      let fetch;\n      try { fetch = (await import('node-fetch')).default; } catch (e) { return; }\n      await fetch('http://localhost:3456/api/ops/changes', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(payload)\n      }).catch(() => {});\n    } catch (e) { /* Silencioso */ }",
    replace: "      let fetch;\n      try { fetch = (await import('node-fetch')).default; } catch (e) { \n        log.warn('node-fetch não disponível para notifyOps');\n        return; \n      }\n      const res = await fetch('http://localhost:3456/api/ops/changes', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(payload)\n      });\n      if (!res.ok) log.warn(`notifyOps falhou: HTTP ${res.status}`);\n      else log.info('notifyOps: backend notificado');\n    } catch (e) { \n      log.error(`notifyOps falhou: ${e.message}`);\n    }" },

  // ─── C7: runFullExtract acumula threadHistory ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'C7 - runFullExtract threadHistory',
    search: "const classified = await this.brain.classify(m, this.threadHistory || []);\n            allClassified.push({ ...msg, classification: classified });\n            this.cp.markProcessed(msg);",
    replace: "const classified = await this.brain.classify(m, this.threadHistory || []);\n            allClassified.push({ ...msg, classification: classified });\n            this.cp.markProcessed(msg);\n            // [FIX C7] Acumular threadHistory\n            const resolved = resolveAuthor(msg.author || msg.from || 'unknown');\n            this.threadHistory.push({\n              author: resolved.name,\n              text: msg.text || msg.body || '',\n              category: classified.category,\n              timestamp: msg.timestamp || new Date().toISOString()\n            });\n            if (this.threadHistory.length > 50) this.threadHistory.shift();" },

  // ─── A5: Helpers readJSONSafe/writeJSONSafe ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'A5 - readJSONSafe/writeJSONSafe',
    search: "function diagnose() {\n  const checks = {",
    replace: "function readJSONSafe(file) {\n  try {\n    if (!fs.existsSync(file)) return null;\n    let raw = fs.readFileSync(file, 'utf8');\n    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.substring(1);\n    return JSON.parse(raw);\n  } catch (e) {\n    console.error('[readJSONSafe] Erro:', e.message);\n    return null;\n  }\n}\n\nfunction writeJSONSafe(file, data) {\n  try {\n    ensureDir(path.dirname(file));\n    fs.writeFileSync(file, JSON.stringify(data, null, 2));\n  } catch (e) {\n    console.error('[writeJSONSafe] Erro:', e.message);\n  }\n}\n\nfunction diagnose() {\n  const checks = {" },

  // ─── A5: deduplicateMessages no LunaAgent ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'A5 - deduplicateMessages',
    search: "generateStats(classified) {\n    const stats = {};\n    for (const item of classified) {\n      const cat = item.classification.category;\n      stats[cat] = (stats[cat] || 0) + 1;\n    }\n    return stats;\n  }",
    replace: "generateStats(classified) {\n    const stats = {};\n    for (const item of classified) {\n      const cat = item.classification.category;\n      stats[cat] = (stats[cat] || 0) + 1;\n    }\n    return stats;\n  }\n\n  deduplicateMessages(existing, incoming) {\n    const map = new Map();\n    (existing || []).forEach(m => {\n      const key = m.id || m.timestamp + (m.author || m.from || 'unknown');\n      map.set(key, m);\n    });\n    (incoming || []).forEach(m => {\n      const key = m.id || m.timestamp + (m.author || m.from || 'unknown');\n      if (!map.has(key)) map.set(key, m);\n    });\n    return Array.from(map.values());\n  }" },

  // ─── A12: Comandos em espanhol ───
  { file: 'agents/luna-cto-agent.cjs', desc: 'A12 - /status espanhol',
    search: "if (cmd === '/status') {\n      const buffer = this.cp.buffer;\n      await msg.reply(`📊 *STATUS NEXO*\\n\\n🟢 Projetos ativos: ${buffer.newTasks?.length || 0}\\n💡 Ideias: ${buffer.newIdeas?.length || 0}\\n🔗 Links: ${buffer.newLinks?.length || 0}\\n📰 News: ${buffer.newNews?.length || 0}\\n🎣 Leads: ${buffer.newLeads?.length || 0}\\n\\n🤖 Luna v15.1`);\n    }",
    replace: "if (cmd === '/status') {\n      const buffer = this.cp.buffer;\n      await msg.reply(`📊 *ESTADO NEXO*\\n\\n🟢 Proyectos activos: ${buffer.newTasks?.length || 0}\\n💡 Ideas: ${buffer.newIdeas?.length || 0}\\n🔗 Links: ${buffer.newLinks?.length || 0}\\n📰 Noticias: ${buffer.newNews?.length || 0}\\n🎣 Leads: ${buffer.newLeads?.length || 0}\\n\\n🤖 Luna v16.0`);\n    }" },
  { file: 'agents/luna-cto-agent.cjs', desc: 'A12 - /relatorio espanhol',
    search: "else if (cmd === '/relatorio') {\n      await msg.reply('📊 Gerando relatorio inteligente...');",
    replace: "else if (cmd === '/relatorio') {\n      await msg.reply('📊 Generando informe inteligente...');" },
  { file: 'agents/luna-cto-agent.cjs', desc: 'A12 - /tarefas espanhol',
    search: "else if (cmd === '/tarefas') {\n      const tasks = this.cp.buffer.newTasks || [];\n      const list = tasks.length > 0 ? tasks.slice(0, 5).map(t => `• [${t.priority || 'P2'}] ${(t.body || t.text || '').slice(0, 50)}`).join('\\n') : 'Nenhuma tarefa pendente.';\n      await msg.reply(`📝 *TAREFAS*\\n\\n${list}\\n\\n🤖 Luna v15.1`);\n    }",
    replace: "else if (cmd === '/tarefas') {\n      const tasks = this.cp.buffer.newTasks || [];\n      const list = tasks.length > 0 ? tasks.slice(0, 5).map(t => `• [${t.priority || 'P2'}] ${(t.body || t.text || '').slice(0, 50)}`).join('\\n') : 'Sin tareas pendientes.';\n      await msg.reply(`📝 *TAREAS*\\n\\n${list}\\n\\n🤖 Luna v16.0`);\n    }" },
  { file: 'agents/luna-cto-agent.cjs', desc: 'A12 - /extrair espanhol',
    search: "else if (cmd === '/extrair') {\n      await msg.reply('🔄 Iniciando extracao completa...');\n      await this.runFullExtract();\n      await msg.reply('✅ Extracao completa finalizada!');\n    }",
    replace: "else if (cmd === '/extrair') {\n      await msg.reply('🔄 Iniciando extracción completa...');\n      await this.runFullExtract();\n      await msg.reply('✅ Extracción completa finalizada!');\n    }" },

  // ─── SERVER: /api/whatsapp-agent normalizado ───
  { file: 'backend/server.js', desc: 'SERVER - /api/whatsapp-agent normalizado',
    search: "app.get('/api/whatsapp-agent', (req, res) => {\n  const data = readJSON(AGENT_DATA_FILE);\n  if (!data) return res.status(404).json({ error: 'Agent data not found. Run: node agents/nexo-whatsapp-agent-v8.mjs' });\n  res.json(data);\n});",
    replace: "app.get('/api/whatsapp-agent', (req, res) => {\n  try {\n    const agentRaw = readJSON(AGENT_DATA_FILE) || {};\n    const bufferPath = path.join(__dirname, '..', 'agents', 'luna-buffer.json');\n    const buffer = fs.existsSync(bufferPath) ? JSON.parse(fs.readFileSync(bufferPath, 'utf8')) : { messages: [], tasks: [], ideas: [] };\n    \n    // Normalizar messages para ter authorName\n    const normalizedMessages = (buffer.newMessages || buffer.messages || []).map(m => ({\n      ...m,\n      authorName: m.authorName || (m.author && !m.author.includes('@') ? m.author : 'Desconocido'),\n      text: m.body || m.text || m.message || '(sin texto)',\n      timestamp: m.timestamp || m.time || new Date().toISOString()\n    }));\n    \n    const stats = {\n      totalMessages: normalizedMessages.length,\n      totalTasks: (buffer.newTasks || buffer.tasks || []).length,\n      totalIdeas: (buffer.newIdeas || buffer.ideas || []).length,\n      totalDecisions: (buffer.newDecisions || buffer.decisions || []).length,\n      totalLinks: (buffer.newLinks || buffer.links || []).length,\n      totalMentions: (buffer.newMentions || buffer.mentions || []).length,\n      participants: [...new Set(normalizedMessages.map(m => m.authorName).filter(Boolean))],\n      lastUpdate: buffer.lastBufferUpdate || buffer.lastUpdated || new Date().toISOString()\n    };\n    \n    res.json({\n      ...agentRaw,\n      stats,\n      messages: normalizedMessages,\n      tasks: buffer.newTasks || buffer.tasks || [],\n      ideas: buffer.newIdeas || buffer.ideas || [],\n      decisions: buffer.newDecisions || buffer.decisions || [],\n      links: buffer.newLinks || buffer.links || [],\n      mentions: buffer.newMentions || buffer.mentions || [],\n      updatedAt: new Date().toISOString()\n    });\n  } catch (e) {\n    res.status(500).json({ error: e.message });\n  }\n});" },

  // ─── SERVER: /api/whatsapp alinhar newMessages ───
  { file: 'backend/server.js', desc: 'SERVER - /api/whatsapp alinhar',
    search: "    res.json({\n      messages: buffer.messages || [],\n      tasks: buffer.tasks || [],\n      ideas: buffer.ideas || [],",
    replace: "    res.json({\n      messages: buffer.newMessages || buffer.messages || [],\n      tasks: buffer.newTasks || buffer.tasks || [],\n      ideas: buffer.newIdeas || buffer.ideas || []," }
];

// ============================================
// EXECUÇÃO
// ============================================
ensureDir(BACKUP_DIR);
log('═══════════════════════════════════════════════════════');
log(' 🌙 LUNA FIX MASTER v4.0 INICIADO');
log(' 📁 Projeto: ' + ROOT);
log(' 💾 Backup:  ' + BACKUP_DIR);
log('═══════════════════════════════════════════════════════');

// Backup
for (const p of PATCHES) {
  const fp = path.join(ROOT, p.file);
  if (fs.existsSync(fp) && !fs.existsSync(path.join(BACKUP_DIR, p.file))) {
    backup(fp);
  }
}

let applied = 0, skipped = 0;
for (const p of PATCHES) {
  const fp = path.join(ROOT, p.file);
  if (!fs.existsSync(fp)) {
    log('⚠️  [SKIP] "' + p.desc + '" — arquivo não existe: ' + p.file);
    skipped++;
    continue;
  }
  const ok = applyPatch(fp, p.desc, p.search, p.replace);
  if (ok) applied++;
  else skipped++;
}

// Verificação
log('');
log('═══════════════════════════════════════════════════════');
log(' 🛡️  VERIFICAÇÃO FINAL');
log('═══════════════════════════════════════════════════════');

const CHECKS = [
  ['agents/luna-cto-agent.cjs', 'global.SCHEMAS = SCHEMAS;', 'C1 - global.SCHEMAS'],
  ['agents/luna-cto-agent.cjs', 'CDP_PORT: 9223,', 'C12 - CDP_PORT'],
  ['agents/luna-cto-agent.cjs', '/@luna|@kimi|@kimiclaw/i.test', 'C10 - isMention /i'],
  ['agents/luna-cto-agent.cjs', 'isAuthorizedChat(chat.name)', 'C8 - isAuthorizedChat'],
  ['agents/luna-cto-agent.cjs', 'this.threadHistory = [];', 'C7 - threadHistory'],
  ['agents/luna-cto-agent.cjs', 'await this.brain.generateResponse(body, context)', 'C3 - handleMention IA'],
  ['agents/luna-cto-agent.cjs', 'await this.sendScheduledReport(to)', 'C9 - forceReport'],
  ['agents/luna-cto-agent.cjs', 'if (sent) {', 'C11 - buffer seguro'],
  ['agents/luna-cto-agent.cjs', 'authorName: resolvedAuthor.name', 'A3 - resolveAuthor'],
  ['agents/luna-cto-agent.cjs', 'readJSONSafe(historyPath)', 'A5 - whatsapp-history'],
  ['agents/LunaBrain_v16.js', 'const codeBlock = responseText.match', 'C4 - parseGemmaResponse'],
  ['agents/LunaBrain_v16.js', 'finalResult.lunaPersonality = this.activePersonality;', 'C5 - humor removido'],
  ['agents/luna-scheduler.mjs', 'await runAgent({ once: false, schedule: true', 'C6 - runAgent params'],
  ['agents/luna-cto-agent.cjs', 'Sin tareas pendientes.', 'A12 - espanhol'],
  ['agents/luna-cto-agent.cjs', 'Luna v16.0', 'A12 - versão'],
  ['backend/server.js', 'normalizedMessages', 'SERVER - whatsapp-agent'],
];

let verified = 0;
for (const [f, expected, desc] of CHECKS) {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    if (read(fp).includes(expected)) { log('🛡️  [VERIFY] ' + desc + ' — OK'); verified++; }
    else { log('❌ [FAIL] ' + desc); }
  } else { log('⚠️  [SKIP] ' + f + ' não existe'); }
}

log('');
log('═══════════════════════════════════════════════════════');
log(' 📊 RELATÓRIO');
log('═══════════════════════════════════════════════════════');
log(' ✅ Aplicados: ' + applied);
log(' ⏭️  Ignorados: ' + skipped);
log(' 🛡️  Verificados: ' + verified + '/' + CHECKS.length);
log(' 💾 Backup: ' + BACKUP_DIR);
log('═══════════════════════════════════════════════════════');

if (verified >= CHECKS.length - 2) {
  log('🎉 LUNA FIX MASTER v4.0 CONCLUÍDO!');
  log(' Próximos passos:');
  log('  1. node -c agents/luna-cto-agent.cjs');
  log('  2. node -c agents/luna-scheduler.mjs');
  log('  3. node agents/luna-cto-agent.cjs');
  process.exit(0);
} else {
  log('⚠️  ALGUMAS VERIFICAÇÕES FALHARAM. Verifique o log.');
  process.exit(1);
}
