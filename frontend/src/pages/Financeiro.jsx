import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Edit2, Trash2, ArrowDownLeft, ArrowUpRight,
  Wallet, TrendingUp, TrendingDown, Filter, X,
  CheckCircle, AlertCircle, Euro, Calendar, Tag
} from 'lucide-react'
import { useTransactions } from '../hooks/useTransactions'

// ── Componentes Auxiliares ──

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="glass-card w-full max-w-lg mx-4 p-6 rounded-2xl border border-nexo-border"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-nexo-text">{title}</h3>
          <button onClick={onClose} className="text-nexo-muted hover:text-nexo-text"><X size={20} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

function TransactionForm({ onSubmit, initialData = null, onCancel }) {
  const [form, setForm] = useState({
    type: initialData?.type || 'income',
    amount: initialData?.amount || '',
    description: initialData?.description || '',
    category: initialData?.category || 'outros',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || ''
  })

  const categories = {
    income: ['pagamento-cliente', 'investimento', 'outros'],
    expense: ['hosting', 'ferramentas', 'marketing', 'salario', 'impostos', 'outros']
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setForm({ ...form, type: 'income' })}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            form.type === 'income' ? 'bg-nexo-success/20 text-nexo-success border border-nexo-success/30' : 'bg-nexo-card text-nexo-muted'
          }`}
        >
          <ArrowDownLeft size={14} className="inline mr-1" /> Entrada
        </button>
        <button
          type="button"
          onClick={() => setForm({ ...form, type: 'expense' })}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            form.type === 'expense' ? 'bg-nexo-danger/20 text-nexo-danger border border-nexo-danger/30' : 'bg-nexo-card text-nexo-muted'
          }`}
        >
          <ArrowUpRight size={14} className="inline mr-1" /> Saída
        </button>
      </div>

      {/* Valor */}
      <div>
        <label className="text-xs text-nexo-muted mb-1 block">Valor (€)</label>
        <input
          type="number"
          step="0.01"
          required
          value={form.amount}
          onChange={e => setForm({ ...form, amount: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-nexo-bg border border-nexo-border text-nexo-text focus:border-nexo-primary focus:outline-none"
          placeholder="0,00"
        />
      </div>

      {/* Descrição */}
      <div>
        <label className="text-xs text-nexo-muted mb-1 block">Descrição</label>
        <input
          type="text"
          required
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-nexo-bg border border-nexo-border text-nexo-text focus:border-nexo-primary focus:outline-none"
          placeholder="Ex: Pagamento Paulo Santafe"
        />
      </div>

      {/* Categoria */}
      <div>
        <label className="text-xs text-nexo-muted mb-1 block">Categoria</label>
        <select
          value={form.category}
          onChange={e => setForm({ ...form, category: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-nexo-bg border border-nexo-border text-nexo-text focus:border-nexo-primary focus:outline-none"
        >
          {categories[form.type].map(c => (
            <option key={c} value={c}>{c.replace('-', ' ').toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Data */}
      <div>
        <label className="text-xs text-nexo-muted mb-1 block">Data</label>
        <input
          type="date"
          value={form.date}
          onChange={e => setForm({ ...form, date: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-nexo-bg border border-nexo-border text-nexo-text focus:border-nexo-primary focus:outline-none"
        />
      </div>

      {/* Notas */}
      <div>
        <label className="text-xs text-nexo-muted mb-1 block">Notas (opcional)</label>
        <textarea
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-nexo-bg border border-nexo-border text-nexo-text focus:border-nexo-primary focus:outline-none resize-none"
          rows={2}
          placeholder="Observações..."
        />
      </div>

      {/* Botões */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg bg-nexo-card text-nexo-muted hover:text-nexo-text transition-colors text-sm font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 py-2 rounded-lg bg-nexo-primary text-white hover:bg-nexo-primary/80 transition-colors text-sm font-medium"
        >
          {initialData ? 'Salvar Alterações' : 'Adicionar'}
        </button>
      </div>
    </form>
  )
}

// ── Página Principal ──

export default function Financeiro() {
  const {
    transactions,
    summary,
    loading,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } = useTransactions(5000)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [filter, setFilter] = useState('all')
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Filtra transações
  const filteredTx = transactions.filter(t => {
    if (filter === 'all') return true
    return t.type === filter
  })

  // Calcula saldo acumulado para cada linha
  let runningBalance = 0
  const txWithBalance = [...filteredTx].reverse().map(t => {
    runningBalance += t.type === 'income' ? t.amount : -t.amount
    return { ...t, runningBalance }
  }).reverse()

  const handleAdd = async (form) => {
    await addTransaction(form)
    setModalOpen(false)
  }

  const handleEdit = async (form) => {
    await updateTransaction(editingTx.id, form)
    setEditingTx(null)
    setModalOpen(false)
  }

  const handleDelete = async (id) => {
    await deleteTransaction(id)
    setConfirmDelete(null)
  }

  const openEdit = (tx) => {
    setEditingTx(tx)
    setModalOpen(true)
  }

  const openAdd = () => {
    setEditingTx(null)
    setModalOpen(true)
  }

  if (loading) return <div className="text-nexo-muted p-6">Carregando...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexo-text">Financeiro</h1>
          <p className="text-nexo-muted text-sm">Gestão completa de entradas e saídas</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexo-primary text-white hover:bg-nexo-primary/80 transition-colors text-sm font-medium"
        >
          <Plus size={16} /> Nova Transação
        </button>
      </div>

      {/* Cards de Resumo — TODOS REATIVOS, mesma fonte de dados */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-5 rounded-xl border border-nexo-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-nexo-muted uppercase">Caixa</p>
              <p className={`text-2xl font-bold ${(summary?.balance?.value || 0) >= 0 ? 'text-nexo-text' : 'text-nexo-danger'}`}>
                € {(summary?.balance?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-nexo-primary/20 flex items-center justify-center">
              <Wallet size={20} className="text-nexo-primary" />
            </div>
          </div>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-5 rounded-xl border border-nexo-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-nexo-muted uppercase">Entradas</p>
              <p className="text-2xl font-bold text-nexo-success">
                € {(summary?.totalIncome?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-nexo-success/20 flex items-center justify-center">
              <TrendingUp size={20} className="text-nexo-success" />
            </div>
          </div>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-5 rounded-xl border border-nexo-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-nexo-muted uppercase">Saídas</p>
              <p className="text-2xl font-bold text-nexo-danger">
                € {(summary?.totalExpense?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-nexo-danger/20 flex items-center justify-center">
              <TrendingDown size={20} className="text-nexo-danger" />
            </div>
          </div>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-5 rounded-xl border border-nexo-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-nexo-muted uppercase">Pendente</p>
              <p className="text-2xl font-bold text-nexo-warning">
                € {(summary?.pendingPayments?.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-nexo-warning/20 flex items-center justify-center">
              <AlertCircle size={20} className="text-nexo-warning" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'Todas', icon: Filter },
          { key: 'income', label: 'Entradas', icon: ArrowDownLeft },
          { key: 'expense', label: 'Saídas', icon: ArrowUpRight }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-nexo-primary text-white'
                : 'bg-nexo-card text-nexo-muted hover:text-nexo-text'
            }`}
          >
            <f.icon size={14} /> {f.label}
          </button>
        ))}
      </div>

      {/* Extrato Completo com Ações */}
      <div className="glass-card rounded-xl border border-nexo-border overflow-hidden">
        <div className="p-4 border-b border-nexo-border flex items-center justify-between">
          <h3 className="font-semibold text-nexo-text flex items-center gap-2">
            <Calendar size={16} className="text-nexo-primary" />
            Extrato Completo ({filteredTx.length} transações)
          </h3>
        </div>

        <div className="divide-y divide-nexo-border">
          {txWithBalance.length === 0 && (
            <div className="p-8 text-center text-nexo-muted">
              <Wallet size={48} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma transação encontrada</p>
              <button onClick={openAdd} className="mt-2 text-nexo-primary hover:underline text-sm">
                Adicionar primeira transação
              </button>
            </div>
          )}

          {txWithBalance.map((tx, idx) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-center justify-between p-4 hover:bg-nexo-card/30 transition-colors group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Ícone tipo */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'income' ? 'bg-nexo-success/20' : 'bg-nexo-danger/20'
                }`}>
                  {tx.type === 'income'
                    ? <ArrowDownLeft size={18} className="text-nexo-success" />
                    : <ArrowUpRight size={18} className="text-nexo-danger" />
                  }
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-nexo-text truncate">{tx.description}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      tx.type === 'income' ? 'bg-nexo-success/10 text-nexo-success' : 'bg-nexo-danger/10 text-nexo-danger'
                    }`}>
                      {tx.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-nexo-muted mt-0.5">
                    <span className="flex items-center gap-1"><Calendar size={10} /> {tx.date}</span>
                    {tx.notes && <span className="truncate max-w-xs">{tx.notes}</span>}
                  </div>
                </div>
              </div>

              {/* Valores + Ações */}
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`font-bold ${tx.type === 'income' ? 'text-nexo-success' : 'text-nexo-danger'}`}>
                    {tx.type === 'income' ? '+' : '-'} € {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-nexo-muted">
                    Saldo: € {tx.runningBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Ações — aparecem no hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(tx)}
                    className="p-1.5 rounded-lg text-nexo-muted hover:text-nexo-primary hover:bg-nexo-primary/10 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(tx)}
                    className="p-1.5 rounded-lg text-nexo-muted hover:text-nexo-danger hover:bg-nexo-danger/10 transition-colors"
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal: Adicionar/Editar */}
      <AnimatePresence>
        {modalOpen && (
          <Modal
            open={modalOpen}
            onClose={() => { setModalOpen(false); setEditingTx(null) }}
            title={editingTx ? 'Editar Transação' : 'Nova Transação'}
          >
            <TransactionForm
              onSubmit={editingTx ? handleEdit : handleAdd}
              initialData={editingTx}
              onCancel={() => { setModalOpen(false); setEditingTx(null) }}
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* Modal: Confirmar Delete */}
      <AnimatePresence>
        {confirmDelete && (
          <Modal
            open={!!confirmDelete}
            onClose={() => setConfirmDelete(null)}
            title="Confirmar Remoção"
          >
            <div className="space-y-4">
              <p className="text-nexo-text">
                Tem certeza que deseja remover <strong>"{confirmDelete.description}"</strong>?
              </p>
              <p className="text-sm text-nexo-muted">
                Valor: {confirmDelete.type === 'income' ? '+' : '-'} € {confirmDelete.amount.toLocaleString('pt-BR')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2 rounded-lg bg-nexo-card text-nexo-muted hover:text-nexo-text transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete.id)}
                  className="flex-1 py-2 rounded-lg bg-nexo-danger text-white hover:bg-nexo-danger/80 transition-colors text-sm font-medium"
                >
                  Remover
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
