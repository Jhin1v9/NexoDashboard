import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { LunaProvider } from './context/LunaContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import App from './App.jsx'
import './styles/index.css'
import axios from 'axios'

// Interceptador global: adiciona token em todas as requisições axios
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('nexo_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptador global: redireciona para login em 401 (axios)
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nexo_token')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

// Interceptador global: adiciona token em TODAS as requisições fetch para /api/*
const originalFetch = window.fetch
window.fetch = async function (url, options = {}) {
  if (typeof url === 'string' && url.startsWith('/api/')) {
    const token = localStorage.getItem('nexo_token')
    if (token) {
      options = {
        ...options,
        headers: {
          ...(options.headers || {}),
          'Authorization': `Bearer ${token}`
        }
      }
    }
  }
  return originalFetch(url, options)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <LunaProvider>
              <App />
            </LunaProvider>
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
)
