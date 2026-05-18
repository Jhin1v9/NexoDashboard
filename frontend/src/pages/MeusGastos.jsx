import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Wallet, CheckCircle, Clock, AlertTriangle,
  CreditCard, TrendingDown, TrendingUp
} from 'lucide-react'
import useRealtime from '../hooks/useRealtime'
import { useAuth } from '../context/AuthContext'

const PEOPLE = {
  abner: 'Abner',
  nonoke: 'Nonoke',
  elias: 'Elias'
}

export default function MeusGastos() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const [currentUser, setCurrentUser] = useState(authUser?.id || 'abner')
  const [payingExpenseId, setPayingExpenseId] = useState(null)

  const { data: expensesData, loading, error } = useRealtime('/api/expenses', 30000)

  useEffect(() => {
    if (authUser?.id) {
      setCurrentUser(authUser.id)
    }
  }, [authUser])

  const expenses = expensesData?.expenses || expensesData || []
  const userName = PEOPLE[currentUser] || currentUser

  const myExpenses = expenses.filter(e =>
    e.splitAmong?.includes(currentUser)
  )

  const pendingExpenses = myExpenses.filter(e =>
    e.paidBy?.[currentUser]?.paid === false
  )

  const paidExpenses = myExpenses.filter(e =>
    e.paidBy?.[currentUser]?.paid === true
  )

  const totalToPay = pendingExpenses.reduce((sum, e) =>
    sum + (e.costPerPerson?.value || 0), 0
  )

  const totalPaid = paidExpenses.reduce((sum, e) =>
    sum + (e.paidBy?.[currentUser]?.amount || e.costPerPerson?.value || 0), 0
  )

  const handlePay = async (expenseId) => {
    setPayingExpenseId(expenseId)
    try {
      const res = await fetch(`/api/expenses/${expenseId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser, method: 'transfer' })
      })
      if (!res.ok) throw new Error('Erro ao registrar pagamento')
      window.location.reload()
    } catch (err) {
      console.error(err)
      setPayingExpenseId(null)
    }
  }

  const ExpenseItem = ({ expense, isPending }) => {
    const myPayment = expense.paidBy?.[currentUser]
    const currencySymbol = expense.amount?.currency === 'EUR' ? '€' : 'R$'
    const myAmount = myPayment?.amount || expense.costPerPerson?.value || 0

    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center justify-between py-3 border-b border-nexo-border last:border-0"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: isPending ? '#ffa50220' : '#2ed57320' }}
          >
            {isPending ? <Clock size={14} style={{ color: '#ffa502' }} /> : <CheckCircle size={14} style={{ color: '#2ed573' }} />}
          </div>
          <div>
            <div className="text-sm font-medium">{expense.name}</div>
            <div className="text-xs text-nexo-muted">
              {expense.type === 'recurring' ? 'Recorrente' : 'Unico'} • {new Date(expense.startDate).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-bold">
              {currencySymbol} {myAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-nexo-muted">
              {isPending ? 'Pendente' : 'Pago'}
            </div>
          </div>
          {isPending && (
            <button
              onClick={() => handlePay(expense.id)}
              disabled={payingExpenseId === expense.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexo-success/10 text-nexo-success text-xs font-medium hover:bg-nexo-success/20 transition-all disabled:opacity-50"
            >
              <CreditCard size={12} />
              {payingExpenseId === expense.id ? 'Processando...' : 'Pagar minha parte'}
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/financeiro/gastos')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nexo-card text-nexo-muted hover:text-white transition-all"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Voltar</span>
        </button>
        <h1 className="text-2xl font-bold font-heading">Meus Gastos — {userName}</h1>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ff475720' }}>
            <TrendingDown size={20} style={{ color: '#ff4757' }} />
          </div>
          <div>
            <div className="text-2xl font-bold font-heading">
              € {totalToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-nexo-muted">Total a pagar</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2ed57320' }}>
            <TrendingUp size={20} style={{ color: '#2ed573' }} />
          </div>
          <div>
            <div className="text-2xl font-bold font-heading">
              € {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-nexo-muted">Total pago</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ffa50220' }}>
            <Wallet size={20} style={{ color: '#ffa502' }} />
          </div>
          <div>
            <div className="text-2xl font-bold font-heading">{pendingExpenses.length}</div>
            <div className="text-xs text-nexo-muted">Pendentes</div>
          </div>
        </motion.div>
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
          {/* Gastos Pendentes */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-5"
          >
            <h2 className="text-sm font-medium text-nexo-warning mb-3 flex items-center gap-2">
              <Clock size={16} />
              GASTOS PENDENTES ({pendingExpenses.length})
            </h2>
            {pendingExpenses.length > 0 ? (
              <div>
                {pendingExpenses.map(e => (
                  <ExpenseItem key={e.id} expense={e} isPending={true} />
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-nexo-muted py-6">
                <CheckCircle size={24} className="mx-auto mb-2 text-nexo-success" />
                Nenhum gasto pendente. Tudo pago!
              </div>
            )}
          </motion.div>

          {/* Gastos Pagos */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-5"
          >
            <h2 className="text-sm font-medium text-nexo-success mb-3 flex items-center gap-2">
              <CheckCircle size={16} />
              GASTOS PAGOS ({paidExpenses.length})
            </h2>
            {paidExpenses.length > 0 ? (
              <div>
                {paidExpenses.map(e => (
                  <ExpenseItem key={e.id} expense={e} isPending={false} />
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-nexo-muted py-6">
                Nenhum gasto pago ainda
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}

