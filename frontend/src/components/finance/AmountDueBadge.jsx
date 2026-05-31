import React from 'react'
﻿import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'

/**
 * @typedef {Object} AmountDueBadgeProps
 * @property {number} amount
 * @property {string} [currency]
 * @property {boolean} [isSevere]
 */

/** @param {AmountDueBadgeProps} props */
export default function AmountDueBadge({ amount, currency = 'EUR', isSevere = false }) {
  const formatCurrency = (val, cur) => {
    const symbol = cur === 'BRL' ? 'R$' : cur === 'EUR' ? '€' : cur === 'USD' ? '$' : cur
    return `${symbol} ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
        isSevere ? 'animate-pulse' : ''
      }`}
      style={{
        background: 'rgba(255,71,87,0.15)',
        color: '#ff4757',
        border: '1px solid rgba(255,71,87,0.35)',
      }}
    >
      <AlertCircle size={14} />
      Falta {formatCurrency(amount, currency)}
    </motion.div>
  )
}

