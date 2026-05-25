#!/usr/bin/env node
/**
 * import-brain.cjs — Importa personalidades do principal-brain (GitHub) para o Luna CLI
 *
 * Uso: node import-brain.cjs [--dry-run]
 *
 * Fonte: https://github.com/Jhin1v9/principal-brain
 * Destino: ~/.luna/personas/ e ~/.luna/skills/
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAW_BASE = 'https://raw.githubusercontent.com/Jhin1v9/principal-brain/main';
const LUNA_DIR = path.join(os.homedir(), '.luna');
const PERSONAS_DIR = path.join(LUNA_DIR, 'personas');
const SKILLS_DIR = path.join(LUNA_DIR, 'skills');

// Mapeamento: personalidades técnicas → skills
const PERSONALITIES = [
  { file: '01-ARQUITETO.md', skill: 'arquiteto', name: 'Arquiteto de Frontend', desc: 'Arquitetura de software frontend, patterns avançados e design de sistemas' },
  { file: '02-UIUX-ENGINEER.md', skill: 'uiux-engineer', name: 'UI/UX Engineer', desc: 'Design de interfaces, experiência do usuário e prototipagem' },
  { file: '03-PERFORMANCE-ENGINEER.md', skill: 'performance-engineer', name: 'Performance Engineer', desc: 'Otimização de performance, profiling e métricas Web Vitals' },
  { file: '04-TYPESCRIPT-MASTER.md', skill: 'typescript-master', name: 'TypeScript Master', desc: 'TypeScript avançado, tipos de domínio e patterns de tipagem' },
  { file: '05-REACT-SPECIALIST.md', skill: 'react-specialist', name: 'React Specialist', desc: 'React avançado, hooks, patterns e arquitetura de componentes' },
  { file: '06-CSS-TAILWIND-EXPERT.md', skill: 'css-tailwind-expert', name: 'CSS & Tailwind Expert', desc: 'CSS avançado, Tailwind CSS, design systems e animações' },
  { file: '07-TESTING-ENGINEER.md', skill: 'testing-engineer', name: 'Testing Engineer', desc: 'Testes automatizados, TDD, testes de integração e e2e' },
  { file: '08-DX-ENGINEER.md', skill: 'dx-engineer', name: 'DX Engineer', desc: 'Developer Experience, tooling, linting e automação de workflow' },
];

// Personas de negócio
const PERSONAS = [
  { file: 'architect.md', persona: 'architect', name: 'The Architect', desc: 'Arquiteto de soluções. Big picture, trade-offs, decisões estruturais.' },
  { file: 'devops.md', persona: 'devops', name: 'The DevOps', desc: 'Especialista em infraestrutura, CI/CD, deploy e observabilidade.' },
  { file: 'product.md', persona: 'product', name: 'The Product', desc: 'Product Manager. Prioridades, roadmap, métricas e valor do usuário.' },
  { file: 'surgeon.md', persona: 'surgeon', name: 'The Surgeon', desc: 'Debugging, refactoring cirúrgico e qualidade de código.' },
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function mkdirp(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toSkillMarkdown(name, description, sourceContent) {
  const frontmatter = `---
name: ${name}
description: ${description}
version: 1.0.0
source: principal-brain
---

`;
  return frontmatter + sourceContent;
}

function toPersonaMarkdown(name, description, sourceContent) {
  const frontmatter = `---
name: ${name}
description: ${description}
role: Especialista técnico
author: principal-brain
version: 1.0.0
---

`;
  return frontmatter + sourceContent;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const results = { skills: [], personas: [], errors: [] };

  console.log('🧠 Importando personalidades do principal-brain...\n');

  // === IMPORTAR PERSONALITIES → SKILLS ===
  console.log('📚 Personalities técnicas → Skills:');
  for (const p of PERSONALITIES) {
    const url = `${RAW_BASE}/personalities/${p.file}`;
    try {
      const content = await fetch(url);
      const skillDir = path.join(SKILLS_DIR, p.skill);
      const skillPath = path.join(skillDir, 'SKILL.md');

      if (dryRun) {
        console.log(`  [DRY-RUN] ${p.name} → ${skillPath}`);
        results.skills.push({ name: p.name, path: skillPath, status: 'dry-run' });
        continue;
      }

      mkdirp(skillDir);
      const skillContent = toSkillMarkdown(p.name, p.desc, content);
      fs.writeFileSync(skillPath, skillContent, 'utf8');
      console.log(`  ✅ ${p.name}`);
      results.skills.push({ name: p.name, path: skillPath, status: 'imported' });
    } catch (err) {
      console.log(`  ❌ ${p.name}: ${err.message}`);
      results.errors.push({ file: p.file, error: err.message });
    }
  }

  // === IMPORTAR PERSONAS → PERSONAS ===
  console.log('\n🎭 Personas de negócio → Personas Luna:');
  for (const p of PERSONAS) {
    const url = `${RAW_BASE}/personas/${p.file}`;
    try {
      const content = await fetch(url);
      const personaPath = path.join(PERSONAS_DIR, `${p.persona}.md`);

      if (dryRun) {
        console.log(`  [DRY-RUN] ${p.name} → ${personaPath}`);
        results.personas.push({ name: p.name, path: personaPath, status: 'dry-run' });
        continue;
      }

      mkdirp(PERSONAS_DIR);
      const personaContent = toPersonaMarkdown(p.name, p.desc, content);
      fs.writeFileSync(personaPath, personaContent, 'utf8');
      console.log(`  ✅ ${p.name}`);
      results.personas.push({ name: p.name, path: personaPath, status: 'imported' });
    } catch (err) {
      console.log(`  ❌ ${p.name}: ${err.message}`);
      results.errors.push({ file: p.file, error: err.message });
    }
  }

  // === REGISTRAR MANIFESTO ===
  if (!dryRun) {
    const manifest = {
      source: 'https://github.com/Jhin1v9/principal-brain',
      importedAt: new Date().toISOString(),
      skills: results.skills.map(s => ({ name: s.name, path: s.path })),
      personas: results.personas.map(p => ({ name: p.name, path: p.path })),
    };
    fs.writeFileSync(path.join(LUNA_DIR, 'brain-import.json'), JSON.stringify(manifest, null, 2));
    console.log('\n📝 Manifesto salvo em ~/.luna/brain-import.json');
  }

  // === RESUMO ===
  console.log(`\n📊 Resumo:`);
  console.log(`   Skills importadas: ${results.skills.filter(s => s.status === 'imported').length}/${PERSONALITIES.length}`);
  console.log(`   Personas importadas: ${results.personas.filter(p => p.status === 'imported').length}/${PERSONAS.length}`);
  if (results.errors.length > 0) {
    console.log(`   Erros: ${results.errors.length}`);
    for (const e of results.errors) console.log(`     - ${e.file}: ${e.error}`);
  }

  console.log('\n✨ Importação concluída!');
  console.log('   Use "/modo <persona>" no Luna CLI para alternar personas.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
