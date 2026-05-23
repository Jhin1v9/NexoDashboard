import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Send, Loader2, Bot, CheckCircle, ArrowRight, Wand2 } from 'lucide-react'
import { useLunaNLU } from '../../hooks/useLunaNLU'
import { useLunaContext } from '../../hooks/useLunaContext'
import { useToast } from '../../context/ToastContext'
import { lunaEventBus } from '../../lib/lunaEventBus'
import { hasFormFields, getSchema, isKnownIntent } from './LunaIntentSchemas'
import { formatHelpForModule } from './LunaModuleSuggestions'
import LunaActionFlow from './LunaActionFlow'
import LunaBatchAction from './LunaBatchAction'
import LunaActionCenter from './LunaActionCenter'
import LunaChatPanel from './LunaChatPanel'
import { decideExecution, logDecision } from '../../lib/lunaDecisionEngine'
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
  const [chatResult, setChatResult] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatConfirming, setChatConfirming] = useState(false)
  const [pendingActions, setPendingActions] = useState(null)
  const [actionFlow, setActionFlow] = useState(null) // { result, mode }
  const [batchAction, setBatchAction] = useState(null) // { intent }
  const [proactiveBadge, setProactiveBadge] = useState(null) // { count, type }
  const [actionCenterOpen, setActionCenterOpen] = useState(false)

  // ── Drag state ──
  // Posição livre: o usuário arrasta pra onde quiser, sem snap
  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem('luna_fab_pos')
      return raw ? JSON.parse(raw) : { x: 0, y: 0 }
    } catch { return { x: 0, y: 0 } }
  })
  const drag = useRef({ active: false, dragged: false, mx: 0, my: 0, bx: 0, by: 0 })
  const fabRef = useRef(null)

  const { understand, isLoading, error } = useLunaNLU()
  const { currentModule, chatState } = useLunaContext()
  const { addToast } = useToast()

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
      // Recarrega badge após dismiss
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
        setChatResult(null)
        setActionCenterOpen(false)
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
    setText('')
    if (!nluResult) {
      lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
      return
    }

    const intent = nluResult.intent
    const schema = getSchema(intent)

    // ── CASO ESPECIAL: Email → abre EmailCompose diretamente ──
    const emailIntent = intent?.toLowerCase() || ''
    if (emailIntent === 'email.enviar' || emailIntent === 'email.responder' || emailIntent === 'email.criar_rascunho') {
      lunaEventBus.emit('luna:stateChange', { chatState: 'acting' })
      setIsOpen(false)
      const to = nluResult.entities?.find(e => e.entity === 'email' || e.entity === 'para')?.option || ''
      const subject = nluResult.entities?.find(e => e.entity === 'assunto')?.option || ''
      const params = new URLSearchParams()
      params.append('compose', '1')
      if (to) params.append('to', to)
      if (subject) params.append('subject', subject)
      window.location.href = `/email?${params.toString()}`
      return
    }
    if (emailIntent === 'email.listar_nao_lidos' || emailIntent === 'email.listar' || emailIntent === 'email.sincronizar') {
      lunaEventBus.emit('luna:stateChange', { chatState: 'acting' })
      setIsOpen(false)
      window.location.href = '/email'
      return
    }

    // ── CASO 1: Intent com formulário editável → Decision Engine (Passo 3) ──
    if (hasFormFields(intent)) {
      const schema = getSchema(intent)
      const decision = decideExecution({
        score: nluResult.score || 0,
        intent,
        text: userText,
        schema,
        values: {},
        hasSelection: false,
      })
      logDecision(decision, 'LunaFloatingButton')

      if (decision.mode === 'auto') {
        // Execução direta — sem UI
        executeAutoAction(nluResult, schema)
      } else if (decision.mode === 'transform') {
        // Modo C: Transformação de Interface — seleção múltipla
        setBatchAction({ intent, result: nluResult })
        setIsOpen(false)
      } else {
        // Abre drawer com modo decidido
        setActionFlow({ result: nluResult, mode: decision.mode })
      }
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
        contextModule: currentModule || null,
      })
      const data = res.data

      // ── CASO ESPECIAL: Email intents do IntentParser → navega para EmailHub ──
      const backendIntent = data.intent || ''
      const emailAction = data.actions?.find(a => a.type === 'enviar_email' || a.type === 'responder_email' || a.type === 'consultar_emails')
      if (emailAction || backendIntent === 'enviar_email' || backendIntent === 'responder_email' || backendIntent === 'consultar_emails') {
        lunaEventBus.emit('luna:stateChange', { chatState: 'acting' })
        setIsOpen(false)
        setChatLoading(false)
        const params = new URLSearchParams()
        if (backendIntent === 'enviar_email' || emailAction?.type === 'enviar_email') {
          params.append('compose', '1')
          const p = emailAction?.params || {}
          if (p.destinatario) params.append('to', p.destinatario)
          if (p.assunto) params.append('subject', p.assunto)
          if (p.contexto) params.append('body', p.contexto)
        }
        window.location.href = `/email${params.toString() ? '?' + params.toString() : ''}`
        return
      }

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
        contextModule: currentModule || null,
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

  const handleActionFlowDone = (data) => {
    setActionFlow(null)
    if (data?.redirect) {
      window.location.href = data.redirect
    }
  }

  const executeAutoAction = async (result, schema) => {
    lunaEventBus.emit('luna:stateChange', { chatState: 'acting' })
    try {
      if (schema.isRedirect) {
        const target = typeof schema.redirectTo === 'function'
          ? schema.redirectTo({})
          : schema.redirectTo
        if (target) window.location.href = target
        return
      }
      if (schema.isInfo) {
        lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
        return
      }
      if (!schema.submitConfig) {
        lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
        return
      }
      const payload = schema.submitConfig.transform(result.entities || result.values || {})
      const token = localStorage.getItem('nexo_token') || ''
      await axios({
        method: schema.submitConfig.method,
        url: schema.submitConfig.endpoint,
        data: payload,
        headers: { Authorization: `Bearer ${token}` },
      })
      addToast?.(schema.successMessage || 'Feito! ✓', 'success')
      lunaEventBus.emit('luna:actionCompleted', { intent: result.intent, mode: 'auto', payload })
      lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erro'
      addToast?.(`Erro: ${msg}`, 'error')
      lunaEventBus.emit('luna:stateChange', { chatState: 'idle' })
    }
  }

  const handleSuccess = (data) => {
    console.log('[Luna] Ação executada:', data)
  }

  return (
    <>
      {/* Luna Chat Panel (replaces ugly inline input) */}
      <LunaChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />

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

      {/* Botão flutuante — arrastável livre, clique abre/fecha chat */}
      <div
        ref={fabRef}
        className="fixed bottom-6 right-6 z-[100] select-none"
        style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, cursor: 'grab' }}
      >
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className={`flex items-center gap-2.5 px-5 py-3.5 rounded-full shadow-2xl transition-all ${
            isOpen || actionCenterOpen
              ? 'bg-nexo-danger text-white shadow-nexo-danger/30'
              : 'bg-gradient-to-r from-nexo-primary to-purple-600 text-white shadow-purple-500/30 hover:shadow-purple-500/50'
          }`}
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
            if (isOpen) {
              setChatResult(null)
              setPendingActions(null)
            }
          }}
        >
          {isOpen || actionCenterOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Wand2 className="w-5 h-5" />
          )}
          <span className="text-sm font-semibold hidden sm:inline tracking-wide">
            {isOpen || actionCenterOpen ? 'Fechar' : 'Luna'}
          </span>
        </motion.button>
        {/* Badge Proativo — clique separado abre Action Center */}
        {!isOpen && !actionCenterOpen && proactiveBadge && proactiveBadge.count > 0 && (
          <button
            onClick={() => setActionCenterOpen(true)}
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg animate-pulse hover:bg-red-400 transition-colors cursor-pointer z-[101]"
          >
            {proactiveBadge.count > 9 ? '9+' : proactiveBadge.count}
          </button>
        )}
      </div>

      {/* Luna Action Flow — drawer inline para coleta/preview/confirm (Passo 3) */}
      {actionFlow && (
        <LunaActionFlow
          nluResult={actionFlow.result}
          mode={actionFlow.mode}
          onDone={handleActionFlowDone}
        />
      )}

      {/* Luna Batch Action — Modo C: Transformação de Interface */}
      {batchAction && (
        <div className="fixed bottom-24 right-6 left-6 sm:left-auto sm:w-[420px] z-[95]">
          <LunaBatchAction
            intent={batchAction.intent}
            onClose={() => setBatchAction(null)}
            onSuccess={(data) => {
              addToast(`${data.count} itens processados ✓`, 'success')
              setBatchAction(null)
              lunaEventBus.emit('luna:actionCompleted', { intent: batchAction.intent, mode: 'transform', ...data })
            }}
          />
        </div>
      )}

      {/* Luna Action Center — Inbox de ações pendentes */}
      {actionCenterOpen && (
        <LunaActionCenter onClose={() => setActionCenterOpen(false)} />
      )}
    </>
  )
}
