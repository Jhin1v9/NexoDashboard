import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb, Plus, LayoutGrid, List, Table2, Kanban,
  Search, Loader2, Bot
} from 'lucide-react'
import axios from 'axios'
import IdeaStats from '../components/ideas/IdeaStats'
import IdeaFilters from '../components/ideas/IdeaFilters'
import IdeasTable from '../components/ideas/IdeasTable'
import IdeasKanban from '../components/ideas/IdeasKanban'
import IdeasGallery from '../components/ideas/IdeasGallery'
import IdeasList from '../components/ideas/IdeasList'
import IdeaQuickAdd from '../components/ideas/IdeaQuickAdd'

const TABS = [
  { id: 'table', icon: Table2, label: 'Tabela' },
  { id: 'kanban', icon: Kanban, label: 'Kanban' },
  { id: 'gallery', icon: LayoutGrid, label: 'Galeria' },
  { id: 'list', icon: List, label: 'Lista' }
]

export default function Ideias() {
  const navigate = useNavigate()
  const [view, setView] = useState('kanban')
  const [ideas, setIdeas] = useState([])
  const [stats, setStats] = useState({})
  const [filters, setFilters] = useState({})
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [loading, setLoading] = useState(false)

  const buildQuery = (f) => {
    const params = new URLSearchParams()
    Object.entries(f).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value)
      }
    })
    return params.toString()
  }

  const fetchIdeas = useCallback(async () => {
    setLoading(true)
    try {
      const query = buildQuery(filters)
      const res = await axios.get(`/api/ideas${query ? `?${query}` : ''}`)
      if (res.data.success) {
        setIdeas(res.data.data?.ideas || [])
      }
    } catch (err) {
      console.error('[Ideias] fetchIdeas error:', err)
      setIdeas([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get('/api/ideas/stats')
      if (res.data.success) {
        setStats(res.data.data || {})
      }
    } catch (err) {
      console.error('[Ideias] fetchStats error:', err)
      setStats({})
    }
  }, [])

  useEffect(() => {
    fetchIdeas()
    fetchStats()
  }, [fetchIdeas, fetchStats])

  const handleCreated = () => {
    fetchIdeas()
    fetchStats()
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nexo-warning/20 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-nexo-warning" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-heading text-nexo-text">Ideias</h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-nexo-primary/20 text-nexo-primary border border-nexo-primary/20">
                beta
              </span>
            </div>
            <p className="text-xs text-nexo-muted">Workspace criativo da NEXO Digital</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/luna?context=ideas')}
            className="flex items-center gap-2 px-3 py-2 bg-nexo-card text-nexo-text text-sm font-medium rounded-lg hover:bg-nexo-primary/10 hover:text-nexo-primary border border-nexo-border transition-colors"
            title="Chat com Luna sobre Ideias"
          >
            <Bot className="w-4 h-4" />
            Luna
          </button>
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-nexo-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-nexo-primary/20"
          >
            <Plus className="w-4 h-4" />
            Nova Ideia
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <IdeaStats stats={stats} />

      {/* TABS + FILTERS */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-nexo-bg rounded-xl border border-nexo-border">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = view === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-nexo-primary text-white shadow-sm'
                      : 'text-nexo-muted hover:text-nexo-text hover:bg-nexo-card/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Filters */}
          <div className="flex-1 max-w-lg">
            <IdeaFilters filters={filters} onChange={setFilters} />
          </div>
        </div>
      </div>

      {/* CONTENT AREA com AnimatePresence */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view + JSON.stringify(filters)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-nexo-primary animate-spin" />
              <span className="ml-2 text-sm text-nexo-muted">Carregando ideias...</span>
            </div>
          ) : (
            <>
              {view === 'table' && <IdeasTable ideas={ideas} onRefresh={fetchIdeas} />}
              {view === 'kanban' && <IdeasKanban ideas={ideas} onRefresh={fetchIdeas} />}
              {view === 'gallery' && <IdeasGallery ideas={ideas} onRefresh={fetchIdeas} />}
              {view === 'list' && <IdeasList ideas={ideas} onRefresh={fetchIdeas} />}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* QUICK ADD MODAL */}
      <AnimatePresence>
        {showQuickAdd && (
          <IdeaQuickAdd
            onClose={() => setShowQuickAdd(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
