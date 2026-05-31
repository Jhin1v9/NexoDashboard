import React from 'react'
export default function VotingQuorumBar({ yesVotes, noVotes, quorumRequired, totalCEOs, compact = false }) {
  const yesPct = Math.min((yesVotes / quorumRequired) * 100, 100)
  const noPct = noVotes > 0 ? 100 : 0
  const pending = totalCEOs - yesVotes - noVotes

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className="flex-1 flex gap-0.5 h-2 rounded-full overflow-hidden bg-nexo-card">
          <div className="bg-nexo-success transition-all duration-500" style={{ width: `${(yesVotes / totalCEOs) * 100}%` }} />
          <div className="bg-nexo-danger transition-all duration-500" style={{ width: `${(noVotes / totalCEOs) * 100}%` }} />
          <div className="bg-nexo-muted/20 transition-all duration-500" style={{ width: `${(pending / totalCEOs) * 100}%` }} />
        </div>
        <span className="text-nexo-muted whitespace-nowrap">{yesVotes}/{quorumRequired}</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-nexo-success" />
            <span className="text-nexo-success font-medium">{yesVotes} Sim</span>
          </span>
          {noVotes > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-nexo-danger" />
              <span className="text-nexo-danger font-medium">{noVotes} Não</span>
            </span>
          )}
          {pending > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-nexo-muted/30" />
              <span className="text-nexo-muted">{pending} Pendente</span>
            </span>
          )}
        </div>
        <span className="text-nexo-muted text-xs">Quórum: {quorumRequired}</span>
      </div>

      <div className="relative h-3 bg-nexo-card rounded-full overflow-hidden">
        <div className="h-full bg-nexo-success rounded-full transition-all duration-500" style={{ width: `${yesPct}%` }} />
        {noPct > 0 && (
          <div className="absolute top-0 right-0 h-full bg-nexo-danger rounded-r-full transition-all duration-500" style={{ width: `${noPct}%` }} />
        )}
      </div>

      <div className="flex justify-between text-xs text-nexo-muted">
        <span>Votos: {yesVotes + noVotes}/{totalCEOs}</span>
        <span className={yesVotes >= quorumRequired ? 'text-nexo-success font-medium' : noVotes >= 1 ? 'text-nexo-danger font-medium' : ''}>
          {yesVotes >= quorumRequired ? '✓ Quórum atingido' : noVotes >= 1 ? '✗ Vetado' : `${quorumRequired - yesVotes} votos necessários`}
        </span>
      </div>
    </div>
  )
}
