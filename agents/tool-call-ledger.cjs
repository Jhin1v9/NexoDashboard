/**
 * tool-call-ledger.cjs — Rastreamento e Deduplicação de Tool Calls
 *
 * Resolve race conditions entre interceptor, DOM Mirror e parser.
 * Rastreia o ciclo de vida completo: pending → executing → completed/failed → retry
 *
 * @version 1.0.0
 */

const crypto = require('crypto');

const LEDGER_TIMEOUT_MS = 60000; // 1min para considerar uma tool call "stuck"

class ToolCallLedger {
  constructor() {
    this.entries = new Map(); // key → { tool, params, source, status, result, createdAt, updatedAt, retries }
    this.seqCounter = 0;
  }

  /**
   * Gera uma chave única para uma tool call baseada em tool + params.
   */
  _key(toolName, params) {
    const normalized = JSON.stringify(params, Object.keys(params || {}).sort());
    return `${toolName}:${crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)}`;
  }

  /**
   * Registra uma nova tool call no ledger.
   * @returns {{ key: string, isNew: boolean, status: string }}
   */
  register(toolName, params, source = 'unknown') {
    const key = this._key(toolName, params);
    const existing = this.entries.get(key);

    if (existing) {
      return { key, isNew: false, status: existing.status };
    }

    this.seqCounter++;
    this.entries.set(key, {
      key,
      seq: this.seqCounter,
      tool: toolName,
      params,
      source,
      status: 'pending',
      result: null,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retries: 0,
    });

    return { key, isNew: true, status: 'pending' };
  }

  /**
   * Verifica se uma tool call já foi executada (completed ou failed).
   */
  isExecuted(toolName, params) {
    const key = this._key(toolName, params);
    const entry = this.entries.get(key);
    return entry && (entry.status === 'completed' || entry.status === 'failed');
  }

  /**
   * Verifica se uma tool call está em execução agora.
   */
  isExecuting(toolName, params) {
    const key = this._key(toolName, params);
    const entry = this.entries.get(key);
    return entry && entry.status === 'executing';
  }

  /**
   * Marca uma tool call como em execução.
   */
  markExecuting(toolName, params) {
    const key = this._key(toolName, params);
    const entry = this.entries.get(key);
    if (entry) {
      entry.status = 'executing';
      entry.updatedAt = Date.now();
    }
  }

  /**
   * Marca uma tool call como completada com resultado.
   */
  markCompleted(toolName, params, result) {
    const key = this._key(toolName, params);
    const entry = this.entries.get(key);
    if (entry) {
      entry.status = 'completed';
      entry.result = result;
      entry.updatedAt = Date.now();
    }
  }

  /**
   * Marca uma tool call como falha.
   */
  markFailed(toolName, params, error) {
    const key = this._key(toolName, params);
    const entry = this.entries.get(key);
    if (entry) {
      entry.status = 'failed';
      entry.error = error;
      entry.updatedAt = Date.now();
    }
  }

  /**
   * Registra um retry de uma tool call falha.
   */
  markRetry(toolName, params) {
    const key = this._key(toolName, params);
    const entry = this.entries.get(key);
    if (entry && entry.status === 'failed') {
      entry.retries++;
      entry.status = 'pending';
      entry.error = null;
      entry.updatedAt = Date.now();
      return { key, status: 'pending', retries: entry.retries };
    }
    return null;
  }

  /**
   * Retorna todas as tool calls pendentes há mais de N ms ("stuck").
   */
  getPendingOlderThan(ms = LEDGER_TIMEOUT_MS) {
    const now = Date.now();
    return Array.from(this.entries.values()).filter(
      e => e.status === 'pending' && now - e.createdAt > ms
    );
  }

  /**
   * Retorna o estado atual do ledger para debug.
   */
  getStatus() {
    const counts = { pending: 0, executing: 0, completed: 0, failed: 0 };
    for (const e of this.entries.values()) {
      counts[e.status] = (counts[e.status] || 0) + 1;
    }
    return {
      total: this.entries.size,
      counts,
      recent: Array.from(this.entries.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10),
    };
  }

  /**
   * Limpa entradas completadas/falhas mais antigas que N ms.
   */
  prune(maxAgeMs = 5 * 60 * 1000) {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if ((entry.status === 'completed' || entry.status === 'failed') && now - entry.updatedAt > maxAgeMs) {
        this.entries.delete(key);
        removed++;
      }
    }
    return removed;
  }

  reset() {
    this.entries.clear();
    this.seqCounter = 0;
  }
}

module.exports = {
  ToolCallLedger,
  LEDGER_TIMEOUT_MS,
};
