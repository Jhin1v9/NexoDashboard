import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MessageCircle, CheckSquare, Lightbulb, AlertTriangle, 
  TrendingUp, Users, Clock, Zap, BarChart3, ChevronDown, ChevronUp,
  Target, ArrowUpRight, CheckCircle2, Circle, AlertCircle,
  RefreshCw, ExternalLink, Link2, FileText
} from 'lucide-react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import LinkHub from '../components/LinkHub'

// ─── UTILITÁRIOS ───

function extractLinksFromMessages(messages) {
  const urlRegex = /(https?:\/\/[^\s<>'"{}|\[\]`]+)/gi
  const links = []
  const seen = new Set()
  
  for (const msg of messages) {
    const text = msg.body || msg.text || msg.message || ''
    const matches = text.match(urlRegex)
    if (matches) {
      for (const url of matches) {
        const cleanUrl = url.replace(/[.,;!?]$/, '')
        if (!seen.has(cleanUrl)) {
          seen.add(cleanUrl)
          links.push({
            url: cleanUrl,
            title: cleanUrl.replace(/^https?:\/\//, '').substring(0, 50),
            description: text.substring(0, 120),
            sender: msg.authorName || msg.sender || msg.author || 'Desconhecido',
            group: msg.group || 'Production',
            time: msg.time || msg.timestamp || ''
          })
        }
      }
    }
  }
  return links
}

function normalizeAgentData(agentData, opsData, whatsappTasks, historyMessages = []) {
  // Dados do agente (whatsapp-agent-data.json)
  const messages = agentData?.messages || agentData?.recentMessages || agentData?.bufferedMessages || []
  // bufferedMessages pode ser número em versões antigas
  const bufferedMessages = Array.isArray(messages) ? messages : []
  // Fallback: se buffer vazio, usar histórico persistente
  const normalizedMessages = bufferedMessages.length > 0 ? bufferedMessages : (Array.isArray(historyMessages) ? historyMessages : [])
  
  const tasks = agentData?.tasks || agentData?.bufferedTasks || []
  const normalizedTasks = Array.isArray(tasks) ? tasks : []
  
  const ideas = agentData?.ideas || agentData?.bufferedIdeas || []
  const normalizedIdeas = Array.isArray(ideas) ? ideas : []
  
  const decisions = agentData?.decisions || []
  const normalizedDecisions = Array.isArray(decisions) ? decisions : []
  
  const ignoredMessages = Array.isArray(agentData?.ignoredMessages) ? agentData.ignoredMessages : []
  const totalMessages = agentData?.totalMessages || agentData?.stats?.totalMessages || normalizedMessages.length
  
  // Extrair links das mensagens
  const extractedLinks = extractLinksFromMessages(normalizedMessages)
  
  // Adicionar links do agente se houver
  const agentLinks = agentData?.links || []
  const allLinks = [...extractedLinks, ...(Array.isArray(agentLinks) ? agentLinks : [])]
  
  // Normalizar mensagens para o formato da UI
  const recentMessages = normalizedMessages.slice(0, 50).map((m, i) => ({
    id: m.id || `msg-${i}`,
    sender: m.resolvedAuthor?.name || m.authorName || m.sender || m.author || 'Desconhecido',
    senderColor: m.resolvedAuthor?.color || null,
    senderEmoji: m.resolvedAuthor?.avatarEmoji || null,
    text: m.body || m.text || m.message || '(sem texto)',
    time: m.time || m.timestamp || '',
    group: m.group || 'Production',
    type: m.type || m.classification?.category || 'text'
  }))
  
  // Normalizar tarefas
  const allTasks = normalizedTasks.map((t, i) => ({
    id: t.id || `task-${i}`,
    text: t.text || t.title || t.message || '(sem texto)',
    sender: t.sender || t.author || 'Desconhecido',
    group: t.group || 'Production',
    priority: t.priority || 'medium',
    status: t.status || 'pending',
    time: t.time || t.timestamp || '',
    project: t.project || null
  }))
  
  const highTasks = allTasks.filter(t => t.priority === 'high')
  
  // Normalizar ideias
  const normalizedIdeasList = normalizedIdeas.map((idea, i) => ({
    id: idea.id || `idea-${i}`,
    text: idea.text || idea.title || idea.message || '(sem texto)',
    sender: idea.sender || idea.author || 'Desconhecido',
    group: idea.group || 'Production'
  }))
  
  // Grupos monitorados
  const groups = [
    { name: '🏆Production - 2026🙏', short: 'Production', type: 'internal', messageCount: normalizedMessages.filter(m => !(m.group || '').includes('Paulo')).length, taskCount: allTasks.filter(t => !(t.group || '').includes('Paulo')).length, participants: ['Abner', 'Nonoke', 'Elias'], urgency: 'normal' },
    { name: 'Paulo (web)', short: 'Paulo', type: 'client', messageCount: normalizedMessages.filter(m => (m.group || '').includes('Paulo')).length, taskCount: allTasks.filter(t => (t.group || '').includes('Paulo')).length, participants: ['Paulo'], urgency: 'normal' }
  ]
  
  // Stats
  const stats = {
    totalMessages: totalMessages || normalizedMessages.length,
    totalTasks: allTasks.length,
    highPriorityTasks: highTasks.length,
    totalIdeas: normalizedIdeasList.length,
    totalDecisions: normalizedDecisions.length,
    totalLinks: allLinks.length,
    totalIgnored: ignoredMessages.length,
    activeGroups: 2,
    participants: ['Abner', 'Nonoke', 'Elias', 'Paulo'],
    historyTotal: historyMessages.length
  }
  
  // Project progress (mock baseado nos projetos reais da NEXO)
  const projectProgress = [
    { name: 'Tropicale (Juan)', progress: 85, status: 'Fase de entrega final', health: 'good', type: 'client' },
    { name: 'Santafe (Paulo)', progress: 45, status: 'Pagamento pendente', health: 'warning', type: 'client' },
    { name: 'NEXO Dashboard', progress: 75, status: 'Em desenvolvimento ativo', health: 'good', type: 'internal' },
    { name: 'NEXO Intelligence', progress: 20, status: 'Protótipo inicial', health: 'neutral', type: 'internal' }
  ]
  
  return {
    stats,
    tasks: { all: allTasks, high: highTasks },
    ideas: normalizedIdeasList,
    projects: projectProgress,
    messages: recentMessages,
    groups,
    links: allLinks,
    decisions: normalizedDecisions,
    ignoredMessages
  }
}

// ─── COMPONENTES AUXILIARES ───

const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card p-4 flex items-center gap-4"
  >
    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
      <Icon size={24} style={{ color }} />
    </div>
    <div>
      <div className="text-2xl font-bold font-heading">{value}</div>
      <div className="text-xs text-nexo-muted">{label}</div>
      {subtext && <div className="text-[10px] text-nexo-success mt-0.5">{subtext}</div>}
    </div>
  </motion.div>
)

const ProgressBar = ({ label, progress, status, health, type }) => {
  const healthColors = {
    good: { bg: '#22c55e', text: 'text-nexo-success' },
    warning: { bg: '#f59e0b', text: 'text-nexo-warning' },
    neutral: { bg: '#3b82f6', text: 'text-nexo-info' },
    danger: { bg: '#ef4444', text: 'text-nexo-danger' }
  }
  const h = healthColors[health] || healthColors.neutral
  
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={16} className={h.text} />
          <span className="font-medium text-sm">{label}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${type === 'client' ? 'bg-nexo-success/20 text-nexo-success' : 'bg-nexo-info/20 text-nexo-info'}`}>
            {type === 'client' ? '👤 Cliente' : '⚙️ Interno'}
          </span>
        </div>
        <span className="text-xs font-bold" style={{ color: h.bg }}>{progress}%</span>
      </div>
      <div className="w-full h-2.5 bg-nexo-card rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: h.bg }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-nexo-muted">{status}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${h.text} bg-opacity-10`} style={{ backgroundColor: h.bg + '20' }}>
          {health === 'good' ? 'No prazo' : health === 'warning' ? 'Atenção' : 'Neutro'}
        </span>
      </div>
    </div>
  )
}

const TaskItem = ({ task, index }) => {
  const [expanded, setExpanded] = useState(false)
  const priorityConfig = {
    high: { badge: 'bg-nexo-danger/20 text-nexo-danger border-nexo-danger/30', dot: 'bg-nexo-danger', label: '🔥 Alta' },
    medium: { badge: 'bg-nexo-warning/20 text-nexo-warning border-nexo-warning/30', dot: 'bg-nexo-warning', label: '⚡ Média' },
    low: { badge: 'bg-nexo-info/20 text-nexo-info border-nexo-info/30', dot: 'bg-nexo-info', label: '🟢 Baixa' }
  }
  const p = priorityConfig[task.priority] || priorityConfig.medium
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card p-3 space-y-2"
    >
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${p.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.text}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${p.badge}`}>
              {p.label}
            </span>
            <span className="text-[10px] text-nexo-muted flex items-center gap-1">
              <Users size={10} /> {task.sender}
            </span>
            <span className="text-[10px] text-nexo-muted flex items-center gap-1">
              <MessageCircle size={10} /> {task.group}
            </span>
            {task.project && (
              <span className="text-[10px] text-nexo-primary flex items-center gap-1">
                <Target size={10} /> {task.project}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-nexo-card rounded">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="text-xs text-nexo-muted pl-5 border-l-2 border-nexo-border ml-1"
          >
            <p>Horário: {task.time}</p>
            <p>Grupo: {task.group}</p>
            {task.project && <p>Projeto: {task.project}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const MessageBubble = ({ msg, index }) => {
  const avatarBg = msg.senderColor ? msg.senderColor + '20' : 'rgba(108,92,231,0.2)'
  const avatarText = msg.senderColor || '#6c5ce7'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="glass-card p-3 flex gap-3"
    >
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: avatarBg }}>
        <span className="text-xs font-bold" style={{ color: avatarText }}>
          {msg.senderEmoji || msg.sender?.[0]?.toUpperCase() || '?'}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-medium">{msg.sender || 'Desconhecido'}</span>
          <span className="text-[10px] text-nexo-muted">{msg.time}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-card text-nexo-muted">{msg.group}</span>
        </div>
        <p className="text-sm text-nexo-text/90 line-clamp-2">{msg.text}</p>
      </div>
    </motion.div>
  )
}

const LinkPreview = ({ link, index }) => (
  <motion.a
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    href={link.url}
    target="_blank"
    rel="noopener noreferrer"
    className="glass-card p-3 flex gap-3 hover:border-nexo-primary/50 transition-colors block"
  >
    <div className="w-10 h-10 rounded-lg bg-nexo-primary/20 flex items-center justify-center flex-shrink-0">
      <Link2 size={18} className="text-nexo-primary" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-nexo-primary truncate flex items-center gap-1">
        {link.title || link.url}
        <ExternalLink size={12} />
      </div>
      {link.description && (
        <p className="text-xs text-nexo-muted line-clamp-2 mt-0.5">{link.description}</p>
      )}
      <div className="flex items-center gap-2 mt-1 text-[10px] text-nexo-muted">
        <span>👤 {link.sender}</span>
        <span>💬 {link.group}</span>
      </div>
    </div>
  </motion.a>
)

// ─── PÁGINA PRINCIPAL ───

export default function WhatsApp() {
  const [agentData, setAgentData] = useState(null)
  const [opsData, setOpsData] = useState(null)
  const [whatsappTasks, setWhatsappTasks] = useState([])
  const [historyMessages, setHistoryMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [lastUpdate, setLastUpdate] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()

  const data = useMemo(() => {
    if (!agentData) return null
    return normalizeAgentData(agentData, opsData, whatsappTasks, historyMessages)
  }, [agentData, opsData, whatsappTasks, historyMessages])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Buscar múltiplas fontes de dados em paralelo
      const [agentRes, opsRes, tasksRes, historyRes] = await Promise.allSettled([
        axios.get('/api/whatsapp-agent'),
        axios.get('/api/ops'),
        axios.get('/api/whatsapp'),
        axios.get('/api/whatsapp/history?limit=50')
      ])
      
      if (agentRes.status === 'fulfilled') {
        setAgentData(agentRes.value.data)
        setLastUpdate(new Date(agentRes.value.data.updatedAt))
      }
      
      if (opsRes.status === 'fulfilled') {
        setOpsData(opsRes.value.data)
      }
      
      if (tasksRes.status === 'fulfilled') {
        setWhatsappTasks(tasksRes.value.data || [])
      }

      if (historyRes.status === 'fulfilled') {
        const msgs = historyRes.value.data?.messages || []
        setHistoryMessages(msgs)
      }
      
      if (agentRes.status === 'rejected') {
        setError(agentRes.reason.response?.status === 404 
          ? 'Agente não iniciado. Execute: node agents/luna-cto-agent.mjs' 
          : agentRes.reason.message)
      } else {
        setError(null)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await axios.post('/api/whatsapp-agent/refresh')
      await fetchData()
    } catch (e) {
      console.error('Refresh failed:', e)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-nexo-info border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-nexo-muted">Carregando dados do WhatsApp Agent...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center glass-card p-8 max-w-md">
          <AlertTriangle size={48} className="text-nexo-warning mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Agente não encontrado</h2>
          <p className="text-nexo-muted text-sm mb-4">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-nexo-info rounded-lg text-sm hover:opacity-90">
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const stats = data?.stats || {}
  const tasks = data?.tasks?.all || []
  const highTasks = data?.tasks?.high || []
  const ideas = data?.ideas || []
  const projects = data?.projects || []
  const messages = data?.messages || []
  const groups = data?.groups || []
  const links = data?.links || []
  const ignoredMessages = data?.ignoredMessages || []

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
    { id: 'tasks', label: `Tarefas (${tasks.length})`, icon: CheckSquare },
    { id: 'projects', label: 'Projetos', icon: Target },
    { id: 'messages', label: `Mensagens (${messages.length})`, icon: MessageCircle },
    { id: 'ignored', label: `Ignoradas (${ignoredMessages.length})`, icon: AlertCircle },
    { id: 'links', label: `Links (${links.length})`, icon: Link2 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <MessageCircle className="text-nexo-success" />
            WhatsApp Intelligence
          </h1>
          <p className="text-xs text-nexo-muted mt-1">
            {lastUpdate ? `Atualizado: ${lastUpdate.toLocaleString('pt-BR')}` : 'Carregando...'}
            {groups.length > 0 && ` • ${groups.length} grupos monitorados`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando...' : 'Refresh'}
          </button>
          <button 
            onClick={() => navigate('/relatorios')}
            className="flex items-center gap-2 px-3 py-2 bg-nexo-primary rounded-lg text-xs hover:opacity-90 transition-opacity"
          >
            <FileText size={14} />
            Relatórios
          </button>
          <span className={`w-2 h-2 rounded-full ${data ? 'bg-nexo-success animate-pulse' : 'bg-nexo-muted'}`} />
          <span className="text-xs text-nexo-muted">{data ? 'Agente ativo' : 'Inativo'}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={MessageCircle} label="Mensagens" value={stats.totalMessages || 0} color="#22c55e" 
          subtext={groups.map(g => `${g.short}: ${g.messageCount}`).join(', ')} />
        <StatCard icon={CheckSquare} label="Tarefas" value={stats.totalTasks || 0} color="#f59e0b" 
          subtext={`${stats.highPriorityTasks || 0} alta prioridade`} />
        <StatCard icon={Lightbulb} label="Ideias" value={stats.totalIdeas || 0} color="#3b82f6" />
        <StatCard icon={Zap} label="Decisões" value={stats.totalDecisions || 0} color="#6366f1" />
        <StatCard icon={AlertCircle} label="Ignoradas" value={stats.totalIgnored || ignoredMessages.length} color="#747d8c" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-nexo-border pb-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'text-nexo-info border-b-2 border-nexo-info bg-nexo-info/5' 
                : 'text-nexo-muted hover:text-nexo-text'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Progresso dos Projetos */}
            <div>
              <h2 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-nexo-success" />
                Progresso dos Projetos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((proj, i) => (
                  <ProgressBar key={i} {...proj} />
                ))}
              </div>
            </div>

            {/* Grupos Monitorados */}
            <div>
              <h2 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
                <Users size={20} className="text-nexo-info" />
                Grupos Monitorados
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map((group, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                    className="glass-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{group.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${group.type === 'client' ? 'bg-nexo-success/20 text-nexo-success' : 'bg-nexo-info/20 text-nexo-info'}`}>
                          {group.type === 'client' ? '👤 Cliente' : '⚙️ Interno'}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          group.urgency === 'high' ? 'bg-nexo-danger/20 text-nexo-danger' : 'bg-nexo-success/20 text-nexo-success'
                        }`}>
                          {group.urgency === 'high' ? '🔥 Urgente' : '✅ Normal'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-nexo-card rounded-lg p-2">
                        <div className="text-lg font-bold text-nexo-info">{group.messageCount}</div>
                        <div className="text-[10px] text-nexo-muted">Msgs</div>
                      </div>
                      <div className="bg-nexo-card rounded-lg p-2">
                        <div className="text-lg font-bold text-nexo-warning">{group.taskCount}</div>
                        <div className="text-[10px] text-nexo-muted">Tarefas</div>
                      </div>
                      <div className="bg-nexo-card rounded-lg p-2">
                        <div className="text-lg font-bold text-nexo-success">{group.participants?.length || 0}</div>
                        <div className="text-[10px] text-nexo-muted">Membros</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {group.participants?.map((p, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 bg-nexo-card rounded-full text-nexo-muted">
                          {p}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Tarefas Prioritárias */}
            {highTasks.length > 0 && (
              <div>
                <h2 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-nexo-danger" />
                  Tarefas de Alta Prioridade
                </h2>
                <div className="space-y-2">
                  {highTasks.slice(0, 5).map((task, i) => (
                    <TaskItem key={task.id || i} task={task} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Links Recentes */}
            {links.length > 0 && (
              <div>
                <h2 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
                  <Link2 size={20} className="text-nexo-primary" />
                  Links Recentes
                </h2>
                <div className="space-y-2">
                  {links.slice(0, 3).map((link, i) => (
                    <LinkPreview key={i} link={link} index={i} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'tasks' && (
          <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-nexo-card rounded-full overflow-hidden">
                <div className="h-full bg-nexo-success rounded-full" style={{ width: `${tasks.filter(t => t.status === 'completed').length / Math.max(tasks.length, 1) * 100}%` }} />
              </div>
              <span className="text-xs text-nexo-muted">
                {tasks.filter(t => t.status === 'completed').length}/{tasks.length} concluídas
              </span>
            </div>
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <TaskItem key={task.id || i} task={task} index={i} />
              ))}
              {tasks.length === 0 && (
                <div className="text-center text-nexo-muted py-12">
                  <CheckCircle2 size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Nenhuma tarefa encontrada</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'projects' && (
          <motion.div key="projects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Barra de Progresso Geral */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold mb-4">Progresso Geral da Empresa</h3>
              <div className="space-y-4">
                {projects.map((proj, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{proj.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${proj.type === 'client' ? 'bg-nexo-success/20 text-nexo-success' : 'bg-nexo-info/20 text-nexo-info'}`}>
                          {proj.type === 'client' ? '👤 Cliente' : '⚙️ Interno'}
                        </span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: proj.health === 'good' ? '#22c55e' : proj.health === 'warning' ? '#f59e0b' : '#3b82f6' }}>
                        {proj.progress}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-nexo-card rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${proj.progress}%` }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: i * 0.1 }}
                        className="h-full rounded-full"
                        style={{ 
                          backgroundColor: proj.health === 'good' ? '#22c55e' : proj.health === 'warning' ? '#f59e0b' : '#3b82f6'
                        }}
                      />
                    </div>
                    <p className="text-xs text-nexo-muted">{proj.status}</p>
                  </div>
                ))}
              </div>
              
              {/* Média Geral */}
              <div className="mt-6 pt-4 border-t border-nexo-border">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Média Geral</span>
                  <span className="text-2xl font-bold text-nexo-info">
                    {Math.round(projects.reduce((a, p) => a + p.progress, 0) / Math.max(projects.length, 1))}%
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold mb-4">Linha do Tempo</h3>
              <div className="space-y-4">
                {projects.map((proj, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: proj.progress >= 60 ? '#22c55e20' : proj.progress >= 30 ? '#f59e0b20' : '#3b82f620' }}>
                      {proj.progress >= 60 ? <CheckCircle2 size={16} className="text-nexo-success" /> :
                       proj.progress >= 30 ? <Clock size={16} className="text-nexo-warning" /> :
                       <Circle size={16} className="text-nexo-info" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{proj.name}</p>
                      <p className="text-xs text-nexo-muted">{proj.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'messages' && (
          <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} index={i} />
            ))}
            {messages.length === 0 && (
              <div className="text-center text-nexo-muted py-12">
                <MessageCircle size={48} className="mx-auto mb-4 opacity-30" />
                <p>Nenhuma mensagem recente</p>
                <p className="text-xs mt-2">As mensagens aparecem quando o Luna faz scan com novidades.</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'ignored' && (
          <motion.div key="ignored" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {ignoredMessages.slice().reverse().map((msg, i) => (
              <div key={msg.id || i} className="glass-card p-3">
                <div className="flex items-start gap-3">
                  <AlertCircle size={16} className="text-nexo-muted mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm text-nexo-text">{msg.body || msg.text || '(sem texto)'}</p>
                    <p className="text-xs text-nexo-muted mt-1">
                      {msg.authorName || msg.author || 'Desconhecido'} • {msg.reason || 'Sem sinal NEXO'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {ignoredMessages.length === 0 && (
              <div className="text-center text-nexo-muted py-12">
                <AlertCircle size={48} className="mx-auto mb-4 opacity-30" />
                <p>Nenhuma mensagem ignorada</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'links' && (
          <motion.div key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LinkHub />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

