import { useEffect } from 'react'

export function useEmailShortcuts({
  onCompose,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onTrash,
  onSpam,
  onStar,
  onUnread,
  onNavigate,
  onOpen,
  onFocusSearch,
  enabled = true,
}) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e) => {
      // Ignora se estiver em input/textarea/editor
      const tag = e.target.tagName.toLowerCase()
      const isEditable = e.target.isContentEditable
      if (tag === 'input' || tag === 'textarea' || isEditable) return

      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault()
          onCompose?.()
          break
        case 'r':
          e.preventDefault()
          if (e.shiftKey) onReplyAll?.()
          else onReply?.()
          break
        case 'f':
          e.preventDefault()
          onForward?.()
          break
        case 'e':
          e.preventDefault()
          onArchive?.()
          break
        case '#':
          e.preventDefault()
          onTrash?.()
          break
        case '!':
          e.preventDefault()
          onSpam?.()
          break
        case 's':
          e.preventDefault()
          onStar?.()
          break
        case 'u':
          e.preventDefault()
          onUnread?.()
          break
        case 'j':
          e.preventDefault()
          onNavigate?.('down')
          break
        case 'k':
          e.preventDefault()
          onNavigate?.('up')
          break
        case 'o':
        case 'enter':
          e.preventDefault()
          onOpen?.()
          break
        case '/':
          e.preventDefault()
          onFocusSearch?.()
          break
        case 'escape':
          // Deixa o componente pai lidar
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, onCompose, onReply, onReplyAll, onForward, onArchive, onTrash, onSpam, onStar, onUnread, onNavigate, onOpen, onFocusSearch])
}
