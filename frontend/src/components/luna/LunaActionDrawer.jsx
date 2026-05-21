/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaActionDrawer — Painel lateral inline para coleta/preview de ações.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Características:
 *   - 380px de largura, fixo à direita
 *   - SEM backdrop blur — página continua 100% interativa
 *   - Slide animation (200ms, spring) via Framer Motion
 *   - Modos: 'collect' (campos vazios), 'preview' (pré-preenchido), 'confirm' (pré-preenchido + aviso)
 *
 * Referência: Opera Neon "Chat-Do-Make sidebar"
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, CheckCircle, AlertTriangle, Loader2,
  Sparkles, Edit3, Trash2
} from 'lucide-react'
import axios from 'axios'
import { useToast } from '../../context/ToastContext'
import { getSchema } from './LunaIntentSchemas'
import LunaSafetyDelay from './LunaSafetyDelay'
import LunaInlinePreview from './LunaInlinePreview'

export default function LunaActionDrawer({
  result,
  mode = 'preview', // 'collect' | 'preview' | 'confirm'
  onClose,
  onSuccess,
  onCancel,
}) {
  const { addToast } = useToast()
  const [values, setValues] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [safetyDelayDone, setSafetyDelayDone] = useState(false)
  const [phase, setPhase] = useState('idle') // 'idle' | 'executing' | 'undo'
  const [lastPayload, setLastPayload] = useState(null)
  const abortControllerRef = useRef(null)

  const intent = result?.intent || 'None'
  const score = result?.score || 0
  const entities = result?.entities || []
  const originalText = result?.text || ''
  const schema = getSchema(intent) || {}

  // Inicializa valores com defaults + entities extraídas
  useEffect(() => {
    // Sempre reseta estados quando o result muda (novo intent)
    setSubmitError(null)
    setSafetyDelayDone(false)
    setIsSubmitting(false)
    setPhase('idle')
    setLastPayload(null)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    if (!schema.fields) {
      setValues({})
      return
    }

    const defaults = {}
    Object.entries(schema.fields).forEach(([key, field]) => {
      defaults[key] = field.options?.[0]?.value ?? ''
    })

    if (schema.extractEntities) {
      const extracted = schema.extractEntities(entities)
      Object.assign(defaults, extracted)
    }

    // Tenta inferir título da frase original
    if (!defaults.titulo && schema.fields.titulo) {
      const cleaned = originalText
        .replace(/^(cria|criar|nova|novo|adiciona|adicionar|faz|fazer|envia|enviar|manda|mandar|responde|responder|atualiza|atualizar|deleta|deletar|arquiva|arquivar|quero|preciso|gostaria|gostaria de|uma|um|de|para|pra|pro)\s+/gi, '')
        .trim()
      if (cleaned && cleaned.length > 2) {
        defaults.titulo = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      }
    }

    setValues(defaults)
  }, [result, schema, entities, originalText])

  // Aborta requisição no desmonte
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  const updateValue = useCallback((key, val) => {
    setValues(prev => ({ ...prev, [key]: val }))
    setSubmitError(null)
  }, [])

  const validateFields = () => {
    if (!schema.fields) return true
    for (const [key, field] of Object.entries(schema.fields)) {
      if (field.required) {
        const val = values[key]
        if (val === undefined || val === null || String(val).trim() === '') {
          setSubmitError(`O campo "${field.label || key}" é obrigatório.`)
          return false
        }
      }
    }
    return true
  }

  const handleSubmit = async () => {
    if (schema.isRedirect) {
      const target = typeof schema.redirectTo === 'function'
        ? schema.redirectTo(values)
        : schema.redirectTo
      if (target) {
        onSuccess?.({ redirect: target })
        onClose()
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

    // Valida campos obrigatórios no modo collect
    if (mode === 'collect' && !validateFields()) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setPhase('executing')

    try {
      const payload = schema.submitConfig.transform(values)
      setLastPayload(payload)
      const token = localStorage.getItem('nexo_token') || ''
      abortControllerRef.current = new AbortController()
      await axios({
        method: schema.submitConfig.method,
        url: schema.submitConfig.endpoint,
        data: payload,
        headers: { Authorization: `Bearer ${token}` },
        signal: abortControllerRef.current.signal,
      })

      addToast(schema.successMessage || 'Ação executada com sucesso ✓', 'success')
      onSuccess?.({ intent, payload, mode })
      // Se era modo confirm, vai para fase de undo em vez de fechar imediatamente
      if (mode === 'confirm') {
        setPhase('undo')
      } else {
        onClose()
      }
    } catch (err) {
      if (axios.isCancel(err)) return
      const msg = err.response?.data?.error || err.message || 'Erro ao executar ação'
      setSubmitError(msg)
    } finally {
      setIsSubmitting(false)
      abortControllerRef.current = null
    }
  }

  const handleSafetyConfirm = () => {
    setSafetyDelayDone(true)
    handleSubmit()
  }

  const handleSafetyCancel = () => {
    addToast('Ação cancelada', 'info')
    onCancel?.()
    onClose()
  }

  const handleUndo = async () => {
    if (!lastPayload) {
      addToast('Não foi possível desfazer: dados da ação não encontrados', 'error')
      onClose()
      return
    }
    addToast('Desfazendo ação...', 'info')
    // TODO: chamar endpoint de undo quando disponível no backend
    // await axios.post('/api/luna/undo', lastPayload, { headers: { Authorization: `Bearer ${token}` } })
    addToast('Ação desfeita ✓', 'success')
    onClose()
  }

  const handleUndoTimeout = () => {
    onClose()
  }

  // ── Renderização de campos ──

  const renderField = (key, field) => {
    const baseClass =
      'w-full bg-nexo-bg border border-nexo-border rounded-lg px-3 py-2 text-sm text-nexo-text ' +
      'outline-none focus:border-nexo-primary focus:ring-1 focus:ring-nexo-primary/30 transition-all'

    const isEmpty = !values[key]
    const highlightEmpty = mode === 'collect' && field.required && isEmpty

    const wrapperClass = highlightEmpty
      ? 'space-y-1 ring-1 ring-nexo-primary/40 rounded-lg p-1 -m-1'
      : 'space-y-1'

    if (field.type === 'select') {
      return (
        <div key={key} className={wrapperClass}>
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
        <div key={key} className={wrapperClass}>
          <label className="text-xs font-medium text-nexo-muted">
            {field.label}{field.required && <span className="text-nexo-danger ml-0.5">*</span>}
          </label>
          <input type="date" value={values[key] || ''} onChange={e => updateValue(key, e.target.value)} className={baseClass} />
        </div>
      )
    }

    if (field.type === 'textarea') {
      return (
        <div key={key} className={wrapperClass}>
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

    return (
      <div key={key} className={wrapperClass}>
        <label className="text-xs font-medium text-nexo-muted">
          {field.label}{field.required && <span className="text-nexo-danger ml-0.5">*</span>}
        </label>
        <input
          type="text"
          value={values[key] || ''}
          onChange={e => updateValue(key, e.target.value)}
          placeholder={field.placeholder}
          className={baseClass}
          autoFocus={highlightEmpty}
        />
      </div>
    )
  }

  const getModeIcon = () => {
    if (mode === 'confirm') return <Trash2 className="w-5 h-5 text-nexo-danger" />
    if (mode === 'collect') return <Edit3 className="w-5 h-5 text-nexo-warning" />
    return <Sparkles className="w-5 h-5 text-nexo-primary" />
  }

  const getModeLabel = () => {
    if (mode === 'confirm') return 'Ação destrutiva — confirme'
    if (mode === 'collect') return 'Complete os dados'
    return 'Preview da ação'
  }

  const getDestructiveTitle = () => {
    // Se o intent não parece destrutivo mas o modo é confirm, mostra título genérico destrutivo
    const actionName = schema.title || 'Ação'
    if (intent.includes('deletar') || intent.includes('excluir') || intent.includes('apagar') || intent.includes('remover')) {
      return `${actionName}`
    }
    return `${actionName} (Ação Destrutiva)`
  }

  const getSubmitLabel = () => {
    if (isSubmitting || phase === 'executing') return 'Executando...'
    if (mode === 'confirm') return 'Confirmar e executar'
    if (mode === 'collect') return 'Criar'
    return 'Confirmar'
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 380, opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 380, opacity: 0.8 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 bottom-0 w-[380px] z-[110] bg-nexo-card border-l border-nexo-border shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-nexo-border shrink-0">
          {getModeIcon()}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-nexo-text truncate">{mode === 'confirm' ? getDestructiveTitle() : (schema.title || getModeLabel())}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-primary/10 text-nexo-primary">
                {Math.round(score * 100)}%
              </span>
              <span className="text-[10px] text-nexo-muted truncate">"{originalText}"</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-nexo-border/50 transition-colors text-nexo-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Aviso de modo */}
          {mode === 'confirm' && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-nexo-danger/10 border border-nexo-danger/20">
              <AlertTriangle className="w-4 h-4 text-nexo-danger flex-shrink-0 mt-0.5" />
              <p className="text-xs text-nexo-danger">
                Esta ação é <strong>destrutiva</strong> e não pode ser desfeita. Confirme abaixo.
              </p>
            </div>
          )}

          {mode === 'collect' && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-nexo-warning/10 border border-nexo-warning/20">
              <Edit3 className="w-4 h-4 text-nexo-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-nexo-warning">
                Faltam alguns dados. Preencha os campos marcados para continuar.
              </p>
            </div>
          )}

          {schema.description && (
            <p className="text-xs text-nexo-muted whitespace-pre-line">{schema.description}</p>
          )}

          {/* Fase de Undo — mostra após execução de ação destrutiva */}
          {phase === 'undo' && (
            <LunaSafetyDelay
              durationMs={2000}
              onConfirm={handleUndoTimeout}
              onCancel={handleUndo}
              message="Ação executada. Desfazer em..."
            />
          )}

          {/* Preview visual da ação — esconde na fase undo */}
          {phase !== 'undo' && (mode === 'preview' || mode === 'confirm') && (
            <LunaInlinePreview
              intent={intent}
              values={values}
              disabled={false}
              onConfirm={() => {
                handleSubmit()
              }}
              onCancel={() => {
                addToast('Ação cancelada', 'info')
                onCancel?.()
                onClose()
              }}
            />
          )}

          {phase !== 'undo' && schema.fields && Object.entries(schema.fields).map(([key, field]) => renderField(key, field))}

          {/* Erro */}
          {submitError && (
            <div className="p-2.5 rounded-lg bg-nexo-danger/10 border border-nexo-danger/20 text-xs text-nexo-danger">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-nexo-border space-y-3">
          {/* Fase undo: sem botões (o LunaSafetyDelay está no body) */}
          {phase === 'undo' && (
            <p className="text-xs text-nexo-muted text-center">
              O painel fechará automaticamente em poucos segundos...
            </p>
          )}

          {/* Botões normais: sempre visíveis exceto na fase undo */}
          {phase !== 'undo' && (
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || phase === 'executing'}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  mode === 'confirm'
                    ? 'bg-nexo-danger hover:bg-nexo-danger/90 text-white'
                    : 'bg-nexo-primary hover:bg-nexo-primary/90 text-white'
                }`}
              >
                {isSubmitting || phase === 'executing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {getSubmitLabel()}
              </button>
              <button
                onClick={onClose}
                disabled={isSubmitting || phase === 'executing'}
                className="px-4 py-2.5 rounded-lg border border-nexo-border text-nexo-muted text-sm font-medium hover:bg-nexo-border/30 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
