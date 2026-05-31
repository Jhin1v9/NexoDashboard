import React from 'react'
﻿import { motion } from 'framer-motion'
import {
  CreditCard, Banknote, Wallet, Smartphone, Clock, CheckCircle2
} from 'lucide-react'

/**
 * @typedef {Object} TimelineTransaction
 * @property {string} id
 * @property {string} date
 * @property {{value:number,currency:string}} amount
 * @property {string} method
 * @property {string} [methodLabel]
 * @property {string} paidBy
 * @property {number} [phase]
 * @property {string} [notes]
 *
 * @typedef {Object} PaymentTimelineProps
 * @property {TimelineTransaction[]} transactions
 */

const METHOD_CONFIG = {
  card:     { icon: CreditCard,  color: '#5f27cd', label: 'Cartão' },
  transfer: { icon: Banknote,   color: '#10ac84', label: 'Transferência' },
  cash:     { icon: Wallet,     color: '#f9ca24', label: 'Dinheiro' },
  bizum:    { icon: Smartphone, color: '#22a6b3', label: 'Bizum' },
  other:    { icon: Clock,      color: '#95afc0', label: 'Outro' },
}

/** @param {PaymentTimelineProps} props */
export default function PaymentTimeline({ transactions = [] }) {
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date))

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatCurrency = (val, cur) => {
    const symbol = cur === 'BRL' ? 'R$' : cur === 'EUR' ? '€' : cur === 'USD' ? '$' : cur
    return `${symbol} ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }

  if (sorted.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-nexo-muted text-sm">
        Nenhuma transação registrada.
      </div>
    )
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium mb-5 text-nexo-muted font-heading">
        Histórico de Transações
      </h3>
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-nexo-border" />

        {sorted.map((tx, idx) => {
          const isLast = idx === sorted.length - 1
          const methodCfg = METHOD_CONFIG[tx.method] || METHOD_CONFIG.other
          const MethodIcon = methodCfg.icon

          return (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.3 }}
              className={`relative pb-5 ${isLast ? '' : ''}`}
            >
              {/* Dot */}
              <div
                className={`absolute left-[-17px] top-1 w-[9px] h-[9px] rounded-full border-2 ${
                  isLast ? 'border-nexo-success bg-nexo-success' : 'border-nexo-border bg-nexo-card'
                }`}
                style={isLast ? { boxShadow: '0 0 8px rgba(46,213,115,0.4)' } : {}}
              />

              <div
                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border ${
                  isLast
                    ? 'bg-nexo-success/5 border-nexo-success/20'
                    : 'bg-transparent border-nexo-border/40'
                }`}
              >
                {/* Date */}
                <div className="text-xs text-nexo-muted min-w-[80px]">
                  {formatDate(tx.date)}
                </div>

                {/* Method icon + Amount */}
                <div className="flex items-center gap-2 min-w-[120px]">
                  <div
                    className="p-1.5 rounded-md"
                    style={{ background: `${methodCfg.color}15` }}
                  >
                    <MethodIcon size={14} style={{ color: methodCfg.color }} />
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {formatCurrency(tx.amount?.value || 0, tx.amount?.currency || 'EUR')}
                  </span>
                </div>

                {/* Paid by + Phase */}
                <div className="flex items-center gap-2 text-xs text-nexo-muted">
                  <span>por <span className="text-white font-medium">{tx.paidBy}</span></span>
                  {tx.phase && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase"
                      style={{ background: 'rgba(108,92,231,0.12)', color: '#6c5ce7' }}
                    >
                      Parcela {tx.phase}
                    </span>
                  )}
                </div>

                {/* Notes */}
                {tx.notes && (
                  <div className="text-xs text-nexo-muted italic truncate max-w-[200px]">
                    “{tx.notes}”
                  </div>
                )}

                {/* Last indicator */}
                {isLast && (
                  <CheckCircle2 size={14} className="text-nexo-success ml-auto shrink-0" />
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

