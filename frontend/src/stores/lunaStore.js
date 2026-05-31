/**
 * 🌙 Luna Mascot — Zustand Store
 * Estado global da Luna: estados, frases, posição, interação
 */

import { create } from "zustand";
import { getPhrasePool, pickPhrase } from "../lib/luna/phrases";

/** @typedef {'sleep'|'idle'|'thinking'|'working'|'success'|'error'|'walk'|'run'} LunaState */

/**
 * @typedef {Object} LunaStore
 * @property {LunaState} state
 * @property {string|null} currentTool
 * @property {number} lastInteraction
 * @property {string|null} message
 * @property {{x:number,y:number}|null} targetPosition
 * @property {string[]} phraseHistory
 * @property {boolean} isVisible
 * @property {boolean} reducedMotion
 * @property {boolean} isAwake
 * @property {function(LunaState, Object): void} setState
 * @property {function(string?): void} wakeUp
 * @property {function(): void} goToSleep
 * @property {function(string, 'start'|'success'|'error'): void} reactToTool
 * @property {function(number, number): void} runTo
 * @property {function(): void} clearMessage
 * @property {function(string): void} speak
 * @property {function(): void} markInteraction
 * @property {function(boolean): void} setVisible
 * @property {function(boolean): void} setReducedMotion
 */

const INACTIVITY_SLEEP_MS = 60_000; // 60s para dormir
const INACTIVITY_WALK_MS = 10_000; // 10s para começar a andar
const WORKING_TIMEOUT_MS = 30_000; // 30s timeout em working/thinking
const MESSAGE_DURATION_MS = 4_000; // 4s duração do balão

export const useLunaStore = create((set, get) => ({
  // Estado
  state: "sleep",
  currentTool: null,
  lastInteraction: Date.now(),
  message: null,
  targetPosition: null,
  phraseHistory: [],
  isVisible: true,
  reducedMotion: false,
  isAwake: false,
  messageTimer: null,
  workingTimer: null,

  // Ações
  setState: (newState, context = {}) => {
    const oldState = get().state;
    if (oldState === newState && !context.force) return;

    set({
      state: newState,
      ...context,
    });

    // Auto-clear message após transição
    if (newState === "idle" || newState === "sleep") {
      get().clearMessage();
    }
  },

  wakeUp: (triggerMessage) => {
    const store = get();
    if (store.isAwake && store.state !== "sleep") {
      store.markInteraction();
      return;
    }

    const pool = getPhrasePool("sleep");
    const phrase = triggerMessage || pickPhrase(pool, store.phraseHistory, 3);
    const newHistory = [...store.phraseHistory, phrase].slice(-20);

    set({
      state: "idle",
      isAwake: true,
      message: phrase,
      phraseHistory: newHistory,
      lastInteraction: Date.now(),
    });

    // Auto-clear wake message
    store._clearMessageAfter(MESSAGE_DURATION_MS);
  },

  goToSleep: () => {
    const store = get();
    if (store.state === "sleep") return;

    // Limpa timers
    if (store.messageTimer) clearTimeout(store.messageTimer);
    if (store.workingTimer) clearTimeout(store.workingTimer);

    set({
      state: "sleep",
      isAwake: false,
      message: null,
      currentTool: null,
      targetPosition: null,
    });
  },

  reactToTool: (tool, status) => {
    const store = get();
    store.markInteraction();

    let newState = "working";
    let phrase = null;

    if (status === "success") {
      newState = "success";
      const pool = getPhrasePool("success");
      phrase = pickPhrase(pool, store.phraseHistory, 3);
    } else if (status === "error") {
      newState = "error";
      const pool = getPhrasePool("error");
      phrase = pickPhrase(pool, store.phraseHistory, 3);
    } else {
      // start
      newState = "working";
      const pool = getPhrasePool("working", tool);
      phrase = pickPhrase(pool, store.phraseHistory, 3);

      // Timeout de segurança para working
      const timer = setTimeout(() => {
        if (get().state === "working" || get().state === "thinking") {
          const timeoutPool = getPhrasePool("timeout");
          const timeoutPhrase = pickPhrase(timeoutPool, get().phraseHistory, 3);
          set({
            state: "idle",
            message: timeoutPhrase,
            phraseHistory: [...get().phraseHistory, timeoutPhrase].slice(-20),
          });
          get()._clearMessageAfter(MESSAGE_DURATION_MS);
        }
      }, WORKING_TIMEOUT_MS);
      set({ workingTimer: timer });
    }

    const newHistory = phrase
      ? [...store.phraseHistory, phrase].slice(-20)
      : store.phraseHistory;

    set({
      state: newState,
      currentTool: tool,
      message: phrase,
      phraseHistory: newHistory,
    });

    // Auto-clear para success/error (retornam a idle)
    if (status === "success" || status === "error") {
      store._clearMessageAfter(MESSAGE_DURATION_MS);
      setTimeout(() => {
        if (get().state === newState) {
          set({ state: "idle", currentTool: null });
        }
      }, 2000);
    }
  },

  runTo: (x, y) => {
    const store = get();
    store.markInteraction();

    const pool = getPhrasePool("run");
    const phrase = pickPhrase(pool, store.phraseHistory, 3);
    const newHistory = [...store.phraseHistory, phrase].slice(-20);

    set({
      state: "run",
      targetPosition: { x, y },
      message: phrase,
      phraseHistory: newHistory,
    });

    store._clearMessageAfter(MESSAGE_DURATION_MS);
  },

  clearMessage: () => {
    const store = get();
    if (store.messageTimer) clearTimeout(store.messageTimer);
    set({ message: null, messageTimer: null });
  },

  speak: (phrase) => {
    const store = get();
    const newHistory = [...store.phraseHistory, phrase].slice(-20);
    set({ message: phrase, phraseHistory: newHistory });
    store._clearMessageAfter(MESSAGE_DURATION_MS);
  },

  markInteraction: () => {
    set({ lastInteraction: Date.now() });
  },

  setVisible: (visible) => set({ isVisible: visible }),

  setReducedMotion: (reduced) => set({ reducedMotion: reduced }),

  // Interno
  _clearMessageAfter: (ms) => {
    const store = get();
    if (store.messageTimer) clearTimeout(store.messageTimer);
    const timer = setTimeout(() => {
      set({ message: null, messageTimer: null });
    }, ms);
    set({ messageTimer: timer });
  },
}));

// Exporta constantes para uso externo
export { INACTIVITY_SLEEP_MS, INACTIVITY_WALK_MS, WORKING_TIMEOUT_MS, MESSAGE_DURATION_MS };
