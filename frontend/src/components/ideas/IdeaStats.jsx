import React from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, MessageSquare, CheckCircle, User } from 'lucide-react'

export default function IdeaStats({ stats }) {
  const cards = [
    {
      label: 'Total de Ideias',
      value: stats.total || 0,
      icon: Lightbulb,
      iconColor: 'text-nexo-primary',
      bgColor: 'bg-nexo-primary/20'
    },
    {
      label: 'Em Discuss\u00e3o',
      value: stats.byStatus?.['em-discussao'] || 0,
      icon: MessageSquare,
      iconColor: 'text-nexo-warning',
      bgColor: 'bg-nexo-warning/20'
    },
    {
      label: 'Aprovadas',
      value: (stats.byStatus?.['aprovada'] || 0) + (stats.byStatus?.['em-andamento'] || 0),
      icon: CheckCircle,
      iconColor: 'text-nexo-success',
      bgColor: 'bg-nexo-success/20'
    },
    {
      label: 'Minhas Ideias',
      value: stats.myIdeas || 0,
      icon: User,
      iconColor: 'text-purple-400',
      bgColor: 'bg-purple-500/20'
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map((card, i) => {
        const Icon = card.icon
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className="glass-card p-4 flex items-center gap-4"
          >
            <div className={`w-11 h-11 rounded-xl ${card.bgColor} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-nexo-text">{card.value}</p>
              <p className="text-[11px] text-nexo-muted uppercase tracking-wide">{card.label}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
