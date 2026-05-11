import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useMemo } from 'react'

export default function ClientBurnup({ tasks = [], clients = [] }) {
  const data = useMemo(() => {
    if (!tasks || tasks.length === 0) return []

    // Agrupa tarefas por responsavel (assignedTo)
    const byAssignee = {}
    tasks.forEach(t => {
      const assignee = t.assignedTo || 'Nao atribuido'
      if (!byAssignee[assignee]) {
        byAssignee[assignee] = { name: assignee, total: 0, completadas: 0 }
      }
      byAssignee[assignee].total++
      if (t.status === 'completed' || t.completedAt) {
        byAssignee[assignee].completadas++
      }
    })

    return Object.values(byAssignee)
      .map(a => ({
        ...a,
        pendentes: a.total - a.completadas,
        progresso: a.total > 0 ? Math.round((a.completadas / a.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6) // max 6 assignees
  }, [tasks])

  if (data.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-sm font-medium mb-4 text-nexo-muted">Progresso por Responsavel</h3>
        <div className="flex items-center justify-center h-[200px] text-nexo-muted text-xs">
          Sem tarefas para analisar
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium mb-4 text-nexo-muted">Progresso por Responsavel</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
          <XAxis type="number" stroke="#6c757d" fontSize={12} domain={[0, 'dataMax']} allowDecimals={false} />
          <YAxis dataKey="name" type="category" stroke="#6c757d" fontSize={11} width={80} />
          <Tooltip
            contentStyle={{ background: '#0f0f16', border: '1px solid #1a1a2e', borderRadius: 8 }}
            formatter={(value, name) => [value, name === 'completadas' ? 'Completadas' : 'Pendentes']}
          />
          <Bar dataKey="completadas" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
          <Bar dataKey="pendentes" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2 text-[10px] text-nexo-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-nexo-success"/> Completadas</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-nexo-warning"/> Pendentes</span>
      </div>
    </div>
  )
}
