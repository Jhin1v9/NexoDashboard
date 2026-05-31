/**
 * 🌙 Luna Mascot — Sistema de Eventos Globais
 * Emite eventos de qualquer lugar do dashboard para a Luna reagir
 */

/**
 * @typedef {Object} LunaEvent
 * @property {string} type - Tipo do evento
 * @property {string} [tool] - Tool em uso (para tool_* events)
 * @property {string} [message] - Mensagem contextual
 * @property {string} [from] - Origem do evento
 */

export const LUNA_EVENT_TYPES = {
  TOOL_START: "tool_start",
  TOOL_SUCCESS: "tool_success",
  TOOL_ERROR: "tool_error",
  USER_TYPING: "user_typing",
  NEW_MESSAGE: "new_message",
  USER_CLICK: "user_click",
  PAGE_CHANGE: "page_change",
  HEARTBEAT: "luna_heartbeat",
  WAKE: "luna_wake",
  SLEEP: "luna_sleep",
};

/**
 * Emite um evento global para a Luna
 * @param {LunaEvent} event
 */
export function emitLunaEvent(event) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("luna-event", {
        detail: event,
        bubbles: true,
      })
    );
  }
}

/**
 * Escuta eventos da Luna
 * @param {function(LunaEvent): void} handler
 * @returns {function()} Função de cleanup
 */
export function onLunaEvent(handler) {
  if (typeof window === "undefined") return () => {};

  const wrapped = (e) => handler(e.detail);
  window.addEventListener("luna-event", wrapped);
  return () => window.removeEventListener("luna-event", wrapped);
}

/**
 * Helpers pré-fabricados para uso em actions do dashboard
 */
export const luna = {
  /** Git push iniciado */
  gitPush: (msg = "Fazendo push...") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_START, tool: "git", message: msg }),

  /** Git push sucesso */
  gitSuccess: (msg = "Push feito!") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_SUCCESS, tool: "git", message: msg }),

  /** Git push erro */
  gitError: (msg = "Erro no push!") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_ERROR, tool: "git", message: msg }),

  /** Deploy iniciado */
  deployStart: (msg = "Deployando...") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_START, tool: "deploy", message: msg }),

  /** Deploy sucesso */
  deploySuccess: (msg = "Deploy feito!") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_SUCCESS, tool: "deploy", message: msg }),

  /** Deploy erro */
  deployError: (msg = "Erro no deploy!") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_ERROR, tool: "deploy", message: msg }),

  /** Build iniciado */
  buildStart: (msg = "Compilando...") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_START, tool: "build", message: msg }),

  /** Build sucesso */
  buildSuccess: (msg = "Build feito!") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_SUCCESS, tool: "build", message: msg }),

  /** Build erro */
  buildError: (msg = "Erro na compilação!") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_ERROR, tool: "build", message: msg }),

  /** Shell comando iniciado */
  shellStart: (msg = "Executando...") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_START, tool: "shell", message: msg }),

  /** Shell sucesso */
  shellSuccess: (msg = "Comando executado!") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_SUCCESS, tool: "shell", message: msg }),

  /** Shell erro */
  shellError: (msg = "Erro no comando!") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.TOOL_ERROR, tool: "shell", message: msg }),

  /** Arquivo criado/salvo */
  fileAction: (status, msg) =>
    emitLunaEvent({
      type: status === "success" ? LUNA_EVENT_TYPES.TOOL_SUCCESS : LUNA_EVENT_TYPES.TOOL_START,
      tool: "file",
      message: msg,
    }),

  /** Usuário começou a digitar */
  userTyping: () =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.USER_TYPING }),

  /** Nova mensagem recebida */
  newMessage: (from = "user") =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.NEW_MESSAGE, from }),

  /** Heartbeat de verificação */
  heartbeat: () =>
    emitLunaEvent({ type: LUNA_EVENT_TYPES.HEARTBEAT }),
};
