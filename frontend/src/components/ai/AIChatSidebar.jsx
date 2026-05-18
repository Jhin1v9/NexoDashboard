import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Send, Brain, Target, PenTool,
  DollarSign, Search, Lightbulb, X, Loader2,
  Bot, User, Zap, Check
} from 'lucide-react'
import axios from 'axios'

/**
 * AIChatSidebar - Sidebar direita do editor (collapsible)
 *
 * - Header com "NEXO Creative Partner" e icone Sparkles
 * - 5 botoes de modo: Brainstorm, Estrategia, Redator, Precificacao, Pesquisa
 * - Area de mensagens com scroll
 * - Mensagens do usuario: direita, bg-nexo-primary
 * - Mensagens da IA: esquerda, glass-card
 * - Input para mensagem + botao enviar
 * - Loading indicator
 * - Sugestoes da IA com botao "Aplicar" (chama /api/ideas/:id/apply-ai)
 *
 * Props:
 *  ideaId {string} - ID da ideia
 *  idea {object} - Dados da ideia para contexto
 *  onApplySuggestion {function} - Callback ao aplicar sugestao
 */

const MODES = [
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    icon: Brain,
    description: 'Gere ideias criativas',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
  },
  {
    id: 'estrategia',
    label: 'Estrategia',
    icon: Target,
    description: 'Analise e planejamento',
    color: 'text-nexo-info',
    bgColor: 'bg-nexo-info/20',
    borderColor: 'border-nexo-info/30',
  },
  {
    id: 'redator',
    label: 'Redator',
    icon: PenTool,
    description: 'Escreva propostas',
    color: 'text-nexo-success',
    bgColor: 'bg-nexo-success/20',
    borderColor: 'border-nexo-success/30',
  },
  {
    id: 'precificacao',
    label: 'Precificacao',
    icon: DollarSign,
    description: 'Sugestao de precos',
    color: 'text-nexo-warning',
    bgColor: 'bg-nexo-warning/20',
    borderColor: 'border-nexo-warning/30',
  },
  {
    id: 'pesquisa',
    label: 'Pesquisa',
    icon: Search,
    description: 'Benchmarks e tendencias',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500/30',
  },
]

const QUICK_SUGGESTIONS = [
  'Melhore este titulo',
  'Sugira proximos passos',
  'Ajude a estruturar melhor',
  'Analise pontos fracos',
  'Crie um pitch de venda',
]

export default function AIChatSidebar({ ideaId, idea, onApplySuggestion }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState('brainstorm')
  const [suggestions, setSuggestions] = useState([])
  const [appliedSuggIds, setAppliedSuggIds] = useState(new Set())
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (msgText) => {
    const text = msgText || input.trim()
    if (!text || loading || !ideaId) return

    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    if (!msgText) setInput('')
    setLoading(true)
    setSuggestions([])

    try {
      const res = await axios.post(`/api/ideas/${ideaId}/ai-chat`, {
        message: text,
        mode: activeMode,
        context: idea
          ? {
              title: idea.title,
              type: idea.type,
              priority: idea.priority,
              status: idea.status,
              content: idea.content,
            }
          : {},
      })

      if (res.data.success) {
        const aiResponse = res.data.data?.response || 'Sem resposta'
        const aiSuggestions = res.data.data?.suggestions || []
        const aiActions = res.data.data?.actionsExecuted || []

        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: aiResponse,
            mode: activeMode,
            suggestions: aiSuggestions,
            actionsExecuted: aiActions,
          },
        ])

        if (aiSuggestions.length > 0) {
          setSuggestions(
            aiSuggestions.map((s, i) => ({
              id: `sugg-${Date.now()}-${i}`,
              text: s,
              index: i,
            }))
          )
        }
      }
    } catch (err) {
      console.error('[AIChatSidebar] sendMessage error:', err)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Erro ao processar sua mensagem. Tente novamente.',
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleApplySuggestion = async (sugg) => {
    if (!ideaId || appliedSuggIds.has(sugg.id)) return

    try {
      // Primeiro tenta aplicar via API se tiver suggestionId do backend
      const suggId = sugg.id
      if (suggId && !suggId.startsWith('sugg-')) {
        await axios.post(`/api/ideas/${ideaId}/apply-ai`, {
          suggestionId: suggId,
        })
      }

      setAppliedSuggIds(prev => new Set(prev).add(sugg.id))

      if (onApplySuggestion) {
        onApplySuggestion(sugg.text)
      }
    } catch (err) {
      console.error('[AIChatSidebar] applySuggestion error:', err)
      // Ainda marca como aplicada no UI mesmo se API falhar
      setAppliedSuggIds(prev => new Set(prev).add(sugg.id))
      if (onApplySuggestion) {
        onApplySuggestion(sugg.text)
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const currentMode = MODES.find(m => m.id === activeMode) || MODES[0]

  return (
    <div className="flex flex-col h-full border-l border-nexo-border bg-nexo-bg/50">
      {/* HEADER */}
      <div className="p-4 border-b border-nexo-border flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-nexo-primary/20 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-nexo-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-nexo-text truncate">
              NEXO Creative Partner
            </h3>
            <p className="text-[10px] text-nexo-muted">Assistente criativo</p>
          </div>
        </div>

        {/* MODE BUTTONS */}
        <div className="flex flex-wrap gap-1">
          {MODES.map(mode => {
            const Icon = mode.icon
            const isActive = activeMode === mode.id
            return (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id)}
                title={mode.description}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                  isActive
                    ? `${mode.bgColor} ${mode.color} ${mode.borderColor}`
                    : 'bg-nexo-bg text-nexo-muted border-nexo-border hover:text-nexo-text hover:bg-nexo-card'
                }`}
              >
                <Icon className="w-3 h-3" />
                {mode.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {/* Empty state */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-6"
          >
            <div className={`w-12 h-12 rounded-2xl ${currentMode.bgColor} flex items-center justify-center mx-auto mb-3`}>
              <Sparkles className={`w-5 h-5 ${currentMode.color}`} />
            </div>
            <p className="text-xs text-nexo-muted mb-1">
              Modo: <span className={currentMode.color}>{currentMode.label}</span>
            </p>
            <p className="text-[11px] text-nexo-muted/70 mb-4">
              {currentMode.description}
            </p>
            <div className="space-y-1.5">
              {QUICK_SUGGESTIONS.map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="block w-full text-left px-3 py-1.5 rounded-lg text-[11px] text-nexo-muted hover:text-nexo-text hover:bg-nexo-card transition-colors border border-nexo-border/50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Messages */}
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user'
                  ? 'bg-nexo-primary/20'
                  : msg.isError
                    ? 'bg-nexo-danger/20'
                    : 'bg-nexo-info/20'
              }`}>
                {msg.role === 'user' ? (
                  <User className="w-3 h-3 text-nexo-primary" />
                ) : (
                  <Bot className={`w-3 h-3 ${msg.isError ? 'text-nexo-danger' : 'text-nexo-info'}`} />
                )}
              </div>

              {/* Message bubble */}
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-nexo-primary text-white'
                  : msg.isError
                    ? 'bg-nexo-danger/10 text-nexo-danger border border-nexo-danger/20'
                    : 'glass-card text-nexo-text border border-nexo-border/50'
              }`}>
                {msg.content}

                {/* Actions executed inside AI message */}
                {msg.role === 'assistant' && msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-nexo-border/30 space-y-1">
                    {msg.actionsExecuted.map((action, ai) => (
                      <div
                        key={ai}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg text-[10px] ${
                          action.success
                            ? 'bg-nexo-success/10 text-nexo-success border border-nexo-success/20'
                            : 'bg-nexo-danger/10 text-nexo-danger border border-nexo-danger/20'
                        }`}
                      >
                        {action.success ? (
                          <Check className="w-3 h-3 flex-shrink-0" />
                        ) : (
                          <X className="w-3 h-3 flex-shrink-0" />
                        )}
                        <span className="flex-1">{action.message || action.error}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestions inside AI message */}
                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-nexo-border/30 space-y-1">
                    {msg.suggestions.map((sugg, si) => (
                      <div
                        key={si}
                        className="flex items-center gap-2 p-1.5 rounded-lg bg-nexo-bg/50"
                      >
                        <Zap className="w-3 h-3 text-nexo-warning flex-shrink-0" />
                        <span className="text-[10px] text-nexo-text flex-1 truncate">
                          {sugg}
                        </span>
                        <button
                          onClick={() => handleApplySuggestion({ id: sugg, text: sugg })}
                          className="px-2 py-0.5 bg-nexo-success/20 text-nexo-success rounded text-[10px] font-medium hover:bg-nexo-success/30 transition-colors flex items-center gap-0.5 flex-shrink-0"
                        >
                          <Check className="w-2.5 h-2.5" />
                          Aplicar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-2"
            >
              <div className="w-6 h-6 rounded-lg bg-nexo-info/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3 h-3 text-nexo-info" />
              </div>
              <div className="px-3 py-2 rounded-xl glass-card border border-nexo-border/50">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 text-nexo-primary animate-spin" />
                  <span className="text-[10px] text-nexo-muted">Pensando...</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending suggestions (from last AI response) */}
        {suggestions.length > 0 && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1.5 ml-8"
          >
            <p className="text-[10px] text-nexo-muted uppercase tracking-wider">Sugestoes</p>
            {suggestions.map(sugg => (
              <div
                key={sugg.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-nexo-card border border-nexo-border/50"
              >
                <Lightbulb className="w-3.5 h-3.5 text-nexo-warning flex-shrink-0" />
                <span className="text-[11px] text-nexo-text flex-1 truncate">
                  {sugg.text}
                </span>
                <button
                  onClick={() => handleApplySuggestion(sugg)}
                  disabled={appliedSuggIds.has(sugg.id)}
                  className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 flex-shrink-0 transition-colors ${
                    appliedSuggIds.has(sugg.id)
                      ? 'bg-nexo-success/20 text-nexo-success cursor-default'
                      : 'bg-nexo-primary/20 text-nexo-primary hover:bg-nexo-primary/30'
                  }`}
                >
                  {appliedSuggIds.has(sugg.id) ? (
                    <>
                      <Check className="w-2.5 h-2.5" />
                      Aplicada
                    </>
                  ) : (
                    <>
                      <Zap className="w-2.5 h-2.5" />
                      Aplicar
                    </>
                  )}
                </button>
              </div>
            ))}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-3 border-t border-nexo-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Pergunte em modo ${currentMode.label}...`}
            disabled={loading}
            className="flex-1 px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-xs text-nexo-text placeholder:text-nexo-muted/40 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-2 bg-nexo-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30 flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[9px] text-nexo-muted mt-1.5 text-center">
          Shift+Enter para nova linha
        </p>
      </div>
    </div>
  )
}
