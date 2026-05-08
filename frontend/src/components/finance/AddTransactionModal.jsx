import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CreditCard, Calendar, DollarSign, FileText, User } from 'lucide-react'

export default function AddTransactionModal({ paymentId, phases, onClose, onSaved }) {
  const [form, setForm] = useState({
    value: '',
    currency: 'EUR',
    date: new Date().toISOString().split('T')[0],
    method: 'transfer',
    paidBy: '',
    phase: phases[0]?.phase || 1,
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const payload = {
        date: form.date,
        amount: { value: parseFloat(form.value), currency: form.currency },
        method: form.method,
        paidBy: form.paidBy,
        phase: parseInt(form.phase),
        notes: form.notes
      }

      const res = await fetch(`/api/payments/${paymentId}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Erro ao salvar transacao')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-nexo-border">
          <h2 className="text-lg font-bold font-heading flex items-center gap-2">
            <CreditCard size={20} className="text-nexo-info" />
            Nova Transacao
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-nexo-card text-nexo-muted hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Valor + Moeda */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-nexo-muted mb-1.5">Valor</label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexo-muted" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.value}
                  onChange={e => handleChange('value', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-nexo-muted mb-1.5">Moeda</label>
              <select
                value={form.currency}
                onChange={e => handleChange('currency', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none"
              >
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
              </select>
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="block text-xs text-nexo-muted mb-1.5">Data</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexo-muted" />
              <input
                type="date"
                required
                value={form.date}
                onChange={e => handleChange('date', e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none"
              />
            </div>
          </div>

          {/* Metodo */}
          <div>
            <label className="block text-xs text-nexo-muted mb-1.5">Metodo</label>
            <select
              value={form.method}
              onChange={e => handleChange('method', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none"
            >
              <option value="card">Cartao</option>
              <option value="transfer">Transferencia</option>
              <option value="cash">Dinheiro</option>
              <option value="bizum">Bizum</option>
            </select>
          </div>

          {/* Quem pagou */}
          <div>
            <label className="block text-xs text-nexo-muted mb-1.5">Quem pagou</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexo-muted" />
              <input
                type="text"
                required
                value={form.paidBy}
                onChange={e => handleChange('paidBy', e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none"
                placeholder="Nome do pagador"
              />
            </div>
          </div>

          {/* Parcela */}
          {phases.length > 0 && (
            <div>
              <label className="block text-xs text-nexo-muted mb-1.5">Parcela / Fase</label>
              <select
                value={form.phase}
                onChange={e => handleChange('phase', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none"
              >
                {phases.map(p => (
                  <option key={p.phase} value={p.phase}>
                    Fase {p.phase} — {p.label} ({p.percent}%)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Observacoes */}
          <div>
            <label className="block text-xs text-nexo-muted mb-1.5">Observacoes</label>
            <div className="relative">
              <FileText size={14} className="absolute left-3 top-3 text-nexo-muted" />
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => handleChange('notes', e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none resize-none"
                placeholder="Notas sobre a transacao..."
              />
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-lg bg-nexo-danger/10 text-nexo-danger text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-nexo-card text-sm text-nexo-muted hover:text-white transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-nexo-info text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

