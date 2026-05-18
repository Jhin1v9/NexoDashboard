import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Sparkles, Save, Loader2, MessageSquare,
  CheckSquare, Trash2, X, Tag, Clock,
  CheckCircle2, AlertCircle
} from 'lucide-react'
import axios from 'axios'

// Import new components
import BlockEditor from '../components/editor/BlockEditor'
import AIChatSidebar from '../components/ai/AIChatSidebar'
import CommentsSection from '../components/ideas/CommentsSection'
import LinkedClientPicker from '../components/ideas/LinkedClientPicker'

const VALID_STATUSES = [
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'em-discussao', label: 'Em Discuss\u00e3o' },
  { value: 'aprovada', label: 'Aprovada' },
  { value: 'em-andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Conclu\u00edda' },
  { value: 'rejeitada', label: 'Rejeitada' },
  { value: 'arquivada', label: 'Arquivada' }
]

const VALID_TYPES = [
  { value: 'proposta-comercial', label: 'Proposta Comercial' },
  { value: 'brainstorm', label: 'Brainstorm' },
  { value: 'prd', label: 'PRD' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'briefing', label: 'Briefing' },
  { value: 'outro', label: 'Outro' }
]

const VALID_PRIORITIES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'M\u00e9dia' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' }
]

const STATUS_BG = {
  rascunho: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'em-discussao': 'bg-nexo-warning/20 text-nexo-warning border-nexo-warning/30',
  aprovada: 'bg-nexo-success/20 text-nexo-success border-nexo-success/30',
  'em-andamento': 'bg-nexo-info/20 text-nexo-info border-nexo-info/30',
  concluida: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  rejeitada: 'bg-nexo-danger/20 text-nexo-danger border-nexo-danger/30',
  arquivada: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

export default function IdeaEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const autoSaveRef = useRef(null)

  // Core state
  const [idea, setIdea] = useState(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [error, setError] = useState(null)

  // UI state
  const [showAI, setShowAI] = useState(true)
  const [activeTab, setActiveTab] = useState('editar')

  // Form state
  const [title, setTitle] = useState('')
  const [type, setType] = useState('proposta-comercial')
  const [priority, setPriority] = useState('media')
  const [status, setStatus] = useState('rascunho')
  const [assignedTo, setAssignedTo] = useState('')
  const [linkedTo, setLinkedTo] = useState({})
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [editorContent, setEditorContent] = useState(null)
  const [comments, setComments] = useState([])
  const [history, setHistory] = useState([])

  // Load data
  useEffect(() => {
    if (id) {
      loadIdea(id)
    } else {
      setLoading(false)
    }
  }, [id])

  const loadIdea = async (ideaId) => {
    setLoading(true)
    try {
      const res = await axios.get(`/api/ideas/${ideaId}`)
      if (res.data.success) {
        const data = res.data.data?.idea || res.data.data
        setIdea(data)
        setTitle(data.title || '')
        setType(data.type || 'proposta-comercial')
        setPriority(data.priority || 'media')
        setStatus(data.status || 'rascunho')
        setAssignedTo(data.assignedTo || '')
        setLinkedTo(data.linkedTo || {})
        setTags(data.tags || [])
        setComments(data.comments || [])
        setHistory(data.history || [])

        // Parse content for BlockEditor
        const content = data.content
        if (content) {
          if (content.blocks && Array.isArray(content.blocks)) {
            setEditorContent({ blocks: content.blocks })
          } else if (content.body) {
            setEditorContent(content.body)
          } else {
            setEditorContent('')
          }
        } else {
          setEditorContent('')
        }
      }
    } catch (err) {
      setError(err.message)
      console.error('[IdeaEditor] loadIdea error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Auto-save
  useEffect(() => {
    if (isNew || !id) return

    autoSaveRef.current = setInterval(() => {
      autoSave()
    }, 30000)

    return () => clearInterval(autoSaveRef.current)
  }, [title, editorContent, status, priority, type, tags, linkedTo, assignedTo])

  const autoSave = async () => {
    if (!title.trim()) return
    try {
      setSaveStatus('saving')
      const payload = buildPayload()
      await axios.put(`/api/ideas/${id}`, payload)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch (err) {
      setSaveStatus('error')
      console.error('[IdeaEditor] auto-save error:', err)
    }
  }

  const buildPayload = () => {
    // Convert TipTap JSON back to block format for backend
    let blocks = []
    if (editorContent?.json) {
      blocks = tiptapToBlocks(editorContent.json)
    } else if (typeof editorContent === 'string') {
      blocks = [{ type: 'paragraph', content: editorContent }]
    }

    return {
      title,
      type,
      priority,
      status,
      assignedTo,
      linkedTo,
      tags,
      content: { blocks }
    }
  }

  const saveIdea = async () => {
    if (!title.trim()) {
      setError('O titulo e obrigatorio')
      return
    }
    setSaving(true)
    setSaveStatus('saving')
    try {
      const payload = buildPayload()
      if (isNew) {
        const res = await axios.post('/api/ideas', payload)
        if (res.data.success) {
          navigate(`/ideias/${res.data.data.idea.id}`)
        }
      } else {
        const res = await axios.put(`/api/ideas/${id}`, payload)
        if (res.data.success) {
          setIdea(res.data.data?.idea || res.data.data)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus(''), 2000)
        }
      }
    } catch (err) {
      setSaveStatus('error')
      setError(err.message)
      console.error('[IdeaEditor] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const convertToTask = async () => {
    if (isNew) return
    try {
      const res = await axios.post(`/api/ideas/${id}/convert-task`)
      if (res.data.success) {
        alert('Ideia convertida em tarefa com sucesso!')
        navigate('/tarefas')
      }
    } catch (err) {
      console.error('[IdeaEditor] convertToTask error:', err)
      alert('Erro ao converter em tarefa: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleArchive = async () => {
    if (isNew) return
    if (!confirm('Arquivar esta ideia?')) return
    try {
      await axios.put(`/api/ideas/${id}`, { status: 'arquivada' })
      setStatus('arquivada')
    } catch (err) {
      console.error('[IdeaEditor] archive error:', err)
    }
  }

  const handleAddTag = () => {
    if (!tagInput.trim()) return
    if (!tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
    }
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  // Handle editor content change
  const handleEditorChange = useCallback(({ json, html }) => {
    setEditorContent({ json, html })
  }, [])

  // Handle AI suggestion apply
  const handleApplyAISuggestion = useCallback((suggestionText) => {
    // Append suggestion as new blocks in the editor
    if (editorContent && suggestionText) {
      // The BlockEditor will handle this through the content prop
      const newBlock = {
        type: 'paragraph',
        content: suggestionText,
      }
      const currentBlocks = editorContent?.json?.content || []
      const updatedBlocks = [...currentBlocks, newBlock]
      setEditorContent(prev => ({
        ...prev,
        json: { type: 'doc', content: updatedBlocks },
      }))
    }
  }, [editorContent])

  // Handle comments update
  const handleCommentsUpdate = useCallback((updatedComments) => {
    setComments(updatedComments)
  }, [])

  // Handle linkedTo change
  const handleLinkedToChange = useCallback((newLinkedTo) => {
    setLinkedTo(newLinkedTo)
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 text-nexo-primary animate-spin" />
        <span className="ml-2 text-sm text-nexo-muted">Carregando ideia...</span>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-6">
      {/* MAIN EDITOR AREA - 2/3 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6" style={{ width: '66.666%' }}>
        {/* EDITOR HEADER */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => navigate('/ideias')}
              className="p-2 hover:bg-nexo-card rounded-lg transition-colors flex-shrink-0"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4 text-nexo-muted" />
            </button>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titulo da ideia..."
              className="flex-1 min-w-0 bg-transparent text-xl font-bold text-nexo-text outline-none placeholder:text-nexo-muted/40 border-b border-transparent focus:border-nexo-primary/50 transition-colors px-1"
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status Badge */}
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border outline-none cursor-pointer ${STATUS_BG[status] || STATUS_BG.rascunho}`}
            >
              {VALID_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            {/* Priority */}
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-nexo-card text-nexo-text border border-nexo-border outline-none cursor-pointer"
            >
              {VALID_PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {/* Assigned To */}
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-nexo-card text-nexo-text border border-nexo-border outline-none cursor-pointer"
              title="Designar para"
            >
              <option value="">Todos</option>
              <option value="abner">Abner</option>
              <option value="nonoke">Nonoke</option>
              <option value="elias">Elias</option>
            </select>

            {/* AI Toggle */}
            {!isNew && (
              <button
                onClick={() => setShowAI(!showAI)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showAI
                    ? 'bg-nexo-primary/20 text-nexo-primary border-nexo-primary/30'
                    : 'bg-nexo-card text-nexo-muted border-nexo-border hover:text-nexo-text'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                IA
              </button>
            )}

            {/* Save */}
            <button
              onClick={saveIdea}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-nexo-primary text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Save Status Bar */}
        <AnimatePresence>
          {saveStatus && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3"
            >
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] ${
                saveStatus === 'saving' ? 'bg-nexo-info/10 text-nexo-info' :
                saveStatus === 'saved' ? 'bg-nexo-success/10 text-nexo-success' :
                'bg-nexo-danger/10 text-nexo-danger'
              }`}>
                {saveStatus === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
                {saveStatus === 'saved' && <CheckCircle2 className="w-3 h-3" />}
                {saveStatus === 'error' && <AlertCircle className="w-3 h-3" />}
                {saveStatus === 'saving' ? 'Salvando...' :
                 saveStatus === 'saved' ? 'Salvo automaticamente' :
                 'Erro ao salvar'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TABS */}
        <div className="flex items-center gap-1 mb-4 border-b border-nexo-border">
          {[
            { id: 'editar', label: 'Editar', icon: Sparkles },
            { id: 'comentarios', label: `Comentarios (${comments.length})`, icon: MessageSquare },
            { id: 'historico', label: 'Historico', icon: Clock }
          ].map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'text-nexo-primary border-nexo-primary'
                    : 'text-nexo-muted border-transparent hover:text-nexo-text'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* EDITOR BODY */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-0">
          <AnimatePresence mode="wait">
            {activeTab === 'editar' && (
              <motion.div
                key="editar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto space-y-4"
              >
                {/* Metadata Bar */}
                <div className="flex flex-wrap items-center gap-3 p-3 glass-card border border-nexo-border/50">
                  {/* Type */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-nexo-muted uppercase">Tipo</span>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value)}
                      className="px-2 py-1 bg-nexo-bg rounded border border-nexo-border outline-none focus:border-nexo-primary text-xs text-nexo-text"
                    >
                      {VALID_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-px h-5 bg-nexo-border" />

                  {/* Linked Client/Project Picker */}
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <span className="text-[10px] text-nexo-muted uppercase">Vincular a</span>
                    <LinkedClientPicker
                      value={linkedTo}
                      onChange={handleLinkedToChange}
                    />
                  </div>

                  <div className="w-px h-5 bg-nexo-border" />

                  {/* Tags */}
                  <div className="flex items-center gap-2 flex-1">
                    <Tag className="w-3.5 h-3.5 text-nexo-muted" />
                    <div className="flex items-center gap-1 flex-wrap">
                      {tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-nexo-primary/10 text-nexo-primary border border-nexo-primary/20"
                        >
                          {tag}
                          <button onClick={() => handleRemoveTag(tag)}>
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      <div className="flex items-center gap-1">
                        <input
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                          placeholder="+ tag"
                          className="w-16 px-1.5 py-0.5 bg-nexo-bg rounded border border-nexo-border outline-none focus:border-nexo-primary text-[10px] text-nexo-text placeholder:text-nexo-muted/40"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Block Editor (TipTap) */}
                <BlockEditor
                  content={editorContent}
                  onChange={handleEditorChange}
                  readOnly={false}
                />

                {/* Footer actions */}
                {!isNew && (
                  <div className="flex items-center justify-between pt-4 border-t border-nexo-border">
                    <button
                      onClick={convertToTask}
                      className="flex items-center gap-2 px-4 py-2 bg-nexo-success/20 text-nexo-success border border-nexo-success/30 rounded-lg text-xs font-medium hover:bg-nexo-success/30 transition-colors"
                    >
                      <CheckSquare className="w-4 h-4" />
                      Converter em Tarefa
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-nexo-muted">
                        Criada em: {formatDate(idea?.createdAt)}
                      </span>
                      <button
                        onClick={handleArchive}
                        className="flex items-center gap-1 px-3 py-2 text-nexo-danger hover:bg-nexo-danger/10 rounded-lg text-xs transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Arquivar
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'comentarios' && (
              <motion.div
                key="comentarios"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto h-full flex flex-col"
              >
                {isNew ? (
                  <div className="text-center py-12 text-nexo-muted text-sm">
                    Salve a ideia primeiro para adicionar comentarios.
                  </div>
                ) : (
                  <CommentsSection
                    ideaId={id}
                    comments={comments}
                    onUpdate={handleCommentsUpdate}
                  />
                )}
              </motion.div>
            )}

            {activeTab === 'historico' && (
              <motion.div
                key="historico"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto"
              >
                {history.length === 0 ? (
                  <div className="text-center py-12 text-nexo-muted text-sm">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Nenhum historico disponivel.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 glass-card border border-nexo-border/50"
                      >
                        <div className="w-2 h-2 rounded-full bg-nexo-primary flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-nexo-text">{entry.description || entry.action}</p>
                        </div>
                        <span className="text-[10px] text-nexo-muted flex-shrink-0">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* AI CHAT SIDEBAR - 1/3 */}
      <AnimatePresence>
        {showAI && !isNew && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '33.333%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="border-l border-nexo-border overflow-hidden flex-shrink-0"
            style={{ minWidth: 320 }}
          >
            <AIChatSidebar
              ideaId={id}
              idea={idea}
              onApplySuggestion={handleApplyAISuggestion}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Convert TipTap JSON document back to backend block format
function tiptapToBlocks(tiptapJSON) {
  if (!tiptapJSON || !tiptapJSON.content) return []

  return tiptapJSON.content.map(node => {
    switch (node.type) {
      case 'paragraph':
        return {
          type: 'paragraph',
          content: extractText(node),
          id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        }
      case 'heading':
        return {
          type: 'heading',
          level: node.attrs?.level || 2,
          content: extractText(node),
          id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        }
      case 'bulletList':
        return {
          type: 'paragraph',
          content: (node.content || []).map(item => `\u2022 ${extractText(item)}`).join('\n'),
          id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        }
      case 'orderedList':
        return {
          type: 'paragraph',
          content: (node.content || []).map((item, i) => `${i + 1}. ${extractText(item)}`).join('\n'),
          id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        }
      case 'taskList':
        return {
          type: 'checklist',
          content: extractText(node),
          items: (node.content || []).map(item => ({
            id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            text: extractText(item),
            checked: item.attrs?.checked || false,
          })),
          id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        }
      case 'blockquote':
        return {
          type: 'quote',
          content: extractText(node),
          id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        }
      case 'codeBlock':
        return {
          type: 'code',
          language: node.attrs?.language || 'plaintext',
          content: extractText(node),
          id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        }
      case 'horizontalRule':
        return {
          type: 'divider',
          id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        }
      default:
        return {
          type: 'paragraph',
          content: extractText(node),
          id: `blk-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        }
    }
  })
}

// Extract text content from TipTap node
function extractText(node) {
  if (!node) return ''
  if (node.text) return node.text
  if (node.content) {
    return node.content.map(child => extractText(child)).join('')
  }
  return ''
}
