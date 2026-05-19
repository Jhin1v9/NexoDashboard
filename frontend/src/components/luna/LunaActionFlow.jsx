/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaActionFlow — Orquestrador de execução inteligente (Passo 3).
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Recebe resultado do NLU, consulta o Decision Engine, e executa
 * o fluxo correto: auto, collect, preview, confirm, ou transform.
 *
 * Este componente NÃO renderiza UI própria — ele orquestra outros
 * componentes (drawer, safety delay, toasts, animações).
 */

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useToast } from '../../context/ToastContext'
import { useLunaContext } from '../../hooks/useLunaContext'
import { lunaEventBus } from '../../lib/lunaEventBus'
import { decideExecution, logDecision } from '../../lib/lunaDecisionEngine'
import { getSchema, hasFormFields } from './LunaIntentSchemas'
import LunaActionDrawer from './LunaActionDrawer'
import SmartFormModal from './SmartFormModal'

export default function LunaActionFlow({ nluResult, onDone }) {
  const { addToast } = useToast()
  const { currentModule } = useLunaContext()
  const [drawerMode, setDrawerMode] = useState(null)
  const [fallbackModal, setFallbackModal] = useState(null)

  const intent = nluResult?.intent || 'None'
  const score = nluResult?.score || 0
  const text = nluResult?.text || ''
  const schema = getSchema(intent)

  // ── Execução direta (modo AUTO) ──
  const executeAuto = useCallback(async () => {
    lunaEventBus.emit('luna:stateChange', { chatState: 'acting' })

    try {
      if (schema.isRedirect) {
        const target = typeof schema.redirectTo === 'function'
          ? schema.redirectTo({})
          : schema.redirectTo
        onDone?.({ mode: 'auto', redirect: target })
        return
      }

      if (schema.isInfo) {
        onDone?.({ mode: 'auto', info: true })
        return
      }

      if (!schema.submitConfig) {
        onDone?.({ mode: 'auto', noAction: true })
        return
      }

      const payload = schema.submitConfig.transform({})
      const token = localStorage.getItem('nexo_token') || ''
      await axios({
        method: schema.submitConfig.method,
        url: schema.submitConfig.endpoint,
        data: payload,
        headers: { Authorization: `Bearer ${token}` },
      })

      addToast(schema.successMessage || 'Feito! ✓', 'success')
      lunaEventBus.emit('luna:actionCompleted', { intent, mode: 'auto', payload })
      onDone?.({ mode: 'auto', intent, payload })
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erro'
      addToast(`Erro: ${msg}`, 'error')
      lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
      onDone?.({ mode: 'auto', error: msg })
    }
  }, [nluResult, schema, addToast, onDone])

  // ── Decide o que fazer quando recebe resultado NLU ──
  useEffect(() => {
    if (!nluResult) return

    // Intents sem schema de formulário → fallback para chat/redirect como antes
    if (!hasFormFields(intent)) {
      onDone?.({ mode: 'fallback', intent })
      return
    }

    // Decision Engine
    const decision = decideExecution({
      score,
      intent,
      text,
      schema,
      values: {}, // valores serão preenchidos pelo drawer
      hasSelection: false,
    })

    logDecision(decision, 'LunaActionFlow')

    switch (decision.mode) {
      case 'auto':
        executeAuto()
        break

      case 'collect':
      case 'preview':
      case 'confirm':
        setDrawerMode(decision.mode)
        lunaEventBus.emit('luna:stateChange', { chatState: 'acting' })
        break

      case 'transform':
        // Por enquanto, transform cai no drawer como preview
        // (transformação de interface — checkboxes — virá no Passo 5)
        setDrawerMode('preview')
        lunaEventBus.emit('luna:stateChange', { chatState: 'acting' })
        break

      default:
        // Segurança: fallback para modal antigo se algo der errado
        setFallbackModal(nluResult)
    }
  }, [nluResult, intent, score, text, schema, executeAuto, onDone])

  const handleDrawerClose = () => {
    setDrawerMode(null)
    lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
  }

  const handleDrawerSuccess = (result) => {
    setDrawerMode(null)
    lunaEventBus.emit('luna:actionCompleted', { intent, mode: drawerMode, result })
    lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
    onDone?.({ mode: drawerMode, ...result })
  }

  const handleDrawerCancel = () => {
    setDrawerMode(null)
    lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
    onDone?.({ mode: drawerMode, cancelled: true })
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
      {drawerMode && (
        <LunaActionDrawer
          result={nluResult}
          mode={drawerMode}
          onClose={handleDrawerClose}
          onSuccess={handleDrawerSuccess}
          onCancel={handleDrawerCancel}
        />
      )}

      {/* Fallback para SmartFormModal (se algo der errado) */}
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
