import React from 'react'
import { motion } from 'framer-motion'

/**
 * @typedef {Object} ExpenseCategoryBadgeProps
 * @property {string} category
 * @property {string} [label]
 */

const CATEGORY_COLORS = {
  hosting:   { bg: 'rgba(224,86,253,0.12)',  text: '#e056fd' },
  ai_tools:  { bg: 'rgba(104,109,224,0.12)',  text: '#686de0' },
  software:  { bg: 'rgba(123,237,159,0.12)',  text: '#7bed9f' },
  marketing: { bg: 'rgba(255,107,129,0.12)',  text: '#ff6b81' },
  others:    { bg: 'rgba(149,175,192,0.12)',  text: '#95afc0' },
}

/** @param {ExpenseCategoryBadgeProps} props */
export default function ExpenseCategoryBadge({ category, label }) {
  const cfg = CATEGORY_COLORS[category] || CATEGORY_COLORS.others
  const displayLabel = label || category

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{
        background: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.text}25`,
      }}
    >
      {displayLabel}
    </motion.span>
  )
}
