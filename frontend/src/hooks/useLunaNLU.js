import { useState, useCallback } from 'react'
import axios from 'axios'

/**
 * Hook para interagir com o NLU da Luna.
 *
 * Uso:
 *   const { understand, isLoading, error, result } = useLunaNLU()
 *   await understand('cria tarefa urgente')
 */

export function useLunaNLU() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const understand = useCallback(async (text, lang = 'pt') => {
    if (!text?.trim()) {
      setError('Texto vazio')
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data } = await axios.post('/api/luna/understand', {
        text: text.trim(),
        lang,
      })

      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido')
      }

      setResult(data)
      return data
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erro ao processar'
      setError(msg)
      setResult(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    understand,
    reset,
    isLoading,
    error,
    result,
  }
}
