import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import {
  X, Save, Edit3, Eye, EyeOff, Download, ExternalLink,
  FileText, FileCode, Globe, Loader2, Bot, CheckCircle2
} from 'lucide-react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import python from 'highlight.js/lib/languages/python'
import php from 'highlight.js/lib/languages/php'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import xml from 'highlight.js/lib/languages/xml'
import bash from 'highlight.js/lib/languages/bash'
import ini from 'highlight.js/lib/languages/ini'
import markdown from 'highlight.js/lib/languages/markdown'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import graphql from 'highlight.js/lib/languages/graphql'
import plaintext from 'highlight.js/lib/languages/plaintext'
import 'highlight.js/styles/atom-one-dark.min.css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('css', css)
hljs.registerLanguage('python', python)
hljs.registerLanguage('php', php)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('ini', ini)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('graphql', graphql)
hljs.registerLanguage('plaintext', plaintext)

const CODE_EXTENSIONS = new Set([
  'js','jsx','ts','tsx','json','css','py','php','sql','yaml',
  'yml','xml','sh','bash','zsh','env','gitignore','dockerfile',
  'nginx','conf','ini','toml','graphql','csv','log'
])

function getFileKind(name) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  if (ext === 'md') return 'markdown'
  if (ext === 'html') return 'html'
  if (CODE_EXTENSIONS.has(ext)) return 'code'
  return 'text'
}

function getLanguageLabel(name) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  const map = {
    js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
    json: 'JSON', css: 'CSS', py: 'Python', php: 'PHP', sql: 'SQL',
    yaml: 'YAML', yml: 'YAML', xml: 'XML', sh: 'Shell', bash: 'Bash',
    dockerfile: 'Dockerfile', nginx: 'Nginx', conf: 'Config',
    ini: 'INI', toml: 'TOML', graphql: 'GraphQL', csv: 'CSV',
    log: 'Log', html: 'HTML', md: 'Markdown', txt: 'Texto',
  }
  return map[ext] || 'Texto'
}

function getHljsLanguage(name) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    json: 'json', css: 'css', py: 'python', php: 'php', sql: 'sql',
    yaml: 'yaml', yml: 'yaml', xml: 'xml', sh: 'bash', bash: 'bash',
    dockerfile: 'dockerfile', nginx: 'nginx', conf: 'ini',
    ini: 'ini', toml: 'ini', graphql: 'graphql', html: 'html',
    md: 'markdown', csv: 'csv', log: 'plaintext',
  }
  return map[ext] || 'plaintext'
}

/**
 * CodeBlock — syntax highlighting com highlight.js
 */
function CodeBlock({ code, language, fileName }) {
  const preRef = useRef(null)

  useEffect(() => {
    if (preRef.current) {
      preRef.current.innerHTML = ''
      const codeEl = document.createElement('code')
      codeEl.className = `language-${language}`
      codeEl.textContent = code
      preRef.current.appendChild(codeEl)
      hljs.highlightElement(codeEl)
    }
  }, [code, language])

  return (
    <div className="h-full overflow-auto bg-[#282c34] custom-scrollbar">
      <div className="flex items-center justify-between px-4 py-2 bg-[#21252b] border-b border-[#181a1f]">
        <span className="text-[10px] text-nexo-muted uppercase tracking-wider">{fileName}</span>
        <span className="text-[10px] text-nexo-muted">{language}</span>
      </div>
      <pre ref={preRef} className="p-4 m-0 text-xs leading-relaxed font-mono" />
    </div>
  )
}

/**
 * Renderização simples de Markdown para preview.
 */
function SimpleMarkdownPreview({ source }) {
  const html = source
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-nexo-card p-3 rounded-lg overflow-auto text-xs my-2"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-nexo-card px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/^###### (.*$)/gim, '<h6 class="text-xs font-bold mt-3 mb-1">$1</h6>')
    .replace(/^##### (.*$)/gim, '<h5 class="text-sm font-bold mt-3 mb-1">$1</h5>')
    .replace(/^#### (.*$)/gim, '<h4 class="text-sm font-bold mt-3 mb-1">$1</h4>')
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/^&gt; (.*$)/gim, '<blockquote class="border-l-2 border-nexo-muted pl-3 italic my-2 text-nexo-muted">$1</blockquote>')
    .replace(/^---$/gim, '<hr class="border-nexo-border my-3" />')
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/___(.*?)___/g, '<strong><em>$1</em></strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-nexo-info hover:underline">$1</a>')
    .replace(/^\s*[-*+] (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
    .split('\n').map(line => {
      if (line.trim() === '') return ''
      if (/^<[a-z]/.test(line)) return line
      return `<p class="my-1 text-sm leading-relaxed">${line}</p>`
    }).join('')

  return <div className="prose prose-sm max-w-none p-4" dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * WorkspaceFileViewer
 *
 * Props:
 *  clientId    {string}
 *  file        {object}
 *  token       {string}
 *  onClose     {function}
 *  onSaved     {function}
 */
export default function WorkspaceFileViewer({ clientId, file, token, onClose, onSaved }) {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [savedOk, setSavedOk] = useState(false)
  const kind = getFileKind(file.name)
  const hlLang = getHljsLanguage(file.name)

  const api = axios.create({ headers: { Authorization: `Bearer ${token}` } })

  // Fetch content
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setEditMode(false)
    setSavedOk(false)
    setShowPreview(kind === 'html' || kind === 'markdown' || kind === 'code')

    api.get(`/api/workspace/clients/${clientId}/content?path=${encodeURIComponent(file.path)}`)
      .then(res => {
        if (cancelled) return
        const text = res.data.content || ''
        setContent(text)
        setOriginalContent(text)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.response?.data?.error || err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [clientId, file.path, kind])

  // Auto-dismiss savedOk
  useEffect(() => {
    if (!savedOk) return
    const t = setTimeout(() => setSavedOk(false), 2000)
    return () => clearTimeout(t)
  }, [savedOk])

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    function handleKey(e) {
      if (editMode && e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (content !== originalContent && !saving) {
          handleSave()
        }
      }
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [editMode, content, originalContent, saving, onClose])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await api.put(`/api/workspace/clients/${clientId}/content`, {
        path: file.path,
        content,
      })
      setOriginalContent(content)
      setSavedOk(true)
      onSaved?.()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }, [clientId, file.path, content, api, onSaved])

  const hasChanges = content !== originalContent

  // Blob URL para preview HTML
  const htmlBlobUrl = kind === 'html'
    ? URL.createObjectURL(new Blob([content], { type: 'text/html' }))
    : null

  useEffect(() => {
    return () => { if (htmlBlobUrl) URL.revokeObjectURL(htmlBlobUrl) }
  }, [htmlBlobUrl])

  const openInNewTab = () => {
    if (!htmlBlobUrl) return
    window.open(htmlBlobUrl, '_blank')
  }

  const lunaUrl = `/luna?context=workspace&id=${clientId}&file=${encodeURIComponent(file.path)}`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-nexo-bg/95 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-nexo-border bg-nexo-card/50 z-[61]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {kind === 'markdown' && <FileText size={18} className="text-nexo-info" />}
          {kind === 'html' && <Globe size={18} className="text-nexo-warning" />}
          {kind === 'code' && <FileCode size={18} className="text-nexo-success" />}
          {kind === 'text' && <FileText size={18} className="text-nexo-muted" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {file.name}{hasChanges && <span className="text-nexo-warning ml-1">●</span>}
            </p>
            <p className="text-[10px] text-nexo-muted">
              {getLanguageLabel(file.name)} · {file.path}
              {hasChanges && <span className="text-nexo-warning ml-1">— alterações não salvas</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Luna */}
          <a
            href={lunaUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-nexo-border hover:bg-nexo-card transition-colors"
            title="Conversar com a Luna sobre este arquivo"
          >
            <Bot size={14} /> Luna
          </a>

          {/* Preview toggle */}
          {(kind === 'html' || kind === 'markdown' || kind === 'code') && (
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${showPreview ? 'bg-nexo-info/10 border-nexo-info/30 text-nexo-info' : 'border-nexo-border hover:bg-nexo-card'}`}
            >
              {showPreview ? <Eye size={14} /> : <EyeOff size={14} />}
              {showPreview ? 'Preview' : 'Código'}
            </button>
          )}

          {/* Edit toggle */}
          <button
            onClick={() => setEditMode(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${editMode ? 'bg-nexo-info/10 border-nexo-info/30 text-nexo-info' : 'border-nexo-border hover:bg-nexo-card'}`}
          >
            {editMode ? <Eye size={14} /> : <Edit3 size={14} />}
            {editMode ? 'Visualizar' : 'Editar'}
          </button>

          {/* Save */}
          {editMode && (
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${hasChanges ? 'bg-nexo-success/10 border-nexo-success/30 text-nexo-success hover:bg-nexo-success/20' : 'border-nexo-border text-nexo-muted cursor-not-allowed'}`}
              title="Ctrl+S"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : savedOk ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {savedOk ? 'Salvo!' : 'Salvar'}
            </button>
          )}

          {/* Download */}
          <a
            href={`/api/workspace/clients/${clientId}/download?path=${encodeURIComponent(file.path)}&token=${token}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-nexo-border hover:bg-nexo-card transition-colors"
          >
            <Download size={14} /> Download
          </a>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-nexo-card rounded-lg border border-nexo-border transition-colors"
            title="ESC"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative">
        {loading && (
          <div className="flex items-center justify-center h-full text-nexo-muted">
            <Loader2 size={24} className="animate-spin mr-2" /> Carregando arquivo…
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full text-nexo-danger gap-2">
            <p className="text-sm">{error}</p>
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-nexo-border hover:bg-nexo-card text-sm">
              Fechar
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="h-full">
            {/* Markdown — preview / code */}
            {kind === 'markdown' && showPreview && (
              <div className="h-full overflow-auto custom-scrollbar bg-nexo-bg">
                <SimpleMarkdownPreview source={content} />
              </div>
            )}
            {kind === 'markdown' && !showPreview && (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                readOnly={!editMode}
                className="w-full h-full p-4 bg-nexo-bg font-mono text-xs leading-relaxed resize-none focus:outline-none text-nexo-text custom-scrollbar"
                spellCheck={false}
              />
            )}

            {/* HTML — preview / code */}
            {kind === 'html' && showPreview && (
              <div className="h-full flex flex-col">
                <div className="px-4 py-2 border-b border-nexo-border flex items-center gap-2 bg-nexo-card/30">
                  <span className="text-xs text-nexo-muted">Preview</span>
                  <button
                    onClick={openInNewTab}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-nexo-card hover:bg-nexo-card/80 border border-nexo-border transition-colors"
                  >
                    <ExternalLink size={10} /> Abrir no navegador
                  </button>
                </div>
                <iframe
                  src={htmlBlobUrl}
                  className="flex-1 w-full bg-white"
                  sandbox="allow-scripts allow-same-origin"
                  title={file.name}
                />
              </div>
            )}
            {kind === 'html' && !showPreview && (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                readOnly={!editMode}
                className="w-full h-full p-4 bg-nexo-bg font-mono text-xs leading-relaxed resize-none focus:outline-none text-nexo-text custom-scrollbar"
                spellCheck={false}
              />
            )}

            {/* Code — highlight / textarea */}
            {kind === 'code' && showPreview && (
              <CodeBlock code={content} language={hlLang} fileName={file.name} />
            )}
            {kind === 'code' && !showPreview && (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                readOnly={!editMode}
                className="w-full h-full p-4 bg-nexo-bg font-mono text-xs leading-relaxed resize-none focus:outline-none text-nexo-text custom-scrollbar"
                spellCheck={false}
              />
            )}

            {/* Text — textarea */}
            {kind === 'text' && (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                readOnly={!editMode}
                className="w-full h-full p-4 bg-nexo-bg font-mono text-xs leading-relaxed resize-none focus:outline-none text-nexo-text custom-scrollbar"
                spellCheck={false}
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
