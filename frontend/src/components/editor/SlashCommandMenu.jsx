import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Quote, Code, Minus
} from 'lucide-react'

/**
 * SlashCommandMenu - Menu flutuante de comandos ao digitar "/"
 *
 * Comandos: heading, list, check, quote, code, divider
 * Navegacao com setas + Enter
 * Escape para fechar
 * Posicionado proximo ao cursor
 *
 * Props:
 *  query {string} - Texto depois do "/"
 *  onSelect {function} - Callback ao selecionar comando
 *  onClose {function} - Callback ao fechar
 */

const COMMANDS = [
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Titulo grande',
    icon: Heading1,
    keywords: ['h1', 'titulo', 'heading'],
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Subtitulo',
    icon: Heading2,
    keywords: ['h2', 'subtitulo'],
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Sub-subtitulo',
    icon: Heading3,
    keywords: ['h3'],
  },
  {
    id: 'bulletList',
    label: 'Bullet List',
    description: 'Lista com marcadores',
    icon: List,
    keywords: ['list', 'bullet', 'lista', 'pontos'],
  },
  {
    id: 'orderedList',
    label: 'Numbered List',
    description: 'Lista numerada',
    icon: ListOrdered,
    keywords: ['numbered', 'ordered', 'numero', 'ordenada'],
  },
  {
    id: 'taskList',
    label: 'Checklist',
    description: 'Lista com checkboxes',
    icon: CheckSquare,
    keywords: ['check', 'checklist', 'task', 'todo'],
  },
  {
    id: 'blockquote',
    label: 'Quote',
    description: 'Bloco de citacao',
    icon: Quote,
    keywords: ['quote', 'citacao', 'blockquote'],
  },
  {
    id: 'codeBlock',
    label: 'Code Block',
    description: 'Bloco de codigo',
    icon: Code,
    keywords: ['code', 'codigo'],
  },
  {
    id: 'horizontalRule',
    label: 'Divider',
    description: 'Linha divisoria',
    icon: Minus,
    keywords: ['divider', 'hr', 'horizontal', 'rule', 'linha'],
  },
]

export default function SlashCommandMenu({ query, onSelect, onClose }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef(null)
  const itemRefs = useRef([])

  // Filter commands based on query
  const filteredCommands = query
    ? COMMANDS.filter(cmd => {
        const q = query.toLowerCase()
        return (
          cmd.id.toLowerCase().includes(q) ||
          cmd.label.toLowerCase().includes(q) ||
          cmd.keywords.some(k => k.toLowerCase().includes(q))
        )
      })
    : COMMANDS

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (filteredCommands.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex].id)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        default:
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredCommands, selectedIndex, onSelect, onClose])

  // Scroll selected into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex]
    if (el && listRef.current) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  if (filteredCommands.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="w-64 bg-nexo-card border border-nexo-border rounded-xl shadow-xl shadow-black/20 p-3"
      >
        <p className="text-xs text-nexo-muted text-center">Nenhum comando encontrado</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className="w-72 bg-nexo-card border border-nexo-border rounded-xl shadow-xl shadow-black/20 overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-nexo-border/50">
        <p className="text-[10px] font-medium text-nexo-muted uppercase tracking-wider">
          Comandos Basicos
        </p>
      </div>

      {/* Commands list */}
      <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
        {filteredCommands.map((cmd, index) => {
          const Icon = cmd.icon
          const isSelected = index === selectedIndex

          return (
            <button
              key={cmd.id}
              ref={el => { itemRefs.current[index] = el }}
              onClick={() => onSelect(cmd.id)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'bg-nexo-primary/10 text-nexo-text'
                  : 'text-nexo-text hover:bg-nexo-bg'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected ? 'bg-nexo-primary/20' : 'bg-nexo-bg'
              }`}>
                <Icon className={`w-4 h-4 ${isSelected ? 'text-nexo-primary' : 'text-nexo-muted'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${isSelected ? 'text-nexo-primary' : 'text-nexo-text'}`}>
                  {cmd.label}
                </p>
                <p className="text-[10px] text-nexo-muted truncate">
                  {cmd.description}
                </p>
              </div>
              {isSelected && (
                <span className="text-[10px] text-nexo-muted flex-shrink-0">
                  Enter
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-nexo-border/50 bg-nexo-bg/30">
        <p className="text-[9px] text-nexo-muted">
          Use <kbd className="px-1 py-0.5 bg-nexo-card rounded text-nexo-muted border border-nexo-border">↑</kbd>
          {' '}<kbd className="px-1 py-0.5 bg-nexo-card rounded text-nexo-muted border border-nexo-border">↓</kbd> para navegar
          {' '}<kbd className="px-1 py-0.5 bg-nexo-card rounded text-nexo-muted border border-nexo-border">Enter</kbd> para selecionar
        </p>
      </div>
    </motion.div>
  )
}
