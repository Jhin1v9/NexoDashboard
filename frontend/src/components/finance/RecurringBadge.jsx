import React from 'react'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

/**
 * @typedef {Object} RecurringBadgeProps
 * @property {string} period
 */

const PERIOD_LABELS = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  annual: 'Anual',
  custom: 'Custom',
}

/** @param {RecurringBadgeProps} props */
export default function RecurringBadge({ period }) {
  const label = PERIOD_LABELS[period] || period

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: 'rgba(108,92,231,0.12)',
        color: '#6c5ce7',
        border: '1px solid rgba(108,92,231,0.25)',
      }}
    >
      <RefreshCw size={10} />
      {label}
    </motion.span>
  )
}
