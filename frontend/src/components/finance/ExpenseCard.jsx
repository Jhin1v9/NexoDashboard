import { useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Power, Ban, CreditCard } from 'lucide-react'
import ExpenseCategoryBadge from './ExpenseCategoryBadge'
import RecurringBadge from './RecurringBadge'
import ExpensePaidBy from './ExpensePaidBy'

/**
 * @typedef {Object} ExpenseAmount
 * @property {number} value
 * @property {string} currency
 *
 * @typedef {Object} PaidByEntry
 * @property {boolean} paid
 * @property {number} amount
 * @property {string} [paidAt]
 * @property {string} [method]
 *
 * @typedef {Object} Expense
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {ExpenseAmount} amount
 * @property {ExpenseAmount} [costPerPerson]
 * @property {string} type
 * @property {string} [period]
 * @property {string} [periodLabel]
 * @property {string} [renewDate]
 * @property {string} category
 * @property {string} [categoryLabel]
 * @property {string[]} splitAmong
 * @property {Record<string, PaidByEntry>} paidBy
 * @property {boolean} [fullyPaid]
 * @property {boolean} [autoDeductFromCashBox]
 * @property {string} [notes]
 *
 * @typedef {Object} ExpenseCardProps
 * @property {Expense} expense
 * @property {() => void} [onEdit]
 * @property {() => void} [onPayMyShare]
 * @property {() => void} [onToggleActive]
 * @property {() => void} [onClick]
 */

/** @param {ExpenseCardProps} props */
export default function ExpenseCard({
  expense,
  onEdit,
  onPayMyShare,
  onToggleActive,
  onClick,
}) {
  const [isActive, setIsActive] = useState(expense.type === 'recurring' ? true : false)

  const formatCurrency = (val, cur) => {
    const symbol = cur === 'BRL' ? 'R$' : cur === 'EUR' ? '€' : cur === 'USD' ? '$' : cur
    return `${symbol} ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }

  const handleToggle = () => {
    setIsActive(prev => !prev)
    onToggleActive?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card p-5 relative group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-heading text-base font-bold text-white truncate">
            {expense.name}
          </h3>
          {expense.description && (
            <p className="text-xs text-nexo-muted mt-0.5 line-clamp-1">
              {expense.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expense.type === 'recurring' && expense.period && (
            <RecurringBadge period={expense.period} />
          )}
          <ExpenseCategoryBadge
            category={expense.category}
            label={expense.categoryLabel || expense.category}
          />
        </div>
      </div>

      {/* Amounts */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-xl font-heading font-bold text-white">
          {formatCurrency(expense.amount?.value, expense.amount?.currency)}
        </span>
        {expense.costPerPerson && (
          <span className="text-xs text-nexo-muted">
            {formatCurrency(expense.costPerPerson.value, expense.costPerPerson.currency)}/pessoa
          </span>
        )}
      </div>

      {/* Paid By Avatars */}
      {expense.paidBy && expense.splitAmong && (
        <div className="mb-4">
          <ExpensePaidBy paidBy={expense.paidBy} splitAmong={expense.splitAmong} />
        </div>
      )}

      {/* Renew date */}
      {expense.renewDate && (
        <div className="text-[11px] text-nexo-muted mb-3">
          Renovação: {new Date(expense.renewDate).toLocaleDateString('pt-BR')}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-nexo-border/40">
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={(e) => { e.stopPropagation(); onEdit?.() }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-nexo-card text-xs text-nexo-muted hover:text-white hover:bg-nexo-border transition-colors"
        >
          <Pencil size={12} />
          Editar
        </motion.button>

        {onPayMyShare && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => { e.stopPropagation(); onPayMyShare?.() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-nexo-info/10 text-xs text-nexo-info hover:bg-nexo-info/20 transition-colors border border-nexo-info/20"
          >
            <CreditCard size={12} />
            Pagar minha parte
          </motion.button>
        )}

        {expense.type === 'recurring' && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => { e.stopPropagation(); handleToggle() }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors border ${
              isActive
                ? 'bg-nexo-success/10 text-nexo-success border-nexo-success/20'
                : 'bg-nexo-muted/10 text-nexo-muted border-nexo-muted/20'
            }`}
          >
            <Power size={12} />
            {isActive ? 'Ativo' : 'Inativo'}
          </motion.button>
        )}

        {onToggleActive && expense.type !== 'recurring' && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={(e) => { e.stopPropagation(); onToggleActive() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-nexo-danger/10 text-xs text-nexo-danger hover:bg-nexo-danger/20 transition-colors border border-nexo-danger/20"
          >
            <Ban size={12} />
            Desativar
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

