import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, Rocket, Bug, Shield, Zap, DollarSign, FileText, Brain,
  Filter, CheckCheck, Clock, Tag, ArrowLeft, Bell, Download
} from 'lucide-react';
import useChangelog from '../hooks/useChangelog';

const CATEGORY_CONFIG = {
  feature: { icon: Sparkles, label: 'Nova Feature', color: 'bg-green-500', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  improvement: { icon: Rocket, label: 'Melhoria', color: 'bg-blue-500', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
  bugfix: { icon: Bug, label: 'Correcao', color: 'bg-red-500', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
  security: { icon: Shield, label: 'Seguranca', color: 'bg-purple-500', textColor: 'text-purple-400', borderColor: 'border-purple-500/30' },
  performance: { icon: Zap, label: 'Performance', color: 'bg-yellow-500', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
  finance: { icon: DollarSign, label: 'Financeiro', color: 'bg-amber-500', textColor: 'text-amber-400', borderColor: 'border-amber-500/30' },
  ai: { icon: Brain, label: 'Inteligência Artificial', color: 'bg-pink-500', textColor: 'text-pink-400', borderColor: 'border-pink-500/30' },
};

const TIER_CONFIG = {
  1: { label: 'Critico', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  2: { label: 'Importante', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  3: { label: 'Informativo', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

const STATUS_CONFIG = {
  '✅ 100% PRONTO': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: '✅ 100% Pronto' },
  '🚧 FALTA INCREMENTAR': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: '🚧 Em Progresso' },
  '❓ STATUS NÃO AVALIADO': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: '❓ Não Avaliado' },
};

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  if (diffDays === 0) return `Hoje, ${timeStr}`;
  if (diffDays === 1) return `Ontem, ${timeStr}`;
  if (diffDays < 7) return `Ha ${diffDays} dias, ${timeStr}`;
  
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ChangelogCard({ entry, isUnread, onMarkAsRead }) {
  const config = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.feature;
  const Icon = config.icon;
  const tierConfig = TIER_CONFIG[entry.tier] || TIER_CONFIG[3];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-nexo-card border rounded-xl p-5 hover:border-nexo-accent/50 transition-all group ${
        isUnread ? `${config.borderColor} border-2` : 'border-nexo-border'
      }`}
    >
      {/* Indicador de não lido */}
      {isUnread && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-nexo-accent rounded-full shadow-lg shadow-nexo-accent/50" />
      )}

      <div className="flex items-start gap-4">
        {/* Ícone da categoria */}
        <div className={`flex-shrink-0 w-10 h-10 ${config.color} rounded-xl flex items-center justify-center shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${tierConfig.color}`}>
              {tierConfig.label}
            </span>
            <span className={`text-xs font-medium ${config.textColor}`}>
              {config.label}
            </span>
            {entry.status && (
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${STATUS_CONFIG[entry.status]?.bg || 'bg-gray-500/20'} ${STATUS_CONFIG[entry.status]?.text || 'text-gray-400'} ${STATUS_CONFIG[entry.status]?.border || 'border-gray-500/30'}`}>
                {STATUS_CONFIG[entry.status]?.label || entry.status}
              </span>
            )}
            <span className="text-xs text-nexo-text-secondary/50">
              v{entry.version}
            </span>
          </div>

          {/* Título */}
          <h3 className={`text-lg font-semibold mb-2 ${isUnread ? 'text-nexo-text' : 'text-nexo-text-secondary'}`}>
            {entry.title}
          </h3>

          {/* Descrição */}
          <p className="text-sm text-nexo-text-secondary/80 leading-relaxed mb-2">
            {entry.description}
          </p>

          {/* Status Detail */}
          {entry.statusDetail && (
            <div className={`mb-3 p-3 rounded-lg border ${STATUS_CONFIG[entry.status]?.border || 'border-gray-500/30'} ${STATUS_CONFIG[entry.status]?.bg || 'bg-gray-500/10'}`}>
              <p className={`text-xs leading-relaxed ${STATUS_CONFIG[entry.status]?.text || 'text-gray-400'}`}>
                <span className="font-semibold">Status:</span> {entry.statusDetail}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-nexo-text-secondary/50">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(entry.date)}
              </span>
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {entry.author}
              </span>
            </div>

            {isUnread && (
              <button
                onClick={() => onMarkAsRead(entry.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-nexo-accent bg-nexo-accent/10 hover:bg-nexo-accent/20 rounded-lg transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar como lida
              </button>
            )}
          </div>

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[10px] bg-white/5 text-nexo-text-secondary/60 rounded-md"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Changelog() {
  const {
    entries,
    unreadCount,
    loading,
    error,
    isUnread,
    markAsRead,
    markAllAsRead,
    fetchEntries,
  } = useChangelog();

  const [activeFilter, setActiveFilter] = useState('all');

  const filteredEntries = activeFilter === 'all' 
    ? entries 
    : entries.filter(e => e.category === activeFilter);

  const categories = ['all', ...new Set(entries.map(e => e.category))];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Bell className="w-7 h-7 text-nexo-accent" />
            Changelog
          </h1>
          <p className="text-sm text-nexo-text-secondary mt-1">
            Historico de atualizacoes e novidades do NEXO Dashboard PRO
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-nexo-text-secondary bg-nexo-card border border-nexo-border hover:text-nexo-text hover:border-nexo-accent/50 rounded-lg transition-colors print:hidden"
          >
            <Download className="w-4 h-4" />
            Baixar PDF
          </button>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-nexo-accent bg-nexo-accent/10 hover:bg-nexo-accent/20 rounded-lg transition-colors print:hidden"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-nexo-card border border-nexo-border rounded-xl p-4">
          <div className="text-2xl font-bold text-nexo-text">{entries.length}</div>
          <div className="text-xs text-nexo-text-secondary">Total de updates</div>
        </div>
        <div className="bg-nexo-card border border-nexo-border rounded-xl p-4">
          <div className="text-2xl font-bold text-nexo-accent">{unreadCount}</div>
          <div className="text-xs text-nexo-text-secondary">Nao lidos</div>
        </div>
        <div className="bg-nexo-card border border-nexo-border rounded-xl p-4">
          <div className="text-2xl font-bold text-green-400">
            {entries.filter(e => e.category === 'feature').length}
          </div>
          <div className="text-xs text-nexo-text-secondary">Novas features</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-nexo-text-secondary flex-shrink-0" />
        {categories.map((cat) => {
          const config = cat === 'all' 
            ? { label: 'Todas', color: 'bg-nexo-accent' }
            : CATEGORY_CONFIG[cat] || { label: cat, color: 'bg-gray-500' };
          
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeFilter === cat
                  ? 'bg-nexo-accent text-white'
                  : 'bg-nexo-card border border-nexo-border text-nexo-text-secondary hover:text-nexo-text'
              }`}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-nexo-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">
          <Bug className="w-8 h-8 mx-auto mb-2" />
          <p>Erro ao carregar changelog: {error}</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 text-nexo-text-secondary">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma atualizacao encontrada</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry, index) => (
            <ChangelogCard
              key={entry.id}
              entry={entry}
              isUnread={isUnread(entry)}
              onMarkAsRead={markAsRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}

