/**
 * Luna Soul — Re-export from ~/.luna-kernel/luna-soul.cjs
 * This file exists to maintain backward compatibility for any code
 * that imports from this path. The source of truth is in ~/.luna-kernel/.
 */
const path = require('path');
const os = require('os');
module.exports = require(path.join(os.homedir(), '.luna-kernel', 'luna-soul.cjs'));
