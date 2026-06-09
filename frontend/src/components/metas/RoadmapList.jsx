import { useState } from 'react'
import { Target, Search, Filter, ArrowUpDown, Plus, Trash2 } from 'lucide-react'

const STATUS_COLORS = {
  active: 'bg-nexo-info/10 text-nexo-info border-nexo-info/30',
  paused: 'bg-nexo-warning/10 text-nexo-warning border-nexo-warning/30',
  completed: 'bg-nexo-success/10 text-nexo-success border-nexo-success/30',
  cancelled: 'bg-nexo-danger/10 text-nexo-danger border-nexo-danger/30',
  at_risk: 'bg-orange-500/10 text-orange-400 border-orange-500/30'
}

const STATUS_LABELS = {
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  at_risk: 'Em Risco'
}

const TYPE_ICONS = {
  website: '🌐',
  app: '📱',
  ecommerce: '🛒',
  sistema: '⚙️',
  landing: '🎯',
  outro: '📦'
}

export default function RoadmapList({ roadmaps, loading, onSelect, activeId, onCreate, onDelete }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('updated_at')

  const filtered = roadmaps
    .filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        return (r.title || '').toLowerCase().includes(q) ||
               (r.project_type || '').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'updated_at') return new Date(b.updated_at) - new Date(a.updated_at)
      if (sortBy === 'total_value') return (b.total_value || 0) - (a.total_value || 0)
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '')
      return 0
    })

  const getProgress = (r) => {
    const phases = r.phases || []
    if (!phases.length) return 0
    const completed = phases.filter(p => p.status === 'completed').length
    return Math.round((completed / phases.length) * 100)
  }

  return (
    <div className="flex flex-col h-full border-r border-nexo-border bg-nexo-bg/50">
      {/* Header */}
      <div className="p-4 border-b border-nexo-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-nexo-info/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-nexo-info" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Projetos</h2>
            <p className="text-[10px] text-nexo-muted">{roadmaps.length} ativos</p>
          </div>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nexo-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar projeto..."
            className="w-full pl-8 pr-3 py-1.5 h-8 rounded-lg bg-nexo-card border border-nexo-border text-xs text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-info transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="flex-1 h-7 rounded-lg bg-nexo-card border border-nexo-border text-[10px] text-nexo-text focus:outline-none focus:border-nexo-info px-2"
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="paused">Pausados</option>
            <option value="completed">Concluídos</option>
          </select>
          <button
            onClick={() => setSortBy(prev => prev === 'updated_at' ? 'total_value' : 'updated_at')}
            className="h-7 px-2 rounded-lg bg-nexo-card border border-nexo-border text-nexo-muted hover:text-white transition-colors"
            title="Ordenar"
          >
            <ArrowUpDown className="w-3 h-3" />
          </button>
          {/* Botão Novo Projeto removido da lista — use o botão no header */}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && (
          <div className="text-center py-8 text-nexo-muted text-xs">
            <div className="w-5 h-5 border-2 border-nexo-info/30 border-t-nexo-info rounded-full animate-spin mx-auto mb-2" />
            Carregando...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-8 text-nexo-muted text-xs">
            Nenhum projeto encontrado
          </div>
        )}

        {filtered.map(roadmap => {
          const progress = getProgress(roadmap)
          const isActive = roadmap.id === activeId
          return (
            <button
              key={roadmap.id}
              onClick={() => onSelect(roadmap.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-200 group ${
                isActive
                  ? 'bg-nexo-info/5 border-nexo-info/40 shadow-[0_0_12px_rgba(108,92,231,0.15)]'
                  : 'bg-nexo-card/60 border-nexo-border hover:border-nexo-muted/30 hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{TYPE_ICONS[roadmap.project_type] || '📦'}</span>
                  <span className="text-xs font-medium text-nexo-text truncate max-w-[120px]">
                    {roadmap.title}
                  </span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[roadmap.status] || STATUS_COLORS.active}`}>
                  {STATUS_LABELS[roadmap.status] || roadmap.status}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 bg-nexo-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-nexo-info to-cyan-400 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[9px] text-nexo-muted tabular-nums">{progress}%</span>
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-nexo-muted">
                  {roadmap.total_value > 0
                    ? `€ ${parseFloat(roadmap.total_value).toLocaleString('pt-PT', { minimumFractionDigits: 0 })}`
                    : 'Sem valor'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-nexo-muted">
                    Fase {roadmap.current_phase_index + 1}/{(roadmap.phases || []).length}
                  </span>
                  {onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(roadmap.id) }}
                      className="p-1 text-nexo-muted hover:text-nexo-danger transition-colors shrink-0"
                      title="Apagar projeto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
