import { useState, useCallback, useRef, useEffect } from 'react'

export default function ResizablePanel({
  children,
  defaultWidth = 320,
  minWidth = 200,
  maxWidth = 600,
  storageKey = 'nexo-panel-width',
  side = 'right', // 'right' or 'left' — where the resize handle appears
}) {
  const panelRef = useRef(null)
  const [width, setWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? Math.max(minWidth, Math.min(maxWidth, parseInt(stored, 10))) : defaultWidth
    } catch {
      return defaultWidth
    }
  })
  const [isResizing, setIsResizing] = useState(false)

  const startResizing = useCallback((e) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e) => {
      const panel = panelRef.current
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      let newWidth
      if (side === 'right') {
        newWidth = e.clientX - rect.left
      } else {
        newWidth = rect.right - e.clientX
      }
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      try {
        localStorage.setItem(storageKey, String(width))
      } catch { /* noop */ }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, minWidth, maxWidth, side, storageKey, width])

  return (
    <div
      ref={panelRef}
      className="relative flex-shrink-0"
      style={{ width: `${width}px` }}
    >
      {children}
      {/* Resize handle */}
      <div
        onMouseDown={startResizing}
        className={`absolute top-0 ${side === 'right' ? 'right-0 -translate-x-1/2' : 'left-0 translate-x-1/2'} h-full w-3 cursor-col-resize flex items-center justify-center z-10 group`}
        title="Arraste para redimensionar"
      >
        <div className={`w-0.5 h-8 rounded-full bg-nexo-border group-hover:bg-nexo-primary transition-colors ${isResizing ? 'bg-nexo-primary' : ''}`} />
      </div>
    </div>
  )
}
