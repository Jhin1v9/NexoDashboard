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

export function useRoadmaps() {
  const [roadmaps, setRoadmaps] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeRoadmap, setActiveRoadmap] = useState(null)
  const [timelines, setTimelines] = useState([])

  const fetchRoadmaps = useCallback(async (filters = {}) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.client_id) params.set('client_id', filters.client_id)
      if (filters.project_type) params.set('project_type', filters.project_type)
      const res = await fetch(`${API_BASE}/roadmaps?${params}`, { headers: getHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRoadmaps(data.roadmaps || [])
    } catch (err) {
      setError(err.message)
      setRoadmaps([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/roadmaps/project-templates`, { headers: getHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (err) {
      setTemplates([])
    }
  }, [])

  const fetchRoadmap = useCallback(async (id) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/roadmaps/${id}`, { headers: getHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setActiveRoadmap(data)
      setTimelines(data.timelines || [])
      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const createRoadmap = useCallback(async (data) => {
    const res = await fetch(`${API_BASE}/roadmaps`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const created = await res.json()
    setRoadmaps(prev => [created, ...prev])
    return created
  }, [])

  const updateRoadmap = useCallback(async (id, updates) => {
    const res = await fetch(`${API_BASE}/roadmaps/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const updated = await res.json()
    setRoadmaps(prev => prev.map(r => r.id === id ? updated : r))
    if (activeRoadmap?.id === id) setActiveRoadmap(prev => ({ ...prev, ...updated }))
    return updated
  }, [activeRoadmap])

  const advancePhase = useCallback(async (id, reason) => {
    const res = await fetch(`${API_BASE}/roadmaps/${id}/advance`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const result = await res.json()
    if (activeRoadmap?.id === id) {
      setActiveRoadmap(prev => ({ ...prev, current_phase_index: result.current_phase_index, phases: result.phases }))
    }
    setRoadmaps(prev => prev.map(r => r.id === id ? { ...r, current_phase_index: result.current_phase_index, phases: result.phases } : r))
    return result
  }, [activeRoadmap])

  const deleteRoadmap = useCallback(async (id) => {
    const res = await fetch(`${API_BASE}/roadmaps/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setRoadmaps(prev => prev.filter(r => r.id !== id))
    if (activeRoadmap?.id === id) {
      setActiveRoadmap(null)
      setTimelines([])
    }
  }, [activeRoadmap])

  const joinTimeline = useCallback(async (timelineId) => {
    const res = await fetch(`${API_BASE}/roadmaps/timelines/${timelineId}/join`, {
      method: 'POST',
      headers: getHeaders()
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, collaborators: data.collaborators } : t))
    return data
  }, [])

  const leaveTimeline = useCallback(async (timelineId) => {
    const res = await fetch(`${API_BASE}/roadmaps/timelines/${timelineId}/leave`, {
      method: 'POST',
      headers: getHeaders()
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, collaborators: data.collaborators } : t))
    return data
  }, [])

  const advanceStep = useCallback(async (timelineId) => {
    const res = await fetch(`${API_BASE}/roadmaps/timelines/${timelineId}/advance-step`, {
      method: 'POST',
      headers: getHeaders()
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    setTimelines(prev => prev.map(t => t.id === timelineId ? { ...t, ...data.timeline } : t))
    return data
  }, [])

  useEffect(() => {
    fetchRoadmaps()
    fetchTemplates()
  }, [fetchRoadmaps, fetchTemplates])

  return {
    roadmaps, templates, loading, error, activeRoadmap, timelines,
    fetchRoadmaps, fetchTemplates, fetchRoadmap, createRoadmap, updateRoadmap,
    advancePhase, deleteRoadmap, joinTimeline, leaveTimeline, advanceStep,
    setActiveRoadmap
  }
}
