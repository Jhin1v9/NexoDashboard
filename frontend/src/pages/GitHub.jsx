import { useState } from 'react'
import { Github, GitBranch, GitCommit, GitPullRequest, ExternalLink } from 'lucide-react'
import axios from 'axios'

const mockRepos = [
  { name: 'TPV-SORVETERIA-DEMO', lang: 'TypeScript', stars: 3, forks: 1, updated: '2 dias atrás' },
  { name: 'nexo-dashboard-pro', lang: 'JavaScript', stars: 1, forks: 0, updated: 'Hoje' },
]

export default function GitHub() {
  const [repos, setRepos] = useState(mockRepos)
  const [loading, setLoading] = useState(false)

  const fetchRepos = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/github-repos')
      if (res.data.repos?.length > 0) setRepos(res.data.repos)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">GitHub</h1>
        <button onClick={fetchRepos} className="text-sm text-nexo-info hover:underline">
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {repos.map(repo => (
          <div key={repo.name} className="glass-card p-4 hover:border-nexo-info/30 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Github size={18} />
                <span className="font-medium text-sm">{repo.name}</span>
              </div>
              <a href={`https://github.com/Jhin1v9/${repo.name}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} className="text-nexo-muted hover:text-white" />
              </a>
            </div>
            <div className="flex items-center gap-4 text-xs text-nexo-muted mt-3">
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-nexo-warning" />
                {repo.lang}
              </span>
              <span className="flex items-center gap-1">
                <GitBranch size={12} /> {repo.forks}
              </span>
              <span>⭐ {repo.stars}</span>
              <span>{repo.updated}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-medium mb-3">Ações Rápidas</h3>
        <div className="flex flex-wrap gap-2">
          <button className="px-3 py-2 bg-nexo-card rounded-lg text-sm hover:bg-nexo-border transition-colors flex items-center gap-2">
            <GitCommit size={14} /> Commit & Push
          </button>
          <button className="px-3 py-2 bg-nexo-card rounded-lg text-sm hover:bg-nexo-border transition-colors flex items-center gap-2">
            <GitPullRequest size={14} /> Ver PRs
          </button>
        </div>
      </div>
    </div>
  )
}

