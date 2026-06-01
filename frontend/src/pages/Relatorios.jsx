import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, Calendar, Eye, Download, RefreshCw, 
  ChevronDown, ChevronUp, MessageSquare, CheckSquare, 
  Lightbulb, Link2, TrendingUp, Clock, Send, AlertCircle
} from 'lucide-react'
import useRealtime from '../hooks/useRealtime'

const StatCard = ({ icon: Icon, label, value, color }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card p-4 flex items-center gap-4"
  >
    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div>
      <div className="text-xl font-bold font-heading">{value}</div>
      <div className="text-xs text-nexo-muted">{label}</div>
    </div>
  </motion.div>
)

const ReportCard = ({ report, index, onView, onDownload }) => {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${report.sent ? 'bg-nexo-success/20' : 'bg-nexo-warning/20'}`}>
          <FileText size={20} className={report.sent ? 'text-nexo-success' : 'text-nexo-warning'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">Relatório #{report.id?.slice(-6)}</span>
            {report.sent ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-nexo-success/20 text-nexo-success">Enviado</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-nexo-warning/20 text-nexo-warning">Pendente</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-nexo-muted">
            <span className="flex items-center gap-1"><Calendar size={10} /> {report.date}</span>
            <span className="flex items-center gap-1"><Clock size={10} /> {report.time}</span>
            <span className="flex items-center gap-1"><MessageSquare size={10} /> {report.stats?.totalMessages || 0} msgs</span>
            <span className="flex items-center gap-1"><CheckSquare size={10} /> {report.stats?.totalTasks || 0} tarefas</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onView(report)} className="p-2 hover:bg-nexo-card rounded-lg transition-colors" title="Ver relatório">
            <Eye size={16} className="text-nexo-info" />
          </button>
          <button onClick={() => onDownload(report)} className="p-2 hover:bg-nexo-card rounded-lg transition-colors" title="Baixar HTML">
            <Download size={16} className="text-nexo-success" />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-2 hover:bg-nexo-card rounded-lg transition-colors">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-nexo-border px-4 py-3"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div class="bg-nexo-card rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-nexo-primary">{report.stats?.totalMessages || 0}</div>
                <div className="text-[10px] text-nexo-muted">Mensagens</div>
              </div>
              <div class="bg-nexo-card rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-nexo-warning">{report.stats?.totalTasks || 0}</div>
                <div className="text-[10px] text-nexo-muted">Tarefas</div>
              </div>
              <div class="bg-nexo-card rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-nexo-info">{report.stats?.totalIdeas || 0}</div>
                <div className="text-[10px] text-nexo-muted">Ideias</div>
              </div>
              <div class="bg-nexo-card rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-nexo-success">{report.stats?.participants?.length || 0}</div>
                <div className="text-[10px] text-nexo-muted">Participantes</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-nexo-muted">
              <span>Grupos:</span>
              {report.groups?.map((g, i) => (
                <span key={i} className="px-2 py-0.5 bg-nexo-card rounded-full">{g}</span>
              ))}
            </div>
            {report.sentAt && (
              <div className="text-[11px] text-nexo-success mt-2 flex items-center gap-1">
                <Send size={10} /> Enviado em {new Date(report.sentAt).toLocaleString('pt-BR')}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Relatorios() {
  const { data: historyData, loading, error, refetch } = useRealtime('/api/reports/history', 60000)
  const [viewingReport, setViewingReport] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('all')

  const reports = historyData?.reports || []
  const latestReport = reports[reports.length - 1]
  
  const filteredReports = reports.filter(r => {
    if (filter === 'sent') return r.sent
    if (filter === 'pending') return !r.sent
    return true
  }).reverse()

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } catch (e) {
      console.error('Refresh failed:', e)
    } finally {
      setRefreshing(false)
    }
  }

  const handleViewReport = (report) => {
    if (report.htmlFile) {
      // Abre o HTML em uma nova aba
      const fileName = report.htmlFile.split('\\').pop()
      window.open(`/reports/${fileName}`, '_blank')
    }
  }

  const handleDownloadReport = (report) => {
    if (report.htmlFile) {
      const fileName = report.htmlFile.split('\\').pop()
      const link = document.createElement('a')
      link.href = `/reports/${fileName}`
      link.download = `NEXO-Report-${report.date}.html`
      link.click()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <FileText className="text-nexo-primary" />
            Relatórios
          </h1>
          <p className="text-xs text-nexo-muted mt-1">
            Histórico de relatórios gerados automaticamente
          </p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-nexo-info rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Atualizando...' : 'Atualizar Agora'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={CheckSquare} label="Tarefas" value={0} color="#f59e0b" />
        <StatCard icon={Lightbulb} label="Ideias" value={0} color="#3b82f6" />
        <StatCard icon={TrendingUp} label="Relatórios" value={reports.length} color="#22c55e" />
      </div>

      {/* Latest Report Preview */}
      {latestReport && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-nexo-primary" />
            Último Relatório
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Relatório #{latestReport.id?.slice(-6)}</div>
              <div className="text-xs text-nexo-muted mt-1">
                {latestReport.date} • {latestReport.time} • 
                {latestReport.sent ? ' ✅ Enviado' : ' ⏳ Pendente'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleViewReport(latestReport)}
                className="flex items-center gap-2 px-3 py-2 bg-nexo-info rounded-lg text-xs hover:opacity-90 transition-opacity"
              >
                <Eye size={14} /> Ver
              </button>
              <button 
                onClick={() => handleDownloadReport(latestReport)}
                className="flex items-center gap-2 px-3 py-2 bg-nexo-success rounded-lg text-xs hover:opacity-90 transition-opacity"
              >
                <Download size={14} /> Baixar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        {[
          { id: 'all', label: 'Todos', count: reports.length },
          { id: 'sent', label: 'Enviados', count: reports.filter(r => r.sent).length },
          { id: 'pending', label: 'Pendentes', count: reports.filter(r => !r.sent).length },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id ? 'bg-nexo-info text-white' : 'bg-nexo-card text-nexo-muted hover:text-white'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {filteredReports.map((report, i) => (
          <ReportCard 
            key={report.id} 
            report={report} 
            index={i}
            onView={handleViewReport}
            onDownload={handleDownloadReport}
          />
        ))}
        {filteredReports.length === 0 && (
          <div className="text-center text-nexo-muted py-12">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhum relatório encontrado</p>
            <p className="text-xs mt-1">O agente gera relatórios automaticamente a cada 30 minutos</p>
          </div>
        )}
      </div>
    </div>
  )
}

