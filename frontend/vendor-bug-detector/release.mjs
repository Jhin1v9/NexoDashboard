#!/usr/bin/env node
/**
 * Script de release do @auris/bug-detector
 * Builda o pacote, copia o snippet IIFE e gera o tarball.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

console.log('🔨 Building @auris/bug-detector...\n');

// 1. TypeScript check
run('npx tsc --noEmit');

// 2. Rollup build
run('npm run build');

// 3. Copy IIFE snippet to root
const iifeSrc = path.join(ROOT, 'dist', 'bug-detector.iife.js');
const iifeDest = path.join(ROOT, '..', '..', 'bugdetector-snippet.js');
fs.copyFileSync(iifeSrc, iifeDest);
console.log(`\n📋 Copied snippet to ${path.relative(ROOT, iifeDest)}`);

// 4. Pack
run('npm pack');

// 5. Copy tarball to root
const tarball = fs.readdirSync(ROOT).find((f) => f.endsWith('.tgz'));
if (tarball) {
  const tgzDest = path.join(ROOT, '..', '..', tarball);
  fs.copyFileSync(path.join(ROOT, tarball), tgzDest);
  console.log(`\n📦 Copied tarball to ${path.relative(ROOT, tgzDest)}`);
}

console.log('\n✅ Release complete!');
