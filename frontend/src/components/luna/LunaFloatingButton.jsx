import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Send, Loader2, MessageSquare, Bot, CheckCircle, ArrowRight } from 'lucide-react'
import { useLunaNLU } from '../../hooks/useLunaNLU'
import { useLunaContext } from '../../hooks/useLunaContext'
import { lunaEventBus } from '../../lib/lunaEventBus'
import { hasFormFields, getSchema } from './LunaIntentSchemas'
import { getSuggestionsForModule, formatHelpForModule } from './LunaModuleSuggestions'
import SmartFormModal from './SmartFormModal'
import axios from 'axios'

/**
 * LunaFloatingButton — Botão flutuante global para acessar a Luna via NLU.
 *
 * Fluxo dual:
 *   1. Intents com formulário (ex: criar tarefa, adicionar pagamento)
 *      → SmartFormModal com campos editáveis (UX perfeita existente)
 *   2. Intents sem formulário (ex: listar projetos, verificar menções, consultar caixa)
 *      → Fallback para /api/luna/chat, mostra resultado inline
 *
 * Isso unifica o backend (todos usam o mesmo NLU + ActionExecutor)
 * sem regredir a UX do SmartFormModal.
 */

export default function LunaFloatingButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState('')
  const [modalResult, setModalResult] = useState(null)
  const [chatResult, setChatResult] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatConfirming, setChatConfirming] = useState(false)
  const [pendingActions, setPendingActions] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const inputRef = useRef(null)
  const { understand, isLoading, error } = useLunaNLU()
  const { currentModule, chatState } = useLunaContext()
  const moduleData = getSuggestionsForModule(currentModule || 'unknown')

  // Foca no input quando abre + emite evento de estado
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      lunaEventBus.emit('luna:stateChange', { chatState: 'listening', isOpen: true })
    } else {
      lunaEventBus.emit('luna:stateChange', { chatState: 'idle', isOpen: false })
    }
  }, [isOpen])

  // Fecha com ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setModalResult(null)
        setChatResult(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim() || isLoading || chatLoading) return

    const userText = text.trim()
    const userTextLower = userText.toLowerCase()

    // ── CASO ESPECIAL: "ajuda" → mostra comandos do módulo atual sem chamar API ──
    if (userTextLower === 'ajuda' || userTextLower === 'help' || userTextLower === 'comandos' || userTextLower === 'o que você pode fazer') {
      setShowHelp(true)
      setChatResult({
        reply: formatHelpForModule(currentModule || 'unknown'),
        intent: 'sistema.ajuda',
        isError: false,
      })
      setIsOpen(false)
      setText('')
      return
    }

    lunaEventBus.emit('luna:command', { text: userText, intent: null, confidence: 0 })
    const nluResult = await understand(userText)
    if (!nluResult) {
      lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
      return
    }

    setText('')
    setShowHelp(false)

    const intent = nluResult.intent
    const schema = getSchema(intent)

    // ── CASO 1: Intent com formulário editável → SmartFormModal (UX perfeita) ──
    if (hasFormFields(intent)) {
      lunaEventBus.emit('luna:stateChange', { chatState: 'acting' })
      setModalResult(nluResult)
      setIsOpen(false)
      return
    }

    // ── CASO 2: Redirect → executa direto ──
    if (schema.isRedirect) {
      lunaEventBus.emit('luna:stateChange', { chatState: 'acting' })
      setIsOpen(false)
      const target = typeof schema.redirectTo === 'function'
        ? schema.redirectTo({})
        : schema.redirectTo
      if (target) {
        window.location.href = target
      }
      return
    }

    // ── CASO 3: Info-only → mostra info inline ──
    if (schema.isInfo && isKnownIntent(intent)) {
      setChatResult({
        reply: schema.description,
        intent,
        isInfo: true,
      })
      return
    }

    // ── CASO 4: Sem schema específico ou consulta → fallback para /api/luna/chat ──
    lunaEventBus.emit('luna:stateChange', { chatState: 'thinking' })
    setChatLoading(true)
    try {
      const res = await axios.post('/api/luna/chat', {
        message: userText,
        authorName: 'Usuário',
        context: [],
      })
      const data = res.data

      if (data.needsConfirmation && data.actions) {
        setPendingActions(data.actions)
      } else {
        setPendingActions(null)
      }

      setChatResult({
        reply: data.reply || data.message || 'Pronto! ✅',
        needsConfirmation: data.needsConfirmation || false,
        previewType: data.previewType || null,
        actions: data.actions || null,
        executed: data.executed || false,
        intent: data.intent || intent,
      })
    } catch (err) {
      setChatResult({
        reply: `Eita, deu um tilt aqui 😅\n\n${err.response?.data?.error || err.message || 'Tenta de novo?'}`,
        isError: true,
        intent,
      })
    } finally {
      setChatLoading(false)
      lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
    }
  }

  const handleChatConfirm = async (confirm) => {
    if (!confirm) {
      setPendingActions(null)
      setChatResult(prev => ({
        ...prev,
        needsConfirmation: false,
        reply: prev.reply + '\n\n❌ Cancelado.',
      }))
      return
    }

    if (!pendingActions) return
    setChatConfirming(true)

    try {
      const res = await axios.post('/api/luna/chat', {
        message: 'sim',
        authorName: 'Usuário',
        context: [],
        confirmActions: true,
        pendingActions,
      })
      const data = res.data
      setPendingActions(null)

      setChatResult({
        reply: data.reply || (data.success ? 'Pronto! ✅' : `Erro: ${data.error || 'Falha'}`),
        executed: true,
        intent: data.intent,
      })
    } catch (err) {
      setChatResult({
        reply: `Eita, deu erro ao confirmar 😅\n\n${err.response?.data?.error || err.message}`,
        isError: true,
      })
    } finally {
      setChatConfirming(false)
    }
  }

  const handleSuccess = (data) => {
    console.log('[Luna] Ação executada:', data)
  }

  const getUserColor = (name) => {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
    let hash = 0
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  return (
    <>
      {/* Input Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-24 right-6 left-6 sm:left-auto sm:w-[420px]"
              onClick={e => e.stopPropagation()}
            >
              <div className="glass-card p-4 space-y-3 shadow-xl shadow-black/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-nexo-primary" />
                    <span className="text-xs font-medium text-nexo-text">O que você precisa?</span>
                    {currentModule && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-primary/10 text-nexo-primary border border-nexo-primary/20">
                        {moduleData.label}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setText('ajuda')
                      inputRef.current?.focus()
                    }}
                    className="text-[10px] px-2 py-1 rounded-full bg-nexo-card border border-nexo-border text-nexo-muted hover:text-nexo-primary hover:border-nexo-primary/50 transition-colors"
                    title="Ver comandos desta página"
                  >
                    ?
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={`Ex: "${moduleData.quick[0]}", "${moduleData.quick[1]}"...`}
                    className="flex-1 bg-nexo-bg border border-nexo-border rounded-lg px-3 py-2 text-sm text-nexo-text placeholder:text-nexo-muted/50 outline-none focus:border-nexo-primary transition-colors"
                    disabled={isLoading || chatLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || chatLoading || !text.trim()}
                    className="p-2 bg-nexo-primary text-white rounded-lg hover:bg-nexo-primary/80 transition-colors disabled:opacity-50"
                  >
                    {isLoading || chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>

                {error && (
                  <p className="text-xs text-nexo-danger">{error}</p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {moduleData.quick.map(suggestion => (
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
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Painel de Resultado do Chat (fallback para consultas) */}
      <AnimatePresence>
        {chatResult && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 left-6 sm:left-auto sm:w-[420px] z-[95]"
          >
            <div className="glass-card p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#9b59b6] flex items-center justify-center">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-medium text-nexo-text">Luna</span>
                  {chatResult.intent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-primary/10 text-nexo-primary border border-nexo-primary/20">
                      {chatResult.intent}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setChatResult(null)
                    setPendingActions(null)
                  }}
                  className="text-nexo-muted hover:text-nexo-text transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mensagem */}
              <div className={`text-sm whitespace-pre-wrap ${chatResult.isError ? 'text-nexo-danger' : 'text-nexo-text'}`}>
                {chatResult.reply}
              </div>

              {/* Botões de confirmação */}
              {chatResult.needsConfirmation && pendingActions && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleChatConfirm(true)}
                    disabled={chatConfirming}
                    className="flex-1 px-3 py-2 bg-nexo-success text-white text-xs rounded-lg hover:bg-nexo-success/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {chatConfirming ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    Confirmar
                  </button>
                  <button
                    onClick={() => handleChatConfirm(false)}
                    disabled={chatConfirming}
                    className="flex-1 px-3 py-2 bg-nexo-border text-nexo-text text-xs rounded-lg hover:bg-nexo-card transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Executado com sucesso */}
              {chatResult.executed && !chatResult.needsConfirmation && (
                <div className="flex items-center gap-2 text-xs text-nexo-success">
                  <CheckCircle className="w-4 h-4" />
                  Executado com sucesso!
                </div>
              )}

              {/* Link para página /luna */}
              <div className="pt-2 border-t border-nexo-border">
                <a
                  href="/luna"
                  className="flex items-center justify-center gap-1 text-[10px] text-nexo-muted hover:text-nexo-primary transition-colors"
                >
                  Abrir chat completo <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão flutuante */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setIsOpen(!isOpen)
          if (isOpen) {
            setChatResult(null)
            setPendingActions(null)
          }
        }}
        className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all ${
          isOpen
            ? 'bg-nexo-danger text-white shadow-nexo-danger/20'
            : chatState === 'thinking'
              ? 'bg-nexo-warning text-white shadow-nexo-warning/20 animate-pulse'
              : chatState === 'acting'
                ? 'bg-nexo-success text-white shadow-nexo-success/20'
                : 'bg-nexo-primary text-white hover:bg-nexo-primary/90 shadow-nexo-primary/20'
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : chatState === 'thinking' ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageSquare className="w-5 h-5" />}
        <span className="text-sm font-medium hidden sm:inline">
          {isOpen ? 'Fechar' : chatState === 'thinking' ? 'Pensando...' : chatState === 'acting' ? 'Agindo...' : 'Luna'}
        </span>
        {currentModule && !isOpen && (
          <span className="hidden lg:inline text-[10px] opacity-70 ml-0.5">
            {currentModule}
          </span>
        )}
      </motion.button>

      {/* Smart Form Modal (mantido para intents com formulário) */}
      {modalResult && (
        <SmartFormModal
          result={modalResult}
          onClose={() => setModalResult(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
