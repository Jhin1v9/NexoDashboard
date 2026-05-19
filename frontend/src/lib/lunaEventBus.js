/**
 * lunaEventBus — Sistema de eventos pub/sub nativo para a Luna.
 *
 * Usa EventTarget do browser (zero dependências, zero bundle overhead).
 * Todos os componentes da Luna se comunicam por aqui.
 *
 * Eventos padrão:
 *   luna:routeChanged   → { route, module, params }
 *   luna:dataUpdated    → { module, data }
 *   luna:userFocus      → { elementType, elementId, interactionType }
 *   luna:elementClicked → { target, module }
 *   luna:command        → { text, intent, confidence }
 *   luna:stateChange    → { chatState, isOpen }
 */

class LunaEventBus extends EventTarget {
  emit(eventName, payload) {
    this.dispatchEvent(new CustomEvent(eventName, { detail: payload }))
  }

  on(eventName, handler) {
    const wrapped = (e) => handler(e.detail)
    this.addEventListener(eventName, wrapped)
    // retorna função de cleanup
    return () => this.removeEventListener(eventName, wrapped)
  }

  off(eventName, handler) {
    this.removeEventListener(eventName, handler)
  }

  once(eventName, handler) {
    const wrapped = (e) => {
      handler(e.detail)
      this.removeEventListener(eventName, wrapped)
    }
    this.addEventListener(eventName, wrapped)
  }
}

export const lunaEventBus = new LunaEventBus()

// Expor globalmente para debugging no console do navegador
if (typeof window !== 'undefined') {
  window.lunaEventBus = lunaEventBus
}
