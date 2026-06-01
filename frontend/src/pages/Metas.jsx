import { useState, useCallback } from 'react'
import { useRoadmaps } from '../hooks/useRoadmaps'
import RoadmapList from '../components/metas/RoadmapList'
import RoadmapTimeline from '../components/metas/RoadmapTimeline'
import RoadmapDetailPanel from '../components/metas/RoadmapDetailPanel'
import CreateRoadmapModal from '../components/metas/CreateRoadmapModal'
import { Target, RefreshCw } from 'lucide-react'

export default function Metas() {
  const {
    roadmaps, templates, loading, error, activeRoadmap, timelines,
    fetchRoadmaps, fetchRoadmap, createRoadmap, advancePhase,
    joinTimeline, leaveTimeline, setActiveRoadmap
  } = useRoadmaps()

  const [selectedId, setSelectedId] = useState(null)

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

  return (
    <div className="flex h-full">
      {/* Lista de Projetos */}
      <div className="w-64 shrink-0">
        <RoadmapList
          roadmaps={roadmaps}
          loading={loading}
          onSelect={handleSelect}
          activeId={selectedId}
          onCreate={() => {}}
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
        />
      </div>
    </div>
  )
}
