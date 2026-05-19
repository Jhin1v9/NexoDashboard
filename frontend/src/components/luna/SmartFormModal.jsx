import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, X, Loader2, CheckCircle, AlertTriangle,
  ArrowRight, HelpCircle, Navigation, Send, MessageSquare,
  BrainCircuit
} from 'lucide-react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../context/ToastContext'
import { getSchema } from './LunaIntentSchemas'

/**
 * SmartFormModal — Modal inteligente que transforma intent do NLU em formulário.
 *
 * Props:
 *   - result: objeto retornado por /api/luna/understand
 *   - onClose: fecha o modal
 *   - onSuccess: callback após ação bem-sucedida
 */

export default function SmartFormModal({ result, onClose, onSuccess }) {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [values, setValues] = useState({})
  const [showIntentPicker, setShowIntentPicker] = useState(false)
  const [availableIntents, setAvailableIntents] = useState([])
  const [isLearning, setIsLearning] = useState(false)

  const intent = result?.intent || 'None'
  const score = result?.score || 0
  const entities = result?.entities || []
  const action = result?.action || 'fallback'
  const originalText = result?.text || ''

  const schema = getSchema(intent)

  // Inicializa valores com defaults + entities extraídas
  useEffect(() => {
    if (!schema.fields) return

    const defaults = {}
    Object.entries(schema.fields).forEach(([key, field]) => {
      defaults[key] = field.options?.[0]?.value ?? ''
    })

    // Extrai entities do NLU
    if (schema.extractEntities) {
      const extracted = schema.extractEntities(entities)
      Object.assign(defaults, extracted)
    }

    // Tenta inferir título da frase original (remove apenas verbos de ação no início)
    if (!defaults.titulo && schema.fields.titulo) {
      const cleaned = originalText
        .replace(/^(cria|criar|nova|novo|adiciona|adicionar|faz|fazer|envia|enviar|manda|mandar|responde|responder|atualiza|atualizar|deleta|deletar|arquiva|arquivar|quero|preciso|gostaria|gostaria de|uma|um|de|para|pra|pro)\s+/gi, '')
        .trim()
      if (cleaned && cleaned.length > 2) {
        defaults.titulo = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      }
    }

    setValues(defaults)
  }, [result, schema])

  const updateValue = useCallback((key, val) => {
    setValues(prev => ({ ...prev, [key]: val }))
  }, [])

  // Busca intents disponíveis para active learning
  useEffect(() => {
    if (!showIntentPicker) return
    axios.get('/api/luna/intents')
      .then(res => {
        if (res.data.success) {
          const intents = (res.data.intents || []).map(i => typeof i === 'string' ? i : i.intent).filter(Boolean)
          setAvailableIntents(intents)
        }
      })
      .catch(() => setAvailableIntents([]))
  }, [showIntentPicker])

  const handleLearn = async (correctIntent) => {
    setIsLearning(true)
    try {
      const token = localStorage.getItem('nexo_token') || ''
      await axios.post('/api/luna/learn', {
        lang: 'pt',
        utterance: originalText,
        intent: correctIntent
      }, { headers: { Authorization: `Bearer ${token}` } })
      addToast('Luna aprendeu! Modelo re-treinado com sucesso.', 'success')
      onClose()
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erro ao treinar'
      addToast(`Erro no aprendizado: ${msg}`, 'error')
    } finally {
      setIsLearning(false)
    }
  }

  const handleSubmit = async () => {
    if (schema.isRedirect) {
      const target = typeof schema.redirectTo === 'function'
        ? schema.redirectTo(values)
        : schema.redirectTo
      if (target) {
        navigate(target)
        onClose()
        onSuccess?.({ redirect: target })
      }
      return
    }

    if (schema.isInfo) {
      onClose()
      return
    }

    if (!schema.submitConfig) {
      onClose()
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload = schema.submitConfig.transform(values)
      const token = localStorage.getItem('nexo_token') || ''
      await axios({
        method: schema.submitConfig.method,
        url: schema.submitConfig.endpoint,
        data: payload,
        headers: { Authorization: `Bearer ${token}` },
      })

      onSuccess?.({ intent, payload })
      onClose()
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erro ao executar ação'
      setSubmitError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Renderização de campos ──

  const renderField = (key, field) => {
    const baseClass =
      'w-full bg-nexo-bg border border-nexo-border rounded-lg px-3 py-2 text-sm text-nexo-text ' +
      'outline-none focus:border-nexo-primary focus:ring-1 focus:ring-nexo-primary/30 transition-all'

    if (field.type === 'select') {
      return (
        <div key={key} className="space-y-1">
          <label className="text-xs font-medium text-nexo-muted">
            {field.label}{field.required && <span className="text-nexo-danger ml-0.5">*</span>}
          </label>
          <select value={values[key] || ''} onChange={e => updateValue(key, e.target.value)} className={baseClass}>
            {field.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )
    }

    if (field.type === 'date') {
      return (
        <div key={key} className="space-y-1">
          <label className="text-xs font-medium text-nexo-muted">
            {field.label}{field.required && <span className="text-nexo-danger ml-0.5">*</span>}
          </label>
          <input type="date" value={values[key] || ''} onChange={e => updateValue(key, e.target.value)} className={baseClass} />
        </div>
      )
    }

    if (field.type === 'textarea') {
      return (
        <div key={key} className="space-y-1">
          <label className="text-xs font-medium text-nexo-muted">
            {field.label}{field.required && <span className="text-nexo-danger ml-0.5">*</span>}
          </label>
          <textarea
            value={values[key] || ''}
            onChange={e => updateValue(key, e.target.value)}
            placeholder={field.placeholder}
            rows={field.rows || 3}
            className={baseClass + ' resize-none'}
          />
        </div>
      )
    }

    // text default
    return (
      <div key={key} className="space-y-1">
        <label className="text-xs font-medium text-nexo-muted">
          {field.label}{field.required && <span className="text-nexo-danger ml-0.5">*</span>}
        </label>
        <input
          type="text"
          value={values[key] || ''}
          onChange={e => updateValue(key, e.target.value)}
          placeholder={field.placeholder}
          className={baseClass}
        />
      </div>
    )
  }

  // ── Ícone por intent ──

  const getIntentIcon = () => {
    if (intent.startsWith('tarefa')) return <CheckCircle className="w-5 h-5 text-nexo-success" />
    if (intent.startsWith('email')) return <Send className="w-5 h-5 text-nexo-info" />
    if (intent.startsWith('financeiro')) return <Sparkles className="w-5 h-5 text-nexo-warning" />
    if (intent.startsWith('whatsapp')) return <MessageSquare className="w-5 h-5 text-green-400" />
    if (intent.startsWith('orcamento')) return <Sparkles className="w-5 h-5 text-nexo-primary" />
    if (intent.startsWith('sistema.ajuda')) return <HelpCircle className="w-5 h-5 text-nexo-muted" />
    if (intent.startsWith('sistema.navegar')) return <Navigation className="w-5 h-5 text-nexo-info" />
    return <Sparkles className="w-5 h-5 text-nexo-primary" />
  }

  // ── Badge de confiança ──

  const renderConfidenceBadge = () => {
    if (score >= 0.85) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-success/20 text-nexo-success">{Math.round(score * 100)}% confiança</span>
    if (score >= 0.50) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-warning/20 text-nexo-warning">{Math.round(score * 100)}% — confirme</span>
    return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-danger/20 text-nexo-danger">Baixa confiança</span>
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="glass-card w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-nexo-border">
            {getIntentIcon()}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-nexo-text truncate">{schema.title}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {renderConfidenceBadge()}
                <span className="text-[10px] text-nexo-muted truncate">"{originalText}"</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-nexo-card transition-colors text-nexo-muted">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {schema.description && (
              <p className="text-xs text-nexo-muted whitespace-pre-line">{schema.description}</p>
            )}

            {/* Alerta de baixa confiança */}
            {action === 'confirm' && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-nexo-warning/10 border border-nexo-warning/20">
                <AlertTriangle className="w-4 h-4 text-nexo-warning flex-shrink-0 mt-0.5" />
                <p className="text-xs text-nexo-warning">
                  A confiança está baixa. Verifique se os campos estão corretos antes de confirmar.
                </p>
              </div>
            )}

            {/* Fallback */}
            {intent === 'None' && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-nexo-danger/10 border border-nexo-danger/20">
                <HelpCircle className="w-4 h-4 text-nexo-danger flex-shrink-0 mt-0.5" />
                <div className="text-xs text-nexo-danger space-y-1">
                  <p>Não entendi o que você precisa.</p>
                  <p className="text-nexo-muted">Tente: "cria tarefa urgente", "quanto temos no caixa", "manda zap pro cliente"</p>
                </div>
              </div>
            )}

            {/* Active Learning — Seleção de intent correto */}
            <AnimatePresence>
              {showIntentPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <p className="text-xs text-nexo-muted">Qual era a intenção correta?</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 border border-nexo-border rounded-lg p-1">
                    {availableIntents.length === 0 && (
                      <div className="text-xs text-nexo-muted p-2">Carregando intents...</div>
                    )}
                    {availableIntents.map(availableIntent => (
                      <button
                        key={availableIntent}
                        onClick={() => handleLearn(availableIntent)}
                        disabled={isLearning}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                          availableIntent === intent
                            ? 'bg-nexo-primary/10 text-nexo-primary font-medium'
                            : 'hover:bg-nexo-card text-nexo-text'
                        }`}
                      >
                        {isLearning && availableIntent === intent ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" /> Treinando...
                          </span>
                        ) : (
                          availableIntent
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Campos do formulário */}
            {schema.fields && (
              <div className="space-y-3">
                {Object.entries(schema.fields).map(([key, field]) => renderField(key, field))}
              </div>
            )}

            {/* Erro de submit */}
            {submitError && (
              <div className="p-2.5 rounded-lg bg-nexo-danger/10 border border-nexo-danger/20 text-xs text-nexo-danger">
                {submitError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-5 py-3 border-t border-nexo-border bg-nexo-bg/50 shrink-0">
            <button
              onClick={onClose}
              disabled={isSubmitting || isLearning}
              className="px-4 py-2 text-xs font-medium text-nexo-muted hover:text-nexo-text transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <div className="flex-1" />

            {/* Active Learning trigger */}
            {!showIntentPicker && score < 0.85 && intent !== 'None' && (
              <button
                onClick={() => setShowIntentPicker(true)}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-nexo-muted hover:text-nexo-text border border-nexo-border rounded-lg transition-colors disabled:opacity-50"
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                Não era isso?
              </button>
            )}
            {showIntentPicker && (
              <button
                onClick={() => setShowIntentPicker(false)}
                disabled={isLearning}
                className="px-3 py-2 text-xs font-medium text-nexo-muted hover:text-nexo-text border border-nexo-border rounded-lg transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
            )}

            {schema.isRedirect && !showIntentPicker && (
              <button
                onClick={handleSubmit}
                className="flex items-center gap-1.5 px-4 py-2 bg-nexo-primary text-white text-xs font-medium rounded-lg hover:bg-nexo-primary/80 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Ir para página
              </button>
            )}
            {schema.fields && !showIntentPicker && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-nexo-success text-white text-xs font-medium rounded-lg hover:bg-nexo-success/80 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                {isSubmitting ? 'Processando...' : 'Confirmar'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
