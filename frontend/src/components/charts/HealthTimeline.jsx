import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const data = [
  { dia: 'Seg', health: 65 },
  { dia: 'Ter', health: 72 },
  { dia: 'Qua', health: 68 },
  { dia: 'Qui', health: 80 },
  { dia: 'Sex', health: 85 },
  { dia: 'Sab', health: 78 },
  { dia: 'Dom', health: 82 },
]

export default function HealthTimeline() {
  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium mb-4 text-nexo-muted">Health Timeline</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6c5ce7" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6c5ce7" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
          <XAxis dataKey="dia" stroke="#6c757d" fontSize={12} />
          <YAxis stroke="#6c757d" fontSize={12} domain={[0, 100]} />
          <Tooltip
            contentStyle={{ background: '#0f0f16', border: '1px solid #1a1a2e', borderRadius: 8 }}
            labelStyle={{ color: '#e0e0e0' }}
          />
          <Area type="monotone" dataKey="health" stroke="#6c5ce7" fillOpacity={1} fill="url(#healthGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
