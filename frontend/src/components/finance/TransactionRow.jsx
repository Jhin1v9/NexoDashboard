import React from 'react'
﻿import { motion } from 'framer-motion'
import {
  CreditCard, Banknote, Wallet, Smartphone, Clock
} from 'lucide-react'

/**
 * @typedef {Object} TransactionRowTx
 * @property {string} id
 * @property {string} date
 * @property {{value:number,currency:string}} amount
 * @property {string} method
 * @property {string} [methodLabel]
 * @property {string} paidBy
 * @property {string} [notes]
 * @property {number} [phase]
 *
 * @typedef {Object} TransactionRowProps
 * @property {TransactionRowTx} transaction
 * @property {number} [index]
 */

const METHOD_CONFIG = {
  card:     { icon: CreditCard,  color: '#5f27cd', label: 'Cartão' },
  transfer: { icon: Banknote,   color: '#10ac84', label: 'Transferência' },
  cash:     { icon: Wallet,     color: '#f9ca24', label: 'Dinheiro' },
  bizum:    { icon: Smartphone, color: '#22a6b3', label: 'Bizum' },
  other:    { icon: Clock,      color: '#95afc0', label: 'Outro' },
}

/** @param {TransactionRowProps} props */
export default function TransactionRow({ transaction, index = 0 }) {
  const methodCfg = METHOD_CONFIG[transaction.method] || METHOD_CONFIG.other
  const MethodIcon = methodCfg.icon

  const formatCurrency = (val, cur) => {
    const symbol = cur === 'BRL' ? 'R$' : cur === 'EUR' ? '€' : cur === 'USD' ? '$' : cur
    return `${symbol} ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="flex items-center gap-4 px-4 py-3 border-b border-nexo-border/30 hover:bg-nexo-card/40 transition-colors"
    >
      {/* Date */}
      <div className="w-16 shrink-0 text-xs text-nexo-muted">
        {formatDate(transaction.date)}
      </div>

      {/* Amount */}
      <div className="w-24 shrink-0 text-sm font-semibold text-white">
        {formatCurrency(transaction.amount?.value, transaction.amount?.currency)}
      </div>

      {/* Method */}
      <div className="w-28 shrink-0 flex items-center gap-1.5">
        <div
          className="p-1 rounded"
          style={{ background: `${methodCfg.color}15` }}
        >
          <MethodIcon size={12} style={{ color: methodCfg.color }} />
        </div>
        <span className="text-xs" style={{ color: methodCfg.color }}>
          {transaction.methodLabel || methodCfg.label}
        </span>
      </div>

      {/* Paid by */}
      <div className="w-24 shrink-0 text-xs text-nexo-muted">
        por <span className="text-white font-medium">{transaction.paidBy}</span>
      </div>

      {/* Phase badge */}
      {transaction.phase && (
        <div
          className="px-2 py-0.5 rounded text-[10px] font-medium uppercase shrink-0"
          style={{ background: 'rgba(108,92,231,0.12)', color: '#6c5ce7' }}
        >
          P{transaction.phase}
        </div>
      )}

      {/* Notes */}
      {transaction.notes && (
        <div className="flex-1 min-w-0 text-xs text-nexo-muted truncate">
          {transaction.notes}
        </div>
      )}
    </motion.div>
  )
}

