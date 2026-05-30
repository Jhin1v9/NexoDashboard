/**
 * Voting Module Routes — extracted from Dashboard server.js
 * CEOs vote on actions; approved tool_actions auto-execute.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const VOTING_SESSIONS_FILE = path.join(DATA_DIR, 'voting-sessions.json');
const VOTING_VOTES_FILE = path.join(DATA_DIR, 'voting-votes.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const CEOs = ['abner', 'nonoke', 'elias'];

// Tool registry for auto-execute of approved actions
const votingToolRegistry = {
  async dashboardCreateTask(params) {
    const tasks = readJSON(TASKS_FILE) || [];
    const newTask = {
      id: generateId('task'),
      title: params.title || 'Untitled Task',
      description: params.description || '',
      priority: params.priority || 'medium',
      status: 'pending',
      createdAt: new Date().toISOString(),
      assignee: params.assignee || null,
      tags: params.tags || [],
      comments: [],
      addedBy: 'voting-auto',
      source: 'voting'
    };
    tasks.push(newTask);
    writeJSON(TASKS_FILE, tasks);
    return { success: true, task: newTask };
  },
  async dashboardUpdateTask(params) {
    const tasks = readJSON(TASKS_FILE) || [];
    const idx = tasks.findIndex(t => t.id === params.taskId);
    if (idx === -1) throw new Error(`Task ${params.taskId} not found`);
    tasks[idx] = { ...tasks[idx], ...params.updates, updatedAt: new Date().toISOString() };
    writeJSON(TASKS_FILE, tasks);
    return { success: true, task: tasks[idx] };
  },
  async dashboardDeleteTask(params) {
    const tasks = readJSON(TASKS_FILE) || [];
    const filtered = tasks.filter(t => t.id !== params.taskId);
    writeJSON(TASKS_FILE, filtered);
    return { success: true, deleted: params.taskId };
  }
};

async function executeVotingTool(toolName, toolParams) {
  const tool = votingToolRegistry[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not found in registry`);
  return await tool(toolParams);
}

module.exports = function(app, { requireAuth }) {
  // GET /api/voting/sessions
  app.get('/api/voting/sessions', requireAuth, async (req, res) => {
    try {
      const sessions = readJSON(VOTING_SESSIONS_FILE, []);
      const { page = 1, limit = 20, status, filter, createdBy } = req.query;
      let filtered = [...sessions];
      if (status) filtered = filtered.filter(s => s.status === status);
      if (createdBy === 'me') filtered = filtered.filter(s => s.createdBy === req.user.userId);
      else if (createdBy) filtered = filtered.filter(s => s.createdBy === createdBy);
      if (filter) {
        const f = filter.toLowerCase();
        filtered = filtered.filter(s => s.title.toLowerCase().includes(f) || (s.description || '').toLowerCase().includes(f));
      }
      filtered.sort((a, b) => {
        const statusOrder = { open: 0, voting: 1, approved: 2, rejected: 3, closed: 4 };
        const sa = statusOrder[a.status] ?? 99;
        const sb = statusOrder[b.status] ?? 99;
        if (sa !== sb) return sa - sb;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      const start = (page - 1) * limit;
      const paginated = filtered.slice(start, start + parseInt(limit));
      res.json({
        sessions: paginated,
        pagination: { page: parseInt(page), limit: parseInt(limit), total: filtered.length, pages: Math.ceil(filtered.length / limit) }
      });
    } catch (err) {
      console.error('[API] Error listing sessions:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/voting/sessions/:id
  app.get('/api/voting/sessions/:id', requireAuth, async (req, res) => {
    try {
      const sessions = readJSON(VOTING_SESSIONS_FILE, []);
      const session = sessions.find(s => s.id === req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/voting/sessions
  app.post('/api/voting/sessions', requireAuth, async (req, res) => {
    try {
      const { title, description, type = 'generic', toolName, toolParams, quorumRequired = 3 } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });
      if (!['tool_action', 'generic'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
      if (type === 'tool_action' && !toolName) return res.status(400).json({ error: 'toolName required for tool_action type' });
      if (![2, 3].includes(parseInt(quorumRequired))) return res.status(400).json({ error: 'quorumRequired must be 2 or 3' });

      const sessions = readJSON(VOTING_SESSIONS_FILE, []);
      const votes = {};
      CEOs.forEach(ceo => { votes[ceo] = null; });

      const newSession = {
        id: generateId('sess'),
        title,
        description: description || '',
        type,
        toolName: type === 'tool_action' ? toolName : null,
        toolParams: type === 'tool_action' ? (toolParams || {}) : null,
        status: 'open',
        quorumRequired: parseInt(quorumRequired),
        createdBy: req.user.userId,
        createdAt: new Date().toISOString(),
        closedAt: null,
        result: null,
        executionResult: null,
        votes
      };

      sessions.push(newSession);
      writeJSON(VOTING_SESSIONS_FILE, sessions);
      res.status(201).json(newSession);
    } catch (err) {
      console.error('[API] Error creating session:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/voting/sessions/:id/vote
  app.post('/api/voting/sessions/:id/vote', requireAuth, async (req, res) => {
    try {
      const { vote, comment = '' } = req.body;
      const username = req.user.userId;
      if (!vote || !['yes', 'no'].includes(vote)) {
        return res.status(400).json({ error: 'Vote must be "yes" or "no"' });
      }
      const sessions = readJSON(VOTING_SESSIONS_FILE, []);
      const sessionIdx = sessions.findIndex(s => s.id === req.params.id);
      if (sessionIdx === -1) return res.status(404).json({ error: 'Session not found' });

      const session = sessions[sessionIdx];
      if (session.status !== 'open' && session.status !== 'voting') {
        return res.status(400).json({ error: `Session is ${session.status}, cannot vote` });
      }
      if (!CEOs.includes(username)) {
        return res.status(403).json({ error: 'Only CEOs can vote' });
      }

      const votedAt = new Date().toISOString();
      session.votes[username] = { vote, votedAt, comment };
      if (session.status === 'open') session.status = 'voting';

      const auditVotes = readJSON(VOTING_VOTES_FILE, []);
      auditVotes.push({ id: generateId('vote'), sessionId: session.id, voter: username, vote, comment, votedAt });
      writeJSON(VOTING_VOTES_FILE, auditVotes);

      const yesVotes = Object.values(session.votes).filter(v => v && v.vote === 'yes').length;
      const noVotes = Object.values(session.votes).filter(v => v && v.vote === 'no').length;
      const totalCEOs = CEOs.length;
      let autoExecuteResult = null;

      if (noVotes >= 1) {
        session.status = 'rejected';
        session.result = 'rejected';
        session.closedAt = votedAt;
      } else if (yesVotes >= session.quorumRequired) {
        session.status = 'approved';
        session.result = 'approved';
        session.closedAt = votedAt;
        if (session.type === 'tool_action' && session.toolName) {
          try {
            autoExecuteResult = await executeVotingTool(session.toolName, session.toolParams || {});
            session.executionResult = autoExecuteResult;
          } catch (execErr) {
            console.error('[AUTO-EXECUTE] Error:', execErr.message);
            session.executionResult = { success: false, error: execErr.message };
          }
        }
      } else {
        const votedCount = Object.values(session.votes).filter(v => v !== null).length;
        if (votedCount >= totalCEOs && yesVotes < session.quorumRequired && noVotes === 0) {
          session.status = 'closed';
          session.result = 'closed_without_quorum';
          session.closedAt = votedAt;
        }
      }

      sessions[sessionIdx] = session;
      writeJSON(VOTING_SESSIONS_FILE, sessions);

      res.json({
        session,
        yourVote: { vote, votedAt, comment },
        tally: { yes: yesVotes, no: noVotes, pending: totalCEOs - yesVotes - noVotes },
        autoExecuted: session.type === 'tool_action' && session.status === 'approved' ? session.executionResult : null
      });
    } catch (err) {
      console.error('[API] Error voting:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/voting/sessions/:id
  app.delete('/api/voting/sessions/:id', requireAuth, async (req, res) => {
    try {
      const sessions = readJSON(VOTING_SESSIONS_FILE, []);
      const sessionIdx = sessions.findIndex(s => s.id === req.params.id);
      if (sessionIdx === -1) return res.status(404).json({ error: 'Session not found' });
      const session = sessions[sessionIdx];
      if (session.createdBy !== req.user.userId) {
        return res.status(403).json({ error: 'Only the creator can delete this session' });
      }
      if (session.status !== 'open' && session.status !== 'voting') {
        return res.status(400).json({ error: 'Cannot delete a closed session' });
      }
      const deleted = sessions.splice(sessionIdx, 1)[0];
      writeJSON(VOTING_SESSIONS_FILE, sessions);
      res.json({ message: 'Session deleted', session: deleted });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/voting/sessions/:id/votes
  app.get('/api/voting/sessions/:id/votes', requireAuth, async (req, res) => {
    try {
      const auditVotes = readJSON(VOTING_VOTES_FILE, []);
      res.json(auditVotes.filter(v => v.sessionId === req.params.id));
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/voting/telegram-vote
  app.post('/api/voting/telegram-vote', async (req, res) => {
    try {
      const { sessionId, voter, vote, secret } = req.body;
      const expectedSecret = process.env.TELEGRAM_BOT_TOKEN;
      if (!expectedSecret || secret !== expectedSecret) {
        return res.status(403).json({ error: 'Invalid secret' });
      }
      if (!sessionId || !voter || !vote || !['yes', 'no'].includes(vote)) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }
      if (!CEOs.includes(voter)) {
        return res.status(403).json({ error: 'Only CEOs can vote' });
      }
      const sessions = readJSON(VOTING_SESSIONS_FILE, []);
      const sessionIdx = sessions.findIndex(s => s.id === sessionId);
      if (sessionIdx === -1) return res.status(404).json({ error: 'Session not found' });
      const session = sessions[sessionIdx];
      if (session.status !== 'open' && session.status !== 'voting') {
        return res.status(400).json({ error: `Session is ${session.status}, cannot vote` });
      }
      const votedAt = new Date().toISOString();
      session.votes[voter] = { vote, votedAt, comment: 'Telegram' };
      if (session.status === 'open') session.status = 'voting';

      const auditVotes = readJSON(VOTING_VOTES_FILE, []);
      auditVotes.push({ id: generateId('vote'), sessionId, voter, vote, comment: 'Telegram', votedAt });
      writeJSON(VOTING_VOTES_FILE, auditVotes);

      const yesVotes = Object.values(session.votes).filter(v => v && v.vote === 'yes').length;
      const noVotes = Object.values(session.votes).filter(v => v && v.vote === 'no').length;
      if (noVotes >= 1) {
        session.status = 'rejected'; session.result = 'rejected'; session.closedAt = votedAt;
      } else if (yesVotes >= session.quorumRequired) {
        session.status = 'approved'; session.result = 'approved'; session.closedAt = votedAt;
      }
      sessions[sessionIdx] = session;
      writeJSON(VOTING_SESSIONS_FILE, sessions);
      res.json({ session, voter, vote, votedAt });
    } catch (err) {
      console.error('[API] Error telegram vote:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};
