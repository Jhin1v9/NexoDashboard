import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Sun, Moon, Activity, Trash2, Eraser, Save, Scan,
  FileText, AtSign, Link, RefreshCw, Server, Database,
  Stethoscope, Wrench, Terminal, Zap, Heart,
  AlertTriangle, CheckCircle, XCircle, Loader, Cpu,
  Wifi, WifiOff, MessageCircle, Chrome
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

export default function LunaControl() {
  const [commands, setCommands] = useState([])
  const [status, setStatus] = useState(null)
  const [executing, setExecuting] = useState(null)
  const [history, setHistory] = useState([])
  const [mood, setMood] = useState({ happiness: 66, energy: 80, trust: 58, excitement: 33 })

  useEffect(() => {
    fetchCommands()
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchCommands = async () => {
    try {
      const res = await axios.get('/api/luna/commands')
      if (res.data.success) setCommands(res.data.commands)
    } catch (e) {}
  }

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/luna/status')
      if (res.data.success) setStatus(res.data)
    } catch (e) {}
  }

  const executeCommand = async (commandId) => {
    setExecuting(commandId)
    try {
      const res = await axios.post('/api/luna/command', { command: commandId })
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

  return (
    <div className="h-full flex">
      {/* Sidebar Luna */}
      <div className="w-80 border-r border-nexo-border flex flex-col">
        {/* Header com Mood */}
        <div className="p-4 border-b border-nexo-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Luna</h2>
              <p className="text-xs text-nexo-muted">CTO Agent v16.0</p>
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
          <h3 className="text-xs font-medium text-nexo-muted uppercase mb-2">Status</h3>
          <div className="space-y-1 text-sm">
            <StatusRow label="Chrome" active={status?.chromeConnected} />
            <StatusRow label="WhatsApp" active={status?.whatsappConnected} />
            <div className="flex justify-between">
              <span className="text-nexo-muted">Ultimo Scan</span>
              <span className="text-nexo-text">{status?.lastScan ? new Date(status.lastScan).toLocaleTimeString('pt-BR') : 'Nunca'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-nexo-muted">Mensagens</span>
              <span className="text-nexo-text">{status?.bufferMessages || 0}</span>
            </div>
          </div>
        </div>

        {/* Historico */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-medium text-nexo-muted uppercase mb-2">Historico</h3>
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

      {/* Grid de Comandos */}
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Centro de Comando</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {CATEGORIES.map(cat => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-xl p-4"
            >
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
                    <button
                      key={cmdId}
                      onClick={() => executeCommand(cmdId)}
                      disabled={isExecuting}
                      className="p-3 bg-nexo-bg hover:bg-nexo-border border border-nexo-border rounded-lg text-left transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {isExecuting ? (
                          <Loader className="w-4 h-4 text-nexo-primary animate-spin" />
                        ) : (
                          <Icon className="w-4 h-4 text-nexo-muted" />
                        )}
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
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={`h-full ${color} rounded-full`}
          transition={{ duration: 0.5 }}
        />
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
