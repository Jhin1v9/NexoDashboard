import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('click', handler)
    document.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('click', handler)
      document.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 180)
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 8)

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        style={{ left: adjustedX, top: adjustedY }}
        className="fixed z-[9990] w-44 glass-card rounded-lg border border-nexo-border shadow-xl py-1 overflow-hidden"
      >
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => { item.action(); onClose() }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
              item.danger
                ? 'text-nexo-danger hover:bg-nexo-danger/10'
                : 'text-nexo-text hover:bg-nexo-card/70'
            } ${item.separator ? 'border-t border-nexo-border mt-1 pt-1' : ''}`}
          >
            {item.icon && <item.icon size={14} />}
            <span>{item.label}</span>
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}
