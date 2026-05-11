import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useMemo } from 'react'

const SEMANAS = ['S1', 'S2', 'S3', 'S4']

export default function BugVelocity({ tasks = [] }) {
  const data = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return SEMANAS.map(s => ({ semana: s, criadas: 0, completadas: 0 }))
    }

    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)

    const semanaCounts = SEMANAS.map((s, i) => {
      const semanaInicio = new Date(inicioMes)
      semanaInicio.setDate(1 + i * 7)
      const semanaFim = new Date(semanaInicio)
      semanaFim.setDate(semanaInicio.getDate() + 7)

      let criadas = 0
      let completadas = 0

      tasks.forEach(t => {
        const created = t.createdAt ? new Date(t.createdAt) : null
        const completed = t.completedAt ? new Date(t.completedAt) : null

        if (created && created >= semanaInicio && created < semanaFim) criadas++
        if (completed && completed >= semanaInicio && completed < semanaFim) completadas++
      })

      return { semana: s, criadas, completadas }
    })

    return semanaCounts
  }, [tasks])

  const hasData = data.some(d => d.criadas > 0 || d.completadas > 0)

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium mb-4 text-nexo-muted">Task Velocity (Este Mes)</h3>
      {!hasData ? (
        <div className="flex items-center justify-center h-[200px] text-nexo-muted text-xs">
          Sem dados de tarefas este mes
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
            <XAxis dataKey="semana" stroke="#6c757d" fontSize={12} />
            <YAxis stroke="#6c757d" fontSize={12} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0f0f16', border: '1px solid #1a1a2e', borderRadius: 8 }}
            />
            <Bar dataKey="criadas" fill="#6366f1" radius={[4, 4, 0, 0]} name="Criadas" />
            <Bar dataKey="completadas" fill="#22c55e" radius={[4, 4, 0, 0]} name="Completadas" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
