import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, DollarSign, Calendar, FileText, Repeat, Tag, Users, CheckSquare } from 'lucide-react'

const CATEGORIES = [
  { value: 'hosting', label: 'Hosting', color: '#e056fd' },
  { value: 'ai_tools', label: 'AI / Tools', color: '#686de0' },
  { value: 'software', label: 'Software', color: '#7bed9f' },
  { value: 'marketing', label: 'Marketing', color: '#ff6b81' },
  { value: 'others', label: 'Outros', color: '#95afc0' }
]

const PERIODS = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'annual', label: 'Anual' }
]

const PEOPLE = [
  { id: 'abner', name: 'Abner' },
  { id: 'nonoke', name: 'Nonoke' },
  { id: 'elias', name: 'Elias' }
]

export default function AddExpenseModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    value: '',
    currency: 'EUR',
    isRecurring: false,
    period: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    category: 'hosting',
    splitAmong: ['abner', 'nonoke', 'elias'],
    notes: '',
    autoDeduct: true
  })
  const [costPerPerson, setCostPerPerson] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const total = parseFloat(form.value) || 0
    const splitCount = form.splitAmong.length || 1
    setCostPerPerson(splitCount > 0 ? total / splitCount : 0)
  }, [form.value, form.splitAmong])

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const togglePerson = (personId) => {
    setForm(prev => ({
      ...prev,
      splitAmong: prev.splitAmong.includes(personId)
        ? prev.splitAmong.filter(id => id !== personId)
        : [...prev.splitAmong, personId]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const payload = {
        name: form.name,
        amount: { value: parseFloat(form.value), currency: form.currency },
        costPerPerson: { value: costPerPerson, currency: form.currency },
        type: form.isRecurring ? 'recurring' : 'one_time',
        period: form.isRecurring ? form.period : null,
        startDate: form.startDate,
        category: form.category,
        splitAmong: form.splitAmong,
        paidBy: Object.fromEntries(
          form.splitAmong.map(id => [id, { paid: false, amount: costPerPerson }])
        ),
        fullyPaid: false,
        autoDeductFromCashBox: form.autoDeduct,
        notes: form.notes
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('Erro ao salvar gasto')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const category = CATEGORIES.find(c => c.value === form.category)

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
            <DollarSign size={20} className="text-nexo-info" />
            Novo Gasto
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-nexo-card text-nexo-muted hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs text-nexo-muted mb-1.5">Nome</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none"
              placeholder="Ex: Hostinger Premium"
            />
          </div>

          {/* Valor + Moeda */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-nexo-muted mb-1.5">Valor total</label>
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

          {/* Recorrente? */}
          <div>
            <label className="block text-xs text-nexo-muted mb-2">Esse gasto e recorrente?</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleChange('isRecurring', false)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm border transition-all ${
                  !form.isRecurring
                    ? 'border-nexo-info bg-nexo-info/10 text-nexo-info'
                    : 'border-nexo-border bg-nexo-card text-nexo-muted'
                }`}
              >
                Nao, e unico
              </button>
              <button
                type="button"
                onClick={() => handleChange('isRecurring', true)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm border transition-all flex items-center justify-center gap-2 ${
                  form.isRecurring
                    ? 'border-nexo-info bg-nexo-info/10 text-nexo-info'
                    : 'border-nexo-border bg-nexo-card text-nexo-muted'
                }`}
              >
                <Repeat size={14} />
                Sim, recorrente
              </button>
            </div>
          </div>

          {/* Se recorrente: Periodicidade */}
          <AnimatePresence>
            {form.isRecurring && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pb-1">
                  <div>
                    <label className="block text-xs text-nexo-muted mb-1.5">Periodicidade</label>
                    <select
                      value={form.period}
                      onChange={e => handleChange('period', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none"
                    >
                      {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Data de inicio */}
          <div>
            <label className="block text-xs text-nexo-muted mb-1.5">Data de inicio</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexo-muted" />
              <input
                type="date"
                required
                value={form.startDate}
                onChange={e => handleChange('startDate', e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none"
              />
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-xs text-nexo-muted mb-1.5">Categoria</label>
            <div className="relative">
              <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexo-muted" />
              <select
                value={form.category}
                onChange={e => handleChange('category', e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm focus:border-nexo-info focus:outline-none"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-nexo-muted">Categoria selecionada:</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: category.color + '20', color: category.color }}>
                {category.label}
              </span>
            </div>
          </div>

          {/* Dividir entre */}
          <div>
            <label className="block text-xs text-nexo-muted mb-2 flex items-center gap-1.5">
              <Users size={12} />
              Dividir entre
            </label>
            <div className="flex gap-3">
              {PEOPLE.map(person => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => togglePerson(person.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                    form.splitAmong.includes(person.id)
                      ? 'border-nexo-success bg-nexo-success/10 text-nexo-success'
                      : 'border-nexo-border bg-nexo-card text-nexo-muted'
                  }`}
                >
                  <CheckSquare size={14} className={form.splitAmong.includes(person.id) ? 'opacity-100' : 'opacity-40'} />
                  {person.name}
                </button>
              ))}
            </div>
          </div>

          {/* Custo por pessoa (auto) */}
          <div className="p-3 rounded-lg bg-nexo-card border border-nexo-border">
            <div className="flex items-center justify-between">
              <span className="text-xs text-nexo-muted">Custo por pessoa (auto-calculado)</span>
              <span className="text-sm font-bold">
                {form.currency === 'EUR' ? '€' : 'R$'} {costPerPerson.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-xs text-nexo-muted mt-1">
              {form.value ? `${form.value} / ${form.splitAmong.length} pessoa(s)` : 'Informe o valor total'}
            </div>
          </div>

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
                placeholder="Notas sobre o gasto..."
              />
            </div>
          </div>

          {/* Deduzir do caixa */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleChange('autoDeduct', !form.autoDeduct)}
              className={`w-10 h-6 rounded-full transition-all relative ${form.autoDeduct ? 'bg-nexo-info' : 'bg-nexo-border'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.autoDeduct ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
            <span className="text-sm text-nexo-muted">Deduzir do caixa automaticamente</span>
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
              disabled={saving || form.splitAmong.length === 0}
              className="px-4 py-2 rounded-lg bg-nexo-info text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Gasto'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

