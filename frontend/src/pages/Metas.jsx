import { useState, useCallback } from 'react'
import { useRoadmaps } from '../hooks/useRoadmaps'
import RoadmapList from '../components/metas/RoadmapList'
import RoadmapTimeline from '../components/metas/RoadmapTimeline'
import RoadmapDetailPanel from '../components/metas/RoadmapDetailPanel'
import CreateRoadmapModal from '../components/metas/CreateRoadmapModal'
import { Target, RefreshCw, Edit3, Save, X } from 'lucide-react'

export default function Metas() {
  const {
    roadmaps, templates, loading, error, activeRoadmap, timelines,
    fetchRoadmaps, fetchRoadmap, createRoadmap, advancePhase, updateRoadmap, advanceStep,
    joinTimeline, leaveTimeline, setActiveRoadmap, deleteRoadmap
  } = useRoadmaps()

  const [selectedId, setSelectedId] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', total_value: '', currency: 'EUR', status: 'active' })

  const handleSelect = useCallback(async (id) => {
    setSelectedId(id)
    await fetchRoadmap(id)
  }, [fetchRoadmap])

  const handleAdvance = useCallback(async () => {
    if (!activeRoadmap) return
    await advancePhase(activeRoadmap.id)
    await fetchRoadmap(activeRoadmap.id)
  }, [activeRoadmap, advancePhase, fetchRoadmap])

  const handleCreate = useCallback(async (data) => {
    const created = await createRoadmap(data)
    if (created) {
      await handleSelect(created.id)
    }
  }, [createRoadmap, handleSelect])

  const handleJoin = useCallback(async (timelineId) => {
    await joinTimeline(timelineId)
    if (activeRoadmap) await fetchRoadmap(activeRoadmap.id)
  }, [joinTimeline, activeRoadmap, fetchRoadmap])

  const handleLeave = useCallback(async (timelineId) => {
    await leaveTimeline(timelineId)
    if (activeRoadmap) await fetchRoadmap(activeRoadmap.id)
  }, [leaveTimeline, activeRoadmap, fetchRoadmap])

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Tem certeza que deseja apagar este projeto?')) return
    await deleteRoadmap(id)
    if (selectedId === id) setSelectedId(null)
  }, [deleteRoadmap, selectedId])

  const openEdit = useCallback(() => {
    if (!activeRoadmap) return
    setEditForm({
      title: activeRoadmap.title || '',
      total_value: String(activeRoadmap.total_value || ''),
      currency: activeRoadmap.currency || 'EUR',
      status: activeRoadmap.status || 'active'
    })
    setEditOpen(true)
  }, [activeRoadmap])

  const handleUpdate = useCallback(async () => {
    if (!activeRoadmap) return
    await updateRoadmap(activeRoadmap.id, {
      title: editForm.title,
      total_value: parseFloat(editForm.total_value) || 0,
      currency: editForm.currency,
      status: editForm.status
    })
    setEditOpen(false)
    await fetchRoadmap(activeRoadmap.id)
  }, [activeRoadmap, editForm, updateRoadmap, fetchRoadmap])

  const handleAdvanceStep = useCallback(async (timelineId) => {
    await advanceStep(timelineId)
    if (activeRoadmap) await fetchRoadmap(activeRoadmap.id)
  }, [advanceStep, activeRoadmap, fetchRoadmap])

  return (
    <div className="flex h-full">
      {/* Lista de Projetos */}
      <div className="w-64 shrink-0">
        <RoadmapList
          roadmaps={roadmaps}
          loading={loading}
          onSelect={handleSelect}
          activeId={selectedId}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 glass flex items-center justify-between px-4 border-b border-nexo-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-nexo-info/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-nexo-info" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-none">Metas</h1>
              <p className="text-[10px] text-nexo-muted mt-0.5">Hub de Projetos NEXO</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeRoadmap && (
              <button
                onClick={openEdit}
                className="p-2 rounded-lg border border-nexo-border text-nexo-muted hover:text-white hover:bg-nexo-card transition-colors"
                title="Editar projeto"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => fetchRoadmaps()}
              className="p-2 rounded-lg border border-nexo-border text-nexo-muted hover:text-white hover:bg-nexo-card transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading && 'animate-spin'}`} />
            </button>
            <CreateRoadmapModal templates={templates} onCreate={handleCreate}>
              <button className="btn-primary flex items-center gap-1.5 text-sm">
                <Target className="w-4 h-4" />
                Novo Projeto
              </button>
            </CreateRoadmapModal>
          </div>
        </header>

        {/* Timeline */}
        <main className="flex-1 overflow-hidden">
          <RoadmapTimeline
            roadmap={activeRoadmap}
            onAdvance={handleAdvance}
          />
        </main>
      </div>

      {/* Painel Lateral */}
      <div className="w-72 shrink-0">
        <RoadmapDetailPanel
          roadmap={activeRoadmap}
          timelines={timelines}
          onJoinTimeline={handleJoin}
          onLeaveTimeline={handleLeave}
          onAdvanceStep={handleAdvanceStep}
        />
      </div>

      {/* Modal Editar Roadmap */}
      {editOpen && activeRoadmap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Editar Projeto</h3>
              <button onClick={() => setEditOpen(false)} className="p-1 hover:bg-nexo-border rounded"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-nexo-muted">Título</label>
                <input value={editForm.title} onChange={e => setEditForm(v => ({ ...v, title: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-nexo-muted">Valor (€)</label>
                  <input type="number" step="0.01" value={editForm.total_value} onChange={e => setEditForm(v => ({ ...v, total_value: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-nexo-muted">Status</label>
                  <select value={editForm.status} onChange={e => setEditForm(v => ({ ...v, status: e.target.value }))} className="mt-1 w-full bg-nexo-card border border-nexo-border rounded-md px-3 py-2 text-sm">
                    <option value="active">Ativo</option>
                    <option value="paused">Pausado</option>
                    <option value="completed">Concluído</option>
                    <option value="cancelled">Cancelado</option>
                    <option value="at_risk">Em Risco</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border">Cancelar</button>
              <button onClick={handleUpdate} className="px-4 py-2 bg-nexo-primary rounded-lg text-xs hover:opacity-90 flex items-center gap-1">
                <Save size={12} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
