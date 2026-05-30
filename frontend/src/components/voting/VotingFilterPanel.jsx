import { useState } from 'react'
import { Vote, Clock, CheckCircle2, XCircle, BarChart3, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

export default function VotingFilterPanel({ activeFilter = 'all', onFilterChange, onCreateVoting, stats, collapsed, onToggleCollapse }) {
  const menuItems = [
    { key: 'all', label: 'Todas as Votações', icon: Vote },
    { key: 'open', label: 'Em Aberto', icon: Clock, count: stats?.open },
    { key: 'approved', label: 'Aprovadas', icon: CheckCircle2, count: stats?.approved },
    { key: 'rejected', label: 'Rejeitadas', icon: XCircle, count: stats?.rejected },
  ]

  return (
    <div className={`flex flex-col h-full transition-all duration-300 ${collapsed ? 'w-14' : 'w-64'}`}>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          {!collapsed && (
            <div className="flex items-center gap-2 flex-1">
              <div className="w-8 h-8 rounded-lg bg-nexo-info/10 flex items-center justify-center">
                <Vote className="w-4 h-4 text-nexo-info" />
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-none">Votações</h2>
                <p className="text-[10px] text-nexo-muted">Governança NEXO</p>
              </div>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg hover:bg-nexo-card text-nexo-muted transition-colors"
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {!collapsed && (
          <button
            onClick={onCreateVoting}
            className="btn-primary w-full flex items-center justify-center gap-1.5 text-sm py-2"
          >
            <Plus className="w-4 h-4" />
            Nova Votação
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {menuItems.map(item => (
          <button
            key={item.key}
            onClick={() => onFilterChange(item.key)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
              activeFilter === item.key
                ? 'bg-nexo-info/10 text-nexo-info border border-nexo-info/20'
                : 'text-nexo-muted hover:text-white hover:bg-nexo-card'
            } ${collapsed ? 'justify-center' : 'justify-start'}`}
            title={collapsed ? item.label : ''}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="text-xs bg-nexo-card px-1.5 py-0.5 rounded text-nexo-muted min-w-[20px]">
                    {item.count}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {!collapsed && stats && (
        <div className="p-3 border-t border-nexo-border">
          <div className="glass-card p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-nexo-muted">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Estatísticas</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-center p-2 rounded bg-nexo-card">
                <div className="font-bold text-nexo-text">{stats.total}</div>
                <div className="text-nexo-muted">Total</div>
              </div>
              <div className="text-center p-2 rounded bg-nexo-card">
                <div className="font-bold text-nexo-warning">{stats.open}</div>
                <div className="text-nexo-muted">Abertas</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
