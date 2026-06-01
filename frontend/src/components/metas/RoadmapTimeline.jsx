import { motion } from 'framer-motion'
import {
  FileSignature, Palette, Code, Vote, Rocket, CheckCircle,
  DollarSign, AlertCircle, Clock, ChevronRight
} from 'lucide-react'

const PHASE_ICONS = [
  FileSignature, Palette, Code, Vote, Rocket, CheckCircle,
  Code, Rocket, CheckCircle, Code, Vote, Rocket
]

const NODE_STYLES = {
  completed: {
    bg: 'rgba(46, 213, 115, 0.1)',
    border: 'rgba(46, 213, 115, 0.3)',
    shadow: '0 0 20px rgba(46, 213, 115, 0.2)',
    iconColor: '#2ed573'
  },
  active: {
    bg: 'rgba(108, 92, 231, 0.1)',
    border: 'rgba(108, 92, 231, 0.4)',
    shadow: '0 0 25px rgba(108, 92, 231, 0.3)',
    iconColor: '#6c5ce7'
  },
  payment: {
    bg: 'rgba(255, 215, 0, 0.08)',
    border: 'rgba(255, 215, 0, 0.4)',
    shadow: '0 0 20px rgba(255, 215, 0, 0.2)',
    iconColor: '#ffd700'
  },
  review: {
    bg: 'rgba(255, 165, 0, 0.08)',
    border: 'rgba(255, 165, 0, 0.4)',
    shadow: '0 0 20px rgba(255, 165, 0, 0.2)',
    iconColor: '#ffa502'
  },
  pending: {
    bg: 'rgba(15, 15, 22, 0.6)',
    border: 'rgba(255, 255, 255, 0.06)',
    shadow: 'none',
    iconColor: '#6c757d'
  }
}

export default function RoadmapTimeline({ roadmap, onAdvance }) {
  if (!roadmap) {
    return (
      <div className="flex items-center justify-center h-full text-nexo-muted text-sm">
        <div className="text-center">
          <Rocket className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>Selecione um projeto para ver a timeline</p>
        </div>
      </div>
    )
  }

  const phases = roadmap.phases || []
  const currentIdx = roadmap.current_phase_index || 0
  const progress = phases.length > 0 ? ((currentIdx) / (phases.length - 1)) * 100 : 0

  const getNodeStyle = (phase, idx) => {
    if (phase.status === 'completed') return NODE_STYLES.completed
    if (idx === currentIdx) {
      if (phase.payment_trigger) return NODE_STYLES.payment
      if (phase.review_required) return NODE_STYLES.review
      return NODE_STYLES.active
    }
    return NODE_STYLES.pending
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header do projeto */}
      <div className="shrink-0 p-4 border-b border-nexo-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-nexo-text">{roadmap.title}</h1>
            <p className="text-xs text-nexo-muted mt-0.5">
              {phases.length} fases · {phases.filter(p => p.status === 'completed').length} concluídas
            </p>
          </div>
          <div className="flex items-center gap-2">
            {roadmap.github_repo && (
              <a
                href={roadmap.github_repo}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 rounded-lg bg-nexo-card border border-nexo-border text-nexo-muted hover:text-white hover:border-nexo-muted/30 transition-colors"
              >
                GitHub
              </a>
            )}
            {roadmap.subdomain && (
              <a
                href={`https://${roadmap.subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-2 py-1 rounded-lg bg-nexo-card border border-nexo-border text-nexo-muted hover:text-white hover:border-nexo-muted/30 transition-colors"
              >
                Staging
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="relative max-w-xl mx-auto">
          {/* Linha conectora de fundo */}
          <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-nexo-border" />

          {/* Linha conectora preenchida */}
          <motion.div
            className="absolute left-6 top-4 w-0.5 bg-gradient-to-b from-nexo-info via-cyan-400 to-nexo-success"
            initial={{ height: 0 }}
            animate={{ height: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />

          <div className="space-y-6">
            {phases.map((phase, idx) => {
              const style = getNodeStyle(phase, idx)
              const Icon = PHASE_ICONS[idx] || Code
              const isLast = idx === phases.length - 1
              const isCurrent = idx === currentIdx

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                  className="relative flex items-start gap-4"
                >
                  {/* Nó */}
                  <div className="relative z-10 shrink-0">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                        isCurrent ? 'animate-pulse' : ''
                      }`}
                      style={{
                        background: style.bg,
                        borderColor: style.border,
                        boxShadow: style.shadow
                      }}
                    >
                      {phase.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5" style={{ color: style.iconColor }} />
                      ) : (
                        <Icon className="w-5 h-5" style={{ color: style.iconColor }} />
                      )}
                    </div>
                    {!isLast && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-12 w-0.5 h-6 bg-nexo-border" />
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-nexo-text">
                        {idx + 1}. {phase.title}
                      </span>
                      {phase.payment_trigger && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border bg-yellow-500/10 text-yellow-400 border-yellow-500/30 flex items-center gap-0.5">
                          <DollarSign className="w-2.5 h-2.5" />
                          Pagamento
                        </span>
                      )}
                      {phase.review_required && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/30 flex items-center gap-0.5">
                          <Vote className="w-2.5 h-2.5" />
                          Revisão
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-nexo-muted leading-relaxed mb-2">
                      {phase.description}
                    </p>

                    {/* Deliverables */}
                    {phase.deliverables && phase.deliverables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {phase.deliverables.map((d, i) => (
                          <span
                            key={i}
                            className={`text-[9px] px-1.5 py-0.5 rounded border ${
                              phase.status === 'completed'
                                ? 'bg-nexo-success/5 text-nexo-success border-nexo-success/20'
                                : 'bg-nexo-card text-nexo-muted border-nexo-border'
                            }`}
                          >
                            {phase.status === 'completed' ? '✓' : '○'} {d}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Meta */}
                    {phase.duration_days && (
                      <div className="flex items-center gap-3 text-[10px] text-nexo-muted">
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {phase.duration_days} dias
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Botão Próximo */}
          {currentIdx < phases.length - 1 && roadmap.status !== 'completed' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 flex justify-center"
            >
              <button
                onClick={onAdvance}
                className="group relative px-6 py-2.5 rounded-xl bg-gradient-to-r from-nexo-info to-purple-500 text-white text-sm font-medium border border-white/10 hover:shadow-[0_0_30px_rgba(108,92,231,0.4)] hover:scale-105 transition-all duration-200 flex items-center gap-2"
              >
                <span>Próximo</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
