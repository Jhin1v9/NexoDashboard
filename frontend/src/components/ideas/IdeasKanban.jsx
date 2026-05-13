import { useState } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import IdeaCard from './IdeaCard'

const COLUMNS = [
  { id: 'rascunho', name: 'Rascunho', color: 'border-t-2 border-t-gray-500' },
  { id: 'em-discussao', name: 'Em Discuss\u00e3o', color: 'border-t-2 border-t-nexo-warning' },
  { id: 'aprovada', name: 'Aprovada', color: 'border-t-2 border-t-nexo-success' },
  { id: 'em-andamento', name: 'Em Andamento', color: 'border-t-2 border-t-nexo-info' },
  { id: 'concluida', name: 'Conclu\u00edda', color: 'border-t-2 border-t-purple-500' }
]

const COLUMN_BG = {
  rascunho: 'bg-gray-500/5',
  'em-discussao': 'bg-nexo-warning/5',
  aprovada: 'bg-nexo-success/5',
  'em-andamento': 'bg-nexo-info/5',
  concluida: 'bg-purple-500/5'
}

export default function IdeasKanban({ ideas, onRefresh }) {
  const [draggingId, setDraggingId] = useState(null)

  const handleStatusChange = async (ideaId, newStatus) => {
    try {
      await axios.put(`/api/ideas/${ideaId}`, { status: newStatus })
      onRefresh()
    } catch (err) {
      console.error('[IdeasKanban] status change error:', err)
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
      {COLUMNS.map(col => {
        const colIdeas = ideas.filter(i => i.status === col.id)
        return (
          <div
            key={col.id}
            className={`flex-shrink-0 w-72 glass-card ${col.color} ${COLUMN_BG[col.id]} overflow-hidden`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between p-3 border-b border-nexo-border/50">
              <h3 className="font-semibold text-sm text-nexo-text">{col.name}</h3>
              <span className="bg-nexo-card px-2 py-0.5 rounded-full text-[11px] font-medium text-nexo-muted min-w-[20px] text-center">
                {colIdeas.length}
              </span>
            </div>

            {/* Column Body */}
            <div className="p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-20rem)] overflow-y-auto">
              {colIdeas.map((idea, i) => (
                <div key={idea.id} className="group relative">
                  {/* Status mover buttons ( aparecem no hover ) */}
                  <div className="absolute -top-1.5 -right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                    {COLUMNS.map(c => {
                      if (c.id === idea.status) return null
                      return (
                        <button
                          key={c.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusChange(idea.id, c.id)
                          }}
                          className="w-5 h-5 rounded bg-nexo-card border border-nexo-border hover:border-nexo-primary hover:bg-nexo-primary/20 flex items-center justify-center transition-colors"
                          title={`Mover para ${c.name}`}
                        >
                          <span className="text-[8px] font-bold text-nexo-muted">{c.name.charAt(0)}</span>
                        </button>
                      )
                    })}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <IdeaCard idea={idea} variant="compact" />
                  </motion.div>
                </div>
              ))}

              {colIdeas.length === 0 && (
                <div className="text-center py-6 text-nexo-muted/40 text-xs">
                  Nenhuma ideia
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
