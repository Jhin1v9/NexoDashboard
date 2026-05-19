import { useEffect } from 'react'
import { lunaEventBus } from '../../../lib/lunaEventBus'
import { useLunaDOM } from '../../../hooks/useLunaDOM'

/**
 * TaskHarvester — Componente invisível que expõe o contexto
 * da página de Tarefas para a Luna.
 *
 * Props:
 *   - tasks: array completo de tarefas
 *   - filtered: array filtrado/visível
 *   - stats: { total, pending, inProgress, overdue }
 *   - filters: { statusFilter, personFilter, priorityFilter, typeFilter, showOverdueOnly }
 *   - modalTask: tarefa aberta no modal (ou null)
 *   - users: mapa de usuários
 */

export default function TaskHarvester({ tasks, filtered, stats, filters, modalTask, users }) {
  // Captura cliques, foco e scroll na página de tarefas
  useLunaDOM('tasks')

  useEffect(() => {
    lunaEventBus.emit('luna:dataUpdated', {
      module: 'tasks',
      data: {
        allTasks: tasks,
        visibleTasks: filtered,
        count: {
          total: stats.total,
          pending: stats.pending,
          inProgress: stats.inProgress,
          overdue: stats.overdue,
          visible: filtered.length,
        },
        filters: {
          status: filters.statusFilter,
          person: filters.personFilter,
          priority: filters.priorityFilter,
          type: filters.typeFilter,
          overdueOnly: filters.showOverdueOnly,
        },
        modalOpen: !!modalTask,
        modalTaskId: modalTask?.id || null,
        users: Object.keys(users).map((id) => ({ id, name: users[id]?.name || id })),
        capabilities: {
          canCreate: true,
          canDelete: filtered.length > 0,
          canBatch: filtered.length > 1,
          canFilter: true,
        },
      },
    })
  }, [tasks, filtered, stats, filters, modalTask, users])

  return null
}
