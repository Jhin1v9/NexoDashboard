import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'

const data = [
  { subject: 'Código', A: 80, fullMark: 100 },
  { subject: 'Design', A: 65, fullMark: 100 },
  { subject: 'Tests', A: 45, fullMark: 100 },
  { subject: 'Docs', A: 70, fullMark: 100 },
  { subject: 'Deploy', A: 90, fullMark: 100 },
  { subject: 'SEO', A: 55, fullMark: 100 },
]

export default function PortfolioRadar() {
  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium mb-4 text-nexo-muted">Portfolio Radar</h3>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={data}>
          <PolarGrid stroke="#1a1a2e" />
          <PolarAngleAxis dataKey="subject" stroke="#6c757d" fontSize={11} />
          <PolarRadiusAxis stroke="#1a1a2e" fontSize={10} />
          <Radar name="Score" dataKey="A" stroke="#2ed573" fill="#2ed573" fillOpacity={0.2} />
          <Tooltip
            contentStyle={{ background: '#0f0f16', border: '1px solid #1a1a2e', borderRadius: 8 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

