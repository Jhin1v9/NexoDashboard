import { useState, cloneElement } from 'react'
import { Plus, Zap, FileText, Users } from 'lucide-react'

const TOOL_OPTIONS = [
  { value: 'dashboardCreateTask', label: 'Criar Tarefa' },
  { value: 'dashboardUpdateTask', label: 'Atualizar Tarefa' },
  { value: 'dashboardDeleteTask', label: 'Deletar Tarefa' },
]

const QUORUM_OPTIONS = [
  { value: 2, label: '2 votos (Ações criativas)' },
  { value: 3, label: '3 votos (Padrão — todas as CEOs)' },
]

export default function VotingCreateModal({ onCreate, children }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('generic')
  const [toolName, setToolName] = useState('dashboardCreateTask')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [quorumRequired, setQuorumRequired] = useState(3)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setTitle('')
    setDescription('')
    setType('generic')
    setToolName('dashboardCreateTask')
    setTaskTitle('')
    setTaskPriority('medium')
    setQuorumRequired(3)
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const data = { title: title.trim(), description: description.trim(), type, quorumRequired }
      if (type === 'tool_action') {
        data.toolName = toolName
        data.toolParams = { title: taskTitle || title, priority: taskPriority }
      }
      await onCreate(data)
      reset()
      setOpen(false)
    } catch (err) {
      console.error('Error creating session:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {children ? (
        <div onClick={() => setOpen(true)} className="cursor-pointer inline-block">
          {children}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nova Votação
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-nexo-info" />
                Nova Sessão de Votação
              </h2>
              <button onClick={() => setOpen(false)} className="text-nexo-muted hover:text-white transition-colors text-xl">&times;</button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Votação</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType('generic')}
                  className={`flex-1 flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                    type === 'generic'
                      ? 'border-nexo-info bg-nexo-info/5 text-nexo-info'
                      : 'border-nexo-border hover:border-nexo-muted/30'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Genérica</div>
                    <div className="text-xs text-nexo-muted">Aprovação manual</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setType('tool_action')}
                  className={`flex-1 flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                    type === 'tool_action'
                      ? 'border-nexo-info bg-nexo-info/5 text-nexo-info'
                      : 'border-nexo-border hover:border-nexo-muted/30'
                  }`}
                >
                  <Zap className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Ação Automática</div>
                    <div className="text-xs text-nexo-muted">Executa tool se aprovada</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setType('review')}
                  className={`flex-1 flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                    type === 'review'
                      ? 'border-nexo-info bg-nexo-info/5 text-nexo-info'
                      : 'border-nexo-border hover:border-nexo-muted/30'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="text-sm font-medium">Revisão</div>
                    <div className="text-xs text-nexo-muted">Revisão de roadmap</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Título *</label>
              <input
                type="text"
                placeholder="Ex: Criar tarefa: Revisar contrato cliente XYZ"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-info transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <textarea
                placeholder="Detalhes da proposta..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-info transition-colors resize-none"
              />
            </div>

            {type === 'tool_action' && (
              <div className="space-y-3 p-3 bg-nexo-card/50 rounded-lg border border-nexo-border">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="w-4 h-4 text-purple-400" />
                  Configuração da Ação
                </div>

                <div className="space-y-2">
                  <label className="text-sm">Tool</label>
                  <select
                    value={toolName}
                    onChange={e => setToolName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-nexo-text focus:outline-none focus:border-nexo-info"
                  >
                    {TOOL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm">Título da Tarefa</label>
                  <input
                    type="text"
                    placeholder="Título para a tarefa que será criada"
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-info"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm">Prioridade</label>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high']).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTaskPriority(p)}
                        className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                          taskPriority === p
                            ? p === 'high' ? 'bg-nexo-danger/10 text-nexo-danger border border-nexo-danger/30'
                              : p === 'medium' ? 'bg-nexo-warning/10 text-nexo-warning border border-nexo-warning/30'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-nexo-card border border-transparent text-nexo-muted'
                        }`}
                      >
                        {p === 'high' ? 'Alta' : p === 'medium' ? 'Média' : 'Baixa'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Quórum Necessário
              </label>
              <select
                value={String(quorumRequired)}
                onChange={e => setQuorumRequired(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-nexo-text focus:outline-none focus:border-nexo-info"
              >
                {QUORUM_OPTIONS.map(opt => (
                  <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg border border-nexo-border text-nexo-muted hover:text-white hover:bg-nexo-card transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || submitting}
                className="flex-1 btn-primary flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Criar Votação
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
