import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Sun, Moon, Activity, Trash2, Eraser, Save, Scan,
  FileText, AtSign, Link, RefreshCw, Server, Database,
  Stethoscope, Wrench, Terminal, Zap, Heart,
  AlertTriangle, CheckCircle, XCircle, Loader, Cpu,
  Wifi, WifiOff, MessageCircle, Chrome, Play, Square,
  RotateCcw, Eye, EyeOff, ScrollText, Power, Send,
  Bot, User, ClipboardList, Trash
} from 'lucide-react'
import axios from 'axios'

const ICON_MAP = {
  Sun, Moon, Activity, Trash2, Eraser, Save, Scan,
  FileText, AtSign, Link, RefreshCw, Server, Database,
  Stethoscope, Wrench, Terminal, Zap, Heart,
  AlertTriangle, CheckCircle, XCircle, Loader
};

const TABS = [
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'comandos', label: 'Comandos', icon: Zap }
];

const QUICK_COMMANDS = [
  { id: 'escanear-agora', label: 'Escanear Agora', icon: Scan, desc: 'Forca scan do WhatsApp', color: 'text-blue-400', bg: 'hover:bg-blue-500/10 border-blue-500/30' },
  { id: 'reescanear', label: 'Re-escanear', icon: RefreshCw, desc: 'Reset checkpoint + scan full', color: 'text-purple-400', bg: 'hover:bg-purple-500/10 border-purple-500/30' },
  { id: 'limpar-memoria', label: 'Limpar Buffer', icon: Trash, desc: 'Limpa buffer de mensagens', color: 'text-orange-400', bg: 'hover:bg-orange-500/10 border-orange-500/30' },
  { id: 'gerar-relatorio', label: 'Gerar Relatorio', icon: FileText, desc: 'Gera relatorio do dia', color: 'text-green-400', bg: 'hover:bg-green-500/10 border-green-500/30' },
  { id: 'verificar-mencoes', label: 'Verificar Mencoes', icon: AtSign, desc: 'Checa @luna pendentes', color: 'text-cyan-400', bg: 'hover:bg-cyan-500/10 border-cyan-500/30' },
  { id: 'verificar-links', label: 'Verificar Links', icon: Link, desc: 'Processa links pendentes', color: 'text-pink-400', bg: 'hover:bg-pink-500/10 border-pink-500/30' },
  { id: 'diagnostico', label: 'Diagnostico', icon: Stethoscope, desc: 'Checa saude da Luna', color: 'text-red-400', bg: 'hover:bg-red-500/10 border-red-500/30' },
  { id: 'autoconserto', label: 'Auto-Conserto', icon: Wrench, desc: 'Tenta corrigir erros', color: 'text-yellow-400', bg: 'hover:bg-yellow-500/10 border-yellow-500/30' },
];

function getLogColor(line) {
  if (line.includes('ERROR') || line.includes('FATAL') || line.includes('CRITICAL')) return 'text-red-400';
  if (line.includes('SUCCESS') || line.includes('✅')) return 'text-green-400';
  if (line.includes('WARN')) return 'text-yellow-400';
  if (line.includes('COMANDO') || line.includes('MENCAO') || line.includes('MENCION')) return 'text-cyan-400';
  if (line.includes('PRIVACY') || line.includes('PRIVACIDADE')) return 'text-orange-400';
  if (line.includes('PLAYWRIGHT') || line.includes('CDP')) return 'text-purple-400';
  if (line.includes('SCAN') || line.includes('EXTRACT')) return 'text-blue-400';
  if (line.includes('CHAT') || line.includes('MENSAGEM')) return 'text-pink-400';
  if (line.includes('>>') || line.includes('<<')) return 'text-gray-500';
  return 'text-gray-300';
}

export default function LunaControl() {
  const [activeTab, setActiveTab] = useState('terminal')
  const [commands, setCommands] = useState([])
  const [status, setStatus] = useState(null)
  const [executing, setExecuting] = useState(null)
  const [history, setHistory] = useState([])
  const [mood, setMood] = useState({ happiness: 66, energy: 80, trust: 58, excitement: 33 })
  const [hiddenMode, setHiddenMode] = useState(false)
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const logsEndRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    fetchCommands()
    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activeTab === 'terminal') {
      fetchLogs()
      const interval = setInterval(fetchLogs, 2000)
      return () => clearInterval(interval)
    }
  }, [activeTab])

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  const fetchCommands = async () => {
    try {
      const res = await axios.get('/api/luna/commands')
      if (res.data.success) setCommands(res.data.commands)
    } catch (e) {
      console.error('[LunaControl] Erro ao buscar comandos:', e.message)
    }
  }

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/luna/status')
      if (res.data) setStatus(res.data)
    } catch (e) {
      console.error('[LunaControl] Erro ao buscar status:', e.message)
      setStatus(prev => ({ ...prev, _error: e.message }))
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await axios.get('/api/luna/logs?lines=300')
      if (res.data.success) setLogs(res.data.logs)
    } catch (e) {
      console.error('[LunaControl] Erro ao buscar logs:', e.message)
      setLogs([{ ts: new Date().toISOString(), level: 'error', msg: 'Erro ao carregar logs: ' + e.message }])
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

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return
    const text = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text, time: new Date().toLocaleTimeString('pt-BR') }])
    setChatLoading(true)

    try {
      // Se for comando, executa via API
      if (text.startsWith('/')) {
        const cmd = text.slice(1).split(' ')[0]
        const res = await axios.post('/api/luna/command', { command: cmd, params: { hidden: hiddenMode } })
        setChatMessages(prev => [...prev, {
          role: 'luna',
          text: res.data.success ? `✅ Comando /${cmd} executado.` : `❌ Erro: ${res.data.error || 'Falha'}`,
          time: new Date().toLocaleTimeString('pt-BR')
        }])
      } else {
        // Chat direto via LLM
        const res = await axios.post('/api/luna/chat', {
          message: text,
          context: chatMessages.slice(-10)
        })
        setChatMessages(prev => [...prev, {
          role: 'luna',
          text: res.data.success ? res.data.reply : `❌ Erro: ${res.data.error || 'Falha no LLM'}`,
          time: new Date().toLocaleTimeString('pt-BR')
        }])
      }
    } catch (e) {
      setChatMessages(prev => [...prev, {
        role: 'luna',
        text: `❌ Erro: ${e.message}`,
        time: new Date().toLocaleTimeString('pt-BR')
      }])
    } finally {
      setChatLoading(false)
    }
  }

  const updateMood = (command) => {
    setMood(prev => {
      const next = { ...prev }
      if (command === 'acordar') { next.energy = Math.min(100, next.energy + 20); next.happiness += 5; }
      if (command === 'dormir') { next.energy = Math.max(0, next.energy - 30); }
      if (command === 'limpar-memoria') { next.energy = Math.min(100, next.energy + 10); }
      if (command === 'escanear-agora' || command === 'reescanear') { next.energy = Math.max(0, next.energy - 15); next.excitement += 10; }
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
      <div className="w-80 border-r border-nexo-border flex flex-col bg-nexo-bg/80">
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-2 border-b border-nexo-border bg-nexo-bg/50">
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

        <div className="flex-1 overflow-hidden">

          {/* TAB: TERMINAL */}
          {activeTab === 'terminal' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-nexo-border bg-nexo-bg/30">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-nexo-primary" />
                  <span className="text-sm font-medium">Terminal da Luna</span>
                  <span className="text-xs text-nexo-muted">({logs.length} linhas)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAutoScroll(!autoScroll)}
                    className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${autoScroll ? 'bg-nexo-primary text-white' : 'bg-nexo-card text-nexo-muted'}`}>
                    {autoScroll ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    Auto-scroll
                  </button>
                  <button onClick={fetchLogs}
                    className="flex items-center gap-1 px-3 py-1 bg-nexo-card text-nexo-muted rounded text-xs hover:bg-nexo-border transition-colors">
                    <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </button>
                  <button onClick={() => setLogs([])}
                    className="flex items-center gap-1 px-3 py-1 bg-nexo-card text-nexo-muted rounded text-xs hover:bg-nexo-border transition-colors">
                    <Eraser className="w-3 h-3" />
                    Limpar
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-black/70 overflow-y-auto p-3 font-mono text-xs leading-relaxed">
                {logs.length === 0 && (
                  <p className="text-nexo-muted text-center py-8">Nenhum log encontrado. Verifique se a Luna esta rodando.</p>
                )}
                {logs.map((line, i) => (
                  <div key={i} className={`${getLogColor(line)} break-all whitespace-pre-wrap`}>
                    {line}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>

              <div className="px-4 py-2 border-t border-nexo-border bg-nexo-bg/30 flex items-center gap-3">
                <span className="text-xs text-nexo-muted font-mono">$</span>
                <input
                  type="text"
                  placeholder="Digite um comando (ex: /status, /ajuda) ou mensagem..."
                  className="flex-1 bg-transparent text-sm text-nexo-text placeholder-nexo-muted outline-none font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = e.target.value.trim()
                      if (val) {
                        setChatInput(val)
                        sendChatMessage()
                        e.target.value = ''
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB: CHAT */}
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-nexo-border bg-nexo-bg/30">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-nexo-primary" />
                  <span className="text-sm font-medium">Chat com a Luna</span>
                  <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-nexo-success' : 'bg-nexo-danger'}`} />
                </div>
                <button onClick={() => setChatMessages([])}
                  className="flex items-center gap-1 px-3 py-1 bg-nexo-card text-nexo-muted rounded text-xs hover:bg-nexo-border transition-colors">
                  <Eraser className="w-3 h-3" />
                  Limpar chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-12 text-nexo-muted">
                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma mensagem ainda.</p>
                    <p className="text-xs mt-1">Envie um comando (/status, /ajuda) ou uma mensagem.</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'user' ? 'bg-nexo-primary' : 'bg-gradient-to-br from-purple-500 to-pink-500'
                    }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                    </div>
                    <div className={`max-w-[70%] px-4 py-2 rounded-xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-nexo-primary text-white rounded-tr-none'
                        : 'bg-nexo-card text-nexo-text rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <span className={`text-[10px] mt-1 block ${msg.role === 'user' ? 'text-white/60' : 'text-nexo-muted'}`}>
                        {msg.time}
                      </span>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-nexo-card px-4 py-2 rounded-xl rounded-tl-none">
                      <Loader className="w-4 h-4 text-nexo-primary animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-nexo-border bg-nexo-bg/30">
                <div className="flex items-center gap-2 bg-nexo-card rounded-xl px-4 py-2 border border-nexo-border">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Digite /status, /ajuda ou uma mensagem..."
                    className="flex-1 bg-transparent text-sm text-nexo-text placeholder-nexo-muted outline-none"
                    disabled={chatLoading}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={chatLoading || !chatInput.trim()}
                    className="p-2 bg-nexo-primary rounded-lg text-white hover:bg-nexo-primary/80 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: COMANDOS */}
          {activeTab === 'comandos' && (
            <div className="p-6 overflow-y-auto h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Zap className="w-6 h-6 text-yellow-400" />
                  Comandos Rapidos
                </h2>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={hiddenMode} onChange={(e) => setHiddenMode(e.target.checked)} className="sr-only peer" />
                  <div className="relative w-11 h-6 bg-nexo-border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-nexo-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nexo-primary"></div>
                  <span className="text-sm text-nexo-muted">{hiddenMode ? 'Modo Hidden' : 'Modo Normal'}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {QUICK_COMMANDS.map(cmd => {
                  const isExecuting = executing === cmd.id
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => executeCommand(cmd.id)}
                      disabled={isExecuting || !isRunning}
                      className={`p-4 bg-nexo-bg border border-nexo-border rounded-xl text-left transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed ${cmd.bg}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {isExecuting ? <Loader className="w-5 h-5 text-nexo-primary animate-spin" /> : <cmd.icon className={`w-5 h-5 ${cmd.color}`} />}
                        <span className="font-semibold text-sm">{cmd.label}</span>
                      </div>
                      <p className="text-xs text-nexo-muted">{cmd.desc}</p>
                    </button>
                  )
                })}
              </div>

              {/* Controle Start/Stop/Restart Luna */}
              <div className="mt-8">
                <h3 className="text-sm font-medium text-nexo-muted uppercase mb-4">Controle do Agente</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button onClick={() => axios.post('/api/luna/control', { action: 'start' }).then(fetchStatus)}
                    disabled={isRunning}
                    className="flex flex-col items-center gap-2 p-5 bg-nexo-bg border border-nexo-border rounded-xl hover:bg-nexo-success/10 hover:border-nexo-success transition-all disabled:opacity-50">
                    <Play className="w-6 h-6 text-nexo-success" />
                    <span className="font-semibold text-sm">Ligar Luna</span>
                  </button>
                  <button onClick={() => axios.post('/api/luna/control', { action: 'stop' }).then(fetchStatus)}
                    disabled={!isRunning}
                    className="flex flex-col items-center gap-2 p-5 bg-nexo-bg border border-nexo-border rounded-xl hover:bg-nexo-danger/10 hover:border-nexo-danger transition-all disabled:opacity-50">
                    <Square className="w-6 h-6 text-nexo-danger" />
                    <span className="font-semibold text-sm">Desligar Luna</span>
                  </button>
                  <button onClick={() => axios.post('/api/luna/control', { action: 'restart' }).then(() => setTimeout(fetchStatus, 3000))}
                    className="flex flex-col items-center gap-2 p-5 bg-nexo-bg border border-nexo-border rounded-xl hover:bg-nexo-primary/10 hover:border-nexo-primary transition-all">
                    <RotateCcw className="w-6 h-6 text-nexo-primary" />
                    <span className="font-semibold text-sm">Reiniciar Luna</span>
                  </button>
                </div>
              </div>

              {/* Buffer Info */}
              <div className="mt-8 glass-card rounded-xl p-6">
                <h3 className="text-sm font-medium text-nexo-muted uppercase mb-4">Buffer Atual</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                  <div className="p-4 bg-nexo-bg rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-400">{status?.bufferLeads || 0}</div>
                    <div className="text-xs text-nexo-muted">Leads</div>
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
