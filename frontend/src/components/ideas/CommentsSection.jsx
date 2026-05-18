import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, MessageSquare, Loader2, Smile, AtSign,
  ThumbsUp, ThumbsDown, Flame, Heart, Lightbulb,
  X
} from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'

/**
 * CommentsSection - Lista de comentarios da ideia
 *
 * - Cada comentario: avatar, nome do autor, texto, timestamp, reacoes
 * - Input para novo comentario
 * - Botao de reacao (emoji picker simplificado)
 * - @mentions com highlight
 * - Integra com /api/ideas/:id/comments
 * - Integra com /api/ideas/:id/comments/:cid/reactions
 *
 * Props:
 *  ideaId {string} - ID da ideia
 *  comments {array} - Lista inicial de comentarios
 *  onUpdate {function} - Callback ao adicionar/remover comentario
 */

const EMOJI_REACTIONS = [
  { emoji: '👍', label: 'Gostei', icon: ThumbsUp },
  { emoji: '👎', label: 'Nao gostei', icon: ThumbsDown },
  { emoji: '🔥', label: 'Fogo', icon: Flame },
  { emoji: '❤️', label: 'Amor', icon: Heart },
  { emoji: '💡', label: 'Ideia', icon: Lightbulb },
]

// Available users for @mentions
const MENTION_USERS = [
  { id: 'nexo-abner-001', name: 'Abner' },
  { id: 'nexo-enoque-001', name: 'Nonoke' },
  { id: 'nexo-elias-pessoal', name: 'Elias' },
]

export default function CommentsSection({ ideaId, comments: initialComments = [], onUpdate }) {
  const { user: authUser } = useAuth()
  const [comments, setComments] = useState(initialComments)
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [activeReactionPicker, setActiveReactionPicker] = useState(null)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const inputRef = useRef(null)
  const messagesEndRef = useRef(null)

  // Sync external comments
  useEffect(() => {
    setComments(initialComments)
  }, [initialComments])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  // Close emoji picker on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (activeReactionPicker && !e.target.closest('.reaction-picker-container')) {
        setActiveReactionPicker(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeReactionPicker])

  const handleAddComment = async () => {
    if (!newComment.trim() || !ideaId || sending) return

    setSending(true)
    try {
      // Extract mentions
      const mentions = []
      MENTION_USERS.forEach(u => {
        if (newComment.includes(`@${u.name}`)) {
          mentions.push(u.id)
        }
      })

      const res = await axios.post(`/api/ideas/${ideaId}/comments`, {
        text: newComment.trim(),
        mentions: mentions.length > 0 ? mentions : undefined,
      })

      if (res.data.success) {
        const addedComment = res.data.data?.comment || res.data.data
        const updated = [...comments, addedComment]
        setComments(updated)
        setNewComment('')
        if (onUpdate) onUpdate(updated)
      }
    } catch (err) {
      console.error('[CommentsSection] addComment error:', err)
    } finally {
      setSending(false)
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!ideaId || !commentId) return
    if (!confirm('Remover este comentario?')) return

    try {
      await axios.delete(`/api/ideas/${ideaId}/comments/${commentId}`)
      const updated = comments.filter(c => c.id !== commentId)
      setComments(updated)
      if (onUpdate) onUpdate(updated)
    } catch (err) {
      console.error('[CommentsSection] deleteComment error:', err)
      alert('Erro ao remover comentario: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleToggleReaction = async (commentId, emoji) => {
    if (!ideaId || !commentId) return

    // Optimistic update
    const updatedComments = comments.map(c => {
      if (c.id !== commentId) return c

      const reactions = [...(c.reactions || [])]
      const existingIdx = reactions.findIndex(r => r.emoji === emoji)

      if (existingIdx >= 0) {
        // Toggle off logic (remove current user)
        const currentUserId = getCurrentUserId()
        const users = reactions[existingIdx].users || []
        if (users.includes(currentUserId)) {
          const newUsers = users.filter(u => u !== currentUserId)
          if (newUsers.length === 0) {
            reactions.splice(existingIdx, 1)
          } else {
            reactions[existingIdx] = { ...reactions[existingIdx], users: newUsers }
          }
        } else {
          reactions[existingIdx] = {
            ...reactions[existingIdx],
            users: [...users, currentUserId],
          }
        }
      } else {
        reactions.push({ emoji, users: [getCurrentUserId()] })
      }

      return { ...c, reactions }
    })

    setComments(updatedComments)
    setActiveReactionPicker(null)

    try {
      const res = await axios.post(`/api/ideas/${ideaId}/comments/${commentId}/reactions`, {
        emoji,
      })

      if (res.data.success) {
        // Sync with server state
        const finalComments = comments.map(c => {
          if (c.id !== commentId) return c
          return { ...c, reactions: res.data.data?.reactions || c.reactions }
        })
        setComments(finalComments)
        if (onUpdate) onUpdate(finalComments)
      }
    } catch (err) {
      console.error('[CommentsSection] toggleReaction error:', err)
      // Revert on error
      setComments(comments)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddComment()
    }
    if (e.key === '@' || (e.key === 'Backspace' && showMentions)) {
      checkMentions()
    }
  }

  const checkMentions = () => {
    const text = newComment
    const lastAtIndex = text.lastIndexOf('@')
    if (lastAtIndex >= 0) {
      const afterAt = text.slice(lastAtIndex + 1)
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt.toLowerCase())
        setShowMentions(true)
        return
      }
    }
    setShowMentions(false)
  }

  const insertMention = (user) => {
    const lastAtIndex = newComment.lastIndexOf('@')
    const before = newComment.slice(0, lastAtIndex)
    const after = newComment.slice(lastAtIndex + 1 + mentionQuery.length)
    setNewComment(`${before}@${user.name} ${after}`)
    setShowMentions(false)
    inputRef.current?.focus()
  }

  const filteredMentions = MENTION_USERS.filter(u =>
    u.name.toLowerCase().includes(mentionQuery)
  )

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'agora'
    if (diffMins < 60) return `${diffMins}min`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const getCurrentUserId = () => {
    return authUser?.id || authUser?.userId || 'unknown'
  }

  const isCurrentUser = (authorId) => {
    return authorId === getCurrentUserId()
  }

  // Highlight @mentions in text
  const renderCommentText = (text) => {
    if (!text) return null
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-nexo-primary font-semibold bg-nexo-primary/10 px-0.5 rounded">
            {part}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comments List */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {comments.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-nexo-muted/20 mx-auto mb-3" />
            <p className="text-sm text-nexo-muted">Nenhum comentario ainda.</p>
            <p className="text-xs text-nexo-muted/60 mt-1">Seja o primeiro a comentar!</p>
          </div>
        )}

        <AnimatePresence>
          {comments.map((comment) => {
            const reactions = comment.reactions || []
            const hasReactions = reactions.length > 0
            const currentUserId = getCurrentUserId()

            return (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="glass-card p-3 border border-nexo-border/50 group"
              >
                {/* Comment header */}
                <div className="flex items-start gap-2.5">
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-nexo-primary/20 flex items-center justify-center text-[10px] text-nexo-primary font-bold flex-shrink-0 mt-0.5">
                    {(comment.authorName || comment.author || 'U').charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-nexo-text">
                        {comment.authorName || comment.author || 'Usuario'}
                      </span>
                      <span className="text-[10px] text-nexo-muted">
                        {formatDate(comment.timestamp || comment.createdAt)}
                      </span>
                      {isCurrentUser(comment.author) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:bg-nexo-danger/10 rounded transition-all"
                          title="Remover"
                        >
                          <X className="w-3 h-3 text-nexo-danger" />
                        </button>
                      )}
                    </div>

                    {/* Text */}
                    <p className="text-sm text-nexo-text leading-relaxed break-words">
                      {renderCommentText(comment.text)}
                    </p>

                    {/* Mentions badge */}
                    {comment.mentions && comment.mentions.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <AtSign className="w-3 h-3 text-nexo-info" />
                        <span className="text-[10px] text-nexo-info">
                          {comment.mentions.map(m => {
                            const user = MENTION_USERS.find(u => u.id === m)
                            return user ? `@${user.name}` : m
                          }).join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Reactions */}
                    <div className="flex items-center gap-1 mt-2">
                      {/* Existing reactions */}
                      {hasReactions && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {reactions.map((reaction) => {
                            const userReacted = reaction.users?.includes(currentUserId)
                            return (
                              <button
                                key={reaction.emoji}
                                onClick={() => handleToggleReaction(comment.id, reaction.emoji)}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                                  userReacted
                                    ? 'bg-nexo-primary/15 border-nexo-primary/30 text-nexo-primary'
                                    : 'bg-nexo-bg border-nexo-border text-nexo-muted hover:border-nexo-muted'
                                }`}
                                title={reaction.users?.length > 0 ? `${reaction.users.length} reacao(oes)` : ''}
                              >
                                <span>{reaction.emoji}</span>
                                {reaction.users && reaction.users.length > 1 && (
                                  <span className="text-[9px]">{reaction.users.length}</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Add reaction button */}
                      <div className="relative reaction-picker-container">
                        <button
                          onClick={() => setActiveReactionPicker(
                            activeReactionPicker === comment.id ? null : comment.id
                          )}
                          className={`p-1 rounded-full transition-colors ${
                            activeReactionPicker === comment.id
                              ? 'bg-nexo-primary/20 text-nexo-primary'
                              : 'text-nexo-muted hover:text-nexo-text hover:bg-nexo-bg opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>

                        {/* Emoji picker popover */}
                        <AnimatePresence>
                          {activeReactionPicker === comment.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: 4 }}
                              transition={{ duration: 0.1 }}
                              className="absolute z-[9990] bottom-full left-0 mb-1 flex items-center gap-0.5 p-1.5 bg-nexo-card border border-nexo-border rounded-xl shadow-xl shadow-black/20"
                            >
                              {EMOJI_REACTIONS.map((reaction) => {
                                const Icon = reaction.icon
                                return (
                                  <button
                                    key={reaction.emoji}
                                    onClick={() => handleToggleReaction(comment.id, reaction.emoji)}
                                    title={reaction.label}
                                    className="p-1.5 hover:bg-nexo-bg rounded-lg transition-colors flex items-center justify-center"
                                  >
                                    <span className="text-base" role="img" aria-label={reaction.label}>
                                      {reaction.emoji}
                                    </span>
                                  </button>
                                )
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Add comment input */}
      <div className="mt-3 pt-3 border-t border-nexo-border">
        <div className="relative">
          <div className="flex items-end gap-2">
            {/* User avatar */}
            <div className="w-7 h-7 rounded-full bg-nexo-primary/20 flex items-center justify-center text-[10px] text-nexo-primary font-bold flex-shrink-0 mb-0.5">
              U
            </div>

            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={newComment}
                onChange={e => {
                  setNewComment(e.target.value)
                  if (showMentions) checkMentions()
                }}
                onKeyDown={handleKeyDown}
                placeholder="Adicionar comentario... Use @ para mencionar"
                rows={2}
                className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-xs text-nexo-text placeholder:text-nexo-muted/40 resize-none transition-colors"
              />

              {/* Mention dropdown */}
              <AnimatePresence>
                {showMentions && filteredMentions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute bottom-full left-0 mb-1 w-48 bg-nexo-card border border-nexo-border rounded-xl shadow-xl overflow-hidden z-[9990]"
                  >
                    {filteredMentions.map(user => (
                      <button
                        key={user.id}
                        onClick={() => insertMention(user)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-nexo-bg transition-colors"
                      >
                        <div className="w-6 h-6 rounded-full bg-nexo-primary/20 flex items-center justify-center text-[10px] text-nexo-primary font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <span className="text-xs text-nexo-text">{user.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Send button */}
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || sending}
              className="p-2 bg-nexo-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30 flex-shrink-0 mb-0.5"
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Hint */}
          <div className="flex items-center justify-between mt-1.5 pl-9">
            <p className="text-[9px] text-nexo-muted">
              Enter para enviar, Shift+Enter para nova linha
            </p>
            <p className="text-[9px] text-nexo-muted">
              @ para mencionar
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
