import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing, X, CheckCheck, Sparkles, Rocket, Bug, Shield, Zap, Smartphone, DollarSign, FileText, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_ICONS = {
  feature: Sparkles,
  improvement: Rocket,
  bugfix: Bug,
  security: Shield,
  performance: Zap,
  finance: DollarSign,
  ai: Brain,
};

const CATEGORY_COLORS = {
  feature: 'bg-green-500',
  improvement: 'bg-blue-500',
  bugfix: 'bg-red-500',
  security: 'bg-purple-500',
  performance: 'bg-yellow-500',
  finance: 'bg-amber-500',
  ai: 'bg-pink-500',
};

const CATEGORY_LABELS = {
  feature: 'Nova Feature',
  improvement: 'Melhoria',
  bugfix: 'Correcao',
  security: 'Seguranca',
  performance: 'Performance',
  finance: 'Financeiro',
  ai: 'Inteligência Artificial',
};

const STATUS_CONFIG = {
  '✅ 100% PRONTO': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: '100% Pronto' },
  '🚧 FALTA INCREMENTAR': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Em Progresso' },
  '❓ STATUS NÃO AVALIADO': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Não Avaliado' },
};

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `Ha ${diffMins}min`;
  if (diffHours < 24) return `Ha ${diffHours}h`;
  if (diffDays === 1) return 'Ontem';
  return `Ha ${diffDays}d`;
}

export default function ChangelogBadge({ 
  entries, 
  unreadCount, 
  onMarkAsRead, 
  onMarkAllAsRead,
  onUpdateLastVisit,
  isUnread,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 56, right: 16 });
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target) && 
          buttonRef.current && !buttonRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
  }, [open]);

  const handleOpen = () => {
    setOpen(!open);
    if (!open) {
      onUpdateLastVisit();
    }
  };

  const systemVersion = entries?.[0]?.version || '';

  const handleMarkAsRead = (e, id) => {
    e.stopPropagation();
    onMarkAsRead(id);
  };

  const handleMarkAll = (e) => {
    e.stopPropagation();
    onMarkAllAsRead();
  };

  const handleViewAll = () => {
    setOpen(false);
    window.location.href = '/changelog';
  };

  return (
    <div className="relative">
      {/* Botão do sino */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
        title="Notificacoes"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-nexo-accent animate-pulse" />
        ) : (
          <Bell className="w-5 h-5 text-nexo-text-secondary" />
        )}
        
        {/* Badge de não lidos */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Panel slide-out */}
      <AnimatePresence>
        {open && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed w-[380px] max-h-[500px] bg-nexo-card border border-nexo-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[9999]"
              style={{ top: pos.top, right: pos.right }}
            >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-nexo-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-nexo-accent" />
                <span className="font-semibold text-sm">Atualizacoes</span>
                {systemVersion && (
                  <span className="px-1.5 py-0.5 bg-nexo-accent/20 text-nexo-accent text-[10px] font-bold rounded">
                    v{systemVersion}
                  </span>
                )}
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full">
                    {unreadCount} novo{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="p-1.5 rounded hover:bg-white/5 text-nexo-text-secondary hover:text-nexo-text transition-colors"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded hover:bg-white/5 text-nexo-text-secondary hover:text-nexo-text transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lista de entries */}
            <div className="overflow-y-auto max-h-[380px]">
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-nexo-text-secondary">
                  <FileText className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma atualizacao ainda</p>
                </div>
              ) : (
                entries.slice(0, 10).map((entry) => {
                  const unread = isUnread(entry);
                  const Icon = CATEGORY_ICONS[entry.category] || FileText;
                  const colorClass = CATEGORY_COLORS[entry.category] || 'bg-gray-500';
                  
                  return (
                    <div
                      key={entry.id}
                      className={`relative px-4 py-3 border-b border-nexo-border/50 hover:bg-white/5 transition-colors cursor-pointer group ${
                        unread ? 'bg-nexo-accent/5' : ''
                      }`}
                      onClick={() => handleMarkAsRead({ stopPropagation: () => {} }, entry.id)}
                    >
                      {/* Indicador de não lido */}
                      {unread && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-nexo-accent rounded-r-full" />
                      )}
                      
                      <div className="flex items-start gap-3">
                        {/* Ícone da categoria */}
                        <div className={`flex-shrink-0 w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-xs font-medium text-nexo-text-secondary">
                              {CATEGORY_LABELS[entry.category] || entry.category}
                            </span>
                            {entry.status && (
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CONFIG[entry.status]?.bg || 'bg-gray-500/20'} ${STATUS_CONFIG[entry.status]?.text || 'text-gray-400'} ${STATUS_CONFIG[entry.status]?.border || 'border-gray-500/30'}`}>
                                {STATUS_CONFIG[entry.status]?.label || entry.status}
                              </span>
                            )}
                            <span className="text-[10px] text-nexo-text-secondary/60">
                              {formatTimeAgo(entry.date)}
                            </span>
                          </div>
                          <h4 className={`text-sm font-medium truncate ${unread ? 'text-nexo-text' : 'text-nexo-text-secondary'}`}>
                            {entry.title}
                          </h4>
                          <p className="text-xs text-nexo-text-secondary/70 line-clamp-2 mt-0.5">
                            {entry.description}
                          </p>
                          {entry.statusDetail && (
                            <p className="text-[10px] text-nexo-text-secondary/50 line-clamp-1 mt-1 italic">
                              {entry.statusDetail}
                            </p>
                          )}
                        </div>
                        
                        {/* Botão marcar como lido */}
                        {unread && (
                          <button
                            onClick={(e) => handleMarkAsRead(e, entry.id)}
                            className="flex-shrink-0 p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Marcar como lida"
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-nexo-accent" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-nexo-border bg-nexo-dark/50">
              <button
                onClick={handleViewAll}
                className="w-full text-center text-xs text-nexo-accent hover:text-nexo-accent-hover transition-colors"
              >
                Ver historico completo →
              </button>
            </div>
          </motion.div>
        </>,
        document.body
      )}
      </AnimatePresence>
    </div>
  );
}

