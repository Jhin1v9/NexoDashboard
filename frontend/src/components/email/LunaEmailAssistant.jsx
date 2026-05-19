import { useState } from 'react'
import axios from 'axios'
import { Sparkles, X, Loader2, Wand2, Lightbulb, Shield, Save, CheckCircle, Plus, ListChecks } from 'lucide-react'

export default function LunaEmailAssistant({ threadMessages, onApplyDraft, onClose, emailId, threadId, subject, from }) {
  const [mode, setMode] = useState('menu') // menu | draft | summary | analyze
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [instructions, setInstructions] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftSaved, setDraftSaved] = useState(null)
  const [selectedActionItems, setSelectedActionItems] = useState(new Set())
  const [creatingTasks, setCreatingTasks] = useState(false)
  const [tasksCreated, setTasksCreated] = useState(null)

  const handleAction = async (actionType) => {
    setLoading(true)
    setMode(actionType)
    try {
      let res
      if (actionType === 'suggest') {
        res = await axios.post('/api/email/ai/suggest-reply', { threadMessages })
        setResult({ type: 'suggestions', data: res.data.suggestions })
      } else if (actionType === 'draft') {
        if (!instructions.trim()) {
          setLoading(false)
          return
        }
        res = await axios.post('/api/email/ai/draft', { threadMessages, instructions })
        setResult({ type: 'draft', data: res.data })
      } else if (actionType === 'summarize') {
        res = await axios.post('/api/email/ai/summarize', { threadMessages })
        setResult({ type: 'summary', data: res.data })
      } else if (actionType === 'analyze') {
        const lastMsg = threadMessages[threadMessages.length - 1]
        res = await axios.post('/api/email/ai/analyze', {
          emailData: { from: lastMsg.from, subject: lastMsg.subject, snippet: lastMsg.snippet }
        })
        setResult({ type: 'analysis', data: res.data })
      }
    } catch (e) {
      console.error('Erro Luna:', e)
      setResult({ type: 'error', data: { message: e.message } })
    } finally {
      setLoading(false)
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-nexo-muted">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-nexo-primary" />
          <p className="text-sm">Luna está analisando...</p>
        </div>
      )
    }

    if (mode === 'menu') {
      return (
        <div className="grid grid-cols-2 gap-3 p-4">
          <button onClick={() => handleAction('suggest')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-nexo-bg border border-nexo-border hover:border-nexo-primary/30 hover:bg-nexo-primary/5 transition-all text-nexo-text">
            <Lightbulb className="w-6 h-6 text-amber-400" />
            <span className="text-xs font-medium">Sugerir resposta</span>
          </button>
          <button onClick={() => setMode('draft-input')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-nexo-bg border border-nexo-border hover:border-nexo-primary/30 hover:bg-nexo-primary/5 transition-all text-nexo-text">
            <Wand2 className="w-6 h-6 text-nexo-primary" />
            <span className="text-xs font-medium">Criar rascunho</span>
          </button>
          <button onClick={() => handleAction('summarize')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-nexo-bg border border-nexo-border hover:border-nexo-primary/30 hover:bg-nexo-primary/5 transition-all text-nexo-text">
            <Sparkles className="w-6 h-6 text-violet-400" />
            <span className="text-xs font-medium">Resumir thread</span>
          </button>
          <button onClick={() => handleAction('analyze')} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-nexo-bg border border-nexo-border hover:border-nexo-primary/30 hover:bg-nexo-primary/5 transition-all text-nexo-text">
            <Shield className="w-6 h-6 text-emerald-400" />
            <span className="text-xs font-medium">Analisar email</span>
          </button>
        </div>
      )
    }

    if (mode === 'draft-input') {
      return (
        <div className="p-4 space-y-3">
          <p className="text-sm text-nexo-muted">Descreva o que você quer que a Luna escreva:</p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ex: Responda falando que o orçamento é de €2.500 e o prazo é 3 semanas..."
            className="w-full h-24 p-3 rounded-lg bg-nexo-bg border border-nexo-border text-sm text-nexo-text focus:outline-none focus:border-nexo-primary resize-none"
          />
          <button
            onClick={() => handleAction('draft')}
            disabled={!instructions.trim()}
            className="w-full py-2 rounded-lg bg-nexo-primary hover:opacity-90 text-white text-sm font-medium transition-opacity disabled:opacity-40"
          >
            Gerar rascunho
          </button>
        </div>
      )
    }

    if (!result) return null

    if (result.type === 'suggestions') {
      return (
        <div className="p-4 space-y-3">
          <p className="text-xs font-medium text-nexo-primary flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> Sugestões de resposta:
          </p>
          {result.data.map((s, i) => (
            <button
              key={i}
              onClick={() => { onApplyDraft?.(s.text); onClose?.() }}
              className="w-full text-left p-3 rounded-lg bg-nexo-bg border border-nexo-border hover:border-nexo-primary/30 text-xs text-nexo-text transition-colors"
            >
              <span className="text-[10px] uppercase font-bold text-nexo-muted">{s.tone}</span>
              <p className="mt-1 line-clamp-3">{s.text}</p>
            </button>
          ))}
        </div>
      )
    }

    if (result.type === 'draft') {
      return (
        <div className="p-4 space-y-3">
          <p className="text-xs font-medium text-nexo-primary flex items-center gap-1">
            <Wand2 className="w-3 h-3" /> Rascunho gerado:
          </p>
          <div className="p-3 rounded-lg bg-nexo-bg border border-nexo-border text-xs text-nexo-text whitespace-pre-wrap max-h-48 overflow-y-auto">
            {result.data.body}
          </div>
          {result.data.notes && (
            <p className="text-[10px] text-nexo-muted">📝 {result.data.notes}</p>
          )}
          {draftSaved ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400">Rascunho salvo para aprovação!</span>
              </div>
              <p className="text-[10px] text-nexo-muted">
                Uma tarefa foi criada para {draftSaved.approver || 'você'} revisar antes de enviar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => { onApplyDraft?.(result.data.body); onClose?.() }}
                className="w-full py-2 rounded-lg bg-nexo-primary hover:opacity-90 text-white text-sm font-medium transition-opacity"
              >
                Usar este rascunho
              </button>
              <button
                onClick={async () => {
                  setSavingDraft(true)
                  try {
                    const lastMsg = threadMessages[threadMessages.length - 1]
                    const res = await axios.post('/api/email/ai/draft-for-approval', {
                      threadMessages,
                      instructions,
                      emailId: emailId || lastMsg?.id,
                      threadId: threadId || lastMsg?.threadId,
                      subject: subject || lastMsg?.subject,
                      from: from || lastMsg?.from
                    })
                    if (res.data.success) {
                      setDraftSaved({
                        draftId: res.data.draft?.id,
                        taskId: res.data.task?.id,
                        approver: res.data.task?.assignedTo || 'você'
                      })
                    }
                  } catch (e) {
                    console.error('Erro ao salvar rascunho:', e)
                  } finally {
                    setSavingDraft(false)
                  }
                }}
                disabled={savingDraft}
                className="w-full py-2 rounded-lg bg-nexo-bg border border-nexo-border hover:border-nexo-primary/30 text-nexo-text text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar para aprovação
              </button>
            </div>
          )}
        </div>
      )
    }

    if (result.type === 'summary') {
      const actionItems = result.data.actionItems || []
      const toggleItem = (idx) => {
        const next = new Set(selectedActionItems)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        setSelectedActionItems(next)
      }
      const createTasks = async () => {
        if (selectedActionItems.size === 0) return
        setCreatingTasks(true)
        try {
          const items = Array.from(selectedActionItems).map((i) => actionItems[i])
          const res = await axios.post('/api/email/ai/action-items-to-tasks', {
            threadId,
            subject: subject || 'Email',
            actionItems: items
          })
          if (res.data.success) {
            setTasksCreated(res.data.tasks || [])
            setSelectedActionItems(new Set())
          }
        } catch (e) {
          console.error('Erro ao criar tarefas:', e)
        } finally {
          setCreatingTasks(false)
        }
      }
      return (
        <div className="p-4 space-y-3">
          <p className="text-xs font-medium text-nexo-primary flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Resumo da conversa:
          </p>
          <div className="space-y-1">
            {result.data.summary.map((item, i) => (
              <p key={i} className="text-xs text-nexo-text">• {item}</p>
            ))}
          </div>
          {actionItems.length > 0 && (
            <>
              <p className="text-xs font-medium text-nexo-muted mt-2 flex items-center gap-1">
                <ListChecks className="w-3 h-3" /> Action items:
              </p>
              <div className="space-y-1">
                {actionItems.map((item, i) => (
                  <label key={i} className="flex items-start gap-2 p-2 rounded-lg bg-nexo-bg border border-nexo-border hover:border-nexo-primary/30 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedActionItems.has(i)}
                      onChange={() => toggleItem(i)}
                      className="mt-0.5 w-3.5 h-3.5 accent-nexo-primary flex-shrink-0"
                    />
                    <span className="text-xs text-nexo-text">{item}</span>
                  </label>
                ))}
              </div>
              {tasksCreated ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400">{tasksCreated.length} tarefa(s) criada(s) com sucesso!</span>
                </div>
              ) : (
                <button
                  onClick={createTasks}
                  disabled={selectedActionItems.size === 0 || creatingTasks}
                  className="w-full py-2 rounded-lg bg-nexo-primary hover:opacity-90 text-white text-sm font-medium transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {creatingTasks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Criar {selectedActionItems.size > 0 ? `${selectedActionItems.size} ` : ''}tarefa(s)
                </button>
              )}
            </>
          )}
          <div className="flex gap-2 mt-2">
            <span className={`text-[10px] px-2 py-0.5 rounded ${result.data.sentiment === 'positivo' ? 'bg-green-500/20 text-green-400' : result.data.sentiment === 'negativo' ? 'bg-red-500/20 text-red-400' : 'bg-nexo-bg text-nexo-muted'}`}>
              {result.data.sentiment}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded ${result.data.priority === 'alta' || result.data.priority === 'crítica' ? 'bg-red-500/20 text-red-400' : result.data.priority === 'media' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
              {result.data.priority}
            </span>
          </div>
        </div>
      )
    }

    if (result.type === 'analysis') {
      const d = result.data
      return (
        <div className="p-4 space-y-2">
          <p className="text-xs font-medium text-nexo-primary flex items-center gap-1">
            <Shield className="w-3 h-3" /> Análise:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-nexo-bg border border-nexo-border">
              <p className="text-[10px] text-nexo-muted">Urgência</p>
              <p className="text-xs font-medium text-nexo-text">{d.urgency}</p>
            </div>
            <div className="p-2 rounded-lg bg-nexo-bg border border-nexo-border">
              <p className="text-[10px] text-nexo-muted">Intenção</p>
              <p className="text-xs font-medium text-nexo-text">{d.intention}</p>
            </div>
            <div className="p-2 rounded-lg bg-nexo-bg border border-nexo-border">
              <p className="text-[10px] text-nexo-muted">Sentimento</p>
              <p className="text-xs font-medium text-nexo-text">{d.sentiment}</p>
            </div>
            <div className="p-2 rounded-lg bg-nexo-bg border border-nexo-border">
              <p className="text-[10px] text-nexo-muted">Spam</p>
              <p className="text-xs font-medium text-nexo-text">{d.isSpam ? 'Sim ⚠️' : 'Não ✅'}</p>
            </div>
          </div>
          {d.isPhishing && (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400 font-medium">⚠️ Possível phishing detectado!</p>
              <p className="text-[10px] text-red-400/80">{d.phishingReason}</p>
            </div>
          )}
          <p className="text-xs text-nexo-muted mt-1">{d.summary}</p>
        </div>
      )
    }

    if (result.type === 'error') {
      return (
        <div className="p-4 text-center">
          <p className="text-sm text-red-400">Erro: {result.data.message}</p>
        </div>
      )
    }

    return null
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
      {mode !== 'menu' && !loading && (
        <div className="p-3 border-t border-nexo-border">
          <button onClick={() => { setMode('menu'); setResult(null); setDraftSaved(null) }} className="w-full py-2 rounded-lg text-xs text-nexo-muted hover:text-nexo-text hover:bg-nexo-bg transition-colors">
            ← Voltar ao menu
          </button>
        </div>
      )}
    </div>
  )
}
