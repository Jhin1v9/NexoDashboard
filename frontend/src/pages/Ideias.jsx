import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb, Plus, LayoutGrid, List, Table2, Kanban,
  Search, Loader2, Bot, X
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
  const [searchQuery, setSearchQuery] = useState('')
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // BUSCA LOCAL
  // ═══════════════════════════════════════════════════════════════════════════════
  const filteredIdeas = useMemo(() => {
    if (!searchQuery.trim()) return ideas
    const q = searchQuery.toLowerCase().trim()
    return ideas.filter(idea => {
      const searchable = [
        idea.title,
        idea.description,
        idea.content,
        idea.createdByName,
        idea.linkedTo?.clientName,
        idea.status,
        idea.priority,
        idea.type,
        ...(idea.tags || [])
      ].filter(Boolean).join(' ').toLowerCase()
      return searchable.includes(q)
    })
  }, [ideas, searchQuery])

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

      {/* TABS + SEARCH + FILTERS */}
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

          {/* Search + Filters */}
          <div className="flex items-center gap-2 flex-1 max-w-2xl">
            {/* Campo de busca */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nexo-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar em título, tags, autor, cliente..."
                className="w-full pl-9 pr-8 py-2 bg-nexo-card border border-nexo-border rounded-lg text-sm text-nexo-text placeholder:text-nexo-muted/60 focus:outline-none focus:border-nexo-primary/50 focus:ring-1 focus:ring-nexo-primary/20 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10 text-nexo-muted hover:text-nexo-text transition-colors"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex-1 max-w-md">
              <IdeaFilters filters={filters} onChange={setFilters} />
            </div>
          </div>
        </div>

        {/* Contador de resultados */}
        {(searchQuery || Object.keys(filters).some(k => filters[k])) && (
          <div className="flex items-center gap-2 text-xs text-nexo-muted">
            <span className="px-2 py-1 bg-nexo-primary/10 text-nexo-primary rounded-md font-medium">
              {filteredIdeas.length} {filteredIdeas.length === 1 ? 'resultado' : 'resultados'}
            </span>
            {searchQuery && (
              <span>
                buscando por "<span className="text-nexo-text font-medium">{searchQuery}</span>"
              </span>
            )}
            {ideas.length !== filteredIdeas.length && (
              <span className="text-nexo-muted/60">
                (de {ideas.length} total)
              </span>
            )}
          </div>
        )}
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
              {view === 'table' && <IdeasTable ideas={filteredIdeas} onRefresh={fetchIdeas} />}
              {view === 'kanban' && <IdeasKanban ideas={filteredIdeas} onRefresh={fetchIdeas} />}
              {view === 'gallery' && <IdeasGallery ideas={filteredIdeas} onRefresh={fetchIdeas} />}
              {view === 'list' && <IdeasList ideas={filteredIdeas} onRefresh={fetchIdeas} />}
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
