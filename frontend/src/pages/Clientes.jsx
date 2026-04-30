import { motion } from 'framer-motion'
import { Folder, FolderOpen, FileText, Code, Image, MessageSquare, BarChart3 } from 'lucide-react'
import useRealtime from '../hooks/useRealtime'

const folderIcons = {
  CODIGO: Code,
  DEMOS: Image,
  ENTREGAS: FileText,
  PROMPTS: MessageSquare,
  RELATORIOS: BarChart3
}

export default function Clientes() {
  const { data } = useRealtime('/api/state', 30000)
  const clients = data?.clients || []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Clientes</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {clients.map((client, i) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold font-heading">{client.name}</h2>
                <div className="text-xs text-nexo-muted mt-1">{client.path}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold" style={{
                  color: client.health > 70 ? '#2ed573' : client.health > 40 ? '#ffa502' : '#ff4757'
                }}>
                  {client.health}%
                </div>
                <div className="text-xs text-nexo-muted">Health Score</div>
              </div>
            </div>

            <div className="w-full h-2 bg-nexo-card rounded-full overflow-hidden mb-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${client.health}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full rounded-full"
                style={{
                  backgroundColor: client.health > 70 ? '#2ed573' : client.health > 40 ? '#ffa502' : '#ff4757'
                }}
              />
            </div>

            <div className="grid grid-cols-5 gap-2">
              {Object.entries(client.folders).map(([name, exists]) => {
                const Icon = folderIcons[name] || Folder
                return (
                  <div key={name} className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                    exists ? 'bg-nexo-success/10' : 'bg-nexo-card'
                  }`}>
                    {exists ? <FolderOpen size={18} className="text-nexo-success" /> : <Folder size={18} className="text-nexo-muted" />}
                    <span className={`text-[10px] ${exists ? 'text-nexo-success' : 'text-nexo-muted'}`}>{name}</span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        ))}
        {clients.length === 0 && (
          <div className="glass-card p-8 text-center text-nexo-muted col-span-2">
            Nenhum cliente encontrado em {data?.timestamp ? '' : 'C:\\Users\\Administrator\\Documents\\NEXO DIGITAL\\CLIENTES'}
          </div>
        )}
      </div>
    </div>
  )
}
