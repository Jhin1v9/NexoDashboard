/**
 * Global Teardown — mata backend + frontend após os testes E2E
 */

module.exports = async function globalTeardown() {
  console.log('\n🧹 [E2E Teardown] Encerrando serviços...\n');

  const pids = globalThis.__E2E_PIDS || [];
  for (const pid of pids) {
    if (pid) {
      try {
        process.kill(-pid, 'SIGTERM'); // mata o grupo de processos
        console.log(`  ✅ Processo ${pid} encerrado`);
      } catch (e) {
        console.log(`  ⚠️ Processo ${pid} já encerrado`);
      }
    }
  }

  console.log('\n👋 [E2E Teardown] Finalizado\n');
};
