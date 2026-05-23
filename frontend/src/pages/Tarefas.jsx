import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Check, MessageCircle, User, ArrowRight,
  Clock, Calendar, AlertTriangle, Flag, Type, X,
  ChevronDown, Filter, AlignLeft, Send, Activity
} from 'lucide-react'
import axios from 'axios'
import useRealtime from '../hooks/useRealtime'
import { useAuth } from '../context/AuthContext'
import TaskHarvester from '../components/luna/harvesters/TaskHarvester'

const STATUS_CONFIG = {
  pending: { label: 'Pendente', color: 'bg-gray-500', text: 'text-gray-400', border: 'border-gray-500', icon: Clock },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500', icon: Activity },
  completed: { label: 'Finalizada', color: 'bg-green-500', text: 'text-green-400', border: 'border-green-500', icon: Check },
  cancelled: { label: 'Cancelada', color: 'bg-red-500', text: 'text-red-400', border: 'border-red-500', icon: X }
}

const PRIORITY_CONFIG = {
  low: { label: 'Baixa', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  medium: { label: 'Média', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  high: { label: 'Alta', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
}

const TYPE_CONFIG = {
  daily: { label: 'Diária', icon: Clock },
  weekly: { label: 'Semanal', icon: Calendar },
  monthly: { label: 'Mensal', icon: Calendar },
  one_time: { label: 'Única', icon: Flag }
}

export default function Tarefas() {
  const { data, refetch } = useRealtime('/api/tasks', 15000)
  const tasks = data || []

  const { user: authUser } = useAuth()
  const [users, setUsers] = useState({})
  const [activeUser, setActiveUser] = useState(authUser?.id || 'abner')

  // Create form
  const [newTask, setNewTask] = useState('')
  const [newAssignedTo, setNewAssignedTo] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newType, setNewType] = useState('one_time')
  const [newDueDate, setNewDueDate] = useState('')

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [personFilter, setPersonFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)

  // Modal
  const [modalTask, setModalTask] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [newComment, setNewComment] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const commentInputRef = useRef(null)

  // Usuários disponíveis para @mention
  const MENTION_USERS = useMemo(() => {
    return Object.entries(users).map(([id, u]) => ({ id, name: u.name || id }))
  }, [users])
  const filteredMentions = MENTION_USERS.filter(u =>
    u.name.toLowerCase().includes(mentionQuery)
  )

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users')
      setUsers(res.data.users || {})
      if (authUser?.id) setActiveUser(authUser.id)
    } catch (e) {}
  }

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === 'completed') return false
    return new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0))
  }

  const formatDueDate = (dueDate) => {
    if (!dueDate) return null
    const d = new Date(dueDate)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const filtered = useMemo(() => {
    let list = [...tasks]
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter)
    if (personFilter) list = list.filter(t => t.assignedTo === personFilter)
    if (priorityFilter) list = list.filter(t => t.priority === priorityFilter)
    if (typeFilter) list = list.filter(t => t.taskType === typeFilter)
    if (showOverdueOnly) list = list.filter(t => isOverdue(t.dueDate, t.status) && t.status !== 'completed')
    return list.sort((a, b) => {
      // Ordena: atrasadas primeiro, depois por dueDate, depois por prioridade
      const aOverdue = isOverdue(a.dueDate, a.status) ? 1 : 0
      const bOverdue = isOverdue(b.dueDate, b.status) ? 1 : 0
      if (bOverdue !== aOverdue) return bOverdue - aOverdue
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate)
      const prioOrder = { high: 0, medium: 1, low: 2 }
      return (prioOrder[a.priority] || 1) - (prioOrder[b.priority] || 1)
    })
  }, [tasks, statusFilter, personFilter, priorityFilter, typeFilter, showOverdueOnly])

  const stats = useMemo(() => {
    const total = tasks.length
    const pending = tasks.filter(t => t.status === 'pending').length
    const inProgress = tasks.filter(t => t.status === 'in_progress').length
    const overdue = tasks.filter(t => isOverdue(t.dueDate, t.status) && t.status !== 'completed').length
    return { total, pending, inProgress, overdue }
  }, [tasks])

  const addTask = async () => {
    if (!newTask.trim()) return
    await axios.post('/api/tasks', {
      title: newTask,
      addedBy: activeUser,
      assignedTo: newAssignedTo || null,
      priority: newPriority,
      taskType: newType,
      dueDate: newDueDate || null
    })
    setNewTask('')
    setNewAssignedTo('')
    setNewPriority('medium')
    setNewType('one_time')
    setNewDueDate('')
    refetch()
  }

  const deleteTask = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta tarefa?')) return
    await axios.delete(`/api/tasks/${id}`)
    refetch()
  }

  const openModal = (task) => {
    setModalTask(task)
    setEditForm({ ...task })
    setNewComment('')
  }

  const closeModal = () => {
    setModalTask(null)
    setEditForm({})
    setNewComment('')
  }

  const saveTask = async () => {
    if (!modalTask) return
    try {
      // Sanitiza o payload: envia apenas campos editáveis
      const payload = {
        title: editForm.title,
        description: editForm.description,
        status: editForm.status,
        priority: editForm.priority,
        taskType: editForm.taskType,
        dueDate: editForm.dueDate || null,
        assignedTo: editForm.assignedTo || null
      }
      await axios.put(`/api/tasks/${modalTask.id}`, payload)
      await refetch()
      closeModal()
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err)
      alert('Erro ao salvar tarefa. Tente novamente.')
    }
  }

  const checkMentions = (text = newComment) => {
    const lastAtIndex = text.lastIndexOf('@')
    if (lastAtIndex >= 0) {
      const afterAt = text.slice(lastAtIndex + 1)
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt.toLowerCase())
        setShowMentions(true)
        return
      }
    }
    setShowMentions(false)
  }

  const insertMention = (user) => {
    const lastAtIndex = newComment.lastIndexOf('@')
    const before = newComment.slice(0, lastAtIndex)
    const after = newComment.slice(lastAtIndex + 1 + mentionQuery.length)
    setNewComment(`${before}@${user.name} ${after}`)
    setShowMentions(false)
    commentInputRef.current?.focus()
  }

  const renderCommentText = (text) => {
    if (!text) return text
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="text-nexo-primary font-semibold bg-nexo-primary/10 px-0.5 rounded">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  const addComment = async () => {
    if (!newComment.trim() || !modalTask) return
    try {
      const mentions = []
      MENTION_USERS.forEach(u => {
        if (newComment.includes(`@${u.name}`)) mentions.push(u.id)
      })
      await axios.post(`/api/tasks/${modalTask.id}/comments`, {
        text: newComment,
        author: activeUser,
        mentions: mentions.length > 0 ? mentions : undefined
      })
      setNewComment('')
      // Refresh modal data
      const res = await axios.get('/api/tasks')
      const updated = res.data.find(t => t.id === modalTask.id)
      if (updated) {
        setModalTask(updated)
        setEditForm({ ...updated })
      }
      await refetch()
    } catch (err) {
      console.error('Erro ao adicionar comentário:', err)
      alert('Erro ao adicionar comentário. Tente novamente.')
    }
  }

  const getUserName = (key) => users[key]?.name || key || 'Sistema'
  const getUserColor = (key) => users[key]?.color || '#6b7280'

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold font-heading">Tarefas</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-nexo-border flex items-center justify-center">
            <Flag size={16} className="text-nexo-text" />
          </div>
          <div>
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-[10px] text-nexo-muted uppercase">Total</div>
          </div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-500/20 flex items-center justify-center">
            <Clock size={16} className="text-gray-400" />
          </div>
          <div>
            <div className="text-lg font-bold">{stats.pending}</div>
            <div className="text-[10px] text-nexo-muted uppercase">Pendentes</div>
          </div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Activity size={16} className="text-blue-400" />
          </div>
          <div>
            <div className="text-lg font-bold">{stats.inProgress}</div>
            <div className="text-[10px] text-nexo-muted uppercase">Em Andamento</div>
          </div>
        </div>
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center">
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <div>
            <div className="text-lg font-bold">{stats.overdue}</div>
            <div className="text-[10px] text-nexo-muted uppercase">Atrasadas</div>
          </div>
        </div>
      </div>

      {/* Quick Create */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-2">
        <input
          className="flex-1 min-w-[200px] px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
          placeholder="Nova tarefa..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
        />
        <select value={newAssignedTo} onChange={e => setNewAssignedTo(e.target.value)}
          className="px-2 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-xs text-nexo-muted">
          <option value="">Para...</option>
          {Object.entries(users).map(([key, u]) => (
            <option key={key} value={key}>{u.name}</option>
          ))}
        </select>
        <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
          className="px-2 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-xs text-nexo-muted">
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
        </select>
        <select value={newType} onChange={e => setNewType(e.target.value)}
          className="px-2 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-xs text-nexo-muted">
          <option value="one_time">Única</option>
          <option value="daily">Diária</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
        </select>
        <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
          className="px-2 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-xs text-nexo-muted"
        />
        <button onClick={addTask} className="p-2 bg-nexo-info rounded-lg hover:opacity-90 transition-opacity">
          <Plus size={16} className="text-white" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'pending', label: 'Pendentes' },
          { key: 'in_progress', label: 'Em Andamento' },
          { key: 'completed', label: 'Finalizadas' }
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s.key ? 'bg-nexo-info text-white' : 'bg-nexo-card text-nexo-muted hover:text-white'
            }`}>
            {s.label}
          </button>
        ))}

        <div className="w-px h-5 bg-nexo-border mx-1" />

        <select value={personFilter} onChange={e => setPersonFilter(e.target.value)}
          className="px-2 py-1.5 bg-nexo-card rounded-lg text-xs text-nexo-muted outline-none border border-transparent focus:border-nexo-info">
          <option value="">Todos</option>
          {Object.entries(users).map(([key, u]) => (
            <option key={key} value={key}>{u.name}</option>
          ))}
        </select>

        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="px-2 py-1.5 bg-nexo-card rounded-lg text-xs text-nexo-muted outline-none border border-transparent focus:border-nexo-info">
          <option value="">Prioridade</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-2 py-1.5 bg-nexo-card rounded-lg text-xs text-nexo-muted outline-none border border-transparent focus:border-nexo-info">
          <option value="">Tipo</option>
          <option value="daily">Diária</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
          <option value="one_time">Única</option>
        </select>

        <button onClick={() => setShowOverdueOnly(!showOverdueOnly)}
          className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            showOverdueOnly ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-nexo-card text-nexo-muted hover:text-white'
          }`}>
          <AlertTriangle size={10} className="inline mr-1" />
          Atrasadas
        </button>

        <span className="ml-auto text-xs text-nexo-muted">{filtered.length} tarefas</span>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map(task => {
            const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
            const prioCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
            const typeCfg = TYPE_CONFIG[task.taskType] || TYPE_CONFIG.one_time
            const overdue = isOverdue(task.dueDate, task.status)
            const StatusIcon = statusCfg.icon
            const TypeIcon = typeCfg.icon

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={() => openModal(task)}
                className="glass-card p-3 flex items-start gap-3 group cursor-pointer hover:border-nexo-info/50 transition-colors"
              >
                {/* Status indicator */}
                <div className={`w-5 h-5 rounded-full ${statusCfg.color} flex items-center justify-center mt-0.5 flex-shrink-0`}>
                  <StatusIcon size={12} className="text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm ${task.status === 'completed' ? 'line-through text-nexo-muted' : ''}`}>
                      {task.title}
                    </span>
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${prioCfg.color}`}>
                      {prioCfg.label}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-nexo-muted bg-nexo-bg px-1.5 py-0.5 rounded">
                      <TypeIcon size={10} />
                      {typeCfg.label}
                    </span>
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                        overdue ? 'bg-red-500/20 text-red-400' : 'bg-nexo-bg text-nexo-muted'
                      }`}>
                        <Calendar size={10} />
                        {formatDueDate(task.dueDate)}
                        {overdue && ' (atrasada)'}
                      </span>
                    )}
                    {(task.comments?.length > 0) && (
                      <span className="flex items-center gap-1 text-[10px] text-nexo-muted bg-nexo-bg px-1.5 py-0.5 rounded">
                        <MessageCircle size={10} />
                        {task.comments.length}
                      </span>
                    )}
                  </div>

                  {/* Meta: addedBy / assignedTo */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {task.addedBy && (
                      <span className="flex items-center gap-1 text-[10px] text-nexo-muted">
                        <User size={9} />
                        por <span style={{ color: getUserColor(task.addedBy) }}>{getUserName(task.addedBy)}</span>
                      </span>
                    )}
                    {task.assignedTo && (
                      <span className="flex items-center gap-1 text-[10px] text-nexo-muted">
                        <ArrowRight size={9} />
                        para <span style={{ color: getUserColor(task.assignedTo) }}>{getUserName(task.assignedTo)}</span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-nexo-danger/20 rounded transition-all mt-0.5"
                  title="Excluir tarefa"
                >
                  <Trash2 size={14} className="text-nexo-danger" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-center text-nexo-muted py-12 text-sm">
            <Check size={32} className="mx-auto mb-2 opacity-20" />
            Nenhuma tarefa encontrada
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-nexo-border"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-nexo-border flex items-center justify-between">
                <h2 className="text-lg font-bold">Detalhes da Tarefa</h2>
                <button onClick={closeModal} className="p-1.5 hover:bg-nexo-card rounded-lg transition-colors">
                  <X size={18} className="text-nexo-muted" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Title */}
                <div>
                  <label className="text-xs text-nexo-muted uppercase mb-1 block">Título</label>
                  <input
                    value={editForm.title || ''}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-nexo-muted uppercase mb-1 block flex items-center gap-1">
                    <AlignLeft size={10} /> Contexto / Descrição
                  </label>
                  <textarea
                    value={editForm.description || ''}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm resize-none"
                    placeholder="Detalhes, links, contexto..."
                  />
                </div>

                {/* Grid de campos */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block">Status</label>
                    <select
                      value={editForm.status || 'pending'}
                      onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-2 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-xs"
                    >
                      <option value="pending">Pendente</option>
                      <option value="in_progress">Em Andamento</option>
                      <option value="completed">Finalizada</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block">Prioridade</label>
                    <select
                      value={editForm.priority || 'medium'}
                      onChange={e => setEditForm({ ...editForm, priority: e.target.value })}
                      className="w-full px-2 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-xs"
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block">Tipo</label>
                    <select
                      value={editForm.taskType || 'one_time'}
                      onChange={e => setEditForm({ ...editForm, taskType: e.target.value })}
                      className="w-full px-2 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-xs"
                    >
                      <option value="one_time">Única</option>
                      <option value="daily">Diária</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block">Vencimento</label>
                    <input
                      type="date"
                      value={editForm.dueDate ? editForm.dueDate.slice(0, 10) : ''}
                      onChange={e => setEditForm({ ...editForm, dueDate: e.target.value || null })}
                      className="w-full px-2 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block">Para</label>
                    <select
                      value={editForm.assignedTo || ''}
                      onChange={e => setEditForm({ ...editForm, assignedTo: e.target.value || null })}
                      className="w-full px-2 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-xs"
                    >
                      <option value="">Ninguém</option>
                      {Object.entries(users).map(([key, u]) => (
                        <option key={key} value={key}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-nexo-bg rounded-lg p-3 space-y-1">
                  <div className="text-[10px] text-nexo-muted uppercase mb-1">Histórico</div>
                  {editForm.createdAt && (
                    <div className="text-[11px] text-nexo-muted">Criada: {new Date(editForm.createdAt).toLocaleString('pt-BR')}</div>
                  )}
                  {editForm.startedAt && (
                    <div className="text-[11px] text-blue-400">Iniciada: {new Date(editForm.startedAt).toLocaleString('pt-BR')}</div>
                  )}
                  {editForm.completedAt && (
                    <div className="text-[11px] text-green-400">Finalizada: {new Date(editForm.completedAt).toLocaleString('pt-BR')}</div>
                  )}
                </div>

                {/* Comments */}
                <div>
                  <label className="text-xs text-nexo-muted uppercase mb-2 block flex items-center gap-1">
                    <MessageCircle size={10} /> Comentários ({(editForm.comments || []).length})
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(editForm.comments || []).map(c => (
                      <div key={c.id} className="bg-nexo-bg rounded-lg p-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold"
                            style={{ backgroundColor: getUserColor(c.author) }}>
                            {getUserName(c.author).charAt(0)}
                          </div>
                          <span className="text-[11px] font-medium">{getUserName(c.author)}</span>
                          <span className="text-[10px] text-nexo-muted ml-auto">
                            {new Date(c.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-nexo-text pl-7">{renderCommentText(c.text)}</p>
                      </div>
                    ))}
                    {(editForm.comments || []).length === 0 && (
                      <p className="text-xs text-nexo-muted text-center py-2">Nenhum comentário ainda</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 relative">
                    <div className="flex-1 relative">
                      <input
                        ref={commentInputRef}
                        value={newComment}
                        onChange={e => {
                          const val = e.target.value
                          setNewComment(val)
                          checkMentions(val)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); addComment() }
                          if (e.key === '@') checkMentions(newComment + '@')
                          if (e.key === 'Backspace' && showMentions) checkMentions()
                        }}
                        placeholder="Adicionar comentário... Use @ para mencionar"
                        className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-xs"
                      />
                      {/* Mention dropdown */}
                      <AnimatePresence>
                        {showMentions && filteredMentions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="absolute bottom-full left-0 mb-1 w-40 bg-nexo-card border border-nexo-border rounded-xl shadow-xl overflow-hidden z-[50]"
                          >
                            {filteredMentions.map(user => (
                              <button
                                key={user.id}
                                onClick={() => insertMention(user)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-nexo-bg transition-colors"
                              >
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold"
                                  style={{ backgroundColor: getUserColor(user.id) }}>
                                  {user.name.charAt(0)}
                                </div>
                                <span className="text-xs text-nexo-text">{user.name}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <button onClick={addComment} className="p-2 bg-nexo-info rounded-lg hover:opacity-90">
                      <Send size={14} className="text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-nexo-border flex items-center justify-between">
                <button
                  onClick={() => { deleteTask(modalTask.id); closeModal() }}
                  className="px-3 py-2 text-xs text-nexo-danger hover:bg-nexo-danger/10 rounded-lg transition-colors"
                  title="Excluir tarefa"
                >
                  <Trash2 size={14} className="inline mr-1" />
                  Deletar
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={closeModal}
                    className="px-3 py-2 text-xs text-nexo-muted hover:bg-nexo-card rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button onClick={saveTask}
                    className="px-4 py-2 bg-nexo-info text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity">
                    Salvar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TaskHarvester
        tasks={tasks}
        filtered={filtered}
        stats={stats}
        filters={{
          statusFilter,
          personFilter,
          priorityFilter,
          typeFilter,
          showOverdueOnly,
        }}
        modalTask={modalTask}
        users={users}
      />
    </div>
  )
}
