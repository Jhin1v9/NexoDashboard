import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Sun, Moon, Activity, Trash2, Eraser, Save, Scan,
  FileText, AtSign, Link, RefreshCw, Server, Database,
  Stethoscope, Wrench, Terminal, Zap, Heart,
  AlertTriangle, CheckCircle, XCircle, Loader, Cpu,
  Wifi, WifiOff, MessageCircle, Chrome, Play, Square,
  RotateCcw, Eye, EyeOff, ScrollText, Power
} from 'lucide-react'
import axios from 'axios'

const ICON_MAP = {
  Sun, Moon, Activity, Trash2, Eraser, Save, Scan,
  FileText, AtSign, Link, RefreshCw, Server, Database,
  Stethoscope, Wrench, Terminal, Zap, Heart,
  AlertTriangle, CheckCircle, XCircle, Loader
};

const CATEGORIES = [
  { id: 'estado', label: '🌙 Estado', icon: Activity, color: 'text-blue-400', commands: ['acordar', 'dormir', 'status'] },
  { id: 'memoria', label: '🧠 Memoria', icon: Database, color: 'text-purple-400', commands: ['limpar-memoria', 'esquecer-tudo', 'lembrar'] },
  { id: 'acoes', label: '⚡ Acoes', icon: Zap, color: 'text-yellow-400', commands: ['escanear-agora', 'gerar-relatorio', 'verificar-mencoes', 'verificar-links'] },
  { id: 'sistema', label: '🔧 Sistema', icon: Server, color: 'text-green-400', commands: ['atualizar-cache', 'reiniciar-backend', 'fazer-backup'] },
  { id: 'diagnostico', label: '🩺 Diagnostico', icon: Stethoscope, color: 'text-red-400', commands: ['diagnostico', 'autoconserto'] }
];

const TABS = [
  { id: 'comandos', label: 'Comandos', icon: Terminal },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'controle', label: 'Controle', icon: Power }
];

export default function LunaControl() {
  const [activeTab, setActiveTab] = useState('comandos')
  const [commands, setCommands] = useState([])
  const [status, setStatus] = useState(null)
  const [executing, setExecuting] = useState(null)
  const [history, setHistory] = useState([])
  const [mood, setMood] = useState({ happiness: 66, energy: 80, trust: 58, excitement: 33 })
  const [hiddenMode, setHiddenMode] = useState(false)
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [controlling, setControlling] = useState(false)
  const [controlMsg, setControlMsg] = useState('')
  const logsEndRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    fetchCommands()
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs()
      const interval = setInterval(fetchLogs, 3000)
      return () => clearInterval(interval)
    }
  }, [activeTab])

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const fetchCommands = async () => {
    try {
      const res = await axios.get('/api/luna/commands')
      if (res.data.success) setCommands(res.data.commands)
    } catch (e) {}
  }

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/luna/status')
      if (res.data) setStatus(res.data)
    } catch (e) {}
  }

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      const res = await axios.get('/api/luna/logs?lines=200')
      if (res.data.success) setLogs(res.data.logs)
    } catch (e) {}
    setLogsLoading(false)
  }

  const executeControl = async (action) => {
    setControlling(true)
    setControlMsg('')
    try {
      const res = await axios.post('/api/luna/control', { action })
      if (res.data.success) {
        setControlMsg(res.data.message)
        setTimeout(fetchStatus, 3000)
      }
    } catch (e) {
      setControlMsg('Erro: ' + (e.response?.data?.error || e.message))
    } finally {
      setControlling(false)
    }
  }

  const executeCommand = async (commandId) => {
    setExecuting(commandId)
    try {
      const res = await axios.post('/api/luna/command', { command: commandId, params: { hidden: hiddenMode } })
      if (res.data.success) {
        setHistory(prev => [res.data, ...prev].slice(0, 20))
        updateMood(commandId)
      }
    } catch (e) {
      setHistory(prev => [{ command: commandId, error: e.message, executedAt: new Date().toISOString() }, ...prev])
    } finally {
      setExecuting(null)
      fetchStatus()
    }
  }

  const updateMood = (command) => {
    setMood(prev => {
      const next = { ...prev }
      if (command === 'acordar') { next.energy = Math.min(100, next.energy + 20); next.happiness += 5; }
      if (command === 'dormir') { next.energy = Math.max(0, next.energy - 30); }
      if (command === 'limpar-memoria') { next.energy = Math.min(100, next.energy + 10); }
      if (command === 'escanear-agora') { next.energy = Math.max(0, next.energy - 15); next.excitement += 10; }
      if (command === 'gerar-relatorio') { next.trust = Math.min(100, next.trust + 5); }
      if (command === 'diagnostico') { next.happiness = Math.max(0, next.happiness - 5); }
      if (command === 'autoconserto') { next.happiness = Math.min(100, next.happiness + 10); next.trust += 10; }
      return next
    })
  }

  const isRunning = status?.status === 'running'

  return (
    <div className="h-full flex">
      {/* Sidebar Luna */}
      <div className="w-80 border-r border-nexo-border flex flex-col">
        {/* Header com Mood */}
        <div className="p-4 border-b border-nexo-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center relative">
              <Heart className="w-6 h-6 text-white" />
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-nexo-bg ${isRunning ? 'bg-nexo-success' : 'bg-nexo-danger'}`} />
            </div>
            <div>
              <h2 className="font-bold text-lg">Luna</h2>
              <p className="text-xs text-nexo-muted">
                {isRunning ? `🟢 Online${status?.pid ? ` (PID ${status.pid})` : ''}` : '🔴 Offline'}
              </p>
            </div>
          </div>

          {/* Mood Bars */}
          <div className="space-y-2">
            <MoodBar label="😊 Felicidade" value={mood.happiness} color="bg-yellow-500" />
            <MoodBar label="⚡ Energia" value={mood.energy} color="bg-blue-500" />
            <MoodBar label="💙 Confianca" value={mood.trust} color="bg-pink-500" />
            <MoodBar label="🎉 Entusiasmo" value={mood.excitement} color="bg-green-500" />
          </div>
        </div>

        {/* Status */}
        <div className="p-4 border-b border-nexo-border">
          <h3 className="text-xs font-medium text-nexo-muted uppercase mb-2">Status do Sistema</h3>
          <div className="space-y-1 text-sm">
            <StatusRow label="Agente Luna" active={isRunning} />
            <StatusRow label="Chrome CDP" active={status?.chromeConnected} />
            <StatusRow label="WhatsApp" active={status?.whatsappConnected} />
            <div className="flex justify-between">
              <span className="text-nexo-muted">Ultimo Scan</span>
              <span className="text-nexo-text">{status?.lastScan ? new Date(status.lastScan).toLocaleTimeString('pt-BR') : 'Nunca'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-nexo-muted">Msgs no Buffer</span>
              <span className="text-nexo-text">{status?.bufferMessages || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-nexo-muted">Tarefas</span>
              <span className="text-nexo-text">{status?.bufferTasks || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-nexo-muted">Historico Total</span>
              <span className="text-nexo-text">{status?.historyTotal || 0}</span>
            </div>
          </div>
        </div>

        {/* Historico de Comandos */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-medium text-nexo-muted uppercase mb-2">Historico de Comandos</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="p-2 bg-nexo-card rounded-lg text-xs">
                <div className="flex items-center gap-1 mb-1">
                  {h.error ? <XCircle className="w-3 h-3 text-nexo-danger" /> : <CheckCircle className="w-3 h-3 text-nexo-success" />}
                  <span className="font-medium">{h.command}</span>
                  <span className="text-nexo-muted ml-auto">{new Date(h.executedAt).toLocaleTimeString('pt-BR')}</span>
                </div>
                {h.error && <p className="text-nexo-danger">{h.error}</p>}
                {h.result && <p className="text-nexo-muted truncate">{JSON.stringify(h.result)}</p>}
              </div>
            ))}
            {history.length === 0 && (
              <p className="text-xs text-nexo-muted text-center py-4">Nenhum comando executado ainda</p>
            )}
          </div>
        </div>
      </div>

      {/* Conteudo Principal */}
      <div className="flex-1 flex flex-col">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-2 border-b border-nexo-border">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-nexo-primary text-white'
                  : 'text-nexo-muted hover:bg-nexo-card'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conteudo das Tabs */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* TAB: COMANDOS */}
          {activeTab === 'comandos' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Centro de Comando</h2>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={hiddenMode} onChange={(e) => setHiddenMode(e.target.checked)} className="sr-only peer" />
                  <div className="relative w-11 h-6 bg-nexo-border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-nexo-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nexo-primary"></div>
                  <span className="text-sm text-nexo-muted">{hiddenMode ? 'Modo Hidden' : 'Modo Normal'}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {CATEGORIES.map(cat => (
                  <motion.div key={cat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <cat.icon className={`w-5 h-5 ${cat.color}`} />
                      <h3 className="font-semibold">{cat.label}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {cat.commands?.map(cmdId => {
                        const cmd = commands.find(c => c.id === cmdId)
                        if (!cmd) return null
                        const Icon = ICON_MAP[cmd.icon] || Zap
                        const isExecuting = executing === cmdId
                        return (
                          <button key={cmdId} onClick={() => executeCommand(cmdId)} disabled={isExecuting || !isRunning}
                            className="p-3 bg-nexo-bg hover:bg-nexo-border border border-nexo-border rounded-lg text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <div className="flex items-center gap-2 mb-1">
                              {isExecuting ? <Loader className="w-4 h-4 text-nexo-primary animate-spin" /> : <Icon className="w-4 h-4 text-nexo-muted" />}
                              <span className="font-medium text-sm">{cmd.label}</span>
                            </div>
                            <p className="text-xs text-nexo-muted">{cmd.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {/* TAB: LOGS */}
          {activeTab === 'logs' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <ScrollText className="w-6 h-6" />
                  Logs da Luna
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setAutoScroll(!autoScroll)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${autoScroll ? 'bg-nexo-primary text-white' : 'bg-nexo-card text-nexo-muted'}`}>
                    {autoScroll ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    Auto-scroll
                  </button>
                  <button onClick={fetchLogs}
                    className="flex items-center gap-1 px-3 py-1.5 bg-nexo-card text-nexo-muted rounded-lg text-xs font-medium hover:bg-nexo-border transition-colors">
                    <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-black/50 rounded-xl border border-nexo-border overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
                  {logs.length === 0 && (
                    <p className="text-nexo-muted text-center py-8">Nenhum log encontrado.</p>
                  )}
                  {logs.map((line, i) => {
                    let color = 'text-gray-300'
                    if (line.includes('ERROR') || line.includes('FATAL')) color = 'text-red-400'
                    else if (line.includes('SUCCESS')) color = 'text-green-400'
                    else if (line.includes('WARN')) color = 'text-yellow-400'
                    else if (line.includes('COMANDO') || line.includes('MENCAO')) color = 'text-cyan-400'
                    else if (line.includes('PRIVACY')) color = 'text-orange-400'
                    else if (line.includes('PLAYWRIGHT')) color = 'text-purple-400'
                    else if (line.includes('SCAN')) color = 'text-blue-400'
                    return (
                      <div key={i} className={`${color} break-all`}>
                        {line}
                      </div>
                    )
                  })}
                  <div ref={logsEndRef} />
                </div>
                <div className="px-4 py-2 border-t border-nexo-border text-xs text-nexo-muted flex justify-between">
                  <span>{logs.length} linhas carregadas</span>
                  <span>Atualiza a cada 3s</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CONTROLE */}
          {activeTab === 'controle' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Power className="w-6 h-6" />
                Painel de Controle
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Status Card */}
                <div className="glass-card rounded-xl p-6">
                  <h3 className="text-sm font-medium text-nexo-muted uppercase mb-4">Status do Agente</h3>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isRunning ? 'bg-nexo-success/20' : 'bg-nexo-danger/20'}`}>
                      {isRunning ? <Wifi className="w-8 h-8 text-nexo-success" /> : <WifiOff className="w-8 h-8 text-nexo-danger" />}
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{isRunning ? 'ONLINE' : 'OFFLINE'}</div>
                      <div className="text-sm text-nexo-muted">{status?.pid ? `PID: ${status.pid}` : 'Nao iniciado'}</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <StatusRow label="Chrome CDP" active={status?.chromeConnected} />
                    <StatusRow label="WhatsApp Web" active={status?.whatsappConnected} />
                    <StatusRow label="Ollama LLM" active={true} />
                  </div>
                </div>

                {/* Acoes Card */}
                <div className="glass-card rounded-xl p-6 md:col-span-2">
                  <h3 className="text-sm font-medium text-nexo-muted uppercase mb-4">Acoes</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button onClick={() => executeControl('start')} disabled={controlling || isRunning}
                      className="flex flex-col items-center gap-3 p-6 bg-nexo-bg hover:bg-nexo-success/10 border border-nexo-border hover:border-nexo-success rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Play className="w-8 h-8 text-nexo-success" />
                      <span className="font-semibold">Ligar Luna</span>
                      <span className="text-xs text-nexo-muted">Inicia o agente</span>
                    </button>

                    <button onClick={() => executeControl('stop')} disabled={controlling || !isRunning}
                      className="flex flex-col items-center gap-3 p-6 bg-nexo-bg hover:bg-nexo-danger/10 border border-nexo-border hover:border-nexo-danger rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <Square className="w-8 h-8 text-nexo-danger" />
                      <span className="font-semibold">Desligar Luna</span>
                      <span className="text-xs text-nexo-muted">Para o agente</span>
                    </button>

                    <button onClick={() => executeControl('restart')} disabled={controlling}
                      className="flex flex-col items-center gap-3 p-6 bg-nexo-bg hover:bg-nexo-primary/10 border border-nexo-border hover:border-nexo-primary rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <RotateCcw className="w-8 h-8 text-nexo-primary" />
                      <span className="font-semibold">Reiniciar Luna</span>
                      <span className="text-xs text-nexo-muted">Stop + Start automatico</span>
                    </button>
                  </div>

                  {controlMsg && (
                    <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${controlMsg.includes('Erro') ? 'bg-nexo-danger/10 text-nexo-danger' : 'bg-nexo-success/10 text-nexo-success'}`}>
                      {controlMsg}
                    </div>
                  )}
                </div>
              </div>

              {/* Buffer Info */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-sm font-medium text-nexo-muted uppercase mb-4">Buffer Atual</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-nexo-bg rounded-lg text-center">
                    <div className="text-2xl font-bold text-nexo-primary">{status?.bufferMessages || 0}</div>
                    <div className="text-xs text-nexo-muted">Mensagens Novas</div>
                  </div>
                  <div className="p-4 bg-nexo-bg rounded-lg text-center">
                    <div className="text-2xl font-bold text-nexo-success">{status?.bufferTasks || 0}</div>
                    <div className="text-xs text-nexo-muted">Tarefas</div>
                  </div>
                  <div className="p-4 bg-nexo-bg rounded-lg text-center">
                    <div className="text-2xl font-bold text-nexo-warning">{status?.bufferIdeas || 0}</div>
                    <div className="text-xs text-nexo-muted">Ideias</div>
                  </div>
                  <div className="p-4 bg-nexo-bg rounded-lg text-center">
                    <div className="text-2xl font-bold text-nexo-info">{status?.bufferLinks || 0}</div>
                    <div className="text-xs text-nexo-muted">Links</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function MoodBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-nexo-muted">{label}</span>
        <span className="text-nexo-text">{value}%</span>
      </div>
      <div className="h-2 bg-nexo-border rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} className={`h-full ${color} rounded-full`} transition={{ duration: 0.5 }} />
      </div>
    </div>
  )
}

function StatusRow({ label, active }) {
  return (
    <div className="flex justify-between">
      <span className="text-nexo-muted">{label}</span>
      <span className={active ? 'text-nexo-success' : 'text-nexo-danger'}>
        {active ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}
