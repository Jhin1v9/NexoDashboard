import { Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import CommandPalette from './components/CommandPalette'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Projetos from './pages/Projetos'
import Tarefas from './pages/Tarefas'
import WhatsApp from './pages/WhatsApp'
import Relatorios from './pages/Relatorios'
import GitHub from './pages/GitHub'
import VercelProjects from './pages/VercelProjects'
import Ferramentas from './pages/Ferramentas'
import Financeiro from './pages/Financeiro'
import ReceitaDetalhe from './pages/ReceitaDetalhe'
import Gastos from './pages/Gastos'
import Caixa from './pages/Caixa'
import MeusGastos from './pages/MeusGastos'
import Orcamentos from './pages/Orcamentos'
import Operacoes from './pages/Operacoes'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [cmdOpen, setCmdOpen] = useState(false)

  return (
    <div className="flex h-screen bg-nexo-bg text-nexo-text overflow-hidden">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} onSearchClick={() => setCmdOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Operacoes />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/operacoes" element={<Operacoes />} />
            <Route path="/orcamentos" element={<Orcamentos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/projetos" element={<Projetos />} />
            <Route path="/tarefas" element={<Tarefas />} />
            <Route path="/whatsapp" element={<WhatsApp />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/github" element={<GitHub />} />
            <Route path="/vercel" element={<VercelProjects />} />
            <Route path="/ferramentas" element={<Ferramentas />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/financeiro/receitas/:id" element={<ReceitaDetalhe />} />
            <Route path="/financeiro/gastos" element={<Gastos />} />
            <Route path="/financeiro/caixa" element={<Caixa />} />
            <Route path="/financeiro/gastos/meus" element={<MeusGastos />} />
          </Routes>
        </main>
      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}

export default App
