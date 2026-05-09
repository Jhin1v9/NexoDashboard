import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Check, MessageCircle, User, ArrowRight } from 'lucide-react'
import axios from 'axios'
import useRealtime from '../hooks/useRealtime'

export default function Tarefas() {
  const { data, refetch } = useRealtime('/api/tasks', 15000)
  const tasks = data || []
  const [newTask, setNewTask] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [filter, setFilter] = useState('all')
  const [users, setUsers] = useState({})
  const [activeUser, setActiveUser] = useState('abner')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users')
      setUsers(res.data.users || {})
      setActiveUser(res.data.active || 'abner')
    } catch (e) {}
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    await axios.post('/api/tasks', {
      title: newTask,
      completed: false,
      addedBy: activeUser,
      assignedTo: assignedTo || null
    })
    setNewTask('')
    setAssignedTo('')
    refetch()
  }

  const toggleTask = async (task) => {
    await axios.put(`/api/tasks/${task.id}`, { completed: !task.completed })
    refetch()
  }

  const deleteTask = async (id) => {
    await axios.delete(`/api/tasks/${id}`)
    refetch()
  }

  const filtered = tasks.filter(t => {
    if (filter === 'active') return !t.completed
    if (filter === 'completed') return t.completed
    return true
  })

  const getUserName = (key) => {
    if (!key) return null
    return users[key]?.name || key
  }

  const getUserColor = (key) => {
    return users[key]?.color || '#6b7280'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Tarefas</h1>

      {/* Add task */}
      <div className="flex items-center gap-2">
        <input
          className="flex-1 px-4 py-2.5 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
          placeholder="Nova tarefa..."
          value={newTask}
          onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
        />
        <select
          value={assignedTo}
          onChange={e => setAssignedTo(e.target.value)}
          className="px-3 py-2.5 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm text-nexo-muted"
        >
          <option value="">Para...</option>
          {Object.entries(users).map(([key, u]) => (
            <option key={key} value={key}>{u.name}</option>
          ))}
        </select>
        <button onClick={addTask} className="p-2.5 bg-nexo-info rounded-lg hover:opacity-90 transition-opacity">
          <Plus size={18} className="text-white" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {['all', 'active', 'completed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-nexo-info text-white' : 'bg-nexo-card text-nexo-muted hover:text-white'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'active' ? 'Pendentes' : 'Concluídas'}
          </button>
        ))}
        <span className="ml-auto text-xs text-nexo-muted">{filtered.length} tarefas</span>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map(task => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-card p-3 flex items-start gap-3 group"
            >
              <button
                onClick={() => toggleTask(task)}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors mt-0.5 ${
                  task.completed ? 'bg-nexo-success border-nexo-success' : 'border-nexo-muted hover:border-nexo-success'
                }`}
              >
                {task.completed && <Check size={12} className="text-white" />}
              </button>

              <div className="flex-1 min-w-0">
                <span className={`text-sm block ${task.completed ? 'line-through text-nexo-muted' : ''}`}>
                  {task.title}
                </span>

                {/* Meta info: adicionado por / para */}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {task.addedBy && (
                    <span className="flex items-center gap-1 text-[10px] text-nexo-muted">
                      <User size={10} />
                      adicionado por <span style={{ color: getUserColor(task.addedBy) }}>{getUserName(task.addedBy)}</span>
                    </span>
                  )}
                  {task.assignedTo && (
                    <span className="flex items-center gap-1 text-[10px] text-nexo-muted">
                      <ArrowRight size={10} />
                      para: <span style={{ color: getUserColor(task.assignedTo) }}>{getUserName(task.assignedTo)}</span>
                    </span>
                  )}
                  {task.source === 'whatsapp' && (
                    <MessageCircle size={12} className="text-nexo-success" />
                  )}
                </div>
              </div>

              <button
                onClick={() => deleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-nexo-danger/20 rounded transition-all mt-0.5"
              >
                <Trash2 size={14} className="text-nexo-danger" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="text-center text-nexo-muted py-8 text-sm">Nenhuma tarefa encontrada</div>
        )}
      </div>
    </div>
  )
}
