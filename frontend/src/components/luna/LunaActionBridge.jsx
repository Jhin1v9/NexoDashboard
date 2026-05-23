import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { lunaEventBus } from '../../lib/lunaEventBus'
import { useToast } from '../../context/ToastContext'

/**
 * LunaActionBridge — Ponte entre ações da Luna e o DOM do dashboard.
 *
 * Escuta eventos de ação completada e executa efeitos no frontend:
 *   - navigate: Navega para uma rota
 *   - filter: Aplica filtro na página atual
 *   - highlight: Destaca elemento na página
 *   - toast: Mostra toast notification
 *   - scroll: Scrolla para elemento
 */

export default function LunaActionBridge() {
  const navigate = useNavigate()
  const { addToast } = useToast()

  useEffect(() => {
    const handleActionCompleted = (data) => {
      if (!data?.actions?.length) return

      for (const action of data.actions) {
        switch (action.type) {
          case 'navigate':
          case 'navegar': {
            const dest = action.params?.destino || action.params?.pagina || action.destino || '/dashboard'
            navigate(dest)
            addToast?.(`Navegando para ${dest}...`, 'info')
            break
          }

          case 'filter': {
            const { module, status, priority, assignee } = action.params || {}
            // Emite evento para a página atual filtrar
            lunaEventBus.emit('luna:filter', { module, status, priority, assignee })
            break
          }

          case 'highlight': {
            const { selector, duration = 3000 } = action.params || {}
            if (selector) {
              const el = document.querySelector(selector)
              if (el) {
                el.style.transition = 'box-shadow 0.3s ease'
                el.style.boxShadow = '0 0 0 3px rgba(0,240,255,0.6), 0 0 20px rgba(0,240,255,0.3)'
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => {
                  el.style.boxShadow = ''
                }, duration)
              }
            }
            break
          }

          case 'scroll': {
            const { selector: scrollSelector } = action.params || {}
            if (scrollSelector) {
              const el = document.querySelector(scrollSelector)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            break
          }

          case 'toast': {
            const { message, type = 'info' } = action.params || {}
            if (message) addToast?.(message, type)
            break
          }

          case 'focus': {
            const { selector: focusSelector } = action.params || {}
            if (focusSelector) {
              const el = document.querySelector(focusSelector)
              if (el) {
                el.focus()
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }
            break
          }

          default:
            // Ignora ações não reconhecidas pelo bridge
            break
        }
      }
    }

    lunaEventBus.on('luna:actionCompleted', handleActionCompleted)
    return () => lunaEventBus.off('luna:actionCompleted', handleActionCompleted)
  }, [navigate, addToast])

  return null
}
