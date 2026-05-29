#!/usr/bin/env node
/**
 * Testes FASE 4: Advanced Architecture
 * KimiToolAdapter + ToolCallLedger
 */

import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const results = [];
let passed = 0;
let failed = 0;

function log(name, ok, detail = '') {
  const s = ok ? '✅' : '❌';
  console.log(`  ${s} ${name}${detail ? ' — ' + detail : ''}`);
  results.push({ name, ok, detail });
  if (ok) passed++; else failed++;
}

console.log('\n═══════════════════════════════════════════════════');
console.log('  FASE 4: Advanced Architecture');
console.log('═══════════════════════════════════════════════════\n');

// ── KimiToolAdapter ──
console.log('--- KimiToolAdapter ---');
const { KimiToolAdapter } = require('./kimi-tool-adapter.cjs');
const adapter = new KimiToolAdapter();

// 4.1: List supported tools
const supported = adapter.listSupported();
log('Adapter listSupported', supported.length === 4, `${supported.length} tools`);

// 4.2: ipython adapter
const ipython = adapter.adapt('ipython', { code: 'print(1+1)' });
log('Adapter ipython', ipython.lunaTool === 'executeShell' && ipython.params.command.includes('python3'), `lunaTool=${ipython.lunaTool}`);

// 4.3: web_search adapter
const ws = adapter.adapt('web_search', { query: 'bitcoin' });
log('Adapter web_search', ws.lunaTool === 'searchWeb' && ws.params.query === 'bitcoin', `lunaTool=${ws.lunaTool}`);

// 4.4: browser adapter
const br = adapter.adapt('browser', { url: 'https://example.com' });
log('Adapter browser', br.lunaTool === 'fetchURL' && br.params.url === 'https://example.com', `lunaTool=${br.lunaTool}`);

// 4.5: browser invalid URL
const brInvalid = adapter.adapt('browser', { url: 'ftp://bad' });
log('Adapter browser rejects invalid URL', !!brInvalid.error, 'error=' + brInvalid.error);

// 4.6: computer adapter
const comp = adapter.adapt('computer', { action: 'screenshot' });
log('Adapter computer', comp.lunaTool === 'desktop' && comp.params.action === 'screenshot', `lunaTool=${comp.lunaTool}`);

// 4.7: unsupported tool
const unsup = adapter.adapt('unknown_tool', {});
log('Adapter unsupported', !!unsup.error, 'error=' + unsup.error);

// 4.8: isSupported
log('Adapter isSupported(ipython)', adapter.isSupported('ipython'), 'true');
log('Adapter isSupported(foobar)', !adapter.isSupported('foobar'), 'false');

// ── ToolCallLedger ──
console.log('\n--- ToolCallLedger ---');
const { ToolCallLedger } = require('./tool-call-ledger.cjs');
const ledger = new ToolCallLedger();

// 4.9: Register new tool call
const r1 = ledger.register('ipython', { code: 'print(1)' }, 'dom_mirror');
log('Ledger register new', r1.isNew && r1.status === 'pending', `key=${r1.key.slice(0,8)}`);

// 4.10: Duplicate registration
const r2 = ledger.register('ipython', { code: 'print(1)' }, 'interceptor');
log('Ledger duplicate', !r2.isNew && r2.status === 'pending', 'isNew=false');

// 4.11: Mark executing
ledger.markExecuting('ipython', { code: 'print(1)' });
log('Ledger isExecuting', ledger.isExecuting('ipython', { code: 'print(1)' }), 'true');

// 4.12: Mark completed
ledger.markCompleted('ipython', { code: 'print(1)' }, { stdout: '1' });
log('Ledger isExecuted', ledger.isExecuted('ipython', { code: 'print(1)' }), 'true');

// 4.13: Retry (must be failed first)
ledger.markFailed('ipython', { code: 'print(1)' }, 'SyntaxError');
const retry = ledger.markRetry('ipython', { code: 'print(1)' });
log('Ledger retry', retry && retry.status === 'pending' && retry.retries === 1, `retries=${retry?.retries}`);

// 4.14: Mark failed
ledger.markFailed('ipython', { code: 'print(1)' }, 'SyntaxError');
log('Ledger failed status', ledger.getStatus().counts.failed === 1, '1 failed');

// 4.15: Prune old entries
ledger.markCompleted('browser', { url: 'x' }, {}); // completed entry
ledger.prune(0);
log('Ledger prune', ledger.getStatus().counts.completed === 0, `completed=${ledger.getStatus().counts.completed}`);

// 4.16: Race condition simulation
ledger.reset();
const t1 = ledger.register('ipython', { code: 'x=1' });
const t2 = ledger.register('ipython', { code: 'x=1' });
const t3 = ledger.register('ipython', { code: 'x=1' });
log('Ledger race: only first is new', t1.isNew && !t2.isNew && !t3.isNew, 'deduplication works');

// 4.17: Status reporting
ledger.reset();
ledger.register('a', { p: 1 });
ledger.register('b', { p: 2 });
ledger.markCompleted('a', { p: 1 }, {});
const status = ledger.getStatus();
log('Ledger status', status.total === 2 && status.counts.completed === 1 && status.counts.pending === 1, JSON.stringify(status.counts));

// ── Report ──
console.log('\n═══════════════════════════════════════════════════');
console.log('  RELATÓRIO FASE 4');
console.log('═══════════════════════════════════════════════════\n');
console.log(`✅ Passaram: ${passed}`);
console.log(`❌ Falharam: ${failed}`);
console.log(`🎯 Taxa: ${Math.round((passed / (passed + failed)) * 100)}%`);

if (failed > 0) {
  console.log('\n--- Falhas ---');
  for (const r of results.filter(x => !x.ok)) {
    console.log(`  ❌ ${r.name}: ${r.detail}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
