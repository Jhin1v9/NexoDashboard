import { Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { EmailFocusModeProvider } from './context/EmailFocusModeContext'
import { EmailDensityProvider } from './context/EmailDensityContext'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import CommandPalette from './components/CommandPalette'
import ToastContainer from './components/ToastContainer'
import MobileBottomNav from './components/MobileBottomNav'
import LunaFloatingButton from './components/luna/LunaFloatingButton'
import LunaProactiveToast from './components/luna/LunaProactiveToast'
import LunaActionBridge from './components/luna/LunaActionBridge'
import { RouteHarvester } from './components/luna/harvesters'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Workspace from './pages/Workspace'
import Projetos from './pages/Projetos'
import Tarefas from './pages/Tarefas'
import EmailHub from './pages/EmailHub'
import EmailCallback from './pages/EmailCallback'
import Relatorios from './pages/Relatorios'
import GitHub from './pages/GitHub'
import VercelProjects from './pages/VercelProjects'
import Ferramentas from './pages/Ferramentas'
import Financeiro from './pages/Financeiro'
import ReceitaDetalhe from './pages/ReceitaDetalhe'
import Caixa from './pages/Caixa'
import Gastos from './pages/Gastos'
import MeusGastos from './pages/MeusGastos'
import Orcamentos from './pages/Orcamentos'
import Operacoes from './pages/Operacoes'
import Leads from './pages/Leads'
import LunaControl from './pages/LunaControl'
import SystemEngine from './pages/SystemEngine'
import Settings from './pages/Settings'
import Seguranca from './pages/Seguranca'
import Changelog from './pages/Changelog'
import Ideias from './pages/Ideias'
import IdeaEditor from './pages/IdeaEditor'
import Votacao from './pages/Votacao'
import Metas from './pages/Metas'

// Layout para rotas protegidas (com sidebar, topbar, etc.)
function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [cmdOpen, setCmdOpen] = useState(false)

  return (
    <div className="flex h-screen bg-nexo-bg text-nexo-text overflow-hidden">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} onSearchClick={() => setCmdOpen(true)} />
        <RouteHarvester />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/operacoes" element={<Operacoes />} />
            <Route path="/orcamentos" element={<Orcamentos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/workspace/:clientId" element={<Workspace />} />
            <Route path="/projetos" element={<Projetos />} />
            <Route path="/tarefas" element={<Tarefas />} />
            <Route path="/ideias" element={<Ideias />} />
            <Route path="/ideias/nova" element={<IdeaEditor />} />
            <Route path="/ideias/:id" element={<IdeaEditor />} />
            <Route path="/email" element={<EmailHub />} />
            <Route path="/email/oauth/callback" element={<EmailCallback />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/github" element={<GitHub />} />
            <Route path="/vercel" element={<VercelProjects />} />
            <Route path="/ferramentas" element={<Ferramentas />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/financeiro/receitas/:id" element={<ReceitaDetalhe />} />
            <Route path="/financeiro/caixa" element={<Caixa />} />
            <Route path="/caixa" element={<Caixa />} />
            <Route path="/financeiro/gastos" element={<Gastos />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/financeiro/gastos/meus" element={<MeusGastos />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/luna" element={<LunaControl />} />
            <Route path="/sistema" element={<SystemEngine />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/seguranca" element={<Seguranca />} />
            <Route path="/votacao" element={<Votacao />} />
            <Route path="/metas" element={<Metas />} />
            <Route path="/changelog" element={<Changelog />} />
          </Routes>
        </main>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <ToastContainer />
      <MobileBottomNav />
      <LunaFloatingButton />
      <LunaProactiveToast />
      <LunaActionBridge />
    </div>
  )
}

function App() {
  return (
    <EmailFocusModeProvider>
      <EmailDensityProvider>
        <Routes>
          {/* Landing page pública */}
          <Route path="/" element={<LandingPage />} />

          {/* Login tradicional */}
          <Route path="/login" element={<LoginPage />} />

          {/* Registro / Demo Request */}
          <Route path="/register" element={<RegisterPage />} />

          {/* Todas as rotas internas protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<ProtectedLayout />} />
          </Route>
        </Routes>
      </EmailDensityProvider>
    </EmailFocusModeProvider>
  )
}

export default App
