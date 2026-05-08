import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = '/api/changelog';
const STORAGE_KEY = 'nexo-changelog-read';
const STORAGE_LAST_VISIT = 'nexo-changelog-last-visit';

function getReadIds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function setReadIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

function getLastVisit() {
  try {
    return localStorage.getItem(STORAGE_LAST_VISIT) || null;
  } catch {
    return null;
  }
}

function setLastVisit() {
  localStorage.setItem(STORAGE_LAST_VISIT, new Date().toISOString());
}

export function useChangelog() {
  const [entries, setEntries] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [readIds, setReadIdsState] = useState(getReadIds());
  const [lastVisit, setLastVisitState] = useState(getLastVisit());

  const fetchEntries = useCallback(async (category = null) => {
    setLoading(true);
    try {
      const params = {};
      if (category) params.category = category;
      const res = await axios.get(API_URL, { params });
      if (res.data.success) {
        setEntries(res.data.entries);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/unread`);
      if (res.data.success) {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await axios.post(`${API_URL}/${id}/read`);
      const newReadIds = [...new Set([...readIds, id])];
      setReadIdsState(newReadIds);
      setReadIds(newReadIds);
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [readIds]);

  const markAllAsRead = useCallback(async () => {
    try {
      const promises = entries
        .filter(e => !readIds.includes(e.id))
        .map(e => axios.post(`${API_URL}/${e.id}/read`));
      await Promise.all(promises);
      const allIds = entries.map(e => e.id);
      setReadIdsState(allIds);
      setReadIds(allIds);
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [entries, readIds]);

  const updateLastVisit = useCallback(() => {
    setLastVisit();
    setLastVisitState(new Date().toISOString());
  }, []);

  const isUnread = useCallback((entry) => {
    return !readIds.includes(entry.id);
  }, [readIds]);

  const isNewSinceLastVisit = useCallback((entry) => {
    if (!lastVisit) return true;
    return new Date(entry.date) > new Date(lastVisit);
  }, [lastVisit]);

  useEffect(() => {
    fetchEntries();
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000); // Poll a cada 1min
    return () => clearInterval(interval);
  }, [fetchEntries, fetchUnreadCount]);

  return {
    entries,
    unreadCount,
    loading,
    error,
    readIds,
    lastVisit,
    fetchEntries,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    updateLastVisit,
    isUnread,
    isNewSinceLastVisit,
  };
}

export default useChangelog;
