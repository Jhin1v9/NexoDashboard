/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaMessageReactions — Constellation Reactions
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Sistema de reações em constelação para chat em grupo.
 * Não é um emoji picker. São orbes flutuantes em trajetória orbital.
 *
 * Comportamento:
 *   • Hover em mensagem de outro usuário → 5 orbes surgem em arco
 *   • Cada orb tem glow sutil e animação stagger
 *   • Clique → partículas explodem, reação é persistida
 *   • Badges persistidos abaixo da mensagem com contador
 *   • Badge do próprio usuário tem glow cyan
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '👀', '🚀']

const ORB_POSITIONS = [
  { x: -60, y: -20 },
  { x: -30, y: -35 },
  { x: 0, y: -40 },
  { x: 30, y: -35 },
  { x: 60, y: -20 },
]

function ParticleExplosion({ x, y, emoji, onDone }) {
  const particles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    angle: (i / 8) * Math.PI * 2,
    distance: 20 + Math.random() * 20,
  }))

  return (
    <div className="absolute pointer-events-none" style={{ left: x, top: y }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,240,255,0.8) 0%, transparent 70%)',
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          onAnimationComplete={() => { if (p.id === 0) onDone() }}
        />
      ))}
      <motion.span
        className="absolute text-lg"
        initial={{ scale: 1.5, opacity: 1 }}
        animate={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        {emoji}
      </motion.span>
    </div>
  )
}

export default function LunaMessageReactions({
  message,
  threadId,
  currentUser,
  isGroup,
  isOwnMessage,
}) {
  const [hovered, setHovered] = useState(false)
  const [explosion, setExplosion] = useState(null)
  const [reactions, setReactions] = useState(message.reactions || [])

  // Sync with message prop
  const effectiveReactions = message.reactions || reactions

  const handleReact = useCallback(async (emoji, event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setExplosion({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      emoji,
    })

    // Optimistic update
    const userId = currentUser?.toLowerCase() || 'anonymous'
    const existing = effectiveReactions.find(r => r.emoji === emoji)
    let newReactions

    if (existing?.users?.includes(userId)) {
      // Remove reaction
      newReactions = effectiveReactions.map(r => {
        if (r.emoji === emoji) {
          return { ...r, users: r.users.filter(u => u !== userId) }
        }
        return r
      }).filter(r => r.users.length > 0)
    } else {
      // Add reaction
      newReactions = effectiveReactions.map(r => {
        if (r.emoji === emoji) {
          return { ...r, users: [...r.users, userId] }
        }
        return r
      })
      if (!existing) {
        newReactions = [...newReactions, { emoji, users: [userId] }]
      }
    }

    setReactions(newReactions)
    setHovered(false)

    // Persist
    try {
      await axios.post(`/api/luna/threads/${threadId}/messages/${message.id}/react`, { emoji })
    } catch (e) {
      console.error('[LunaMessageReactions] Erro ao reagir:', e.message)
    }
  }, [effectiveReactions, currentUser, threadId, message.id])

  const clearExplosion = useCallback(() => setExplosion(null), [])

  // Don't show reaction UI for own messages or non-group
  const canReact = isGroup && !isOwnMessage

  return (
    <div
      className="relative"
      onMouseEnter={() => canReact && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Constellation orbs on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 z-20 flex items-center justify-center"
            style={{ bottom: 'calc(100% + 8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {REACTION_EMOJIS.map((emoji, i) => (
              <motion.button
                key={emoji}
                className="absolute w-8 h-8 rounded-full flex items-center justify-center text-base cursor-pointer"
                style={{
                  background: 'rgba(15,15,22,0.95)',
                  border: '1px solid rgba(0,240,255,0.2)',
                  boxShadow: '0 0 12px rgba(0,240,255,0.1)',
                }}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 0,
                  scale: 0,
                }}
                animate={{
                  x: ORB_POSITIONS[i].x,
                  y: ORB_POSITIONS[i].y,
                  opacity: 1,
                  scale: 1,
                }}
                exit={{
                  x: 0,
                  y: 0,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{
                  duration: 0.25,
                  delay: i * 0.03,
                  type: 'spring',
                  stiffness: 300,
                  damping: 20,
                }}
                whileHover={{
                  scale: 1.3,
                  boxShadow: '0 0 20px rgba(0,240,255,0.3)',
                }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => handleReact(emoji, e)}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persisted reaction badges */}
      {effectiveReactions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {effectiveReactions.map((reaction) => {
            const userId = currentUser?.toLowerCase() || 'anonymous'
            const isMine = reaction.users?.includes(userId)
            return (
              <motion.button
                key={reaction.emoji}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all cursor-pointer"
                style={{
                  background: isMine
                    ? 'rgba(0,240,255,0.1)'
                    : 'rgba(255,255,255,0.03)',
                  border: isMine
                    ? '1px solid rgba(0,240,255,0.25)'
                    : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: isMine
                    ? '0 0 8px rgba(0,240,255,0.1)'
                    : 'none',
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => isMine && handleReact(reaction.emoji, { currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) } })}
              >
                <span>{reaction.emoji}</span>
                <span className={`font-mono text-[10px] ${isMine ? 'text-cyan-400' : 'text-nexo-muted/60'}`}>
                  {reaction.users?.length || 0}
                </span>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Particle explosion effect */}
      <AnimatePresence>
        {explosion && (
          <ParticleExplosion
            x={explosion.x}
            y={explosion.y}
            emoji={explosion.emoji}
            onDone={clearExplosion}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
