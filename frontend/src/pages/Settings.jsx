import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import {
  Settings as SettingsIcon, User, Shield, Bell, Lock,
  Save, AlertTriangle, CheckCircle, Users, Brain
} from 'lucide-react'

export default function Settings() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('perfil')
  const [users, setUsers] = useState({})
  const [securitySettings, setSecuritySettings] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  // Luna prompt config states
  const [lunaConfig, setLunaConfig] = useState({
    systemPrompt: '',
    miniReminder: '',
    toolResultPrompt: '',
  })
  const [lunaConfigLoading, setLunaConfigLoading] = useState(false)

  // Form states
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  useEffect(() => {
    fetchUsers()
    fetchSecuritySettings()
    fetchLunaConfig()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users')
      setUsers(res.data.users || {})
    } catch (e) {}
  }

  const fetchSecuritySettings = async () => {
    try {
      const res = await axios.get('/api/security/settings')
      setSecuritySettings(res.data.settings || {})
    } catch (e) {}
  }

  const fetchLunaConfig = async () => {
    try {
      const res = await axios.get('/api/luna/config')
      if (res.data.success && res.data.config) {
        const c = res.data.config
        setLunaConfig({
          systemPrompt: c.systemPrompt || '',
          miniReminder: c.miniReminder || '',
          toolResultPrompt: c.toolResultPrompt || '',
        })
      }
    } catch (e) {
      console.error('Erro ao carregar config Luna:', e)
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('As senhas não coincidem', 'error')
      return
    }
    if (passwordForm.newPassword.length < 4) {
      showMessage('Senha deve ter no mínimo 4 caracteres', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
      if (res.data.success) {
        showMessage('Senha alterada com sucesso!')
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      }
    } catch (e) {
      showMessage(e.response?.data?.error || 'Erro ao alterar senha', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSecurity = async (key, value) => {
    try {
      const res = await axios.put('/api/security/settings', { [key]: value })
      setSecuritySettings(res.data.settings)
      showMessage('Configuração atualizada')
    } catch (e) {
      showMessage(e.response?.data?.error || 'Erro ao atualizar', 'error')
    }
  }

  const handleSaveLunaConfig = async () => {
    setLunaConfigLoading(true)
    try {
      const res = await axios.post('/api/luna/config', {
        ...lunaConfig,
        version: '1.0.0',
        loopRules: {
          chatModeNeverLoops: true,
          actionModeAlwaysLoops: true,
          planModeAlwaysLoops: true,
          maxAutoContinues: 9007199254740991,
          maxLoops: 9007199254740991,
        }
      })
      if (res.data.success) {
        showMessage('Prompts da Luna salvos! Reinicie o luna-server para aplicar.')
      }
    } catch (e) {
      showMessage(e.response?.data?.error || 'Erro ao salvar prompts', 'error')
    } finally {
      setLunaConfigLoading(false)
    }
  }

  const tabs = [
    { id: 'perfil', label: 'Perfil', icon: User },
    { id: 'seguranca', label: 'Segurança', icon: Shield },
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'prompts', label: 'Prompts Luna', icon: Brain },
  ]

  const currentUser = users[user?.id] || {}

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-6 h-6 text-nexo-primary" />
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
        }`}>
          {message.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-48 space-y-1 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-nexo-primary text-white' : 'text-nexo-muted hover:bg-nexo-card hover:text-nexo-text'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* TAB: PERFIL */}
          {activeTab === 'perfil' && (
            <>
              <div className="glass-card p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-nexo-primary" />
                  Informações do Perfil
                </h2>
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                    style={{ backgroundColor: currentUser.color || '#3742fa' }}
                  >
                    {currentUser.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{currentUser.name || user?.name}</p>
                    <p className="text-sm text-nexo-muted">{currentUser.role || 'Admin'}</p>
                    <p className="text-xs text-nexo-muted">ID: {user?.id}</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-nexo-primary" />
                  Alterar Senha
                </h2>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block">Senha Atual</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm"
                      placeholder="Digite sua senha atual"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block">Nova Senha</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm"
                      placeholder="Mínimo 4 caracteres"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm"
                      placeholder="Repita a nova senha"
                    />
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={loading || !passwordForm.currentPassword || !passwordForm.newPassword}
                    className="flex items-center gap-2 px-4 py-2 bg-nexo-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Salvando...' : 'Alterar Senha'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB: SEGURANÇA */}
          {activeTab === 'seguranca' && (
            <>
              <div className="glass-card p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-nexo-primary" />
                  Alertas de Segurança
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-nexo-bg rounded-lg">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-sm font-medium">Alertas no Dashboard</p>
                        <p className="text-xs text-nexo-muted">Mostrar notificações no painel do sistema</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleSecurity('dashboardAlerts', !securitySettings.dashboardAlerts)}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        securitySettings.dashboardAlerts !== false ? 'bg-nexo-primary' : 'bg-nexo-border'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        securitySettings.dashboardAlerts !== false ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6">
                <h2 className="text-lg font-bold mb-4 text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Sessão
                </h2>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
                >
                  Encerrar Sessão
                </button>
              </div>
            </>
          )}

          {/* TAB: USUÁRIOS */}
          {activeTab === 'usuarios' && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-nexo-primary" />
                Usuários do Sistema
              </h2>
              <div className="space-y-3">
                {Object.entries(users).map(([key, u]) => (
                  <div key={key} className="flex items-center gap-3 p-3 bg-nexo-bg rounded-lg">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{u.name}</p>
                      <p className="text-xs text-nexo-muted">{u.role} — ID: {key}</p>
                    </div>
                    {user?.id === key && (
                      <span className="text-[10px] bg-nexo-primary/20 text-nexo-primary px-2 py-0.5 rounded">Você</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-nexo-muted mt-4">
                Todos os usuários são Admin e podem se modificar livremente.
              </p>
            </div>
          )}

          {/* TAB: PROMPTS LUNA */}
          {activeTab === 'prompts' && (
            <div className="space-y-6">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Brain className="w-5 h-5 text-nexo-primary" />
                    Prompts da Luna
                  </h2>
                  <button
                    onClick={handleSaveLunaConfig}
                    disabled={lunaConfigLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-nexo-primary rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {lunaConfigLoading ? 'Salvando...' : 'Salvar Prompts'}
                  </button>
                </div>
                <p className="text-xs text-nexo-muted mb-4">
                  Edite os prompts que a Luna envia para a Kimi. As alterações são salvas em <code className="bg-nexo-bg px-1 rounded">~/.luna-kernel/config/luna-prompt-config.json</code>. Reinicie o luna-server para aplicar.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block font-medium">
                      System Prompt (mensagem inicial)
                    </label>
                    <textarea
                      value={lunaConfig.systemPrompt}
                      onChange={e => setLunaConfig(c => ({ ...c, systemPrompt: e.target.value }))}
                      className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm font-mono leading-relaxed"
                      rows={10}
                      placeholder="Prompt de sistema que define a personalidade e regras da Luna..."
                    />
                    <p className="text-[10px] text-nexo-muted mt-1">
                      Variáveis disponíveis: {'{{skillCount}}'} {'{{personaCount}}'} {'{{agentsMd}}'} {'{{memoryContext}}'} {'{{personaContent}}'} {'{{masterPrompt}}'}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block font-medium">
                      Mini Reminder (mensagens de continuação)
                    </label>
                    <textarea
                      value={lunaConfig.miniReminder}
                      onChange={e => setLunaConfig(c => ({ ...c, miniReminder: e.target.value }))}
                      className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm font-mono leading-relaxed"
                      rows={10}
                      placeholder="Lembrete enxuto enviado nas mensagens seguintes..."
                    />
                  </div>

                  <div>
                    <label className="text-xs text-nexo-muted uppercase mb-1 block font-medium">
                      Tool Result Prompt (resultado de ferramentas)
                    </label>
                    <textarea
                      value={lunaConfig.toolResultPrompt}
                      onChange={e => setLunaConfig(c => ({ ...c, toolResultPrompt: e.target.value }))}
                      className="w-full px-3 py-2 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-sm font-mono leading-relaxed"
                      rows={10}
                      placeholder="Template do prompt enviado após executar uma ferramenta..."
                    />
                    <p className="text-[10px] text-nexo-muted mt-1">
                      Variáveis disponíveis: {'{{toolsUsed}}'} {'{{successCount}}'} {'{{totalCount}}'} {'{{outputText}}'} {'{{statusEmoji}}'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
