import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { BugDetectorProvider } from '@auris/bug-detector/react'
import App from './App.jsx'
import './styles/index.css'
import axios from 'axios'

// Interceptador global: adiciona token em todas as requisições
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('nexo_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptador global: redireciona para login em 401
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <BugDetectorProvider config={{ shortcut: 'Ctrl+Shift+D', trigger: 'keyboard-shortcut' }}>
            <App />
          </BugDetectorProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
