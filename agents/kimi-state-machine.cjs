/**
 * Kimi State Machine v1.0 — Portado da arquitetura Kimi Thinking Extractor
 * Detecta transições: IDLE → THINKING → RESPONDING → IDLE
 * Com detecção de erro e estabilidade.
 */

const STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  RESPONDING: 'responding',
  ERROR: 'error',
};

const CONFIG = {
  STABLE_THRESHOLD_MS: 800,
  MAX_THINKING_DURATION_MS: 300_000,
};

class KimiStateMachine {
  constructor() {
    this.state = STATES.IDLE;
    this.lastContent = null;
    this.contentHistory = [];
    this.transitionHistory = [];
    this.lastUpdateTime = 0;
    this.stableTimer = null;

    // Callbacks
    this.onStateChange = null;
    this.onThinkingUpdate = null;
    this.onResponseUpdate = null;
    this.onError = null;
  }

  processSnapshot(snapshot) {
    const now = Date.now();
    const previousState = this.state;

    const contentChanged = this._hasContentChanged(snapshot);

    if (contentChanged) {
      this.lastUpdateTime = now;
      this.contentHistory.push(snapshot);
      if (this.contentHistory.length > 10) {
        this.contentHistory.shift();
      }
    }

    let newState = previousState;

    switch (previousState) {
      case STATES.IDLE:
        if (snapshot.hasThinking && !snapshot.hasResponse) {
          newState = STATES.THINKING;
        } else if (snapshot.hasResponse) {
          newState = STATES.RESPONDING;
        }
        break;

      case STATES.THINKING:
        if (!snapshot.hasThinking && snapshot.hasResponse) {
          newState = STATES.RESPONDING;
        } else if (snapshot.hasThinking && snapshot.hasResponse) {
          if (snapshot.isComplete || snapshot.stabilityScore > 0.8) {
            newState = STATES.RESPONDING;
          }
        } else if (!snapshot.hasThinking && !snapshot.hasResponse) {
          newState = this._detectErrorOrShortMessage(snapshot);
        }
        break;

      case STATES.RESPONDING:
        if (!snapshot.hasResponse && !snapshot.hasThinking) {
          if (this._isStableFor(CONFIG.STABLE_THRESHOLD_MS)) {
            newState = STATES.IDLE;
          }
        } else if (snapshot.hasThinking && !snapshot.hasResponse) {
          newState = STATES.THINKING;
        }
        break;

      case STATES.ERROR:
        if (snapshot.hasThinking || snapshot.hasResponse) {
          newState = snapshot.hasResponse ? STATES.RESPONDING : STATES.THINKING;
        }
        break;
    }

    if (newState !== previousState) {
      this._executeTransition(previousState, newState, snapshot,
        this._getTransitionReason(previousState, newState, snapshot));
    }

    if (previousState === STATES.THINKING || newState === STATES.THINKING) {
      this.onThinkingUpdate?.(snapshot.thinking, snapshot.isComplete);
    }
    if (previousState === STATES.RESPONDING || newState === STATES.RESPONDING) {
      this.onResponseUpdate?.(snapshot.response, snapshot.isComplete);
    }

    this.lastContent = snapshot;
  }

  _hasContentChanged(current) {
    if (!this.lastContent) return true;
    return current.thinking !== this.lastContent.thinking ||
           current.response !== this.lastContent.response ||
           current.isComplete !== this.lastContent.isComplete;
  }

  _isStableFor(thresholdMs) {
    return (Date.now() - this.lastUpdateTime) > thresholdMs;
  }

  _detectErrorOrShortMessage(snapshot) {
    if (this.contentHistory.length > 0 && this.lastContent &&
        (this.lastContent.thinking.length > 20 || this.lastContent.response.length > 20)) {
      return STATES.IDLE;
    }
    return STATES.ERROR;
  }

  _getTransitionReason(from, to, snapshot) {
    const reasons = {
      [`${STATES.IDLE}->${STATES.THINKING}`]: 'Thinking detectado no DOM',
      [`${STATES.IDLE}->${STATES.RESPONDING}`]: 'Resposta apareceu sem thinking visível',
      [`${STATES.THINKING}->${STATES.RESPONDING}`]: snapshot.hasResponse
        ? 'Resposta iniciada, thinking completo'
        : 'Thinking removido do DOM, resposta presente',
      [`${STATES.THINKING}->${STATES.ERROR}`]: 'Conteúdo desapareceu inesperadamente',
      [`${STATES.RESPONDING}->${STATES.IDLE}`]: 'Resposta completa e estável',
      [`${STATES.ERROR}->${STATES.THINKING}`]: 'Recuperação: thinking detectado',
      [`${STATES.ERROR}->${STATES.RESPONDING}`]: 'Recuperação: resposta detectada',
    };
    return reasons[`${from}->${to}`] || `Transição ${from} → ${to}`;
  }

  _executeTransition(from, to, data, reason) {
    const transition = {
      from, to,
      timestamp: Date.now(),
      reason,
      data: { ...data },
    };

    this.transitionHistory.push(transition);
    this.state = to;

    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }

    this.onStateChange?.(transition);

    // Auto-transition RESPONDING → IDLE after stability threshold
    if (to === STATES.RESPONDING) {
      this.stableTimer = setTimeout(() => {
        if (this.state === STATES.RESPONDING && this._isStableFor(CONFIG.STABLE_THRESHOLD_MS)) {
          this._executeTransition(STATES.RESPONDING, STATES.IDLE, this.lastContent || data, 'Resposta estável por threshold');
        }
      }, CONFIG.STABLE_THRESHOLD_MS * 2);
    }
  }

  getCurrentState() { return this.state; }
  getLastContent() { return this.lastContent; }
  getTransitionHistory() { return [...this.transitionHistory]; }

  reset() {
    this.state = STATES.IDLE;
    this.lastContent = null;
    this.contentHistory = [];
    this.transitionHistory = [];
    this.lastUpdateTime = 0;
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
  }
}

module.exports = { KimiStateMachine, STATES, CONFIG };
