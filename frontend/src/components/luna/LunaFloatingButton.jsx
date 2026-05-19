import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Send, Loader2, MessageSquare, Bot, CheckCircle } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../../context/AuthContext'

/**
 * LunaFloatingButton — Botão flutuante global com mini-chat.
 *
 * Usa o MESMO endpoint /api/luna/chat da página /luna.
 * Suporta confirmação de ações inline (Confirmar/Cancelar).
 */

export default function LunaFloatingButton() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const authorName = user?.name || user?.displayName || 'Usuário'

  // Foca no input quando abre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Fecha com ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Scroll pro final quando nova mensagem chega
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const addMessage = (msg) => {
    setMessages(prev => [...prev, { ...msg, id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }])
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!text.trim() || isLoading) return

    const userText = text.trim()
    setText('')

    // Adiciona mensagem do usuário
    addMessage({
      role: 'user',
      authorName,
      text: userText,
      timestamp: new Date().toISOString()
    })

    setIsLoading(true)

    try {
      // Se tem pendingConfirmation, trata como confirmação
      if (pendingConfirmation && (userText.toLowerCase() === 'sim' || userText.toLowerCase() === 'yes')) {
        await handleConfirm(true)
        return
      }

      const res = await axios.post('/api/luna/chat', {
        message: userText,
        authorName,
        context: [],
        confirmActions: false
      })

      const data = res.data

      if (data.needsConfirmation && data.actions) {
        setPendingConfirmation({
          actions: data.actions,
          previewType: data.previewType,
          editableFields: data.editableFields
        })
      } else {
        setPendingConfirmation(null)
      }

      addMessage({
        role: 'assistant',
        authorName: 'Luna',
        text: data.reply || data.message || 'Pronto! ✅',
        needsConfirmation: data.needsConfirmation || false,
        previewType: data.previewType || null,
        editableFields: data.editableFields || null,
        actions: data.actions || null,
        executed: data.executed || false,
        timestamp: new Date().toISOString()
      })
    } catch (err) {
      addMessage({
        role: 'assistant',
        authorName: 'Luna',
        text: `Eita, deu um tilt aqui 😅\n\n${err.response?.data?.error || err.message || 'Tenta de novo?'}`,
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = async (confirm, editedFields = null) => {
    if (!confirm) {
      setPendingConfirmation(null)
      addMessage({
        role: 'assistant',
        authorName: 'Luna',
        text: 'Beleza, cancelado 👍',
        timestamp: new Date().toISOString()
      })
      return
    }

    if (!pendingConfirmation) return
    setIsLoading(true)

    try {
      const res = await axios.post('/api/luna/chat', {
        message: 'sim',
        authorName,
        context: [],
        confirmActions: true,
        pendingActions: pendingConfirmation.actions,
        editedFields
      })

      const data = res.data
      setPendingConfirmation(null)

      addMessage({
        role: 'assistant',
        authorName: 'Luna',
        text: data.reply || (data.success ? 'Pronto! ✅' : `Erro: ${data.error || 'Falha'}`),
        executed: true,
        timestamp: new Date().toISOString()
      })
    } catch (err) {
      addMessage({
        role: 'assistant',
        authorName: 'Luna',
        text: `Eita, deu erro ao confirmar 😅\n\n${err.response?.data?.error || err.message}`,
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getUserColor = (name) => {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
    let hash = 0
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <>
      {/* Chat Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-24 right-6 left-6 sm:left-auto sm:w-[420px] max-h-[70vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="glass-card rounded-t-xl p-3 border-b border-nexo-border flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-nexo-primary flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-nexo-text">Luna</p>
                  <p className="text-[10px] text-nexo-muted">Assistente NEXO</p>
                </div>
                <button
                  onClick={() => {
                    setMessages([])
                    setPendingConfirmation(null)
                  }}
                  className="text-[10px] text-nexo-muted hover:text-nexo-text transition-colors"
                >
                  Limpar
                </button>
              </div>

              {/* Messages */}
              <div className="glass-card rounded-b-xl p-3 space-y-3 overflow-y-auto max-h-[50vh] min-h-[200px]">
                {messages.length === 0 && (
                  <div className="text-center py-8 text-nexo-muted">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Oi! Como posso te ajudar? 👋</p>
                    <p className="text-[10px] mt-1 opacity-60">Ex: "cria tarefa", "consultar caixa"...</p>
                  </div>
                )}

                {messages.map((msg) => {
                  const isUser = msg.role === 'user'
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] text-white font-bold"
                        style={{ backgroundColor: isUser ? getUserColor(msg.authorName) : '#9b59b6' }}
                      >
                        {isUser ? (msg.authorName?.charAt(0) || 'U') : <Bot className="w-3 h-3 text-white" />}
                      </div>
                      <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
                        isUser
                          ? 'bg-nexo-primary text-white rounded-tr-none'
                          : 'bg-nexo-card text-nexo-text rounded-tl-none'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>

                        {/* Botões de confirmação */}
                        {msg.needsConfirmation && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleConfirm(true)}
                              className="px-2.5 py-1 bg-nexo-success text-white text-[10px] rounded-md hover:bg-nexo-success/80 transition-colors"
                            >
                              ✅ Confirmar
                            </button>
                            <button
                              onClick={() => handleConfirm(false)}
                              className="px-2.5 py-1 bg-nexo-border text-nexo-text text-[10px] rounded-md hover:bg-nexo-card transition-colors"
                            >
                              ❌ Cancelar
                            </button>
                          </div>
                        )}

                        {/* Confirmado com sucesso */}
                        {!msg.needsConfirmation && msg.executed && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-nexo-success">
                            <CheckCircle className="w-3 h-3" />
                            Executado!
                          </div>
                        )}

                        <span className={`text-[9px] mt-1 block ${isUser ? 'text-white/60' : 'text-nexo-muted'}`}>
                          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {isLoading && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#9b59b6] flex items-center justify-center">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                    <div className="px-3 py-2 bg-nexo-card rounded-xl rounded-tl-none">
                      <Loader2 className="w-4 h-4 text-nexo-primary animate-spin" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="glass-card mt-2 p-3">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={pendingConfirmation ? 'Responda "sim" ou clique nos botões...' : 'O que você precisa?'}
                    className="flex-1 bg-nexo-bg border border-nexo-border rounded-lg px-3 py-2 text-sm text-nexo-text placeholder:text-nexo-muted/50 outline-none focus:border-nexo-primary transition-colors"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !text.trim()}
                    className="p-2 bg-nexo-primary text-white rounded-lg hover:bg-nexo-primary/80 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>

                {/* Sugestões rápidas */}
                {!pendingConfirmation && messages.length === 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['cria tarefa', 'consultar caixa', 'verificar mencoes', 'listar projetos'].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setText(suggestion)
                          inputRef.current?.focus()
                        }}
                        className="px-2 py-1 text-[10px] rounded-full bg-nexo-card border border-nexo-border text-nexo-muted hover:text-nexo-text hover:border-nexo-primary/50 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão flutuante */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg shadow-nexo-primary/20 transition-all ${
          isOpen
            ? 'bg-nexo-danger text-white'
            : 'bg-nexo-primary text-white hover:bg-nexo-primary/90'
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        <span className="text-sm font-medium hidden sm:inline">{isOpen ? 'Fechar' : 'Luna'}</span>
      </motion.button>
    </>
  )
}
