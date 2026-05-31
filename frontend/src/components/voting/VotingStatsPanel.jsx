import React from 'react'
import { Clock, CheckCircle2, XCircle, Vote } from 'lucide-react'

export default function VotingStatsPanel({ stats }) {
  const items = [
    { label: 'Em Aberto', value: stats?.open || 0, icon: Clock, color: 'text-nexo-warning', bg: 'bg-nexo-warning/10' },
    { label: 'Aprovadas', value: stats?.approved || 0, icon: CheckCircle2, color: 'text-nexo-success', bg: 'bg-nexo-success/10' },
    { label: 'Rejeitadas', value: stats?.rejected || 0, icon: XCircle, color: 'text-nexo-danger', bg: 'bg-nexo-danger/10' },
    { label: 'Total', value: stats?.total || 0, icon: Vote, color: 'text-nexo-info', bg: 'bg-nexo-info/10' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(item => (
        <div key={item.label} className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold leading-none">{item.value}</div>
              <div className="text-xs text-nexo-muted mt-1">{item.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
