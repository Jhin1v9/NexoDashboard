import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const data = [
  { cliente: 'Juan', completo: 75, pendente: 25 },
  { cliente: 'Paulo', completo: 60, pendente: 40 },
]

export default function ClientBurnup() {
  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium mb-4 text-nexo-muted">Client Progress</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
          <XAxis type="number" stroke="#6c757d" fontSize={12} domain={[0, 100]} />
          <YAxis dataKey="cliente" type="category" stroke="#6c757d" fontSize={12} />
          <Tooltip
            contentStyle={{ background: '#0f0f16', border: '1px solid #1a1a2e', borderRadius: 8 }}
            formatter={(value) => `${value}%`}
          />
          <Bar dataKey="completo" stackId="a" fill="#2ed573" radius={[0, 4, 4, 0]} />
          <Bar dataKey="pendente" stackId="a" fill="#ffa502" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
