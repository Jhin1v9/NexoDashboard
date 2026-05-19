/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaSafetyDelay — Barra de progresso com undo para ações destrutivas.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Referência: Gmail "Desfazer envio" — dá N segundos para cancelar.
 *
 * Props:
 *   - durationMs: tempo de delay (default 1500ms)
 *   - onConfirm: chamado quando o delay termina sem cancelamento
 *   - onCancel: chamado quando usuário clica em Desfazer
 *   - message: texto exibido acima da barra
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Undo2, AlertTriangle, Timer } from 'lucide-react'

export default function LunaSafetyDelay({
  durationMs = 1500,
  onConfirm,
  onCancel,
  message = 'Esta ação será executada em...',
}) {
  const [progress, setProgress] = useState(0)
  const [isCancelled, setIsCancelled] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const startTimeRef = useRef(null)
  const rafRef = useRef(null)

  const cancel = useCallback(() => {
    if (isDone) return
    setIsCancelled(true)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    onCancel?.()
  }, [isDone, onCancel])

  useEffect(() => {
    if (isCancelled) return

    startTimeRef.current = performance.now()

    const tick = (now) => {
      const elapsed = now - startTimeRef.current
      const pct = Math.min((elapsed / durationMs) * 100, 100)
      setProgress(pct)

      if (elapsed >= durationMs) {
        setIsDone(true)
        onConfirm?.()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [durationMs, onConfirm, isCancelled])

  // Tecla ESC cancela
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cancel])

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-nexo-muted/10 border border-nexo-border text-nexo-muted text-xs">
        <Undo2 className="w-4 h-4" />
        Ação cancelada pelo usuário.
      </div>
    )
  }

  const secondsLeft = Math.max(0, Math.ceil((durationMs - (progress / 100) * durationMs) / 1000))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-nexo-warning">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{message}</span>
        <span className="flex items-center gap-1 text-nexo-muted tabular-nums">
          <Timer className="w-3 h-3" />
          {secondsLeft}s
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 bg-nexo-border/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-nexo-danger rounded-full transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Botão Desfazer */}
      <button
        onClick={cancel}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-nexo-border text-nexo-muted text-sm font-medium hover:bg-nexo-danger/10 hover:text-nexo-danger hover:border-nexo-danger/30 transition-colors"
      >
        <Undo2 className="w-4 h-4" />
        Desfazer (ESC)
      </button>
    </div>
  )
}
