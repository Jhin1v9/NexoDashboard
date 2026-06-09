import { useState, useEffect } from 'react'
import { Plus, X, DollarSign, Calendar, Github, Globe, Loader2 } from 'lucide-react'

export default function CreateRoadmapModal({ templates, onCreate, children }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // Step 1: Básico
  const [title, setTitle] = useState('')
  const [projectType, setProjectType] = useState('website')
  const [clientId, setClientId] = useState('')
  const [leadId, setLeadId] = useState('')
  const [clients, setClients] = useState([])
  const [leads, setLeads] = useState([])

  // Step 2: Valor & Config
  const [totalValue, setTotalValue] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [startDate, setStartDate] = useState('')
  const [githubRepo, setGithubRepo] = useState('')
  const [subdomain, setSubdomain] = useState('')

  // Step 3: Perguntas adaptáveis
  const [answers, setAnswers] = useState({})

  const selectedTemplate = templates.find(t => t.project_type === projectType)
  const questions = selectedTemplate?.onboarding_questions || []

  useEffect(() => {
    if (!open) return
    // Buscar clientes e leads
    fetch('/api/workspace/clients', { headers: { 'Authorization': `Bearer ${localStorage.getItem('nexo_token') || ''}` } })
      .then(r => r.json())
      .then(data => setClients(data.clientes || []))
      .catch(() => setClients([]))

    fetch('/api/leads', { headers: { 'Authorization': `Bearer ${localStorage.getItem('nexo_token') || ''}` } })
      .then(r => r.json())
      .then(data => setLeads(data.leads || []))
      .catch(() => setLeads([]))

    setStartDate(new Date().toISOString().split('T')[0])
  }, [open])

  useEffect(() => {
    // Reset answers when project type changes
    const defaults = {}
    questions.forEach(q => { defaults[q.id] = q.default })
    setAnswers(defaults)
  }, [projectType, templates])

  const reset = () => {
    setStep(1)
    setTitle('')
    setProjectType('website')
    setClientId('')
    setLeadId('')
    setTotalValue('')
    setCurrency('EUR')
    setStartDate('')
    setGithubRepo('')
    setSubdomain('')
    setAnswers({})
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      await onCreate({
        title: title.trim(),
        client_id: clientId || null,
        lead_id: leadId || null,
        project_type: projectType,
        total_value: parseFloat(totalValue) || 0,
        currency,
        start_date: startDate,
        github_repo: githubRepo || null,
        subdomain: subdomain || null,
        onboarding_answers: answers
      })
      reset()
      setOpen(false)
    } catch (err) {
      console.error('Error creating roadmap:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return children ? (
      <div onClick={() => setOpen(true)} className="cursor-pointer inline-block">
        {children}
      </div>
    ) : null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 px-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="w-5 h-5 text-nexo-info" />
            Novo Projeto
          </h2>
          <button onClick={() => { reset(); setOpen(false); }} className="text-nexo-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                s === step ? 'bg-nexo-info text-white' : s < step ? 'bg-nexo-success/20 text-nexo-success' : 'bg-nexo-card text-nexo-muted'
              }`}>
                {s < step ? '✓' : s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-nexo-success/30' : 'bg-nexo-border'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Básico */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Título do Projeto *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Site Institucional Empresa XYZ"
                className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-info transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Tipo de Projeto</label>
              <div className="grid grid-cols-3 gap-2">
                {templates.map(t => (
                  <button
                    key={t.project_type}
                    onClick={() => setProjectType(t.project_type)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      projectType === t.project_type
                        ? 'border-nexo-info bg-nexo-info/5 text-nexo-info'
                        : 'border-nexo-border hover:border-nexo-muted/30'
                    }`}
                  >
                    <div className="text-lg mb-0.5">{t.icon}</div>
                    <div className="text-[10px] font-medium">{t.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Cliente</label>
                <select
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text focus:outline-none focus:border-nexo-info"
                >
                  <option value="">Sem cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Lead</label>
                <select
                  value={leadId}
                  onChange={e => setLeadId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text focus:outline-none focus:border-nexo-info"
                >
                  <option value="">Sem lead</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.display_name || l.name || l.email}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Valor & Config */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Valor do Contrato
                </label>
                <input
                  type="number"
                  value={totalValue}
                  onChange={e => setTotalValue(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-info transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Moeda</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text focus:outline-none focus:border-nexo-info"
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="BRL">BRL (R$)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Data de Início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text focus:outline-none focus:border-nexo-info transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1">
                <Github className="w-3 h-3" />
                Repositório GitHub
              </label>
              <input
                type="url"
                value={githubRepo}
                onChange={e => setGithubRepo(e.target.value)}
                placeholder="https://github.com/nexo/site-xyz"
                className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-info transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Subdomínio de Staging
              </label>
              <input
                type="text"
                value={subdomain}
                onChange={e => setSubdomain(e.target.value)}
                placeholder="cliente.nexo.digital"
                className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-info transition-colors"
              />
            </div>
          </div>
        )}

        {/* Step 3: Perguntas adaptáveis */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs text-nexo-muted">Responda algumas perguntas para personalizar o roadmap:</p>
            {questions.length === 0 && (
              <p className="text-xs text-nexo-muted">Nenhuma pergunta adicional para este tipo de projeto.</p>
            )}
            {questions.map(q => (
              <div key={q.id} className="space-y-1.5">
                <label className="text-xs font-medium">{q.label}</label>
                {q.type === 'boolean' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: true }))}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs border transition-colors ${
                        answers[q.id] === true
                          ? 'bg-nexo-info/10 text-nexo-info border-nexo-info/30'
                          : 'bg-nexo-card text-nexo-muted border-nexo-border'
                      }`}
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: false }))}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs border transition-colors ${
                        answers[q.id] === false
                          ? 'bg-nexo-danger/10 text-nexo-danger border-nexo-danger/30'
                          : 'bg-nexo-card text-nexo-muted border-nexo-border'
                      }`}
                    >
                      Não
                    </button>
                  </div>
                )}
                {q.type === 'number' && (
                  <input
                    type="number"
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text focus:outline-none focus:border-nexo-info transition-colors"
                  />
                )}
                {q.type === 'text' && (
                  <input
                    type="text"
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text focus:outline-none focus:border-nexo-info transition-colors"
                  />
                )}
                {q.type === 'select' && (
                  <select
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text focus:outline-none focus:border-nexo-info"
                  >
                    {(q.options || []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-nexo-border">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-lg border border-nexo-border text-xs text-nexo-muted hover:text-white hover:bg-nexo-card transition-colors"
            >
              Voltar
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !title.trim()}
              className="px-4 py-2 rounded-lg bg-nexo-info/10 text-nexo-info border border-nexo-info/30 text-xs hover:bg-nexo-info/20 transition-colors disabled:opacity-40"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-nexo-info text-white text-xs hover:bg-nexo-info/90 transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              Criar Projeto
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
