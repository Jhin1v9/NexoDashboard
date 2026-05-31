import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Lightbulb, MessageSquare, Calendar, Building2 } from 'lucide-react'

const STATUS_CONFIG = {
  rascunho: { label: 'Rascunho', className: 'bg-gray-500/20 text-gray-400' },
  'em-discussao': { label: 'Em Discuss\u00e3o', className: 'bg-nexo-warning/20 text-nexo-warning' },
  aprovada: { label: 'Aprovada', className: 'bg-nexo-success/20 text-nexo-success' },
  'em-andamento': { label: 'Em Andamento', className: 'bg-nexo-info/20 text-nexo-info' },
  concluida: { label: 'Conclu\u00edda', className: 'bg-purple-500/20 text-purple-400' },
  rejeitada: { label: 'Rejeitada', className: 'bg-nexo-danger/20 text-nexo-danger' },
  arquivada: { label: 'Arquivada', className: 'bg-gray-500/20 text-gray-400' }
}

const PRIORITY_CONFIG = {
  baixa: { label: 'Baixa', className: 'bg-gray-500/20 text-gray-400' },
  media: { label: 'M\u00e9dia', className: 'bg-nexo-info/20 text-nexo-info' },
  alta: { label: 'Alta', className: 'bg-nexo-warning/20 text-nexo-warning' },
  urgente: { label: 'Urgente', className: 'bg-nexo-danger/20 text-nexo-danger' }
}

const TYPE_CONFIG = {
  'proposta-comercial': { label: 'Proposta', icon: Lightbulb },
  brainstorm: { label: 'Brainstorm', icon: Lightbulb },
  prd: { label: 'PRD', icon: Lightbulb },
  pipeline: { label: 'Pipeline', icon: Lightbulb },
  briefing: { label: 'Briefing', icon: Lightbulb },
  outro: { label: 'Outro', icon: Lightbulb }
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function IdeaCard({ idea, variant = 'full', onStatusChange }) {
  const navigate = useNavigate()
  const statusCfg = STATUS_CONFIG[idea.status] || STATUS_CONFIG.rascunho
  const priorityCfg = PRIORITY_CONFIG[idea.priority] || PRIORITY_CONFIG.media
  const typeCfg = TYPE_CONFIG[idea.type] || TYPE_CONFIG.outro

  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/ideias/${idea.id}`)}
        className="glass-card p-3 cursor-pointer hover:border-nexo-primary/30 transition-colors border border-transparent"
      >
        <div className="flex items-start gap-2">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
            idea.priority === 'urgente' ? 'bg-nexo-danger' :
            idea.priority === 'alta' ? 'bg-nexo-warning' :
            idea.priority === 'media' ? 'bg-nexo-info' : 'bg-gray-500'
          }`} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-nexo-text truncate leading-tight">{idea.title}</h4>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusCfg.className}`}>
                {statusCfg.label}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityCfg.className}`}>
                {priorityCfg.label}
              </span>
            </div>
            {idea.linkedTo?.clientName && (
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-nexo-muted">
                <Building2 className="w-3 h-3" />
                <span className="truncate">{idea.linkedTo.clientName}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // Full variant (gallery)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/ideias/${idea.id}`)}
      className="glass-card p-4 cursor-pointer hover:border-nexo-primary/30 transition-all border border-transparent group"
    >
      {/* Thumbnail area with gradient */}
      <div className="h-28 rounded-lg mb-3 flex items-center justify-center bg-gradient-to-br from-nexo-primary/10 to-nexo-info/10 group-hover:from-nexo-primary/20 group-hover:to-nexo-info/20 transition-colors relative overflow-hidden">
        <Lightbulb className="w-8 h-8 text-nexo-primary/40" />
        <div className="absolute top-2 right-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-medium text-sm text-nexo-text line-clamp-2 mb-2 leading-tight">{idea.title}</h3>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityCfg.className}`}>
          {priorityCfg.label}
        </span>
        <span className="text-[10px] text-nexo-muted bg-nexo-bg px-1.5 py-0.5 rounded">
          {typeCfg.label}
        </span>
      </div>

      {/* Client */}
      {idea.linkedTo?.clientName && (
        <div className="flex items-center gap-1 mb-2 text-[11px] text-nexo-muted">
          <Building2 className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{idea.linkedTo.clientName}</span>
        </div>
      )}

      {/* Tags */}
      {idea.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {idea.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-primary/10 text-nexo-primary border border-nexo-primary/20"
            >
              {tag}
            </span>
          ))}
          {idea.tags.length > 3 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-card text-nexo-muted">
              +{idea.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: author + date + comments */}
      <div className="flex items-center justify-between pt-2 border-t border-nexo-border/50">
        <div className="flex items-center gap-1.5 text-[10px] text-nexo-muted">
          <div className="w-4 h-4 rounded-full bg-nexo-primary/30 flex items-center justify-center text-[8px] text-nexo-primary font-bold">
            {(idea.createdByName || 'U').charAt(0)}
          </div>
          <span className="truncate max-w-[80px]">{idea.createdByName || 'Usuario'}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-nexo-muted">
          {idea.comments?.length > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="w-3 h-3" />
              {idea.comments.length}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Calendar className="w-3 h-3" />
            {formatDate(idea.updatedAt)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export { STATUS_CONFIG, PRIORITY_CONFIG }
