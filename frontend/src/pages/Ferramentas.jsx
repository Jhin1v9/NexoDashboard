import { useState, useEffect } from 'react'
import { Wrench, Check, X, Terminal } from 'lucide-react'
import axios from 'axios'

export default function Ferramentas() {
  const [tools, setTools] = useState([])
  const [loading, setLoading] = useState(true)
  const [cmdOutput, setCmdOutput] = useState('')

  useEffect(() => {
    fetchTools()
  }, [])

  const fetchTools = async () => {
    try {
      const res = await axios.get('/api/tools')
      setTools(res.data)
    } catch {}
    setLoading(false)
  }

  const runCmd = async (cmd) => {
    try {
      const res = await axios.post('/api/run', { cmd })
      setCmdOutput(res.data.output)
    } catch (e) {
      setCmdOutput(e.response?.data?.error || 'Erro ao executar comando')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Ferramentas</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center text-nexo-muted py-8">Carregando...</div>
        ) : (
          tools.map(tool => (
            <div key={tool.name} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{tool.name}</span>
                {tool.ok ? (
                  <Check size={16} className="text-nexo-success" />
                ) : (
                  <X size={16} className="text-nexo-danger" />
                )}
              </div>
              <div className="text-xs text-nexo-muted">
                {tool.version || 'Não instalado'}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Terminal size={16} /> Terminal
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {['node --version', 'npm --version', 'git status', 'git log --oneline -5'].map(cmd => (
            <button
              key={cmd}
              onClick={() => runCmd(cmd)}
              className="px-3 py-1.5 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors"
            >
              {cmd}
            </button>
          ))}
        </div>
        {cmdOutput && (
          <pre className="bg-nexo-bg p-3 rounded-lg text-xs text-nexo-muted overflow-x-auto whitespace-pre-wrap">
            {cmdOutput}
          </pre>
        )}
      </div>
    </div>
  )
}

