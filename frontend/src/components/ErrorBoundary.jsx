import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-nexo-bg text-nexo-text flex items-center justify-center p-6">
          <div className="glass-card p-8 max-w-lg w-full text-center">
            <div className="text-4xl mb-4">💥</div>
            <h1 className="text-xl font-bold text-nexo-danger mb-2">Algo quebrou no Dashboard</h1>
            <p className="text-sm text-nexo-muted mb-4">
              Um erro inesperado impediu o carregamento da página. Tente recarregar.
            </p>
            <div className="bg-black/30 rounded-lg p-3 text-left mb-4 overflow-auto max-h-40">
              <code className="text-xs text-red-400 font-mono block">
                {this.state.error?.toString?.() || 'Erro desconhecido'}
              </code>
              {this.state.errorInfo && (
                <pre className="text-[10px] text-nexo-muted mt-2 font-mono">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-nexo-primary rounded-lg text-sm font-medium hover:opacity-90"
              >
                Recarregar página
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('nexo_token')
                  window.location.href = '/'
                }}
                className="px-4 py-2 bg-nexo-card border border-nexo-border rounded-lg text-sm hover:bg-nexo-border"
              >
                Voltar ao login
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
