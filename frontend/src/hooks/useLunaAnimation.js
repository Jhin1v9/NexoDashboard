/**
 * ═════════════════════════════════════════════════════════════════════════════
 * useLunaAnimation — Hook de animações via Web Animations API.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Micro-interações que comunicam estado ao usuário:
 *   - create: fade-in + slide-up desde botão (400ms)
 *   - delete: fundo vermelho → shrink → fade-out (600ms)
 *   - update: pulse dourado no campo alterado (300ms)
 *   - move: slide horizontal para nova posição (300ms)
 *   - batch: stagger 50ms entre cada item
 *
 * Referência: Stripe animations — cada ação tem uma micro-interação.
 */

import { useCallback, useRef } from 'react'

const EASING = {
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
}

/**
 * Anima criação de um elemento: fade-in + slide-up.
 */
export function animateCreate(element, options = {}) {
  if (!element) return null
  const duration = options.duration || 400
  const fromY = options.fromY || 20

  return element.animate(
    [
      { opacity: 0, transform: `translateY(${fromY}px) scale(0.98)` },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ],
    {
      duration,
      easing: EASING.easeOut,
      fill: 'forwards',
    }
  )
}

/**
 * Anima deleção de um elemento: fundo vermelho → shrink → fade-out.
 */
export function animateDelete(element, options = {}) {
  if (!element) return null
  const duration = options.duration || 600
  const highlightDuration = options.highlightDuration || 200

  const anim = element.animate(
    [
      { backgroundColor: 'rgba(239, 68, 68, 0)' },
      { backgroundColor: 'rgba(239, 68, 68, 0.25)', offset: highlightDuration / duration },
      { opacity: 0, transform: 'scale(0.95)', height: 0, margin: 0, padding: 0 },
    ],
    {
      duration,
      easing: EASING.easeInOut,
      fill: 'forwards',
    }
  )

  // Marca o elemento para que o caller possa removê-lo do DOM após a animação
  anim.onfinish = () => {
    if (options.onRemove) options.onRemove()
  }

  return anim
}

/**
 * Anima atualização de um campo: pulse dourado.
 */
export function animateUpdate(element, options = {}) {
  if (!element) return null
  const duration = options.duration || 300
  const color = options.color || 'rgba(234, 179, 8, 0.3)' // amarelo/dourado

  return element.animate(
    [
      { backgroundColor: 'transparent' },
      { backgroundColor: color },
      { backgroundColor: 'transparent' },
    ],
    {
      duration,
      easing: EASING.easeInOut,
      fill: 'forwards',
    }
  )
}

/**
 * Anima movimento horizontal de um elemento.
 */
export function animateMove(element, options = {}) {
  if (!element) return null
  const duration = options.duration || 300
  const toX = options.toX || 0
  const fromX = options.fromX || -30

  return element.animate(
    [
      { transform: `translateX(${fromX}px)` },
      { transform: `translateX(${toX}px)` },
    ],
    {
      duration,
      easing: EASING.spring,
      fill: 'forwards',
    }
  )
}

/**
 * Anima uma lista de elementos com stagger (delay entre cada).
 */
export function animateBatch(elements, options = {}) {
  const staggerMs = options.stagger || 50
  const animationFn = options.animationFn || animateCreate
  const anims = []

  elements.forEach((el, i) => {
    setTimeout(() => {
      const anim = animationFn(el, { ...options, duration: options.itemDuration })
      if (anim) anims.push(anim)
    }, i * staggerMs)
  })

  return anims
}

/**
 * Animação de "respiração" antes de executar ação automática.
 * Dá 300ms de undo mental ao usuário.
 */
export function animateBreath(element, options = {}) {
  if (!element) return null
  const duration = options.duration || 300

  return element.animate(
    [
      { transform: 'scale(1)', filter: 'brightness(1)' },
      { transform: 'scale(1.02)', filter: 'brightness(1.05)' },
      { transform: 'scale(1)', filter: 'brightness(1)' },
    ],
    {
      duration,
      easing: EASING.easeInOut,
      fill: 'forwards',
    }
  )
}

/**
 * Animação de progresso para safety delay (barra de tempo).
 */
export function animateProgress(element, options = {}) {
  if (!element) return null
  const duration = options.duration || 1500

  return element.animate(
    [
      { width: '0%' },
      { width: '100%' },
    ],
    {
      duration,
      easing: 'linear',
      fill: 'forwards',
    }
  )
}

/**
 * Animação de shake para erro ou alerta.
 */
export function animateShake(element, options = {}) {
  if (!element) return null
  const duration = options.duration || 400

  return element.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(0)' },
    ],
    {
      duration,
      easing: EASING.easeInOut,
      fill: 'forwards',
    }
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// React Hook
// ═════════════════════════════════════════════════════════════════════════════

export function useLunaAnimation() {
  const registry = useRef(new Map())

  const register = useCallback((id, element) => {
    if (element) registry.current.set(id, element)
  }, [])

  const unregister = useCallback((id) => {
    registry.current.delete(id)
  }, [])

  const play = useCallback((id, type, options = {}) => {
    const element = registry.current.get(id)
    if (!element) return null

    switch (type) {
      case 'create': return animateCreate(element, options)
      case 'delete': return animateDelete(element, options)
      case 'update': return animateUpdate(element, options)
      case 'move': return animateMove(element, options)
      case 'breath': return animateBreath(element, options)
      case 'progress': return animateProgress(element, options)
      case 'shake': return animateShake(element, options)
      default: return null
    }
  }, [])

  const playBatch = useCallback((ids, options = {}) => {
    const elements = ids.map(id => registry.current.get(id)).filter(Boolean)
    return animateBatch(elements, options)
  }, [])

  return {
    register,
    unregister,
    play,
    playBatch,
    // Exporta funções puras também para uso fora de React
    animateCreate,
    animateDelete,
    animateUpdate,
    animateMove,
    animateBatch,
    animateBreath,
    animateProgress,
    animateShake,
  }
}

export default useLunaAnimation
