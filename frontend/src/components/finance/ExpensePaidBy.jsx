import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock } from 'lucide-react'

/**
 * @typedef {Object} PaidByEntry
 * @property {boolean} paid
 * @property {number} amount
 * @property {string} [paidAt]
 * @property {string} [method]
 *
 * @typedef {Object} ExpensePaidByProps
 * @property {Record<string, PaidByEntry>} paidBy
 * @property {string[]} splitAmong
 */

const PERSON_NAMES = {
  abner: 'Abner',
  nonoke: 'Nonoke',
  elias: 'Elias',
}

const PERSON_COLORS = {
  abner: '#3742fa',
  nonoke: '#2ed573',
  elias: '#ffa502',
}

/** @param {ExpensePaidByProps} props */
export default function ExpensePaidBy({ paidBy = {}, splitAmong = [] }) {
  const people = splitAmong.map(id => ({
    id,
    name: PERSON_NAMES[id] || id,
    initial: (PERSON_NAMES[id] || id).charAt(0).toUpperCase(),
    color: PERSON_COLORS[id] || '#95afc0',
    paid: paidBy[id]?.paid || false,
  }))

  return (
    <div className="flex items-center gap-4">
      {people.map((person, idx) => (
        <motion.div
          key={person.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.08, duration: 0.25 }}
          className="flex flex-col items-center gap-1"
        >
          {/* Avatar */}
          <div className="relative">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: person.color }}
            >
              {person.initial}
            </div>
            {/* Status indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-nexo-bg flex items-center justify-center">
              {person.paid ? (
                <CheckCircle2 size={12} className="text-nexo-success" />
              ) : (
                <Clock size={12} className="text-nexo-warning" />
              )}
            </div>
          </div>
          {/* Name */}
          <span className="text-[10px] text-nexo-muted">{person.name}</span>
        </motion.div>
      ))}
    </div>
  )
}
