/**
 * Voting Module Routes — extracted from Dashboard server.js
 * CEOs vote on actions; approved tool_actions auto-execute.
 *
 * FIXES APPLIED (v1.1):
 * - File-level locking prevents race conditions on concurrent read-modify-write
 * - generateId uses crypto.randomUUID() instead of Date.now()+Math.random()
 * - CEO list loaded from VOTING_CEO_USERS env var (fallback to hardcoded)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Telegram notifier for voting notifications
let telegramNotifier = null;
try {
  telegramNotifier = require('./services/telegram-notifier');
} catch (e) {
  console.warn('[Voting] telegram-notifier não disponível:', e.message);
}

const DATA_DIR = path.join(__dirname, 'data');
const VOTING_SESSIONS_FILE = path.join(DATA_DIR, 'voting-sessions.json');
const VOTING_VOTES_FILE = path.join(DATA_DIR, 'voting-votes.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// ============================================================
// ATOMIC FILE OPERATIONS (prevents race conditions)
// ============================================================
const fileLocks = new Map();

async function withFileLock(file, fn) {
  const key = String(file);
  while (fileLocks.get(key)) {
    await new Promise(r => setTimeout(r, 10));
  }
  fileLocks.set(key, true);
  try {
    return fn();
  } finally {
    fileLocks.set(key, false);
  }
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch { return fallback; }
}

async function writeJSON(file, data) {
  await withFileLock(file, () => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  });
}

/**
 * Atomic read-modify-write for JSON files.
 * The modifier receives the current data and should return the new data.
 * Lock is held for the entire duration.
 */
async function withJSONFile(file, fallback, modifier) {
  await withFileLock(file, () => {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      data = fallback;
    }
    const result = modifier(data);
    if (result !== undefined) {
      fs.writeFileSync(file, JSON.stringify(result, null, 2), 'utf-8');
    }
  });
}

function generateId(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID()}`;
}

const CEOs = (process.env.VOTING_CEO_USERS || 'abner,nonoke,elias')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

// Tool registry for auto-execute of approved actions
const votingToolRegistry = {
  async dashboardCreateTask(params) {
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
    await withJSONFile(TASKS_FILE, [], (tasks) => {
      tasks.push(newTask);
      return tasks;
    });
    return { success: true, task: newTask };
  },
  async dashboardUpdateTask(params) {
    let updated = null;
    await withJSONFile(TASKS_FILE, [], (tasks) => {
      const idx = tasks.findIndex(t => t.id === params.taskId);
      if (idx === -1) throw new Error(`Task ${params.taskId} not found`);
      tasks[idx] = { ...tasks[idx], ...params.updates, updatedAt: new Date().toISOString() };
      updated = tasks[idx];
      return tasks;
    });
    return { success: true, task: updated };
  },
  async dashboardDeleteTask(params) {
    await withJSONFile(TASKS_FILE, [], (tasks) => {
      return tasks.filter(t => t.id !== params.taskId);
    });
    return { success: true, deleted: params.taskId };
  }
};

async function executeVotingTool(toolName, toolParams) {
  const tool = votingToolRegistry[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not found in registry`);
  return await tool(toolParams);
}

module.exports = function(app, { requireAuth, dataStore }) {
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
      const { title, description, type = 'generic', toolName, toolParams, quorumRequired = 3, linkedTimelineId, linkedRoadmapId, reviewMeetingAt } = req.body;
      if (!title) return res.status(400).json({ error: 'Title is required' });
      if (!['tool_action', 'generic', 'review'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
      if (type === 'tool_action' && !toolName) return res.status(400).json({ error: 'toolName required for tool_action type' });
      if (![2, 3].includes(parseInt(quorumRequired))) return res.status(400).json({ error: 'quorumRequired must be 2 or 3' });

      const votes = {};
      CEOs.forEach(ceo => { votes[ceo] = null; });

      const newSession = {
        id: generateId('sess'),
        title,
        description: description || '',
        type,
        toolName: type === 'tool_action' ? toolName : null,
        toolParams: type === 'tool_action' ? (toolParams || {}) : null,
        linkedTimelineId: linkedTimelineId || null,
        linkedRoadmapId: linkedRoadmapId || null,
        reviewMeetingAt: reviewMeetingAt || null,
        status: 'open',
        quorumRequired: parseInt(quorumRequired),
        createdBy: req.user.userId,
        createdAt: new Date().toISOString(),
        closedAt: null,
        result: null,
        executionResult: null,
        votes
      };

      await withJSONFile(VOTING_SESSIONS_FILE, [], (sessions) => {
        sessions.push(newSession);
        return sessions;
      });

      // Notificar Telegram
      if (telegramNotifier?.sendVotingNotification) {
        telegramNotifier.sendVotingNotification({ type: 'new', session: newSession }).catch(() => {});
      }

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
      if (!CEOs.includes(username)) {
        return res.status(403).json({ error: 'Only CEOs can vote' });
      }

      let resultSession = null;
      let yourVote = null;
      let tally = null;
      let autoExecuteResult = null;
      let notificationType = null;

      await withJSONFile(VOTING_SESSIONS_FILE, [], (sessions) => {
        const sessionIdx = sessions.findIndex(s => s.id === req.params.id);
        if (sessionIdx === -1) throw new Error('SESSION_NOT_FOUND');

        const session = sessions[sessionIdx];
        if (session.status !== 'open' && session.status !== 'voting') {
          throw new Error(`SESSION_CLOSED:${session.status}`);
        }

        const votedAt = new Date().toISOString();
        session.votes[username] = { vote, votedAt, comment };
        if (session.status === 'open') session.status = 'voting';

        const yesVotes = Object.values(session.votes).filter(v => v && v.vote === 'yes').length;
        const noVotes = Object.values(session.votes).filter(v => v && v.vote === 'no').length;
        const totalCEOs = CEOs.length;

        if (noVotes >= 1) {
          session.status = 'rejected';
          session.result = 'rejected';
          session.closedAt = votedAt;
          notificationType = 'rejected';
        } else if (yesVotes >= session.quorumRequired) {
          session.status = 'approved';
          session.result = 'approved';
          session.closedAt = votedAt;
          if (session.type === 'tool_action' && session.toolName) {
            // Auto-execute is async but we must return the modified sessions array.
            // We store a flag and execute after releasing the lock.
            session._pendingAutoExecute = true;
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
        resultSession = session;
        yourVote = { vote, votedAt, comment };
        tally = { yes: yesVotes, no: noVotes, pending: totalCEOs - yesVotes - noVotes };
        return sessions;
      });

      // If the session needs auto-execute, do it AFTER releasing the file lock
      if (resultSession && resultSession._pendingAutoExecute) {
        try {
          autoExecuteResult = await executeVotingTool(resultSession.toolName, resultSession.toolParams || {});
        } catch (execErr) {
          console.error('[AUTO-EXECUTE] Error:', execErr.message);
          autoExecuteResult = { success: false, error: execErr.message };
        }
        // Update session with execution result
        await withJSONFile(VOTING_SESSIONS_FILE, [], (sessions) => {
          const idx = sessions.findIndex(s => s.id === resultSession.id);
          if (idx !== -1) {
            sessions[idx].executionResult = autoExecuteResult;
            delete sessions[idx]._pendingAutoExecute;
          }
          return sessions;
        });
        resultSession.executionResult = autoExecuteResult;
        delete resultSession._pendingAutoExecute;
      }

      // If review vote approved, create completed task and update timeline
      if (resultSession && resultSession._pendingReviewTask && dataStore) {
        try {
          const task = {
            id: generateId('task'),
            title: `[REVISÃO APROVADA] ${resultSession.title}`,
            description: resultSession.description || 'Revisão em grupo aprovada por unanimidade.',
            status: 'completed',
            priority: 'high',
            source: 'roadmap_review',
            assigned_to: resultSession.createdBy,
            addedBy: 'voting-auto',
            comments: [],
            tags: ['revisão', 'aprovada'],
            metadata: {
              linked_roadmap_id: resultSession.linkedRoadmapId,
              linked_timeline_id: resultSession.linkedTimelineId,
              voting_session_id: resultSession.id
            },
            completed_at: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };
          await dataStore.saveCompanyTask(task);

          // Update timeline step if linked
          if (resultSession.linkedTimelineId) {
            const timeline = await dataStore.getTimelineById(resultSession.linkedTimelineId);
            if (timeline) {
              const steps = timeline.steps || [];
              const currentIdx = timeline.current_step_index || 0;
              if (steps[currentIdx]) {
                steps[currentIdx] = { ...steps[currentIdx], status: 'approved', vote_pending: false };
              }
              await dataStore.saveTimeline({
                ...timeline,
                steps,
                current_step_index: currentIdx,
                status: currentIdx >= steps.length - 1 ? 'completed' : timeline.status
              });
            }
          }

          autoExecuteResult = { success: true, taskCreated: task.id };
        } catch (reviewErr) {
          console.error('[REVIEW-AUTO] Error:', reviewErr.message);
          autoExecuteResult = { success: false, error: reviewErr.message };
        }
        // Update session
        await withJSONFile(VOTING_SESSIONS_FILE, [], (sessions) => {
          const idx = sessions.findIndex(s => s.id === resultSession.id);
          if (idx !== -1) {
            sessions[idx].executionResult = autoExecuteResult;
            delete sessions[idx]._pendingReviewTask;
          }
          return sessions;
        });
        resultSession.executionResult = autoExecuteResult;
        delete resultSession._pendingReviewTask;
      }

      // Write audit log
      const auditEntry = { id: generateId('vote'), sessionId: req.params.id, voter: username, vote, comment, votedAt: yourVote.votedAt };
      await withJSONFile(VOTING_VOTES_FILE, [], (auditVotes) => {
        auditVotes.push(auditEntry);
        return auditVotes;
      });

      // Notificar Telegram
      if (telegramNotifier?.sendVotingNotification) {
        if (notificationType) {
          telegramNotifier.sendVotingNotification({ type: notificationType, session: resultSession }).catch(() => {});
        } else if (resultSession.status === 'open' || resultSession.status === 'voting') {
          telegramNotifier.sendVotingNotification({ type: 'vote', session: resultSession, voter: username, voteValue: vote }).catch(() => {});
        }
      }

      res.json({
        session: resultSession,
        yourVote,
        tally,
        autoExecuted: resultSession.type === 'tool_action' && resultSession.status === 'approved' ? resultSession.executionResult : null
      });
    } catch (err) {
      if (err.message === 'SESSION_NOT_FOUND') {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (err.message.startsWith('SESSION_CLOSED:')) {
        return res.status(400).json({ error: `Session is ${err.message.split(':')[1]}, cannot vote` });
      }
      console.error('[API] Error voting:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/voting/sessions/:id
  app.delete('/api/voting/sessions/:id', requireAuth, async (req, res) => {
    try {
      let deleted = null;
      await withJSONFile(VOTING_SESSIONS_FILE, [], (sessions) => {
        const sessionIdx = sessions.findIndex(s => s.id === req.params.id);
        if (sessionIdx === -1) throw new Error('SESSION_NOT_FOUND');
        const session = sessions[sessionIdx];
        if (session.createdBy !== req.user.userId) {
          throw new Error('FORBIDDEN');
        }
        if (session.status !== 'open' && session.status !== 'voting') {
          throw new Error('SESSION_CLOSED');
        }
        deleted = sessions.splice(sessionIdx, 1)[0];
        return sessions;
      });
      res.json({ message: 'Session deleted', session: deleted });
    } catch (err) {
      if (err.message === 'SESSION_NOT_FOUND') return res.status(404).json({ error: 'Session not found' });
      if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'Only the creator can delete this session' });
      if (err.message === 'SESSION_CLOSED') return res.status(400).json({ error: 'Cannot delete a closed session' });
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

      let resultSession = null;

      await withJSONFile(VOTING_SESSIONS_FILE, [], (sessions) => {
        const sessionIdx = sessions.findIndex(s => s.id === sessionId);
        if (sessionIdx === -1) throw new Error('SESSION_NOT_FOUND');
        const session = sessions[sessionIdx];
        if (session.status !== 'open' && session.status !== 'voting') {
          throw new Error(`SESSION_CLOSED:${session.status}`);
        }
        const votedAt = new Date().toISOString();
        session.votes[voter] = { vote, votedAt, comment: 'Telegram' };
        if (session.status === 'open') session.status = 'voting';

        const yesVotes = Object.values(session.votes).filter(v => v && v.vote === 'yes').length;
        const noVotes = Object.values(session.votes).filter(v => v && v.vote === 'no').length;
        if (noVotes >= 1) {
          session.status = 'rejected'; session.result = 'rejected'; session.closedAt = votedAt;
        } else if (yesVotes >= session.quorumRequired) {
          session.status = 'approved'; session.result = 'approved'; session.closedAt = votedAt;
        }
        sessions[sessionIdx] = session;
        resultSession = session;
        return sessions;
      });

      // Write audit log
      const auditEntry = { id: generateId('vote'), sessionId, voter, vote, comment: 'Telegram', votedAt: new Date().toISOString() };
      await withJSONFile(VOTING_VOTES_FILE, [], (auditVotes) => {
        auditVotes.push(auditEntry);
        return auditVotes;
      });

      res.json({ session: resultSession, voter, vote, votedAt: auditEntry.votedAt });
    } catch (err) {
      if (err.message === 'SESSION_NOT_FOUND') return res.status(404).json({ error: 'Session not found' });
      if (err.message.startsWith('SESSION_CLOSED:')) return res.status(400).json({ error: `Session is ${err.message.split(':')[1]}, cannot vote` });
      console.error('[API] Error telegram vote:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};
