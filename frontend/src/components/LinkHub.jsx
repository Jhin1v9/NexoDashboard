import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Grid, List, RefreshCw, Link2, ExternalLink, Trash2,
  Youtube, Github, Linkedin, Globe, Twitter,
  FileText, Figma, Triangle, Chrome, Music,
  BookOpen, MessageSquare, HelpCircle, ChevronDown, ChevronUp,
  AlertTriangle, X
} from 'lucide-react'
import { useLinks } from '../hooks/useLinks'

// Mapeamento de ícones por plataforma (lucide-react)
const PLATFORM_ICONS = {
  tiktok: Music,
  youtube: Youtube,
  github: Github,
  linkedin: Linkedin,
  twitter: Twitter,
  notion: FileText,
  figma: Figma,
  vercel: Triangle,
  google: Chrome,
  spotify: Music,
  medium: BookOpen,
  reddit: MessageSquare,
  site: Globe,
  unknown: HelpCircle
}

const PLATFORM_LABELS = {
  tiktok: '🎵 TikTok',
  youtube: '📺 YouTube',
  github: '🐙 GitHub',
  linkedin: '💼 LinkedIn',
  twitter: '🐦 Twitter/X',
  notion: '📝 Notion',
  figma: '🎨 Figma',
  vercel: '▲ Vercel',
  google: '🔍 Google',
  spotify: '🎧 Spotify',
  medium: '📖 Medium',
  reddit: '👽 Reddit',
  site: '🌐 Site',
  unknown: '❓ Desconhecido'
}

const PLATFORM_COLORS = {
  tiktok: '#000000',
  youtube: '#FF0000',
  github: '#181717',
  linkedin: '#0A66C2',
  twitter: '#000000',
  notion: '#000000',
  figma: '#F24E1E',
  vercel: '#000000',
  google: '#4285F4',
  spotify: '#1DB954',
  medium: '#000000',
  reddit: '#FF4500',
  site: '#6B7280',
  unknown: '#9CA3AF'
}

export default function LinkHub() {
  const { links, stats, loading, error, fetchLinks, syncLinks, enrichAll, setError } = useLinks()
  const [filters, setFilters] = useState({
    search: '',
    platform: 'all',
    category: 'all',
    status: 'all',
    sortBy: 'date',
    order: 'desc'
  })
  const [viewMode, setViewMode] = useState('grid')
  const [expandedGroups, setExpandedGroups] = useState({})
  const [enriching, setEnriching] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Debounce busca
  useEffect(() => {
    const timer = setTimeout(() => fetchLinks(filters, 0), 300)
    return () => clearTimeout(timer)
  }, [filters.search, filters.platform, filters.category, filters.status, filters.sortBy, filters.order])

  // Carregar inicial
  useEffect(() => {
    fetchLinks({}, 0)
  }, [])

  // Agrupar links por plataforma
  const groupedLinks = useMemo(() => {
    const groups = {}
    links.forEach(link => {
      const platform = link.platform || 'unknown'
      if (!groups[platform]) {
        groups[platform] = {
          platform,
          label: PLATFORM_LABELS[platform] || 'Desconhecido',
          color: PLATFORM_COLORS[platform] || '#9CA3AF',
          icon: PLATFORM_ICONS[platform] || HelpCircle,
          links: []
        }
      }
      groups[platform].links.push(link)
    })
    return Object.values(groups).sort((a, b) => b.links.length - a.links.length)
  }, [links])

  const toggleGroup = (platform) => {
    setExpandedGroups(prev => ({ ...prev, [platform]: !prev[platform] }))
  }

  const handleSync = async () => {
    setSyncing(true)
    await syncLinks()
    setSyncing(false)
  }

  const handleEnrich = async () => {
    setEnriching(true)
    await enrichAll()
    setEnriching(false)
  }

  const totalLinks = stats?.total || links.length
  const brokenLinks = stats?.broken || 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading flex items-center gap-2">
            <Link2 className="text-nexo-primary" size={22} />
            Link Hub
            <span className="text-xs font-normal text-nexo-muted bg-nexo-card px-2 py-0.5 rounded-full">
              {totalLinks} links
            </span>
            {brokenLinks > 0 && (
              <span className="text-xs font-normal text-nexo-danger bg-nexo-danger/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={12} />
                {brokenLinks} quebrados
              </span>
            )}
          </h2>
          <p className="text-xs text-nexo-muted mt-1">Links organizados por plataforma</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-2 bg-nexo-card hover:bg-nexo-border rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sync...' : 'Sync'}
          </button>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="px-3 py-2 bg-nexo-primary rounded-lg text-xs hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={14} className={enriching ? 'animate-spin' : ''} />
            {enriching ? 'Enriquecendo...' : 'Enriquecer'}
          </button>
          <div className="flex bg-nexo-card rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-nexo-border text-white' : 'text-nexo-muted hover:text-white'}`}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-nexo-border text-white' : 'text-nexo-muted hover:text-white'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-card p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-nexo-muted" size={16} />
          <input
            type="text"
            placeholder="Buscar por URL, título, descrição, plataforma..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full pl-9 pr-8 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-primary"
          />
          {filters.search && (
            <button onClick={() => setFilters(prev => ({ ...prev, search: '' }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-nexo-muted hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={filters.platform}
            onChange={(e) => setFilters(prev => ({ ...prev, platform: e.target.value }))}
            className="px-3 py-1.5 bg-nexo-bg border border-nexo-border rounded-lg text-xs text-nexo-text focus:outline-none focus:border-nexo-primary"
          >
            <option value="all">📁 Todas as Plataformas</option>
            <option value="tiktok">🎵 TikTok</option>
            <option value="youtube">📺 YouTube</option>
            <option value="github">🐙 GitHub</option>
            <option value="linkedin">💼 LinkedIn</option>
            <option value="twitter">🐦 Twitter/X</option>
            <option value="notion">📝 Notion</option>
            <option value="figma">🎨 Figma</option>
            <option value="vercel">▲ Vercel</option>
            <option value="google">🔍 Google</option>
            <option value="spotify">🎧 Spotify</option>
            <option value="site">🌐 Sites</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-1.5 bg-nexo-bg border border-nexo-border rounded-lg text-xs text-nexo-text focus:outline-none focus:border-nexo-primary"
          >
            <option value="all">✅ Todos Status</option>
            <option value="active">🟢 Ativos</option>
            <option value="broken">🔴 Quebrados</option>
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
            className="px-3 py-1.5 bg-nexo-bg border border-nexo-border rounded-lg text-xs text-nexo-text focus:outline-none focus:border-nexo-primary"
          >
            <option value="date">📅 Data</option>
            <option value="platform">📁 Plataforma</option>
            <option value="author">👤 Autor</option>
          </select>

          <button
            onClick={() => setFilters(prev => ({ ...prev, order: prev.order === 'desc' ? 'asc' : 'desc' }))}
            className="px-3 py-1.5 bg-nexo-bg border border-nexo-border rounded-lg text-xs text-nexo-text hover:bg-nexo-border"
          >
            {filters.order === 'desc' ? '↓ Desc' : '↑ Asc'}
          </button>

          <button
            onClick={() => setFilters({ search: '', platform: 'all', category: 'all', status: 'all', sortBy: 'date', order: 'desc' })}
            className="px-3 py-1.5 bg-nexo-danger/10 border border-nexo-danger/30 rounded-lg text-xs text-nexo-danger hover:bg-nexo-danger/20"
          >
            🗑️ Limpar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-3 text-nexo-danger flex items-center gap-2 text-sm">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Loading inicial */}
      {loading && links.length === 0 && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-nexo-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Lista agrupada */}
      <div className="space-y-3">
        <AnimatePresence>
          {groupedLinks.map((group) => {
            const Icon = group.icon
            const isExpanded = expandedGroups[group.platform] !== false // default expanded
            return (
              <motion.div
                key={group.platform}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-card overflow-hidden"
              >
                <button
                  onClick={() => toggleGroup(group.platform)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-nexo-border/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: group.color + '20' }}>
                      <Icon size={18} style={{ color: group.color }} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-medium text-sm">{group.label}</h3>
                      <p className="text-[10px] text-nexo-muted">{group.links.length} link{group.links.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.links.some(l => l.preview?.isBroken) && (
                      <span className="text-[10px] text-nexo-danger bg-nexo-danger/10 px-2 py-0.5 rounded-full">
                        {group.links.filter(l => l.preview?.isBroken).length} quebrado(s)
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-nexo-muted" /> : <ChevronDown size={16} className="text-nexo-muted" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className={`p-3 ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-2'}`}>
                        {group.links.map((link) => (
                          <LinkCard key={link.id} link={link} viewMode={viewMode} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {!loading && links.length === 0 && (
        <div className="text-center py-12 text-nexo-muted">
          <Link2 size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Nenhum link encontrado</p>
          <p className="text-xs mt-1">Tente ajustar os filtros ou sincronizar com o buffer</p>
        </div>
      )}
    </div>
  )
}

function LinkCard({ link, viewMode }) {
  const [imageError, setImageError] = useState(false)
  const preview = link.preview || {}
  const isBroken = link.preview?.isBroken || link.preview?.isError
  const PlatformIcon = PLATFORM_ICONS[link.platform] || Globe
  const platformColor = link.platformColor || PLATFORM_COLORS[link.platform] || '#6B7280'

  if (viewMode === 'list') {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isBroken ? 'bg-nexo-danger/5 border-nexo-danger/20' : 'bg-nexo-card/50 border-nexo-border hover:bg-nexo-border/30'
      }`}>
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-nexo-card flex items-center justify-center">
          {preview.image && !imageError ? (
            <img src={preview.image} alt="" className="w-full h-full object-cover" onError={() => setImageError(true)} />
          ) : (
            <PlatformIcon size={20} style={{ color: platformColor }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium truncate text-nexo-text">{preview.title || link.domain || link.url}</h4>
            {isBroken && <AlertTriangle size={14} className="text-nexo-danger flex-shrink-0" />}
          </div>
          <p className="text-xs text-nexo-muted truncate">{preview.description || link.url}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-nexo-muted">{link.author || 'Desconhecido'}</span>
            <span className="text-nexo-border">•</span>
            <span className="text-[10px] text-nexo-muted">
              {link.timestamp ? new Date(link.timestamp).toLocaleDateString('pt-BR') : ''}
            </span>
          </div>
        </div>
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-2 text-nexo-muted hover:text-nexo-primary hover:bg-nexo-border rounded-lg transition-colors flex-shrink-0">
          <ExternalLink size={14} />
        </a>
      </div>
    )
  }

  // Grid mode
  return (
    <div className={`group relative rounded-xl border overflow-hidden transition-all hover:scale-[1.02] ${
      isBroken ? 'bg-nexo-danger/5 border-nexo-danger/20' : 'bg-nexo-card border-nexo-border hover:border-nexo-primary/30'
    }`}>
      <div className="aspect-video bg-nexo-bg relative overflow-hidden">
        {preview.image && !imageError ? (
          <img src={preview.image} alt={preview.title || ''} className="w-full h-full object-cover" onError={() => setImageError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-nexo-card">
            <PlatformIcon size={32} className="opacity-30" style={{ color: platformColor }} />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white flex items-center gap-1" style={{ backgroundColor: platformColor + 'CC' }}>
            <PlatformIcon size={10} />
            {link.platformLabel || link.platform}
          </span>
        </div>
        {isBroken && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-nexo-danger bg-nexo-danger/80 flex items-center gap-1">
              <AlertTriangle size={10} />
              Quebrado
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors">
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
      <div className="p-3">
        <h4 className="text-sm font-medium text-nexo-text line-clamp-2 mb-1">{preview.title || link.domain || 'Sem título'}</h4>
        <p className="text-xs text-nexo-muted line-clamp-2 mb-2">{preview.description || 'Sem descrição'}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: platformColor }}>
              {(link.author || '?')[0].toUpperCase()}
            </div>
            <span className="text-[10px] text-nexo-muted">{link.author || 'Desconhecido'}</span>
          </div>
          <span className="text-[10px] text-nexo-muted">
            {link.timestamp ? new Date(link.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
