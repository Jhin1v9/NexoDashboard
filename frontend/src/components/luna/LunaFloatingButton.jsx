import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wand2, Ghost, Mic, MicOff } from 'lucide-react'
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
  const [ghostMode, setGhostMode] = useState(() => {
    try { return localStorage.getItem('luna_ghost_mode') === 'true' } catch { return false }
  })
  const [showGhostLabel, setShowGhostLabel] = useState(false)
  const [ghostNotification, setGhostNotification] = useState(null)
  const [ghostParticles, setGhostParticles] = useState([])
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)

  // ── Speech Recognition ──
  const SpeechRecognitionAPI = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
  const recognitionRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const wasLongPressRef = useRef(false)

  // ── Drag state ──
  const BUTTON_SIZE = 72 // tamanho aumentado pra mais visível
  const clampPos = (p) => {
    // Garante que o FAB nunca saia da viewport
    // O botão está em fixed bottom-6 right-6 (24px das bordas)
    // translate3d positivo em x = direita (fora), negativo = esquerda (dentro)
    // translate3d positivo em y = baixo (fora), negativo = cima (dentro)
    const maxOffsetX = Math.max(0, window.innerWidth - BUTTON_SIZE - 24)
    const maxOffsetY = Math.max(0, window.innerHeight - BUTTON_SIZE - 24)
    return {
      x: Math.min(Math.max(p.x, -maxOffsetX), 0),
      y: Math.min(Math.max(p.y, -maxOffsetY), 0),
    }
  }
  const resetPos = () => {
    const defaultPos = { x: 0, y: 0 }
    setPos(defaultPos)
    try { localStorage.setItem('luna_fab_pos', JSON.stringify(defaultPos)) } catch {}
  }
  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem('luna_fab_pos')
      const parsed = raw ? JSON.parse(raw) : { x: 0, y: 0 }
      // Resetar se estiver fora dos limites válidos
      const maxOffsetX = Math.max(0, (typeof window !== 'undefined' ? window.innerWidth : 1200) - BUTTON_SIZE - 24)
      const maxOffsetY = Math.max(0, (typeof window !== 'undefined' ? window.innerHeight : 800) - BUTTON_SIZE - 24)
      if (parsed.x > 0 || parsed.x < -maxOffsetX - 50 || parsed.y > 0 || parsed.y < -maxOffsetY - 50) {
        console.warn('[LunaFAB] Posição salva fora da viewport — resetando para padrão')
        return { x: 0, y: 0 }
      }
      return clampPos(parsed)
    } catch { return { x: 0, y: 0 } }
  })
  const drag = useRef({ active: false, dragged: false, mx: 0, my: 0, bx: 0, by: 0 })
  const fabRef = useRef(null)
  const particleIdRef = useRef(0)

  // ── Voice helpers ──
  const startVoiceListening = useCallback(() => {
    if (!SpeechRecognitionAPI) return
    setIsVoiceMode(true)
    setIsListening(true)
    setVoiceTranscript('')

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }
      setVoiceTranscript(finalTranscript + interimTranscript)
    }

    recognition.onerror = (event) => {
      console.warn('[LunaFAB] Voice error:', event.error)
      if (event.error === 'not-allowed') {
        setIsListening(false)
        setIsVoiceMode(false)
      }
    }

    recognition.onend = () => {
      if (isListening && recognitionRef.current) {
        try { recognition.start() } catch (e) {}
      }
    }

    recognition.start()
    recognitionRef.current = recognition
  }, [SpeechRecognitionAPI, isListening])

  const stopVoiceListening = useCallback(() => {
    setIsListening(false)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
      recognitionRef.current = null
    }
    const text = voiceTranscript.trim()
    if (text) {
      // Abre o chat e emite a mensagem transcrita
      setIsOpen(true)
      setTimeout(() => {
        lunaEventBus.emit('luna:voiceMessage', { text })
      }, 300)
    }
    setVoiceTranscript('')
    setTimeout(() => setIsVoiceMode(false), 500)
  }, [voiceTranscript])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch (e) {}
      }
    }
  }, [])

  // ── Ghost Mode ──
  const toggleGhost = useCallback(() => {
    const next = !ghostMode
    setGhostMode(next)
    localStorage.setItem('luna_ghost_mode', String(next))
    // Emitir evento para outros componentes
    window.dispatchEvent(new StorageEvent('storage', { key: 'luna_ghost_mode' }))
    if (next) {
      setIsOpen(false)
      setActionCenterOpen(false)
    }
  }, [ghostMode])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
      // Shift+G = reset posição + desativa ghost mode (emergência)
      if ((e.key === 'g' || e.key === 'G') && e.shiftKey) {
        e.preventDefault()
        setGhostMode(false)
        localStorage.setItem('luna_ghost_mode', 'false')
        resetPos()
        setShowGhostLabel(false)
        return
      }
      // G = toggle ghost mode
      if (e.key === 'g' || e.key === 'G') {
        toggleGhost()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleGhost])

  // Ghost mode particle trail
  useEffect(() => {
    if (!ghostMode) {
      setGhostParticles([])
      setShowGhostLabel(false)
      return
    }
    // Mostra label "Ghost" brevemente ao entrar em ghost mode
    setShowGhostLabel(true)
    const labelTimer = setTimeout(() => setShowGhostLabel(false), 3000)
    const interval = setInterval(() => {
      const id = particleIdRef.current++
      setGhostParticles(prev => [...prev.slice(-8), { id, x: pos.x, y: pos.y }])
    }, 300)
    return () => {
      clearInterval(interval)
      clearTimeout(labelTimer)
    }
  }, [ghostMode, pos.x, pos.y])

  // Ghost mode proactive notification
  useEffect(() => {
    if (!ghostMode || !proactiveBadge || proactiveBadge.count === 0) return
    const timer = setTimeout(() => {
      setGhostNotification({
        text: `${proactiveBadge.count} pendência${proactiveBadge.count > 1 ? 's' : ''} precisa${proactiveBadge.count > 1 ? 'm' : ''} de atenção`,
        timestamp: Date.now(),
      })
    }, 2000)
    return () => clearTimeout(timer)
  }, [ghostMode, proactiveBadge])

  // Auto-dismiss ghost notification
  useEffect(() => {
    if (!ghostNotification) return
    const timer = setTimeout(() => setGhostNotification(null), 6000)
    return () => clearTimeout(timer)
  }, [ghostNotification])

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

  // Recalcula limites ao redimensionar a janela (evita FAB fora da tela)
  useEffect(() => {
    const handleResize = () => setPos(prev => clampPos(prev))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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
  const isGhost = ghostMode

  // Ghost mode styles
  const ghostStyles = isGhost ? {
    opacity: 0.6,
    scale: 0.85,
    bg: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
    shadow: '0 0 15px rgba(148,163,184,0.15)',
  } : {
    opacity: 1,
    scale: 1,
    bg: isVoiceMode
      ? 'linear-gradient(135deg, #2ed573 0%, #00f0ff 100%)'
      : isActive
        ? 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)'
        : 'linear-gradient(135deg, rgba(0,240,255,0.95) 0%, rgba(155,89,182,0.95) 100%)',
    shadow: isVoiceMode
      ? '0 0 30px rgba(46,213,115,0.6), 0 0 60px rgba(0,240,255,0.3), inset 0 0 15px rgba(255,255,255,0.2)'
      : isActive
        ? '0 0 20px rgba(255,71,87,0.4), 0 0 40px rgba(255,71,87,0.2)'
        : '0 0 25px rgba(0,240,255,0.4), 0 0 50px rgba(155,89,182,0.3), inset 0 0 12px rgba(255,255,255,0.15)',
  }

  return (
    <>
      {/* Luna Chat Panel */}
      <LunaChatPanel isOpen={isOpen && !isGhost} onClose={() => setIsOpen(false)} />

      {/* Ghost particle trail */}
      <AnimatePresence>
        {isGhost && ghostParticles.map((p) => (
          <motion.div
            key={p.id}
            className="fixed bottom-6 right-6 z-[99] pointer-events-none rounded-full"
            style={{
              transform: `translate3d(${p.x}px, ${p.y}px, 0)`,
              width: 8,
              height: 8,
              marginLeft: 20,
              marginTop: 20,
            }}
            initial={{ opacity: 0.3, scale: 1 }}
            animate={{ opacity: 0, scale: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          >
            <div
              className="w-full h-full rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(148,163,184,0.4) 0%, transparent 70%)',
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Orb Holográfico — arrastável */}
      <div
        ref={fabRef}
        className="fixed bottom-6 right-6 z-[100] select-none"
        style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, cursor: 'grab' }}
      >
        {/* Ghost ethereal aura */}
        <AnimatePresence>
          {isGhost && (
            <>
              <motion.div
                className="absolute inset-[-8px] rounded-full"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  background: 'radial-gradient(circle, rgba(148,163,184,0.15) 0%, transparent 70%)',
                }}
              />
              <motion.div
                className="absolute inset-[-16px] rounded-full"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.05, 0.1, 0.05] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                style={{
                  background: 'radial-gradient(circle, rgba(148,163,184,0.1) 0%, transparent 70%)',
                }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Campo de força / glow externo */}
        <AnimatePresence>
          {!isActive && !isGhost && proactiveBadge && proactiveBadge.count > 0 && (
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

        {/* Anel externo pulsante — sempre visível */}
        {!isGhost && !isVoiceMode && (
          <motion.div
            className="absolute inset-[-6px] rounded-full border-2 border-cyan-400/30"
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        {/* Anel de voz ativa */}
        {isVoiceMode && (
          <>
            <motion.div
              className="absolute inset-[-10px] rounded-full border-2 border-emerald-400/40"
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.2, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-[-18px] rounded-full border border-emerald-400/20"
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.1, 0.3] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            />
          </>
        )}

        <motion.button
          whileHover={isGhost || isVoiceMode ? {} : { scale: 1.08 }}
          whileTap={isGhost || isVoiceMode ? {} : { scale: 0.92 }}
          className="relative flex items-center justify-center rounded-full shadow-2xl transition-all"
          style={{
            width: isGhost ? 44 : BUTTON_SIZE,
            height: isGhost ? 44 : BUTTON_SIZE,
            opacity: ghostStyles.opacity,
            background: ghostStyles.bg,
            boxShadow: ghostStyles.shadow,
          }}
          onMouseDown={(e) => {
            if (isVoiceMode) return
            const d = drag.current
            d.active = true
            d.dragged = false
            d.mx = e.clientX
            d.my = e.clientY
            d.bx = pos.x
            d.by = pos.y
            wasLongPressRef.current = false
            longPressTimerRef.current = setTimeout(() => {
              wasLongPressRef.current = true
              d.active = false
              d.dragged = false
              startVoiceListening()
            }, 600)
          }}
          onMouseMove={(e) => {
            const d = drag.current
            if (!d.active) return
            const dx = e.clientX - d.mx
            const dy = e.clientY - d.my
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
              d.dragged = true
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current)
                longPressTimerRef.current = null
              }
            }
            if (d.dragged) {
              e.preventDefault()
              setPos(clampPos({ x: d.bx + dx, y: d.by + dy }))
            }
          }}
          onMouseUp={() => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current)
              longPressTimerRef.current = null
            }
            const d = drag.current
            if (!d.active) return
            d.active = false
            try { localStorage.setItem('luna_fab_pos', JSON.stringify(pos)) } catch {}
          }}
          onMouseLeave={() => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current)
              longPressTimerRef.current = null
            }
            const d = drag.current
            if (d.active) {
              d.active = false
              try { localStorage.setItem('luna_fab_pos', JSON.stringify(pos)) } catch {}
            }
          }}
          onTouchStart={(e) => {
            if (isVoiceMode) return
            const touch = e.touches[0]
            const d = drag.current
            d.active = true
            d.dragged = false
            d.mx = touch.clientX
            d.my = touch.clientY
            d.bx = pos.x
            d.by = pos.y
            wasLongPressRef.current = false
            longPressTimerRef.current = setTimeout(() => {
              wasLongPressRef.current = true
              d.active = false
              d.dragged = false
              startVoiceListening()
            }, 600)
          }}
          onTouchMove={(e) => {
            const d = drag.current
            if (!d.active) return
            const touch = e.touches[0]
            const dx = touch.clientX - d.mx
            const dy = touch.clientY - d.my
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
              d.dragged = true
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current)
                longPressTimerRef.current = null
              }
            }
            if (d.dragged) {
              e.preventDefault()
              setPos(clampPos({ x: d.bx + dx, y: d.by + dy }))
            }
          }}
          onTouchEnd={() => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current)
              longPressTimerRef.current = null
            }
            const d = drag.current
            if (!d.active) return
            d.active = false
            try { localStorage.setItem('luna_fab_pos', JSON.stringify(pos)) } catch {}
          }}
          onClick={() => {
            if (drag.current.dragged) return
            if (wasLongPressRef.current) return
            if (isVoiceMode) {
              stopVoiceListening()
              return
            }
            if (isGhost) {
              toggleGhost()
              return
            }
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
              background: isGhost
                ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.05) 0%, transparent 60%)'
                : isVoiceMode
                  ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 60%)'
                  : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25) 0%, transparent 60%)',
            }}
          />
          {isGhost ? (
            <Ghost className="w-5 h-5 text-slate-400/60 relative z-10" />
          ) : isVoiceMode ? (
            <MicOff className="w-7 h-7 text-white relative z-10" />
          ) : isActive ? (
            <X className="w-7 h-7 text-white relative z-10" />
          ) : (
            <Wand2 className="w-7 h-7 text-white relative z-10" />
          )}
        </motion.button>

        {/* Label de instrução */}
        <AnimatePresence>
          {!isGhost && !isActive && !isVoiceMode && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: -8 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ delay: 1, duration: 0.4 }}
              className="absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-mono font-bold whitespace-nowrap pointer-events-none"
              style={{
                background: 'rgba(8,8,12,0.9)',
                border: '1px solid rgba(0,240,255,0.2)',
                color: '#00f0ff',
                bottom: 'calc(100% + 8px)',
              }}
            >
              Clique · Segure p/ voz
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transcrição ao vivo */}
        <AnimatePresence>
          {isVoiceMode && voiceTranscript && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: -12, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="absolute right-full mr-3 top-0 w-64 px-3 py-2 rounded-lg z-[102]"
              style={{
                background: 'rgba(8,8,12,0.95)',
                border: '1px solid rgba(46,213,115,0.3)',
                boxShadow: '0 0 20px rgba(46,213,115,0.1)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Escutando...</span>
              </div>
              <p className="text-xs text-white/80 font-mono leading-snug">{voiceTranscript}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ghost mode label indicator */}
        <AnimatePresence>
          {isGhost && showGhostLabel && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.9 }}
              animate={{ opacity: 1, y: -10, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wider whitespace-nowrap pointer-events-none"
              style={{
                background: 'rgba(30,41,59,0.9)',
                border: '1px solid rgba(148,163,184,0.3)',
                color: '#94a3b8',
                bottom: 'calc(100% + 4px)',
              }}
            >
              👻 GHOST MODE — clique para materializar
            </motion.div>
          )}
        </AnimatePresence>

        {/* Badge Proativo */}
        {!isActive && proactiveBadge && proactiveBadge.count > 0 && (
          <button
            onClick={() => !isGhost && setActionCenterOpen(true)}
            className={`absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center px-1 rounded-full text-white text-[10px] font-bold shadow-lg animate-pulse hover:scale-110 transition-transform cursor-pointer z-[101] font-mono ${isGhost ? 'opacity-50' : ''}`}
            style={{
              background: isGhost
                ? 'linear-gradient(135deg, #475569 0%, #64748b 100%)'
                : 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)',
              boxShadow: isGhost
                ? '0 0 8px rgba(148,163,184,0.2)'
                : '0 0 10px rgba(255,71,87,0.5)',
            }}
          >
            {proactiveBadge.count > 9 ? '9+' : proactiveBadge.count}
          </button>
        )}

        {/* Ghost mode holographic notification */}
        <AnimatePresence>
          {isGhost && ghostNotification && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: -70, scale: 1 }}
              exit={{ opacity: 0, y: -90, scale: 0.9 }}
              transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
              className="absolute left-1/2 -translate-x-1/2 w-48 px-3 py-2 rounded-lg cursor-pointer z-[102]"
              style={{
                background: 'rgba(8,8,12,0.9)',
                border: '1px solid rgba(0,240,255,0.2)',
                boxShadow: '0 0 20px rgba(0,240,255,0.1), 0 4px 16px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(12px)',
              }}
              onClick={() => {
                toggleGhost()
                setActionCenterOpen(true)
                setGhostNotification(null)
              }}
            >
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-cyan-300 font-mono leading-snug">
                    {ghostNotification.text}
                  </p>
                  <p className="text-[9px] text-nexo-muted/50 font-mono mt-0.5">
                    Clique para materializar
                  </p>
                </div>
              </div>
              {/* Scan line decoration */}
              <div
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(0,240,255,0.4), transparent)',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Luna Action Center */}
      {actionCenterOpen && (
        <LunaActionCenter onClose={() => setActionCenterOpen(false)} />
      )}
    </>
  )
}
