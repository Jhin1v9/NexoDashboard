import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, LayoutTemplate, Users, Wallet, CheckCircle, Clock,
  AlertTriangle, Repeat, Tag, ArrowRight
} from 'lucide-react'
import useRealtime from '../hooks/useRealtime'
import AddExpenseModal from '../components/finance/AddExpenseModal'

const categoryConfig = {
  hosting:   { color: '#e056fd', label: 'Hosting' },
  ai_tools:  { color: '#686de0', label: 'AI / Tools' },
  software:  { color: '#7bed9f', label: 'Software' },
  marketing: { color: '#ff6b81', label: 'Marketing' },
  others:    { color: '#95afc0', label: 'Outros' }
}

const ExpensePaidBy = ({ paidBy }) => {
  const people = [
    { id: 'abner', name: 'A' },
    { id: 'nonoke', name: 'N' },
    { id: 'elias', name: 'E' }
  ]
  return (
    <div className="flex items-center gap-1.5">
      {people.map(p => {
        const paid = paidBy?.[p.id]?.paid
        return (
          <div
            key={p.id}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{
              backgroundColor: paid ? '#2ed57320' : '#ffa50220',
              color: paid ? '#2ed573' : '#ffa502',
              border: `1px solid ${paid ? '#2ed57340' : '#ffa50240'}`
            }}
            title={`${p.name}: ${paid ? 'Pago' : 'Pendente'}`}
          >
            {paid ? <CheckCircle size={10} /> : <Clock size={10} />}
          </div>
        )
      })}
    </div>
  )
}

const ExpenseCard = ({ expense, onPayClick }) => {
  const cat = categoryConfig[expense.category] || categoryConfig.others
  const isRecurring = expense.type === 'recurring'
  const currencySymbol = expense.amount?.currency === 'EUR' ? '€' : 'R$'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: expense.fullyPaid ? '#2ed573' : '#ffa502' }} />
          <span className="font-medium text-sm">{expense.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {isRecurring && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-nexo-info/10 text-nexo-info">
              <Repeat size={10} />
              {expense.period === 'monthly' ? 'Mensal' : expense.period === 'quarterly' ? 'Trimestral' : 'Anual'}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
            <Tag size={10} className="inline mr-1" />
            {cat.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-nexo-muted">Total</div>
          <div className="text-sm font-bold">
            {currencySymbol} {expense.amount?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            {isRecurring && <span className="text-xs text-nexo-muted font-normal">/{expense.period === 'monthly' ? 'mes' : expense.period === 'quarterly' ? 'trim' : 'ano'}</span>}
          </div>
        </div>
        <div>
          <div className="text-xs text-nexo-muted">Por pessoa</div>
          <div className="text-sm font-bold">
            {currencySymbol} {expense.costPerPerson?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-nexo-border">
        <ExpensePaidBy paidBy={expense.paidBy} />
        <div className="flex items-center gap-2">
          {!expense.fullyPaid && (
            <button
              onClick={onPayClick}
              className="text-xs px-3 py-1.5 rounded-lg bg-nexo-success/10 text-nexo-success hover:bg-nexo-success/20 transition-all"
            >
              Pagar minha parte
            </button>
          )}
          <span className={`text-xs font-medium ${expense.fullyPaid ? 'text-nexo-success' : 'text-nexo-warning'}`}>
            {expense.fullyPaid ? 'Pago' : 'Pendente'}
          </span>
        </div>
      </div>

      {expense.renewDate && (
        <div className="text-xs text-nexo-muted mt-2">
          Renova: {new Date(expense.renewDate).toLocaleDateString('pt-BR')}
        </div>
      )}
    </motion.div>
  )
}

export default function Gastos() {
  const navigate = useNavigate()
  const [showAddModal, setShowAddModal] = useState(false)
  const { data: expensesData, loading, error } = useRealtime('/api/expenses', 30000)

  const expenses = expensesData?.expenses || expensesData || []
  const recurring = expenses.filter(e => e.type === 'recurring')
  const oneTime = expenses.filter(e => e.type === 'one_time')

  // Calculos do resumo
  const totalYear = expenses.reduce((sum, e) => {
    const val = e.amount?.value || 0
    if (e.type === 'recurring') {
      if (e.period === 'monthly') return sum + (val * 12)
      if (e.period === 'quarterly') return sum + (val * 4)
      return sum + val // annual
    }
    return sum + val
  }, 0)

  const myCost = expenses.reduce((sum, e) => sum + (e.costPerPerson?.value || 0), 0)
  const pending = expenses.reduce((sum, e) => {
    if (!e.fullyPaid) return sum + (e.costPerPerson?.value || 0)
    return sum
  }, 0)

  const ResumoCard = ({ icon: Icon, label, value, color }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold font-heading">{value}</div>
        <div className="text-xs text-nexo-muted">{label}</div>
      </div>
    </motion.div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold font-heading">Gastos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-nexo-info text-white text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus size={16} />
            Novo Gasto
          </button>
          <button
            onClick={() => navigate('/financeiro/gastos/templates')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-nexo-card text-sm text-nexo-muted hover:text-white transition-all"
          >
            <LayoutTemplate size={16} />
            Templates
          </button>
          <button
            onClick={() => navigate('/financeiro/gastos/meus')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-nexo-card text-sm text-nexo-muted hover:text-white transition-all"
          >
            <Users size={16} />
            Ver por Pessoa
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResumoCard icon={Wallet} label="Total/ano" value={`€ ${totalYear.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`} color="#6c5ce7" />
        <ResumoCard icon={Users} label="Meu custo" value={`€ ${myCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="#2ed573" />
        <ResumoCard icon={AlertTriangle} label="Pendente" value={`€ ${pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="#ffa502" />
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-nexo-info border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="glass-card p-4 text-center text-nexo-danger text-sm">
          <AlertTriangle size={20} className="mx-auto mb-2" />
          Erro ao carregar gastos
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Recorrentes Ativos */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <h2 className="text-sm font-medium text-nexo-muted flex items-center gap-2">
              <Repeat size={16} />
              RECORRENTES ATIVOS
            </h2>
            {recurring.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recurring.map(e => (
                  <ExpenseCard key={e.id} expense={e} onPayClick={() => navigate(`/financeiro/gastos/meus`)} />
                ))}
              </div>
            ) : (
              <div className="glass-card p-6 text-center text-sm text-nexo-muted">
                Nenhum gasto recorrente ativo
              </div>
            )}
          </motion.div>

          {/* Historico de Gastos Unicos */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <h2 className="text-sm font-medium text-nexo-muted flex items-center gap-2">
              <Wallet size={16} />
              HISTORICO DE GASTOS UNICOS
            </h2>
            {oneTime.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {oneTime.map(e => (
                  <ExpenseCard key={e.id} expense={e} onPayClick={() => navigate(`/financeiro/gastos/meus`)} />
                ))}
              </div>
            ) : (
              <div className="glass-card p-6 text-center text-sm text-nexo-muted">
                Nenhum gasto unico registrado
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddExpenseModal
            onClose={() => setShowAddModal(false)}
            onSaved={() => window.location.reload()}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

