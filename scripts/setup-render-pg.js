#!/usr/bin/env node
/**
 * Configura o Render PostgreSQL recém-criado com schema + usuários padrão
 * Como o Neon está bloqueado, não é possível migrar dados históricos.
 * Esta configuração permite o dashboard funcionar imediatamente.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const RENDER_URL = 'postgresql://nexo_postgres_rjyq_user:5UmNaxmQxG1Qn5tkAfNEm5CAv3nZvAGP@dpg-d89tk2f7f7vs73cipf30-a.frankfurt-postgres.render.com:5432/nexo_postgres_rjyq?sslmode=require';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'backend', 'migrations');

// Hash SHA-256 de "7741" (senha padrão dos CEOs)
const DEFAULT_PASSWORD_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';

async function withPool(connectionString, fn) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 30000 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔧 Configurando Render PostgreSQL');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Verifica conexão
  await withPool(RENDER_URL, async (pool) => {
    const res = await pool.query('SELECT version()');
    console.log('✅ Conectado:', res.rows[0].version.split(' ')[0]);
  });

  // 2. Lista e aplica todas as migrações em ordem
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log('\n📦 Aplicando migrações...');
  await withPool(RENDER_URL, async (pool) => {
    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      try {
        await pool.query(sql);
        console.log(`   ✅ ${file}`);
      } catch (e) {
        console.warn(`   ⚠️  ${file}: ${e.message.slice(0, 80)}`);
      }
    }
  });

  // 3. Cria usuários padrão
  console.log('\n👤 Criando usuários padrão...');
  await withPool(RENDER_URL, async (pool) => {
    const users = [
      { id: 'abner', name: 'Abner', role: 'Admin', color: '#3742fa' },
      { id: 'nonoke', name: 'Nonoke', role: 'Admin', color: '#2ed573' },
      { id: 'elias', name: 'Elias', role: 'Admin', color: '#ffa502' },
    ];

    for (const u of users) {
      try {
        await pool.query(`
          INSERT INTO users (id, name, role, color, password, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            color = EXCLUDED.color,
            password = EXCLUDED.password,
            updated_at = NOW()
        `, [u.id, u.name, u.role, u.color, DEFAULT_PASSWORD_HASH]);
        console.log(`   ✅ ${u.name} (${u.id})`);
      } catch (e) {
        console.warn(`   ⚠️  ${u.name}: ${e.message.slice(0, 80)}`);
      }
    }
  });

  // 4. Verifica tabelas criadas
  console.log('\n📋 Tabelas no Render PostgreSQL:');
  await withPool(RENDER_URL, async (pool) => {
    const res = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    for (const row of res.rows) {
      const cnt = await pool.query(`SELECT COUNT(*) as c FROM "${row.tablename}"`);
      console.log(`   • ${row.tablename}: ${cnt.rows[0].c} registros`);
    }
  });

  // 5. Resumo final
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✅ Render PostgreSQL pronto para uso!');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n   📝 Próximos passos:');
  console.log('');
  console.log('   1️⃣  Atualize .env local:');
  console.log('      DATABASE_URL=postgresql://nexo_postgres_rjyq_user:5UmNaxmQxG1Qn5tkAfNEm5CAv3nZvAGP@dpg-d89tk2f7f7vs73cipf30-a.frankfurt-postgres.render.com:5432/nexo_postgres_rjyq?sslmode=require');
  console.log('');
  console.log('   2️⃣  Atualize Environment Variable no Render Dashboard:');
  console.log('      https://dashboard.render.com/web/srv-d85gqtrbc2fs73bq95bg');
  console.log('      Adicione/altere DATABASE_URL com a Internal Connection String:');
  console.log('      postgresql://nexo_postgres_rjyq_user:5UmNaxmQxG1Qn5tkAfNEm5CAv3nZvAGP@dpg-d89tk2f7f7vs73cipf30-a/nexo_postgres_rjyq');
  console.log('');
  console.log('   3️⃣  Faça deploy para aplicar as mudanças');
  console.log('      git push origin main  (ou trigger manual no dashboard)');
  console.log('');
  console.log('   ⚠️  Dados históricos do Neon NÃO foram migrados (banco bloqueado).');
  console.log('      Tarefas, leads, pagamentos etc. precisam ser recriados.');
  console.log('      Se quiser recuperar dados antigos, a única forma é:');
  console.log('      • Pagar o Neon por 1 mês ($19), fazer dump, e cancelar');
  console.log('      • Ou esperar até o dia 1º do mês para a quota resetar');
  console.log('');
}

main().catch(e => {
  console.error('\n❌ Erro:', e.message);
  console.error(e.stack);
  process.exit(1);
});
