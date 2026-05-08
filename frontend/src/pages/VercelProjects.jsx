import { useState } from 'react'
import { Triangle, ExternalLink, Globe, RefreshCw } from 'lucide-react'
import axios from 'axios'
import useRealtime from '../hooks/useRealtime'

const mockProjects = [
  { name: 'cliente-pearl', url: 'https://cliente-pearl.vercel.app', status: 'online', lastDeploy: '2h atrás' },
  { name: 'kiosk-swart-delta', url: 'https://kiosk-swart-delta.vercel.app', status: 'online', lastDeploy: '1d atrás' },
  { name: 'admin-ten-vert', url: 'https://admin-ten-vert-54.vercel.app', status: 'online', lastDeploy: '3d atrás' },
  { name: 'kds-one', url: 'https://kds-one.vercel.app', status: 'online', lastDeploy: '5d atrás' },
]

export default function VercelProjects() {
  const [refreshing, setRefreshing] = useState(false)
  const { data: vercelData, refetch } = useRealtime('/api/vercel-projects', 60000)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await axios.post('/api/external/refresh', { service: 'vercel' })
      await refetch()
    } catch (e) {
      console.error('Refresh failed:', e)
    } finally {
      setRefreshing(false)
    }
  }

  const projects = vercelData?.projects || mockProjects

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Vercel Projects</h1>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Atualizando...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map(project => (
          <div key={project.name} className="glass-card p-4 hover:border-nexo-info/30 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Triangle size={18} className="text-white" />
                <span className="font-medium text-sm">{project.name}</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${
                project.status === 'online' ? 'bg-nexo-success' : 'bg-nexo-danger'
              }`} />
            </div>
            <div className="flex items-center gap-2 text-xs text-nexo-muted mt-2">
              <Globe size={12} />
              <a href={project.url} target="_blank" rel="noopener noreferrer" className="hover:text-nexo-info truncate">
                {project.url}
              </a>
              <ExternalLink size={12} />
            </div>
            <div className="text-xs text-nexo-muted mt-2">Último deploy: {project.lastDeploy}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

