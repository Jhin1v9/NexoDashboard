import { useEffect, useRef, useCallback } from 'react'

/**
 * Detecta uma sequência de toques rápidos em um elemento.
 * Útil para ativar recursos ocultos em mobile.
 *
 * Em touch devices: usa touchstart (ignora click sintético)
 * Em desktop: usa mousedown
 */
export default function useSyncTap({ targetRef, threshold = 7, timeout = 1500, onTrigger }) {
  const countRef = useRef(0)
  const timerRef = useRef(null)
  const touchFiredRef = useRef(false)

  const reset = useCallback(() => {
    countRef.current = 0
    touchFiredRef.current = false
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    const el = targetRef?.current
    if (!el) return

    const handleTouch = (e) => {
      const tag = e.target?.tagName?.toLowerCase()
      if (['input', 'textarea', 'button', 'a', 'select'].includes(tag)) return

      touchFiredRef.current = true
      countRef.current += 1

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        countRef.current = 0
        touchFiredRef.current = false
      }, timeout)

      if (countRef.current >= threshold) {
        reset()
        onTrigger?.()
      }
    }

    const handleMouse = (e) => {
      const tag = e.target?.tagName?.toLowerCase()
      if (['input', 'textarea', 'button', 'a', 'select'].includes(tag)) return

      // Se touch já disparou neste ciclo, ignora o click sintético
      if (touchFiredRef.current) return

      countRef.current += 1

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        countRef.current = 0
      }, timeout)

      if (countRef.current >= threshold) {
        reset()
        onTrigger?.()
      }
    }

    el.addEventListener('touchstart', handleTouch, { passive: true })
    el.addEventListener('mousedown', handleMouse)

    return () => {
      el.removeEventListener('touchstart', handleTouch)
      el.removeEventListener('mousedown', handleMouse)
      reset()
    }
  }, [targetRef, threshold, timeout, onTrigger, reset])
}
