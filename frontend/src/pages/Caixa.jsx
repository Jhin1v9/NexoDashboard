import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Clock, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
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
  const { data: cashBox, loading: loadingCash, error: errorCash } = useRealtime('/api/cash-box', 30000)
  const { data: projection, loading: loadingProj, error: errorProj } = useRealtime('/api/cash-box/projection', 30000)
  const [editValues, setEditValues] = useState({ balance: '', monthlyIncome: '', monthlyExpenses: '' })
  const [saving, setSaving] = useState(false)

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
      await fetch('/api/cash-box', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      setEditValues({ balance: '', monthlyIncome: '', monthlyExpenses: '' })
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

      {/* Loading / Error overlay */}
      {(loadingCash || loadingProj) && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-nexo-info border-t-transparent" />
        </div>
      )}
    </div>
  )
}

