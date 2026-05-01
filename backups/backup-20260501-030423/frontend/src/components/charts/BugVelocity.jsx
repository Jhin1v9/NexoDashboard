import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const data = [
  { semana: 'S1', bugs: 12, fixes: 8 },
  { semana: 'S2', bugs: 8, fixes: 10 },
  { semana: 'S3', bugs: 15, fixes: 12 },
  { semana: 'S4', bugs: 6, fixes: 14 },
  { semana: 'S5', bugs: 4, fixes: 9 },
]

export default function BugVelocity() {
  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium mb-4 text-nexo-muted">Bug Velocity</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
          <XAxis dataKey="semana" stroke="#6c757d" fontSize={12} />
          <YAxis stroke="#6c757d" fontSize={12} />
          <Tooltip
            contentStyle={{ background: '#0f0f16', border: '1px solid #1a1a2e', borderRadius: 8 }}
          />
          <Bar dataKey="bugs" fill="#ff4757" radius={[4, 4, 0, 0]} />
          <Bar dataKey="fixes" fill="#2ed573" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
