import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Clock, ArrowUpRight, ArrowDownRight,
  Plus, Trash2, Edit2, RefreshCw, X, ChevronDown, ChevronUp, Banknote
} from 'lucide-react'
import axios from 'axios'
import PaymentModal from '../components/PaymentModal.jsx'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import useRealtime from '../hooks/useRealtime'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card p-3 border border-nexo-border">
      <p className="text-xs text-nexo-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: € {p.value?.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  )
}

const projectionMonths = (projection) => {
  if (Array.isArray(projection?.months)) return projection.months
  if (Array.isArray(projection?.projection)) return projection.projection
  return []
}

export default function Caixa() {
  const { data: cashBox, loading: loadingCash, error: errorCash, refetch: refetchCashBox } = useRealtime('/api/cash-box', 30000)
  const { data: projection, loading: loadingProj, error: errorProj } = useRealtime('/api/cash-box/projection', 30000)
  const [editValues, setEditValues] = useState({ balance: '', monthlyIncome: '', monthlyExpenses: '' })
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' | 'edit'
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({ type: 'income', amount: '', description: '', category: 'manual', date: '', note: '' })
  const [crudLoading, setCrudLoading] = useState(false)
  const [expandedRows, setExpandedRows] = useState({})

  const openCreate = () => {
    setModalMode('create')
    setEditingId(null)
    setFormData({ type: 'income', amount: '', description: '', category: 'manual', date: new Date().toISOString().slice(0,10), note: '' })
    setShowModal(true)
  }

  const toggleExpandRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const openEdit = (entry) => {
    setModalMode('edit')
    setEditingId(entry.id)
    setFormData({
      type: entry.type || 'income',
      amount: String(entry.amount || ''),
      description: entry.description || entry.source || '',
      category: entry.category || 'manual',
      date: entry.date || new Date().toISOString().slice(0,10),
      note: entry.note || ''
    })
    setShowModal(true)
  }

  const submitEntry = async () => {
    setCrudLoading(true)
    try {
      const payload = {
        type: formData.type,
        amount: parseFloat(formData.amount),
        description: formData.description,
        category: formData.category,
        date: formData.date,
        note: formData.note
      }
      if (modalMode === 'create') {
        await fetch('/api/cash-box/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      } else {
        await fetch(`/api/cash-box/entries/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      setShowModal(false)
      window.location.reload()
    } catch (e) {
      alert(e.message)
    } finally {
      setCrudLoading(false)
    }
  }

  const deleteEntry = async (id) => {
    if (!confirm('Remover esta entrada? (será marcada como inativa)')) return
    try {
      await fetch(`/api/cash-box/entries/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } })
      window.location.reload()
    } catch (e) {
      alert(e.message)
    }
  }

  const reconcile = async () => {
    if (!confirm('Recalcular saldo a partir do histórico?')) return
    try {
      await fetch('/api/cash-box/reconcile', { method: 'POST' })
      window.location.reload()
    } catch (e) {
      alert(e.message)
    }
  }

  const balance = cashBox?.balance?.value || 0
  const currency = cashBox?.balance?.currency || 'EUR'
  const monthlyIncome = cashBox?.monthlyIncome?.value || 0
  const monthlyExpenses = cashBox?.monthlyExpenses?.value || 0
  const history = cashBox?.history || []
  const alerts = cashBox?.alerts || []
  const incoming = cashBox?.incomingPayments || []
  const outgoing = cashBox?.outgoingExpenses || []

  const projectionData = useMemo(() => {
    return projectionMonths(projection).map(m => ({
      name: m.label || m.monthLabel,
      saldo: m.balance ?? m.projectedBalance ?? 0,
      eventos: m.events?.length || 0
    }))
  }, [projection])

  const historyData = useMemo(() => {
    if (!history.length) return []
    return history.map(h => ({
      name: new Date(h.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
      saldo: h.balanceAfter
    }))
  }, [history])

  const combinedChartData = useMemo(() => {
    // Junta historico + projecao para o grafico unico
    const hist = historyData.map(d => ({ ...d, tipo: 'real' }))
    const proj = projectionData.map(d => ({ ...d, tipo: 'proj' }))
    return [...hist, ...proj]
  }, [historyData, projectionData])

  const isLow = balance < (monthlyExpenses * (cashBox?.settings?.lowBalanceMultiplier || 2))
  const saveCashBox = async () => {
    setSaving(true)
    try {
      const payload = {
        balance: editValues.balance === '' ? balance : Number(editValues.balance),
        monthlyIncome: editValues.monthlyIncome === '' ? monthlyIncome : Number(editValues.monthlyIncome),
        monthlyExpenses: editValues.monthlyExpenses === '' ? monthlyExpenses : Number(editValues.monthlyExpenses),
        currency
      }
      const res = await axios.put('/api/cash-box', payload)
      if (!res.data) throw new Error('Erro ao salvar caixa')
      setEditValues({ balance: '', monthlyIncome: '', monthlyExpenses: '' })
      await refetchCashBox()
    } catch (e) {
      alert('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Caixa & Projecao</h1>
        <span className="text-xs text-nexo-muted">
          Atualizado: {cashBox?.lastUpdated ? new Date(cashBox.lastUpdated).toLocaleString('pt-BR') : '---'}
        </span>
      </div>

      {/* Caixa Atual */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: isLow ? '#ff475720' : '#2ed57320' }}>
            <Wallet size={24} style={{ color: isLow ? '#ff4757' : '#2ed573' }} />
          </div>
          <div>
            <div className="text-sm text-nexo-muted">SALDO ATUAL</div>
            <div className="text-3xl font-bold font-heading">
              {currency === 'EUR' ? '€' : 'R$'} {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          {isLow && (
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nexo-danger/10 text-nexo-danger text-xs">
              <AlertTriangle size={14} />
              Caixa baixo
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <label className="text-xs text-nexo-muted">
            Saldo editável
            <input
              type="number"
              step="0.01"
              value={editValues.balance}
              onChange={e => setEditValues(v => ({ ...v, balance: e.target.value }))}
              placeholder={String(balance)}
              className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm text-nexo-text"
            />
          </label>
          <label className="text-xs text-nexo-muted">
            Receitas/mês
            <input
              type="number"
              step="0.01"
              value={editValues.monthlyIncome}
              onChange={e => setEditValues(v => ({ ...v, monthlyIncome: e.target.value }))}
              placeholder={String(monthlyIncome)}
              className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm text-nexo-text"
            />
          </label>
          <label className="text-xs text-nexo-muted">
            Gastos/mês
            <input
              type="number"
              step="0.01"
              value={editValues.monthlyExpenses}
              onChange={e => setEditValues(v => ({ ...v, monthlyExpenses: e.target.value }))}
              placeholder={String(monthlyExpenses)}
              className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm text-nexo-text"
            />
          </label>
          <button
            onClick={saveCashBox}
            disabled={saving}
            className="self-end h-10 rounded-md bg-nexo-info px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar caixa'}
          </button>
        </div>

        {/* Mini resumo */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#2ed57310' }}>
            <div className="text-xs text-nexo-success mb-1">Receitas/mes</div>
            <div className="text-lg font-bold text-nexo-success">€ {monthlyIncome.toLocaleString('pt-BR')}</div>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#ff475710' }}>
            <div className="text-xs text-nexo-danger mb-1">Gastos/mes</div>
            <div className="text-lg font-bold text-nexo-danger">€ {monthlyExpenses.toLocaleString('pt-BR')}</div>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#3742fa10' }}>
            <div className="text-xs text-nexo-info mb-1">Projecao 3m</div>
            <div className="text-lg font-bold text-nexo-info">
              € {(cashBox?.projectedBalance?.value || 0).toLocaleString('pt-BR')}
            </div>
          </div>
        </div>

        {/* Grafico historico */}
        {historyData.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="name" tick={{ fill: '#6c757d', fontSize: 11 }} axisLine={{ stroke: '#1a1a2e' }} />
                <YAxis tick={{ fill: '#6c757d', fontSize: 11 }} axisLine={{ stroke: '#1a1a2e' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke="#6c5ce7"
                  strokeWidth={2}
                  dot={{ fill: '#6c5ce7', r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Saldo"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabela de Histórico + CRUD */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-nexo-muted">HISTÓRICO DE MOVIMENTAÇÕES</h3>
            <div className="flex items-center gap-2">
              <button onClick={reconcile} className="px-3 py-1.5 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border flex items-center gap-1">
                <RefreshCw size={12} /> Reconciliar
              </button>
              <button onClick={() => setShowPaymentModal(true)} className="px-3 py-1.5 bg-nexo-success rounded-lg text-xs hover:opacity-90 flex items-center gap-1">
                <Banknote size={12} /> Novo Pagamento
              </button>
              <button onClick={openCreate} className="px-3 py-1.5 bg-nexo-primary rounded-lg text-xs hover:opacity-90 flex items-center gap-1">
                <Plus size={12} /> Nova Entrada
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-nexo-muted border-b border-nexo-border">
                  <th className="text-left py-2 px-2">Data</th>
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-left py-2 px-2">Descrição</th>
                  <th className="text-right py-2 px-2">Valor</th>
                  <th className="text-right py-2 px-2">Saldo</th>
                  <th className="text-center py-2 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h) => (
                  <>
                    <tr key={h.id} className={`border-b border-nexo-border/50 ${h.isActive === false ? 'opacity-40 line-through' : ''}`}>
                      <td className="py-2 px-2 text-nexo-text">{h.date}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          h.type === 'payment_received' ? 'bg-amber-500/20 text-amber-400' :
                          h.type === 'income' ? 'bg-nexo-success/20 text-nexo-success' :
                          h.type === 'expense' ? 'bg-nexo-danger/20 text-nexo-danger' :
                          'bg-nexo-info/20 text-nexo-info'
                        }`}>
                          {h.type === 'payment_received' ? 'Pagamento' : h.type === 'income' ? 'Receita' : h.type === 'expense' ? 'Despesa' : 'Ajuste'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-nexo-text">
                        <div className="flex items-center gap-1">
                          {h.description || h.source}
                          {h.type === 'payment_received' && (
                            <button onClick={() => toggleExpandRow(h.id)} className="p-0.5 hover:bg-nexo-border rounded">
                              {expandedRows[h.id] ? <ChevronUp size={12} className="text-nexo-muted" /> : <ChevronDown size={12} className="text-nexo-muted" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-medium" style={{ color: h.type === 'payment_received' ? '#fbbf24' : h.type === 'income' ? '#2ed573' : '#ff4757' }}>
                        {h.type === 'payment_received' ? '+' : h.type === 'income' ? '+' : '-'}€ {h.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 text-right text-nexo-muted">€ {h.balanceAfter?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(h)} className="p-1 hover:bg-nexo-border rounded"><Edit2 size={12} className="text-nexo-info" /></button>
                          <button onClick={() => deleteEntry(h.id)} className="p-1 hover:bg-nexo-border rounded"><Trash2 size={12} className="text-nexo-danger" /></button>
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {h.type === 'payment_received' && expandedRows[h.id] && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-b border-nexo-border/30"
                        >
                          <td colSpan={6} className="px-4 py-3">
                            <div className="bg-nexo-card/50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-nexo-muted">DISTRIBUIÇÃO</span>
                                {h.distribution?.appliedAt ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-nexo-success/20 text-nexo-success">Aplicada</span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-nexo-warning/20 text-nexo-warning">Pendente</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {h.distribution?.splits?.map(split => (
                                  <div key={split.recipientId} className="flex items-center justify-between p-2 rounded bg-nexo-card">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs">{split.avatarEmoji || '👤'}</span>
                                      <span className="text-xs text-nexo-text">{split.name}</span>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xs font-medium text-nexo-text">
                                        € {split.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </div>
                                      <div className="text-[10px] text-nexo-muted">{split.percentage}%</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {!h.distribution?.appliedAt && (
                                <button
                                  onClick={async () => {
                                    if (!confirm('Aplicar distribuição e gerar saídas de pagamento?')) return
                                    try {
                                      const res = await fetch(`/api/cash-box/payments/${h.id}/apply-distribution`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                                      const data = await res.json()
                                      if (data.success) window.location.reload()
                                      else alert(data.error)
                                    } catch (e) { alert(e.message) }
                                  }}
                                  className="mt-2 w-full py-1.5 rounded bg-nexo-success text-xs font-medium text-white hover:opacity-90"
                                >
                                  Aplicar Split
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Projecao 6 Meses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h2 className="text-sm font-medium text-nexo-muted mb-4 flex items-center gap-2">
          <TrendingUp size={16} />
          PROJECAO DE CAIXA (6 meses)
        </h2>

        {projectionData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
                <XAxis dataKey="name" tick={{ fill: '#6c757d', fontSize: 11 }} axisLine={{ stroke: '#1a1a2e' }} />
                <YAxis tick={{ fill: '#6c757d', fontSize: 11 }} axisLine={{ stroke: '#1a1a2e' }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="#ff4757" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke="#2ed573"
                  strokeWidth={2}
                  dot={{ fill: '#2ed573', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  name="Saldo projetado"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center text-nexo-muted text-sm py-8">
            Nenhuma projecao disponivel
          </div>
        )}

        {/* Eventos anotados */}
        {projectionMonths(projection).some(m => m.events?.length > 0) && (
          <div className="mt-4 space-y-2">
            {projectionMonths(projection).filter(m => m.events?.length > 0).map(m => (
              <div key={m.label || m.monthLabel} className="text-xs">
                <span className="text-nexo-muted font-medium">{m.label || m.monthLabel}:</span>
                {m.events.map((ev, i) => (
                  <span key={i} className="ml-2" style={{ color: ev.type === 'income' ? '#2ed573' : '#ff4757' }}>
                    {ev.type === 'income' ? <ArrowUpRight size={10} className="inline" /> : <ArrowDownRight size={10} className="inline" />}
                    {' '}{ev.name} (€ {ev.amount?.toLocaleString('pt-BR')})
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Fluxo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Entradas esperadas */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-nexo-success mb-3 flex items-center gap-2">
            <ArrowUpRight size={16} />
            ENTRADAS ESPERADAS
          </h3>
          <div className="space-y-2">
            {incoming.length > 0 ? incoming.map((inc, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-nexo-border last:border-0">
                <div>
                  <div className="text-sm">{inc.source}</div>
                  <div className="text-xs text-nexo-muted">
                    {inc.expectedDate ? new Date(inc.expectedDate).toLocaleDateString('pt-BR') : 'Sem data'}
                  </div>
                </div>
                <div className="text-sm font-bold text-nexo-success">
                  € {inc.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )) : (
              <div className="text-sm text-nexo-muted py-4 text-center">Nenhuma entrada esperada</div>
            )}
          </div>
        </div>

        {/* Saidas fixas */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-nexo-danger mb-3 flex items-center gap-2">
            <ArrowDownRight size={16} />
            SAIDAS FIXAS (Recorrentes)
          </h3>
          <div className="space-y-2">
            {outgoing.length > 0 ? outgoing.map((out, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-nexo-border last:border-0">
                <div>
                  <div className="text-sm">{out.name}</div>
                  <div className="text-xs text-nexo-muted">{out.frequency === 'monthly' ? 'Mensal' : out.frequency}</div>
                </div>
                <div className="text-sm font-bold text-nexo-danger">
                  € {out.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )) : (
              <div className="text-sm text-nexo-muted py-4 text-center">Nenhuma saida fixa configurada</div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <h3 className="text-sm font-medium text-nexo-muted mb-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            ALERTAS DE CAIXA
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm ${
                  alert.severity === 'high'
                    ? 'bg-nexo-danger/10 text-nexo-danger'
                    : alert.severity === 'medium'
                      ? 'bg-nexo-warning/10 text-nexo-warning'
                      : 'bg-nexo-info/10 text-nexo-info'
                }`}
              >
                {alert.severity === 'high' ? <AlertTriangle size={14} /> : <Clock size={14} />}
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Modal CRUD Caixa */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{modalMode === 'create' ? 'Nova Entrada' : 'Editar Entrada'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-nexo-border rounded"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-nexo-muted">Tipo</label>
                <select value={formData.type} onChange={e => setFormData(v => ({ ...v, type: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm">
                  <option value="income">Receita</option>
                  <option value="expense">Despesa</option>
                  <option value="adjustment">Ajuste</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-nexo-muted">Valor (€)</label>
                <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData(v => ({ ...v, amount: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-nexo-muted">Descrição</label>
                <input type="text" value={formData.description} onChange={e => setFormData(v => ({ ...v, description: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-nexo-muted">Data</label>
                <input type="date" value={formData.date} onChange={e => setFormData(v => ({ ...v, date: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-nexo-muted">Nota</label>
                <input type="text" value={formData.note} onChange={e => setFormData(v => ({ ...v, note: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border">Cancelar</button>
              <button onClick={submitEntry} disabled={crudLoading} className="px-4 py-2 bg-nexo-primary rounded-lg text-xs hover:opacity-90 disabled:opacity-50">
                {crudLoading ? 'Salvando...' : modalMode === 'create' ? 'Criar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          onClose={() => setShowPaymentModal(false)}
          onSubmit={() => window.location.reload()}
        />
      )}

      {/* Loading / Error overlay */}
      {(loadingCash || loadingProj) && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-nexo-info border-t-transparent" />
        </div>
      )}
    </div>
  )
}

