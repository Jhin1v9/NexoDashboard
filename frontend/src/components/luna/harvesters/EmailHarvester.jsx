import { useEffect } from 'react'
import { lunaEventBus } from '../../../lib/lunaEventBus'
import { useLunaDOM } from '../../../hooks/useLunaDOM'

/**
 * EmailHarvester — Componente invisível que expõe o contexto
 * da página de Email para a Luna.
 */

export default function EmailHarvester({
  emails,
  selectedThread,
  selectedEmailId,
  activeLabel,
  labels,
  unreadCounts,
  search,
  loading,
  syncing,
  showCompose,
  showLuna,
  pendingDrafts,
  authConnected,
  isFocusMode,
  density,
}) {
  useLunaDOM('email')

  useEffect(() => {
    const threadMessages = selectedThread?.messages || []
    const openEmail = threadMessages.find(m => m.id === selectedEmailId) || threadMessages[0] || null

    lunaEventBus.emit('luna:dataUpdated', {
      module: 'email',
      data: {
        emails: {
          count: emails.length,
          hasMore: false, // placeholder, pode ser atualizado
        },
        selected: {
          threadId: selectedThread?.id || null,
          emailId: selectedEmailId,
          subject: openEmail?.subject || null,
          from: openEmail?.from || null,
          snippet: openEmail?.snippet || null,
          messageCount: threadMessages.length,
        },
        activeLabel,
        labels: labels.map((l) => ({ id: l.id, name: l.name, unread: unreadCounts[l.id] || 0 })),
        searchQuery: search,
        loading,
        syncing,
        panels: {
          compose: showCompose,
          luna: showLuna,
        },
        pendingDrafts: {
          count: pendingDrafts?.length || 0,
          items: (pendingDrafts || []).map((d) => ({ id: d.id, subject: d.subject })),
        },
        auth: {
          connected: authConnected,
        },
        view: {
          focusMode: isFocusMode,
          density,
        },
        capabilities: {
          canSend: authConnected,
          canDraft: authConnected,
          canReply: !!selectedThread,
          canArchive: !!selectedEmailId,
          canStar: !!selectedEmailId,
        },
      },
    })
  }, [
    emails, selectedThread, selectedEmailId, activeLabel, labels,
    unreadCounts, search, loading, syncing, showCompose, showLuna,
    pendingDrafts, authConnected, isFocusMode, density,
  ])

  return null
}
