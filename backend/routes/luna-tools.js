/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Luna Tools API — Dashboard data exposed to Luna Web
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Reads from dashboard JSON files (fallback when PostgreSQL unavailable)
 * ═══════════════════════════════════════════════════════════════════════════
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJSON(filename, defaultVal = []) {
  try {
    const file = path.join(DATA_DIR, filename);
    if (!fs.existsSync(file)) return defaultVal;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    console.error(`[LunaTools] Error reading ${filename}:`, e.message);
    return defaultVal;
  }
}

function writeJSON(filename, data) {
  try {
    const file = path.join(DATA_DIR, filename);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error(`[LunaTools] Error writing ${filename}:`, e.message);
    return false;
  }
}

// ── MOCK LEADS (rich demo data since leads.json is empty) ──
const MOCK_LEADS = [
  { id: 'lead-001', name: 'Carlos Silva', email: 'carlos@techbrasil.com', phone: '+55 11 98765-4321', source: 'site', status: 'negociacao', value: 12500, notes: 'Interessado em dashboard customizado para ERP', createdAt: '2026-05-28T10:00:00Z', updatedAt: '2026-05-30T14:30:00Z' },
  { id: 'lead-002', name: 'Maria Oliveira', email: 'maria@inovacaodigital.com.br', phone: '+55 21 99876-5432', source: 'indicacao', status: 'proposta_enviada', value: 8500, notes: 'Precisa de integração WhatsApp + CRM', createdAt: '2026-05-27T09:00:00Z', updatedAt: '2026-05-29T11:00:00Z' },
  { id: 'lead-003', name: 'João Pedro Santos', email: 'joao@startupsp.com', phone: '+55 11 91234-5678', source: 'social', status: 'novo', value: 5000, notes: 'Startup de fintech, quer automação de leads', createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-06-01T08:00:00Z' },
  { id: 'lead-004', name: 'Ana Costa', email: 'ana@agenciamarketing.com', phone: '+55 31 97654-3210', source: 'anuncio', status: 'contatado', value: 15000, notes: 'Agência quer white-label do Luna', createdAt: '2026-05-25T14:00:00Z', updatedAt: '2026-05-28T16:00:00Z' },
  { id: 'lead-005', name: 'Bruno Mendes', email: 'bruno@ecommerceplus.com', phone: '+55 11 94567-8901', source: 'site', status: 'ganho', value: 22000, notes: 'Contrato fechado — implementação em 30 dias', createdAt: '2026-05-20T10:00:00Z', updatedAt: '2026-05-30T09:00:00Z' },
  { id: 'lead-006', name: 'Fernanda Lima', email: 'fernanda@consultoriahr.com', phone: '+55 21 93456-7890', source: 'outro', status: 'perdido', value: 6000, notes: 'Orçamento muito acima do esperado', createdAt: '2026-05-22T11:00:00Z', updatedAt: '2026-05-26T15:00:00Z' },
  { id: 'lead-007', name: 'Ricardo Almeida', email: 'ricardo@logisticafast.com', phone: '+55 11 92345-6789', source: 'indicacao', status: 'novo', value: 18000, notes: 'Empresa de logística, precisa de rastreamento em tempo real', createdAt: '2026-06-01T07:00:00Z', updatedAt: '2026-06-01T07:00:00Z' },
  { id: 'lead-008', name: 'Patrícia Souza', email: 'patricia@edtechbrasil.com', phone: '+55 31 98765-1234', source: 'social', status: 'contatado', value: 9500, notes: 'Plataforma EAD, quer chatbot integrado', createdAt: '2026-05-29T13:00:00Z', updatedAt: '2026-05-31T10:00:00Z' },
];

// ═══════════════════════════════════════════════════════════════════════════
// LEADS API
// ═══════════════════════════════════════════════════════════════════════════

router.get('/api/tools/leads', (req, res) => {
  const stored = readJSON('leads.json');
  const leads = stored.length > 0 ? stored : MOCK_LEADS;
  
  // Compute stats
  const stats = {
    total: leads.length,
    totalValue: leads.reduce((s, l) => s + (l.value || 0), 0),
    byStatus: {},
    bySource: {},
    recent: leads.filter(l => {
      const d = new Date(l.createdAt);
      return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
    }).length,
  };
  
  leads.forEach(l => {
    stats.byStatus[l.status] = (stats.byStatus[l.status] || 0) + 1;
    stats.bySource[l.source] = (stats.bySource[l.source] || 0) + 1;
  });
  
  res.json({ ok: true, leads, stats });
});

router.post('/api/tools/leads', (req, res) => {
  const { name, email, phone, source, status, value, notes } = req.body;
  if (!name?.trim()) return res.status(400).json({ ok: false, error: 'Nome obrigatório' });
  
  const leads = readJSON('leads.json');
  const newLead = {
    id: 'lead-' + Date.now().toString(36),
    name: name.trim(),
    email: email?.trim() || null,
    phone: phone?.trim() || null,
    source: source || 'site',
    status: status || 'novo',
    value: value ? parseFloat(value) : 0,
    notes: notes?.trim() || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  leads.unshift(newLead);
  writeJSON('leads.json', leads);
  res.json({ ok: true, lead: newLead });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASKS API
// ═══════════════════════════════════════════════════════════════════════════

router.get('/api/tools/tasks', (req, res) => {
  const tasks = readJSON('company-tasks.json');
  
  const stats = {
    total: tasks.length,
    byStatus: {},
    byPriority: {},
    overdue: 0,
    highPriority: 0,
  };
  
  const now = new Date();
  tasks.forEach(t => {
    stats.byStatus[t.status] = (stats.byStatus[t.status] || 0) + 1;
    stats.byPriority[t.priority] = (stats.byPriority[t.priority] || 0) + 1;
    if (t.priority === 'Alta') stats.highPriority++;
    if (t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed') {
      stats.overdue++;
    }
  });
  
  res.json({ ok: true, tasks, stats });
});

router.post('/api/tools/tasks', (req, res) => {
  const { title, description, priority, taskType, dueDate, assignedTo } = req.body;
  if (!title?.trim()) return res.status(400).json({ ok: false, error: 'Título obrigatório' });
  
  const tasks = readJSON('company-tasks.json');
  const newTask = {
    id: 'TSK-' + Date.now().toString(36).toUpperCase(),
    title: title.trim(),
    description: description?.trim() || '',
    status: 'pending',
    priority: priority || 'Média',
    taskType: taskType || 'one_time',
    dueDate: dueDate || null,
    addedBy: 'Luna Web',
    assignedTo: assignedTo || 'Abner',
    source: 'luna-web',
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: null,
    startedAt: null,
    completedAt: null,
  };
  tasks.unshift(newTask);
  writeJSON('company-tasks.json', tasks);
  res.json({ ok: true, task: newTask });
});

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS API
// ═══════════════════════════════════════════════════════════════════════════

router.get('/api/tools/stats', (req, res) => {
  const leads = readJSON('leads.json');
  const leadsData = leads.length > 0 ? leads : MOCK_LEADS;
  const tasks = readJSON('company-tasks.json');
  
  res.json({
    ok: true,
    stats: {
      leads: {
        total: leadsData.length,
        value: leadsData.reduce((s, l) => s + (l.value || 0), 0),
        recent: leadsData.filter(l => {
          const d = new Date(l.createdAt);
          return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
        }).length,
      },
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        highPriority: tasks.filter(t => t.priority === 'Alta').length,
      },
    }
  });
});

module.exports = router;
