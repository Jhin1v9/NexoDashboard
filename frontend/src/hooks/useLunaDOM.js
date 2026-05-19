import { useEffect } from 'react'
import { lunaEventBus } from '../lib/lunaEventBus'

/**
 * useLunaDOM — Hook que captura interações do usuário com o DOM
 * e emite eventos para a Luna saber o que ele está fazendo.
 *
 * Captura:
 *   - clicks em elementos interativos (botões, links, cards, checkboxes)
 *   - foco em inputs e textareas
 *   - scroll na página principal
 *
 * Usar em cada página principal (Tarefas, EmailHub, Financeiro, etc)
 */

const INTERACTIVE_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL'])
const INTERACTIVE_ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem'])

function getElementType(el) {
  if (!el) return 'unknown'

  const tag = el.tagName
  if (INTERACTIVE_TAGS.has(tag)) {
    if (tag === 'INPUT') return `input:${el.type || 'text'}`
    return tag.toLowerCase()
  }

  const role = el.getAttribute('role')
  if (role && INTERACTIVE_ROLES.has(role)) {
    return `role:${role}`
  }

  // Verifica se é um card/list-item clicável
  if (el.closest('[data-luna-track]')) {
    return el.closest('[data-luna-track]').dataset.lunaTrack
  }

  if (tag === 'DIV' || tag === 'SPAN' || tag === 'LI') {
    const clickable = el.onclick || el.closest('button') || el.closest('a')
    if (clickable) return 'clickable'
  }

  return 'unknown'
}

function getElementId(el) {
  if (!el) return null
  return el.id || el.dataset?.id || el.dataset?.lunaId || null
}

function getElementLabel(el) {
  if (!el) return null
  return (
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    el.textContent?.trim().substring(0, 50) ||
    null
  )
}

export function useLunaDOM(moduleId) {
  useEffect(() => {
    let lastScroll = 0
    let scrollTimeout = null

    const handleClick = (e) => {
      const el = e.target
      const type = getElementType(el)
      if (type === 'unknown') return

      lunaEventBus.emit('luna:elementClicked', {
        module: moduleId,
        elementType: type,
        elementId: getElementId(el),
        elementLabel: getElementLabel(el),
        timestamp: Date.now(),
      })
    }

    const handleFocus = (e) => {
      const el = e.target
      const type = getElementType(el)
      if (!type.startsWith('input') && type !== 'textarea' && type !== 'select') return

      lunaEventBus.emit('luna:userFocus', {
        module: moduleId,
        elementType: type,
        elementId: getElementId(el),
        elementLabel: getElementLabel(el),
        interactionType: 'focus',
        timestamp: Date.now(),
      })
    }

    const handleScroll = () => {
      const now = Date.now()
      if (now - lastScroll < 200) return
      lastScroll = now

      if (scrollTimeout) clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        lunaEventBus.emit('luna:userScroll', {
          module: moduleId,
          scrollY: window.scrollY,
          scrollPercent: Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100),
          timestamp: Date.now(),
        })
      }, 300)
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('focusin', handleFocus, true)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('focusin', handleFocus, true)
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeout) clearTimeout(scrollTimeout)
    }
  }, [moduleId])
}
