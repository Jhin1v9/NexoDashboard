import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Trash2, Euro, Mail, Phone, Tag, UserCheck } from 'lucide-react'

const PIPELINE_COLUMNS = [
  { id: 'novo', label: 'Novo', color: '#6B7280', icon: '🔵' },
  { id: 'contatado', label: 'Contatado', color: '#3B82F6', icon: '📞' },
  { id: 'proposta_enviada', label: 'Proposta', color: '#F59E0B', icon: '📄' },
  { id: 'negociacao', label: 'Negociacao', color: '#8B5CF6', icon: '🤝' },
  { id: 'ganho', label: 'Ganho', color: '#22C55E', icon: '✅' },
  { id: 'perdido', label: 'Perdido', color: '#EF4444', icon: '❌' },
]

const FOUNDERS = [
  { id: 'abner', name: 'Abner', color: '#3742fa', emoji: '🧠' },
  { id: 'enoque', name: 'Enoque', color: '#2ed573', emoji: '⚡' },
  { id: 'elias', name: 'Elias', color: '#ffa502', emoji: '🎯' },
]

export default function LeadModal({ lead, onClose, onSave, onDelete, onConvert, isConverting }) {
  const [editMode, setEditMode] = useState(!lead)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    displayName: lead?.displayName || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    source: lead?.source || 'referral',
    pipelineStatus: lead?.pipelineStatus || 'novo',
    estimatedValue: lead?.estimatedValue || '',
    notes: lead?.notes || '',
    assignedTo: lead?.assignedTo || '',
    tags: lead?.tags?.join(', ') || ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSave({
        ...form,
        estimatedValue: Number(form.estimatedValue) || 0,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean)
      })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao salvar lead')
    } finally {
      setIsSubmitting(false)
    }
  }

  const founder = FOUNDERS.find(f => f.id === lead?.assignedTo)
  const statusCol = PIPELINE_COLUMNS.find(c => c.id === lead?.pipelineStatus)

  const renderViewMode = () => (
    <div className="p-4 space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{statusCol?.icon}</span>
          <div>
            <div className="text-sm font-medium">{statusCol?.label || lead?.pipelineStatus}</div>
            <div className="text-[10px] text-nexo-muted uppercase tracking-wider">Status</div>
          </div>
        </div>
        {founder && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: founder.color + '30', color: founder.color }}>
              {founder.emoji}
            </div>
            <div>
              <div className="text-sm font-medium">{founder.name}</div>
              <div className="text-[10px] text-nexo-muted uppercase tracking-wider">Responsável</div>
            </div>
          </div>
        )}
        {lead?.estimatedValue > 0 && (
          <div className="flex items-center gap-2">
            <Euro size={18} className="text-nexo-success" />
            <div>
              <div className="text-sm font-medium">€{lead.estimatedValue.toLocaleString('pt-BR')}</div>
              <div className="text-[10px] text-nexo-muted uppercase tracking-wider">Valor Estimado</div>
            </div>
          </div>
        )}
        {lead?.email && (
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-nexo-info" />
            <div>
              <div className="text-sm font-medium">{lead.email}</div>
              <div className="text-[10px] text-nexo-muted uppercase tracking-wider">Email</div>
            </div>
          </div>
        )}
        {lead?.phone && (
          <div className="flex items-center gap-2">
            <Phone size={18} className="text-nexo-info" />
            <div>
              <div className="text-sm font-medium">{lead.phone}</div>
              <div className="text-[10px] text-nexo-muted uppercase tracking-wider">Telefone</div>
            </div>
          </div>
        )}
        {lead?.source && (
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-nexo-muted" />
            <div>
              <div className="text-sm font-medium capitalize">{lead.source.replace(/-/g, ' ')}</div>
              <div className="text-[10px] text-nexo-muted uppercase tracking-wider">Fonte</div>
            </div>
          </div>
        )}
        {lead?.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {lead.tags.map((tag, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-nexo-primary/20 text-nexo-primary">{tag}</span>
            ))}
          </div>
        )}
        {lead?.notes && (
          <div className="glass-card p-3 rounded-lg">
            <div className="text-[10px] text-nexo-muted uppercase tracking-wider mb-1">Notas</div>
            <p className="text-sm text-nexo-text whitespace-pre-wrap">{lead.notes}</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderEditMode = () => (
    <form onSubmit={handleSubmit} className="p-4 space-y-3">
      <div>
        <label className="text-xs text-nexo-muted block mb-1">Nome *</label>
        <input
          required
          value={form.displayName}
          onChange={e => setForm({ ...form, displayName: e.target.value })}
          className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-nexo-muted block mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary"
          />
        </div>
        <div>
          <label className="text-xs text-nexo-muted block mb-1">Telefone</label>
          <input
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-nexo-muted block mb-1">Fonte</label>
          <select
            value={form.source}
            onChange={e => setForm({ ...form, source: e.target.value })}
            className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary"
          >
            <option value="referral">Indicação</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="instagram">Instagram</option>
            <option value="prospeccao-interna">Prospecção Interna</option>
            <option value="lead-detectado">Detectado pela Luna</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-nexo-muted block mb-1">Status</label>
          <select
            value={form.pipelineStatus}
            onChange={e => setForm({ ...form, pipelineStatus: e.target.value })}
            className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary"
          >
            {PIPELINE_COLUMNS.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-nexo-muted block mb-1">Valor Estimado (€)</label>
          <input
            type="number"
            value={form.estimatedValue}
            onChange={e => setForm({ ...form, estimatedValue: e.target.value })}
            className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary"
          />
        </div>
        <div>
          <label className="text-xs text-nexo-muted block mb-1">Responsável</label>
          <select
            value={form.assignedTo}
            onChange={e => setForm({ ...form, assignedTo: e.target.value })}
            className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary"
          >
            <option value="">Não atribuído</option>
            {FOUNDERS.map(f => (
              <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-nexo-muted block mb-1">Tags (separadas por vírgula)</label>
        <input
          value={form.tags}
          onChange={e => setForm({ ...form, tags: e.target.value })}
          placeholder="site, ecommerce, urgente"
          className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary"
        />
      </div>
      <div>
        <label className="text-xs text-nexo-muted block mb-1">Notas</label>
        <textarea
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary resize-none"
        />
      </div>
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 text-nexo-muted hover:text-nexo-text text-sm transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !form.displayName.trim()}
          className="px-4 py-2 bg-nexo-primary rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Salvando...' : (lead ? 'Salvar' : 'Criar Lead')}
        </button>
      </div>
    </form>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg bg-nexo-card border border-nexo-border rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-nexo-border flex items-center justify-between">
          <h3 className="font-semibold">{lead ? lead.displayName : 'Novo Lead'}</h3>
          <div className="flex items-center gap-2">
            {lead && (
              <button
                onClick={() => onDelete(lead.id)}
                className="text-nexo-danger hover:opacity-80 text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-nexo-danger/10"
              >
                <Trash2 size={14} /> Apagar
              </button>
            )}
            {lead && (
              <button
                onClick={() => setEditMode(!editMode)}
                className="text-nexo-primary hover:opacity-80 text-xs px-2 py-1 rounded hover:bg-nexo-primary/10"
              >
                {editMode ? 'Ver' : 'Editar'}
              </button>
            )}
            {lead && lead.pipelineStatus !== 'ganho' && onConvert && (
              <button
                onClick={() => {
                  if (confirm('Converter este lead em cliente? Isso criará um workspace.')) {
                    onConvert(lead.id)
                  }
                }}
                disabled={isConverting}
                className="text-nexo-success hover:opacity-80 text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-nexo-success/10 disabled:opacity-50"
              >
                <UserCheck size={14} />
                {isConverting ? 'Convertendo...' : 'Converter'}
              </button>
            )}
            <button onClick={onClose} className="text-nexo-muted hover:text-nexo-text">
              <X size={18} />
            </button>
          </div>
        </div>
        {lead && !editMode ? renderViewMode() : renderEditMode()}
      </motion.div>
    </motion.div>
  )
}
