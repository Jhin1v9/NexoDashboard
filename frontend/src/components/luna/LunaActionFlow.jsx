/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaActionFlow — Componente de apresentação para execução inteligente.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Recebe resultado do NLU + modo pré-decidido e renderiza:
 *   - Drawer (collect/preview/confirm)
 *   - SmartFormModal (fallback)
 *
 * A lógica de decisão fica no caller (LunaFloatingButton) para evitar
 * loops de useEffect.
 */

import { useState } from 'react'
import { lunaEventBus } from '../../lib/lunaEventBus'
import LunaActionDrawer from './LunaActionDrawer'
import SmartFormModal from './SmartFormModal'

export default function LunaActionFlow({ nluResult, mode, onDone }) {
  const [fallbackModal, setFallbackModal] = useState(null)

  if (!nluResult) return null

  const handleDrawerClose = () => {
    lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
    onDone?.({ closed: true })
  }

  const handleDrawerSuccess = (result) => {
    lunaEventBus.emit('luna:actionCompleted', { intent: nluResult.intent, mode, result })
    lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
    onDone?.({ mode, ...result })
  }

  const handleDrawerCancel = () => {
    lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
    onDone?.({ mode, cancelled: true })
  }

  const handleFallbackClose = () => {
    setFallbackModal(null)
    lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
  }

  const handleFallbackSuccess = (result) => {
    setFallbackModal(null)
    lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
    onDone?.({ mode: 'fallback', ...result })
  }

  return (
    <>
      {/* Drawer inline (sem backdrop blur) */}
      {mode && mode !== 'auto' && mode !== 'fallback' && (
        <LunaActionDrawer
          result={nluResult}
          mode={mode}
          onClose={handleDrawerClose}
          onSuccess={handleDrawerSuccess}
          onCancel={handleDrawerCancel}
        />
      )}

      {/* Fallback para SmartFormModal */}
      {fallbackModal && (
        <SmartFormModal
          result={fallbackModal}
          onClose={handleFallbackClose}
          onSuccess={handleFallbackSuccess}
        />
      )}
    </>
  )
}
