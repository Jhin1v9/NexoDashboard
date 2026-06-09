import { useState, useCallback, useEffect } from 'react'

const API_BASE = '/api'

function getToken() {
  return localStorage.getItem('nexo_token') || ''
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  }
}

export function useVoting() {
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({})
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })

  const fetchSessions = useCallback(async (page = 1, overrideFilters) => {
    setLoading(true)
    setError(null)
    try {
      const activeFilters = overrideFilters || filters
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (activeFilters.status) params.set('status', activeFilters.status)
      if (activeFilters.createdBy) params.set('createdBy', activeFilters.createdBy)
      if (activeFilters.search) params.set('filter', activeFilters.search)

      const res = await fetch(`${API_BASE}/voting/sessions?${params}`, { headers: getHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSessions(data.sessions || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 })
    } catch (err) {
      setError(err.message)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/voting/stats`, { headers: getHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStats(data)
    } catch {
      setStats(null)
    }
  }, [])

  const createSession = useCallback(async (data) => {
    const res = await fetch(`${API_BASE}/voting/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const created = await res.json()
    setSessions(prev => [created, ...prev])
    return created
  }, [])

  const vote = useCallback(async (sessionId, voteValue, comment = '') => {
    const res = await fetch(`${API_BASE}/voting/sessions/${sessionId}/vote`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ vote: voteValue, comment })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const updated = data.session
    setSessions(prev => prev.map(s => s.id === sessionId ? updated : s))
    return updated
  }, [])

  const deleteSession = useCallback(async (sessionId) => {
    const res = await fetch(`${API_BASE}/voting/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getHeaders()
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }, [])

  const updateSession = useCallback(async (sessionId, data) => {
    const res = await fetch(`${API_BASE}/voting/sessions/${sessionId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const updated = await res.json()
    setSessions(prev => prev.map(s => s.id === sessionId ? updated : s))
    return updated
  }, [])

  useEffect(() => {
    fetchSessions()
    fetchStats()
  }, [])

  return {
    sessions, stats, loading, error, pagination, filters,
    fetchSessions, fetchStats, createSession, vote, deleteSession, updateSession, setFilters
  }
}
