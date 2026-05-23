import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wand2 } from 'lucide-react'
import { lunaEventBus } from '../../lib/lunaEventBus'
import LunaChatPanel from './LunaChatPanel'
import LunaActionCenter from './LunaActionCenter'
import axios from 'axios'

/**
 * LunaFloatingButton — Orb holográfico flutuante para acessar a Luna.
 *
 * Visual: Orb circular com gradiente animado, glow pulsante, campo de força no hover.
 */

export default function LunaFloatingButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [proactiveBadge, setProactiveBadge] = useState(null)
  const [actionCenterOpen, setActionCenterOpen] = useState(false)

  // ── Drag state ──
  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem('luna_fab_pos')
      return raw ? JSON.parse(raw) : { x: 0, y: 0 }
    } catch { return { x: 0, y: 0 } }
  })
  const drag = useRef({ active: false, dragged: false, mx: 0, my: 0, bx: 0, by: 0 })
  const fabRef = useRef(null)

  // Emite evento de estado quando abre/fecha
  useEffect(() => {
    if (isOpen) {
      lunaEventBus.emit('luna:stateChange', { chatState: 'listening', isOpen: true })
    } else {
      lunaEventBus.emit('luna:stateChange', { chatState: 'idle', isOpen: false })
    }
  }, [isOpen])

  // ── Badge Proativo: busca pendências a cada 60s ──
  useEffect(() => {
    const fetchProactive = async () => {
      try {
        const token = localStorage.getItem('nexo_token') || ''
        const res = await axios.get('/api/luna/proactive', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.data?.total > 0) {
          setProactiveBadge({ count: res.data.total, type: res.data.topPriority })
        } else {
          setProactiveBadge(null)
        }
      } catch {
        setProactiveBadge(null)
      }
    }
    fetchProactive()
    const interval = setInterval(fetchProactive, 60000)
    return () => clearInterval(interval)
  }, [])

  // ── Ouve eventos proativos ──
  useEffect(() => {
    const handleOpenActionCenter = () => {
      setActionCenterOpen(true)
      setIsOpen(false)
    }
    const handleDismissed = () => {
      const fetchProactive = async () => {
        try {
          const token = localStorage.getItem('nexo_token') || ''
          const res = await axios.get('/api/luna/proactive', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.data?.total > 0) {
            setProactiveBadge({ count: res.data.total, type: res.data.topPriority })
          } else {
            setProactiveBadge(null)
          }
        } catch {
          setProactiveBadge(null)
        }
      }
      fetchProactive()
    }
    const handleOpenChat = () => {
      setActionCenterOpen(false)
      setIsOpen(true)
    }
    lunaEventBus.on('luna:openActionCenter', handleOpenActionCenter)
    lunaEventBus.on('luna:openChat', handleOpenChat)
    lunaEventBus.on('luna:actionDismissed', handleDismissed)
    return () => {
      lunaEventBus.off('luna:openActionCenter', handleOpenActionCenter)
      lunaEventBus.off('luna:openChat', handleOpenChat)
      lunaEventBus.off('luna:actionDismissed', handleDismissed)
    }
  }, [])

  // Fecha com ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setActionCenterOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const isActive = isOpen || actionCenterOpen

  return (
    <>
      {/* Luna Chat Panel */}
      <LunaChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />

      {/* Orb Holográfico — arrastável */}
      <div
        ref={fabRef}
        className="fixed bottom-6 right-6 z-[100] select-none"
        style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, cursor: 'grab' }}
      >
        {/* Campo de força / glow externo */}
        <AnimatePresence>
          {!isActive && proactiveBadge && proactiveBadge.count > 0 && (
            <motion.div
              className="absolute inset-0 rounded-full"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background: 'radial-gradient(circle, rgba(0,240,255,0.3) 0%, transparent 70%)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Anel externo no hover */}
        <motion.div
          className="absolute inset-[-4px] rounded-full border border-cyan-500/20"
          whileHover={{ scale: 1.15, opacity: 1 }}
          initial={{ scale: 1, opacity: 0 }}
          animate={{ opacity: isActive ? 0 : 0.6 }}
          transition={{ duration: 0.3 }}
        />

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all"
          style={{
            background: isActive
              ? 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)'
              : 'linear-gradient(135deg, rgba(0,240,255,0.9) 0%, rgba(155,89,182,0.9) 100%)',
            boxShadow: isActive
              ? '0 0 20px rgba(255,71,87,0.4), 0 0 40px rgba(255,71,87,0.2)'
              : '0 0 20px rgba(0,240,255,0.3), 0 0 40px rgba(155,89,182,0.2), inset 0 0 10px rgba(255,255,255,0.1)',
          }}
          onMouseDown={(e) => {
            const d = drag.current
            d.active = true
            d.dragged = false
            d.mx = e.clientX
            d.my = e.clientY
            d.bx = pos.x
            d.by = pos.y
          }}
          onMouseMove={(e) => {
            const d = drag.current
            if (!d.active) return
            const dx = e.clientX - d.mx
            const dy = e.clientY - d.my
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) d.dragged = true
            if (d.dragged) {
              e.preventDefault()
              setPos({ x: d.bx + dx, y: d.by + dy })
            }
          }}
          onMouseUp={() => {
            const d = drag.current
            if (!d.active) return
            d.active = false
            try { localStorage.setItem('luna_fab_pos', JSON.stringify(pos)) } catch {}
          }}
          onMouseLeave={() => {
            const d = drag.current
            if (d.active) {
              d.active = false
              try { localStorage.setItem('luna_fab_pos', JSON.stringify(pos)) } catch {}
            }
          }}
          onClick={() => {
            if (drag.current.dragged) return
            if (actionCenterOpen) {
              setActionCenterOpen(false)
              return
            }
            setIsOpen(!isOpen)
          }}
        >
          {/* Inner glow */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 60%)',
            }}
          />
          {isActive ? (
            <X className="w-5 h-5 text-white relative z-10" />
          ) : (
            <Wand2 className="w-5 h-5 text-white relative z-10" />
          )}
        </motion.button>

        {/* Badge Proativo — clique separado abre Action Center */}
        {!isActive && proactiveBadge && proactiveBadge.count > 0 && (
          <button
            onClick={() => setActionCenterOpen(true)}
            className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center px-1 rounded-full text-white text-[10px] font-bold shadow-lg animate-pulse hover:scale-110 transition-transform cursor-pointer z-[101] font-mono"
            style={{
              background: 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)',
              boxShadow: '0 0 10px rgba(255,71,87,0.5)',
            }}
          >
            {proactiveBadge.count > 9 ? '9+' : proactiveBadge.count}
          </button>
        )}
      </div>

      {/* Luna Action Center */}
      {actionCenterOpen && (
        <LunaActionCenter onClose={() => setActionCenterOpen(false)} />
      )}
    </>
  )
}
