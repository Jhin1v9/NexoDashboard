import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Send, Bot, User, Users, CheckCircle,
  ChevronDown, Eraser, Loader, X, Sparkles
} from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'

const LUNA_AVATAR = '/luna-avatar.png'

function getUserColor(name) {
  const map = { abner: '#3742fa', nonoke: '#2ed573', elias: '#ffa502', luna: '#9b59b6' }
  return map[name?.toLowerCase()] || '#3742fa'
}

export default function LunaChatPanel({ isOpen, onClose }) {
  const { user: authUser } = useAuth()
  const [activeUser, setActiveUser] = useState(authUser?.name || 'Abner')
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState('group')
  const [threadMessages, setThreadMessages] = useState({})
  const [isLoadingThread, setIsLoadingThread] = useState(false)
  const [showThreadDropdown, setShowThreadDropdown] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState(null)

  const chatEndRef = useRef(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Update active user when auth changes
  useEffect(() => {
    if (authUser?.name) setActiveUser(authUser.name)
  }, [authUser])

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [threadMessages, activeThreadId])

  // Load threads on mount
  useEffect(() => {
    fetchThreads()
  }, [])

  // Load messages when thread changes
  useEffect(() => {
    if (activeThreadId) fetchThreadMessages(activeThreadId)
  }, [activeThreadId])

  // WebSocket for real-time messages
  useEffect(() => {
    let ws
    let reconnectTimer
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      ws.onopen = () => console.log('[LunaChatPanel] WS connected')
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'luna:chat:message' && data.threadId && data.message) {
            const { threadId, message } = data
            setThreadMessages(prev => {
              const msgs = prev[threadId] || []
              if (msgs.some(m => m.id === message.id)) return prev
              return { ...prev, [threadId]: [...msgs, message] }
            })
          }
        } catch (e) { /* ignore non-JSON */ }
      }
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000) }
    }
    connect()
    return () => {
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowThreadDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close panel on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const fetchThreads = useCallback(async () => {
    try {
      const res = await axios.get('/api/luna/threads')
      if (res.data.success) setThreads(res.data.threads || [])
    } catch (e) {
      console.error('[LunaChatPanel] Erro ao buscar threads:', e.message)
    }
  }, [])

  const fetchThreadMessages = useCallback(async (threadId) => {
    setIsLoadingThread(true)
    try {
      const res = await axios.get(`/api/luna/threads/${threadId}/messages`)
      if (res.data.success) {
        setThreadMessages(prev => ({ ...prev, [threadId]: res.data.messages || [] }))
      }
    } catch (e) {
      console.error('[LunaChatPanel] Erro ao buscar mensagens:', e.message)
    } finally {
      setIsLoadingThread(false)
    }
  }, [])

  const getActiveThread = () => threads.find(t => t.id === activeThreadId)

  const getThreadDisplayTitle = () => {
    const t = getActiveThread()
    if (t) return t.title
    return activeThreadId === 'group' ? 'NEXO + Luna (grupo)' : 'Chat'
  }

  const clearThreadMessages = async () => {
    try {
      await axios.delete(`/api/luna/threads/${activeThreadId}/messages`)
      setThreadMessages(prev => ({ ...prev, [activeThreadId]: [] }))
    } catch (e) {
      console.error('[LunaChatPanel] Erro ao limpar mensagens:', e.message)
    }
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return
    const text = chatInput.trim()
    setChatInput('')
    setChatLoading(true)

    const tempId = 'temp_' + Date.now()
    const optimisticUserMsg = {
      id: tempId,
      role: 'user',
      author: activeUser.toLowerCase(),
      authorName: activeUser,
      authorColor: getUserColor(activeUser),
      text,
      timestamp: new Date().toISOString()
    }
    setThreadMessages(prev => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), optimisticUserMsg]
    }))

    try {
      // Commands starting with /
      if (text.startsWith('/')) {
        const cmd = text.slice(1).split(' ')[0]
        const res = await axios.post('/api/luna/command', { command: cmd, params: {} })
        let cmdText = ''
        if (res.data.success) {
          const result = res.data.result || {}
          if (cmd === 'status') {
            cmdText = `📊 Status da Luna\n\nVersão: ${result.version || '—'}\nÚltimo scan: ${result.lastScan ? new Date(result.lastScan).toLocaleString('pt-BR') : 'Nunca'}\nMensagens no histórico: ${result.historyTotal || 0}\nMsgs no buffer: ${result.bufferMessages || 0}\nTarefas no buffer: ${result.bufferTasks || 0}\nIdeias no buffer: ${result.bufferIdeas || 0}`
          } else {
            cmdText = result.message || JSON.stringify(result, null, 2)
          }
        } else {
          cmdText = res.data.error || 'Erro ao executar comando.'
        }
        const cmdMsg = {
          id: 'cmd_' + Date.now(),
          role: 'assistant',
          author: 'luna',
          authorName: 'Luna',
          authorColor: '#9b59b6',
          text: cmdText,
          timestamp: new Date().toISOString()
        }
        setThreadMessages(prev => ({
          ...prev,
          [activeThreadId]: [...(prev[activeThreadId] || []), cmdMsg]
        }))
        setChatLoading(false)
        return
      }

      // Regular chat message
      const res = await axios.post(`/api/luna/threads/${activeThreadId}/messages`, {
        text,
        authorName: activeUser
      })
      const data = res.data

      if (data.success && data.messages) {
        setThreadMessages(prev => ({
          ...prev,
          [activeThreadId]: [...(prev[activeThreadId] || []), ...data.messages]
        }))
        if (data.pendingActions) {
          setPendingConfirmation({ actions: data.pendingActions, messageId: data.messages[0]?.id })
        }
      } else {
        const errorMsg = {
          id: 'err_' + Date.now(),
          role: 'assistant',
          author: 'luna',
          authorName: 'Luna',
          authorColor: '#9b59b6',
          text: data.error || 'Desculpe, não consegui processar sua mensagem.',
          timestamp: new Date().toISOString()
        }
        setThreadMessages(prev => ({
          ...prev,
          [activeThreadId]: [...(prev[activeThreadId] || []), errorMsg]
        }))
      }
    } catch (e) {
      console.error('[LunaChatPanel] Erro ao enviar mensagem:', e.message)
      const errorMsg = {
        id: 'err_' + Date.now(),
        role: 'assistant',
        author: 'luna',
        authorName: 'Luna',
        authorColor: '#9b59b6',
        text: 'Ops! Algo deu errado. Tente novamente em instantes.',
        timestamp: new Date().toISOString()
      }
      setThreadMessages(prev => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), errorMsg]
      }))
    } finally {
      setChatLoading(false)
    }
  }

  const confirmPendingActions = async (confirm) => {
    if (!confirm) {
      setPendingConfirmation(null)
      const cancelMsg = {
        id: 'cancel_' + Date.now(),
        role: 'assistant',
        author: 'luna',
        authorName: 'Luna',
        authorColor: '#9b59b6',
        text: 'Beleza, cancelado 👍',
        timestamp: new Date().toISOString()
      }
      setThreadMessages(prev => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), cancelMsg]
      }))
      return
    }
    if (!pendingConfirmation) return
    setChatLoading(true)
    try {
      const res = await axios.post(`/api/luna/threads/${activeThreadId}/messages`, {
        text: 'sim',
        authorName: activeUser,
        confirmActions: true,
        pendingActions: pendingConfirmation.actions
      })
      const data = res.data
      if (data.success && data.messages) {
        setThreadMessages(prev => ({
          ...prev,
          [activeThreadId]: [...(prev[activeThreadId] || []), ...data.messages]
        }))
      }
      setPendingConfirmation(null)
    } catch (e) {
      console.error('[LunaChatPanel] Erro ao confirmar ações:', e.message)
    } finally {
      setChatLoading(false)
    }
  }

  const currentMessages = threadMessages[activeThreadId] || []
  const isGroup = activeThreadId === 'group'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9980]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] bg-nexo-bg border-l border-nexo-border shadow-2xl z-[9981] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-nexo-border bg-nexo-card/50">
              <div className="flex items-center gap-3">
                {/* Luna Avatar */}
                <div className="relative">
                  <img
                    src={LUNA_AVATAR}
                    alt="Luna"
                    className="w-10 h-10 rounded-full object-cover border-2 border-nexo-primary/30"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 items-center justify-center hidden absolute inset-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-nexo-success rounded-full border-2 border-nexo-bg" />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-nexo-text">Luna</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-nexo-info/10 text-nexo-info border border-nexo-info/20">
                      <Sparkles className="w-2.5 h-2.5" /> Gemini
                    </span>
                  </div>

                  {/* Thread Selector */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowThreadDropdown(!showThreadDropdown)}
                      className="flex items-center gap-1 text-xs text-nexo-muted hover:text-nexo-primary transition-colors"
                    >
                      {getThreadDisplayTitle()}
                      <ChevronDown size={12} className={`transition-transform ${showThreadDropdown ? 'rotate-180' : ''}`} />
                      {activeThreadId === 'group' && <Users size={12} />}
                    </button>

                    <AnimatePresence>
                      {showThreadDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full left-0 mt-1 w-56 bg-nexo-card border border-nexo-border rounded-lg shadow-xl z-[9990] py-1"
                        >
                          {threads.map(t => (
                            <button
                              key={t.id}
                              onClick={() => { setActiveThreadId(t.id); setShowThreadDropdown(false) }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-nexo-bg transition-colors ${
                                t.id === activeThreadId ? 'bg-nexo-bg/50 text-nexo-primary' : 'text-nexo-text'
                              }`}
                            >
                              {t.type === 'group' ? (
                                <Users className="w-4 h-4 text-nexo-muted flex-shrink-0" />
                              ) : (
                                <User className="w-4 h-4 text-nexo-muted flex-shrink-0" />
                              )}
                              <span className="flex-1 truncate">{t.title}</span>
                              {t.id === activeThreadId && <CheckCircle className="w-3 h-3 text-nexo-success flex-shrink-0" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={clearThreadMessages}
                  className="p-2 text-nexo-muted hover:text-nexo-text hover:bg-nexo-card rounded-lg transition-colors"
                  title="Limpar conversa"
                >
                  <Eraser className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-nexo-muted hover:text-nexo-text hover:bg-nexo-card rounded-lg transition-colors"
                  title="Fechar (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-nexo-muted">
                  <div className="relative mb-4">
                    <img
                      src={LUNA_AVATAR}
                      alt="Luna"
                      className="w-16 h-16 rounded-full object-cover border-2 border-nexo-primary/20 opacity-50"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  </div>
                  <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
                  <p className="text-xs mt-1 max-w-[250px] text-center">
                    {isGroup
                      ? 'Chat em grupo com a Luna. Todos os CEOs veem as mensagens.'
                      : 'Chat privado com a Luna. Somente você vê estas mensagens.'}
                  </p>
                </div>
              )}

              {currentMessages.map((msg, i) => {
                const isUser = msg.role === 'user'
                const showAuthor = isGroup && isUser && msg.authorName
                const authorColor = msg.authorColor || getUserColor(msg.author)
                return (
                  <div key={msg.id || i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] text-white font-bold overflow-hidden"
                      style={{ backgroundColor: isUser ? authorColor : 'transparent' }}
                    >
                      {isUser ? (
                        msg.authorName?.charAt(0) || 'U'
                      ) : (
                        <img
                          src={LUNA_AVATAR}
                          alt="Luna"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.parentNode.style.backgroundColor = '#9b59b6'
                            e.target.parentNode.innerHTML = '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"w-4 h-4 text-white\"><path d=\"M12 8V4H8\"/><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\"/><path d=\"M2 14h2\"/><path d=\"M20 14h2\"/><path d=\"M15 13v2\"/><path d=\"M9 13v2\"/></svg>'
                          }}
                        />
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-nexo-primary text-white rounded-tr-sm'
                        : 'bg-nexo-card text-nexo-text border border-nexo-border/50 rounded-tl-sm'
                    }`}>
                      {showAuthor && (
                        <p className="text-[10px] font-semibold mb-0.5" style={{ color: authorColor }}>
                          {msg.authorName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.text}</p>

                      {/* Confirmation buttons */}
                      {msg.needsConfirmation && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => confirmPendingActions(true)}
                            className="px-3 py-1.5 bg-nexo-success text-white text-xs rounded-lg hover:bg-nexo-success/80 transition-colors font-medium"
                          >
                            ✅ Confirmar
                          </button>
                          <button
                            onClick={() => confirmPendingActions(false)}
                            className="px-3 py-1.5 bg-nexo-border text-nexo-text text-xs rounded-lg hover:bg-nexo-card transition-colors font-medium"
                          >
                            ❌ Cancelar
                          </button>
                        </div>
                      )}

                      {/* Executed confirmation */}
                      {!msg.needsConfirmation && msg.executed && (
                        <div className="mt-2 px-3 py-1.5 bg-nexo-success/10 border border-nexo-success/20 rounded-lg text-xs text-nexo-success flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Ação executada com sucesso!
                        </div>
                      )}

                      {/* Timestamp */}
                      <span className={`text-[10px] mt-1.5 block ${isUser ? 'text-white/60' : 'text-nexo-muted'}`}>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        {msg.fallback && <span className="ml-2 text-yellow-400">⚡ modo rápido</span>}
                        {msg.executed && <span className="ml-2 text-green-400">✅ executado</span>}
                        {msg.quotaExhausted && (
                          <span className="ml-2 text-orange-400">⏸️ quota esgotada</span>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}

              {/* Loading indicator */}
              {chatLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-nexo-primary/20">
                    <img
                      src={LUNA_AVATAR}
                      alt="Luna"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  </div>
                  <div className="bg-nexo-card border border-nexo-border/50 px-4 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-2">
                    <Loader className="w-4 h-4 text-nexo-primary animate-spin" />
                    <span className="text-xs text-nexo-muted">Luna está pensando...</span>
                  </div>
                </div>
              )}

              {/* Thread loading */}
              {isLoadingThread && !chatLoading && (
                <div className="flex justify-center py-4">
                  <Loader className="w-5 h-5 text-nexo-primary animate-spin" />
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-nexo-border bg-nexo-card/30">
              <div className="flex items-center gap-2 bg-nexo-bg rounded-xl px-4 py-2.5 border border-nexo-border focus-within:border-nexo-primary/50 transition-colors">
                <MessageCircle className="w-4 h-4 text-nexo-muted flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                  placeholder={`Mensagem em ${getThreadDisplayTitle()}...`}
                  className="flex-1 bg-transparent text-sm text-nexo-text placeholder-nexo-muted outline-none"
                  disabled={chatLoading}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-2 bg-nexo-primary rounded-lg text-white hover:bg-nexo-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-nexo-muted/60 mt-1.5 text-center">
                Pressione <kbd className="px-1 py-0.5 bg-nexo-card rounded text-[10px] border border-nexo-border">Enter</kbd> para enviar · <kbd className="px-1 py-0.5 bg-nexo-card rounded text-[10px] border border-nexo-border">Esc</kbd> para fechar
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
