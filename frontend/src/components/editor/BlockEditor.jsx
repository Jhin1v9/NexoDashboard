import { useEffect, useState, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  CheckSquare, Quote, Code, Minus, Undo, Redo
} from 'lucide-react'
import SlashCommandMenu from './SlashCommandMenu'

/**
 * BlockEditor - TipTap Headless Editor
 *
 * Block-based editor com:
 * - StarterKit (bold, italic, heading, lists, blockquote, codeBlock, hr)
 * - TaskList/TaskItem (checklist)
 * - Placeholder
 * - Toolbar fixo
 * - Slash commands (/heading, /list, etc.)
 * - Export JSON e HTML
 *
 * Props:
 *  content {string|object} - Conteudo inicial (JSON ou texto)
 *  onChange {function} - Callback com { json, html } ao mudar
 *  readOnly {boolean} - Modo leitura
 */
export default function BlockEditor({ content, onChange, readOnly = false }) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashCoords, setSlashCoords] = useState({ top: 0, left: 0 })
  const slashMenuRef = useRef(null)
  const containerRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
        codeBlock: {},
        blockquote: {},
        horizontalRule: {},
        bold: {},
        italic: {},
        strike: {},
        code: {},
      }),
      TaskList.configure({
        HTMLAttributes: { class: 'not-prose pl-0' },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: 'flex items-start gap-2' },
      }),
      Placeholder.configure({
        placeholder: 'Digite "/" para comandos...',
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
    ],
    content: parseInitialContent(content),
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (!onChange) return
      const json = editor.getJSON()
      const html = editor.getHTML()
      onChange({ json, html })

      // Check for slash command
      checkSlashCommand(editor)
    },
    onTransaction: ({ editor: ed }) => {
      // Update on every transaction for UI state
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-4',
      },
      handleKeyDown: (view, event) => {
        if (event.key === '/' && !slashMenuOpen && !readOnly) {
          const { from } = view.state.selection
          const coords = view.coordsAtPos(from)
          const containerRect = containerRef.current?.getBoundingClientRect()
          if (containerRect) {
            setSlashCoords({
              top: coords.top - containerRect.top + 24,
              left: coords.left - containerRect.left,
            })
          }
          setSlashQuery('')
          setSlashMenuOpen(true)
        }
        if (slashMenuOpen) {
          if (event.key === 'Escape') {
            setSlashMenuOpen(false)
            return true
          }
        }
        return false
      },
    },
  })

  // Check slash command context
  const checkSlashCommand = useCallback((editorInstance) => {
    if (!editorInstance) return
    const { selection } = editorInstance.state
    const { $from } = selection
    const textBefore = $from.parent.textBetween(
      Math.max(0, $from.parentOffset - 20),
      $from.parentOffset,
      null,
      '\ufffc'
    )

    const match = textBefore.match(/\/([a-zA-Z]*)$/)
    if (match) {
      setSlashQuery(match[1].toLowerCase())
      setSlashMenuOpen(true)
    } else {
      setSlashMenuOpen(false)
      setSlashQuery('')
    }
  }, [])

  // Sync external content changes
  useEffect(() => {
    if (!editor || !content) return
    if (editor.isDestroyed) return

    const currentJSON = editor.getJSON()
    const newContent = parseInitialContent(content)

    // Only update if different (avoid loops)
    if (JSON.stringify(currentJSON) !== JSON.stringify(newContent)) {
      editor.commands.setContent(newContent, false)
    }
  }, [content, editor])

  // Close slash menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setSlashMenuOpen(false)
      }
    }
    if (slashMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [slashMenuOpen])

  // Toolbar button state
  const isActive = (type, attrs = {}) => {
    if (!editor) return false
    return editor.isActive(type, attrs)
  }

  const toolbarButtons = [
    { icon: Bold, action: () => editor?.chain().focus().toggleBold().run(), active: 'bold', title: 'Negrito (Ctrl+B)' },
    { icon: Italic, action: () => editor?.chain().focus().toggleItalic().run(), active: 'italic', title: 'Italico (Ctrl+I)' },
    null, // separator
    { icon: Heading1, action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), active: 'heading', attrs: { level: 1 }, title: 'Heading 1' },
    { icon: Heading2, action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: 'heading', attrs: { level: 2 }, title: 'Heading 2' },
    null,
    { icon: List, action: () => editor?.chain().focus().toggleBulletList().run(), active: 'bulletList', title: 'Bullet List' },
    { icon: ListOrdered, action: () => editor?.chain().focus().toggleOrderedList().run(), active: 'orderedList', title: 'Numbered List' },
    { icon: CheckSquare, action: () => editor?.chain().focus().toggleTaskList().run(), active: 'taskList', title: 'Checklist' },
    null,
    { icon: Quote, action: () => editor?.chain().focus().toggleBlockquote().run(), active: 'blockquote', title: 'Quote' },
    { icon: Code, action: () => editor?.chain().focus().toggleCodeBlock().run(), active: 'codeBlock', title: 'Code Block' },
    { icon: Minus, action: () => editor?.chain().focus().setHorizontalRule().run(), active: null, title: 'Divider' },
    null,
    { icon: Undo, action: () => editor?.chain().focus().undo().run(), active: null, title: 'Undo', disabled: !editor?.can().undo() },
    { icon: Redo, action: () => editor?.chain().focus().redo().run(), active: null, title: 'Redo', disabled: !editor?.can().redo() },
  ]

  // Handle slash command selection
  const handleSlashSelect = (command) => {
    if (!editor) return
    // Remove the "/" text first
    const { state } = editor
    const { $from } = state.selection
    const from = $from.pos - slashQuery.length - 1
    editor.chain().focus().deleteRange({ from, to: $from.pos }).run()

    // Insert the appropriate node
    setTimeout(() => {
      switch (command) {
        case 'heading':
          editor.chain().focus().toggleHeading({ level: 2 }).run()
          break
        case 'heading1':
          editor.chain().focus().toggleHeading({ level: 1 }).run()
          break
        case 'heading2':
          editor.chain().focus().toggleHeading({ level: 2 }).run()
          break
        case 'heading3':
          editor.chain().focus().toggleHeading({ level: 3 }).run()
          break
        case 'bulletList':
          editor.chain().focus().toggleBulletList().run()
          break
        case 'orderedList':
          editor.chain().focus().toggleOrderedList().run()
          break
        case 'taskList':
          editor.chain().focus().toggleTaskList().run()
          break
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run()
          break
        case 'codeBlock':
          editor.chain().focus().toggleCodeBlock().run()
          break
        case 'horizontalRule':
          editor.chain().focus().setHorizontalRule().run()
          break
        default:
          break
      }
    }, 0)

    setSlashMenuOpen(false)
    setSlashQuery('')
  }

  if (!editor) return null

  return (
    <div
      ref={containerRef}
      className="relative glass-card border border-nexo-border/50 overflow-hidden flex flex-col"
    >
      {/* FIXED TOOLBAR */}
      {!readOnly && (
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-nexo-border bg-nexo-card/50 flex-wrap">
          {toolbarButtons.map((btn, i) => {
            if (btn === null) {
              return <div key={`sep-${i}`} className="w-px h-5 bg-nexo-border mx-1" />
            }
            const Icon = btn.icon
            const active = btn.active ? isActive(btn.active, btn.attrs || {}) : false
            return (
              <button
                key={btn.title}
                onClick={btn.action}
                disabled={btn.disabled}
                title={btn.title}
                className={`p-1.5 rounded-md transition-all ${
                  active
                    ? 'bg-nexo-primary/20 text-nexo-primary'
                    : 'text-nexo-muted hover:text-nexo-text hover:bg-nexo-bg'
                } ${btn.disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            )
          })}
        </div>
      )}

      {/* EDITOR CONTENT */}
      <div className="flex-1 bg-nexo-bg">
        <EditorContent
          editor={editor}
          className="[&_.ProseMirror]:text-nexo-text [&_.ProseMirror]:text-sm [&_.ProseMirror]:leading-relaxed
                     [&_.ProseMirror_p]:my-1.5 [&_.ProseMirror_p]:text-nexo-text
                     [&_.ProseMirror_h1]:text-lg [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:text-nexo-text [&_.ProseMirror_h1]:my-2
                     [&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-nexo-text [&_.ProseMirror_h2]:my-2
                     [&_.ProseMirror_h3]:text-sm [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-nexo-text [&_.ProseMirror_h3]:my-1.5
                     [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-nexo-primary/50 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-nexo-muted [&_.ProseMirror_blockquote]:my-2
                     [&_.ProseMirror_pre]:bg-nexo-card [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:text-xs [&_.ProseMirror_pre]:my-2 [&_.ProseMirror_pre]:border [&_.ProseMirror_pre]:border-nexo-border
                     [&_.ProseMirror_code]:bg-nexo-card [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:text-xs [&_.ProseMirror_code]:text-nexo-primary
                     [&_.ProseMirror_hr]:border-nexo-border [&_.ProseMirror_hr]:my-3
                     [&_.ProseMirror_ul]:pl-4 [&_.ProseMirror_ul]:my-1.5 [&_.ProseMirror_ul]:list-disc
                     [&_.ProseMirror_ol]:pl-4 [&_.ProseMirror_ol]:my-1.5 [&_.ProseMirror_ol]:list-decimal
                     [&_[data-type=taskList]]:list-none [&_[data-type=taskList]]:pl-0 [&_[data-type=taskList]]:my-1.5
                     [&_[data-type=taskItem]]:flex [&_[data-type=taskItem]]:items-start [&_[data-type=taskItem]]:gap-2 [&_[data-type=taskItem]]:my-0.5
                     [&_[data-type=taskItem]_>div]:flex-1
                     [&_.ProseMirror-placeholder]:text-nexo-muted/30 [&_.ProseMirror-placeholder]:before:content-[attr(data-placeholder)] [&_.ProseMirror-placeholder]:before:float-left [&_.ProseMirror-placeholder]:before:h-0 [&_.ProseMirror-placeholder]:before:pointer-events-none"
        />
      </div>

      {/* SLASH COMMAND MENU */}
      {slashMenuOpen && !readOnly && (
        <div
          ref={slashMenuRef}
          className="absolute z-50"
          style={{ top: slashCoords.top, left: slashCoords.left }}
        >
          <SlashCommandMenu
            query={slashQuery}
            onSelect={handleSlashSelect}
            onClose={() => {
              setSlashMenuOpen(false)
              setSlashQuery('')
            }}
          />
        </div>
      )}
    </div>
  )
}

// Parse initial content from various formats
function parseInitialContent(content) {
  if (!content) {
    return {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    }
  }

  // If already a TipTap JSON doc
  if (typeof content === 'object' && content.type === 'doc') {
    return content
  }

  // If it's an array of blocks (backend format)
  if (typeof content === 'object' && Array.isArray(content.blocks)) {
    return {
      type: 'doc',
      content: content.blocks.map(block => convertBlockToTiptap(block)).filter(Boolean),
    }
  }

  // If it's a plain string
  if (typeof content === 'string') {
    if (content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(content)
        if (parsed.type === 'doc') return parsed
        if (parsed.blocks) {
          return {
            type: 'doc',
            content: parsed.blocks.map(block => convertBlockToTiptap(block)).filter(Boolean),
          }
        }
      } catch {
        // Not valid JSON, treat as plain text
      }
    }
    // Split by newlines into paragraphs
    return {
      type: 'doc',
      content: content.split('\n').filter(line => line.trim()).length > 0
        ? content.split('\n').map(line => ({
            type: 'paragraph',
            content: line.trim()
              ? [{ type: 'text', text: line }]
              : undefined,
          }))
        : [{ type: 'paragraph' }],
    }
  }

  // If it's an object with body
  if (typeof content === 'object' && content.body) {
    return parseInitialContent(content.body)
  }

  return {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  }
}

// Convert backend block format to TipTap node
function convertBlockToTiptap(block) {
  switch (block.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        content: block.content
          ? [{ type: 'text', text: block.content }]
          : undefined,
      }
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: block.level || 2 },
        content: block.content
          ? [{ type: 'text', text: block.content }]
          : undefined,
      }
    case 'checklist':
      return {
        type: 'taskList',
        content: (block.items || []).map(item => ({
          type: 'taskItem',
          attrs: { checked: item.checked || false },
          content: item.text
            ? [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: item.text }],
                },
              ]
            : undefined,
        })),
      }
    case 'quote':
      return {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: block.content
              ? [{ type: 'text', text: block.content }]
              : undefined,
          },
        ],
      }
    case 'code':
      return {
        type: 'codeBlock',
        attrs: { language: block.language || 'plaintext' },
        content: block.content
          ? [{ type: 'text', text: block.content }]
          : undefined,
      }
    case 'divider':
      return { type: 'horizontalRule' }
    default:
      return {
        type: 'paragraph',
        content: block.content
          ? [{ type: 'text', text: block.content }]
          : undefined,
      }
  }
}
