/**
 * Thinking Cleaner v2.0 — Portado da arquitetura Kimi Thinking Extractor
 * Pipeline de 5 passos com estatísticas de limpeza.
 *
 * Baseado em análise DOM ao vivo do Kimi K2.6 Thinking.
 */

// ── Constantes ──
const RESPONSE_TAG = /\[\[response\]\]|\[\[resposta\]\]|\[\[RESPONSE\]\]|\[\[\/response\]\]|\[\[\/resposta\]\]|\[\[\/RESPONSE\]\]/gi;

const SELF_TALK_PATTERNS = [
  /O usuário está me tratando como\s+\w+\.?/gi,
  /O usuário quer que eu aja como\s+[^.]+/gi,
  /Estou sendo usado como\s+[^.]+/gi,
  /O sistema está me instruindo a[^.]+/gi,
  /Meu papel atual é\s+[^.]+/gi,
  /Contexto:\s*estou conversando com[^.]+/gi,
  /INSTRUÇÃO:\s*Você está conversando com[^.]+/gi,
  /Sempre se refira a mim como\s+[^.]+/gi,
  /Vou responder comoema diz que eu sou[\s\S]*?respond/gi,
  /Vou responder de forma amigável e profissional[\s\S]*?precisar/gi,
  /O contexto do sistema diz que eu sou Kimi[\s\S]*?respond/gi,
  /O usuário disse "oi"[\s\S]*?responder/gi,
];

const REPETITION_PATTERNS = [
  /^(.*)\n\1\n\1(?:\n\1)*$/gm,
  /(\b\w+\b)(?:\s+\1){3,}/gi,
];

const DELIMITER_PATTERNS = [
  /---+?\s*(?:resposta|response|final answer|resposta final)\s*---+?/i,
  /^(?:Aqui está (?:a )?resposta|Resposta final|Resposta):/im,
];

// ── Stats ──
function createEmptyStats() {
  return {
    selfTalkRemoved: 0,
    repetitionsRemoved: 0,
    tagsStripped: 0,
    markupRemoved: 0,
    totalCharsRemoved: 0,
    originalThinkingLength: 0,
    originalResponseLength: 0,
  };
}

// ── Pipeline Steps ──

function stripResponseTags(text, stats) {
  let result = text;
  const matches = result.match(RESPONSE_TAG);
  if (matches) {
    if (stats) stats.tagsStripped += matches.length;
    result = result.replace(RESPONSE_TAG, '');
  }
  return result;
}

function removeSelfTalk(text, stats) {
  let result = text;
  SELF_TALK_PATTERNS.forEach((pattern) => {
    const matches = result.match(pattern);
    if (matches) {
      stats.selfTalkRemoved += matches.length;
      result = result.replace(pattern, '');
    }
  });
  return result;
}

function removeRepetitions(text, stats) {
  let result = text;
  REPETITION_PATTERNS.forEach((pattern) => {
    const matches = result.match(pattern);
    if (matches) {
      stats.repetitionsRemoved += matches.length;
      result = result.replace(pattern, '');
    }
  });
  return result;
}

function removeRawMarkup(text, stats) {
  const lines = text.split('\n');
  const cleaned = lines.map(line => {
    if (/^\s*<[a-zA-Z][^>]*>\s*$/.test(line) && !line.includes('```')) {
      stats.markupRemoved++;
      return '';
    }
    return line;
  });
  return cleaned.join('\n').replace(/^```\s*\n\s*```$/gm, '');
}

function removeDelimiters(text) {
  let result = text;
  DELIMITER_PATTERNS.forEach((pattern) => {
    result = result.replace(pattern, '');
  });
  return result;
}

function finalNormalization(text) {
  return text
    .trim()
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+/gm, '')
    .replace(/\s+$/gm, '');
}

// ── Main Entrypoint ──

/**
 * Clean thinking and response text with full pipeline + stats.
 * @param {string} thinking — raw thinking text
 * @param {string} response — raw response text
 * @returns {{thinking: string, response: string, stats: object}}
 */
function clean(thinking, response) {
  const stats = createEmptyStats();
  stats.originalThinkingLength = thinking.length;
  stats.originalResponseLength = response.length;

  let ct = thinking;
  let cr = response;

  ct = stripResponseTags(ct, stats);
  cr = stripResponseTags(cr, stats);
  ct = removeSelfTalk(ct, stats);
  ct = removeRepetitions(ct, stats);
  ct = removeRawMarkup(ct, stats);
  ct = removeDelimiters(ct);
  ct = finalNormalization(ct);
  cr = finalNormalization(cr);

  stats.totalCharsRemoved =
    (stats.originalThinkingLength - ct.length) +
    (stats.originalResponseLength - cr.length);

  return { thinking: ct, response: cr, stats };
}

/**
 * Clean only thinking (backward compatible).
 */
function cleanThinking(rawText, options = {}) {
  const { removeNoise = true, deduplicate = true } = options;
  if (!rawText || typeof rawText !== 'string') {
    return { thinking: '', response: null, wasCleaned: false };
  }

  const result = clean(rawText, '');
  return {
    thinking: result.thinking,
    response: null,
    wasCleaned: result.stats.totalCharsRemoved > 0,
    stats: result.stats,
  };
}

/**
 * Strip [[response]] tags only.
 */
function stripResponseTagsStandalone(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(RESPONSE_TAG, '')
    .trim();
}

/**
 * Compact thinking for status bar (single-line summary).
 */
function compactThinking(text, maxLen = 80) {
  if (!text) return '';
  const result = clean(text, '');
  const firstLine = result.thinking.split('\n')[0] || '';
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen - 1) + '…';
}

/**
 * Calculate thinking metrics.
 */
function getThinkingMetrics(text) {
  if (!text) return { paragraphs: 0, lines: 0, chars: 0, tokens: 0 };
  const result = clean(text, '');
  const paragraphs = result.thinking.split(/\n{2,}/).filter(p => p.trim()).length;
  const lines = result.thinking.split('\n').filter(l => l.trim()).length;
  const chars = result.thinking.length;
  const tokens = Math.ceil(chars / 4);
  return { paragraphs, lines, chars, tokens };
}

module.exports = {
  clean,
  cleanThinking,
  compactThinking,
  getThinkingMetrics,
  stripResponseTags: stripResponseTagsStandalone,
};
