/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaMarkdown — Syntax Core HUD
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Renderizador de markdown com identidade visual sci-fi única.
 * Não é markdown comum. É o núcleo de sintaxe da Luna.
 *
 * Features:
 *   • Blocos de código estilo terminal HUD (3 dots + syntax highlight)
 *   • Tabelas estilo painel de dados (header gradiente cyan/purple)
 *   • Listas com bullets sci-fi (◆ ▸ ●)
 *   • Blockquotes com barra glow cyan
 *   • Links com efeito hover "scan"
 *   • Negrito em cor cyan com glow sutil
 */

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'

/* ── Code Block: Terminal HUD ── */
function CodeBlock({ children, className, inline }) {
  const ref = useRef(null)
  const match = /language-(\w+)/.exec(className || '')
  const lang = match ? match[1] : ''

  useEffect(() => {
    if (ref.current && !inline) {
      ref.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block)
      })
    }
  }, [children, inline])

  if (inline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded text-xs font-mono"
        style={{
          background: 'rgba(0,240,255,0.08)',
          border: '1px solid rgba(0,240,255,0.15)',
          color: '#00f0ff',
        }}
      >
        {children}
      </code>
    )
  }

  return (
    <div
      className="my-3 rounded-lg overflow-hidden"
      style={{
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(0,240,255,0.12)',
      }}
    >
      {/* Terminal header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          background: 'linear-gradient(90deg, rgba(0,240,255,0.05) 0%, rgba(155,89,182,0.03) 100%)',
          borderBottom: '1px solid rgba(0,240,255,0.08)',
        }}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        {lang && (
          <span className="ml-2 text-[10px] font-mono text-cyan-400/50 uppercase tracking-wider">
            {lang}
          </span>
        )}
      </div>
      {/* Code content */}
      <div ref={ref} className="overflow-x-auto">
        <pre className="p-3 m-0">
          <code className={className || 'text-xs font-mono'} style={{ background: 'transparent' }}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  )
}

/* ── Table: Data Panel ── */
function Table({ children }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg" style={{ border: '1px solid rgba(0,240,255,0.1)' }}>
      <table className="w-full text-xs font-mono">
        {children}
      </table>
    </div>
  )
}

function TableHead({ children }) {
  return (
    <thead
      style={{
        background: 'linear-gradient(90deg, rgba(0,240,255,0.1) 0%, rgba(155,89,182,0.08) 100%)',
      }}
    >
      {children}
    </thead>
  )
}

function TableRow({ children }) {
  return (
    <tr style={{ borderBottom: '1px solid rgba(0,240,255,0.05)' }}>
      {children}
    </tr>
  )
}

function TableCell({ children }) {
  return (
    <td className="px-3 py-2 text-nexo-text/80">
      {children}
    </td>
  )
}

function TableHeader({ children }) {
  return (
    <th className="px-3 py-2 text-left text-cyan-400/80 font-semibold uppercase tracking-wider text-[10px]">
      {children}
    </th>
  )
}

/* ── List: Sci-fi Bullets ── */
function Ul({ children }) {
  return (
    <ul className="my-2 space-y-1 list-none pl-0">
      {children}
    </ul>
  )
}

function Ol({ children }) {
  return (
    <ol className="my-2 space-y-1 list-none pl-0 counter-reset-luna">
      {children}
    </ol>
  )
}

function Li({ children, ordered, index }) {
  if (ordered) {
    return (
      <li className="flex items-start gap-2 text-sm">
        <span className="text-cyan-400/70 font-mono text-xs mt-0.5 min-w-[1.5rem]">
          {String(index + 1).padStart(2, '0')}.
        </span>
        <span>{children}</span>
      </li>
    )
  }
  // Nested level detection via parent context is hard in ReactMarkdown,
  // so we use a simple approach: inspect children for nested lists
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className="text-cyan-400/50 mt-1.5 flex-shrink-0">
        ◆
      </span>
      <span>{children}</span>
    </li>
  )
}

/* ── Blockquote: Glow Bar ── */
function Blockquote({ children }) {
  return (
    <blockquote
      className="my-3 pl-4 py-2 pr-3 rounded-r-lg"
      style={{
        borderLeft: '2px solid rgba(0,240,255,0.4)',
        background: 'linear-gradient(90deg, rgba(0,240,255,0.04) 0%, transparent 100%)',
      }}
    >
      {children}
    </blockquote>
  )
}

/* ── Link: Scan Hover Effect ── */
function A({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="relative inline-block text-cyan-400 hover:text-cyan-300 transition-colors group"
      style={{ textDecoration: 'none' }}
    >
      {children}
      <span
        className="absolute bottom-0 left-0 w-full h-[1px] bg-cyan-400/50 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
      />
    </a>
  )
}

/* ── Paragraph ── */
function P({ children }) {
  return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
}

/* ── Bold: Cyan Glow ── */
function Strong({ children }) {
  return (
    <strong className="text-cyan-300 font-semibold" style={{ textShadow: '0 0 8px rgba(0,240,255,0.15)' }}>
      {children}
    </strong>
  )
}

/* ── Em: Subtle Italic ── */
function Em({ children }) {
  return <em className="text-nexo-text/80 italic">{children}</em>
}

/* ── H1-H3: HUD Headers ── */
function H1({ children }) {
  return (
    <h1 className="text-lg font-bold font-mono text-cyan-300 mt-4 mb-2 pb-1"
      style={{ borderBottom: '1px solid rgba(0,240,255,0.1)' }}
    >
      {children}
    </h1>
  )
}
function H2({ children }) {
  return (
    <h2 className="text-base font-semibold font-mono text-cyan-300/90 mt-3 mb-2 pb-1"
      style={{ borderBottom: '1px solid rgba(0,240,255,0.08)' }}
    >
      {children}
    </h2>
  )
}
function H3({ children }) {
  return (
    <h3 className="text-sm font-semibold font-mono text-cyan-300/80 mt-2 mb-1">
      ▸ {children}
    </h3>
  )
}

/* ── Horizontal Rule ── */
function Hr() {
  return (
    <hr className="my-3 border-t"
      style={{ borderColor: 'rgba(0,240,255,0.08)' }}
    />
  )
}

/* ── Main Component ── */
export default function LunaMarkdown({ content }) {
  if (!content) return null

  return (
    <div className="luna-markdown">
      <ReactMarkdown
        components={{
          code: CodeBlock,
          table: Table,
          thead: TableHead,
          tr: TableRow,
          td: TableCell,
          th: TableHeader,
          ul: Ul,
          ol: Ol,
          li: Li,
          blockquote: Blockquote,
          a: A,
          p: P,
          strong: Strong,
          em: Em,
          h1: H1,
          h2: H2,
          h3: H3,
          hr: Hr,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
