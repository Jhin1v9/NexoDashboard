import { useEffect, useRef, useCallback } from 'react'

/**
 * Detecta uma sequência de toques rápidos em um elemento.
 * Útil para ativar recursos ocultos em mobile.
 */
export default function useSyncTap({ targetRef, threshold = 7, timeout = 1500, onTrigger }) {
  const countRef = useRef(0)
  const timerRef = useRef(null)

  const reset = useCallback(() => {
    countRef.current = 0
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    const el = targetRef?.current
    if (!el) return

    const handleTap = (e) => {
      // Ignora toques em inputs, buttons, links
      const tag = e.target?.tagName?.toLowerCase()
      if (['input', 'textarea', 'button', 'a', 'select'].includes(tag)) return

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

    el.addEventListener('touchstart', handleTap, { passive: true })
    el.addEventListener('click', handleTap)

    return () => {
      el.removeEventListener('touchstart', handleTap)
      el.removeEventListener('click', handleTap)
      reset()
    }
  }, [targetRef, threshold, timeout, onTrigger, reset])
}
