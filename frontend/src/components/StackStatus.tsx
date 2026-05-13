import { useState, useEffect, useRef } from 'react'
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Server,
  Globe,
  Plug,
  Bot,
  FileText,
  RefreshCw,
  Loader2,
} from 'lucide-react'

interface ServiceStatus {
  status: 'online' | 'offline' | 'stale' | 'error' | 'checking'
  port?: number
  uptime?: number
  last_checkpoint?: string | null
}

interface StackStatus {
  timestamp: string
  overall: 'healthy' | 'degraded' | 'checking'
  services: {
    backend: ServiceStatus
    frontend: ServiceStatus
    chrome_cdp: ServiceStatus
    luna_daemon: ServiceStatus
  }
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  backend: <Server size={14} className="text-nexo-muted" />,
  frontend: <Globe size={14} className="text-nexo-muted" />,
  chrome_cdp: <Plug size={14} className="text-nexo-muted" />,
  luna_daemon: <Bot size={14} className="text-nexo-muted" />,
}

const SERVICE_LABELS: Record<string, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
  chrome_cdp: 'Chrome CDP',
  luna_daemon: 'Luna Agent',
}

export default function StackStatusPanel() {
  const [status, setStatus] = useState<StackStatus | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/stack-status')
      if (!res.ok) throw new Error('Backend offline')
      const data = await res.json()
      setStatus(data)
      setError(null)
    } catch (e) {
      setError('Não foi possível conectar ao backend')
      setStatus(null)
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/stack-logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (e) {
      console.error('Erro ao buscar logs:', e)
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchLogs()
    setLoading(false)

    const interval = setInterval(() => {
      fetchStatus()
      fetchLogs()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (logsContainerRef.current) {
      const container = logsContainerRef.current
      container.scrollTop = container.scrollHeight
    }
  }, [logs])

  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'online':
        return { icon: <CheckCircle2 size={12} />, badge: 'bg-nexo-success/10 text-nexo-success border-nexo-success/20', text: 'Online' }
      case 'offline':
        return { icon: <XCircle size={12} />, badge: 'bg-nexo-danger/10 text-nexo-danger border-nexo-danger/20', text: 'Offline' }
      case 'stale':
        return { icon: <AlertTriangle size={12} />, badge: 'bg-nexo-warning/10 text-nexo-warning border-nexo-warning/20', text: 'Stale' }
      case 'error':
        return { icon: <AlertTriangle size={12} />, badge: 'bg-nexo-danger/10 text-nexo-danger border-nexo-danger/20', text: 'Erro' }
      default:
        return { icon: <Clock size={12} />, badge: 'bg-nexo-muted/10 text-nexo-muted border-nexo-muted/20', text: 'Verificando...' }
    }
  }

  const getOverallBadge = () => {
    switch (status?.overall) {
      case 'healthy':
        return 'bg-nexo-success/10 text-nexo-success border-nexo-success/20'
      case 'degraded':
        return 'bg-nexo-warning/10 text-nexo-warning border-nexo-warning/20'
      default:
        return 'bg-nexo-muted/10 text-nexo-muted border-nexo-muted/20'
    }
  }

  const getOverallLabel = () => {
    switch (status?.overall) {
      case 'healthy': return 'Tudo OK'
      case 'degraded': return 'Degradado'
      default: return 'Verificando'
    }
  }

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-4 border border-nexo-border">
        <div className="flex items-center gap-2 text-nexo-muted animate-pulse">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Carregando status...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl border border-nexo-border overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-nexo-border">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-nexo-info" />
          <h2 className="text-sm font-medium text-nexo-text">NEXO Stack Status</h2>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${getOverallBadge()}`}>
          {getOverallLabel()}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-2 rounded-lg bg-nexo-danger/10 border border-nexo-danger/20 text-nexo-danger text-xs">
          {error}
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {status && Object.entries(status.services).map(([name, service]) => {
          const cfg = getStatusConfig(service.status)
          return (
            <div key={name} className="glass-card rounded-lg p-3 border border-nexo-border">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {SERVICE_ICONS[name]}
                  <span className="text-xs font-medium text-nexo-text">
                    {SERVICE_LABELS[name]}
                  </span>
                </div>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${cfg.badge}`}>
                  {cfg.icon} {cfg.text}
                </span>
              </div>
              {service.port && (
                <div className="text-[10px] text-nexo-muted">Porta: {service.port}</div>
              )}
              {service.uptime && (
                <div className="text-[10px] text-nexo-muted">
                  Uptime: {Math.floor(service.uptime / 60)}m {Math.floor(service.uptime % 60)}s
                </div>
              )}
              {service.last_checkpoint && (
                <div className="text-[10px] text-nexo-muted">
                  Último scan: {new Date(service.last_checkpoint).toLocaleTimeString()}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Logs */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <FileText size={12} className="text-nexo-muted" />
          <span className="text-xs text-nexo-muted">Logs do Stack</span>
          <span className="text-[10px] text-nexo-muted/60">({logs.length} linhas)</span>
        </div>
        <div
          ref={logsContainerRef}
          className="bg-nexo-bg rounded-lg border border-nexo-border p-2 h-28 overflow-y-auto font-mono text-[10px] leading-relaxed"
        >
          {logs.length === 0 ? (
            <span className="text-nexo-muted/40">Nenhum log disponível...</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`${
                log.includes('CRASHOU') || log.includes('ERRO') ? 'text-nexo-danger' :
                log.includes('sucesso') || log.includes('OK') ? 'text-nexo-success' :
                'text-nexo-muted'
              }`}>
                {log}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-nexo-border text-[10px] text-nexo-muted/50 text-right">
        Atualizado: {status ? new Date(status.timestamp).toLocaleTimeString() : '---'}
      </div>
    </div>
  )
}
