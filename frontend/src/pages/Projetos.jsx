import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, ArrowUpDown, Rocket } from 'lucide-react'
import useRealtime from '../hooks/useRealtime'

export default function Projetos() {
  const { data } = useRealtime('/api/state', 30000)
  const clients = data?.clients || []
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('health')

  const filtered = clients
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'health' ? b.health - a.health : a.name.localeCompare(b.name))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Projetos</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-nexo-card rounded-lg">
            <Search size={14} className="text-nexo-muted" />
            <input
              className="bg-transparent outline-none text-sm w-40"
              placeholder="Buscar projeto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setSortBy(sortBy === 'health' ? 'name' : 'health')}
            className="p-2 bg-nexo-card rounded-lg hover:bg-nexo-border transition-colors"
          >
            <ArrowUpDown size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client, i) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5 hover:border-nexo-info/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-nexo-info/20 flex items-center justify-center">
                <Rocket size={20} className="text-nexo-info" />
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                client.health > 70 ? 'bg-nexo-success/20 text-nexo-success' :
                client.health > 40 ? 'bg-nexo-warning/20 text-nexo-warning' :
                'bg-nexo-danger/20 text-nexo-danger'
              }`}>
                {client.health > 70 ? 'Saudável' : client.health > 40 ? 'Atenção' : 'Crítico'}
              </span>
            </div>
            <h3 className="font-bold font-heading mb-1">{client.name}</h3>
            <div className="w-full h-1.5 bg-nexo-card rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${client.health}%`,
                  backgroundColor: client.health > 70 ? '#2ed573' : client.health > 40 ? '#ffa502' : '#ff4757'
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-nexo-muted">
              <span>Health: {client.health}%</span>
              <span>{Object.values(client.folders).filter(Boolean).length}/5 pastas</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

