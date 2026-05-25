#!/usr/bin/env node
/**
 * sync-changelog-to-pg.cjs
 * Sincroniza o arquivo CHANGELOG.md com a tabela changelog do PostgreSQL.
 *
 * Uso:
 *   node scripts/sync-changelog-to-pg.cjs
 *
 * Ele parseia cada seção ## [Unreleased] ou ## [X.Y.Z] do CHANGELOG.md
 * e insere/atualiza na tabela changelog do PostgreSQL.
 */

const fs = require('fs');
const path = require('path');

// Carrega dotenv do backend
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://nexo_postgres_rjyq_user:5UmNaxmQxG1Qn5tkAfNEm5CAv3nZvAGP@dpg-d89tk2f7f7vs73cipf30-a.frankfurt-postgres.render.com:5432/nexo_postgres_rjyq?sslmode=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md');

// ── HELPERS ──
function getEmojiForCategory(category) {
  const map = {
    feature: '🚀',
    fix: '🐛',
    infrastructure: '🗄️',
    perf: '⚡',
    test: '🧪',
    docs: '📝',
    chore: '🔧',
    security: '🔒',
  };
  return map[category] || '📋';
}

function getTierForCategory(category) {
  if (category === 'feature') return 1;
  if (category === 'fix') return 2;
  return 3;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── PARSER ──
function parseChangelog(content) {
  const lines = content.split('\n');
  const entries = [];
  let currentEntry = null;
  let currentSection = null;
  let currentBody = [];

  function flushEntry() {
    if (!currentEntry) return;
    // Determina categoria pela presença de seções
    let category = 'chore';
    if (currentEntry.sections.Added?.length) category = 'feature';
    else if (currentEntry.sections.Fixed?.length) category = 'fix';
    else if (currentEntry.sections['Security']?.length) category = 'security';
    else if (currentEntry.sections['Infrastructure']?.length) category = 'infrastructure';
    else if (currentEntry.sections['Testes']?.length || currentEntry.sections['Tests']?.length) category = 'test';
    else if (currentEntry.sections['Docs']?.length || currentEntry.sections['Documentation']?.length) category = 'docs';

    const descriptionParts = [];
    for (const [secName, items] of Object.entries(currentEntry.sections)) {
      if (!items.length) continue;
      descriptionParts.push(`**${secName}:**`);
      for (const item of items) {
        // Limita descrição a ~500 chars por item
        const clean = item.replace(/\s+/g, ' ').trim();
        descriptionParts.push(`- ${clean.slice(0, 400)}${clean.length > 400 ? '...' : ''}`);
      }
    }

    const desc = descriptionParts.join('\n');
    const title = currentEntry.title || 'Atualização';
    const date = currentEntry.date || new Date().toISOString();
    const id = `changelog-${slugify(title)}-${date.slice(0, 10)}`;

    entries.push({
      id,
      version: currentEntry.version || '1.0',
      title,
      description: desc.slice(0, 4000), // limita pra não explodir coluna
      category,
      emoji: getEmojiForCategory(category),
      author: 'Abner',
      tier: getTierForCategory(category),
      date,
      tags: Object.keys(currentEntry.sections).filter(k => currentEntry.sections[k].length > 0),
      read_by: [],
      status: '✅ FUNCIONANDO',
      status_detail: 'Sincronizado automaticamente do CHANGELOG.md',
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detecta cabeçalho de versão
    const headerMatch = line.match(/^##\s+\[(Unreleased|\d+\.\d+(\.\d+)?)\]\s*—?\s*(.*)/);
    if (headerMatch) {
      flushEntry();
      const version = headerMatch[1];
      const rest = headerMatch[3] || '';
      // Extrai data do resto: "2026-05-25 — Título"
      const dateMatch = rest.match(/^(\d{4}-\d{2}-\d{2})\s*—?\s*(.*)/);
      let date = new Date().toISOString();
      let title = rest;
      if (dateMatch) {
        date = `${dateMatch[1]}T12:00:00Z`;
        title = dateMatch[2].trim();
      }
      currentEntry = {
        version,
        title: title || `Release ${version}`,
        date,
        sections: {},
      };
      currentSection = null;
      continue;
    }

    if (!currentEntry) continue;

    // Detecta subseção (### Added, ### Fixed, etc.)
    const sectionMatch = line.match(/^###\s+(Added|Changed|Fixed|Removed|Security|Infrastructure|Testes?|Tests|Docs|Documentation|Commits|Perf)/i);
    if (sectionMatch) {
      currentSection = sectionMatch[1].charAt(0).toUpperCase() + sectionMatch[1].slice(1).toLowerCase();
      if (currentSection === 'Testes') currentSection = 'Tests';
      if (currentSection === 'Added') currentSection = 'Added';
      if (currentSection === 'Fixed') currentSection = 'Fixed';
      if (!currentEntry.sections[currentSection]) currentEntry.sections[currentSection] = [];
      continue;
    }

    // Ignora linhas de commits (são metadados)
    if (line.match(/^-\s+`[a-f0-9]+`\s+/)) continue;

    // Coleta item de lista
    if (currentSection && line.match(/^[\s]*[-*]\s/)) {
      let itemText = line.replace(/^[\s]*[-*]\s*/, '');
      // Pega linhas seguintes indentadas (continuação do item)
      let j = i + 1;
      while (j < lines.length && lines[j].match(/^[\s]{2,}/) && !lines[j].match(/^[\s]*[-*]\s/)) {
        itemText += ' ' + lines[j].trim();
        j++;
      }
      currentEntry.sections[currentSection].push(itemText);
      i = j - 1;
      continue;
    }
  }

  flushEntry();
  return entries;
}

// ── SYNC ──
async function sync() {
  const content = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
  const entries = parseChangelog(content);

  console.log(`📄 Parseado ${entries.length} entradas do CHANGELOG.md`);

  let inserted = 0;
  let updated = 0;

  for (const e of entries) {
    const existing = await pool.query('SELECT id FROM changelog WHERE id = $1', [e.id]);

    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO changelog (id, version, title, description, category, emoji, author, tier, date, tags, read_by, status, status_detail)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          e.id, e.version, e.title, e.description, e.category, e.emoji,
          e.author, e.tier, e.date, JSON.stringify(e.tags), JSON.stringify(e.read_by),
          e.status, e.status_detail,
        ]
      );
      inserted++;
      console.log(`  ✅ Inserido: ${e.title.slice(0, 50)}`);
    } else {
      await pool.query(
        `UPDATE changelog SET
          version=$2, title=$3, description=$4, category=$5, emoji=$6,
          author=$7, tier=$8, date=$9, tags=$10, status=$12, status_detail=$13
         WHERE id=$1`,
        [
          e.id, e.version, e.title, e.description, e.category, e.emoji,
          e.author, e.tier, e.date, JSON.stringify(e.tags),
          e.status, e.status_detail,
        ]
      );
      updated++;
      console.log(`  🔄 Atualizado: ${e.title.slice(0, 50)}`);
    }
  }

  console.log(`\n🎉 Sincronização completa! ${inserted} inseridos, ${updated} atualizados.`);
  await pool.end();
}

sync().catch(err => {
  console.error('❌ Erro:', err.message);
  pool.end();
  process.exit(1);
});
