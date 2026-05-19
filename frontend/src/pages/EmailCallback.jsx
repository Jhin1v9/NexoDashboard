import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function EmailCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [status, setStatus] = useState('processando')
  const [message, setMessage] = useState('Conectando com Gmail...')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error) {
      setStatus('erro')
      setMessage('Erro: ' + error)
      setTimeout(() => navigate('/email?auth=error&message=' + encodeURIComponent(error)), 2000)
      return
    }

    if (!code) {
      setStatus('erro')
      setMessage('Código de autorização ausente')
      setTimeout(() => navigate('/email?auth=error&message=' + encodeURIComponent('Código ausente')), 2000)
      return
    }

    // Envia o código para o backend processar (sem auth header — callback é público)
    fetch('/api/email/auth/callback?code=' + encodeURIComponent(code))
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus('sucesso')
          setMessage('Conectado! Redirecionando...')
          setTimeout(() => navigate('/email?auth=success&email=' + encodeURIComponent(data.email || '')), 1000)
        } else {
          setStatus('erro')
          setMessage(data.error || 'Erro desconhecido')
          setTimeout(() => navigate('/email?auth=error&message=' + encodeURIComponent(data.error || 'Erro')), 2000)
        }
      })
      .catch(err => {
        setStatus('erro')
        setMessage(err.message)
        setTimeout(() => navigate('/email?auth=error&message=' + encodeURIComponent(err.message)), 2000)
      })
  }, [location.search, navigate])

  return (
    <div className="h-full flex items-center justify-center bg-nexo-bg text-nexo-text">
      <div className="text-center">
        {status === 'processando' && (
          <>
            <div className="w-8 h-8 border-2 border-nexo-info border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-nexo-muted">{message}</p>
          </>
        )}
        {status === 'sucesso' && (
          <>
            <div className="w-8 h-8 rounded-full bg-nexo-success mx-auto mb-4 flex items-center justify-center text-white text-lg">✓</div>
            <p className="text-sm text-nexo-success">{message}</p>
          </>
        )}
        {status === 'erro' && (
          <>
            <div className="w-8 h-8 rounded-full bg-nexo-danger mx-auto mb-4 flex items-center justify-center text-white text-lg">✕</div>
            <p className="text-sm text-nexo-danger">{message}</p>
            <p className="text-xs text-nexo-muted mt-2">Redirecionando...</p>
          </>
        )}
      </div>
    </div>
  )
}
