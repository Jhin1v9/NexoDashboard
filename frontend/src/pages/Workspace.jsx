import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import {
  Folder, FolderOpen, FileText, File, Image, Music, Video, Code,
  ChevronRight, Plus, X, Upload, Trash2, Download, Grid, List,
  Search, HardDrive, ArrowLeft, MoreVertical, Edit3, CheckCircle2,
  AlertCircle, LayoutGrid, AlignJustify, ChevronDown, FolderPlus,
  Play, Square, Terminal, RefreshCw, Loader2, ExternalLink, MousePointerClick,
  User, Target, Mail, Phone, Euro, Tag, CheckCircle
} from 'lucide-react'
import DevLogTerminal from '../components/workspace/DevLogTerminal'
import ContextMenu from '../components/workspace/ContextMenu'
import WorkspaceFileViewer from '../components/workspace/WorkspaceFileViewer'

function getFileIcon(name, type) {
  if (type === 'folder') return FolderOpen
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return Image
  if (['mp4','webm','mov'].includes(ext)) return Video
  if (['mp3','wav','ogg'].includes(ext)) return Music
  if (['js','jsx','ts','tsx','html','css','json','py','php'].includes(ext)) return Code
  if (['pdf','doc','docx','txt','md'].includes(ext)) return FileText
  return File
}

const VIEWABLE_EXTS = new Set([
  'md','txt','json','js','jsx','ts','tsx','html','css','py','php',
  'yaml','yml','xml','sh','bash','zsh','sql','env','gitignore',
  'csv','log','dockerfile','nginx','conf','ini','toml','graphql',
])
function isViewableFile(name) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  return VIEWABLE_EXTS.has(ext)
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getProjectBadge(type) {
  const map = {
    'react-vite': { label: 'React + Vite', color: '#61dafb' },
    'react-cra': { label: 'React CRA', color: '#61dafb' },
    'react': { label: 'React', color: '#61dafb' },
    'nextjs': { label: 'Next.js', color: '#fff' },
    'vue': { label: 'Vue', color: '#42b883' },
    'static-html': { label: 'HTML', color: '#e34c26' },
    'node-generic': { label: 'Node', color: '#339933' },
    'php': { label: 'PHP', color: '#777bb4' },
    'wordpress': { label: 'WordPress', color: '#21759b' },
    'python': { label: 'Python', color: '#3776ab' },
  }
  return map[type] || null
}

// ── Modal Criar Cliente ──
function CreateClientModal({ onClose, onCreate }) {
  const [id, setId] = useState('')
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState('#3b82f6')
  const [responsavel, setResponsavel] = useState('todos')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!id.trim() || !nome.trim()) return
    setLoading(true)
    try {
      await onCreate({ id: id.trim(), nome: nome.trim(), cor, responsavel })
      onClose()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card w-full max-w-md rounded-xl border border-nexo-border shadow-xl overflow-hidden">
        <div className="p-5 border-b border-nexo-border flex items-center justify-between">
          <h3 className="font-bold text-lg">Novo Cliente</h3>
          <button onClick={onClose} className="p-1 hover:bg-nexo-card rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-nexo-muted mb-1 block">ID único (ex: jesse-onadance)</label>
            <input value={id} onChange={e => setId(e.target.value)} className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm" placeholder="jesse-onadance" required />
          </div>
          <div>
            <label className="text-xs text-nexo-muted mb-1 block">Nome do cliente</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm" placeholder="Jesse — Onadance" required />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs text-nexo-muted mb-1 block">Cor</label>
              <input type="color" value={cor} onChange={e => setCor(e.target.value)} className="w-full h-9 rounded-lg cursor-pointer" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-nexo-muted mb-1 block">Responsável</label>
              <select value={responsavel} onChange={e => setResponsavel(e.target.value)} className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm">
                <option value="todos">Todos</option>
                <option value="abner">Abner</option>
                <option value="nonoke">Nonoke</option>
                <option value="elias">Elias</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-nexo-card transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-nexo-info rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />} Criar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Modal Criar Pasta ──
function CreateFolderModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await onCreate(name.trim())
      onClose()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card w-full max-w-sm rounded-xl border border-nexo-border shadow-xl overflow-hidden">
        <div className="p-5 border-b border-nexo-border flex items-center justify-between">
          <h3 className="font-bold text-lg">Nova Pasta</h3>
          <button onClick={onClose} className="p-1 hover:bg-nexo-card rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm" placeholder="Nome da pasta" required autoFocus />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-nexo-card transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-nexo-info rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />} Criar
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Lead Preview Panel ──
function LeadPreviewPanel({ lead, onConvert, isConverting }) {
  const pipelineColors = {
    novo: '#6B7280',
    contatado: '#3B82F6',
    proposta_enviada: '#F59E0B',
    negociacao: '#8B5CF6',
    ganho: '#22C55E',
    perdido: '#EF4444'
  }
  const statusLabel = lead.pipelineStatus?.replace(/_/g, ' ') || 'novo'
  const statusColor = pipelineColors[lead.pipelineStatus] || '#6B7280'

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg glass-card rounded-xl border border-nexo-border p-6 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-nexo-primary/10 flex items-center justify-center">
            <Target size={24} className="text-nexo-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{lead.nome}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: statusColor, borderColor: statusColor + '40', backgroundColor: statusColor + '10' }}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {lead.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-nexo-info" />
              <span className="text-nexo-muted">Email:</span>
              <span>{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone size={16} className="text-nexo-info" />
              <span className="text-nexo-muted">Telefone:</span>
              <span>{lead.phone}</span>
            </div>
          )}
          {lead.source && (
            <div className="flex items-center gap-3 text-sm">
              <Tag size={16} className="text-nexo-muted" />
              <span className="text-nexo-muted">Fonte:</span>
              <span className="capitalize">{lead.source.replace(/-/g, ' ')}</span>
            </div>
          )}
          {lead.estimatedValue > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <Euro size={16} className="text-nexo-success" />
              <span className="text-nexo-muted">Valor estimado:</span>
              <span>€{lead.estimatedValue.toLocaleString('pt-BR')}</span>
            </div>
          )}
          {lead.responsavel && lead.responsavel !== 'todos' && (
            <div className="flex items-center gap-3 text-sm">
              <User size={16} className="text-nexo-muted" />
              <span className="text-nexo-muted">Responsável:</span>
              <span className="capitalize">{lead.responsavel}</span>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-nexo-border">
          <button
            onClick={() => onConvert(lead.id)}
            disabled={isConverting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-nexo-success/10 hover:bg-nexo-success/20 text-nexo-success rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isConverting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            {isConverting ? 'Convertendo...' : 'Converter em Cliente'}
          </button>
          <p className="text-center text-[11px] text-nexo-muted mt-2">
            Isso criará a pasta do workspace com a estrutura padrão.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main Page ──
export default function Workspace() {
  const { clientId: urlClientId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [currentPath, setCurrentPath] = useState('')
  const [files, setFiles] = useState([])
  const [viewMode, setViewMode] = useState('grid')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showCreateClient, setShowCreateClient] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [viewerFile, setViewerFile] = useState(null)
  const [projectTypes, setProjectTypes] = useState({})
  const [runningServers, setRunningServers] = useState([])
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [activeLogServer, setActiveLogServer] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [isConverting, setIsConverting] = useState(false)

  const token = localStorage.getItem('nexo_token') || ''
  const api = axios.create({ headers: { Authorization: `Bearer ${token}` } })

  const fetchServers = useCallback(async () => {
    try {
      const res = await api.get('/api/workspace/servers')
      setRunningServers(res.data.servers || [])
    } catch (e) { /* ignore */ }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/api/workspace/clients')
      setClients(res.data.clientes || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  const fetchFiles = useCallback(async (cid, path) => {
    setLoading(true)
    try {
      const res = await api.get(`/api/workspace/clients/${cid}/files?path=${encodeURIComponent(path)}`)
      const list = res.data.files || []
      setFiles(list)
      // Detect project types for folders inside 05_demos
      const types = {}
      for (const f of list) {
        if (f.type === 'folder' && (path === '05_demos' || path.startsWith('05_demos/'))) {
          try {
            const dres = await api.get(`/api/workspace/clients/${cid}/detect?path=${encodeURIComponent(f.path)}`)
            if (dres.data.type && dres.data.type !== 'unknown') {
              types[f.path] = dres.data.type
            }
          } catch { /* ignore */ }
        }
      }
      setProjectTypes(types)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
    fetchServers()
    const iv = setInterval(fetchServers, 5000)
    return () => clearInterval(iv)
  }, [fetchClients, fetchServers])

  useEffect(() => {
    if (urlClientId) {
      const c = clients.find(x => x.id === urlClientId)
      if (c) {
        setSelectedClient(c)
        setCurrentPath('')
        fetchFiles(c.id, '')
      }
    } else {
      setSelectedClient(null)
      setCurrentPath('')
      setFiles([])
    }
  }, [urlClientId, clients, fetchFiles])

  const handleSelectClient = (c) => {
    navigate(`/workspace/${c.id}`)
  }

  const handleNavigate = (targetPath) => {
    setCurrentPath(targetPath)
    setSelectedFile(null)
    fetchFiles(selectedClient.id, targetPath)
  }

  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : []

  const handleUpload = async (fileList) => {
    if (!selectedClient) return
    for (const file of fileList) {
      const form = new FormData()
      form.append('file', file)
      form.append('path', currentPath)
      try {
        await api.post(`/api/workspace/clients/${selectedClient.id}/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      } catch (e) {
        console.error('Upload error:', e)
      }
    }
    fetchFiles(selectedClient.id, currentPath)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) {
      handleUpload(e.dataTransfer.files)
    }
  }

  const handleStart = async (demoPath) => {
    try {
      setLoading(true)
      const res = await api.post(`/api/workspace/clients/${selectedClient.id}/start`, { path: demoPath })
      if (res.data.success) {
        fetchServers()
        alert(`Servidor iniciado! ${res.data.server?.url || ''}`)
      }
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async (serverId) => {
    try {
      await api.post(`/api/workspace/clients/${selectedClient.id}/stop`, { serverId })
      fetchServers()
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    }
  }

  const handleContextMenu = (e, f) => {
    e.preventDefault()
    const items = [
      { label: 'Renomear', icon: Edit3, action: () => { setRenameTarget(f); setRenameValue(f.name) } },
    ]
    if (f.type === 'file') {
      items.push({ label: 'Download', icon: Download, action: () => window.open(`/api/workspace/clients/${selectedClient.id}/download?path=${encodeURIComponent(f.path)}&token=${token}`, '_blank') })
    }
    const isRunnable = f.type === 'folder' && (projectTypes[f.path] && projectTypes[f.path] !== 'unknown')
    const runningSrv = runningServers.find(s => s.clienteId === selectedClient?.id && s.demoPath === f.path)
    if (isRunnable && !runningSrv) {
      items.push({ label: 'Executar', icon: Play, action: () => handleStart(f.path) })
    }
    if (runningSrv) {
      items.push({ label: 'Ver logs', icon: Terminal, action: () => setActiveLogServer(runningSrv.id) })
      items.push({ label: 'Parar', icon: Square, action: () => handleStop(runningSrv.id), danger: true })
    }
    items.push({ separator: true, label: '', icon: null, action: () => {} })
    items.push({ label: 'Excluir', icon: Trash2, action: () => handleDelete(f), danger: true })
    setContextMenu({ x: e.clientX, y: e.clientY, items })
  }

  const handleDelete = async (f) => {
    if (!confirm(`Excluir "${f.name}"?`)) return
    try {
      await api.delete(`/api/workspace/clients/${selectedClient.id}/files?path=${encodeURIComponent(f.path)}`)
      fetchFiles(selectedClient.id, currentPath)
      if (selectedFile?.path === f.path) setSelectedFile(null)
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    }
  }

  const handleRename = async (f) => {
    if (!renameValue.trim() || renameValue.trim() === f.name) {
      setRenameTarget(null)
      return
    }
    try {
      await api.post(`/api/workspace/clients/${selectedClient.id}/rename`, {
        path: f.path,
        newName: renameValue.trim()
      })
      setRenameTarget(null)
      fetchFiles(selectedClient.id, currentPath)
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    }
  }

  const handleCreateClient = async (data) => {
    const res = await api.post('/api/workspace/clients', data)
    await fetchClients()
    handleSelectClient(res.data.client)
  }

  const handleConvertLead = async (leadId) => {
    setIsConverting(true)
    try {
      const res = await api.post(`/api/leads/${leadId}/convert`)
      if (res.data.success) {
        await fetchClients()
        // Navega para o workspace recém-criado
        navigate(`/workspace/${leadId}`)
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setIsConverting(false)
    }
  }

  const handleCreateFolder = async (name) => {
    await api.post(`/api/workspace/clients/${selectedClient.id}/folders`, {
      path: currentPath,
      name
    })
    fetchFiles(selectedClient.id, currentPath)
  }

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  const renderFileItem = (f) => {
    const Icon = getFileIcon(f.name, f.type)
    const isSelected = selectedFile?.path === f.path
    const isRenaming = renameTarget?.path === f.path
    const projBadge = f.type === 'folder' ? projectTypes[f.path] : null
    const badge = getProjectBadge(projBadge)
    const runningSrv = runningServers.find(s => s.clienteId === selectedClient?.id && s.demoPath === f.path)
    const isRunnable = f.type === 'folder' && (projBadge && projBadge !== 'unknown')

    if (viewMode === 'list') {
      return (
        <div
          key={f.path}
          onClick={() => setSelectedFile(f)}
          onDoubleClick={() => {
            if (f.type === 'folder') {
              handleNavigate(f.path)
            } else if (f.type === 'file' && isViewableFile(f.name)) {
              setViewerFile(f)
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, f)}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-nexo-info/10 border border-nexo-info/30' : 'hover:bg-nexo-card/60 border border-transparent'}`}
        >
          <Icon size={20} className={f.type === 'folder' ? 'text-nexo-warning' : 'text-nexo-muted'} />
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <input
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRename(f)}
                onBlur={() => handleRename(f)}
                autoFocus
                className="w-full px-2 py-1 bg-nexo-card rounded border border-nexo-info text-sm"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm font-medium truncate block">{f.name}</span>
            )}
          </div>
          {badge && <span className="text-[10px] px-1.5 py-0.5 rounded bg-nexo-card border border-nexo-border" style={{ color: badge.color }}>{badge.label}</span>}
          {runningSrv && (
            <a href={runningSrv.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-nexo-success/10 text-nexo-success border border-nexo-success/30" onClick={e => e.stopPropagation()}>
              <ExternalLink size={10} /> {runningSrv.url}
            </a>
          )}
          <span className="text-xs text-nexo-muted w-20 text-right">{f.type === 'file' ? formatSize(f.size) : '—'}</span>
          <span className="text-xs text-nexo-muted w-28 text-right hidden md:block">{new Date(f.modifiedAt).toLocaleDateString()}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            {isRunnable && !runningSrv && (
              <button onClick={() => handleStart(f.path)} className="p-1.5 hover:bg-nexo-success/20 text-nexo-success rounded-lg" title="Executar"><Play size={14} /></button>
            )}
            {runningSrv && (
              <button onClick={() => handleStop(runningSrv.id)} className="p-1.5 hover:bg-nexo-danger/20 text-nexo-danger rounded-lg" title="Parar"><Square size={14} /></button>
            )}
            <button onClick={() => { setRenameTarget(f); setRenameValue(f.name) }} className="p-1.5 hover:bg-nexo-card rounded-lg" title="Renomear"><Edit3 size={14} /></button>
            {f.type === 'file' && (
              <a href={`/api/workspace/clients/${selectedClient.id}/download?path=${encodeURIComponent(f.path)}&token=${token}`} className="p-1.5 hover:bg-nexo-card rounded-lg" title="Download" onClick={e => e.stopPropagation()}>
                <Download size={14} />
              </a>
            )}
            <button onClick={() => handleDelete(f)} className="p-1.5 hover:bg-nexo-danger/20 text-nexo-danger rounded-lg" title="Excluir"><Trash2 size={14} /></button>
          </div>
        </div>
      )
    }

    // Grid view
    return (
      <motion.div
        key={f.path}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setSelectedFile(f)}
        onDoubleClick={() => f.type === 'folder' && handleNavigate(f.path)}
        onContextMenu={(e) => handleContextMenu(e, f)}
        className={`group relative p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-nexo-info/10 border-nexo-info/40' : 'bg-nexo-card/40 border-nexo-border hover:border-nexo-info/30 hover:bg-nexo-card/70'}`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Icon size={40} className={f.type === 'folder' ? 'text-nexo-warning' : 'text-nexo-muted'} strokeWidth={1.5} />
          {isRenaming ? (
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename(f)}
              onBlur={() => handleRename(f)}
              autoFocus
              className="w-full px-2 py-1 bg-nexo-bg rounded border border-nexo-info text-xs text-center"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="text-xs font-medium truncate w-full">{f.name}</span>
          )}
          {badge && <span className="text-[10px] px-1.5 py-0.5 rounded bg-nexo-bg border border-nexo-border" style={{ color: badge.color }}>{badge.label}</span>}
          {runningSrv && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-nexo-success/10 text-nexo-success border border-nexo-success/30">
              <ExternalLink size={10} /> {runningSrv.url}
            </span>
          )}
          <span className="text-[10px] text-nexo-muted">{f.type === 'file' ? formatSize(f.size) : 'Pasta'}</span>
        </div>
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {isRunnable && !runningSrv && (
            <button onClick={() => handleStart(f.path)} className="p-1 hover:bg-nexo-success/20 text-nexo-success rounded-lg bg-nexo-bg/80" title="Executar"><Play size={12} /></button>
          )}
          {runningSrv && (
            <button onClick={() => handleStop(runningSrv.id)} className="p-1 hover:bg-nexo-danger/20 text-nexo-danger rounded-lg bg-nexo-bg/80" title="Parar"><Square size={12} /></button>
          )}
          <button onClick={() => { setRenameTarget(f); setRenameValue(f.name) }} className="p-1 hover:bg-nexo-card rounded-lg bg-nexo-bg/80"><Edit3 size={12} /></button>
          {f.type === 'file' && (
            <a href={`/api/workspace/clients/${selectedClient.id}/download?path=${encodeURIComponent(f.path)}&token=${token}`} className="p-1 hover:bg-nexo-card rounded-lg bg-nexo-bg/80" onClick={e => e.stopPropagation()}>
              <Download size={12} />
            </a>
          )}
          <button onClick={() => handleDelete(f)} className="p-1 hover:bg-nexo-danger/20 text-nexo-danger rounded-lg bg-nexo-bg/80"><Trash2 size={12} /></button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="h-[calc(100vh-80px)] flex gap-4 -m-6 p-6">
      {/* Sidebar clientes */}
      <aside className="w-64 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <HardDrive size={20} className="text-nexo-info" /> Workspace
          </h2>
          <button onClick={() => setShowCreateClient(true)} className="p-1.5 hover:bg-nexo-card rounded-lg transition-colors" title="Novo cliente">
            <Plus size={18} />
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-nexo-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full pl-8 pr-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {(() => {
            const q = search.toLowerCase()
            const filtered = clients.filter(c => (c.nome || '').toLowerCase().includes(q))
            const leads = filtered.filter(c => c.kind === 'lead')
            const workspaceClients = filtered.filter(c => c.kind === 'client')
            const pipelineColors = {
              novo: '#6B7280',
              contatado: '#3B82F6',
              proposta_enviada: '#F59E0B',
              negociacao: '#8B5CF6',
              ganho: '#22C55E',
              perdido: '#EF4444'
            }

            return (
              <>
                {/* Workspace Clients */}
                {workspaceClients.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold text-nexo-muted uppercase tracking-wider">Clientes</div>
                    {workspaceClients.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectClient(c)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${selectedClient?.id === c.id ? 'bg-nexo-info/10 border border-nexo-info/30 text-nexo-info' : 'hover:bg-nexo-card/60 border border-transparent'}`}
                      >
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.cor || '#3b82f6' }} />
                        <span className="truncate font-medium">{c.nome}</span>
                        {c.status === 'ativo' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-nexo-success" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Leads */}
                {leads.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold text-nexo-muted uppercase tracking-wider">Leads</div>
                    {leads.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectClient(c)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${selectedClient?.id === c.id ? 'bg-nexo-info/10 border border-nexo-info/30 text-nexo-info' : 'hover:bg-nexo-card/60 border border-transparent'}`}
                      >
                        <Target size={14} className="flex-shrink-0" style={{ color: pipelineColors[c.pipelineStatus] || '#6B7280' }} />
                        <span className="truncate font-medium">{c.nome}</span>
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-card border border-nexo-border" style={{ color: pipelineColors[c.pipelineStatus] || '#6B7280' }}>
                          {c.pipelineStatus?.replace(/_/g, ' ') || 'novo'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {clients.length === 0 && (
                  <div className="text-center py-8 text-nexo-muted text-sm">
                    <Folder size={32} className="mx-auto mb-2 opacity-30" />
                    Nenhum cliente ainda
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 glass-card rounded-xl border border-nexo-border overflow-hidden">
        {!selectedClient ? (
          <div className="flex-1 flex flex-col items-center justify-center text-nexo-muted">
            <HardDrive size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">Selecione um cliente para visualizar o workspace</p>
            <p className="text-sm mt-1">Ou crie um novo cliente no botão <Plus size={14} className="inline" /></p>
          </div>
        ) : selectedClient.kind === 'lead' ? (
          <LeadPreviewPanel lead={selectedClient} onConvert={handleConvertLead} isConverting={isConverting} />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-nexo-border">
              <div className="flex items-center gap-2 text-sm min-w-0">
                <button onClick={() => handleNavigate('')} className="hover:text-nexo-info transition-colors flex-shrink-0">{selectedClient.nome}</button>
                {breadcrumbs.map((crumb, i) => {
                  const target = breadcrumbs.slice(0, i + 1).join('/')
                  return (
                    <div key={i} className="flex items-center gap-2 min-w-0">
                      <ChevronRight size={14} className="text-nexo-muted flex-shrink-0" />
                      <button onClick={() => handleNavigate(target)} className="hover:text-nexo-info transition-colors truncate">{crumb}</button>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-nexo-info/10 hover:bg-nexo-info/20 text-nexo-info rounded-lg text-xs font-medium transition-colors">
                  <Upload size={14} /> Upload
                </button>
                <button onClick={() => setShowCreateFolder(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-nexo-card hover:bg-nexo-card/80 rounded-lg text-xs font-medium transition-colors border border-nexo-border">
                  <FolderPlus size={14} /> Pasta
                </button>
                <div className="w-px h-5 bg-nexo-border mx-1" />
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-nexo-card text-nexo-info' : 'text-nexo-muted hover:text-nexo-text'}`}>
                  <LayoutGrid size={16} />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-nexo-card text-nexo-info' : 'text-nexo-muted hover:text-nexo-text'}`}>
                  <AlignJustify size={16} />
                </button>
              </div>
            </div>

            {/* File area */}
            <div
              className={`flex-1 overflow-y-auto p-4 relative ${dragOver ? 'bg-nexo-info/5' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {dragOver && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-nexo-info/10 backdrop-blur-sm rounded-lg border-2 border-dashed border-nexo-info/40 m-2">
                  <Upload size={40} className="text-nexo-info mb-2" />
                  <p className="text-sm font-medium text-nexo-info">Solte os arquivos aqui</p>
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center h-full text-nexo-muted gap-2">
                  <Loader2 size={20} className="animate-spin" /> Carregando...
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-nexo-muted">
                  <FolderOpen size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">Esta pasta está vazia</p>
                  <p className="text-xs mt-1">Arraste arquivos aqui ou use o botão Upload</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {filteredFiles.map(renderFileItem)}
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-nexo-muted border-b border-nexo-border mb-1">
                    <span className="flex-1">Nome</span>
                    <span className="w-20 text-right">Tamanho</span>
                    <span className="w-28 text-right hidden md:block">Modificado</span>
                    <span className="w-16" />
                  </div>
                  {filteredFiles.map(renderFileItem)}
                </div>
              )}
            </div>

            {/* Preview pane (optional bottom bar or side panel — keeping it simple for now) */}
            <AnimatePresence>
              {selectedFile && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-nexo-border overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3 text-sm">
                    {(() => {
                      const Icon = getFileIcon(selectedFile.name, selectedFile.type)
                      return <Icon size={20} className={selectedFile.type === 'folder' ? 'text-nexo-warning' : 'text-nexo-muted'} />
                    })()}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-nexo-muted">
                        {selectedFile.type === 'folder' ? 'Pasta' : `${formatSize(selectedFile.size)} · ${selectedFile.path}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedFile.type === 'file' && isViewableFile(selectedFile.name) && (
                        <button onClick={() => setViewerFile(selectedFile)} className="flex items-center gap-1.5 px-3 py-1.5 bg-nexo-info/10 hover:bg-nexo-info/20 text-nexo-info rounded-lg text-xs transition-colors">
                          <Edit3 size={14} /> Visualizar
                        </button>
                      )}
                      {selectedFile.type === 'file' && (
                        <a href={`/api/workspace/clients/${selectedClient.id}/download?path=${encodeURIComponent(selectedFile.path)}&token=${token}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-nexo-card hover:bg-nexo-card/80 rounded-lg text-xs border border-nexo-border transition-colors">
                          <Download size={14} /> Download
                        </a>
                      )}
                      <button onClick={() => handleDelete(selectedFile)} className="flex items-center gap-1.5 px-3 py-1.5 bg-nexo-danger/10 hover:bg-nexo-danger/20 text-nexo-danger rounded-lg text-xs transition-colors">
                        <Trash2 size={14} /> Excluir
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { handleUpload(e.target.files); e.target.value = '' }} />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Dev Log Terminal */}
      <DevLogTerminal serverId={activeLogServer} onClose={() => setActiveLogServer(null)} />

      {/* File Viewer */}
      <AnimatePresence>
        {viewerFile && (
          <WorkspaceFileViewer
            clientId={selectedClient.id}
            file={viewerFile}
            token={token}
            onClose={() => setViewerFile(null)}
            onSaved={() => fetchFiles(selectedClient.id, currentPath)}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showCreateClient && (
          <CreateClientModal onClose={() => setShowCreateClient(false)} onCreate={handleCreateClient} />
        )}
        {showCreateFolder && (
          <CreateFolderModal onClose={() => setShowCreateFolder(false)} onCreate={handleCreateFolder} />
        )}
      </AnimatePresence>
    </div>
  )
}
