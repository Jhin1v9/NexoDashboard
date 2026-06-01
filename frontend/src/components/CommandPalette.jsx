import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, LayoutDashboard, Users, Rocket, CheckSquare, Github, Triangle, Wrench, FileText, DollarSign } from 'lucide-react'

const commands = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Clientes', path: '/clientes', icon: Users },
  { label: 'Projetos', path: '/projetos', icon: Rocket },
  { label: 'Tarefas', path: '/tarefas', icon: CheckSquare },
  { label: 'Relatórios', path: '/relatorios', icon: FileText },
  { label: 'GitHub', path: '/github', icon: Github },
  { label: 'Vercel', path: '/vercel', icon: Triangle },
  { label: 'Ferramentas', path: '/ferramentas', icon: Wrench },
]

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        open ? onClose() : null // toggle handled by parent
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg glass-card overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-nexo-border">
          <Search size={18} className="text-nexo-muted" />
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm"
            placeholder="Buscar página ou ação..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="px-2 py-0.5 bg-nexo-card rounded text-xs text-nexo-muted">ESC</kbd>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.map(cmd => (
            <button
              key={cmd.path}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-nexo-card transition-colors text-left"
              onClick={() => { navigate(cmd.path); onClose(); setQuery('') }}
            >
              <cmd.icon size={16} className="text-nexo-muted" />
              <span className="text-sm">{cmd.label}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-nexo-muted text-sm">Nenhum resultado</div>
          )}
        </div>
      </div>
    </div>
  )
}

