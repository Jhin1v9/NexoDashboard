import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Lightbulb, Brain, FileText, Workflow, FilePlus,
  Sparkles, ChevronRight, Building2
} from 'lucide-react'
import axios from 'axios'

const TEMPLATES = [
  {
    id: 'proposta-comercial',
    name: 'Proposta Comercial',
    description: 'Estrutura para propostas formais com escopo, investimento e prazos.',
    icon: FileText,
    color: 'bg-nexo-info/20 text-nexo-info',
    borderColor: 'hover:border-nexo-info/50'
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Livre e criativo. Sem estrutura rigida, ideal para explorar possibilidades.',
    icon: Brain,
    color: 'bg-nexo-warning/20 text-nexo-warning',
    borderColor: 'hover:border-nexo-warning/50'
  },
  {
    id: 'prd',
    name: 'PRD',
    description: 'Product Requirements Document com objetivos, requisitos e criterios de aceite.',
    icon: FileText,
    color: 'bg-nexo-success/20 text-nexo-success',
    borderColor: 'hover:border-nexo-success/50'
  },
  {
    id: 'pipeline',
    name: 'Pipeline',
    description: 'Fluxo de implementacao com etapas, dependencias e entregaveis.',
    icon: Workflow,
    color: 'bg-nexo-primary/20 text-nexo-primary',
    borderColor: 'hover:border-nexo-primary/50'
  },
  {
    id: 'blank',
    name: 'Em Branco',
    description: 'Comece do zero com uma ideia totalmente livre.',
    icon: FilePlus,
    color: 'bg-gray-500/20 text-gray-400',
    borderColor: 'hover:border-gray-500/50'
  }
]

const VALID_TYPES = [
  { value: 'proposta-comercial', label: 'Proposta Comercial' },
  { value: 'brainstorm', label: 'Brainstorm' },
  { value: 'prd', label: 'PRD' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'outro', label: 'Outro' }
]

const VALID_PRIORITIES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'M\u00e9dia' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' }
]

export default function IdeaQuickAdd({ onClose, onCreated }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [type, setType] = useState('proposta-comercial')
  const [priority, setPriority] = useState('media')
  const [clientName, setClientName] = useState('')
  const [tags, setTags] = useState('')

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl.id)
    setType(tpl.id === 'blank' ? 'outro' : tpl.id)
    setStep(2)
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        type,
        priority,
        status: 'rascunho',
        linkedTo: clientName.trim() ? { clientName: clientName.trim() } : undefined,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean)
      }
      const res = await axios.post('/api/ideas', payload)
      if (res.data.success) {
        onCreated?.()
        navigate(`/ideias/${res.data.data.idea.id}`)
      }
    } catch (err) {
      console.error('[IdeaQuickAdd] create error:', err)
      alert('Erro ao criar ideia: ' + (err.response?.data?.message || err.message))
    } finally {
      setSaving(false)
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-nexo-border shadow-2xl"
      >
        {/* Header */}
        <div className="p-4 border-b border-nexo-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-nexo-primary/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-nexo-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-nexo-text">
                {step === 1 ? 'Nova Ideia' : 'Preencher Detalhes'}
              </h2>
              <p className="text-[11px] text-nexo-muted">
                {step === 1 ? 'Escolha um template para comecar' : `Template: ${TEMPLATES.find(t => t.id === selectedTemplate)?.name || 'Em Branco'}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-nexo-card rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-nexo-muted" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-2"
              >
                {TEMPLATES.map(tpl => {
                  const Icon = tpl.icon
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border border-nexo-border ${tpl.borderColor} bg-nexo-bg/50 hover:bg-nexo-card transition-all text-left group`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${tpl.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm text-nexo-text">{tpl.name}</h3>
                          <ChevronRight className="w-3.5 h-3.5 text-nexo-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[11px] text-nexo-muted mt-0.5 leading-relaxed">{tpl.description}</p>
                      </div>
                    </button>
                  )
                })}
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                {/* Title */}
                <div>
                  <label className="text-[11px] text-nexo-muted uppercase tracking-wide mb-1 block">
                    Titulo da Ideia *
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && title.trim() && handleSubmit()}
                    placeholder="Ex: Nova funcionalidade de dashboard..."
                    autoFocus
                    className="w-full px-3 py-2.5 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm text-nexo-text placeholder:text-nexo-muted/50 transition-colors"
                  />
                </div>

                {/* Type + Priority row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-nexo-muted uppercase tracking-wide mb-1 block">Tipo</label>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value)}
                      className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm text-nexo-text"
                    >
                      {VALID_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-nexo-muted uppercase tracking-wide mb-1 block">Prioridade</label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value)}
                      className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm text-nexo-text"
                    >
                      {VALID_PRIORITIES.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Client */}
                <div>
                  <label className="text-[11px] text-nexo-muted uppercase tracking-wide mb-1 block flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Cliente (opcional)
                  </label>
                  <input
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="Nome do cliente..."
                    className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm text-nexo-text placeholder:text-nexo-muted/50 transition-colors"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="text-[11px] text-nexo-muted uppercase tracking-wide mb-1 block">Tags (separadas por virgula)</label>
                  <input
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    placeholder="ex: frontend, urgente, v2"
                    className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm text-nexo-text placeholder:text-nexo-muted/50 transition-colors"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-nexo-border flex items-center justify-between">
          {step === 2 ? (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-3 py-2 text-xs text-nexo-muted hover:text-nexo-text hover:bg-nexo-card rounded-lg transition-colors"
              >
                Voltar
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-2 text-xs text-nexo-muted hover:bg-nexo-card rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!title.trim() || saving}
                  className="px-4 py-2 bg-nexo-primary text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-3.5 h-3.5" />
                      Criar Ideia
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="ml-auto">
              <button
                onClick={() => handleSelectTemplate(TEMPLATES.find(t => t.id === 'blank'))}
                className="px-4 py-2 text-xs text-nexo-muted hover:text-nexo-text hover:bg-nexo-card rounded-lg transition-colors"
              >
                Pular e ir em branco
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
