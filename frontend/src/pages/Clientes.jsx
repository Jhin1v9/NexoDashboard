import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Folder, FolderOpen, FileText, Code, Image, MessageSquare, 
  BarChart3, ChevronRight, Plus, X, Upload, CheckCircle2, 
  Clock, AlertCircle, MoreHorizontal, Trash2, Edit3, Save,
  ExternalLink, Download, GripVertical
} from 'lucide-react'
import useRealtime from '../hooks/useRealtime'
import axios from 'axios'

const folderIcons = {
  CODIGO: Code,
  DEMOS: Image,
  ENTREGAS: FileText,
  PROMPTS: MessageSquare,
  RELATORIOS: BarChart3
}

const STATUS_CONFIG = {
  concluido: { label: 'Concluído', color: '#22c55e', bg: 'bg-nexo-success/10', text: 'text-nexo-success', icon: CheckCircle2 },
  andamento: { label: 'Em Andamento', color: '#3b82f6', bg: 'bg-nexo-info/10', text: 'text-nexo-info', icon: Clock },
  pendente: { label: 'Pendente', color: '#f59e0b', bg: 'bg-nexo-warning/10', text: 'text-nexo-warning', icon: AlertCircle },
  pausado: { label: 'Pausado', color: '#ef4444', bg: 'bg-nexo-danger/10', text: 'text-nexo-danger', icon: AlertCircle },
  planejamento: { label: 'Planejamento', color: '#a855f7', bg: 'bg-purple-500/10', text: 'text-purple-400', icon: Clock }
}

// Modal para gerenciar pasta de cliente
function FolderModal({ client, folderName, onClose }) {
  const [files, setFiles] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const [status, setStatus] = useState('andamento')
  const [notes, setNotes] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [mdContent, setMdContent] = useState('')
  const [mdFileName, setMdFileName] = useState('')

  const Icon = folderIcons[folderName] || Folder
  const folderPath = `${client.path}\\${folderName}`

  useEffect(() => {
    // Carrega status e notas do localStorage
    const saved = localStorage.getItem(`client-${client.id}-${folderName}`)
    if (saved) {
      const data = JSON.parse(saved)
      setStatus(data.status || 'andamento')
      setNotes(data.notes || '')
    }
  }, [client.id, folderName])

  const saveStatus = (newStatus, newNotes) => {
    localStorage.setItem(`client-${client.id}-${folderName}`, JSON.stringify({
      status: newStatus || status,
      notes: newNotes !== undefined ? newNotes : notes,
      updatedAt: new Date().toISOString()
    }))
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFiles(droppedFiles)
  }

  const handleFiles = (newFiles) => {
    const processed = newFiles.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type,
      lastModified: f.lastModified,
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    }))
    setFiles(prev => [...prev, ...processed])
  }

  const handleImportMD = () => {
    if (!mdContent || !mdFileName) return
    const file = {
      name: mdFileName.endsWith('.md') ? mdFileName : `${mdFileName}.md`,
      size: new Blob([mdContent]).size,
      type: 'text/markdown',
      content: mdContent,
      id: `md-${Date.now()}`,
      isImported: true
    }
    setFiles(prev => [...prev, file])
    setMdContent('')
    setMdFileName('')
    setShowImport(false)
  }

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id))

  const StatusIcon = STATUS_CONFIG[status]?.icon || Clock

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-nexo-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-nexo-info/20 flex items-center justify-center">
                <Icon size={20} className="text-nexo-info" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{folderName}</h2>
                <p className="text-xs text-nexo-muted">{client.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-nexo-card rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
          
          {/* Status Selector */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs text-nexo-muted">Status:</span>
            <div className="flex gap-1">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => { setStatus(key); saveStatus(key); }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    status === key ? cfg.bg + ' ' + cfg.text : 'bg-nexo-card text-nexo-muted hover:text-white'
                  }`}
                >
                  <cfg.icon size={10} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Notes */}
          <div>
            <label className="text-xs text-nexo-muted mb-1 block">Notas do Projeto</label>
            <textarea
              className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm min-h-[80px] resize-none"
              placeholder="Anotações sobre este projeto..."
              value={notes}
              onChange={e => { setNotes(e.target.value); saveStatus(null, e.target.value); }}
            />
          </div>

          {/* Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              dragActive ? 'border-nexo-info bg-nexo-info/5' : 'border-nexo-border'
            }`}
          >
            <Upload size={24} className="text-nexo-muted mx-auto mb-2" />
            <p className="text-sm text-nexo-muted">Arraste arquivos aqui ou</p>
            <label className="inline-block mt-2 px-4 py-2 bg-nexo-info rounded-lg text-xs cursor-pointer hover:opacity-90">
              Selecionar Arquivos
              <input type="file" multiple className="hidden" onChange={e => handleFiles(Array.from(e.target.files))} />
            </label>
          </div>

          {/* Import MD */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-nexo-muted">Ou importe um arquivo Markdown:</span>
            <button onClick={() => setShowImport(!showImport)} className="text-xs text-nexo-info hover:underline">
              {showImport ? 'Cancelar' : 'Importar .md'}
            </button>
          </div>
          
          <AnimatePresence>
            {showImport && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-2">
                <input
                  className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
                  placeholder="Nome do arquivo (sem .md)"
                  value={mdFileName}
                  onChange={e => setMdFileName(e.target.value)}
                />
                <textarea
                  className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm min-h-[120px] resize-none font-mono text-xs"
                  placeholder="Cole o conteúdo Markdown aqui..."
                  value={mdContent}
                  onChange={e => setMdContent(e.target.value)}
                />
                <button onClick={handleImportMD} disabled={!mdContent || !mdFileName} className="w-full px-4 py-2 bg-nexo-success rounded-lg text-xs hover:opacity-90 disabled:opacity-50">
                  Importar Markdown
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Files List */}
          {files.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Arquivos ({files.length})</h3>
              <div className="space-y-1">
                {files.map(file => (
                  <div key={file.id} className="flex items-center gap-3 px-3 py-2 bg-nexo-card rounded-lg group">
                    <FileText size={14} className="text-nexo-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{file.name}</div>
                      <div className="text-[10px] text-nexo-muted">
                        {(file.size / 1024).toFixed(1)} KB {file.isImported && '• Importado'}
                      </div>
                    </div>
                    {file.isImported && (
                      <button className="p-1 hover:bg-nexo-border rounded text-nexo-info" title="Ver conteúdo">
                        <Eye size={12} />
                      </button>
                    )}
                    <button onClick={() => removeFile(file.id)} className="p-1 hover:bg-nexo-danger/20 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} className="text-nexo-danger" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-nexo-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-nexo-card rounded-lg text-sm hover:bg-nexo-border transition-colors">
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// Componente Eye para evitar erro
function Eye(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

export default function Clientes() {
  const { data } = useRealtime('/api/state', 30000)
  const clients = data?.clients || []
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)

  const getFolderStatus = (clientId, folderName) => {
    const saved = localStorage.getItem(`client-${clientId}-${folderName}`)
    if (saved) {
      const data = JSON.parse(saved)
      return data.status || 'andamento'
    }
    return 'andamento'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Clientes</h1>
        <span className="text-xs text-nexo-muted">
          {clients.length} cliente{clients.length !== 1 ? 's' : ''} ativo{clients.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {clients.map((client, i) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold font-heading">{client.name}</h2>
                <div className="text-xs text-nexo-muted mt-1 truncate max-w-[300px]">{client.path}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold" style={{
                  color: client.health > 70 ? '#22c55e' : client.health > 40 ? '#f59e0b' : '#ef4444'
                }}>
                  {client.health}%
                </div>
                <div className="text-xs text-nexo-muted">Health Score</div>
              </div>
            </div>

            {/* Progress */}
            <div className="w-full h-2 bg-nexo-card rounded-full overflow-hidden mb-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${client.health}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full rounded-full"
                style={{
                  backgroundColor: client.health > 70 ? '#22c55e' : client.health > 40 ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>

            {/* Folders Grid */}
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(client.folders).map(([name, exists]) => {
                const Icon = folderIcons[name] || Folder
                const folderStatus = getFolderStatus(client.id, name)
                const statusCfg = STATUS_CONFIG[folderStatus]
                
                return (
                  <button
                    key={name}
                    onClick={() => exists && (setSelectedClient(client), setSelectedFolder(name))}
                    disabled={!exists}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all relative ${
                      exists 
                        ? 'bg-nexo-card hover:bg-nexo-border cursor-pointer group' 
                        : 'bg-nexo-card/30 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {/* Status dot */}
                    {exists && (
                      <div 
                        className="absolute top-1 right-1 w-2 h-2 rounded-full"
                        style={{ backgroundColor: statusCfg.color }}
                        title={statusCfg.label}
                      />
                    )}
                    {exists ? (
                      <FolderOpen size={18} className="text-nexo-success group-hover:scale-110 transition-transform" />
                    ) : (
                      <Folder size={18} className="text-nexo-muted" />
                    )}
                    <span className={`text-[10px] ${exists ? 'text-nexo-text' : 'text-nexo-muted'}`}>{name}</span>
                    {exists && (
                      <span className={`text-[8px] px-1 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-nexo-border">
              <button 
                onClick={() => { setSelectedClient(client); setSelectedFolder('ENTREGAS'); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors"
              >
                <FileText size={12} /> Entregas
              </button>
              <button 
                onClick={() => { setSelectedClient(client); setSelectedFolder('PROMPTS'); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors"
              >
                <MessageSquare size={12} /> Prompts
              </button>
              <button 
                onClick={() => { setSelectedClient(client); setSelectedFolder('RELATORIOS'); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors"
              >
                <BarChart3 size={12} /> Relatórios
              </button>
            </div>
          </motion.div>
        ))}
        
        {clients.length === 0 && (
          <div className="glass-card p-8 text-center text-nexo-muted col-span-2">
            Nenhum cliente encontrado
          </div>
        )}
      </div>

      {/* Folder Modal */}
      <AnimatePresence>
        {selectedFolder && selectedClient && (
          <FolderModal 
            client={selectedClient} 
            folderName={selectedFolder} 
            onClose={() => { setSelectedFolder(null); setSelectedClient(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

