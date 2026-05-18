import { useState } from 'react';
import { Lock, Send, Clock, CheckCircle, Mail, User, MessageSquare } from 'lucide-react';

export default function AccessRequest() {
  const [form, setForm] = useState({ email: '', name: '', reason: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao enviar solicitação');
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full glass-card p-8 text-center">
          <Clock className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Solicitação Enviada! 🕐</h1>
          <p className="text-slate-400 mb-6">
            Sua solicitação de acesso foi enviada e está aguardando aprovação do administrador.
          </p>
          <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-300 space-y-2">
            <p><strong>Email:</strong> {form.email}</p>
            <p><strong>Nome:</strong> {form.name}</p>
            <p><strong>Motivo:</strong> {form.reason || 'Não informado'}</p>
          </div>
          <p className="text-sm text-slate-500 mt-6">
            Você receberá uma notificação quando for aprovado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="max-w-md w-full glass-card p-6 sm:p-8">
        <div className="text-center mb-6">
          <Lock className="h-14 w-14 text-nexo-danger mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-slate-400 mt-2">
            Você não tem permissão para acessar o NEXO Dashboard. Solicite acesso abaixo.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <Mail className="h-4 w-4" /> Email
            </label>
            <input
              type="email"
              required
              placeholder="seu@email.com"
              className="w-full h-12 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <User className="h-4 w-4" /> Nome
            </label>
            <input
              type="text"
              required
              placeholder="Seu nome completo"
              className="w-full h-12 px-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <MessageSquare className="h-4 w-4" /> Motivo (opcional)
            </label>
            <textarea
              placeholder="Por que você precisa de acesso?"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 touch-target"
          >
            {loading ? (
              <>Processando...</>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Solicitar Acesso
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          Limite de 3 solicitações por dia. Aprovação manual pelo admin.
        </p>
      </div>
    </div>
  );
}

