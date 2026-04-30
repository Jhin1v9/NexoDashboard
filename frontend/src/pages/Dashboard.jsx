import { motion } from 'framer-motion'
import { Users, CheckSquare, AlertTriangle, TrendingUp } from 'lucide-react'
import useRealtime from '../hooks/useRealtime'
import HealthTimeline from '../components/charts/HealthTimeline'
import PortfolioRadar from '../components/charts/PortfolioRadar'
import BugVelocity from '../components/charts/BugVelocity'
import ClientBurnup from '../components/charts/ClientBurnup'

const StatCard = ({ icon: Icon, label, value, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card p-4 flex items-center gap-4"
  >
    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div>
      <div className="text-2xl font-bold font-heading">{value}</div>
      <div className="text-xs text-nexo-muted">{label}</div>
    </div>
  </motion.div>
)

export default function Dashboard() {
  const { data } = useRealtime('/api/state', 30000)
  const clients = data?.clients || []
  const tasks = data?.tasks || []
  const predictions = data?.predictions || []

  const pendingTasks = tasks.filter(t => !t.completed).length
  const avgHealth = clients.length > 0
    ? Math.round(clients.reduce((a, c) => a + c.health, 0) / clients.length)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Dashboard</h1>
        <span className="text-xs text-nexo-muted">{new Date().toLocaleDateString('pt-BR')}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Clientes Ativos" value={clients.length} color="#6c5ce7" />
        <StatCard icon={CheckSquare} label="Tarefas Pendentes" value={pendingTasks} color="#ffa502" />
        <StatCard icon={TrendingUp} label="Health Médio" value={`${avgHealth}%`} color="#2ed573" />
        <StatCard icon={AlertTriangle} label="Alertas" value={predictions.length} color="#ff4757" />
      </div>

      {/* Predictions */}
      {predictions.length > 0 && (
        <div className="glass-card p-4">
          <h2 className="text-sm font-medium mb-3 text-nexo-muted">Decision Cockpit</h2>
          <div className="space-y-2">
            {predictions.map((p, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                p.type === 'danger' ? 'bg-nexo-danger/10 text-nexo-danger' :
                p.type === 'warning' ? 'bg-nexo-warning/10 text-nexo-warning' :
                'bg-nexo-info/10 text-nexo-info'
              }`}>
                <AlertTriangle size={14} />
                <span>{p.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HealthTimeline />
        <PortfolioRadar />
        <BugVelocity />
        <ClientBurnup />
      </div>

      {/* Recent Projects */}
      <div className="glass-card p-4">
        <h2 className="text-sm font-medium mb-4 text-nexo-muted">Clientes Recentes</h2>
        <div className="space-y-3">
          {clients.map(client => (
            <div key={client.id} className="flex items-center justify-between py-2 border-b border-nexo-border last:border-0">
              <div>
                <div className="font-medium text-sm">{client.name}</div>
                <div className="text-xs text-nexo-muted">
                  {Object.entries(client.folders).filter(([,v]) => v).length}/5 pastas
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-nexo-card rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${client.health}%`,
                      backgroundColor: client.health > 70 ? '#2ed573' : client.health > 40 ? '#ffa502' : '#ff4757'
                    }}
                  />
                </div>
                <span className="text-xs font-medium w-8 text-right">{client.health}%</span>
              </div>
            </div>
          ))}
          {clients.length === 0 && (
            <div className="text-center text-nexo-muted text-sm py-4">Nenhum cliente encontrado</div>
          )}
        </div>
      </div>
    </div>
  )
}
