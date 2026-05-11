import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useMemo } from 'react'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

export default function HealthTimeline({ tasks = [] }) {
  const data = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return DIAS.slice(1).map(dia => ({ dia, criadas: 0, completadas: 0 }))
    }

    const hoje = new Date()
    const inicioSemana = new Date(hoje)
    inicioSemana.setDate(hoje.getDate() - hoje.getDay())
    inicioSemana.setHours(0, 0, 0, 0)

    const counts = {}
    DIAS.forEach(d => { counts[d] = { criadas: 0, completadas: 0 } })

    tasks.forEach(t => {
      const created = t.createdAt ? new Date(t.createdAt) : null
      const completed = t.completedAt ? new Date(t.completedAt) : null

      if (created && created >= inicioSemana) {
        const dia = DIAS[created.getDay()]
        counts[dia].criadas++
      }
      if (completed && completed >= inicioSemana) {
        const dia = DIAS[completed.getDay()]
        counts[dia].completadas++
      }
    })

    return DIAS.slice(1).map(dia => ({ dia, ...counts[dia] }))
  }, [tasks])

  const hasData = data.some(d => d.criadas > 0 || d.completadas > 0)

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium mb-4 text-nexo-muted">Tarefas por Dia (Esta Semana)</h3>
      {!hasData ? (
        <div className="flex items-center justify-center h-[200px] text-nexo-muted text-xs">
          Sem dados de tarefas esta semana
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="doneGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
            <XAxis dataKey="dia" stroke="#6c757d" fontSize={12} />
            <YAxis stroke="#6c757d" fontSize={12} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0f0f16', border: '1px solid #1a1a2e', borderRadius: 8 }}
              labelStyle={{ color: '#e0e0e0' }}
            />
            <Area type="monotone" dataKey="criadas" stroke="#6366f1" fillOpacity={1} fill="url(#createdGrad)" name="Criadas" />
            <Area type="monotone" dataKey="completadas" stroke="#22c55e" fillOpacity={1} fill="url(#doneGrad)" name="Completadas" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
