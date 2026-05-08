import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trash2, Edit3, Check, X, Server, Brain, Code, 
  Megaphone, MoreHorizontal, Plus, Save
} from 'lucide-react'
import axios from 'axios'
import useRealtime from '../../hooks/useRealtime'

const CATEGORIES = {
  hosting: { label: 'Hosting', icon: Server, color: '#e056fd' },
  ai_tools: { label: 'IA / Tools', icon: Brain, color: '#686de0' },
  software: { label: 'Software', icon: Code, color: '#7bed9f' },
  marketing: { label: 'Marketing', icon: Megaphone, color: '#ff6b81' },
  others: { label: 'Outros', icon: MoreHorizontal, color: '#95afc0' }
}

export default function SimpleExpenses() {
  const { data: expenses, refetch } = useRealtime('/api/expenses', 15000)
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState('')

  const handleDelete = async (id) => {
    if (!confirm('Remover esta despesa?')) return
    try {
      await axios.delete(`/api/expenses/${id}`)
      refetch()
    } catch (e) {
      alert('Erro: ' + e.message)
    }
  }

  const handleEdit = (expense) => {
    setEditing(expense.id)
    setEditName(expense.name)
    setEditAmount(expense.amount?.value || '')
    setEditCategory(expense.category || 'others')
  }

  const handleSave = async (id) => {
    try {
      await axios.put(`/api/expenses/${id}`, {
        name: editName,
        amount: { value: parseFloat(editAmount), currency: 'EUR' },
        category: editCategory
      })
      setEditing(null)
      refetch()
    } catch (e) {
      alert('Erro: ' + e.message)
    }
  }

  const fmt = (v) => `€ ${parseFloat(v).toFixed(2)}`

  return (
    <div className="space-y-3">
      {expenses?.map((expense, idx) => {
        const cat = CATEGORIES[expense.category] || CATEGORIES.others
        const Icon = cat.icon
        const isEditing = editing === expense.id

        return (
          <motion.div
            key={expense.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="glass-card p-4"
          >
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  {Object.entries(CATEGORIES).map(([key, c]) => (
                    <button
                      key={key}
                      onClick={() => setEditCategory(key)}
                      className={`px-2 py-1 rounded-lg text-[10px] transition-all ${
                        editCategory === key ? 'text-white' : 'bg-nexo-card text-nexo-muted'
                      }`}
                      style={editCategory === key ? { backgroundColor: c.color } : {}}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleSave(expense.id)} className="flex items-center gap-1 px-3 py-1.5 bg-nexo-success rounded-lg text-xs">
                    <Check size={12} /> Salvar
                  </button>
                  <button onClick={() => setEditing(null)} className="flex items-center gap-1 px-3 py-1.5 bg-nexo-card rounded-lg text-xs">
                    <X size={12} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '20' }}>
                  <Icon size={18} style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{expense.name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-nexo-muted">
                    <span style={{ color: cat.color }}>{cat.label}</span>
                    {expense.type === 'recurring' && <span>• {expense.periodLabel}</span>}
                    {expense.notes && <span className="truncate">• {expense.notes}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold">{fmt(expense.amount?.value || 0)}</div>
                  {expense.costPerPerson?.value > 0 && expense.splitAmong?.length > 0 && (
                    <div className="text-[10px] text-nexo-muted">
                      {fmt(expense.costPerPerson.value)}/pessoa
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={() => handleEdit(expense)} className="p-1.5 hover:bg-nexo-card rounded-lg transition-colors">
                    <Edit3 size={14} className="text-nexo-info" />
                  </button>
                  <button onClick={() => handleDelete(expense.id)} className="p-1.5 hover:bg-nexo-danger/20 rounded-lg transition-colors">
                    <Trash2 size={14} className="text-nexo-danger" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )
      })}

      {(!expenses || expenses.length === 0) && (
        <div className="glass-card p-8 text-center">
          <p className="text-nexo-muted text-sm">Nenhuma despesa ainda</p>
          <p className="text-nexo-muted text-xs mt-1">Use o botão + no canto inferior direito</p>
        </div>
      )}
    </div>
  )
}

