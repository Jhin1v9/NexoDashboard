import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Calendar, Building2, Square, CheckSquare, Trash2 } from 'lucide-react'
import axios from 'axios'
import { STATUS_CONFIG, PRIORITY_CONFIG } from './IdeaCard'

export default function IdeasList({ ideas, onRefresh }) {
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState(new Set())

  const toggleSelect = (e, id) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === ideas.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ideas.map(i => i.id)))
    }
  }

  const handleBulkArchive = async () => {
    if (!confirm(`Arquivar ${selectedIds.size} ideias selecionadas?`)) return
    try {
      for (const id of selectedIds) {
        await axios.put(`/api/ideas/${id}`, { status: 'arquivada' })
      }
      setSelectedIds(new Set())
      onRefresh()
    } catch (err) {
      console.error('[IdeasList] bulk archive error:', err)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const priorityColor = (priority) => {
    switch (priority) {
      case 'urgente': return 'bg-nexo-danger'
      case 'alta': return 'bg-nexo-warning'
      case 'media': return 'bg-nexo-info'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-2">
      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-2 glass-card border-nexo-primary/30"
        >
          <span className="text-xs text-nexo-primary font-medium">
            {selectedIds.size} selecionada(s)
          </span>
          <button
            onClick={handleBulkArchive}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-nexo-danger/20 text-nexo-danger hover:bg-nexo-danger/30 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Arquivar
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[10px] text-nexo-muted hover:text-nexo-text transition-colors ml-auto"
          >
            Cancelar
          </button>
        </motion.div>
      )}

      {/* Select all header */}
      <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] text-nexo-muted uppercase tracking-wide">
        <button onClick={selectAll} className="flex items-center gap-1 hover:text-nexo-text transition-colors">
          {selectedIds.size === ideas.length && ideas.length > 0 ? (
            <CheckSquare className="w-3.5 h-3.5 text-nexo-primary" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          <span>Todas</span>
        </button>
        <span className="ml-auto">{ideas.length} ideias</span>
      </div>

      {/* List items */}
      <AnimatePresence>
        {ideas.map((idea, i) => {
          const statusCfg = STATUS_CONFIG[idea.status] || STATUS_CONFIG.rascunho
          const isSelected = selectedIds.has(idea.id)

          return (
            <motion.div
              key={idea.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => navigate(`/ideias/${idea.id}`)}
              className={`flex items-center gap-3 p-3 glass-card cursor-pointer transition-all hover:border-nexo-primary/30 ${
                isSelected ? 'border-nexo-primary/50 bg-nexo-primary/5' : 'border-transparent'
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => toggleSelect(e, idea.id)}
                className="flex-shrink-0"
              >
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 text-nexo-primary" />
                ) : (
                  <Square className="w-4 h-4 text-nexo-muted hover:text-nexo-text transition-colors" />
                )}
              </button>

              {/* Priority indicator */}
              <div className={`w-1 h-10 rounded-full flex-shrink-0 ${priorityColor(idea.priority)}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-nexo-text truncate">{idea.title}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusCfg.className}`}>
                    {statusCfg.label}
                  </span>
                  <span className="text-[10px] text-nexo-muted">{idea.type?.replace(/-/g, ' ') || '-'}</span>
                  {idea.linkedTo?.clientName && (
                    <>
                      <span className="text-nexo-muted/40">|</span>
                      <span className="flex items-center gap-0.5 text-[10px] text-nexo-muted">
                        <Building2 className="w-2.5 h-2.5" />
                        {idea.linkedTo.clientName}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-4 text-[10px] text-nexo-muted flex-shrink-0">
                {idea.comments?.length > 0 && (
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="w-3 h-3" />
                    {idea.comments.length}
                  </span>
                )}
                <span>{idea.createdByName || '-'}</span>
                <span className="flex items-center gap-0.5">
                  <Calendar className="w-3 h-3" />
                  {formatDate(idea.updatedAt)}
                </span>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {ideas.length === 0 && (
        <div className="text-center py-12 text-nexo-muted text-sm">
          Nenhuma ideia encontrada
        </div>
      )}
    </div>
  )
}
