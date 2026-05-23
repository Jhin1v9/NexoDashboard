import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader2 } from 'lucide-react'

/**
 * SmartFormModal — Modal dinâmico para coletar dados faltantes de ações da Luna
 *
 * Recebe do backend:
 * {
 *   title: 'Enviar Email',
 *   description: 'Preencha os dados abaixo...',
 *   actionType: 'enviar_email',
 *   missingFields: [
 *     { name: 'para', label: 'Destinatário', type: 'email', required: true },
 *     { name: 'assunto', label: 'Assunto', type: 'text', required: true },
 *     { name: 'mensagem', label: 'Mensagem', type: 'textarea', required: false }
 *   ],
 *   partialParams: { to: null, subject: null }
 * }
 */

export default function SmartFormModal({ smartForm, onSubmit, onCancel }) {
  const { title, description, actionType, missingFields, partialParams } = smartForm || {}
  const [values, setValues] = useState(() => {
    const init = {}
    missingFields?.forEach(f => {
      init[f.name] = partialParams?.[f.name] || partialParams?.[f.label?.toLowerCase()] || ''
    })
    return init
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }))
  }

  const validate = () => {
    const newErrors = {}
    missingFields?.forEach(f => {
      if (f.required && !values[f.name]?.trim()) {
        newErrors[f.name] = `${f.label} é obrigatório`
      }
      if (f.type === 'email' && values[f.name]?.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(values[f.name].trim())) {
          newErrors[f.name] = 'Email inválido'
        }
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await onSubmit({ actionType, params: { ...partialParams, ...values } })
    } finally {
      setSubmitting(false)
    }
  }

  if (!smartForm) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,22,0.99) 0%, rgba(8,8,12,0.99) 100%)',
            border: '1px solid rgba(0,240,255,0.15)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(0,240,255,0.05)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-nexo-border/60">
            <div>
              <h3 className="text-sm font-bold text-nexo-text">{title}</h3>
              {description && (
                <p className="text-[11px] text-nexo-muted mt-0.5">{description}</p>
              )}
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg hover:bg-white/5 text-nexo-muted hover:text-nexo-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {missingFields?.map(field => (
              <div key={field.name}>
                <label className="block text-[11px] font-medium text-nexo-muted mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    value={values[field.name] || ''}
                    onChange={e => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder || ''}
                    rows={field.rows || 3}
                    className={`w-full px-3 py-2 bg-nexo-card border rounded-lg text-sm text-nexo-text placeholder:text-nexo-muted/40 focus:outline-none focus:border-nexo-primary/50 focus:ring-1 focus:ring-nexo-primary/20 transition-all resize-none ${
                      errors[field.name] ? 'border-red-500/50' : 'border-nexo-border'
                    }`}
                  />
                ) : (
                  <input
                    type={field.type === 'email' ? 'email' : 'text'}
                    value={values[field.name] || ''}
                    onChange={e => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className={`w-full px-3 py-2 bg-nexo-card border rounded-lg text-sm text-nexo-text placeholder:text-nexo-muted/40 focus:outline-none focus:border-nexo-primary/50 focus:ring-1 focus:ring-nexo-primary/20 transition-all ${
                      errors[field.name] ? 'border-red-500/50' : 'border-nexo-border'
                    }`}
                  />
                )}

                {errors[field.name] && (
                  <p className="text-[10px] text-red-400 mt-1">{errors[field.name]}</p>
                )}
              </div>
            ))}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-medium text-nexo-muted hover:text-nexo-text rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-nexo-primary text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
