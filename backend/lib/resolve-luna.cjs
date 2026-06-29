/**
 * resolve-luna.cjs
 * Helper portátil para descobrir onde o luna-kernel está instalado.
 * Ordem de precedência:
 *   1. LUNA_KERNEL_DIR (env var)
 *   2. ~/.luna-kernel               (layout antigo do PC do Elias/Abner)
 *   3. ~/.luna/kernel               (novo layout LUNA_HOME)
 *   4. ../../.luna-kernel           (ao lado do dashboard)
 *   5. ../../luna-kernel            (ao lado do dashboard, nome sem ponto)
 *   6. ../../../luna-kernel         (um nível acima do dashboard, layout VPS)
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

function findLunaKernel() {
  if (process.env.LUNA_KERNEL_DIR && fs.existsSync(process.env.LUNA_KERNEL_DIR)) {
    return process.env.LUNA_KERNEL_DIR;
  }

  const home = os.homedir();
  const candidates = [
    path.join(home, '.luna-kernel'),
    path.join(home, '.luna', 'kernel'),
    path.resolve(__dirname, '..', '..', '.luna-kernel'),
    path.resolve(__dirname, '..', '..', 'luna-kernel'),
    path.resolve(__dirname, '..', '..', '..', 'luna-kernel'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'luna-soul.cjs'))) {
      return candidate;
    }
  }

  // Fallback: env var or first candidate so the require fails with a clear path
  return process.env.LUNA_KERNEL_DIR || candidates[0];
}

const LUNA_KERNEL_DIR = findLunaKernel();

module.exports = { LUNA_KERNEL_DIR };
