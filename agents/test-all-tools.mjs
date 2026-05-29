#!/usr/bin/env node
/**
 * Teste abrangente de TODAS as ferramentas do Luna CLI
 * Gera relatório JSON + markdown
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const TEST_DIR = path.join(os.tmpdir(), `luna-tools-test-${Date.now()}`);
const REPORT_FILE = `/home/jhin/NEXO_DASHBOARD_PRO/agents/TEST-RELATORIO-${new Date().toISOString().slice(0,10)}.md`;

const results = [];
let passed = 0;
let failed = 0;

function log(category, name, ok, detail = '', error = null) {
  const status = ok ? '✅' : '❌';
  console.log(`${status} [${category}] ${name}${detail ? ' — ' + detail : ''}${error ? ' | ERROR: ' + error.message : ''}`);
  results.push({ category, name, ok, detail, error: error?.message || null });
  if (ok) passed++; else failed++;
}

// ── luna-tools.cjs ──
console.log('\n═══════════════════════════════════════════════════');
console.log('  TESTANDO: luna-tools.cjs');
console.log('═══════════════════════════════════════════════════\n');

let lunaTools;
try {
  lunaTools = await import('./luna-tools.cjs').then(m => m.default || m);
  log('IMPORT', 'luna-tools.cjs', true, `${Object.keys(lunaTools).length} tools carregadas`);
} catch (e) {
  log('IMPORT', 'luna-tools.cjs', false, '', e);
  process.exit(1);
}

fs.mkdirSync(TEST_DIR, { recursive: true });

// 1. writeFile
const testFile = path.join(TEST_DIR, 'test.txt');
try {
  await lunaTools.writeFile(testFile, 'hello world');
  const content = fs.readFileSync(testFile, 'utf8');
  log('FILE', 'writeFile', content === 'hello world', `wrote ${content.length} chars`);
} catch (e) { log('FILE', 'writeFile', false, '', e); }

// 2. readFile — returns { success, path, content (with line numbers), totalLines, linesRead }
try {
  const r = await lunaTools.readFile(testFile);
  log('FILE', 'readFile', r.success === true && r.content?.includes('hello world'), `${r.totalLines} lines, ${r.content?.length} chars`);
} catch (e) { log('FILE', 'readFile', false, '', e); }

// 3. appendFile
try {
  await lunaTools.appendFile(testFile, '\nline 2');
  const raw = fs.readFileSync(testFile, 'utf8');
  log('FILE', 'appendFile', raw === 'hello world\nline 2', `${raw.length} chars raw`);
} catch (e) { log('FILE', 'appendFile', false, '', e); }

// 4. getFileInfo — returns { success, path, size, isDirectory, isFile, modified, created, permissions }
try {
  const info = await lunaTools.getFileInfo(testFile);
  log('FILE', 'getFileInfo', info.success && info.isFile && info.size > 0, `size=${info.size}, perms=${info.permissions}`);
} catch (e) { log('FILE', 'getFileInfo', false, '', e); }

// 5. copyFile
const copyFile = path.join(TEST_DIR, 'copy.txt');
try {
  await lunaTools.copyFile(testFile, copyFile);
  log('FILE', 'copyFile', fs.existsSync(copyFile), 'copied');
} catch (e) { log('FILE', 'copyFile', false, '', e); }

// 6. moveFile
const movedFile = path.join(TEST_DIR, 'moved.txt');
try {
  await lunaTools.moveFile(copyFile, movedFile);
  log('FILE', 'moveFile', !fs.existsSync(copyFile) && fs.existsSync(movedFile), 'moved');
} catch (e) { log('FILE', 'moveFile', false, '', e); }

// 7. replaceInFile
try {
  await lunaTools.replaceInFile(testFile, 'hello', 'HELLO');
  const raw = fs.readFileSync(testFile, 'utf8');
  log('FILE', 'replaceInFile', raw.includes('HELLO'), `content=${raw.slice(0,20)}`);
} catch (e) { log('FILE', 'replaceInFile', false, '', e); }

// 8. deleteFile
try {
  await lunaTools.deleteFile(movedFile);
  log('FILE', 'deleteFile', !fs.existsSync(movedFile), 'deleted');
} catch (e) { log('FILE', 'deleteFile', false, '', e); }

// 9. createDirectory
const testDir = path.join(TEST_DIR, 'subdir');
try {
  await lunaTools.createDirectory(testDir);
  log('DIR', 'createDirectory', fs.existsSync(testDir), 'created');
} catch (e) { log('DIR', 'createDirectory', false, '', e); }

// 10. listFiles — returns { success, pattern, count, files: [...] }
try {
  const list = await lunaTools.listFiles('*', { cwd: TEST_DIR });
  log('DIR', 'listFiles', list.success && Array.isArray(list.files) && list.count > 0, `${list.count} items`);
} catch (e) { log('DIR', 'listFiles', false, '', e); }

// 11. viewDirectory — returns { success, path, entries: [...], total }
try {
  const tree = await lunaTools.viewDirectory(TEST_DIR, { depth: 1 });
  log('DIR', 'viewDirectory', tree.success && Array.isArray(tree.entries) && tree.total > 0, `${tree.total} entries`);
} catch (e) { log('DIR', 'viewDirectory', false, '', e); }

// 12. removeDirectory
try {
  await lunaTools.removeDirectory(testDir);
  log('DIR', 'removeDirectory', !fs.existsSync(testDir), 'removed');
} catch (e) { log('DIR', 'removeDirectory', false, '', e); }

// 13. searchFiles — returns { success, pattern, matches, results: [...], truncated }
try {
  const found = await lunaTools.searchFiles('HELLO', { path: TEST_DIR });
  log('SEARCH', 'searchFiles', found.success && found.matches > 0, `${found.matches} matches`);
} catch (e) { log('SEARCH', 'searchFiles', false, '', e); }

// 14. grep — returns { success, pattern, matches, results: [...], truncated }
try {
  const g = await lunaTools.grep('HELLO', { path: TEST_DIR });
  log('SEARCH', 'grep', g.success && g.matches > 0, `${g.matches} matches`);
} catch (e) { log('SEARCH', 'grep', false, '', e); }

// 15. glob — returns { success, pattern, count, files: [...] }
try {
  const gl = await lunaTools.glob('*.txt', { cwd: TEST_DIR });
  log('SEARCH', 'glob', gl.success && Array.isArray(gl.files) && gl.count > 0, `${gl.count} matches`);
} catch (e) { log('SEARCH', 'glob', false, '', e); }

// 16. executeShell — signature: (command, opts) command must be STRING
try {
  const sh = await lunaTools.executeShell('echo "shell-ok"');
  log('SHELL', 'executeShell', sh.success === true && sh.stdout?.includes('shell-ok'), `stdout=${sh.stdout?.trim()}`);
} catch (e) { log('SHELL', 'executeShell', false, '', e); }

// 17. checkSyntax — returns { success, path, language, valid, stdout, stderr, exitCode }
try {
  const jsFile = path.join(TEST_DIR, 'syntax.js');
  fs.writeFileSync(jsFile, 'const x = 1;');
  const syn = await lunaTools.checkSyntax(jsFile);
  log('SHELL', 'checkSyntax', syn.success && syn.valid === true, `valid=${syn.valid}`);
} catch (e) { log('SHELL', 'checkSyntax', false, '', e); }

// 18. getCurrentDirectory — returns { success, cwd }
try {
  const cwd = await lunaTools.getCurrentDirectory();
  log('SHELL', 'getCurrentDirectory', cwd.success && typeof cwd.cwd === 'string' && cwd.cwd.length > 0, cwd.cwd);
} catch (e) { log('SHELL', 'getCurrentDirectory', false, '', e); }

// 19. think — returns { success, thought }
try {
  const t = await lunaTools.think('testing think tool');
  log('REASONING', 'think', t.success && t.thought?.length > 0, `${t.thought?.length} chars`);
} catch (e) { log('REASONING', 'think', false, '', e); }

// 20. fetchURL — signature: (url, opts) url must be STRING
try {
  const f = await lunaTools.fetchURL('https://httpbin.org/get');
  log('NETWORK', 'fetchURL', f.success && (f.content?.length > 0 || f.output?.length > 0), `${(f.content || f.output)?.length} chars`);
} catch (e) { log('NETWORK', 'fetchURL', false, '', e); }

// 21. searchWeb — returns { success, query, note, results }
try {
  const sw = await lunaTools.searchWeb('openai');
  log('NETWORK', 'searchWeb', sw.success && sw.query === 'openai', `${sw.results?.length || 0} results (${sw.note || 'no note'})`);
} catch (e) { log('NETWORK', 'searchWeb', false, '', e); }

// 22. downloadFile
try {
  const dl = path.join(TEST_DIR, 'dl.html');
  const d = await lunaTools.downloadFile('https://httpbin.org/html', dl, { timeout: 10000 });
  log('NETWORK', 'downloadFile', d.success && fs.existsSync(dl), `saved=${fs.existsSync(dl)}`);
} catch (e) { log('NETWORK', 'downloadFile', false, '', e); }

// 23. clipboardRead / clipboardWrite (may fail if no xclip/wl-clipboard)
try {
  await lunaTools.clipboardWrite('luna-test-clipboard');
  await new Promise(r => setTimeout(r, 800)); // Give xclip time to register
  const cr = await lunaTools.clipboardRead();
  log('CLIPBOARD', 'clipboardRead/Write', cr.success && cr.text === 'luna-test-clipboard', `text=${cr.text}`);
} catch (e) { log('CLIPBOARD', 'clipboardRead/Write', false, 'xclip/wl-clipboard missing?', e); }

// 24. gitStatus — returns { success, cwd, modified, untracked, added, deleted, files }
try {
  const gs = await lunaTools.gitStatus({ cwd: '/home/jhin/NEXO_DASHBOARD_PRO' });
  log('GIT', 'gitStatus', gs.success && typeof gs.modified === 'number', `M=${gs.modified}, U=${gs.untracked}`);
} catch (e) { log('GIT', 'gitStatus', false, '', e); }

// 25. gitLog — returns { success, commits: [...] }
try {
  const gl = await lunaTools.gitLog({ cwd: '/home/jhin/NEXO_DASHBOARD_PRO', n: 1 });
  log('GIT', 'gitLog', gl.success && Array.isArray(gl.commits), `${gl.commits?.length} commits`);
} catch (e) { log('GIT', 'gitLog', false, '', e); }

// 26. applyPatch
try {
  const patchFile = path.join(TEST_DIR, 'patch.diff');
  fs.writeFileSync(patchFile, `--- a/test.txt\n+++ b/test.txt\n@@ -1,2 +1,2 @@\n-HELLO world\n+HELLO WORLD\n line 2\n`);
  const ap = await lunaTools.applyPatch(fs.readFileSync(patchFile, 'utf8'), { cwd: TEST_DIR });
  log('PATCH', 'applyPatch', ap.success !== false, `success=${ap.success}`);
} catch (e) { log('PATCH', 'applyPatch', false, '', e); }

// ── luna-tool-guard.cjs ──
console.log('\n═══════════════════════════════════════════════════');
console.log('  TESTANDO: luna-tool-guard.cjs');
console.log('═══════════════════════════════════════════════════\n');

let tg;
try {
  tg = require('./luna-tool-guard.cjs');
  log('IMPORT', 'luna-tool-guard.cjs', true, `${Object.keys(tg).length} exports`);
} catch (e) {
  log('IMPORT', 'luna-tool-guard.cjs', false, '', e);
}

if (tg) {
  try {
    tg.validateToolCall('readFile', { path: '/tmp/test' });
    log('GUARD', 'validateToolCall readFile', true, 'valid params ok');
  } catch (e) { log('GUARD', 'validateToolCall readFile', false, '', e); }

  try {
    tg.validateToolCall('readFile', {});
    log('GUARD', 'validateToolCall readFile missing path', false, 'should have thrown');
  } catch (e) { log('GUARD', 'validateToolCall readFile missing path', true, 'correctly rejected'); }

  try {
    const v1 = tg.validatePythonCode('print(1+1)');
    log('GUARD', 'validatePythonCode safe', v1.ok, v1.reason || 'ok');
  } catch (e) { log('GUARD', 'validatePythonCode safe', false, '', e); }

  try {
    const v2 = tg.validatePythonCode('import os');
    log('GUARD', 'validatePythonCode import os', !v2.ok, v2.reason || 'blocked');
  } catch (e) { log('GUARD', 'validatePythonCode import os', false, '', e); }

  try {
    const v3 = tg.validatePythonCode('open("/tmp/test.txt")');
    log('GUARD', 'validatePythonCode open()', !v3.ok, v3.reason || 'blocked');
  } catch (e) { log('GUARD', 'validatePythonCode open()', false, '', e); }

  try {
    const d1 = tg.checkDestructivePattern('rm -rf /tmp');
    log('GUARD', 'checkDestructivePattern rm', d1?.destructive === true, d1?.message);
  } catch (e) { log('GUARD', 'checkDestructivePattern rm', false, '', e); }

  try {
    const d2 = tg.checkDestructivePattern('ls -la');
    log('GUARD', 'checkDestructivePattern safe', d2 === null, 'null = safe');
  } catch (e) { log('GUARD', 'checkDestructivePattern safe', false, '', e); }

  try {
    const guard = new tg.ToolGuard(TEST_DIR);
    const res = await guard.execute('readFile', { path: testFile }, () => ({ content: 'test' }));
    log('GUARD', 'ToolGuard.execute', res.content === 'test', 'executed through guard');
  } catch (e) { log('GUARD', 'ToolGuard.execute', false, '', e); }
}

// ── kimi-bridge.cjs ──
console.log('\n═══════════════════════════════════════════════════');
console.log('  TESTANDO: kimi-bridge.cjs (import + classes)');
console.log('═══════════════════════════════════════════════════\n');

let bridgeMod;
try {
  bridgeMod = require('./kimi-bridge.cjs');
  log('IMPORT', 'kimi-bridge.cjs', true, `${Object.keys(bridgeMod).length} exports`);
} catch (e) {
  log('IMPORT', 'kimi-bridge.cjs', false, '', e);
}

if (bridgeMod?.KimiBridge) {
  try {
    const b = new bridgeMod.KimiBridge({ storeDir: path.join(os.tmpdir(), 'luna-test-store'), cdpUrl: 'http://127.0.0.1:9222' });
    log('BRIDGE', 'KimiBridge instantiate', b instanceof bridgeMod.KimiBridge, 'instance created');

    try {
      await b.connect();
      log('BRIDGE', 'KimiBridge.connect', true, 'CDP connected');
      await b.disconnect();
      log('BRIDGE', 'KimiBridge.disconnect', true, 'disconnected');
    } catch (ce) {
      log('BRIDGE', 'KimiBridge.connect', false, 'Chrome may not be running on :9222', ce);
    }
  } catch (e) {
    log('BRIDGE', 'KimiBridge instantiate', false, '', e);
  }
}

// ── luna-soul.cjs ──
console.log('\n═══════════════════════════════════════════════════');
console.log('  TESTANDO: luna-soul.cjs (import + classes)');
console.log('═══════════════════════════════════════════════════\n');

let soulMod;
try {
  soulMod = require('./luna-soul.cjs');
  log('IMPORT', 'luna-soul.cjs', true, `${Object.keys(soulMod).length} exports`);
} catch (e) {
  log('IMPORT', 'luna-soul.cjs', false, '', e);
}

if (soulMod?.LunaSoul) {
  try {
    const soul = new soulMod.LunaSoul({ cdpUrl: 'http://127.0.0.1:9222' });
    log('SOUL', 'LunaSoul instantiate', soul instanceof soulMod.LunaSoul, 'instance created');
  } catch (e) {
    log('SOUL', 'LunaSoul instantiate', false, '', e);
  }
}

// ── computer-use-engine.cjs ──
console.log('\n═══════════════════════════════════════════════════');
console.log('  TESTANDO: computer-use-engine.cjs');
console.log('═══════════════════════════════════════════════════\n');

try {
  const cue = require('./computer-use-engine.cjs');
  log('IMPORT', 'computer-use-engine.cjs', true, `${Object.keys(cue).length} exports`);
  if (cue.ComputerUseEngine) {
    const engine = new cue.ComputerUseEngine();
    log('DESKTOP', 'ComputerUseEngine instantiate', engine instanceof cue.ComputerUseEngine, 'instance created');
  }
} catch (e) {
  log('IMPORT', 'computer-use-engine.cjs', false, '', e);
}

// ── luna-workspace.cjs ──
console.log('\n═══════════════════════════════════════════════════');
console.log('  TESTANDO: luna-workspace.cjs');
console.log('═══════════════════════════════════════════════════\n');

try {
  const ws = require('./luna-workspace.cjs');
  log('IMPORT', 'luna-workspace.cjs', true, `${Object.keys(ws).length} exports`);
  if (ws.workspaceManager) {
    // Bootstrap workspace first if it doesn't exist
    let w = ws.workspaceManager.getWorkspace('luna-cli');
    if (!w) {
      try {
        await ws.workspaceManager.bootstrap('/home/jhin/NEXO_DASHBOARD_PRO', 'luna-cli');
        w = ws.workspaceManager.getWorkspace('luna-cli');
      } catch {}
    }
    log('WORKSPACE', 'getWorkspace', w?.path?.length > 0, w?.path || 'no workspace');
  }
} catch (e) {
  log('IMPORT', 'luna-workspace.cjs', false, '', e);
}

// ── luna-git.cjs ──
console.log('\n═══════════════════════════════════════════════════');
console.log('  TESTANDO: luna-git.cjs');
console.log('═══════════════════════════════════════════════════\n');

try {
  const git = require('./luna-git.cjs');
  log('IMPORT', 'luna-git.cjs', true, `${Object.keys(git).length} exports`);
  if (git.LunaGit) {
    const g = new git.LunaGit('/home/jhin/NEXO_DASHBOARD_PRO');
    log('GIT', 'LunaGit instantiate', g instanceof git.LunaGit, 'instance created');
  }
} catch (e) {
  log('IMPORT', 'luna-git.cjs', false, '', e);
}

// ── Cleanup ──
try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
try { require('child_process').execSync('killall xclip 2>/dev/null', { timeout: 2000 }); } catch {}

// ── Report ──
console.log('\n═══════════════════════════════════════════════════');
console.log('  RELATÓRIO FINAL');
console.log('═══════════════════════════════════════════════════\n');

console.log(`✅ Passaram: ${passed}`);
console.log(`❌ Falharam: ${failed}`);
console.log(`📊 Total:    ${passed + failed}`);
console.log(`🎯 Taxa:     ${Math.round((passed / (passed + failed)) * 100)}%`);

console.log('\n--- Falhas ---');
for (const r of results.filter(x => !x.ok)) {
  console.log(`  ❌ [${r.category}] ${r.name}: ${r.error || r.detail || 'FAILED'}`);
}

// Write markdown report
const md = `# Relatório de Testes Luna CLI — ${new Date().toISOString().slice(0,10)}

| Categoria | Ferramenta | Status | Detalhe |
|-----------|-----------|--------|---------|
${results.map(r => `| ${r.category} | ${r.name} | ${r.ok ? '✅' : '❌'} | ${r.detail || r.error || '-'} |`).join('\n')}

## Resumo

- ✅ Passaram: ${passed}
- ❌ Falharam: ${failed}
- 📊 Total: ${passed + failed}
- 🎯 Taxa: ${Math.round((passed / (passed + failed)) * 100)}%

## Falhas

${results.filter(x => !x.ok).map(r => `- **${r.category} / ${r.name}**: ${r.error || r.detail || 'FAILED'}`).join('\n') || 'Nenhuma falha!'}
`;

fs.writeFileSync(REPORT_FILE, md);
console.log(`\n📄 Relatório salvo em: ${REPORT_FILE}`);

process.exit(failed > 0 ? 1 : 0);
