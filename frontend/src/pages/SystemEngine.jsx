import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Server, Globe, Activity, RefreshCw, Play, Square, RotateCcw,
  Terminal, Eye, EyeOff, Cpu, Wifi, WifiOff, CheckCircle, XCircle,
  Loader, AlertTriangle, HardDrive, Clock
} from 'lucide-react'
import axios from 'axios'
// REMOVIDO: StackStatus e AutoFixPanel chamavam APIs inexistentes (/api/stack-status, /api/auto-fix/*)
// import StackStatusPanel from '../components/StackStatus'
// import AutoFixPanel from '../components/AutoFixPanel'

const SERVICES = [
  { key: 'backend', label: 'Backend API', icon: Server, port: 3456, log: 'backend' },
  { key: 'frontend', label: 'Frontend Vite', icon: Globe, port: 3457, log: 'frontend' },
  { key: 'luna', label: 'Agente Luna', icon: Cpu, port: null, log: 'luna' },
  { key: 'supervisor', label: 'Supervisor', icon: Activity, port: null, log: 'supervisor' },
]

const AUX_SERVICES = [
  { key: 'chrome', label: 'Chrome CDP', port: 9223 },
  { key: 'gemini', label: 'Gemini API', port: null },
]

function getLogColor(line) {
  if (line.includes('error') || line.includes('ERROR') || line.includes('FATAL') || line.includes('CRITICAL')) return 'text-red-400';
  if (line.includes('success') || line.includes('SUCCESS') || line.includes('✅')) return 'text-green-400';
  if (line.includes('warn') || line.includes('WARN')) return 'text-yellow-400';
  if (line.includes('ready') || line.includes('READY') || line.includes('rodando')) return 'text-cyan-400';
  return 'text-gray-300';
}

export default function SystemEngine() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [activeLog, setActiveLog] = useState('backend')
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef(null)
  const logsContainerRef = useRef(null)

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 3000)
    return () => clearInterval(interval)
  }, [activeLog])

  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      const container = logsContainerRef.current
      container.scrollTop = container.scrollHeight
    }
  }, [logs, autoScroll])

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/system/status')
      if (res.data.success) setStatus(res.data)
    } catch (e) {}
  }

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await axios.get(`/api/system/logs?service=${activeLog}&lines=300`)
      if (res.data.success) setLogs(res.data.logs)
    } catch (e) {}
    setLogsLoading(false)
  }

  const controlService = async (service, action) => {
    setLoading(true)
    setActionMsg('')
    try {
      const res = await axios.post('/api/system/control', { service, action })
      if (res.data.success) {
        setActionMsg(res.data.message)
        setTimeout(fetchStatus, 3000)
      }
    } catch (e) {
      setActionMsg('Erro: ' + (e.response?.data?.error || e.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-nexo-border">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-nexo-primary" />
            System Engine
          </h1>
          <p className="text-sm text-nexo-muted mt-1">Controle do motor do Dashboard — Backend, Frontend e Supervisor</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchStatus}
            className="flex items-center gap-2 px-4 py-2 bg-nexo-card text-nexo-text rounded-lg text-sm hover:bg-nexo-border transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICES.map(svc => {
            const data = status?.[svc.key]
            const isRunning = data?.running
            return (
              <motion.div key={svc.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-4 border border-nexo-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svc.icon className={`w-5 h-5 ${isRunning ? 'text-nexo-success' : 'text-nexo-danger'}`} />
                    <span className="font-semibold text-sm">{svc.label}</span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-nexo-success' : 'bg-nexo-danger'}`} />
                </div>
                <div className="space-y-1 text-xs text-nexo-muted">
                  <div className="flex justify-between">
                    <span>Status</span>
                    <span className={isRunning ? 'text-nexo-success' : 'text-nexo-danger'}>
                      {isRunning ? 'Rodando' : 'Parado'}
                    </span>
                  </div>
                  {data?.pid && (
                    <div className="flex justify-between">
                      <span>PID</span>
                      <span className="text-nexo-text font-mono">{data.pid}</span>
                    </div>
                  )}
                  {svc.port && (
                    <div className="flex justify-between">
                      <span>Porta</span>
                      <span className="text-nexo-text font-mono">{svc.port}</span>
                    </div>
                  )}
                </div>

                {/* Acoes */}
                <div className="grid grid-cols-3 gap-1 mt-3">
                    <button onClick={() => controlService(svc.key, 'start')} disabled={loading || isRunning}
                      className="flex items-center justify-center gap-1 p-1.5 bg-nexo-bg border border-nexo-border rounded text-xs hover:bg-nexo-success/10 hover:border-nexo-success transition-colors disabled:opacity-50">
                      <Play className="w-3 h-3 text-nexo-success" />
                    </button>
                    <button onClick={() => controlService(svc.key, 'stop')} disabled={loading || !isRunning}
                      className="flex items-center justify-center gap-1 p-1.5 bg-nexo-bg border border-nexo-border rounded text-xs hover:bg-nexo-danger/10 hover:border-nexo-danger transition-colors disabled:opacity-50">
                      <Square className="w-3 h-3 text-nexo-danger" />
                    </button>
                    <button onClick={() => controlService(svc.key, 'restart')} disabled={loading}
                      className="flex items-center justify-center gap-1 p-1.5 bg-nexo-bg border border-nexo-border rounded text-xs hover:bg-nexo-primary/10 hover:border-nexo-primary transition-colors disabled:opacity-50">
                      <RotateCcw className="w-3 h-3 text-nexo-primary" />
                    </button>
                  </div>
              </motion.div>
            )
          })}
        </div>

        {/* Stack Status & Auto-Fix Panels — REMOVIDOS (APIs não existem no backend) */}
        {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StackStatusPanel />
          <AutoFixPanel />
        </div> */}

        {/* Aux Services */}
        <div className="glass-card rounded-xl p-4 border border-nexo-border">
          <h3 className="text-sm font-medium text-nexo-muted uppercase mb-3">Servicos Auxiliares</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AUX_SERVICES.map(aux => {
              const data = status?.[aux.key]
              const isUp = data?.connected
              return (
                <div key={aux.key} className="flex items-center justify-between p-3 bg-nexo-bg rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUp ? 'bg-nexo-success/10' : 'bg-nexo-danger/10'}`}>
                      {isUp ? <Wifi className="w-4 h-4 text-nexo-success" /> : <WifiOff className="w-4 h-4 text-nexo-danger" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{aux.label}</div>
                      <div className="text-xs text-nexo-muted font-mono">localhost:{aux.port}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${isUp ? 'bg-nexo-success/10 text-nexo-success' : 'bg-nexo-danger/10 text-nexo-danger'}`}>
                    {isUp ? 'Conectado' : 'Offline'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Action Message */}
        {actionMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-lg text-sm font-medium ${actionMsg.includes('Erro') ? 'bg-nexo-danger/10 text-nexo-danger' : 'bg-nexo-success/10 text-nexo-success'}`}>
            {actionMsg}
          </motion.div>
        )}

        {/* Logs Terminal */}
        <div className="glass-card rounded-xl border border-nexo-border overflow-hidden flex flex-col" style={{ minHeight: '400px' }}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-nexo-border bg-nexo-bg/30">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-nexo-primary" />
              <span className="text-sm font-medium">Logs do Sistema</span>
              <span className="text-xs text-nexo-muted">({logs.length} linhas)</span>
            </div>
            <div className="flex items-center gap-2">
              {SERVICES.map(svc => (
                <button key={svc.key} onClick={() => setActiveLog(svc.log)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeLog === svc.log ? 'bg-nexo-primary text-white' : 'bg-nexo-card text-nexo-muted hover:bg-nexo-border'}`}>
                  {svc.label}
                </button>
              ))}
              <button onClick={() => setAutoScroll(!autoScroll)}
                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${autoScroll ? 'bg-nexo-primary text-white' : 'bg-nexo-card text-nexo-muted'}`}>
                {autoScroll ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                Auto
              </button>
              <button onClick={fetchLogs}
                className="flex items-center gap-1 px-3 py-1 bg-nexo-card text-nexo-muted rounded text-xs hover:bg-nexo-border transition-colors">
                <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div ref={logsContainerRef} className="flex-1 bg-black/70 overflow-y-auto p-3 font-mono text-xs leading-relaxed" style={{ minHeight: '320px' }}>
            {logs.length === 0 && (
              <p className="text-nexo-muted text-center py-8">Nenhum log encontrado.</p>
            )}
            {logs.map((line, i) => (
              <div key={i} className={`${getLogColor(line)} break-all whitespace-pre-wrap`}>
                {line}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* System Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-4 border border-nexo-border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-nexo-muted" />
              <span className="text-sm font-medium">Uptime Backend</span>
            </div>
            <div className="text-2xl font-bold font-mono">{status?.uptime ? Math.floor(status.uptime / 60) + 'm ' + Math.floor(status.uptime % 60) + 's' : '--'}</div>
          </div>
          <div className="glass-card rounded-xl p-4 border border-nexo-border">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-nexo-muted" />
              <span className="text-sm font-medium">Ultimo Check</span>
            </div>
            <div className="text-sm font-mono text-nexo-muted">
              {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString('pt-BR') : '--'}
            </div>
          </div>
          <div className="glass-card rounded-xl p-4 border border-nexo-border">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-nexo-muted" />
              <span className="text-sm font-medium">Node Version</span>
            </div>
            <div className="text-2xl font-bold font-mono">{status ? (typeof process !== 'undefined' && process.version ? process.version : 'N/A') : '--'}</div>
          </div>
        </div>

      </div>
    </div>
  )
}
