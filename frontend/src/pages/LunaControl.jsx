import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sun, Moon, Activity, Trash2, Eraser, Save, Scan,
  FileText, AtSign, Link, RefreshCw, Server, Database,
  Stethoscope, Wrench, Terminal, Zap, Heart,
  AlertTriangle, CheckCircle, XCircle, Loader, Cpu,
  Wifi, WifiOff, MessageCircle, Chrome, Play, Square,
  RotateCcw, Eye, EyeOff, ScrollText, Power, Send,
  Bot, User, ClipboardList, Trash,
  ChevronDown, Users, Sparkles
} from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

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
  { id: 'reescanear', label: 'Re-escanear', icon: RefreshCw, desc: 'Reset checkpoint + scan full', color: 'text-purple-400', bg: 'hover:bg-purple-500/10 border-purple-500/30' },
  { id: 'limpar-memoria', label: 'Limpar Buffer', icon: Trash, desc: 'Limpa buffer de mensagens', color: 'text-orange-400', bg: 'hover:bg-orange-500/10 border-orange-500/30' },
  { id: 'gerar-relatorio', label: 'Gerar Relatorio', icon: FileText, desc: 'Gera relatorio do dia', color: 'text-green-400', bg: 'hover:bg-green-500/10 border-green-500/30' },
  { id: 'verificar-mencoes', label: 'Verificar Mencoes', icon: AtSign, desc: 'Checa @luna pendentes', color: 'text-cyan-400', bg: 'hover:bg-cyan-500/10 border-cyan-500/30' },
  { id: 'verificar-links', label: 'Verificar Links', icon: Link, desc: 'Processa links pendentes', color: 'text-pink-400', bg: 'hover:bg-pink-500/10 border-pink-500/30' },
  { id: 'diagnostico', label: 'Diagnostico', icon: Stethoscope, desc: 'Checa saude da Luna', color: 'text-red-400', bg: 'hover:bg-red-500/10 border-red-500/30' },
  { id: 'autoconserto', label: 'Auto-Conserto', icon: Wrench, desc: 'Tenta corrigir erros', color: 'text-yellow-400', bg: 'hover:bg-yellow-500/10 border-yellow-500/30' },
];

function getLogColor(line) {
  const text = typeof line === 'string' ? line : String(line || '');
  if (text.includes('ERROR') || text.includes('FATAL') || text.includes('CRITICAL')) return 'text-red-400';
  if (text.includes('SUCCESS') || text.includes('✅')) return 'text-green-400';
  if (text.includes('WARN')) return 'text-yellow-400';
  if (text.includes('COMANDO') || text.includes('MENCAO') || text.includes('MENCION')) return 'text-cyan-400';
  if (text.includes('PRIVACY') || text.includes('PRIVACIDADE')) return 'text-orange-400';
  if (text.includes('PLAYWRIGHT') || text.includes('CDP')) return 'text-purple-400';
  if (text.includes('SCAN') || text.includes('EXTRACT')) return 'text-blue-400';
  if (text.includes('CHAT') || text.includes('MENSAGEM')) return 'text-pink-400';
  if (text.includes('>>') || text.includes('<<')) return 'text-gray-500';
  return 'text-gray-300';
}

// ============================================================
// Componente: Card de Preview Editável para criar tarefas
// ============================================================
function EditablePreviewCard({ fields, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => {
    const v = {}
    Object.entries(fields).forEach(([key, field]) => { v[key] = field.value })
    return v
  })
  const [editingField, setEditingField] = useState(null)
  const [showExtras, setShowExtras] = useState(false)

  const updateValue = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  const handleSubmit = () => {
    const cleaned = {}
    Object.entries(values).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) cleaned[k] = v
    })
    onSubmit(cleaned)
  }

  const renderField = (key, field) => {
    const isEditing = editingField === key

    if (field.type === 'select') {
      return (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-nexo-muted w-16 flex-shrink-0">{field.label}</span>
          <select
            value={values[key] || ''}
            onChange={(e) => updateValue(key, e.target.value)}
            className="bg-nexo-bg border border-nexo-border rounded px-2 py-1 text-xs text-nexo-text outline-none focus:border-nexo-primary"
          >
            {field.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )
    }

    if (field.type === 'date') {
      return (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-nexo-muted w-16 flex-shrink-0">{field.label}</span>
          <input
            type="date"
            value={values[key] || ''}
            onChange={(e) => updateValue(key, e.target.value)}
            className="bg-nexo-bg border border-nexo-border rounded px-2 py-1 text-xs text-nexo-text outline-none focus:border-nexo-primary"
          />
        </div>
      )
    }

    if (field.type === 'textarea') {
      return (
        <div key={key} className="flex flex-col gap-1">
          <span className="text-xs text-nexo-muted">{field.label}</span>
          <textarea
            value={values[key] || ''}
            onChange={(e) => updateValue(key, e.target.value)}
            placeholder={field.placeholder}
            rows={2}
            className="bg-nexo-bg border border-nexo-border rounded px-2 py-1 text-xs text-nexo-text outline-none focus:border-nexo-primary resize-none"
          />
        </div>
      )
    }

    // Texto editável inline
    return (
      <div key={key} className="flex items-center gap-2">
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={values[key] || ''}
            onChange={(e) => updateValue(key, e.target.value)}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditingField(null); if (e.key === 'Escape') setEditingField(null) }}
            className="w-full bg-nexo-bg border border-nexo-primary rounded px-2 py-1 text-xs text-nexo-text outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingField(key)}
            className="w-full text-left px-2 py-1 text-xs text-nexo-text bg-nexo-bg/50 border border-transparent hover:border-nexo-border rounded transition-colors cursor-text"
          >
            <span className="text-nexo-muted text-[10px] mr-1">{field.label}:</span>
            <span className="font-medium">{values[key] || field.placeholder || '...'}</span>
            <span className="ml-1 text-nexo-muted opacity-50">✎</span>
          </button>
        )}
      </div>
    )
  }

  const mainFields = ['title']
  const extraFields = ['assignedTo', 'priority', 'dueDate', 'description']

  return (
    <div className="mt-3 p-3 bg-nexo-bg border border-nexo-border rounded-xl space-y-2">
      {/* Campos principais */}
      {mainFields.map(key => fields[key] && renderField(key, fields[key]))}

      {/* Campos extras (expandíveis) */}
      {showExtras && extraFields.map(key => fields[key] && renderField(key, fields[key]))}

      {/* Toggle extras */}
      {!showExtras && (
        <button
          onClick={() => setShowExtras(true)}
          className="text-xs text-nexo-primary hover:underline"
        >
          ➕ Adicionar responsável, prioridade, prazo...
        </button>
      )}

      {/* Botões de ação */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          className="px-3 py-1.5 bg-nexo-success text-white text-xs rounded-lg hover:bg-nexo-success/80 transition-colors font-medium"
        >
          ✅ Criar tarefa
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 bg-nexo-border text-nexo-text text-xs rounded-lg hover:bg-nexo-card transition-colors"
        >
          ❌ Cancelar
        </button>
      </div>
    </div>
  )
}

// ============================================================
export default function LunaControl() {
  const [searchParams] = useSearchParams()
  const contextModule = searchParams.get('context') || null
  const contextId = searchParams.get('id') || null
  const contextFile = searchParams.get('file') || null

  const [activeTab, setActiveTab] = useState(contextModule ? 'chat' : 'terminal')
  const [commands, setCommands] = useState([])
  const [status, setStatus] = useState(null)
  const [telegramStatus, setTelegramStatus] = useState({ running: false, botUsername: null })
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
  const { user: authUser } = useAuth()
  const [activeUser, setActiveUser] = useState(authUser?.name || 'Abner')
  const [pendingConfirmation, setPendingConfirmation] = useState(null)
  const [editingPreview, setEditingPreview] = useState(null)
  const chatEndRef = useRef(null)
  const previewCardRef = useRef(null)

  // Threads persistentes
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState('group')
  const [threadMessages, setThreadMessages] = useState({})
  const [isLoadingThread, setIsLoadingThread] = useState(false)
  const [showThreadDropdown, setShowThreadDropdown] = useState(false)
  const dropdownRef = useRef(null)

  // Contexto passado via query params (ex: ?context=email&id=xyz&file=path)
  const contextRef = useRef({ module: contextModule, id: contextId, file: contextFile })

  useEffect(() => {
    if (authUser?.name) {
      setActiveUser(authUser.name)
    }
  }, [authUser])

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
    // Sempre mantém o scroll no final do chat — nunca sobe sozinho
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [threadMessages, activeThreadId])

  // Carrega threads ao montar
  useEffect(() => {
    fetchThreads()
  }, [])

  // Carrega mensagens quando troca de thread
  useEffect(() => {
    if (activeThreadId) {
      fetchThreadMessages(activeThreadId)
    }
  }, [activeThreadId])

  // WebSocket para mensagens em tempo real
  useEffect(() => {
    let ws
    let reconnectTimer
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      ws.onopen = () => console.log('[LunaControl] WS connected')
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'luna:chat:message' && data.threadId && data.message) {
            const { threadId, message } = data
            setThreadMessages(prev => {
              const msgs = prev[threadId] || []
              if (msgs.some(m => m.id === message.id)) return prev
              return { ...prev, [threadId]: [...msgs, message] }
            })
          }
        } catch (e) {
          // ignora mensagens não-JSON
        }
      }
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000)
      }
    }
    connect()
    return () => {
      clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [])

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowThreadDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchThreads = async () => {
    try {
      const res = await axios.get('/api/luna/threads')
      if (res.data.success) setThreads(res.data.threads || [])
    } catch (e) {
      console.error('[LunaControl] Erro ao buscar threads:', e.message)
    }
  }

  const fetchThreadMessages = async (threadId) => {
    setIsLoadingThread(true)
    try {
      const res = await axios.get(`/api/luna/threads/${threadId}/messages`)
      if (res.data.success) {
        setThreadMessages(prev => ({ ...prev, [threadId]: res.data.messages || [] }))
      }
    } catch (e) {
      console.error('[LunaControl] Erro ao buscar mensagens:', e.message)
    } finally {
      setIsLoadingThread(false)
    }
  }

  const getUserColor = (name) => {
    const map = { abner: '#3742fa', nonoke: '#2ed573', elias: '#ffa502', luna: '#9b59b6' }
    return map[name?.toLowerCase()] || '#3742fa'
  }

  const getActiveThread = () => threads.find(t => t.id === activeThreadId)

  const getThreadDisplayTitle = () => {
    const t = getActiveThread()
    if (t) return t.title
    return activeThreadId === 'group' ? 'NEXO + Luna (grupo) 👥' : 'Chat'
  }

  const clearThreadMessages = async () => {
    try {
      await axios.delete(`/api/luna/threads/${activeThreadId}/messages`)
      setThreadMessages(prev => ({ ...prev, [activeThreadId]: [] }))
    } catch (e) {
      console.error('[LunaControl] Erro ao limpar mensagens:', e.message)
    }
  }

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
      const [lunaRes, tgRes] = await Promise.allSettled([
        axios.get('/api/luna/status'),
        axios.get('/api/telegram/status')
      ])
      if (lunaRes.status === 'fulfilled' && lunaRes.value.data) {
        setStatus(lunaRes.value.data)
      }
      if (tgRes.status === 'fulfilled' && tgRes.value.data) {
        setTelegramStatus(tgRes.value.data)
      }
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
    setChatLoading(true)

    const tempId = 'temp_' + Date.now()
    const optimisticUserMsg = {
      id: tempId,
      role: 'user',
      author: activeUser.toLowerCase(),
      authorName: activeUser,
      authorColor: getUserColor(activeUser),
      text,
      timestamp: new Date().toISOString()
    }
    setThreadMessages(prev => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), optimisticUserMsg]
    }))

    try {
      // Se for comando, executa via API e insere como mensagem da Luna
      if (text.startsWith('/')) {
        const cmd = text.slice(1).split(' ')[0]
        const res = await axios.post('/api/luna/command', { command: cmd, params: { hidden: hiddenMode } })
        let cmdText = ''
        if (res.data.success) {
          const result = res.data.result || {}
          if (cmd === 'status') {
            cmdText = `📊 Status da Luna\n\nVersão: ${result.version || '—'}\nÚltimo scan: ${result.lastScan ? new Date(result.lastScan).toLocaleString('pt-BR') : 'Nunca'}\nMensagens no histórico: ${result.historyTotal || 0}\nMsgs no buffer: ${result.bufferMessages || 0}\nTarefas no buffer: ${result.bufferTasks || 0}\nIdeias no buffer: ${result.bufferIdeas || 0}`
          } else {
            cmdText = `Pronto! Comando /${cmd} executado. ☕\n\n${result.message || JSON.stringify(result, null, 2)}`
          }
        } else {
          cmdText = `Eita, deu erro no /${cmd}: ${res.data.error || 'Falha'} 😅`
        }
        const lunaMsg = {
          id: 'cmd_' + Date.now(),
          role: 'assistant',
          author: 'luna',
          authorName: 'Luna',
          authorColor: '#9b59b6',
          text: cmdText,
          timestamp: new Date().toISOString()
        }
        setThreadMessages(prev => {
          const msgs = (prev[activeThreadId] || []).filter(m => m.id !== tempId)
          return { ...prev, [activeThreadId]: [...msgs, lunaMsg] }
        })
      } else {
        // Chat via thread persistente
        const res = await axios.post(`/api/luna/threads/${activeThreadId}/messages`, {
          text,
          authorName: activeUser,
          contextModule: contextRef.current?.module || null,
          contextId: contextRef.current?.id || null,
          contextFile: contextRef.current?.file || null,
        })
        const data = res.data
        const newMsgs = []
        if (data.userMessage) newMsgs.push(data.userMessage)
        if (data.lunaMessage) {
          newMsgs.push({
            ...data.lunaMessage,
            needsConfirmation: data.needsConfirmation || false,
            previewType: data.previewType || null,
            editableFields: data.editableFields || null,
            actions: data.actions || null,
            quotaExhausted: data.quotaExhausted || false,
            resetAt: data.resetAt || null
          })
        }
        if (data.needsConfirmation && data.actions) {
          setPendingConfirmation({
            actions: data.actions,
            preview: data.preview,
            previewType: data.previewType,
            editableFields: data.editableFields
          })
        }
        setThreadMessages(prev => {
          const msgs = (prev[activeThreadId] || []).filter(m => m.id !== tempId)
          return { ...prev, [activeThreadId]: [...msgs, ...newMsgs] }
        })
      }
    } catch (e) {
      setThreadMessages(prev => {
        const msgs = (prev[activeThreadId] || []).filter(m => m.id !== tempId)
        const errorMsg = {
          id: 'err_' + Date.now(),
          role: 'assistant',
          author: 'luna',
          authorName: 'Luna',
          authorColor: '#9b59b6',
          text: `Eita, deu um tilt aqui nos meus neurônios 😅\n\nTenta de novo daqui a pouco? Ou me manda um comando direto tipo /status que eu respondo sem depender do cérebro grande.`,
          timestamp: new Date().toISOString()
        }
        return { ...prev, [activeThreadId]: [...msgs, errorMsg] }
      })
    } finally {
      setChatLoading(false)
    }
  }

  const confirmPendingActions = async (confirm, editedFields = null) => {
    if (!confirm) {
      setPendingConfirmation(null)
      setEditingPreview(null)
      const cancelMsg = {
        id: 'cancel_' + Date.now(),
        role: 'assistant',
        author: 'luna',
        authorName: 'Luna',
        authorColor: '#9b59b6',
        text: 'Beleza, cancelado 👍',
        timestamp: new Date().toISOString()
      }
      setThreadMessages(prev => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), cancelMsg]
      }))
      return
    }
    if (!pendingConfirmation) return
    setChatLoading(true)
    try {
      const res = await axios.post(`/api/luna/threads/${activeThreadId}/messages`, {
        text: 'sim',
        authorName: activeUser,
        confirmActions: true,
        pendingActions: pendingConfirmation.actions,
        editedFields,
        contextModule: contextRef.current?.module || null,
        contextId: contextRef.current?.id || null,
        contextFile: contextRef.current?.file || null,
      })
      const data = res.data
      const newMsgs = []
      if (data.userMessage) newMsgs.push(data.userMessage)
      if (data.lunaMessage) newMsgs.push(data.lunaMessage)
      if (!data.userMessage && !data.lunaMessage) {
        newMsgs.push({
          id: 'confirm_' + Date.now(),
          role: 'assistant',
          author: 'luna',
          authorName: 'Luna',
          authorColor: '#9b59b6',
          text: data.success ? data.reply : `Eita, deu erro: ${data.error || 'Falha'} 😅`,
          executed: true,
          quotaExhausted: data.quotaExhausted || false,
          resetAt: data.resetAt || null,
          timestamp: new Date().toISOString()
        })
      }
      setThreadMessages(prev => {
        const msgs = (prev[activeThreadId] || []).map(m => {
          if (m.previewType === 'task_edit' && m.needsConfirmation) {
            return { ...m, needsConfirmation: false, executed: true }
          }
          return m
        })
        return { ...prev, [activeThreadId]: [...msgs, ...newMsgs] }
      })
    } catch (e) {
      setThreadMessages(prev => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), {
          id: 'err_' + Date.now(),
          role: 'assistant',
          author: 'luna',
          authorName: 'Luna',
          authorColor: '#9b59b6',
          text: `Eita, deu erro ao confirmar 😅\n\n${e.message}`,
          timestamp: new Date().toISOString()
        }]
      }))
    } finally {
      setPendingConfirmation(null)
      setEditingPreview(null)
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
            <StatusRow label={`Telegram @${telegramStatus.botUsername || 'bot'}`} active={telegramStatus.running} />
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
              {/* Header com dropdown de threads */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-nexo-border bg-nexo-bg/30">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-nexo-primary" />
                  {/* Badge Gemini */}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-nexo-info/10 text-nexo-info border border-nexo-info/20">
                    <Sparkles className="w-3 h-3" /> Gemini
                  </span>
                  {/* Dropdown de threads */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowThreadDropdown(!showThreadDropdown)}
                      className="flex items-center gap-1.5 text-sm font-medium hover:text-nexo-primary transition-colors"
                    >
                      {getThreadDisplayTitle()}
                      <ChevronDown className={`w-3 h-3 transition-transform ${showThreadDropdown ? 'rotate-180' : ''}`} />
                      {activeThreadId === 'group' && <Users className="w-3 h-3 text-nexo-muted" />}
                    </button>
                    {showThreadDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-nexo-card border border-nexo-border rounded-lg shadow-xl z-[9990] py-1">
                        {threads.map(t => (
                          <button
                            key={t.id}
                            onClick={() => { setActiveThreadId(t.id); setShowThreadDropdown(false) }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-nexo-bg transition-colors ${
                              t.id === activeThreadId ? 'bg-nexo-bg/50 text-nexo-primary' : 'text-nexo-text'
                            }`}
                          >
                            {t.type === 'group' ? (
                              <Users className="w-4 h-4 text-nexo-muted flex-shrink-0" />
                            ) : (
                              <User className="w-4 h-4 text-nexo-muted flex-shrink-0" />
                            )}
                            <span className="flex-1 truncate">{t.title}</span>
                            {t.id === activeThreadId && <CheckCircle className="w-3 h-3 text-nexo-success flex-shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-nexo-success' : 'bg-nexo-danger'}`} />
                  {isLoadingThread && <Loader className="w-3 h-3 text-nexo-primary animate-spin" />}
                </div>
                <button onClick={clearThreadMessages}
                  className="flex items-center gap-1 px-3 py-1 bg-nexo-card text-nexo-muted rounded text-xs hover:bg-nexo-border transition-colors">
                  <Eraser className="w-3 h-3" />
                  Limpar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(() => {
                  const currentMessages = threadMessages[activeThreadId] || []
                  const isGroup = activeThreadId === 'group'
                  return (
                    <>
                      {currentMessages.length === 0 && (
                        <div className="text-center py-12 text-nexo-muted">
                          <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">Nenhuma mensagem ainda.</p>
                          <p className="text-xs mt-1">
                            {isGroup
                              ? 'Chat em grupo com a Luna. Todos os CEOs veem as mensagens.'
                              : 'Chat privado com a Luna. Somente você vê estas mensagens.'}
                          </p>
                        </div>
                      )}
                      {currentMessages.map((msg, i) => {
                        const isUser = msg.role === 'user'
                        const showAuthor = isGroup && isUser && msg.authorName
                        const authorColor = msg.authorColor || getUserColor(msg.author)
                        return (
                          <div key={msg.id || i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] text-white font-bold"
                              style={{ backgroundColor: isUser ? authorColor : '#9b59b6' }}
                            >
                              {isUser ? (msg.authorName?.charAt(0) || 'U') : <Bot className="w-4 h-4 text-white" />}
                            </div>
                            <div className={`${msg.previewType === 'task_edit' ? 'max-w-[90%]' : 'max-w-[70%]'} px-4 py-2 rounded-xl text-sm ${
                              isUser
                                ? 'bg-nexo-primary text-white rounded-tr-none'
                                : 'bg-nexo-card text-nexo-text rounded-tl-none'
                            }`}>
                              {/* Nome do autor no grupo */}
                              {showAuthor && (
                                <p className="text-[10px] font-semibold mb-0.5" style={{ color: authorColor }}>
                                  {msg.authorName}
                                </p>
                              )}
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                              {/* Card de Preview Editável para tarefas */}
                              {msg.needsConfirmation && msg.previewType === 'task_edit' && msg.editableFields && (
                                <div ref={previewCardRef}>
                                  <EditablePreviewCard
                                    fields={msg.editableFields}
                                    onSubmit={(edited) => confirmPendingActions(true, edited)}
                                    onCancel={() => confirmPendingActions(false)}
                                  />
                                </div>
                              )}
                              {/* Tarefa já executada — mostra confirmação visual */}
                              {!msg.needsConfirmation && msg.executed && msg.previewType === 'task_edit' && (
                                <div className="mt-2 px-3 py-2 bg-nexo-success/10 border border-nexo-success/20 rounded-lg text-xs text-nexo-success flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4" />
                                  Tarefa criada com sucesso!
                                </div>
                              )}
                              {/* Botões de confirmação simples (pagamentos, despesas, etc) */}
                              {msg.needsConfirmation && msg.previewType !== 'task_edit' && (
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => confirmPendingActions(true)}
                                    className="px-3 py-1 bg-nexo-success text-white text-xs rounded-lg hover:bg-nexo-success/80 transition-colors"
                                  >
                                    ✅ Confirmar
                                  </button>
                                  <button
                                    onClick={() => confirmPendingActions(false)}
                                    className="px-3 py-1 bg-nexo-border text-nexo-text text-xs rounded-lg hover:bg-nexo-card transition-colors"
                                  >
                                    ❌ Cancelar
                                  </button>
                                </div>
                              )}
                              <span className={`text-[10px] mt-1 block ${isUser ? 'text-white/60' : 'text-nexo-muted'}`}>
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                {msg.fallback && <span className="ml-2 text-yellow-400">⚡ modo rápido</span>}
                                {msg.executed && <span className="ml-2 text-green-400">✅ executado</span>}
                                {msg.quotaExhausted && (
                                  <span className="ml-2 text-orange-400" title={msg.resetAt ? `Reseta em ${new Date(msg.resetAt).toLocaleString('pt-BR')}` : ''}>
                                    ⏸️ quota esgotada
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )
                })()}
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
                    placeholder={`Mensagem em ${getThreadDisplayTitle()}...`}
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

              {/* Controle Telegram Bot */}
              <div className="mt-8">
                <h3 className="text-sm font-medium text-nexo-muted uppercase mb-4">Telegram Bot</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button onClick={() => axios.post('/api/telegram/start').then(fetchStatus)}
                    disabled={telegramStatus.running}
                    className="flex flex-col items-center gap-2 p-5 bg-nexo-bg border border-nexo-border rounded-xl hover:bg-nexo-success/10 hover:border-nexo-success transition-all disabled:opacity-50">
                    <Play className="w-6 h-6 text-nexo-success" />
                    <span className="font-semibold text-sm">Ligar Bot</span>
                  </button>
                  <button onClick={() => axios.post('/api/telegram/stop').then(fetchStatus)}
                    disabled={!telegramStatus.running}
                    className="flex flex-col items-center gap-2 p-5 bg-nexo-bg border border-nexo-border rounded-xl hover:bg-nexo-danger/10 hover:border-nexo-danger transition-all disabled:opacity-50">
                    <Square className="w-6 h-6 text-nexo-danger" />
                    <span className="font-semibold text-sm">Desligar Bot</span>
                  </button>
                  <div className="flex flex-col items-center justify-center gap-1 p-5 bg-nexo-bg border border-nexo-border rounded-xl">
                    <Bot className={`w-6 h-6 ${telegramStatus.running ? 'text-nexo-success' : 'text-nexo-muted'}`} />
                    <span className="font-semibold text-sm">{telegramStatus.running ? `@${telegramStatus.botUsername}` : 'Offline'}</span>
                  </div>
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
