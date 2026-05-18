import { useState, useEffect } from 'react';
import { Bell, Shield } from 'lucide-react';

export default function AccessBadge() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await fetch('/api/access-requests?status=pending');
        const data = await res.json();
        setPendingCount(data.pending || 0);
      } catch (err) {
        // Silencioso
      }
    };

    fetchPending();
    const interval = setInterval(fetchPending, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

  if (pendingCount === 0) return null;

  return (
    <div className="relative cursor-pointer" title={`${pendingCount} solicitação(ões) de acesso pendentes`}>
      <Shield className="h-5 w-5 text-yellow-400" />
      <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
        {pendingCount > 9 ? '9+' : pendingCount}
      </span>
    </div>
  );
}

