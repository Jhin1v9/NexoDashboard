import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, CheckSquare, AlertTriangle, TrendingUp, TrendingDown,
  Bell, Plus, Trash2, FileText, Zap, Wallet,
  ArrowUpRight, ArrowDownRight, PiggyBank, Receipt, ShoppingCart,
  CircleDollarSign, Target, Activity, Calendar, Clock, Moon,
  Terminal, Play, Square, ExternalLink
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useRealtime from '../hooks/useRealtime'
import useNotifications from '../hooks/useNotifications'
import axios from 'axios'
import HealthTimeline from '../components/charts/HealthTimeline'
import PortfolioRadar from '../components/charts/PortfolioRadar'
import BugVelocity from '../components/charts/BugVelocity'
import ClientBurnup from '../components/charts/ClientBurnup'
import DevLogTerminal from '../components/workspace/DevLogTerminal'


// ── Components ─────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, color, subtext, onClick, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`glass-card p-4 flex items-center gap-4 ${onClick ? 'cursor-pointer hover:border-nexo-primary/50 transition-colors' : ''}`}
    onClick={onClick}
  >
    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-2xl font-bold font-heading">{value}</div>
      <div className="text-xs text-nexo-muted">{label}</div>
      {subtext && <div className="text-[10px] mt-0.5" style={{ color }}>{subtext}</div>}
      {trend && (
        <div className={`text-[10px] flex items-center gap-1 mt-0.5 ${trend > 0 ? 'text-nexo-success' : 'text-nexo-danger'}`}>
          {trend > 0 ? <TrendingUp size={10} /> : <TrendDown size={10} />}
          {trend > 0 ? '+' : ''}{trend}%
        </div>
      )}
    </div>
  </motion.div>
)

const TrendDown = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 17 7 7"/><path d="M7 17V7h10"/>
  </svg>
)

// Lembretes locais
function useLocalReminders() {
  const [reminders, setReminders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nexo-reminders') || '[]') }
    catch { return [] }
  })
  useEffect(() => { localStorage.setItem('nexo-reminders', JSON.stringify(reminders)) }, [reminders])
  const add = (text) => {
    const r = { id: Date.now().toString(), text, createdAt: new Date().toISOString(), completed: false }
    setReminders(prev => [...prev, r])
    return r
  }
  const toggle = (id) => setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: !r.completed } : r))
  const remove = (id) => setReminders(prev => prev.filter(r => r.id !== id))
  return { reminders, add, toggle, remove }
}

// Financial mini-chart bar
const MiniBar = ({ value, max, color }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full h-1.5 bg-nexo-card rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data } = useRealtime('/api/state', 30000)
  const { data: lunaData } = useRealtime('/api/luna/status', 30000)
  const { data: summaryData } = useRealtime('/api/finance/summary', 30000)
  const { data: cashBoxData } = useRealtime('/api/cash-box', 30000)
  const { notify } = useNotifications()
  const { reminders, add, toggle, remove } = useLocalReminders()
  
  const [newReminder, setNewReminder] = useState('')
  const [showReminders, setShowReminders] = useState(true)

  const clients = data?.clients || []
  const tasks = data?.tasks || []
  const predictions = data?.predictions || []
  const summary = summaryData || {}
  const cashBox = cashBoxData || {}

  const pendingTasks = tasks.filter(t => !t.completed).length
  const avgHealth = clients.length > 0 ? Math.round(clients.reduce((a, c) => a + c.health, 0) / clients.length) : 0
  const moneyValue = (value, fallback = 0) => {
    if (typeof value === 'number') return isNaN(value) ? fallback : value
    if (value && typeof value.value === 'number') return isNaN(value.value) ? fallback : value.value
    return fallback
  }

  // Financial metrics — TODOS REATIVOS da API /api/finance/summary
  const totalExpected = moneyValue(summary.totalExpected)
  const totalReceived = moneyValue(summary.totalReceived)
  const totalPending = moneyValue(summary.totalPending)
  const cashBalance = moneyValue(summary.cashBalance ?? summary.balance ?? summary.cashBoxBalance, moneyValue(cashBox.balance))
  const monthlyExpenses = moneyValue(summary.monthlyExpenses ?? summary.totalExpense, moneyValue(cashBox.monthlyExpenses))
  const totalIncome = moneyValue(summary.totalIncome, totalReceived)

  // Payment progress
  const paymentProgress = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0

  // Alerts for notifications
  useEffect(() => {
    if (predictions.length > 0) {
      const danger = predictions.filter(p => p.type === 'danger')
      if (danger.length > 0) {
        notify('Alerta NEXO', { body: danger[0].msg, tag: 'nexo-alert', requireInteraction: true })
      }
    }
  }, [predictions])

  const handleAddReminder = () => {
    if (!newReminder.trim()) return
    add(newReminder.trim())
    setNewReminder('')
    notify('Lembrete adicionado', { body: newReminder.trim(), tag: 'reminder' })
  }

  // Servidores locais ativos (Workspace)
  const [runningServers, setRunningServers] = useState([])
  const [activeLogServer, setActiveLogServer] = useState(null)
  const token = localStorage.getItem('nexo_token') || ''
  const api = axios.create({ headers: { Authorization: `Bearer ${token}` } })

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await api.get('/api/workspace/servers')
        setRunningServers(res.data.servers || [])
      } catch { /* ignore — endpoint pode não existir online ainda */ }
    }
    fetchServers()
    const iv = setInterval(fetchServers, 5000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Dashboard</h1>
          <p className="text-xs text-nexo-muted mt-1">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/financeiro')} className="px-3 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors flex items-center gap-1.5">
            <Wallet size={14} /> Financas
          </button>
        </div>
      </div>

      {/* Financial Overview — EXTRAORDINARIO */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-nexo-muted flex items-center gap-2">
            <CircleDollarSign size={16} className="text-nexo-success" />
            Resumo Financeiro
          </h2>
          <button onClick={() => navigate('/financeiro')} className="text-xs text-nexo-info hover:underline">Ver detalhes →</button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-xs text-nexo-muted mb-1">Caixa Atual</div>
            <div className="text-2xl font-bold text-nexo-success">€{cashBalance.toFixed(2)}</div>
            <MiniBar value={cashBalance} max={1000} color="#22c55e" />
          </div>
          <div className="text-center">
            <div className="text-xs text-nexo-muted mb-1">Recebido</div>
            <div className="text-2xl font-bold text-nexo-info">€{totalReceived.toFixed(2)}</div>
            <MiniBar value={totalReceived} max={totalExpected} color="#3b82f6" />
          </div>
          <div className="text-center">
            <div className="text-xs text-nexo-muted mb-1">Pendente</div>
            <div className="text-2xl font-bold text-nexo-warning">€{totalPending.toFixed(2)}</div>
            <MiniBar value={totalPending} max={totalExpected} color="#f59e0b" />
          </div>
          <div className="text-center">
            <div className="text-xs text-nexo-muted mb-1">Gastos/Mes</div>
            <div className="text-2xl font-bold text-nexo-danger">€{monthlyExpenses.toFixed(2)}</div>
            <MiniBar value={monthlyExpenses} max={100} color="#ef4444" />
          </div>
        </div>

        {/* Payment Progress */}
        <div className="bg-nexo-card rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-nexo-muted">Progresso de Recebimentos</span>
            <span className="text-xs font-bold">{paymentProgress}%</span>
          </div>
          <div className="w-full h-3 bg-nexo-bg rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${paymentProgress}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-nexo-success via-nexo-info to-nexo-success"
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-nexo-muted">
            <span>€{totalReceived} recebido</span>
            <span>€{totalExpected} total</span>
          </div>
        </div>
      </motion.div>

      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Clientes" value={clients.length} color="#6366f1" 
          onClick={() => navigate('/clientes')} />
        <StatCard icon={CheckSquare} label="Tarefas" value={pendingTasks} color="#f59e0b" 
          onClick={() => navigate('/tarefas')} />
        <StatCard icon={TrendingUp} label="Health" value={`${avgHealth}%`} color="#22c55e" />
        <StatCard icon={AlertTriangle} label="Alertas" value={predictions.length} color="#ef4444" />
      </div>

      {/* Luna + Reminders Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Luna Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="glass-card p-5 cursor-pointer hover:border-nexo-primary/30 transition-colors"
          onClick={() => navigate('/luna')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-nexo-muted flex items-center gap-2">
              <Moon size={16} className="text-nexo-primary" />
              Luna v18.0
            </h2>
            <span className="text-xs text-nexo-info hover:underline">Control →</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-nexo-card rounded-lg">
              <div className={`text-lg font-bold ${lunaData?.status?.toLowerCase() === 'online' ? 'text-nexo-success' : 'text-nexo-danger'}`}>
                {lunaData?.status || 'Offline'}
              </div>
              <div className="text-[10px] text-nexo-muted">Status</div>
            </div>
            <div className="text-center p-2 bg-nexo-card rounded-lg">
              <div className="text-lg font-bold text-nexo-warning">{lunaData?.buffer?.newTasks?.length || 0}</div>
              <div className="text-[10px] text-nexo-muted">Tarefas</div>
            </div>
            <div className="text-center p-2 bg-nexo-card rounded-lg">
              <div className="text-lg font-bold text-nexo-info">{lunaData?.buffer?.newLeads?.length || 0}</div>
              <div className="text-[10px] text-nexo-muted">Leads</div>
            </div>
            <div className="text-center p-2 bg-nexo-card rounded-lg">
              <div className="text-lg font-bold text-nexo-primary">{lunaData?.lastScan ? new Date(lunaData.lastScan).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
              <div className="text-[10px] text-nexo-muted">Último Scan</div>
            </div>
          </div>
        </motion.div>

        {/* Lembretes */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-nexo-muted flex items-center gap-2">
              <Bell size={16} className="text-nexo-warning" />
              Lembretes ({reminders.filter(r => !r.completed).length})
            </h2>
            <button onClick={() => setShowReminders(!showReminders)} className="text-xs text-nexo-muted hover:text-white">
              {showReminders ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          
          {showReminders && (
            <>
              <div className="flex gap-2 mb-3">
                <input
                  className="flex-1 px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
                  placeholder="Novo lembrete..."
                  value={newReminder}
                  onChange={e => setNewReminder(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddReminder()}
                />
                <button onClick={handleAddReminder} className="p-2 bg-nexo-info rounded-lg hover:opacity-90">
                  <Plus size={16} className="text-white" />
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {reminders.slice().reverse().map(r => (
                  <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-nexo-card/50 group">
                    <button onClick={() => toggle(r.id)} className={`w-4 h-4 rounded border flex items-center justify-center ${r.completed ? 'bg-nexo-success border-nexo-success' : 'border-nexo-muted'}`}>
                      {r.completed && <CheckSquare size={10} className="text-white" />}
                    </button>
                    <span className={`flex-1 text-xs ${r.completed ? 'line-through text-nexo-muted' : ''}`}>{r.text}</span>
                    <button onClick={() => remove(r.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-nexo-danger/20 rounded">
                      <Trash2 size={10} className="text-nexo-danger" />
                    </button>
                  </div>
                ))}
                {reminders.length === 0 && <p className="text-xs text-nexo-muted text-center py-2">Sem lembretes</p>}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Servidores Locais Ativos */}
      {runningServers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-nexo-muted flex items-center gap-2">
              <Terminal size={16} className="text-nexo-info" />
              Servidores Locais Ativos ({runningServers.length})
            </h2>
            <button onClick={() => navigate('/workspace')} className="text-xs text-nexo-info hover:underline">Workspace →</button>
          </div>
          <div className="space-y-2">
            {runningServers.map(srv => (
              <div key={srv.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-nexo-card/50 border border-nexo-border">
                <div className="w-2 h-2 rounded-full bg-nexo-success animate-pulse" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{srv.clienteId} — {srv.demoPath.split('/').pop()}</p>
                  <p className="text-[10px] text-nexo-muted">{srv.tipo} · PID {srv.pid}</p>
                </div>
                <a href={srv.url} target="_blank" rel="noreferrer" className="text-xs text-nexo-success hover:underline flex items-center gap-1">
                  <ExternalLink size={12} /> {srv.porta}
                </a>
                <button onClick={() => setActiveLogServer(srv.id)} className="p-1.5 hover:bg-nexo-card rounded-lg text-nexo-muted hover:text-nexo-text" title="Logs">
                  <Terminal size={14} />
                </button>
                <button onClick={async () => {
                  try {
                    await api.post(`/api/workspace/clients/${srv.clienteId}/stop`, { serverId: srv.id })
                    setRunningServers(prev => prev.filter(s => s.id !== srv.id))
                  } catch (e) { alert(e.response?.data?.error || e.message) }
                }} className="p-1.5 hover:bg-nexo-danger/20 text-nexo-danger rounded-lg" title="Parar">
                  <Square size={14} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

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
        <HealthTimeline tasks={tasks} />
        <PortfolioRadar tasks={tasks} />
        <BugVelocity tasks={tasks} />
        <ClientBurnup tasks={tasks} clients={clients} />
      </div>

      {/* Recent Clients */}
      <div className="glass-card p-4">
        <h2 className="text-sm font-medium mb-4 text-nexo-muted">Clientes</h2>
        <div className="space-y-3">
          {clients.map(client => (
            <div key={client.id} className="flex items-center justify-between py-2 border-b border-nexo-border last:border-0">
              <div>
                <div className="font-medium text-sm">{client.name}</div>
                <div className="text-xs text-nexo-muted">{Object.entries(client.folders || {}).filter(([,v]) => v).length}/5 pastas</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-nexo-card rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${client.health}%`, backgroundColor: client.health > 70 ? '#22c55e' : client.health > 40 ? '#f59e0b' : '#ef4444' }} />
                </div>
                <span className="text-xs font-medium w-8 text-right">{client.health}%</span>
              </div>
            </div>
          ))}
          {clients.length === 0 && <div className="text-center text-nexo-muted text-sm py-4">Nenhum cliente</div>}
        </div>
      </div>
      {/* Dev Log Terminal */}
      <DevLogTerminal serverId={activeLogServer} onClose={() => setActiveLogServer(null)} />
    </div>
  )
}





