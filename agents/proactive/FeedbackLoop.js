// ============================================================
// FEEDBACK LOOP v18.0 — A Luna Aprende com Correções
// Quando um CEO corrige a Luna, ela lembra e não erra de novo.
// ============================================================

const fs = require('fs');
const path = require('path');

const FEEDBACK_FILE = path.join(__dirname, '../../backend/data/luna-feedback.json');

class FeedbackLoop {
  constructor() {
    this.corrections = [];
    this.learnedRules = new Map();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(FEEDBACK_FILE)) {
        const data = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
        this.corrections = data.corrections || [];
        this.learnedRules = new Map(Object.entries(data.learnedRules || {}));
      }
    } catch (e) {
      console.error('[Feedback] Erro ao carregar:', e.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify({
        corrections: this.corrections.slice(-500),
        learnedRules: Object.fromEntries(this.learnedRules),
        lastUpdated: new Date().toISOString()
      }, null, 2));
    } catch (e) {
      console.error('[Feedback] Erro ao salvar:', e.message);
    }
  }

  // ── REGISTRAR CORREÇÃO ──

  recordCorrection(originalMessage, correction, type, author) {
    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      original: originalMessage,
      correction,
      type,
      author,
      applied: false
    };

    this.corrections.push(entry);
    this._extractRule(entry);
    this.save();

    console.log(`[Feedback] ✅ Correção registrada de ${author}: "${originalMessage.slice(0, 60)}..." → "${correction.slice(0, 60)}..."`);
    return entry;
  }

  _extractRule(entry) {
    const lo = entry.original.toLowerCase();
    const lc = entry.correction.toLowerCase();

    // Regra de classificação
    if (entry.type === 'classification') {
      const fromMatch = lo.match(/\b(tarefaRealizada|tarefaPendente|bug|lead|financeiro|ideia|decisao)\b/);
      const toMatch = lc.match(/\b(tarefaRealizada|tarefaPendente|bug|lead|financeiro|ideia|decisao)\b/);
      if (fromMatch && toMatch) {
        const key = `class:${lo.slice(0, 80)}`;
        this.learnedRules.set(key, { from: fromMatch[1], to: toMatch[1], confidence: 0.9 });
      }
    }

    // Regra de fato
    if (entry.type === 'fact') {
      const entityMatch = lc.match(/\b(paulo|juan|abner|enoque|elias|santafe|tropicale|dashboard)\b/);
      const attrMatch = lc.match(/\b(pagou|pago|pendente|atrasado|concluido|pronto|fez|terminou)\b/);
      if (entityMatch && attrMatch) {
        const key = `fact:${entityMatch[1]}:${attrMatch[1]}`;
        const value = /(sim|yes|correto|pago|concluido|pronto|fez|terminou)/i.test(lc) ? 'true' : 'false';
        this.learnedRules.set(key, { value, confidence: 0.95, source: entry.author });
      }
    }

    // Regra de resposta
    if (entry.type === 'response') {
      const key = `response:${lo.slice(0, 60)}`;
      this.learnedRules.set(key, { correction: entry.correction, confidence: 0.8 });
    }
  }

  // ── APLICAR REGRAS ──

  checkCorrection(text, type = 'classification') {
    const lower = text.toLowerCase();
    for (const [key, rule] of this.learnedRules) {
      if (type === 'classification' && key.startsWith('class:')) {
        if (lower.includes(key.replace('class:', '').toLowerCase())) return rule;
      }
      if (type === 'fact' && key.startsWith('fact:')) {
        const parts = key.split(':');
        if (parts[1] && lower.includes(parts[1])) return rule;
      }
    }
    return null;
  }

  // ── DETECTAR CORREÇÃO EM MENSAGEM ──

  detectCorrection(messageText, lunaLastMessage = null) {
    const lower = messageText.toLowerCase();

    const correctionPatterns = [
      /\b(n[ãa]o[,.]?\s*(iss[oa]|est[áa]|t[áa]|foi)|errado|incorreto|nunca|jamais)\b/i,
      /\b(corre[cç][ãa]o|corrige|corrigindo|na verdade|actually)\b/i,
      /\b(n[ãa]o [ée]|n[ãa]o era|mudou|agora [ée])\b/i,
      /\b(sim,? mas|n[ãa]o,? [ée]|errada a informa[cç][ãa]o)\b/i
    ];

    const isCorrection = correctionPatterns.some(p => p.test(lower));
    if (!isCorrection) return null;

    let correctedSubject = lunaLastMessage;
    let correctedValue = messageText;

    const classMatch = lower.match(/\b([ée]\s+)?(tarefa|bug|lead|ideia|decis[ãa]o|financeiro)\s+(pendente|realizada|nova|quente|frio)\b/);
    if (classMatch) correctedValue = classMatch[0];

    const factMatch = lower.match(/\b(paulo|juan|abner|enoque|elias|santafe)\s+(j[áa]|n[ãa]o|jamais|sempre)\s+(pagou|pago|atrasado|concluiu|fez)\b/);
    if (factMatch) {
      correctedSubject = factMatch[1];
      correctedValue = factMatch[0];
    }

    return { isCorrection: true, subject: correctedSubject, value: correctedValue, confidence: 0.8 };
  }

  getStats() {
    const byType = {};
    const byAuthor = {};
    for (const c of this.corrections) {
      byType[c.type] = (byType[c.type] || 0) + 1;
      byAuthor[c.author] = (byAuthor[c.author] || 0) + 1;
    }
    return {
      totalCorrections: this.corrections.length,
      learnedRules: this.learnedRules.size,
      byType,
      byAuthor,
      recentCorrections: this.corrections.slice(-5)
    };
  }
}

module.exports = { FeedbackLoop };
