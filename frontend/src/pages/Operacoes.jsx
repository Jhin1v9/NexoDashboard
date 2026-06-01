import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, AlertTriangle, CheckCircle, Clock, MessageSquare,
  TrendingUp, TrendingDown, Zap, Users, GitBranch, Server,
  X, Bell, RefreshCw, Command, BarChart3, Eye,
  CheckSquare, Lightbulb, Gavel, ChevronRight
} from 'lucide-react'
import useRealtime from '../hooks/useRealtime'

// ── Componentes Auxiliares ──

function MetricCard({ title, value, change, icon: Icon, color, onClick }) {
  const isPositive = change >= 0
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass-card p-5 rounded-xl border border-nexo-border cursor-pointer hover:border-nexo-primary/50 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-nexo-muted uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-nexo-text mt-1">{value}</p>
          {change !== undefined && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${isPositive ? 'text-nexo-success' : 'text-nexo-danger'}`}>
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isPositive ? '+' : ''}{change}%
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </motion.div>
  )
}

function AlertItem({ alert, onDismiss }) {
  const icons = {
    warning: AlertTriangle,
    error: AlertTriangle,
    info: Bell,
    success: CheckCircle
  }
  const colors = {
    warning: 'border-nexo-warning/30 bg-nexo-warning/10',
    error: 'border-nexo-danger/30 bg-nexo-danger/10',
    info: 'border-nexo-info/30 bg-nexo-info/10',
    success: 'border-nexo-success/30 bg-nexo-success/10'
  }
  const Icon = icons[alert.type] || Bell

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`p-3 rounded-lg border ${colors[alert.type] || colors.info} flex items-start gap-3`}
    >
      <Icon size={16} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-nexo-text">{alert.message}</p>
        <p className="text-xs text-nexo-muted mt-0.5">
          {new Date(alert.createdAt).toLocaleTimeString('pt-BR')}
        </p>
      </div>
      <button onClick={() => onDismiss(alert.id)} className="text-nexo-muted hover:text-nexo-danger transition-colors">
        <X size={14} />
      </button>
    </motion.div>
  )
}

function ActivityDetailModal({ change, onClose }) {
  if (!change) return null;
  const details = change.details;
  const hasMessages = details?.messages?.length > 0;
  const hasTasks = details?.tasks?.length > 0;
  const hasIdeas = details?.ideas?.length > 0;
  const hasDecisions = details?.decisions?.length > 0;
  const hasAny = hasMessages || hasTasks || hasIdeas || hasDecisions;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-nexo-card border border-nexo-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-nexo-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-nexo-text">Detalhes da Atividade</h3>
              <p className="text-xs text-nexo-muted">{change.message}</p>
            </div>
            <button onClick={onClose} className="text-nexo-muted hover:text-nexo-text transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
            {!hasAny && (
              <p className="text-nexo-muted text-sm text-center py-4">Nenhum detalhe disponível para esta atividade.</p>
            )}
            {hasMessages && (
              <div>
                <h4 className="text-sm font-medium text-nexo-success mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Mensagens ({details.messages.length})
                </h4>
                <div className="space-y-2">
                  {details.messages.slice(0, 20).map((msg, i) => (
                    <div key={i} className="bg-nexo-bg/50 p-2 rounded text-sm text-nexo-text border-l-2 border-nexo-success">
                      <p className="truncate">{msg.text || msg}</p>
                      {msg.author && <p className="text-xs text-nexo-muted mt-1">{msg.author}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasTasks && (
              <div>
                <h4 className="text-sm font-medium text-nexo-warning mb-2 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" /> Tarefas ({details.tasks.length})
                </h4>
                <div className="space-y-2">
                  {details.tasks.slice(0, 20).map((task, i) => (
                    <div key={i} className="bg-nexo-bg/50 p-2 rounded text-sm text-nexo-text border-l-2 border-nexo-warning flex items-center gap-2">
                      <CheckSquare className="w-3 h-3 text-nexo-warning" />
                      <span>{task.text || task}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasIdeas && (
              <div>
                <h4 className="text-sm font-medium text-nexo-primary mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" /> Ideias ({details.ideas.length})
                </h4>
                <div className="space-y-2">
                  {details.ideas.slice(0, 20).map((idea, i) => (
                    <div key={i} className="bg-nexo-bg/50 p-2 rounded text-sm text-nexo-text border-l-2 border-nexo-primary flex items-center gap-2">
                      <Lightbulb className="w-3 h-3 text-nexo-primary" />
                      <span>{idea.text || idea}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasDecisions && (
              <div>
                <h4 className="text-sm font-medium text-nexo-info mb-2 flex items-center gap-2">
                  <Gavel className="w-4 h-4" /> Decisões ({details.decisions.length})
                </h4>
                <div className="space-y-2">
                  {details.decisions.slice(0, 20).map((dec, i) => (
                    <div key={i} className="bg-nexo-bg/50 p-2 rounded text-sm text-nexo-text border-l-2 border-nexo-info flex items-center gap-2">
                      <Gavel className="w-3 h-3 text-nexo-info" />
                      <span>{dec.text || dec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ActivityFeed({ changes }) {
  const [selectedChange, setSelectedChange] = useState(null);
  return (
    <>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {(changes || []).slice(0, 20).map((change) => (
            <motion.div
              key={change.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex items-center gap-3 p-2 rounded-lg hover:bg-nexo-card/50 transition-colors ${change.details ? 'cursor-pointer' : ''}`}
              onClick={() => change.details && setSelectedChange(change)}
            >
              <div className={`w-2 h-2 rounded-full ${
                change.type === 'finance' ? 'bg-nexo-primary' :
                change.type === 'github' ? 'bg-nexo-warning' :
                'bg-nexo-info'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-nexo-text truncate">{change.message}</p>
                <p className="text-xs text-nexo-muted">
                  {new Date(change.timestamp).toLocaleTimeString('pt-BR')}
                </p>
              </div>
              {change.details && <ChevronRight className="w-4 h-4 text-nexo-muted" />}
            </motion.div>
          ))}
        </AnimatePresence>
        {(!changes || changes.length === 0) && (
          <p className="text-center text-nexo-muted text-sm py-8">Nenhuma atividade recente</p>
        )}
      </div>
      <ActivityDetailModal change={selectedChange} onClose={() => setSelectedChange(null)} />
    </>
  )
}

function ExecutiveSummary({ data }) {
  const tasks = data?.tasks || []
  const payments = data?.payments || []

  // Gera resumo em linguagem natural
  const summary = []

  // Caixa
  const cashBox = data?.cashBox
  if (cashBox) {
    if (cashBox.balance?.value <= 0) {
      summary.push(`⚠️ Caixa está em ${cashBox.balance.value} ${cashBox.balance.currency}. É necessário receber pagamentos.`)
    } else {
      summary.push(`✅ Caixa positivo: ${cashBox.balance.value} ${cashBox.balance.currency}`)
    }
  }

  // Pagamentos pendentes
  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'waiting_quote')
  if (pendingPayments.length > 0) {
    const total = pendingPayments.reduce((s, p) => s + (p.totalAmount?.value || 0), 0)
    summary.push(`💰 ${pendingPayments.length} pagamento(s) pendente(s) totalizando € ${total.toLocaleString('pt-BR')}`)
  }

  // Tarefas
  const highPriorityTasks = tasks.filter?.(t => t.priority === 'high') || []
  if (highPriorityTasks.length > 0) {
    summary.push(`🔴 ${highPriorityTasks.length} tarefa${highPriorityTasks.length > 1 ? 's' : ''} de alta prioridade`)
  }

  if (summary.length === 0) {
    summary.push('📊 Sistema operando normalmente. Nenhum alerta no momento.')
  }

  return (
    <div className="glass-card p-5 rounded-xl border border-nexo-primary/30 bg-nexo-primary/5">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={18} className="text-nexo-primary" />
        <h3 className="font-semibold text-nexo-text">Resumo Executivo</h3>
      </div>
      <div className="space-y-2">
        {summary.map((item, idx) => (
          <motion.p
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="text-sm text-nexo-text"
          >
            {item}
          </motion.p>
        ))}
      </div>
    </div>
  )
}

// ── Página Principal ──

export default function Operacoes() {
  const { data: opsData } = useRealtime('/api/ops', 10000)
  const { data: cashBox } = useRealtime('/api/cash-box', 30000)
  const { data: payments } = useRealtime('/api/payments', 30000)
  const { data: tasks } = useRealtime('/api/tasks', 30000)

  const [selectedMetric, setSelectedMetric] = useState(null)
  const [alerts, setAlerts] = useState([])

  // Sync alerts from server
  useEffect(() => {
    if (opsData?.alerts) {
      setAlerts(opsData.alerts)
    }
  }, [opsData])

  const dismissAlert = async (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
    try {
      await fetch('/api/ops/alerts/' + id, { method: 'DELETE' })
    } catch {}
  }

  // Calcula métricas
  const balance = cashBox?.balance?.value || 0
  const pendingAmount = (payments || []).filter(p => p.status === 'pending' || p.status === 'waiting_quote')
    .reduce((s, p) => s + (p.totalAmount?.value || 0), 0)
  const totalTasks = (tasks || []).length
  const metrics = [
    { title: 'Caixa', value: `€ ${balance.toLocaleString('pt-BR')}`, change: balance >= 0 ? 0 : -100, icon: Activity, color: 'bg-nexo-primary' },
    { title: 'Pendente', value: `€ ${pendingAmount.toLocaleString('pt-BR')}`, icon: Clock, color: 'bg-nexo-warning' },
    { title: 'Tarefas', value: totalTasks, icon: CheckCircle, color: 'bg-nexo-success' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexo-text flex items-center gap-2">
            <Command size={24} className="text-nexo-primary" />
            Centro de Operações
          </h1>
          <p className="text-nexo-muted text-sm">Command Center NEXO Digital</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nexo-success/20 text-nexo-success text-xs">
            <div className="w-2 h-2 rounded-full bg-nexo-success animate-pulse" />
            Sistema Online
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-2 rounded-lg bg-nexo-card text-nexo-muted hover:text-nexo-text transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <ExecutiveSummary data={{ cashBox, payments, tasks }} />

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m, idx) => (
          <MetricCard
            key={idx}
            {...m}
            onClick={() => setSelectedMetric(selectedMetric === idx ? null : idx)}
          />
        ))}
      </div>

      {/* Drill-down panel */}
      <AnimatePresence>
        {selectedMetric !== null && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="glass-card p-5 rounded-xl border border-nexo-border overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-nexo-text">{metrics[selectedMetric].title} - Detalhes</h3>
              <button onClick={() => setSelectedMetric(null)} className="text-nexo-muted hover:text-nexo-text">
                <X size={16} />
              </button>
            </div>
            {selectedMetric === 0 && cashBox?.history && (
              <div className="space-y-2">
                {cashBox.history.slice(0, 5).map((h, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-nexo-muted">{h.source}</span>
                    <span className={h.type === 'income' ? 'text-nexo-success' : 'text-nexo-danger'}>
                      {h.type === 'income' ? '+' : '-'} € {h.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {selectedMetric === 1 && payments && (
              <div className="space-y-2">
                {payments.filter(p => p.status === 'pending' || p.status === 'waiting_quote').map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-nexo-muted">{p.clientName}</span>
                    <span className="text-nexo-warning">€ {p.totalAmount?.value?.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedMetric === 2 && tasks && (
              <div className="space-y-2">
                {tasks.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-nexo-muted">{t.title || t.text}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${t.priority === 'high' ? 'bg-nexo-danger/20 text-nexo-danger' : 'bg-nexo-warning/20 text-nexo-warning'}`}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {selectedMetric === 3 && wappData?.recentMessages && (
              <div className="space-y-2">
                {wappData.recentMessages.slice(0, 5).map((m, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-nexo-muted">[{m.group}] {m.sender}:</span>
                    <span className="text-nexo-text ml-1">{m.text?.substring(0, 60)}...</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="glass-card p-5 rounded-xl border border-nexo-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-nexo-text flex items-center gap-2">
              <AlertTriangle size={16} className="text-nexo-warning" />
              Alertas ({alerts.length})
            </h3>
          </div>
          <div className="space-y-2">
            <AnimatePresence>
              {alerts.map(alert => (
                <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} />
              ))}
            </AnimatePresence>
            {alerts.length === 0 && (
              <p className="text-center text-nexo-muted text-sm py-8">Nenhum alerta ativo</p>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="glass-card p-5 rounded-xl border border-nexo-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-nexo-text flex items-center gap-2">
              <Activity size={16} className="text-nexo-info" />
              Atividade Recente
            </h3>
          </div>
          <ActivityFeed changes={opsData?.recentChanges} />
        </div>
      </div>

      {/* System Health */}
      <div className="glass-card p-5 rounded-xl border border-nexo-border">
        <h3 className="font-semibold text-nexo-text mb-4 flex items-center gap-2">
          <Server size={16} className="text-nexo-primary" />
          Saúde do Sistema
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { name: 'Backend API', status: 'online', latency: '12ms' },
            { name: 'WebSocket', status: 'online', latency: '8ms' },
            { name: 'Chrome CDP', status: 'online', latency: '9223' },
          ].map((svc, i) => (
            <div key={i} className="p-3 rounded-lg bg-nexo-card/50 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${svc.status === 'online' ? 'bg-nexo-success' : svc.status === 'warning' ? 'bg-nexo-warning' : 'bg-nexo-danger'}`} />
              <div>
                <div className="text-sm font-medium text-nexo-text">{svc.name}</div>
                <div className="text-xs text-nexo-muted">{svc.latency}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

