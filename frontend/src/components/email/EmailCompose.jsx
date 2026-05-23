import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Link as LinkIcon, Quote, Code, Send, X, Paperclip,
  Sparkles, ChevronDown, Loader2
} from 'lucide-react'

// Assinatura padrão Nexo Digital
const NEXO_SIGNATURE = `
<div style="font-family:Inter,sans-serif; color:#cbd5e1; margin-top:24px; padding-top:16px; border-top:2px solid #1A56DB;">
  <table style="border-collapse:collapse;">
    <tr>
      <td style="padding-right:16px;">
        <img src="https://nexo-digital.app/favicon.svg" width="40" height="40" alt="Nexo Digital" style="border-radius:8px;">
      </td>
      <td>
        <p style="margin:0; font-weight:700; font-size:13px; color:#1A56DB;">Nexo Digital</p>
        <p style="margin:2px 0 0; font-size:11px; color:#94a3b8;">Desarrollo Web y Software Premium</p>
        <p style="margin:4px 0 0; font-size:10px; color:#64748b;">
          📍 Sabadell, Barcelona &nbsp;|&nbsp; ✉️ contacto@nexo-digital.app &nbsp;|&nbsp; 🌐 nexo-digital.app
        </p>
      </td>
    </tr>
  </table>
</div>
`

const TEMPLATES = [
  { id: 'orcamento', name: 'Orçamento', subject: 'Orçamento — {{projeto}}' },
  { id: 'suporte', name: 'Suporte', subject: 'Re: Suporte técnico' },
  { id: 'proposta', name: 'Proposta', subject: 'Proposta de serviço — {{projeto}}' },
  { id: 'follow_up', name: 'Follow-up', subject: 'Seguimiento — {{projeto}}' },
  { id: 'agradecimento', name: 'Agradecimento', subject: 'Obrigado pela confiança!' },
  { id: 'boas_vindas', name: 'Boas-vindas', subject: 'Bem-vindo à Nexo Digital!' },
]

export default function EmailCompose({ mode = 'compose', replyTo, threadId, onSent, onCancel, initialBody = '', initialTo = '', initialSubject = '' }) {
  const [to, setTo] = useState(initialTo || '')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState(initialSubject || '')
  const [showCc, setShowCc] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [sending, setSending] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [lunaLoading, setLunaLoading] = useState(false)
  const [lunaSuggestions, setLunaSuggestions] = useState(null)
  const fileInputRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Underline,
      Placeholder.configure({ placeholder: 'Escreva seu email...' }),
    ],
    content: initialBody ? `<p>${initialBody.replace(/\n/g, '</p><p>')}</p>` : '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
  })

  // Preencher campos quando é resposta, initialBody, initialTo, initialSubject
  useEffect(() => {
    if (replyTo) {
      const fromEmail = replyTo.from?.match(/<([^>]+)>/)?.[1] || replyTo.from
      if (mode === 'reply') {
        setTo(fromEmail)
        setSubject(`Re: ${replyTo.subject?.replace(/^Re: /i, '') || ''}`)
      } else if (mode === 'replyAll') {
        setTo(fromEmail)
        setCc(replyTo.cc || '')
        setSubject(`Re: ${replyTo.subject?.replace(/^Re: /i, '') || ''}`)
      } else if (mode === 'forward') {
        setSubject(`Fwd: ${replyTo.subject || ''}`)
      }
    }
    if (initialTo) setTo(initialTo)
    if (initialSubject) setSubject(initialSubject)
    if (initialBody && editor) {
      editor.commands.setContent(`<p>${initialBody.replace(/\n/g, '</p><p>')}</p>`)
    }
  }, [replyTo, mode, initialBody, initialTo, initialSubject, editor])

  // Auto-save rascunho a cada 10s
  useEffect(() => {
    const interval = setInterval(() => {
      if (editor?.getHTML() && (to || subject)) {
        // Poderia salvar rascunho no backend aqui
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [editor, to, subject])

  const handleSend = async () => {
    if (!to || !subject) return
    setSending(true)
    try {
      const html = editor?.getHTML() || ''
      const text = editor?.getText() || ''
      const fullHtml = html + NEXO_SIGNATURE

      await axios.post('/api/email/messages/send', {
        to,
        subject,
        text,
        html: fullHtml,
        cc: cc || undefined,
        bcc: bcc || undefined,
        threadId: mode !== 'forward' ? threadId : undefined,
        inReplyTo: replyTo?.messageId,
      })
      onSent?.()
    } catch (e) {
      console.error('Erro ao enviar:', e)
      alert('Erro ao enviar email: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  const askLuna = async () => {
    if (!replyTo) return
    setLunaLoading(true)
    try {
      const threadMessages = replyTo.threadId
        ? [{ from: replyTo.from, subject: replyTo.subject, body: { text: replyTo.snippet } }]
        : [{ from: replyTo.from, subject: replyTo.subject, body: { text: replyTo.snippet } }]

      const res = await axios.post('/api/email/ai/suggest-reply', { threadMessages })
      setLunaSuggestions(res.data.suggestions || [])
    } catch (e) {
      console.error('Erro Luna:', e)
    } finally {
      setLunaLoading(false)
    }
  }

  const applyLunaSuggestion = (text) => {
    editor?.commands.setContent(`<p>${text.replace(/\n/g, '</p><p>')}</p>`)
    setLunaSuggestions(null)
  }

  const applyTemplate = (template) => {
    setSubject(template.subject)
    setShowTemplates(false)
    // Aqui poderia preencher o corpo com um template base
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    setAttachments((prev) => [...prev, ...files])
  }

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      {/* Campos do email */}
      <div className="px-4 space-y-2">
        <div className="flex items-center gap-2 py-2 border-b border-nexo-border/50">
          <span className="text-xs text-nexo-muted w-10">Para:</span>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 bg-transparent text-sm text-nexo-text focus:outline-none placeholder-nexo-muted"
            placeholder="destinatario@email.com"
          />
          <button onClick={() => setShowCc(!showCc)} className="text-xs text-nexo-muted hover:text-nexo-text transition-colors">
            CC/CCO
          </button>
        </div>

        {showCc && (
          <>
            <div className="flex items-center gap-2 py-2 border-b border-nexo-border/50">
              <span className="text-xs text-nexo-muted w-10">CC:</span>
              <input type="text" value={cc} onChange={(e) => setCc(e.target.value)} className="flex-1 bg-transparent text-sm text-nexo-text focus:outline-none placeholder-nexo-muted" />
            </div>
            <div className="flex items-center gap-2 py-2 border-b border-nexo-border/50">
              <span className="text-xs text-nexo-muted w-10">CCO:</span>
              <input type="text" value={bcc} onChange={(e) => setBcc(e.target.value)} className="flex-1 bg-transparent text-sm text-nexo-text focus:outline-none placeholder-nexo-muted" />
            </div>
          </>
        )}

        <div className="flex items-center gap-2 py-2 border-b border-nexo-border/50">
          <span className="text-xs text-nexo-muted w-14 shrink-0">Assunto:</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 bg-transparent text-sm text-nexo-text focus:outline-none placeholder-nexo-muted"
            placeholder="Assunto do email"
          />
          {/* Templates */}
          <div className="relative">
            <button onClick={() => setShowTemplates(!showTemplates)} className="flex items-center gap-1 text-xs text-nexo-primary hover:opacity-80 transition-opacity">
              <Sparkles className="w-3 h-3" /> Templates <ChevronDown className="w-3 h-3" />
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-nexo-card border border-nexo-border rounded-xl shadow-xl z-50 py-1">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => applyTemplate(t)} className="w-full text-left px-3 py-2 text-sm text-nexo-muted hover:bg-nexo-bg hover:text-nexo-text transition-colors">
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-nexo-border/50">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-nexo-bg transition-colors ${editor.isActive('bold') ? 'text-nexo-primary' : 'text-nexo-muted'}`}>
          <Bold className="w-4 h-4" />
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-nexo-bg transition-colors ${editor.isActive('italic') ? 'text-nexo-primary' : 'text-nexo-muted'}`}>
          <Italic className="w-4 h-4" />
        </button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-nexo-bg transition-colors ${editor.isActive('underline') ? 'text-nexo-primary' : 'text-nexo-muted'}`}>
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-nexo-border mx-1" />
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded hover:bg-nexo-bg transition-colors ${editor.isActive('bulletList') ? 'text-nexo-primary' : 'text-nexo-muted'}`}>
          <List className="w-4 h-4" />
        </button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded hover:bg-nexo-bg transition-colors ${editor.isActive('orderedList') ? 'text-nexo-primary' : 'text-nexo-muted'}`}>
          <ListOrdered className="w-4 h-4" />
        </button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`p-1.5 rounded hover:bg-nexo-bg transition-colors ${editor.isActive('blockquote') ? 'text-nexo-primary' : 'text-nexo-muted'}`}>
          <Quote className="w-4 h-4" />
        </button>
        <button onClick={() => editor.chain().focus().toggleCode().run()} className={`p-1.5 rounded hover:bg-nexo-bg transition-colors ${editor.isActive('code') ? 'text-nexo-primary' : 'text-nexo-muted'}`}>
          <Code className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded hover:bg-nexo-bg text-nexo-muted transition-colors">
          <Paperclip className="w-4 h-4" />
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
        {/* Preview da assinatura */}
        <div className="px-4 pb-4 opacity-60" dangerouslySetInnerHTML={{ __html: NEXO_SIGNATURE }} />
      </div>

      {/* Anexos */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-nexo-border/50 flex flex-wrap gap-2">
          {attachments.map((file, idx) => (
            <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-nexo-bg border border-nexo-border text-xs">
              <Paperclip className="w-3 h-3 text-nexo-muted" />
              <span className="text-nexo-text">{file.name}</span>
              <button onClick={() => removeAttachment(idx)} className="text-nexo-muted hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sugestões da Luna */}
      {lunaSuggestions && (
        <div className="px-4 py-3 border-t border-nexo-border/50 bg-nexo-primary/5">
          <p className="text-xs font-medium text-nexo-primary mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Sugestões da Luna:
          </p>
          <div className="space-y-2">
            {lunaSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => applyLunaSuggestion(s.text)}
                className="w-full text-left px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border hover:border-nexo-primary/30 text-xs text-nexo-text transition-colors"
              >
                <span className="text-[10px] text-nexo-muted uppercase font-bold">{s.tone}</span>
                <p className="mt-1 line-clamp-2">{s.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t border-nexo-border">
        <div className="flex items-center gap-2">
          {replyTo && (
            <button
              onClick={askLuna}
              disabled={lunaLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-nexo-primary/10 border border-nexo-primary/20 text-xs text-nexo-primary hover:bg-nexo-primary/20 transition-colors disabled:opacity-50"
            >
              {lunaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Luna ✨
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-nexo-muted hover:text-nexo-text hover:bg-nexo-bg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={!to || !subject || sending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexo-primary hover:opacity-90 text-white text-sm font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
