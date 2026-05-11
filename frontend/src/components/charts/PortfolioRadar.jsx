import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#ef4444',
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e'
}

export default function PortfolioRadar({ tasks = [], view = 'status' }) {
  const data = useMemo(() => {
    if (!tasks || tasks.length === 0) return []

    const counts = {}
    tasks.forEach(t => {
      const key = view === 'status' ? (t.status || 'pending') : (t.priority || 'medium')
      counts[key] = (counts[key] || 0) + 1
    })

    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value,
      color: COLORS[name] || '#6366f1'
    }))
  }, [tasks, view])

  const total = data.reduce((a, b) => a + b.value, 0)

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium mb-4 text-nexo-muted">
        {view === 'status' ? 'Tarefas por Status' : 'Tarefas por Prioridade'}
      </h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-nexo-muted text-xs">
          Sem tarefas para analisar
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0f0f16', border: '1px solid #1a1a2e', borderRadius: 8 }}
              formatter={(value, name) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
