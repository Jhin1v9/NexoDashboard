import { useState, useEffect } from 'react'
import {
  DollarSign, Users, CreditCard, Calendar, Github, Globe,
  ArrowRight, Vote, UserPlus, UserMinus, CheckCircle
} from 'lucide-react'

function formatCurrency(value, currency = 'EUR') {
  const num = parseFloat(value) || 0
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: currency || 'EUR'
  }).format(num)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-PT')
}

export default function RoadmapDetailPanel({
  roadmap,
  timelines,
  onJoinTimeline,
  onLeaveTimeline,
  onCreateVote,
  onAdvanceStep
}) {
  const [client, setClient] = useState(null)
  const [lead, setLead] = useState(null)
  const currentUser = localStorage.getItem('nexo_user_name') || 'Você'

  useEffect(() => {
    if (roadmap?.client_id) {
      fetch(`/api/workspace/clients`)
        .then(r => r.json())
        .then(data => {
          const c = (data.clientes || []).find(c => c.id === roadmap.client_id)
          setClient(c)
        })
        .catch(() => setClient(null))
    }
    if (roadmap?.lead_id) {
      fetch(`/api/leads/${roadmap.lead_id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexo_token') || ''}` }
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => setLead(data))
        .catch(() => setLead(null))
    }
  }, [roadmap])

  if (!roadmap) {
    return (
      <div className="flex items-center justify-center h-full text-nexo-muted text-xs">
        <p>Selecione um projeto</p>
      </div>
    )
  }

  const schedule = roadmap.payment_schedule || []
  const totalPaid = schedule.filter(s => s.paid).reduce((sum, s) => sum + (s.percent || 0), 0)
  const totalValue = parseFloat(roadmap.total_value) || 0
  const received = (totalValue * totalPaid) / 100
  const pending = totalValue - received

  const currentPhase = (roadmap.phases || [])[roadmap.current_phase_index || 0]
  const coderTimeline = timelines.find(t => t.role === 'coder')
  const isCollaborator = coderTimeline?.collaborators?.some(c => c.user_name === currentUser || c.user_id === (JSON.parse(localStorage.getItem('nexo_user') || '{}').id))

  return (
    <div className="flex flex-col h-full border-l border-nexo-border bg-nexo-bg/50 overflow-y-auto">
      {/* Cliente / Lead */}
      <div className="p-4 border-b border-nexo-border">
        <h3 className="text-[10px] font-semibold text-nexo-muted uppercase tracking-wider mb-2">Cliente</h3>
        {client ? (
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: client.cor || '#3b82f6', color: '#fff' }}
            >
              {(client.nome || 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-medium text-nexo-text">{client.nome}</p>
              <p className="text-[10px] text-nexo-muted">{client.responsavel}</p>
            </div>
          </div>
        ) : lead ? (
          <div>
            <p className="text-xs font-medium text-nexo-text">{lead.display_name || lead.name}</p>
            <p className="text-[10px] text-nexo-muted">{lead.email}</p>
          </div>
        ) : (
          <p className="text-[10px] text-nexo-muted">Sem cliente vinculado</p>
        )}
      </div>

      {/* Financeiro */}
      <div className="p-4 border-b border-nexo-border">
        <h3 className="text-[10px] font-semibold text-nexo-muted uppercase tracking-wider mb-2">Financeiro</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-nexo-card/60 border border-nexo-border">
            <p className="text-[9px] text-nexo-muted">Total</p>
            <p className="text-xs font-semibold text-nexo-text">{formatCurrency(totalValue, roadmap.currency)}</p>
          </div>
          <div className="p-2 rounded-lg bg-nexo-card/60 border border-nexo-border">
            <p className="text-[9px] text-nexo-muted">Recebido</p>
            <p className="text-xs font-semibold text-nexo-success">{formatCurrency(received, roadmap.currency)}</p>
          </div>
          <div className="p-2 rounded-lg bg-nexo-card/60 border border-nexo-border">
            <p className="text-[9px] text-nexo-muted">Pendente</p>
            <p className="text-xs font-semibold text-nexo-warning">{formatCurrency(pending, roadmap.currency)}</p>
          </div>
          <div className="p-2 rounded-lg bg-nexo-card/60 border border-nexo-border">
            <p className="text-[9px] text-nexo-muted">Progresso</p>
            <p className="text-xs font-semibold text-nexo-info">{totalPaid}%</p>
          </div>
        </div>

        {/* Payment schedule */}
        {schedule.length > 0 && (
          <div className="space-y-1.5">
            {schedule.map((s, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-1.5 rounded-lg text-[10px] border ${
                  s.paid
                    ? 'bg-nexo-success/5 border-nexo-success/20 text-nexo-success'
                    : 'bg-nexo-card/40 border-nexo-border text-nexo-muted'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {s.paid ? <CheckCircle className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                  <span>{s.label}</span>
                </div>
                <span>{s.percent}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coders Ativos */}
      <div className="p-4 border-b border-nexo-border">
        <h3 className="text-[10px] font-semibold text-nexo-muted uppercase tracking-wider mb-2">Coders Ativos</h3>
        {coderTimeline ? (
          <div>
            <div className="flex items-center gap-1 mb-2">
              {coderTimeline.collaborators?.length > 0 ? (
                <div className="flex -space-x-1.5">
                  {coderTimeline.collaborators.map((c, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border-2 border-nexo-bg flex items-center justify-center text-[9px] font-bold"
                      style={{ background: c.user_color || '#6c5ce7', color: '#fff', zIndex: 10 - i }}
                      title={c.user_name}
                    >
                      {(c.user_name || '?').charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-nexo-muted">Nenhum coder ativo</p>
              )}
            </div>
            <button
              onClick={() => isCollaborator ? onLeaveTimeline(coderTimeline.id) : onJoinTimeline(coderTimeline.id)}
              className={`w-full text-[10px] px-2 py-1.5 rounded-lg border transition-colors flex items-center justify-center gap-1 ${
                isCollaborator
                  ? 'bg-nexo-danger/10 text-nexo-danger border-nexo-danger/30 hover:bg-nexo-danger/20'
                  : 'bg-nexo-info/10 text-nexo-info border-nexo-info/30 hover:bg-nexo-info/20'
              }`}
            >
              {isCollaborator ? (
                <><UserMinus className="w-3 h-3" /> Sair</>
              ) : (
                <><UserPlus className="w-3 h-3" /> Entrar como Coder</>
              )}
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-nexo-muted">Sem timeline de coder</p>
        )}
      </div>

      {/* Timelines / Steps */}
      <div className="p-4 border-b border-nexo-border">
        <h3 className="text-[10px] font-semibold text-nexo-muted uppercase tracking-wider mb-2">Timelines</h3>
        <div className="space-y-2">
          {timelines.map(t => {
            const currentStep = t.steps?.[t.current_step_index]
            const canAdvance = currentStep && t.current_step_index < (t.steps?.length || 0) - 1
            return (
              <div key={t.id} className="p-2 rounded-lg bg-nexo-card/60 border border-nexo-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-nexo-text">{t.title}</span>
                  <span className="text-[9px] text-nexo-muted">{t.current_step_index + 1}/{t.steps?.length || 0}</span>
                </div>
                {currentStep && (
                  <div className="text-[10px] text-nexo-muted mb-1">{currentStep.title}</div>
                )}
                {canAdvance && onAdvanceStep && (
                  <button
                    onClick={() => onAdvanceStep(t.id)}
                    className="w-full text-[9px] px-2 py-1 rounded bg-nexo-info/10 text-nexo-info border border-nexo-info/20 hover:bg-nexo-info/20 transition-colors"
                  >
                    Avançar Step
                  </button>
                )}
              </div>
            )
          })}
          {timelines.length === 0 && <p className="text-[10px] text-nexo-muted">Sem timelines</p>}
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="p-4">
        <h3 className="text-[10px] font-semibold text-nexo-muted uppercase tracking-wider mb-2">Ações</h3>
        <div className="space-y-1.5">
          {(currentPhase?.review_required || timelines.some(t => t.steps?.[t.current_step_index]?.creates_vote)) && (
            <button
              onClick={() => onCreateVote && onCreateVote(currentPhase)}
              className="w-full text-[10px] px-2 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 transition-colors flex items-center justify-center gap-1"
            >
              <Vote className="w-3 h-3" />
              Criar Votação de Revisão
            </button>
          )}
          {roadmap.github_repo && (
            <a
              href={roadmap.github_repo}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-[10px] px-2 py-1.5 rounded-lg bg-nexo-card text-nexo-muted border border-nexo-border hover:text-white hover:border-nexo-muted/30 transition-colors flex items-center justify-center gap-1"
            >
              <Github className="w-3 h-3" />
              Abrir GitHub
            </a>
          )}
          {roadmap.subdomain && (
            <a
              href={`https://${roadmap.subdomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-[10px] px-2 py-1.5 rounded-lg bg-nexo-card text-nexo-muted border border-nexo-border hover:text-white hover:border-nexo-muted/30 transition-colors flex items-center justify-center gap-1"
            >
              <Globe className="w-3 h-3" />
              Abrir Staging
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
