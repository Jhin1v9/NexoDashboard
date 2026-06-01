/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Luna Tools API — Proxy to Dashboard PRO (port 3456)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * All reads/writes go to Dashboard PRO via HTTP. No local JSON files.
 * ═══════════════════════════════════════════════════════════════════════════
 */
const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const router = express.Router();

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3456';
const JWT_SECRET = process.env.JWT_SECRET || 'nexo-test-secret-2026';

// Service token for Dashboard PRO authentication
function getServiceToken() {
  return jwt.sign(
    { userId: 'luna-web', name: 'Luna Web', role: 'Admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function dashboardRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const token = getServiceToken();
    const options = {
      hostname: 'localhost',
      port: 3456,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADS API → proxy to Dashboard PRO /api/leads
// ═══════════════════════════════════════════════════════════════════════════

router.get('/api/tools/leads', async (req, res) => {
  try {
    const result = await dashboardRequest('/api/leads');
    if (result.status !== 200 || !result.body.success) {
      return res.status(502).json({ ok: false, error: 'Dashboard PRO indisponível' });
    }
    const leads = result.body.leads || [];

    // Compute stats in Luna Web format
    const stats = {
      total: leads.length,
      totalValue: leads.reduce((s, l) => s + (l.estimatedValue || l.value || 0), 0),
      byStatus: {},
      bySource: {},
      recent: leads.filter(l => {
        const d = new Date(l.createdAt);
        return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
      }).length,
    };
    leads.forEach(l => {
      const st = l.pipelineStatus || l.status || 'novo';
      stats.byStatus[st] = (stats.byStatus[st] || 0) + 1;
      stats.bySource[l.source || 'outro'] = (stats.bySource[l.source || 'outro'] || 0) + 1;
    });

    res.json({ ok: true, leads, stats });
  } catch (e) {
    console.error('[LunaTools] leads GET error:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

router.post('/api/tools/leads', async (req, res) => {
  try {
    const { name, email, phone, source, status, value, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ ok: false, error: 'Nome obrigatório' });

    const result = await dashboardRequest('/api/leads', 'POST', {
      displayName: name.trim(),
      name: name.trim(),
      email: email || '',
      phone: phone || '',
      source: source || 'luna-web',
      estimatedValue: value ? parseFloat(value) : 0,
      notes: notes || '',
      assignedTo: 'abner'
    });

    if (result.status !== 200 || !result.body.success) {
      return res.status(502).json({ ok: false, error: result.body.error || 'Erro ao criar lead no Dashboard' });
    }
    res.json({ ok: true, lead: result.body.lead });
  } catch (e) {
    console.error('[LunaTools] leads POST error:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TASKS API → proxy to Dashboard PRO /api/tasks
// ═══════════════════════════════════════════════════════════════════════════

router.get('/api/tools/tasks', async (req, res) => {
  try {
    const result = await dashboardRequest('/api/tasks');
    if (result.status !== 200 || !Array.isArray(result.body)) {
      return res.status(502).json({ ok: false, error: 'Dashboard PRO indisponível' });
    }
    const tasks = result.body;

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
      if (t.priority === 'high' || t.priority === 'Alta') stats.highPriority++;
      if (t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed') {
        stats.overdue++;
      }
    });

    res.json({ ok: true, tasks, stats });
  } catch (e) {
    console.error('[LunaTools] tasks GET error:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

router.post('/api/tools/tasks', async (req, res) => {
  try {
    const { title, description, priority, taskType, dueDate, assignedTo } = req.body;
    if (!title?.trim()) return res.status(400).json({ ok: false, error: 'Título obrigatório' });

    const result = await dashboardRequest('/api/tasks', 'POST', {
      title: title.trim(),
      description: description || '',
      priority: priority === 'Alta' ? 'high' : (priority === 'Baixa' ? 'low' : 'high'),
      taskType: taskType || 'one_time',
      dueDate: dueDate || null,
      assignedTo: assignedTo || 'abner'
    });

    if (result.status !== 200 || !result.body.id) {
      return res.status(502).json({ ok: false, error: 'Erro ao criar tarefa no Dashboard' });
    }
    res.json({ ok: true, task: result.body });
  } catch (e) {
    console.error('[LunaTools] tasks POST error:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS API → aggregate from Dashboard PRO
// ═══════════════════════════════════════════════════════════════════════════

router.get('/api/tools/stats', async (req, res) => {
  try {
    const [leadsRes, tasksRes] = await Promise.all([
      dashboardRequest('/api/leads'),
      dashboardRequest('/api/tasks')
    ]);

    const leads = (leadsRes.status === 200 && leadsRes.body.success) ? (leadsRes.body.leads || []) : [];
    const tasks = (tasksRes.status === 200 && Array.isArray(tasksRes.body)) ? tasksRes.body : [];

    res.json({
      ok: true,
      stats: {
        leads: {
          total: leads.length,
          value: leads.reduce((s, l) => s + (l.estimatedValue || l.value || 0), 0),
          recent: leads.filter(l => {
            const d = new Date(l.createdAt);
            return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
          }).length,
        },
        tasks: {
          total: tasks.length,
          pending: tasks.filter(t => t.status === 'pending').length,
          inProgress: tasks.filter(t => t.status === 'in_progress').length,
          completed: tasks.filter(t => t.status === 'completed').length,
          highPriority: tasks.filter(t => t.priority === 'Alta' || t.priority === 'high').length,
        },
      }
    });
  } catch (e) {
    console.error('[LunaTools] stats error:', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
});

module.exports = router;
