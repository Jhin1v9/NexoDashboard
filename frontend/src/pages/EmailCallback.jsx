import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'

export default function EmailCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = localStorage.getItem('nexo_token') || ''

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error) {
      navigate('/email?auth=error&message=' + encodeURIComponent(error))
      return
    }

    if (!code) {
      navigate('/email?auth=error&message=' + encodeURIComponent('Código de autorização ausente'))
      return
    }

    // Envia o código para o backend processar
    axios.get('/api/email/auth/callback?code=' + encodeURIComponent(code), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (res.data.success) {
          navigate('/email?auth=success&email=' + encodeURIComponent(res.data.email || ''))
        } else {
          navigate('/email?auth=error&message=' + encodeURIComponent(res.data.error || 'Erro desconhecido'))
        }
      })
      .catch(err => {
        navigate('/email?auth=error&message=' + encodeURIComponent(err.response?.data?.error || err.message))
      })
  }, [location.search, navigate, token])

  return (
    <div className="h-screen flex items-center justify-center bg-nexo-bg text-nexo-text">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-nexo-info border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-nexo-muted">Conectando com Gmail...</p>
      </div>
    </div>
  )
}
