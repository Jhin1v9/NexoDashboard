/**
 * NEXO Dashboard — PostgreSQL Shadow Sync
 * Keeps PostgreSQL as the source of truth while maintaining JSON file compatibility.
 * On startup: restore from PG to JSON files.
 * On every write: sync from JSON to PG (fire-and-forget).
 */
const path = require('path');
const fs = require('fs');
const db = require('./db');
const ds = require('./datastore');

const DATA_DIR = path.join(__dirname, 'data');

const FILE_TO_TABLE = {
  'users.json': { type: 'users', handler: syncUsers },
  'tasks.json': { type: 'tasks', handler: syncTasks },
  'company-tasks.json': { type: 'company_tasks', handler: syncCompanyTasks },
  'payments.json': { type: 'payments', handler: syncPayments },
  'expenses.json': { type: 'expenses', handler: syncExpenses },
  'cash-box.json': { type: 'cash_box', handler: syncCashBox },
  'quotes.json': { type: 'quotes', handler: syncQuotes },
  'leads.json': { type: 'leads', handler: syncLeads },
  'members.json': { type: 'members', handler: syncMembers },
  'transactions.json': { type: 'transactions', handler: syncTransactions },
  'links-index.json': { type: 'links', handler: syncLinks },
  'changelog.json': { type: 'changelog', handler: syncChangelog },
  'notifications.json': { type: 'notifications', handler: syncNotifications },
  'security-log.json': { type: 'security_logs', handler: syncSecurityLogs },
  'whatsapp-history.json': { type: 'whatsapp_history', handler: syncWhatsAppHistory },
  'luna-chat-threads.json': { type: 'luna_threads', handler: syncLunaThreads },
  'luna-buffer.json': { type: 'luna_buffer', handler: syncLunaBuffer },
};

// ============================================================
// RESTORE: PG → JSON
// ============================================================

async function restoreUsers() {
  const data = await ds.getUsers();
  return data;
}

async function restoreTasks() {
  return await ds.getTasks();
}

async function restoreCompanyTasks() {
  return await ds.getCompanyTasks();
}

async function restorePayments() {
  return await ds.getPayments();
}

async function restoreExpenses() {
  return await ds.getExpenses();
}

async function restoreCashBox() {
  return await ds.getCashBox();
}

async function restoreQuotes() {
  return await ds.getQuotes();
}

async function restoreLeads() {
  const rows = await db.query('SELECT * FROM leads ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id, name: r.name, email: r.email, phone: r.phone,
    company: r.company, source: r.source, status: r.status,
    notes: r.notes, metadata: r.metadata,
    createdAt: r.created_at, updatedAt: r.updated_at
  }));
}

async function restoreMembers() {
  return await ds.getMembers();
}

async function restoreTransactions() {
  const rows = await db.query('SELECT * FROM transactions ORDER BY date DESC');
  return rows.map(r => ({
    id: r.id, date: r.date, type: r.type, amount: parseFloat(r.amount),
    description: r.description, category: r.category,
    balanceAfter: parseFloat(r.balance_after), recordedBy: r.recorded_by,
    recordedAt: r.recorded_at, note: r.note, source: r.source,
    isActive: r.is_active, deletedAt: r.deleted_at, deletedBy: r.deleted_by,
    metadata: r.metadata
  }));
}

async function restoreLinks() {
  const rows = await db.query('SELECT * FROM links ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id, url: r.url, author: r.author, timestamp: r.timestamp,
    chat: r.chat, notes: r.notes, manual: r.manual, preview: r.preview,
    platform: r.platform, patterns: r.patterns, icon: r.icon,
    color: r.color, category: r.category, label: r.label,
    hostname: r.hostname, enrichedAt: r.enriched_at, createdAt: r.created_at
  }));
}

async function restoreChangelog() {
  const rows = await db.query('SELECT * FROM changelog ORDER BY date DESC');
  return { version: '1.0', lastUpdated: new Date().toISOString(), entries: rows.map(r => ({
    id: r.id, version: r.version, title: r.title, description: r.description,
    category: r.category, emoji: r.emoji, author: r.author, tier: r.tier,
    date: r.date, tags: r.tags, readBy: r.read_by
  })) };
}

async function restoreNotifications() {
  const rows = await db.query('SELECT * FROM notifications ORDER BY timestamp DESC');
  return { version: '1.0', notifications: rows.map(r => ({
    id: r.id, type: r.type, title: r.title, message: r.message,
    severity: r.severity, read: r.read, timestamp: r.timestamp, metadata: r.metadata
  })) };
}

async function restoreSecurityLogs() {
  const rows = await db.query('SELECT * FROM security_logs ORDER BY created_at DESC');
  return { version: '1.0', events: rows.map(r => ({
    id: r.id, timestamp: r.created_at, type: r.event_type, severity: r.details?.severity,
    ip: r.ip, location: r.location ? { city: r.location.split(',')[0]?.trim(), country: r.location.split(',')[1]?.trim() } : {},
    attemptedUser: r.user_id, message: r.details?.message, notified: r.details?.notified,
    device: r.details?.device
  })) };
}

async function restoreWhatsAppHistory() {
  const rows = await db.query('SELECT * FROM whatsapp_history ORDER BY timestamp DESC');
  return rows.map(r => ({
    id: r.id, text: r.message, author: r.sender, chat: r.chat_id,
    timestamp: r.timestamp, classification: r.metadata?.classification,
    direction: r.metadata?.direction, resolvedAuthor: r.metadata?.resolvedAuthor
  }));
}

async function restoreLunaThreads() {
  const rows = await db.query('SELECT * FROM luna_threads ORDER BY updated_at DESC');
  const threads = {};
  rows.forEach(r => {
    threads[r.id] = {
      id: r.id, type: r.context?.type || 'individual',
      title: r.title, participants: r.context?.participants || [r.user_id],
      createdAt: r.created_at, updatedAt: r.updated_at,
      messageCount: r.messages?.length || 0, messages: r.messages || []
    };
  });
  return { version: '1.0', lastUpdated: new Date().toISOString(), threads };
}

async function restoreLunaBuffer() {
  const row = await db.get('SELECT * FROM luna_buffer WHERE id=1');
  return row?.data || { newMessages: [], newTasks: [] };
}

const RESTORE_MAP = {
  'users.json': restoreUsers,
  'tasks.json': restoreTasks,
  'company-tasks.json': restoreCompanyTasks,
  'payments.json': restorePayments,
  'expenses.json': restoreExpenses,
  'cash-box.json': restoreCashBox,
  'quotes.json': restoreQuotes,
  'leads.json': restoreLeads,
  'members.json': restoreMembers,
  'transactions.json': restoreTransactions,
  'links-index.json': restoreLinks,
  'changelog.json': restoreChangelog,
  'notifications.json': restoreNotifications,
  'security-log.json': restoreSecurityLogs,
  'whatsapp-history.json': restoreWhatsAppHistory,
  'luna-chat-threads.json': restoreLunaThreads,
  'luna-buffer.json': restoreLunaBuffer,
};

async function restoreAllFromPG() {
  console.log('🔄 Restoring data from PostgreSQL to JSON files...');
  for (const [filename, restoreFn] of Object.entries(RESTORE_MAP)) {
    try {
      const data = await restoreFn();
      const filepath = path.join(DATA_DIR, filename);
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      console.log(`  ✓ restored ${filename}`);
    } catch (err) {
      console.error(`  ✗ failed to restore ${filename}:`, err.message);
    }
  }
  console.log('✅ Restore complete.');
}

// ============================================================
// SYNC: JSON → PG
// ============================================================

async function syncUsers(data) {
  // data = { users: { ... }, active: 'abner' }
  if (!data?.users) return;
  for (const [id, u] of Object.entries(data.users)) {
    await ds.saveUser(id, u);
  }
}

async function syncTasks(data) {
  if (!Array.isArray(data)) return;
  for (const t of data) await ds.saveTask(t);
}

async function syncCompanyTasks(data) {
  if (!Array.isArray(data)) return;
  for (const t of data) await ds.saveCompanyTask(t);
}

async function syncPayments(data) {
  if (!Array.isArray(data)) return;
  for (const p of data) await ds.savePayment(p);
}

async function syncExpenses(data) {
  if (!Array.isArray(data)) return;
  for (const e of data) await ds.saveExpense(e);
}

async function syncCashBox(data) {
  if (!data || typeof data !== 'object') return;
  await ds.saveCashBox(data);
}

async function syncQuotes(data) {
  if (!Array.isArray(data)) return;
  for (const q of data) await ds.saveQuote(q);
}

async function syncLeads(data) {
  const leads = Array.isArray(data) ? data : (data?.leads || []);
  for (const l of leads) {
    await db.run(
      `INSERT INTO leads (id,name,email,phone,company,source,status,notes,metadata,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET name=$2, email=$3, phone=$4, company=$5, source=$6, status=$7, notes=$8, metadata=$9, updated_at=$11`,
      [l.id, l.name, l.email, l.phone, l.company, l.source, l.status, l.notes, JSON.stringify(l.metadata || {}), l.createdAt, l.updatedAt]
    );
  }
}

async function syncMembers(data) {
  if (!Array.isArray(data)) return;
  for (const m of data) {
    await db.run(
      `INSERT INTO members (id,name,role,skills,share_percent,status,projects,email,phone,country,joined_at,note,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET name=$2, role=$3, skills=$4, share_percent=$5, status=$6, projects=$7, email=$8, phone=$9, country=$10, joined_at=$11, note=$12, updated_at=$14`,
      [m.id, m.name, m.role, JSON.stringify(m.skills || []), m.sharePercent ?? 0, m.status, JSON.stringify(m.projects || []), m.email, m.phone, m.country, m.joinedAt, m.note, m.createdAt ?? new Date().toISOString(), m.updatedAt ?? new Date().toISOString()]
    );
  }
}

async function syncTransactions(data) {
  if (!Array.isArray(data)) return;
  for (const t of data) {
    await db.run(
      `INSERT INTO transactions (id,date,type,amount,description,category,balance_after,recorded_by,recorded_at,note,source,is_active,deleted_at,deleted_by,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET date=$2, type=$3, amount=$4, description=$5, category=$6, balance_after=$7, recorded_by=$8, recorded_at=$9, note=$10, source=$11, is_active=$12, deleted_at=$13, deleted_by=$14, metadata=$15`,
      [t.id, t.date, t.type, t.amount, t.description, t.category, t.balanceAfter, t.recordedBy, t.recordedAt, t.note, t.source, t.isActive ?? true, t.deletedAt, t.deletedBy, JSON.stringify(t.metadata || {})]
    );
  }
}

async function syncLinks(data) {
  const links = data?.links || data || [];
  for (const l of links) {
    await db.run(
      `INSERT INTO links (id,url,author,timestamp,chat,notes,manual,preview,platform,patterns,icon,color,category,label,hostname,enriched_at,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO UPDATE SET url=$2, author=$3, timestamp=$4, chat=$5, notes=$6, manual=$7, preview=$8, platform=$9, patterns=$10, icon=$11, color=$12, category=$13, label=$14, hostname=$15, enriched_at=$16`,
      [l.id, l.url, l.author, l.timestamp, l.chat, l.notes, l.manual ?? false, JSON.stringify(l.preview || {}), l.platform, JSON.stringify(l.patterns || []), l.icon, l.color, l.category, l.label, l.hostname, l.enrichedAt, l.createdAt]
    );
  }
}

async function syncChangelog(data) {
  const entries = data?.entries || data || [];
  for (const e of entries) {
    await db.run(
      `INSERT INTO changelog (id,version,title,description,category,emoji,author,tier,date,tags,read_by,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET version=$2, title=$3, description=$4, category=$5, emoji=$6, author=$7, tier=$8, date=$9, tags=$10, read_by=$11`,
      [e.id, e.version, e.title, e.description, e.category, e.emoji, e.author, e.tier, e.date, JSON.stringify(e.tags || []), JSON.stringify(e.readBy || []), e.date]
    );
  }
}

async function syncNotifications(data) {
  const notifs = data?.notifications || data || [];
  for (const n of notifs) {
    await db.run(
      `INSERT INTO notifications (id,type,title,message,severity,read,timestamp,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET type=$2, title=$3, message=$4, severity=$5, read=$6, timestamp=$7, metadata=$8`,
      [n.id, n.type, n.title, n.message, n.severity, n.read ?? false, n.timestamp, JSON.stringify(n.metadata || {}), n.timestamp]
    );
  }
}

async function syncSecurityLogs(data) {
  const events = data?.events || data || [];
  for (const e of events) {
    await db.run(
      `INSERT INTO security_logs (id,event_type,user_id,ip,location,user_agent,success,details,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET event_type=$2, user_id=$3, ip=$4, location=$5, user_agent=$6, success=$7, details=$8`,
      [e.id, e.type || e.eventType, e.attemptedUser || e.userId, e.ip,
       e.location ? (typeof e.location === 'string' ? e.location : `${e.location.city || ''}, ${e.location.country || ''}`) : '',
       e.device?.userAgent || e.userAgent, e.success ?? false,
       JSON.stringify({ device: e.device, severity: e.severity, notified: e.notified, message: e.message }),
       e.timestamp]
    );
  }
}

async function syncWhatsAppHistory(data) {
  if (!Array.isArray(data)) return;
  for (const m of data) {
    await db.run(
      `INSERT INTO whatsapp_history (id,chat_id,chat_name,sender,message,timestamp,type,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET chat_id=$2, chat_name=$3, sender=$4, message=$5, timestamp=$6, type=$7, metadata=$8`,
      [m.id || m.messageId, m.chatId || m.chat, m.chatName, m.sender || m.author,
       m.text || m.message || m.body, m.timestamp, m.type || 'text',
       JSON.stringify({ classification: m.classification, direction: m.direction, resolvedAuthor: m.resolvedAuthor }),
       m.timestamp]
    );
  }
}

async function syncLunaThreads(data) {
  const threads = data?.threads ? Object.values(data.threads) : (Array.isArray(data) ? data : []);
  for (const t of threads) {
    await db.run(
      `INSERT INTO luna_threads (id,user_id,title,messages,context,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET user_id=$2, title=$3, messages=$4, context=$5, updated_at=$7`,
      [t.id, t.participants?.[0] || t.userId, t.title, JSON.stringify(t.messages || []),
       JSON.stringify({ type: t.type, participants: t.participants, messageCount: t.messageCount }), t.createdAt, t.updatedAt]
    );
  }
}

async function syncLunaBuffer(data) {
  await db.run(
    `INSERT INTO luna_buffer (id,data,updated_at) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET data=$2, updated_at=$3`,
    [1, JSON.stringify(data), new Date().toISOString()]
  );
}

const SYNC_MAP = {
  'users.json': syncUsers,
  'tasks.json': syncTasks,
  'company-tasks.json': syncCompanyTasks,
  'payments.json': syncPayments,
  'expenses.json': syncExpenses,
  'cash-box.json': syncCashBox,
  'quotes.json': syncQuotes,
  'leads.json': syncLeads,
  'members.json': syncMembers,
  'transactions.json': syncTransactions,
  'links-index.json': syncLinks,
  'changelog.json': syncChangelog,
  'notifications.json': syncNotifications,
  'security-log.json': syncSecurityLogs,
  'whatsapp-history.json': syncWhatsAppHistory,
  'luna-chat-threads.json': syncLunaThreads,
  'luna-buffer.json': syncLunaBuffer,
};

async function syncFileToPG(filepath, data) {
  if (!process.env.DATABASE_URL) return;
  const filename = path.basename(filepath);
  const syncFn = SYNC_MAP[filename];
  if (!syncFn) return; // Unknown file, skip
  try {
    await syncFn(data);
  } catch (err) {
    console.error(`[pg-sync] Failed to sync ${filename}:`, err.message);
  }
}

module.exports = {
  restoreAllFromPG,
  syncFileToPG,
  RESTORE_MAP,
  SYNC_MAP,
};
