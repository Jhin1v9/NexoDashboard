/**
 * Luna Soul — Re-export from ~/.luna-kernel/luna-soul.cjs
 * This file exists to maintain backward compatibility for any code
 * that imports from this path. The source of truth is in ~/.luna-kernel/.
 */
const path = require('path');
const { LUNA_KERNEL_DIR } = require('../backend/lib/resolve-luna.cjs');
module.exports = require(path.join(LUNA_KERNEL_DIR, 'luna-soul.cjs'));
