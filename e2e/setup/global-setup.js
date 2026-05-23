/**
 * Global Setup — sobe backend + frontend antes dos testes E2E
 */

const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');

function waitForUrl(url, timeout = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Timeout esperando ${url}`));
        return;
      }
      try {
        const res = await fetch(url);
        if (res.ok) { resolve(); return; }
      } catch {}
      setTimeout(check, 500);
    };
    check();
  });
}

module.exports = async function globalSetup() {
  console.log('\n🚀 [E2E Setup] Iniciando serviços...\n');

  // 1. Sobe o backend
  const backend = spawn('node', ['server.js'], {
    cwd: path.join(rootDir, 'backend'),
    env: { ...process.env, PORT: '3456', NODE_ENV: 'test' },
    detached: true,
    stdio: 'pipe',
  });
  backend.stdout?.on('data', d => process.stdout.write(`[BACKEND] ${d}`));
  backend.stderr?.on('data', d => process.stderr.write(`[BACKEND] ${d}`));

  // 2. Aguarda backend pronto
  await waitForUrl('http://localhost:3456/api/health');
  console.log('✅ Backend online (porta 3456)');

  // 3. Sobe o frontend (preview do build)
  const frontend = spawn('npx', ['vite', 'preview', '--port', '3457'], {
    cwd: path.join(rootDir, 'frontend'),
    env: process.env,
    detached: true,
    stdio: 'pipe',
  });
  frontend.stdout?.on('data', d => process.stdout.write(`[FRONTEND] ${d}`));
  frontend.stderr?.on('data', d => process.stderr.write(`[FRONTEND] ${d}`));

  // 4. Aguarda frontend pronto
  await waitForUrl('http://localhost:3457');
  console.log('✅ Frontend online (porta 3457)');

  // 5. Salva PIDs para o teardown matar depois
  globalThis.__E2E_PIDS = [backend.pid, frontend.pid];

  console.log('\n🧪 [E2E Setup] Pronto para testar!\n');
};
