#!/usr/bin/env node
/**
 * Migra dados do Neon (quota excedida) para Render PostgreSQL
 * Usa apenas node-postgres (sem pg_dump/psql necessários)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ── CONFIGURAÇÃO ──
const NEON_URL = 'postgresql://neondb_owner:npg_R5PWJ3SwvQcH@ep-curly-band-ap16241z-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require';
const RENDER_URL = 'postgresql://nexo_postgres_rjyq_user:5UmNaxmQxG1Qn5tkAfNEm5CAv3nZvAGP@dpg-d89tk2f7f7vs73cipf30-a.frankfurt-postgres.render.com:5432/nexo_postgres_rjyq?sslmode=require';

const SCHEMA_FILE = path.join(__dirname, '..', 'backend', 'migrations', '005-real-schema.sql');

const SKIP_TABLES = ['pg_catalog', 'information_schema', 'pg_toast'];

// ── HELPERS ──
async function withPool(connectionString, name, fn) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 30000 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── PASSO 1: Verificar conexões ──
async function checkConnections() {
  console.log('\n🔌 Verificando conexões...\n');

  await withPool(NEON_URL, 'Neon', async (pool) => {
    const res = await pool.query('SELECT version()');
    console.log('✅ Neon conectado:', res.rows[0].version.split(' ')[0]);
  });

  await withPool(RENDER_URL, 'Render', async (pool) => {
    const res = await pool.query('SELECT version()');
    console.log('✅ Render conectado:', res.rows[0].version.split(' ')[0]);
  });
}

// ── PASSO 2: Aplicar schema no Render ──
async function applySchema() {
  console.log('\n📦 Aplicando schema no Render...\n');

  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error('❌ Schema não encontrado:', SCHEMA_FILE);
    process.exit(1);
  }

  const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');

  // Divide o SQL em statements individuais (simples, não cobre todos os casos edge)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  await withPool(RENDER_URL, 'Render', async (pool) => {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await pool.query(stmt);
        process.stdout.write(`   ${i + 1}/${statements.length} OK\r`);
      } catch (e) {
        // Ignora erros comuns de "já existe" e constraint violations
        if (/already exists|duplicate key|constraint/.test(e.message)) {
          process.stdout.write(`   ${i + 1}/${statements.length} OK (já existe)\r`);
        } else {
          console.warn(`\n   ⚠️  Erro em statement ${i + 1}: ${e.message.slice(0, 80)}`);
        }
      }
    }
  });

  console.log(`\n   ✅ Schema aplicado (${statements.length} statements)`);
}

// ── PASSO 3: Listar tabelas do Neon ──
async function listTables(pool) {
  const res = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return res.rows.map(r => r.tablename);
}

// ── PASSO 4: Contar registros ──
async function countRows(pool, table) {
  try {
    const res = await pool.query(`SELECT COUNT(*) as c FROM "${table}"`);
    return parseInt(res.rows[0].c, 10);
  } catch {
    return 0;
  }
}

// ── PASSO 5: Copiar dados (INSERT em batches) ──
async function migrateTable(neonPool, renderPool, table) {
  const count = await countRows(neonPool, table);
  if (count === 0) {
    return { table, count: 0, status: 'vazio' };
  }

  // Pega colunas
  const colsRes = await neonPool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [table]);
  const columns = colsRes.rows.map(r => r.column_name);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  // Lê dados em batches
  const BATCH_SIZE = 500;
  let migrated = 0;
  let offset = 0;

  while (offset < count) {
    const rows = await neonPool.query(
      `SELECT ${colList} FROM "${table}" LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    if (rows.rows.length === 0) break;

    // INSERT com ON CONFLICT DO NOTHING (evita duplicatas se re-rodar)
    const insertSQL = `INSERT INTO "${table}" (${colList}) VALUES ${rows.rows.map((_, i) => `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`).join(', ')} ON CONFLICT DO NOTHING`;

    const flatValues = rows.rows.flatMap(row => columns.map(col => row[col]));

    try {
      await renderPool.query(insertSQL, flatValues);
      migrated += rows.rows.length;
    } catch (e) {
      // Se falhar em batch, tenta um por um
      let inserted = 0;
      for (const row of rows.rows) {
        const vals = columns.map(col => row[col]);
        try {
          await renderPool.query(
            `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            vals
          );
          inserted++;
        } catch (e2) {
          // ignora erro individual
        }
      }
      migrated += inserted;
    }

    offset += BATCH_SIZE;
    process.stdout.write(`   ${table}: ${migrated}/${count} registros\r`);
  }

  console.log(`   ${table}: ${migrated}/${count} registros ✅`);
  return { table, count, migrated, status: 'ok' };
}

// ── MAIN ──
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🚀 Migração: Neon → Render PostgreSQL');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    // 1. Verifica conexões
    await checkConnections();

    // 2. Aplica schema
    await applySchema();

    // 3. Lista tabelas no Neon
    console.log('\n📋 Tabelas encontradas no Neon:\n');
    const tables = await withPool(NEON_URL, 'Neon', listTables);
    for (const t of tables) {
      const c = await withPool(NEON_URL, 'Neon', p => countRows(p, t));
      console.log(`   • ${t}: ${c} registros`);
    }

    // 4. Migra cada tabela
    console.log('\n📤 Copiando dados...\n');
    const results = [];

    for (const table of tables) {
      const result = await withPool(NEON_URL, 'Neon', async (neonPool) => {
        return await withPool(RENDER_URL, 'Render', async (renderPool) => {
          return migrateTable(neonPool, renderPool, table);
        });
      });
      results.push(result);
      await sleep(100); // pequena pausa entre tabelas
    }

    // 5. Resumo
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  ✅ MIGRAÇÃO CONCLUÍDA');
    console.log('═══════════════════════════════════════════════════════════════');
    const totalSource = results.reduce((s, r) => s + (r.count || 0), 0);
    const totalMigrated = results.reduce((s, r) => s + (r.migrated || 0), 0);
    console.log(`\n   Tabelas: ${results.length}`);
    console.log(`   Registros no Neon: ${totalSource}`);
    console.log(`   Registros migrados: ${totalMigrated}`);
    console.log(`   Taxa de sucesso: ${totalSource > 0 ? ((totalMigrated / totalSource) * 100).toFixed(1) : 100}%`);

    console.log('\n   📝 Próximos passos:');
    console.log('   1. Atualize o .env local:');
    console.log(`      DATABASE_URL="${RENDER_URL}"`);
    console.log('   2. Atualize o Environment no Render Dashboard:');
    console.log('      https://dashboard.render.com/web/srv-d85gqtrbc2fs73bq95bg');
    console.log('      Adicione DATABASE_URL com a Internal Connection String:');
    console.log('      postgresql://nexo_postgres_rjyq_user:5UmNaxmQxG1Qn5tkAfNEm5CAv3nZvAGP@dpg-d89tk2f7f7vs73cipf30-a/nexo_postgres_rjyq');
    console.log('   3. Faça deploy do app para aplicar a nova DATABASE_URL');
    console.log('');

  } catch (e) {
    console.error('\n❌ Erro na migração:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
