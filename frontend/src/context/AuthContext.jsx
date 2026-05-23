import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('nexo_token')
    if (token) {
      axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.data.success) {
            setUser(res.data.user)
          } else {
            localStorage.removeItem('nexo_token')
          }
        })
        .catch((err) => {
          // Só remove token em 401 (não autorizado).
          // Erros de rede (backend offline) não devem deslogar o usuário.
          if (err.response?.status === 401) {
            localStorage.removeItem('nexo_token')
          }
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // Interceptador global 401 — redireciona para login quando token expira
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('nexo_token')
          setUser(null)
          window.location.href = '/login'
        }
        return Promise.reject(err)
      }
    )
    return () => axios.interceptors.response.eject(interceptor)
  }, [])

  const login = async (token) => {
    localStorage.setItem('nexo_token', token)
    const res = await axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    if (res.data.success) {
      setUser(res.data.user)
    }
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('nexo_token')
    setUser(null)
    window.location.href = '/'
  }

  const getToken = () => localStorage.getItem('nexo_token')

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
