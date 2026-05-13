/**
 * BugTrackerPanel
 * Painel lateral de listagem de reports
 */

import React, { useMemo, useState } from 'react';
import type { BugReport, BugStats } from '../types';
import { SessionReplayPlayer } from '../replay/SessionReplayPlayer';

interface BugTrackerPanelProps {
  isOpen: boolean;
  reports: BugReport[];
  stats: BugStats;
  onClose: () => void;
  onResolve: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  primaryColor?: string;
  onSyncGitHub?: (id: string) => Promise<void>;
}

type TabFilter = 'all' | 'pending' | 'resolved';

const severityBadge: Record<BugReport['severity'], string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const typeIcon: Record<BugReport['type'], string> = {
  bug: '🐛',
  improvement: '💡',
  question: '❓',
};

export const BugTrackerPanel: React.FC<BugTrackerPanelProps> = ({
  isOpen,
  reports,
  stats,
  onClose,
  onResolve,
  onDelete,
  onSyncGitHub,
  primaryColor = '#06b6d4',
}) => {
  const [filter, setFilter] = useState<TabFilter>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    if (filter === 'all') return reports;
    if (filter === 'pending') return reports.filter((r) => r.status === 'pending' || r.status === 'analyzing');
    return reports.filter((r) => r.status === 'resolved' || r.status === 'rejected');
  }, [reports, filter]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    await onResolve(id);
    setResolvingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este report?')) return;
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 z-[10002] w-full max-w-md bg-slate-900/95 border-l border-slate-700 shadow-2xl flex flex-col"
      data-bug-detector-ui
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📋</span> Bug Tracker
          </h2>
          <p className="text-xs text-slate-400">
            {stats.total} total • {stats.pending} pendentes • {stats.resolved} resolvidos
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Fechar painel"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-6 py-3 border-b border-slate-800 bg-slate-900/30">
        {(['all', 'pending', 'resolved'] as TabFilter[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
              filter === tab
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {tab === 'all' && `Todos (${stats.total})`}
            {tab === 'pending' && `Pendentes (${stats.pending})`}
            {tab === 'resolved' && `Resolvidos (${stats.resolved})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredReports.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm">Nenhum report encontrado</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{typeIcon[report.type]}</span>
                    <span className="text-sm font-medium text-white truncate">
                      {report.description.slice(0, 60)}
                      {report.description.length > 60 ? '...' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                    <code className="text-cyan-400">{report.element.tag}</code>
                    <span>•</span>
                    <span>{new Date(report.timestamp).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${
                        severityBadge[report.severity]
                      }`}
                    >
                      {report.severity}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${
                        report.status === 'resolved' || report.status === 'rejected'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {report.githubIssueNumber && onSyncGitHub && (
                    <button
                      onClick={() => { void onSyncGitHub(report.id); }}
                      title="Sincronizar GitHub"
                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                    >
                      🔄
                    </button>
                  )}
                  {(report.status === 'pending' || report.status === 'analyzing') && (
                    <button
                      onClick={() => handleResolve(report.id)}
                      disabled={resolvingId === report.id}
                      className="px-2 py-1 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors disabled:opacity-50"
                    >
                      {resolvingId === report.id ? '...' : '✓'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(report.id)}
                    disabled={deletingId === report.id}
                    className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors disabled:opacity-50"
                  >
                    {deletingId === report.id ? '...' : '🗑'}
                  </button>
                </div>
              </div>

              {/* Expand/collapse details */}
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <button
                  onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  className="text-xs hover:opacity-80"
                  style={{ color: primaryColor }}
                >
                  {expandedId === report.id ? '▲ Ocultar detalhes' : '▼ Ver detalhes'}
                </button>

                {expandedId === report.id && (
                  <div className="mt-3 space-y-3">
                    {report.screenshot && (
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 mb-1">Screenshot</p>
                        <img
                          src={report.screenshot}
                          alt="Screenshot"
                          className="w-full h-32 object-cover rounded-lg border border-slate-700"
                        />
                      </div>
                    )}
                    {report.video && (
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 mb-1">Vídeo</p>
                        <video
                          src={report.video}
                          controls
                          className="w-full h-32 rounded-lg bg-black border border-slate-700"
                        />
                      </div>
                    )}
                    {report.sessionReplay && report.sessionReplay.events.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 mb-1">Session Replay</p>
                        <SessionReplayPlayer data={report.sessionReplay} width={280} height={160} />
                      </div>
                    )}
                    {report.aiAnalysis && (
                      <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/50">
                        <p className="text-[10px] uppercase text-slate-500 mb-1">Análise IA</p>
                        <p className="text-xs text-slate-300">{report.aiAnalysis.rootCause}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
