import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const lunaModule = require('./luna-cto-agent.cjs');

export const LunaAgent = lunaModule.LunaAgent || lunaModule.default?.LunaAgent || lunaModule.default;
export const runAgent = lunaModule.runAgent || lunaModule.default?.runAgent;
export const diagnose = lunaModule.diagnose || lunaModule.default?.diagnose;
export const CONFIG = lunaModule.CONFIG || lunaModule.default?.CONFIG || {};

export default LunaAgent;

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  if (process.argv.includes('--diagnose')) {
    diagnose();
  } else if (process.argv.includes('--full-extract')) {
    runAgent({ once: true, schedule: false, fullExtract: true }).catch(error => {
      console.error('[KEEP-ALIVE] Erro:', error.message);
      console.log('[KEEP-ALIVE] Luna continua ativa. Pressione Ctrl+C para sair.');
    });
  } else {
    runAgent({
      once: process.argv.includes('--once'),
      fullExtract: process.argv.includes('--reset')
    }).catch(error => {
      console.error('[KEEP-ALIVE] Erro:', error.message);
      console.log('[KEEP-ALIVE] Luna continua ativa. Pressione Ctrl+C para sair.');
    });
  }
}
