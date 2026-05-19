import { useContext } from 'react'
import { LunaContext } from '../context/LunaContext.jsx'

/**
 * useLunaContext — Hook para acessar a consciência da Luna.
 *
 * Retorna:
 *   currentRoute, currentModule, routeParams,
 *   visibleData, userFocus, chatState, isOpen,
 *   recentActions, systemMap,
 *   updateState, registerModule, unregisterModule, pushAction
 */

export function useLunaContext() {
  const ctx = useContext(LunaContext)
  if (!ctx) {
    throw new Error('useLunaContext deve ser usado dentro de <LunaProvider>')
  }
  return ctx
}
