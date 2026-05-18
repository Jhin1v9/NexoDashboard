import { useState, useEffect } from 'react';
import {
  Users, CheckCircle, XCircle, Shield, Clock,
  Mail, Trash2, RefreshCw, AlertTriangle
} from 'lucide-react';

export default function AdminAccess() {
  const [requests, setRequests] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRole, setSelectedRole] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, usersRes] = await Promise.all([
        fetch('/api/access-requests'),
        fetch('/api/access-users')
      ]);
      const reqData = await reqRes.json();
      const usersData = await usersRes.json();
      setRequests(reqData.requests || []);
      setApprovedUsers(usersData.users || []);
    } catch (err) {
      console.error('Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (id, action, request) => {
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          role: selectedRole[id] || request.role || 'viewer',
          message: action === 'deny' ? 'Acesso negado pelo admin' : null
        })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  const handleRevoke = async (email, name) => {
    if (!confirm(`Revogar acesso de ${name}?`)) return;
    try {
      const res = await fetch(`/api/access-users/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const resolvedRequests = requests.filter(r => r.status !== 'pending');

  const displayList = activeTab === 'pending' ? pendingRequests : resolvedRequests;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-400" />
            Controle de Acesso
          </h1>
          <p className="text-slate-400 mt-1">Gerencie solicitações e usuários aprovados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Pendentes ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'resolved'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Resolvidos ({resolvedRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Usuários ({approvedUsers.length})
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="mobile-card text-center">
          <p className="text-2xl font-bold text-yellow-400">{pendingRequests.length}</p>
          <p className="text-xs text-slate-400 mt-1">Pendentes</p>
        </div>
        <div className="mobile-card text-center">
          <p className="text-2xl font-bold text-emerald-400">{requests.filter(r => r.status === 'approved').length}</p>
          <p className="text-xs text-slate-400 mt-1">Aprovados</p>
        </div>
        <div className="mobile-card text-center">
          <p className="text-2xl font-bold text-red-400">{requests.filter(r => r.status === 'denied').length}</p>
          <p className="text-xs text-slate-400 mt-1">Negados</p>
        </div>
        <div className="mobile-card text-center">
          <p className="text-2xl font-bold text-blue-400">{approvedUsers.length}</p>
          <p className="text-xs text-slate-400 mt-1">Usuários Ativos</p>
        </div>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          {approvedUsers.map(user => (
            <div key={user.email} className="mobile-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
                  {user.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-slate-400">{user.email}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                    user.role === 'owner' ? 'bg-purple-500/20 text-purple-400' :
                    user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                    user.role === 'editor' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {user.role}
                  </span>
                </div>
              </div>
              {user.role !== 'owner' && (
                <button
                  onClick={() => handleRevoke(user.email, user.name)}
                  className="touch-target p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {approvedUsers.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum usuário aprovado</p>
            </div>
          )}
        </div>
      )}

      {/* Requests List */}
      {(activeTab === 'pending' || activeTab === 'resolved') && (
        <div className="space-y-3">
          {displayList.map(req => (
            <div key={req.id} className="mobile-card">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {req.requesterName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{req.requesterName}</p>
                    <p className="text-sm text-slate-400 truncate">{req.requesterEmail}</p>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{req.reason}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {new Date(req.requestedAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>

                {req.status === 'pending' && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value={selectedRole[req.id] || req.role}
                      onChange={e => setSelectedRole({ ...selectedRole, [req.id]: e.target.value })}
                      className="h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => handleAction(req.id, 'approve', req)}
                      className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 touch-target"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Aceitar
                    </button>
                    <button
                      onClick={() => handleAction(req.id, 'deny', req)}
                      className="h-10 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 touch-target"
                    >
                      <XCircle className="h-4 w-4" />
                      Negar
                    </button>
                  </div>
                )}

                {req.status === 'approved' && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Aprovado</span>
                    <span className="text-xs text-slate-500">{req.role}</span>
                  </div>
                )}

                {req.status === 'denied' && (
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Negado</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {displayList.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>
                {activeTab === 'pending'
                  ? 'Nenhuma solicitação pendente'
                  : 'Nenhuma solicitação resolvida'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

