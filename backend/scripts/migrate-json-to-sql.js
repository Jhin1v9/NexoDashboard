#!/usr/bin/env node
/**
 * NEXO Dashboard — JSON to PostgreSQL Migration Script
 * Reads all JSON data files and inserts into PostgreSQL tables.
 * Usage: DATABASE_URL=postgresql://... node migrate-json-to-sql.js
 */
const fs = require('fs');
const path = require('path');
const db = require('../db');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJSON(filename, defaultValue = null) {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return defaultValue;
  }
}

async function migrateUsers() {
  const data = readJSON('users.json');
  if (!data?.users) return;
  for (const [id, u] of Object.entries(data.users)) {
    await db.run(
      `INSERT INTO users (id,name,role,color,password) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [id, u.name, u.role, u.color, u.password]
    );
  }
  console.log('  ✓ users');
}

async function migrateTasks() {
  const data = readJSON('tasks.json', []);
  for (const t of data) {
    await db.run(
      `INSERT INTO tasks (id,title,description,status,priority,task_type,due_date,added_by,assigned_to,source,comments,created_at,updated_at,started_at,completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [
        t.id, t.title, t.description, t.status, t.priority, t.taskType,
        t.dueDate, t.addedBy, t.assignedTo, t.source,
        JSON.stringify(t.comments || []),
        t.createdAt, t.updatedAt, t.startedAt, t.completedAt
      ]
    );
  }
  console.log(`  ✓ tasks (${data.length})`);
}

async function migrateCompanyTasks() {
  const data = readJSON('company-tasks.json', []);
  for (const t of data) {
    await db.run(
      `INSERT INTO company_tasks (id,title,description,status,priority,task_type,due_date,added_by,assigned_to,source,comments,created_at,updated_at,started_at,completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [
        t.id, t.title, t.description, t.status, t.priority, t.taskType,
        t.dueDate, t.addedBy, t.assignedTo, t.source,
        JSON.stringify(t.comments || []),
        t.createdAt, t.updatedAt, t.startedAt, t.completedAt
      ]
    );
  }
  console.log(`  ✓ company_tasks (${data.length})`);
}

async function migrateIdeas() {
  const data = readJSON('ideas-registry.json');
  if (!data) return;
  // ideas-registry has nested structure: categories, templates, and actual ideas
  // We extract ideas from various possible locations
  const ideas = [];
  if (Array.isArray(data.ideas)) {
    ideas.push(...data.ideas);
  }
  // Also check if ideas are stored under other keys
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith('idea-') && val && typeof val === 'object') {
      ideas.push(val);
    }
  }
  for (const idea of ideas) {
    await db.run(
      `INSERT INTO ideas (id,title,summary,status,category,priority,author,tags,blocks,metadata,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        idea.id || idea.ideaId || `idea-${Date.now()}`,
        idea.title,
        idea.summary,
        idea.status,
        idea.category,
        idea.priority,
        idea.author,
        JSON.stringify(idea.tags || []),
        JSON.stringify(idea.blocks || []),
        JSON.stringify(idea.metadata || {}),
        idea.createdAt,
        idea.updatedAt
      ]
    );
  }
  console.log(`  ✓ ideas (${ideas.length})`);
}

async function migratePayments() {
  const data = readJSON('payments.json', []);
  for (const p of data) {
    await db.run(
      `INSERT INTO payments (id,name,client_id,client_name,project_id,project_name,amount_value,amount_currency,status,due_date,paid_date,installments,notes,created_by,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id || p.paymentId, p.name, p.clientId, p.clientName, p.projectId, p.projectName,
        p.amount?.value ?? p.amount ?? 0,
        p.amount?.currency ?? 'EUR',
        p.status, p.dueDate, p.paidDate,
        JSON.stringify(p.installments || []),
        p.notes, p.createdBy, p.createdAt, p.updatedAt
      ]
    );
  }
  console.log(`  ✓ payments (${data.length})`);
}

async function migrateExpenses() {
  const data = readJSON('expenses.json', []);
  for (const e of data) {
    await db.run(
      `INSERT INTO expenses (id,name,description,amount_value,amount_currency,cost_per_person_value,cost_per_person_currency,type,period,period_label,start_date,renew_date,end_date,category,category_label,split_among,paid_by,fully_paid,auto_deduct_from_cash_box,notes,attachments,created_by,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       ON CONFLICT (id) DO NOTHING`,
      [
        e.id, e.name, e.description,
        e.amount?.value ?? e.amount ?? 0,
        e.amount?.currency ?? 'EUR',
        e.costPerPerson?.value ?? e.costPerPerson ?? 0,
        e.costPerPerson?.currency ?? 'EUR',
        e.type, e.period, e.periodLabel,
        e.startDate, e.renewDate, e.endDate,
        e.category, e.categoryLabel,
        JSON.stringify(e.splitAmong || []),
        JSON.stringify(e.paidBy || {}),
        e.fullyPaid ?? false,
        e.autoDeductFromCashBox ?? true,
        e.notes,
        JSON.stringify(e.attachments || []),
        e.createdBy, e.createdAt, e.updatedAt
      ]
    );
  }
  console.log(`  ✓ expenses (${data.length})`);
}

async function migrateCashBox() {
  const data = readJSON('cash-box.json');
  if (!data) return;
  await db.run(
    `INSERT INTO cash_box (id,balance_value,balance_currency,monthly_income_value,monthly_income_currency,monthly_expenses_value,monthly_expenses_currency,projected_balance_value,projected_balance_currency,projection_months,incoming_payments,outgoing_expenses,history,last_updated)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (id) DO NOTHING`,
    [
      1,
      data.balance?.value ?? data.balance ?? 0,
      data.balance?.currency ?? 'EUR',
      data.monthlyIncome?.value ?? 0,
      data.monthlyIncome?.currency ?? 'EUR',
      data.monthlyExpenses?.value ?? 0,
      data.monthlyExpenses?.currency ?? 'EUR',
      data.projectedBalance?.value ?? 0,
      data.projectedBalance?.currency ?? 'EUR',
      data.projectionMonths ?? 3,
      JSON.stringify(data.incomingPayments || []),
      JSON.stringify(data.outgoingExpenses || []),
      JSON.stringify(data.history || []),
      data.lastUpdated
    ]
  );
  console.log('  ✓ cash_box');
}

async function migrateQuotes() {
  const data = readJSON('quotes.json', []);
  for (const q of data) {
    await db.run(
      `INSERT INTO quotes (id,project_id,project_name,client_name,client_id,status,status_label,total_amount_value,total_amount_currency,monthly_fee_value,monthly_fee_currency,year1_investment_value,year1_investment_currency,discount_percent,discount_amount,discount_currency,created_at,sent_at,valid_until,github_url,items,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       ON CONFLICT (id) DO NOTHING`,
      [
        q.quoteId || q.id, q.projectId, q.projectName, q.clientName, q.clientId,
        q.status, q.statusLabel,
        q.totalAmount?.value ?? q.totalAmount ?? 0,
        q.totalAmount?.currency ?? 'EUR',
        q.monthlyFee?.value ?? 0,
        q.monthlyFee?.currency ?? 'EUR',
        q.year1Investment?.value ?? 0,
        q.year1Investment?.currency ?? 'EUR',
        q.discountUpfront?.percent ?? q.discount?.percent ?? 0,
        q.discountUpfront?.amount ?? q.discount?.amount ?? 0,
        q.discountUpfront?.currency ?? q.discount?.currency ?? 'EUR',
        q.createdAt, q.sentAt, q.validUntil,
        q.githubUrl, JSON.stringify(q.items || []),
        q.updatedAt
      ]
    );
  }
  console.log(`  ✓ quotes (${data.length})`);
}

async function migrateLeads() {
  const data = readJSON('leads.json', []);
  for (const l of data) {
    await db.run(
      `INSERT INTO leads (id,name,email,phone,company,source,status,notes,metadata,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [
        l.id || l.leadId, l.name, l.email, l.phone, l.company,
        l.source, l.status, l.notes,
        JSON.stringify(l.metadata || {}),
        l.createdAt, l.updatedAt
      ]
    );
  }
  console.log(`  ✓ leads (${data.length})`);
}

async function migrateMembers() {
  const data = readJSON('members.json', []);
  for (const m of data) {
    await db.run(
      `INSERT INTO members (id,name,role,skills,share_percent,status,projects,email,phone,country,joined_at,note,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO NOTHING`,
      [
        m.id, m.name, m.role,
        JSON.stringify(m.skills || []),
        m.sharePercent ?? 0, m.status,
        JSON.stringify(m.projects || []),
        m.email, m.phone, m.country, m.joinedAt,
        m.note,
        m.createdAt ?? new Date().toISOString(),
        m.updatedAt ?? new Date().toISOString()
      ]
    );
  }
  console.log(`  ✓ members (${data.length})`);
}

async function migrateTransactions() {
  const data = readJSON('transactions.json', []);
  for (const t of data) {
    await db.run(
      `INSERT INTO transactions (id,date,type,amount,description,category,balance_after,recorded_by,recorded_at,note,source,is_active,deleted_at,deleted_by,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [
        t.id, t.date, t.type, t.amount, t.description, t.category,
        t.balanceAfter, t.recordedBy, t.recordedAt, t.note, t.source,
        t.isActive ?? true, t.deletedAt, t.deletedBy,
        JSON.stringify(t.metadata || {})
      ]
    );
  }
  console.log(`  ✓ transactions (${data.length})`);
}

async function migrateLinks() {
  const data = readJSON('links-index.json');
  const links = data?.links || data || [];
  for (const l of links) {
    await db.run(
      `INSERT INTO links (id,url,author,timestamp,chat,notes,manual,preview,platform,patterns,icon,color,category,label,hostname,enriched_at,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      [
        l.id, l.url, l.author, l.timestamp, l.chat, l.notes,
        l.manual ?? false, JSON.stringify(l.preview || {}),
        l.platform, JSON.stringify(l.patterns || []),
        l.icon, l.color, l.category, l.label, l.hostname,
        l.enrichedAt, l.createdAt
      ]
    );
  }
  console.log(`  ✓ links (${links.length})`);
}

async function migrateChangelog() {
  const data = readJSON('changelog.json');
  const entries = data?.entries || data || [];
  for (const e of entries) {
    await db.run(
      `INSERT INTO changelog (id,version,title,description,category,emoji,author,tier,date,tags,read_by,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        e.id || e.changelogId, e.version, e.title, e.description,
        e.category, e.emoji, e.author, e.tier, e.date,
        JSON.stringify(e.tags || []),
        JSON.stringify(e.readBy || []),
        e.date || e.createdAt
      ]
    );
  }
  console.log(`  ✓ changelog (${entries.length})`);
}

async function migrateNotifications() {
  const data = readJSON('notifications.json');
  const notifs = data?.notifications || data || [];
  for (const n of notifs) {
    await db.run(
      `INSERT INTO notifications (id,type,title,message,severity,read,timestamp,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        n.id || n.notifId, n.type, n.title, n.message,
        n.severity, n.read ?? false, n.timestamp,
        JSON.stringify(n.metadata || {}), n.timestamp
      ]
    );
  }
  console.log(`  ✓ notifications (${notifs.length})`);
}

async function migrateSecurityLogs() {
  const data = readJSON('security-log.json');
  const events = data?.events || data || [];
  for (const e of events) {
    await db.run(
      `INSERT INTO security_logs (id,event_type,user_id,ip,location,user_agent,success,details,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        e.id || e.eventId, e.type || e.eventType,
        e.attemptedUser || e.userId,
        e.ip,
        e.location ? `${e.location.city || ''}, ${e.location.country || ''}` : '',
        e.device?.userAgent || e.userAgent,
        e.success ?? false,
        JSON.stringify({ device: e.device, severity: e.severity, notified: e.notified }),
        e.timestamp
      ]
    );
  }
  console.log(`  ✓ security_logs (${events.length})`);
}

async function migrateWhatsAppHistory() {
  const data = readJSON('whatsapp-history.json', []);
  for (const m of data) {
    await db.run(
      `INSERT INTO whatsapp_history (id,chat_id,chat_name,sender,message,timestamp,type,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        m.id || m.messageId, m.chatId || m.chat, m.chatName,
        m.sender || m.author, m.text || m.message || m.body,
        m.timestamp, m.type || 'text',
        JSON.stringify({ classification: m.classification, direction: m.direction, resolvedAuthor: m.resolvedAuthor }),
        m.timestamp
      ]
    );
  }
  console.log(`  ✓ whatsapp_history (${data.length})`);
}

async function migrateLunaThreads() {
  const data = readJSON('luna-chat-threads.json');
  const threads = data?.threads ? Object.values(data.threads) : (Array.isArray(data) ? data : []);
  for (const t of threads) {
    await db.run(
      `INSERT INTO luna_threads (id,user_id,title,messages,context,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [
        t.id, t.participants?.[0] || t.userId,
        t.title,
        JSON.stringify(t.messages || []),
        JSON.stringify({ type: t.type, participants: t.participants, messageCount: t.messageCount }),
        t.createdAt, t.updatedAt
      ]
    );
  }
  console.log(`  ✓ luna_threads (${threads.length})`);
}

async function migrateLunaBuffer() {
  const data = readJSON('luna-buffer.json');
  if (!data) return;
  await db.run(
    `INSERT INTO luna_buffer (id,data,updated_at) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
    [1, JSON.stringify(data), new Date().toISOString()]
  );
  console.log('  ✓ luna_buffer');
}

async function migrateSettings() {
  // Migrate simple config/settings JSONs as key-value
  const configs = [
    { key: 'payment_config', file: 'payment-config.json' },
    { key: 'auto_config', file: 'auto-config.json' },
    { key: 'alerts', file: 'alerts.json' },
    { key: 'access_requests', file: 'access-requests.json' },
    { key: 'access_users', file: 'access-users.json' },
    { key: 'github_users', file: 'github_users.json' },
    { key: 'vercel_users', file: 'vercel_users.json' },
    { key: 'unified_feed_config', file: 'unified-feed-config.json' },
    { key: 'report_history', file: 'report-history.json' },
    { key: 'full_extract', file: 'full-extract.json' },
  ];
  for (const cfg of configs) {
    const data = readJSON(cfg.file);
    if (data !== null) {
      await db.run(
        `INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [cfg.key, JSON.stringify(data)]
      );
    }
  }
  console.log('  ✓ settings');
}

async function main() {
  console.log('🚀 Starting JSON → PostgreSQL migration...\n');
  const start = Date.now();

  try {
    const health = await db.healthCheck();
    if (!health.ok) {
      console.error('❌ Database connection failed:', health.error);
      process.exit(1);
    }
    console.log('✅ Database connected:', health.now);

    // Run migrations first to ensure tables exist
    console.log('\n📦 Ensuring schema exists...');
    // Note: run migrate.js separately before this script, or call it here
    // We'll assume tables exist (run migrate.js first)

    console.log('\n📤 Migrating data...');
    await migrateUsers();
    await migrateTasks();
    await migrateCompanyTasks();
    await migrateIdeas();
    await migratePayments();
    await migrateExpenses();
    await migrateCashBox();
    await migrateQuotes();
    await migrateLeads();
    await migrateMembers();
    await migrateTransactions();
    await migrateLinks();
    await migrateChangelog();
    await migrateNotifications();
    await migrateSecurityLogs();
    await migrateWhatsAppHistory();
    await migrateLunaThreads();
    await migrateLunaBuffer();
    await migrateSettings();

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅ Migration completed in ${elapsed}s`);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

main();
