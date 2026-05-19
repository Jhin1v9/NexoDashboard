import { createContext, useState, useEffect, useCallback, useRef } from 'react'
import { lunaEventBus } from '../lib/lunaEventBus'

/**
 * LunaContext — Consciência global da Luna.
 *
 * Mantém estado de:
 *   - Onde o usuário está (rota, módulo)
 *   - O que ele está vendo (dados visíveis)
 *   - O que ele está fazendo (foco, interação)
 *   - Estado do chat (idle, listening, thinking, acting)
 *   - Memória recente de ações
 */

export const LunaContext = createContext(null)

const INITIAL_STATE = {
  currentRoute: null,
  currentModule: null,
  routeParams: {},
  visibleData: {},
  userFocus: null,
  chatState: 'idle',
  isOpen: false,
  recentActions: [],
  systemMap: null,
}

export function LunaProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE)
  const moduleRegistry = useRef(new Map())

  const updateState = useCallback((partial) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  const registerModule = useCallback((moduleId, data) => {
    moduleRegistry.current.set(moduleId, data)
    setState((prev) => ({
      ...prev,
      visibleData: { ...prev.visibleData, [moduleId]: data },
    }))
  }, [])

  const unregisterModule = useCallback((moduleId) => {
    moduleRegistry.current.delete(moduleId)
    setState((prev) => {
      const next = { ...prev.visibleData }
      delete next[moduleId]
      return { ...prev, visibleData: next }
    })
  }, [])

  const pushAction = useCallback((action) => {
    setState((prev) => ({
      ...prev,
      recentActions: [
        { ...action, timestamp: Date.now() },
        ...prev.recentActions.slice(0, 49), // mantém últimas 50
      ],
    }))
  }, [])

  useEffect(() => {
    const unsubscribers = []

    unsubscribers.push(
      lunaEventBus.on('luna:routeChanged', ({ route, module, params }) => {
        updateState({ currentRoute: route, currentModule: module, routeParams: params || {} })
      })
    )

    unsubscribers.push(
      lunaEventBus.on('luna:dataUpdated', ({ module, data }) => {
        setState((prev) => ({
          ...prev,
          visibleData: { ...prev.visibleData, [module]: data },
        }))
      })
    )

    unsubscribers.push(
      lunaEventBus.on('luna:userFocus', (focus) => {
        updateState({ userFocus: focus })
      })
    )

    unsubscribers.push(
      lunaEventBus.on('luna:command', ({ text }) => {
        updateState({ chatState: 'thinking' })
        pushAction({ action: 'command', target: text, result: 'pending' })
      })
    )

    unsubscribers.push(
      lunaEventBus.on('luna:stateChange', ({ chatState, isOpen }) => {
        const patch = {}
        if (chatState !== undefined) patch.chatState = chatState
        if (isOpen !== undefined) patch.isOpen = isOpen
        updateState(patch)
      })
    )

    return () => {
      unsubscribers.forEach((fn) => fn())
    }
  }, [updateState, pushAction])

  const value = {
    ...state,
    updateState,
    registerModule,
    unregisterModule,
    pushAction,
  }

  return <LunaContext.Provider value={value}>{children}</LunaContext.Provider>
}
