import { useState, useEffect, useCallback } from 'react'

const API_URL = 'http://127.0.0.1:3456'

export function useTransactions(refreshInterval = 10000) {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const [txRes, sumRes] = await Promise.all([
        fetch(`${API_URL}/api/transactions`),
        fetch(`${API_URL}/api/finance/summary`)
      ])
      
      if (!txRes.ok || !sumRes.ok) throw new Error('Erro ao carregar dados')
      
      const txData = await txRes.json()
      const sumData = await sumRes.json()
      
      setTransactions(txData)
      setSummary(sumData)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval])

  // CRUD operations
  const addTransaction = async (data) => {
    const res = await fetch(`${API_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Erro ao adicionar')
    await fetchData()
    return await res.json()
  }

  const updateTransaction = async (id, data) => {
    const res = await fetch(`${API_URL}/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Erro ao atualizar')
    await fetchData()
    return await res.json()
  }

  const deleteTransaction = async (id) => {
    const res = await fetch(`${API_URL}/api/transactions/${id}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('Erro ao remover')
    await fetchData()
    return await res.json()
  }

  return {
    transactions,
    summary,
    loading,
    error,
    refresh: fetchData,
    addTransaction,
    updateTransaction,
    deleteTransaction
  }
}
