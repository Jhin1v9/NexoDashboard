import VotingQuorumBar from './VotingQuorumBar'
import { ThumbsUp, ThumbsDown, Trash2, Clock, CheckCircle2, XCircle, Zap, MessageSquare } from 'lucide-react'

const CEOs = ['abner', 'nonoke', 'elias']

const statusConfig = {
  open: { label: 'Aberta', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Clock },
  voting: { label: 'Em Votação', color: 'bg-nexo-warning/10 text-nexo-warning border-nexo-warning/20', icon: MessageSquare },
  approved: { label: 'Aprovada', color: 'bg-nexo-success/10 text-nexo-success border-nexo-success/20', icon: CheckCircle2 },
  rejected: { label: 'Rejeitada', color: 'bg-nexo-danger/10 text-nexo-danger border-nexo-danger/20', icon: XCircle },
  closed: { label: 'Fechada', color: 'bg-nexo-muted/10 text-nexo-muted border-nexo-muted/20', icon: Clock },
}

export default function VotingSessionCard({ session, currentUser, onVote, onDelete }) {
  const status = statusConfig[session.status]
  const StatusIcon = status.icon

  const yesVotes = Object.values(session.votes).filter(v => v?.vote === 'yes').length
  const noVotes = Object.values(session.votes).filter(v => v?.vote === 'no').length

  const userVote = session.votes[currentUser]
  const canVote = (session.status === 'open' || session.status === 'voting') && !userVote
  const canDelete = session.createdBy === currentUser && (session.status === 'open' || session.status === 'voting')
  const isCEO = CEOs.includes(currentUser)

  const getVoteBadge = (username) => {
    const v = session.votes[username]
    if (!v) return <span className="text-nexo-muted text-xs">—</span>
    if (v.vote === 'yes') return <span className="inline-flex items-center gap-1 text-xs text-nexo-success border border-nexo-success/30 px-1.5 py-0.5 rounded"><ThumbsUp className="w-3 h-3" />Sim</span>
    return <span className="inline-flex items-center gap-1 text-xs text-nexo-danger border border-nexo-danger/30 px-1.5 py-0.5 rounded"><ThumbsDown className="w-3 h-3" />Não</span>
  }

  return (
    <div className={`glass-card p-4 transition-all duration-200 hover:shadow-lg border ${
      session.status === 'approved' ? 'border-nexo-success/30' :
      session.status === 'rejected' ? 'border-nexo-danger/30' :
      session.status === 'voting' ? 'border-nexo-warning/30' :
      'border-nexo-border'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 text-xs border px-2 py-0.5 rounded ${status.color}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            {session.type === 'tool_action' && (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">
                <Zap className="w-3 h-3" />
                Auto
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold leading-tight">{session.title}</h3>
          {session.description && (
            <p className="text-xs text-nexo-muted mt-1 line-clamp-2">{session.description}</p>
          )}
        </div>
        {canDelete && (
          <button
            className="p-1.5 text-nexo-muted hover:text-nexo-danger transition-colors shrink-0"
            onClick={() => onDelete(session.id)}
            title="Cancelar votação"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <VotingQuorumBar yesVotes={yesVotes} noVotes={noVotes} quorumRequired={session.quorumRequired} totalCEOs={CEOs.length} />

        <div className="flex items-center gap-3 pt-1">
          {CEOs.map(ceo => (
            <div key={ceo} className="flex flex-col items-center gap-0.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold uppercase ${
                ceo === currentUser ? 'bg-nexo-info text-white' : 'bg-nexo-card text-nexo-muted'
              }`}>
                {ceo[0]}
              </div>
              {getVoteBadge(ceo)}
            </div>
          ))}
        </div>

        {session.executionResult && (
          <div className={`text-xs p-2 rounded-md ${
            session.executionResult.success ? 'bg-nexo-success/10 text-nexo-success' : 'bg-nexo-danger/10 text-nexo-danger'
          }`}>
            {session.executionResult.success
              ? `✓ Executado: ${session.executionResult.task?.title || 'Tarefa criada'}`
              : `✗ Falha: ${session.executionResult.error || 'Erro desconhecido'}`
            }
          </div>
        )}
      </div>

      {canVote && isCEO && (
        <div className="flex gap-2 mt-3">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-nexo-success/30 bg-nexo-success/5 text-nexo-success hover:bg-nexo-success/10 transition-colors"
            onClick={() => onVote(session.id, 'yes')}
          >
            <ThumbsUp className="w-4 h-4" />
            Aprovar
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-nexo-danger/30 bg-nexo-danger/5 text-nexo-danger hover:bg-nexo-danger/10 transition-colors"
            onClick={() => onVote(session.id, 'no')}
          >
            <ThumbsDown className="w-4 h-4" />
            Rejeitar
          </button>
        </div>
      )}

      {userVote && (
        <div className="mt-3">
          <p className="text-xs text-nexo-muted">
            Você votou <span className={userVote.vote === 'yes' ? 'text-nexo-success font-medium' : 'text-nexo-danger font-medium'}>{userVote.vote === 'yes' ? 'Sim' : 'Não'}</span>
            {userVote.comment && ` — "${userVote.comment}"`}
          </p>
        </div>
      )}
    </div>
  )
}
