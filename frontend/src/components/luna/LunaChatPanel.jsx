import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Send, Bot, User, Users, CheckCircle,
  ChevronDown, Eraser, Loader, X, Sparkles, Activity,
  Volume2, VolumeX
} from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'
import { useLunaContext } from '../../hooks/useLunaContext'
import EditablePreviewCard from './EditablePreviewCard'
import LunaInlinePreview from './LunaInlinePreview'
import LunaMarkdown from './LunaMarkdown'
import LunaMessageReactions from './LunaMessageReactions'
import LunaVoiceInput from './LunaVoiceInput'
import useLunaVoice from '../../hooks/useLunaVoice'
import SmartFormModal from './SmartFormModal'

const LUNA_AVATAR = '/luna-avatar.png'

function getUserColor(name) {
  const map = { abner: '#3742fa', nonoke: '#2ed573', elias: '#ffa502', luna: '#9b59b6' }
  return map[name?.toLowerCase()] || '#3742fa'
}

/* ── HUD Visual Effects ── */
function ScanLines() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-none opacity-[0.03]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,240,255,0.1) 2px, rgba(0,240,255,0.1) 4px)',
          backgroundSize: '100% 4px',
        }}
      />
    </div>
  )
}

function CornerAccents() {
  return (
    <>
      {/* Top-left */}
      <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-500/40 rounded-tl-sm" />
      {/* Top-right */}
      <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-500/40 rounded-tr-sm" />
      {/* Bottom-left */}
      <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-500/40 rounded-bl-sm" />
      {/* Bottom-right */}
      <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-500/40 rounded-br-sm" />
    </>
  )
}

function HUDGlowBorder({ children }) {
  return (
    <div className="relative">
      <div className="absolute -inset-[1px] bg-gradient-to-b from-cyan-500/20 via-transparent to-purple-500/20 rounded-none blur-[1px]" />
      <div className="relative">{children}</div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-cyan-400/70"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

/* ── Typing Animation Hook ── */
function useTypingEffect(text, speed = 15) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(true); return }
    indexRef.current = 0
    setDisplayed('')
    setDone(false)
    const interval = setInterval(() => {
      indexRef.current++
      if (indexRef.current >= text.length) {
        setDisplayed(text)
        setDone(true)
        clearInterval(interval)
      } else {
        setDisplayed(text.slice(0, indexRef.current))
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed])

  return { displayed, done }
}

export default function LunaChatPanel({ isOpen, onClose }) {
  const { user: authUser } = useAuth()
  const { currentRoute, currentModule, visibleData, userFocus } = useLunaContext()
  const [activeUser, setActiveUser] = useState(authUser?.name || 'Abner')
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState('group')
  const [threadMessages, setThreadMessages] = useState({})
  const [isLoadingThread, setIsLoadingThread] = useState(false)
  const [showThreadDropdown, setShowThreadDropdown] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState(null)
  const [typingMsgId, setTypingMsgId] = useState(null)
  const [dashboardState, setDashboardState] = useState(null)
  const [ghostMode, setGhostMode] = useState(false)
  const [smartForm, setSmartForm] = useState(null)

  // Voice settings
  const { ttsEnabled, isSpeaking, speak, stopSpeaking, toggleTts } = useLunaVoice()

  // Fetch dashboard state periodically
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await axios.get('/api/luna/dashboard-state')
        if (res.data.success) setDashboardState(res.data.summary)
      } catch (e) {}
    }
    fetchState()
    const interval = setInterval(fetchState, 30000)
    return () => clearInterval(interval)
  }, [])

  // Ghost mode sync
  useEffect(() => {
    const syncGhost = () => {
      setGhostMode(localStorage.getItem('luna_ghost_mode') === 'true')
    }
    syncGhost()
    window.addEventListener('storage', syncGhost)
    const interval = setInterval(syncGhost, 500)
    return () => {
      window.removeEventListener('storage', syncGhost)
      clearInterval(interval)
    }
  }, [])

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
  }, [threadMessages, activeThreadId, typingMsgId])

  // Load threads on mount
  useEffect(() => {
    fetchThreads()
  }, [])

  // Load messages when thread changes
  useEffect(() => {
    if (activeThreadId) fetchThreadMessages(activeThreadId)
  }, [activeThreadId])

  // WebSocket for real-time messages & reactions
  useEffect(() => {
    let ws
    let reconnectTimer
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.port === '3457' ? 'localhost:3456' : window.location.host
      const wsUrl = `${protocol}//${host}/ws`
      ws = new WebSocket(wsUrl)
      ws.onopen = () => console.log('[LunaChatPanel] WS connected:', wsUrl)
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
          if (data.type === 'luna:chat:reaction' && data.threadId && data.messageId) {
            const { threadId, messageId, reactions } = data
            setThreadMessages(prev => {
              const msgs = prev[threadId] || []
              return {
                ...prev,
                [threadId]: msgs.map(m => m.id === messageId ? { ...m, reactions } : m)
              }
            })
          }
        } catch (e) { /* ignore non-JSON */ }
      }
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000) }
      ws.onerror = (err) => { console.error('[LunaChatPanel] WS error:', err) }
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
        speak(cmdText)
        setChatLoading(false)
        return
      }

      // Build dashboard context
      const dashboardContext = {
        currentRoute,
        currentModule,
        userFocus,
        dashboardState,
        visibleDataSnapshot: Object.keys(visibleData).reduce((acc, key) => {
          const data = visibleData[key]
          acc[key] = Array.isArray(data) ? { count: data.length } : typeof data === 'object' ? { keys: Object.keys(data) } : data
          return acc
        }, {})
      }

      // Regular chat message with context
      const res = await axios.post(`/api/luna/threads/${activeThreadId}/messages`, {
        text,
        authorName: activeUser,
        dashboardContext
      })
      const data = res.data

      if (data.success && data.messages) {
        // ── Navegação especial para intents de email ──
        const emailAction = data.actions?.find(a => a.type === 'enviar_email' || a.type === 'responder_email' || a.type === 'consultar_emails')
        if (emailAction || data.intent === 'enviar_email' || data.intent === 'responder_email' || data.intent === 'consultar_emails') {
          const params = new URLSearchParams()
          if (data.intent === 'enviar_email' || emailAction?.type === 'enviar_email') {
            params.append('compose', '1')
            const p = emailAction?.params || {}
            if (p.destinatario) params.append('to', p.destinatario)
            if (p.assunto) params.append('subject', p.assunto)
            if (p.contexto) params.append('body', p.contexto)
          }
          window.location.href = `/email${params.toString() ? '?' + params.toString() : ''}`
          return
        }

        setThreadMessages(prev => ({
          ...prev,
          [activeThreadId]: [...(prev[activeThreadId] || []), ...data.messages]
        }))
        if (data.pendingActions) {
          setPendingConfirmation({ actions: data.pendingActions, messageId: data.messages[0]?.id })
        }
        // Trigger typing animation + TTS for Luna's last message
        const lastMsg = data.messages[data.messages.length - 1]
        if (lastMsg?.role === 'assistant') {
          setTypingMsgId(lastMsg.id)
          setTimeout(() => setTypingMsgId(null), 1500)
          speak(lastMsg.text)
        }
      } else if (data.success && data.smartForm) {
        // 🎯 SMART FORM: abre modal para coletar dados faltantes
        setSmartForm(data.smartForm)
        // Adiciona a mensagem da Luna no chat
        const lunaMsg = {
          id: 'smartform_' + Date.now(),
          role: 'assistant',
          author: 'luna',
          authorName: 'Luna',
          authorColor: '#9b59b6',
          text: data.reply || 'Preciso de mais alguns dados para isso. Preenche aqui embaixo 👇',
          timestamp: new Date().toISOString()
        }
        setThreadMessages(prev => ({
          ...prev,
          [activeThreadId]: [...(prev[activeThreadId] || []), lunaMsg]
        }))
        speak(lunaMsg.text)
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
        speak(errorMsg.text)
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
      speak(errorMsg.text)
    } finally {
      setChatLoading(false)
    }
  }

  /* ── Smart Form Handlers ── */
  const handleSmartFormSubmit = async ({ actionType, params }) => {
    setChatLoading(true)
    try {
      const res = await axios.post('/api/luna/execute-action', {
        actionType,
        params,
        context: { authorName: activeUser }
      })
      const data = res.data
      if (data.success) {
        // Verifica se a ação teve erro interno (mesmo com HTTP 200)
        const hadErrors = data.result?.errorCount > 0 || data.result?.successCount === 0
        const msgText = hadErrors
          ? (data.reply || 'Não consegui completar a ação. Tenta de novo?')
          : (data.reply || 'Pronto! Ação executada com sucesso ✅')
        const msg = {
          id: 'sf_' + (hadErrors ? 'err_' : 'ok_') + Date.now(),
          role: 'assistant',
          author: 'luna',
          authorName: 'Luna',
          authorColor: '#9b59b6',
          text: msgText,
          timestamp: new Date().toISOString()
        }
        setThreadMessages(prev => ({
          ...prev,
          [activeThreadId]: [...(prev[activeThreadId] || []), msg]
        }))
        speak(msgText)
      } else {
        const errorMsg = {
          id: 'sf_err_' + Date.now(),
          role: 'assistant',
          author: 'luna',
          authorName: 'Luna',
          authorColor: '#9b59b6',
          text: data.error || 'Não consegui completar a ação. Tenta de novo?',
          timestamp: new Date().toISOString()
        }
        setThreadMessages(prev => ({
          ...prev,
          [activeThreadId]: [...(prev[activeThreadId] || []), errorMsg]
        }))
      }
    } catch (e) {
      console.error('[LunaChatPanel] Erro no SmartForm:', e.message)
      const errorMsg = {
        id: 'sf_exc_' + Date.now(),
        role: 'assistant',
        author: 'luna',
        authorName: 'Luna',
        authorColor: '#9b59b6',
        text: 'Ops, deu um erro técnico aqui. Pode tentar de novo?',
        timestamp: new Date().toISOString()
      }
      setThreadMessages(prev => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), errorMsg]
      }))
    } finally {
      setChatLoading(false)
      setSmartForm(null)
    }
  }

  const handleSmartFormCancel = () => {
    setSmartForm(null)
    const cancelMsg = {
      id: 'sf_cancel_' + Date.now(),
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
  }

  const confirmPendingActions = async (confirm, editedFields = null) => {
    if (!confirm) {
      setPendingConfirmation(null)
      const cancelMsg = {
        id: 'cancel_' + Date.now(),
        role: 'assistant',
        author: 'luna',
        authorName: 'Luna',
        authorColor: '#9b59b6',
        text: 'Entendido, não vou executar. Me conta o que você queria fazer — posso ter entendido errado? 🤔',
        timestamp: new Date().toISOString()
      }
      setThreadMessages(prev => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), cancelMsg]
      }))
      speak(cancelMsg.text)
      return
    }
    if (!pendingConfirmation) return
    setChatLoading(true)
    try {
      const payload = {
        text: 'sim',
        authorName: activeUser,
        confirmActions: true,
        pendingActions: pendingConfirmation.actions
      }
      if (editedFields) {
        payload.editedFields = editedFields
      }
      const res = await axios.post(`/api/luna/threads/${activeThreadId}/messages`, payload)
      const data = res.data
      if (data.success && data.messages) {
        setThreadMessages(prev => ({
          ...prev,
          [activeThreadId]: [...(prev[activeThreadId] || []), ...data.messages]
        }))
        const lastMsg = data.messages[data.messages.length - 1]
        if (lastMsg?.role === 'assistant') {
          speak(lastMsg.text)
        }
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
            className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] z-[9981] flex flex-col"
            style={{
              background: 'linear-gradient(180deg, rgba(8,8,12,0.98) 0%, rgba(15,15,22,0.96) 100%)',
              borderLeft: '1px solid rgba(0,240,255,0.15)',
              boxShadow: '-8px 0 40px rgba(0,240,255,0.05), -2px 0 20px rgba(155,89,182,0.05)'
            }}
          >
            <ScanLines />
            <CornerAccents />

            {/* Header */}
            <div className="relative flex items-center justify-between px-4 py-3 border-b border-cyan-500/10"
              style={{ background: 'linear-gradient(90deg, rgba(0,240,255,0.03) 0%, transparent 50%)' }}
            >
              <div className="flex items-center gap-3">
                {/* Luna Avatar */}
                <div className="relative">
                  <motion.img
                    src={LUNA_AVATAR}
                    alt="Luna"
                    className="w-10 h-10 rounded-full object-cover border border-cyan-500/30"
                    animate={{ scale: [1, 1.02, 1], opacity: [0.9, 1, 0.9] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 items-center justify-center hidden absolute inset-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  {/* Status indicator: ONLINE or SPEAKING */}
                  <motion.span
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#08080c]"
                    animate={{
                      backgroundColor: isSpeaking ? '#f59e0b' : '#34d399',
                      scale: isSpeaking ? [1, 1.3, 1] : [1, 1.05, 1],
                    }}
                    transition={{
                      duration: isSpeaking ? 0.6 : 2,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                  />
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white font-mono tracking-wide">LUNA</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                      <Activity className="w-2.5 h-2.5" /> ONLINE
                    </span>
                  </div>

                  {/* Thread Selector */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowThreadDropdown(!showThreadDropdown)}
                      className="flex items-center gap-1 text-xs text-nexo-muted hover:text-cyan-400 transition-colors font-mono"
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
                          className="absolute top-full left-0 mt-1 w-56 z-[9990] py-1 rounded-lg overflow-hidden"
                          style={{
                            background: 'rgba(15,15,22,0.98)',
                            border: '1px solid rgba(0,240,255,0.15)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                          }}
                        >
                          {threads.map(t => (
                            <button
                              key={t.id}
                              onClick={() => { setActiveThreadId(t.id); setShowThreadDropdown(false) }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors font-mono ${
                                t.id === activeThreadId ? 'bg-cyan-500/10 text-cyan-400' : 'text-nexo-text hover:bg-white/5'
                              }`}
                            >
                              {t.type === 'group' ? (
                                <Users className="w-4 h-4 text-nexo-muted flex-shrink-0" />
                              ) : (
                                <User className="w-4 h-4 text-nexo-muted flex-shrink-0" />
                              )}
                              <span className="flex-1 truncate">{t.title}</span>
                              {t.id === activeThreadId && <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* TTS Toggle */}
                <button
                  onClick={toggleTts}
                  className={`p-2 rounded-lg transition-colors ${
                    ttsEnabled
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-nexo-muted hover:text-cyan-400 hover:bg-cyan-500/5'
                  }`}
                  title={ttsEnabled ? 'Luna fala (ativado)' : 'Luna fala (desativado)'}
                >
                  {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button
                  onClick={clearThreadMessages}
                  className="p-2 text-nexo-muted hover:text-cyan-400 hover:bg-cyan-500/5 rounded-lg transition-colors"
                  title="Limpar conversa"
                >
                  <Eraser className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-nexo-muted hover:text-cyan-400 hover:bg-cyan-500/5 rounded-lg transition-colors"
                  title="Fechar (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
              {currentMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-nexo-muted">
                  <div className="relative mb-4">
                    <img
                      src={LUNA_AVATAR}
                      alt="Luna"
                      className="w-16 h-16 rounded-full object-cover border border-cyan-500/20 opacity-50"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  </div>
                  <p className="text-sm font-medium font-mono">Nenhuma mensagem ainda</p>
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
                const isTyping = msg.id === typingMsgId && !isUser
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
                    <div className={`max-w-[75%] px-4 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-nexo-primary text-white rounded-2xl rounded-tr-sm'
                        : 'rounded-2xl rounded-tl-sm font-mono tracking-tight'
                    }`}
                    style={isUser ? {} : {
                      background: 'linear-gradient(135deg, rgba(0,240,255,0.08) 0%, rgba(155,89,182,0.05) 100%)',
                      border: '1px solid rgba(0,240,255,0.1)',
                      color: '#e0e0e0'
                    }}
                    >
                      {showAuthor && (
                        <p className="text-[10px] font-semibold mb-0.5 font-mono" style={{ color: authorColor }}>
                          {msg.authorName}
                        </p>
                      )}
                      {isTyping ? (
                        <TypingText text={msg.text} />
                      ) : isUser ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <LunaMarkdown content={msg.text} />
                      )}

                      {/* Editable Preview Card */}
                      {msg.needsConfirmation && msg.editableFields && (
                        <EditablePreviewCard
                          fields={msg.editableFields}
                          title={
                            msg.previewType === 'task_edit' ? 'Editar tarefa' :
                            msg.previewType === 'payment_edit' ? 'Editar pagamento' :
                            msg.previewType === 'expense_edit' ? 'Editar despesa' :
                            msg.previewType === 'lead_edit' ? 'Editar lead' :
                            msg.previewType === 'delete_confirm' ? 'Confirmar exclusão' :
                            'Confirmar'
                          }
                          onSubmit={(edited) => {
                            setPendingConfirmation({ actions: msg.actions, messageId: msg.id })
                            confirmPendingActions(true, edited)
                          }}
                          onCancel={() => confirmPendingActions(false)}
                        />
                      )}

                      {/* Confirmation buttons / Inline Preview */}
                      {msg.needsConfirmation && !msg.editableFields && (
                        msg.previewData ? (
                          <div className="mt-3">
                            {msg.previewData.map((preview, idx) => (
                              <LunaInlinePreview
                                key={idx}
                                intent={preview.intent}
                                values={preview.values}
                                affectedItems={preview.affectedItems}
                                onConfirm={() => {
                                  setPendingConfirmation({ actions: msg.actions, messageId: msg.id })
                                  confirmPendingActions(true)
                                }}
                                onCancel={() => confirmPendingActions(false)}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => {
                                setPendingConfirmation({ actions: msg.actions, messageId: msg.id })
                                confirmPendingActions(true)
                              }}
                              className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg hover:bg-emerald-500/30 transition-colors font-medium border border-emerald-500/20"
                            >
                              ✅ Confirmar
                            </button>
                            <button
                              onClick={() => confirmPendingActions(false)}
                              className="px-3 py-1.5 bg-white/5 text-nexo-text text-xs rounded-lg hover:bg-white/10 transition-colors font-medium border border-white/10"
                            >
                              ❌ Cancelar
                            </button>
                          </div>
                        )
                      )}

                      {/* Executed confirmation */}
                      {!msg.needsConfirmation && msg.executed && (
                        <div className="mt-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Ação executada com sucesso!
                        </div>
                      )}

                      {/* Reactions */}
                      <LunaMessageReactions
                        message={msg}
                        threadId={activeThreadId}
                        currentUser={activeUser}
                        isGroup={isGroup}
                        isOwnMessage={isUser}
                      />

                      {/* Timestamp */}
                      <span className={`text-[10px] mt-1.5 block font-mono ${isUser ? 'text-white/60' : 'text-nexo-muted'}`}>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        {msg.fallback && <span className="ml-2 text-yellow-400">⚡ modo rápido</span>}
                        {msg.executed && <span className="ml-2 text-emerald-400">✅ executado</span>}
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
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-cyan-500/20">
                    <img
                      src={LUNA_AVATAR}
                      alt="Luna"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,240,255,0.05) 0%, rgba(155,89,182,0.03) 100%)',
                      border: '1px solid rgba(0,240,255,0.08)'
                    }}
                  >
                    <Loader className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-xs text-nexo-muted font-mono">Luna está pensando...</span>
                  </div>
                </div>
              )}

              {/* Thread loading */}
              {isLoadingThread && !chatLoading && (
                <div className="flex justify-center py-4">
                  <Loader className="w-5 h-5 text-cyan-400 animate-spin" />
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="relative p-3 border-t border-cyan-500/10"
              style={{ background: 'linear-gradient(0deg, rgba(8,8,12,0.98) 0%, rgba(15,15,22,0.9) 100%)' }}
            >
              <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 border transition-colors"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  borderColor: 'rgba(0,240,255,0.1)'
                }}
              >
                <MessageCircle className="w-4 h-4 text-cyan-500/50 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                  placeholder={`Mensagem em ${getThreadDisplayTitle()}...`}
                  className="flex-1 bg-transparent text-sm text-white placeholder-nexo-muted outline-none font-mono"
                  disabled={chatLoading}
                />
                <LunaVoiceInput
                  onTranscript={(text) => {
                    setChatInput(prev => (prev ? prev + ' ' : '') + text)
                    setTimeout(() => inputRef.current?.focus(), 100)
                  }}
                  disabled={chatLoading}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,240,255,0.2) 0%, rgba(155,89,182,0.2) 100%)',
                    border: '1px solid rgba(0,240,255,0.2)'
                  }}
                >
                  <Send className="w-4 h-4 text-cyan-400" />
                </button>
              </div>
              <p className="text-[10px] text-nexo-muted/60 mt-1.5 text-center font-mono">
                Pressione <kbd className="px-1 py-0.5 rounded text-[10px] border border-cyan-500/20 text-cyan-400/70">Enter</kbd> para enviar · <kbd className="px-1 py-0.5 rounded text-[10px] border border-cyan-500/20 text-cyan-400/70">Esc</kbd> para fechar
              </p>
            </div>
          </motion.div>

          {/* Smart Form Modal */}
          {smartForm && (
            <SmartFormModal
              smartForm={smartForm}
              onSubmit={handleSmartFormSubmit}
              onCancel={handleSmartFormCancel}
            />
          )}
        </>
      )}
    </AnimatePresence>
  )
}

/* ── Typing Text Component ── */
function TypingText({ text, speed = 12 }) {
  const [displayed, setDisplayed] = useState('')
  const indexRef = useRef(0)

  useEffect(() => {
    if (!text) { setDisplayed(''); return }
    indexRef.current = 0
    setDisplayed('')
    const interval = setInterval(() => {
      indexRef.current++
      if (indexRef.current >= text.length) {
        setDisplayed(text)
        clearInterval(interval)
      } else {
        setDisplayed(text.slice(0, indexRef.current))
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed])

  return <span>{displayed}<span className="animate-pulse text-cyan-400">▋</span></span>
}
