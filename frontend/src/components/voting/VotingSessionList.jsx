import React from 'react'
import VotingSessionCard from './VotingSessionCard'

export default function VotingSessionList({ sessions, currentUser, loading, onVote, onDelete, onUpdate }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 p-4 glass-card animate-pulse">
            <div className="h-4 w-20 bg-nexo-card rounded" />
            <div className="h-6 w-full bg-nexo-card rounded" />
            <div className="h-4 w-3/4 bg-nexo-card rounded" />
            <div className="h-8 w-full bg-nexo-card rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-nexo-card flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🗳️</span>
        </div>
        <h3 className="text-lg font-medium">Nenhuma votação encontrada</h3>
        <p className="text-sm text-nexo-muted mt-1">Crie uma nova sessão para começar.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sessions.map(session => (
        <VotingSessionCard
          key={session.id}
          session={session}
          currentUser={currentUser}
          onVote={onVote}
          onDelete={onDelete}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}
