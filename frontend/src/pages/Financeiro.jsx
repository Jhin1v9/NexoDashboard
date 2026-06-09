import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  GitBranch,
  ExternalLink,
  FolderOpen,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  CreditCard,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Eye,
  ToggleRight,
  ToggleLeft,
  Users,
  Receipt,
  ShoppingCart,
  PiggyBank,
  FileText,
  Filter,
  Calendar,
  Printer,
  Download,
  Search,
  Trash2,
  Edit3,
  Save,
  X
} from 'lucide-react'
import useRealtime from '../hooks/useRealtime'
import FinanceHarvester from '../components/luna/harvesters/FinanceHarvester'
import StatementSection from '../components/finance/StatementSection'
import QuickExpenseFab from '../components/finance/QuickExpenseFab'
import SimpleExpenses from '../components/finance/SimpleExpenses'
import axios from 'axios'

// ── Constants ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'resumo', label: 'Resumo', icon: BarChart3 },
  { id: 'receitas', label: 'Receitas', icon: Receipt },
  { id: 'gastos', label: 'Gastos', icon: ShoppingCart },
  { id: 'caixa', label: 'Caixa', icon: PiggyBank },
  { id: 'extrato', label: 'Extrato', icon: FileText }
]

const PAYMENT_STATUS_CONFIG = {
  pending:   { color: '#ffa502', bg: 'bg-[#ffa502]/10', text: 'text-[#ffa502]', label: 'Pendente', icon: Clock },
  partial:   { color: '#3742fa', bg: 'bg-[#3742fa]/10', text: 'text-[#3742fa]', label: 'Parcial', icon: CreditCard },
  paid:      { color: '#2ed573', bg: 'bg-[#2ed573]/10', text: 'text-[#2ed573]', label: 'Pago', icon: CheckCircle2 },
  overdue:   { color: '#ff4757', bg: 'bg-[#ff4757]/10', text: 'text-[#ff4757]', label: 'Atrasado', icon: AlertTriangle },
  cancelled: { color: '#747d8c', bg: 'bg-[#747d8c]/10', text: 'text-[#747d8c]', label: 'Cancelado', icon: Ban }
}

const PAYMENT_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendente' },
  { key: 'partial', label: 'Parcial' },
  { key: 'paid', label: 'Pago' },
  { key: 'overdue', label: 'Atrasado' }
]

const EXPENSE_CATEGORY_CONFIG = {
  hosting:   { color: '#e056fd', bg: 'bg-[#e056fd]/10', text: 'text-[#e056fd]', label: 'Hosting' },
  ai_tools:  { color: '#686de0', bg: 'bg-[#686de0]/10', text: 'text-[#686de0]', label: 'AI/Tools' },
  software:  { color: '#7bed9f', bg: 'bg-[#7bed9f]/10', text: 'text-[#7bed9f]', label: 'Software' },
  marketing: { color: '#ff6b81', bg: 'bg-[#ff6b81]/10', text: 'text-[#ff6b81]', label: 'Marketing' },
  others:    { color: '#95afc0', bg: 'bg-[#95afc0]/10', text: 'text-[#95afc0]', label: 'Outros' }
}

const ALERT_COLORS = {
  overdue:   { border: 'border-l-4 border-l-[#ff4757]', bg: 'bg-[#ff4757]/10', text: 'text-[#ff4757]', icon: AlertTriangle },
  due_soon:  { border: 'border-l-4 border-l-[#ffa502]', bg: 'bg-[#ffa502]/10', text: 'text-[#ffa502]', icon: Clock },
  low_cash:  { border: 'border-l-4 border-l-[#ff4757]', bg: 'bg-[#ff4757]/10', text: 'text-[#ff4757]', icon: TrendingDown },
  info:      { border: 'border-l-4 border-l-[#6c5ce7]', bg: 'bg-[#6c5ce7]/10', text: 'text-[#6c5ce7]', icon: TrendingUp }
}

// ── Reusable Components ───────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, subtext, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card p-4 flex items-center gap-4"
  >
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center"
      style={{ backgroundColor: color + '20' }}
    >
      <Icon size={20} style={{ color }} />
    </div>
    <div className="min-w-0">
      <div className="text-2xl font-bold font-heading truncate">{value}</div>
      <div className="text-xs text-nexo-muted">{label}</div>
      {subtext && (
        <div className="text-[10px] mt-0.5" style={{ color }}>{subtext}</div>
      )}
    </div>
  </motion.div>
)

const StatusBadge = ({ status }) => {
  const config = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pending
  const IconComp = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <IconComp size={12} />
      {config.label}
    </span>
  )
}

const CategoryBadge = ({ category }) => {
  const config = EXPENSE_CATEGORY_CONFIG[category] || EXPENSE_CATEGORY_CONFIG.others
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

const ProgressBar = ({ value, max, color = '#6c5ce7' }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-full h-2 bg-nexo-card rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium w-10 text-right shrink-0">{Math.round(pct)}%</span>
    </div>
  )
}

// ── Tab Sections ──────────────────────────────────────────────────────────

function SummarySection({ summary, payments, expenses }) {
  const moneyValue = (value, fallback = 0) => {
    if (typeof value === 'number') return value
    if (value && typeof value.value === 'number') return value.value
    return fallback
  }
  const totalExpected = moneyValue(summary?.totalExpected)
  const totalReceived = moneyValue(summary?.totalReceived)
  const totalPending = moneyValue(summary?.totalPending)
  const cashBalance = moneyValue(summary?.cashBalance ?? summary?.balance ?? summary?.cashBoxBalance)
  const alerts = summary?.alerts ?? []

  // Derive from payments if summary missing
  const derivedExpected = payments?.reduce((sum, p) => sum + (p.totalAmount?.value ?? 0), 0) ?? totalExpected
  const derivedReceived = payments?.reduce((sum, p) => {
    const txTotal = p.transactions?.reduce((t, tx) => t + (tx.amount?.value ?? 0), 0) ?? 0
    return sum + txTotal
  }, 0) ?? totalReceived
  const derivedPending = derivedExpected > 0 ? derivedExpected - derivedReceived : totalPending

  const currency = summary?.totalExpected?.currency || summary?.cashBalance?.currency || 'EUR'
  const fmt = (v) => `€ ${v.toLocaleString('pt-BR')}`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => {
            const cfg = ALERT_COLORS[alert.type] || ALERT_COLORS.info
            const IconComp = cfg.icon
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg ${cfg.border} ${cfg.bg} ${cfg.text}`}
              >
                <IconComp size={16} />
                <span className="text-sm font-medium">{alert.message}</span>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Total Esperado"
          value={fmt(derivedExpected)}
          color="#6c5ce7"
          subtext={currency}
        />
        <StatCard
          icon={ArrowDownLeft}
          label="Recebido"
          value={fmt(derivedReceived)}
          color="#2ed573"
          subtext={`${Math.round((derivedReceived / Math.max(derivedExpected, 1)) * 100)}% do total`}
        />
        <StatCard
          icon={Clock}
          label="Pendente"
          value={fmt(derivedPending)}
          color="#ffa502"
          subtext={`${Math.round((derivedPending / Math.max(derivedExpected, 1)) * 100)}% restante`}
        />
        <StatCard
          icon={PiggyBank}
          label="Caixa Atual"
          value={fmt(cashBalance)}
          color="#2ed573"
          subtext="Saldo disponível"
        />
      </div>

      {/* Quick Overview: Income vs Expenses */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-medium mb-4 text-nexo-muted">Visão Geral</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Receipt size={16} className="text-nexo-success" />
              <span className="text-sm font-medium">Receitas ({payments?.length ?? 0})</span>
            </div>
            <div className="space-y-2">
              {payments?.slice(0, 3).map((p, index) => (
                <div key={p.id || `${p.clientName}-${index}`} className="flex items-center justify-between py-2 border-b border-nexo-border last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.clientName} — {p.projectName}</div>
                    <div className="text-xs text-nexo-muted">
                      {p.transactions?.length ?? 0} transações registradas
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
              {(!payments || payments.length === 0) && (
                <div className="text-center text-nexo-muted text-sm py-4">Nenhuma receita registrada</div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart size={16} className="text-nexo-danger" />
              <span className="text-sm font-medium">Gastos ({expenses?.length ?? 0})</span>
            </div>
            <div className="space-y-2">
              {expenses?.slice(0, 3).map((e, index) => (
                <div key={e.id || `${e.name}-${index}`} className="flex items-center justify-between py-2 border-b border-nexo-border last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{e.name}</div>
                    <div className="text-xs text-nexo-muted">
                      € {e.costPerPerson?.value ?? 0} / pessoa · {e.periodLabel || e.period}
                    </div>
                  </div>
                  <CategoryBadge category={e.category} />
                </div>
              ))}
              {(!expenses || expenses.length === 0) && (
                <div className="text-center text-nexo-muted text-sm py-4">Nenhum gasto registrado</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recibos sempre visiveis no resumo */}
      <div className="glass-card p-6">
        <div className="mb-4">
          <h2 className="text-sm font-medium text-nexo-muted flex items-center gap-2">
            <Printer size={16} className="text-nexo-info" />
            Recibos e Extrato
          </h2>
          <p className="text-xs text-nexo-muted mt-1">
            Imprima PDF estilo banco ou ticket termico estilo mercado.
          </p>
        </div>
        <StatementSection />
      </div>
    </motion.div>
  )
}

function RevenuesSection({ payments, onRefresh }) {
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    clientName: '',
    projectName: '',
    totalAmount: '',
    currency: 'EUR',
    description: '',
    status: 'pending'
  })

  const filteredPayments = useMemo(() => {
    if (!payments) return []
    if (filter === 'all') return payments
    return payments.filter((p) => p.status === filter)
  }, [payments, filter])

  const totalByStatus = (status) => payments?.filter((p) => p.status === status).length ?? 0

  const openCreate = () => {
    setModalMode('create')
    setEditingId(null)
    setForm({ clientName: '', projectName: '', totalAmount: '', currency: 'EUR', description: '', status: 'pending' })
    setShowModal(true)
  }

  const openEdit = (payment) => {
    setModalMode('edit')
    setEditingId(payment.id || payment.paymentId)
    setForm({
      clientName: payment.clientName || '',
      projectName: payment.projectName || '',
      totalAmount: String(payment.totalAmount?.value || ''),
      currency: payment.totalAmount?.currency || 'EUR',
      description: payment.description || '',
      status: payment.status || 'pending'
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.clientName.trim() || !form.totalAmount) {
      alert('Preencha cliente e valor')
      return
    }
    setLoading(true)
    try {
      const payload = {
        clientName: form.clientName.trim(),
        projectName: form.projectName.trim(),
        totalAmount: { value: parseFloat(form.totalAmount), currency: form.currency },
        description: form.description.trim(),
        status: form.status
      }
      if (modalMode === 'create') {
        await axios.post('/api/payments', payload)
      } else {
        await axios.put(`/api/payments/${editingId}`, payload)
      }
      setShowModal(false)
      onRefresh?.()
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja apagar esta receita?')) return
    try {
      await axios.delete(`/api/payments/${id}`)
      onRefresh?.()
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header + New Button */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {PAYMENT_FILTERS.map((f) => {
            const isActive = filter === f.key
            const count = f.key === 'all' ? (payments?.length ?? 0) : totalByStatus(f.key)
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-nexo-info text-white shadow-lg shadow-nexo-info/20'
                    : 'bg-nexo-card text-nexo-muted hover:text-white hover:bg-nexo-border'
                }`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs ${isActive ? 'text-white/70' : 'text-nexo-muted'}`}>
                  ({count})
                </span>
              </button>
            )
          })}
        </div>
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2 text-sm">
          <Plus size={16} /> Nova Receita
        </button>
      </div>

      {/* Payment Cards */}
      <div className="space-y-3">
        {filteredPayments.map((payment, idx) => {
          const received = payment.transactions?.reduce(
            (sum, tx) => sum + (tx.amount?.value ?? 0),
            0
          ) ?? 0
          const total = payment.totalAmount?.value ?? 0
          const currency = payment.totalAmount?.currency || 'EUR'
          const statusCfg = PAYMENT_STATUS_CONFIG[payment.status] || PAYMENT_STATUS_CONFIG.pending
          const pid = payment.id || payment.paymentId

          return (
            <motion.div
              key={pid}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-5"
            >
              {/* Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold font-heading truncate">
                      {payment.clientName}
                    </span>
                    <StatusBadge status={payment.status} />
                  </div>
                  <div className="text-sm text-nexo-muted truncate">
                    {payment.projectName}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold font-heading">
                    {currency} {received.toLocaleString('pt-BR')} / {total.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-xs text-nexo-muted">
                    {currency} {(total - received).toLocaleString('pt-BR')} pendente
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <ProgressBar value={received} max={total} color={statusCfg.color} />
              </div>

              {/* Actions Row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Quick Links */}
                {payment.links?.github && (
                  <a
                    href={payment.links.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-nexo-card text-nexo-muted hover:text-white hover:bg-nexo-border transition-all"
                  >
                    <GitBranch size={12} />
                    GitHub
                  </a>
                )}
                {payment.links?.vercel && (
                  <a
                    href={payment.links.vercel}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-nexo-card text-nexo-muted hover:text-white hover:bg-nexo-border transition-all"
                  >
                    <ExternalLink size={12} />
                    Vercel
                  </a>
                )}
                {payment.links?.localPath && (
                  <a
                    href={`file://${payment.links.localPath}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-nexo-card text-nexo-muted hover:text-white hover:bg-nexo-border transition-all"
                  >
                    <FolderOpen size={12} />
                    Abrir Pasta
                  </a>
                )}
                {payment.links?.domain && (
                  <a
                    href={`https://${payment.links.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-nexo-card text-nexo-muted hover:text-white hover:bg-nexo-border transition-all"
                  >
                    <ExternalLink size={12} />
                    Site
                  </a>
                )}

                <div className="flex-1" />

                <button onClick={() => openEdit(payment)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-nexo-card text-nexo-muted hover:text-white hover:bg-nexo-border transition-all">
                  <Edit3 size={12} /> Editar
                </button>
                <button onClick={() => handleDelete(pid)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-nexo-danger/10 text-nexo-danger hover:bg-nexo-danger/20 transition-all">
                  <Trash2 size={12} /> Apagar
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-nexo-info/10 text-nexo-info hover:bg-nexo-info/20 transition-all">
                  <Plus size={12} />
                  Transação
                </button>
              </div>
            </motion.div>
          )
        })}

        {filteredPayments.length === 0 && (
          <div className="glass-card p-8 text-center">
            <Receipt size={32} className="text-nexo-muted mx-auto mb-3" />
            <p className="text-nexo-muted text-sm">Nenhuma receita encontrada</p>
          </div>
        )}
      </div>

      {/* Modal CRUD Receita */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{modalMode === 'create' ? 'Nova Receita' : 'Editar Receita'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-nexo-border rounded"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-nexo-muted">Cliente</label>
                <input value={form.clientName} onChange={e => setForm(v => ({ ...v, clientName: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm" placeholder="Nome do cliente" />
              </div>
              <div>
                <label className="text-xs text-nexo-muted">Projeto</label>
                <input value={form.projectName} onChange={e => setForm(v => ({ ...v, projectName: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm" placeholder="Nome do projeto" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-nexo-muted">Valor (€)</label>
                  <input type="number" step="0.01" value={form.totalAmount} onChange={e => setForm(v => ({ ...v, totalAmount: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm" placeholder="0,00" />
                </div>
                <div>
                  <label className="text-xs text-nexo-muted">Status</label>
                  <select value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm">
                    <option value="pending">Pendente</option>
                    <option value="partial">Parcial</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Atrasado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-nexo-muted">Descrição</label>
                <input value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm" placeholder="Detalhes..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border">Cancelar</button>
              <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-nexo-primary rounded-lg text-xs hover:opacity-90 disabled:opacity-50">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function ExpensesSection({ expenses }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Add Button */}
      <div className="flex justify-end">
        <button className="btn-primary inline-flex items-center gap-2 text-sm">
          <Plus size={16} />
          Novo Gasto
        </button>
      </div>

      {/* Expense Cards */}
      <div className="space-y-3">
        {expenses?.map((expense, idx) => {
          const total = expense.amount?.value ?? 0
          const perPerson = expense.costPerPerson?.value ?? 0
          const currency = expense.amount?.currency || 'EUR'
          const splitAmong = expense.splitAmong ?? []
          const paidBy = expense.paidBy ?? {}
          const allPaid = splitAmong.length > 0 && splitAmong.every((id) => paidBy[id]?.paid)

          return (
            <motion.div
              key={expense.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-5"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-nexo-card shrink-0">
                    {allPaid ? (
                      <CheckCircle2 size={16} className="text-nexo-success" />
                    ) : (
                      <Clock size={16} className="text-nexo-warning" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-bold font-heading truncate">{expense.name}</div>
                    <div className="text-xs text-nexo-muted">
                      {expense.type === 'recurring' ? 'Recorrente' : 'Único'} · {expense.periodLabel || expense.period}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CategoryBadge category={expense.category} />
                  {expense.type === 'recurring' && expense.renewDate && (
                    <span className="text-[10px] text-nexo-muted">
                      Renova: {new Date(expense.renewDate).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>

              {/* Values */}
              <div className="grid grid-cols-3 gap-4 mb-4 py-3 border-y border-nexo-border">
                <div>
                  <div className="text-xs text-nexo-muted mb-1">Valor Total</div>
                  <div className="text-sm font-bold font-heading">
                    {currency} {total.toLocaleString('pt-BR')}/{expense.period === 'annual' ? 'ano' : expense.period === 'monthly' ? 'mês' : 'ano'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-nexo-muted mb-1">Custo/Pessoa</div>
                  <div className="text-sm font-bold font-heading">
                    {currency} {perPerson.toLocaleString('pt-BR')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-nexo-muted mb-1">Status</div>
                  <div className={`text-sm font-medium ${allPaid ? 'text-nexo-success' : 'text-nexo-warning'}`}>
                    {allPaid ? 'Todos pagos' : 'Pendente'}
                  </div>
                </div>
              </div>

              {/* Paid By Avatars */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-nexo-muted">Pagadores:</span>
                  <div className="flex items-center gap-1">
                    {splitAmong.map((personId) => {
                      const isPaid = paidBy[personId]?.paid
                      return (
                        <div
                          key={personId}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase border-2 ${
                            isPaid
                              ? 'bg-nexo-success/20 border-nexo-success text-nexo-success'
                              : 'bg-nexo-warning/10 border-nexo-warning text-nexo-warning'
                          }`}
                          title={`${personId}: ${isPaid ? 'Pago' : 'Pendente'}`}
                        >
                          {isPaid ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <Clock size={12} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Toggle Active */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-nexo-muted">{expense.isActive !== false ? 'Ativo' : 'Inativo'}</span>
                  <button className="text-nexo-muted hover:text-white transition-colors">
                    {expense.isActive !== false ? (
                      <ToggleRight size={20} className="text-nexo-success" />
                    ) : (
                      <ToggleLeft size={20} />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}

        {(!expenses || expenses.length === 0) && (
          <div className="glass-card p-8 text-center">
            <ShoppingCart size={32} className="text-nexo-muted mx-auto mb-3" />
            <p className="text-nexo-muted text-sm">Nenhum gasto registrado</p>
            <p className="text-nexo-muted text-xs mt-1">Clique em "+ Novo Gasto" para adicionar</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function CashBoxSection({ cashBox, summary }) {
  const balance = cashBox?.balance?.value ?? 0
  const monthlyIncome = cashBox?.monthlyIncome?.value ?? summary?.totalReceived?.value ?? 0
  const monthlyExpenses = cashBox?.monthlyExpenses?.value ?? 0
  const projected = cashBox?.projectedBalance?.value ?? 0
  const alerts = cashBox?.alerts ?? []
  const currency = cashBox?.balance?.currency || 'EUR'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Cash Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => {
            const cfg = ALERT_COLORS[alert.type] || ALERT_COLORS.info
            const IconComp = cfg.icon
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg ${cfg.border} ${cfg.bg} ${cfg.text}`}
              >
                <IconComp size={16} />
                <span className="text-sm font-medium">{alert.message}</span>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Cash Widget */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-nexo-muted flex items-center gap-2">
            <PiggyBank size={16} />
            Caixa da Empresa
          </h2>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-nexo-info/10 text-nexo-info hover:bg-nexo-info/20 transition-all">
            <Eye size={12} />
            Ver Projeção
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 rounded-lg bg-nexo-card/50">
            <div className="text-xs text-nexo-muted mb-1">Saldo Atual</div>
            <div className="text-2xl font-bold font-heading" style={{ color: balance > monthlyExpenses * 2 ? '#2ed573' : balance > monthlyExpenses ? '#ffa502' : '#ff4757' }}>
              {currency} {balance.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="text-center p-4 rounded-lg bg-nexo-card/50">
            <div className="text-xs text-nexo-muted mb-1">Receitas/Mês</div>
            <div className="text-2xl font-bold font-heading text-nexo-success">
              {currency} {monthlyIncome.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="text-center p-4 rounded-lg bg-nexo-card/50">
            <div className="text-xs text-nexo-muted mb-1">Gastos/Mês</div>
            <div className="text-2xl font-bold font-heading text-nexo-danger">
              {currency} {monthlyExpenses.toLocaleString('pt-BR')}
            </div>
          </div>
        </div>

        {/* Projection mini */}
        {projected > 0 && (
          <div className="mt-4 pt-4 border-t border-nexo-border">
            <div className="flex items-center justify-between">
              <div className="text-sm text-nexo-muted">
                Projeção 3 meses:
              </div>
              <div className="text-lg font-bold font-heading text-nexo-info">
                {currency} {projected.toLocaleString('pt-BR')}
              </div>
            </div>
            <div className="mt-2 w-full h-2 bg-nexo-card rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-nexo-success via-nexo-info to-nexo-success"
                style={{ width: `${Math.min((projected / Math.max(balance, 1)) * 50, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cash History */}
      {cashBox?.history && cashBox.history.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-sm font-medium mb-4 text-nexo-muted flex items-center gap-2">
            <Receipt size={16} />
            Histórico de Movimentações
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cashBox.history.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 border-b border-nexo-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    entry.type === 'income' ? 'bg-nexo-success/20' : 'bg-nexo-danger/20'
                  }`}>
                    {entry.type === 'income' ? (
                      <ArrowDownLeft size={12} className="text-nexo-success" />
                    ) : (
                      <ArrowUpRight size={12} className="text-nexo-danger" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{entry.source}</div>
                    <div className="text-xs text-nexo-muted">{new Date(entry.date).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${entry.type === 'income' ? 'text-nexo-success' : 'text-nexo-danger'}`}>
                    {entry.type === 'income' ? '+' : '-'}{currency} {entry.amount.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-xs text-nexo-muted">
                    Saldo: {currency} {entry.balanceAfter.toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incoming Payments */}
      {cashBox?.incomingPayments && cashBox.incomingPayments.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-sm font-medium mb-4 text-nexo-muted flex items-center gap-2">
            <TrendingUp size={16} />
            Entradas Esperadas
          </h2>
          <div className="space-y-2">
            {cashBox.incomingPayments.map((inc, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-nexo-border last:border-0">
                <div>
                  <div className="text-sm font-medium">{inc.source}</div>
                  <div className="text-xs text-nexo-muted">
                    Esperado: {new Date(inc.expectedDate).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-nexo-success">
                    +{currency} {inc.amount.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-xs text-nexo-muted">
                    {Math.round((inc.probability ?? 1) * 100)}% probabilidade
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ── Quick Expense Button ───────────────────────────────────────────────────

function QuickExpenseButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('others')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const categories = [
    { id: 'hosting', label: 'Hosting' },
    { id: 'ai_tools', label: 'IA / Tools' },
    { id: 'software', label: 'Software' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'others', label: 'Outros' }
  ]

  const handleSubmit = async () => {
    if (!name || !amount) return
    setLoading(true)
    try {
      await axios.post('/api/expenses/quick', {
        name,
        amount: parseFloat(amount),
        category,
        categoryLabel: categories.find(c => c.id === category)?.label,
        note,
        deductFromCashBox: true
      })
      setOpen(false)
      setName('')
      setAmount('')
      setNote('')
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-nexo-danger rounded-lg text-xs hover:opacity-90 transition-opacity">
        <Plus size={14} /> Despesa Rápida
      </button>
      
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="glass-card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">💸 Despesa Rápida</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-nexo-muted mb-1 block">O que comprou?</label>
                <input className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
                  placeholder="Ex: Hostinger, Kimi, etc" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-nexo-muted mb-1 block">Quanto gastou (€)?</label>
                <input type="number" step="0.01" className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
                  placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-nexo-muted mb-1 block">Categoria</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border text-sm">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-nexo-muted mb-1 block">Nota (opcional)</label>
                <input className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
                  placeholder="Detalhes..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setOpen(false)} className="flex-1 px-4 py-2 bg-nexo-card rounded-lg text-sm hover:bg-nexo-border transition-colors">Cancelar</button>
              <button onClick={handleSubmit} disabled={loading || !name || !amount} className="flex-1 px-4 py-2 bg-nexo-danger rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Financeiro() {
  const [activeTab, setActiveTab] = useState('resumo')

  const { data: summaryData, loading: summaryLoading } = useRealtime('/api/finance/summary', 30000)
  const { data: paymentsData, loading: paymentsLoading, refetch: refetchPayments } = useRealtime('/api/payments', 30000)
  const { data: expensesData, loading: expensesLoading } = useRealtime('/api/expenses', 30000)
  const { data: cashBoxData, loading: cashBoxLoading } = useRealtime('/api/cash-box', 30000)

  const summary = summaryData || {}
  const payments = paymentsData || []
  const expenses = expensesData || []
  const cashBox = cashBoxData || {}

  const isLoading = summaryLoading || paymentsLoading || expensesLoading || cashBoxLoading

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <Wallet size={24} className="text-nexo-info" />
          Financeiro
        </h1>
        <span className="text-xs text-nexo-muted">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-nexo-card/50 border border-nexo-border/50">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-nexo-info text-white shadow-lg shadow-nexo-info/20'
                  : 'text-nexo-muted hover:text-white hover:bg-nexo-border/50'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="glass-card p-12 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-nexo-info border-t-transparent rounded-full mx-auto mb-3"
          />
          <p className="text-sm text-nexo-muted">Carregando dados financeiros...</p>
        </div>
      )}

      {/* Tab Content */}
      {!isLoading && (
        <AnimatePresence mode="wait">
          {activeTab === 'resumo' && (
            <motion.div
              key="resumo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SummarySection summary={summary} payments={payments} expenses={expenses} />
            </motion.div>
          )}

          {activeTab === 'receitas' && (
            <motion.div
              key="receitas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <RevenuesSection payments={payments} onRefresh={refetchPayments} />
            </motion.div>
          )}

          {activeTab === 'gastos' && (
            <motion.div
              key="gastos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-nexo-muted">Clique no + para adicionar rapidamente</p>
                <p className="text-xs text-nexo-muted">{expenses?.length || 0} despesas</p>
              </div>
              <SimpleExpenses />
              <QuickExpenseFab onAdded={() => {
                // Refetch all financial data
                window.location.reload()
              }} />
            </motion.div>
          )}

          {activeTab === 'caixa' && (
            <motion.div
              key="caixa"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <CashBoxSection cashBox={cashBox} summary={summary} />
            </motion.div>
          )}

          {activeTab === 'extrato' && (
            <motion.div
              key="extrato"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <StatementSection />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <FinanceHarvester
        activeTab={activeTab}
        summary={summary}
        payments={payments}
        expenses={expenses}
        cashBox={cashBox}
        isLoading={isLoading}
      />
    </div>
  )
}

