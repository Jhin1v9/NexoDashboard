import { useState } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'

const VALID_STATUSES = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'em-discussao', label: 'Em Discuss\u00e3o' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'em-andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Conclu\u00edda' },
  { value: 'rejeitada', label: 'Rejeitada' },
  { value: 'arquivada', label: 'Arquivada' }
]

const VALID_TYPES = [
  { value: 'proposta-comercial', label: 'Proposta Comercial' },
  { value: 'brainstorm', label: 'Brainstorm' },
  { value: 'prd', label: 'PRD' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'outro', label: 'Outro' }
]

const VALID_PRIORITIES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'M\u00e9dia' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' }
]

export default function IdeaFilters({ filters, onChange }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasActiveFilters = filters.status || filters.type || filters.priority || filters.search

  const updateFilter = (key, value) => {
    onChange({ ...filters, [key]: value || undefined })
  }

  const clearFilters = () => {
    onChange({})
  }

  const removeFilter = (key) => {
    const next = { ...filters }
    delete next[key]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-nexo-muted pointer-events-none" />
          <input
            value={filters.search || ''}
            onChange={e => updateFilter('search', e.target.value)}
            placeholder="Buscar ideias..."
            className="w-full pl-9 pr-8 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm text-nexo-text placeholder:text-nexo-muted transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => removeFilter('search')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-nexo-card rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-nexo-muted" />
            </button>
          )}
        </div>

        {/* Toggle advanced filters */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
            isExpanded || hasActiveFilters
              ? 'bg-nexo-primary/20 text-nexo-primary border-nexo-primary/30'
              : 'bg-nexo-card text-nexo-muted border-nexo-border hover:text-nexo-text'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
          {hasActiveFilters && (
            <span className="ml-0.5 w-4 h-4 rounded-full bg-nexo-primary text-white text-[10px] flex items-center justify-center">
              {Object.keys(filters).filter(k => filters[k]).length}
            </span>
          )}
        </button>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-2 text-xs text-nexo-muted hover:text-nexo-danger transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
          <select
            value={filters.status || ''}
            onChange={e => updateFilter('status', e.target.value)}
            className="px-3 py-1.5 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-xs text-nexo-text"
          >
            <option value="">Todos os status</option>
            {VALID_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={filters.type || ''}
            onChange={e => updateFilter('type', e.target.value)}
            className="px-3 py-1.5 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-xs text-nexo-text"
          >
            <option value="">Todos os tipos</option>
            {VALID_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <select
            value={filters.priority || ''}
            onChange={e => updateFilter('priority', e.target.value)}
            className="px-3 py-1.5 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-xs text-nexo-text"
          >
            <option value="">Todas as prioridades</option>
            {VALID_PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.status && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nexo-primary/20 text-nexo-primary border border-nexo-primary/20">
              {VALID_STATUSES.find(s => s.value === filters.status)?.label || filters.status}
              <button onClick={() => removeFilter('status')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.type && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nexo-info/20 text-nexo-info border border-nexo-info/20">
              {VALID_TYPES.find(t => t.value === filters.type)?.label || filters.type}
              <button onClick={() => removeFilter('type')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.priority && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nexo-warning/20 text-nexo-warning border border-nexo-warning/20">
              {VALID_PRIORITIES.find(p => p.value === filters.priority)?.label || filters.priority}
              <button onClick={() => removeFilter('priority')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-nexo-success/20 text-nexo-success border border-nexo-success/20">
              "{filters.search}"
              <button onClick={() => removeFilter('search')}>
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
