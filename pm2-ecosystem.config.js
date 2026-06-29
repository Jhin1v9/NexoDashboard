/**
 * PM2 Ecosystem — NEXO_DASHBOARD_PRO
 * Uso: pm2 start pm2-ecosystem.config.js
 * Recarregar: pm2 reload pm2-ecosystem.config.js
 *
 * Os caminhos usam __dirname para funcionar tanto no PC de desenvolvimento
 * quanto na VPS, desde que luna-kernel e NexoDashboard estejam no mesmo
 * diretório pai.
 */
const path = require('path');
const dashboardRoot = __dirname;
const lunaWebRoot = path.resolve(dashboardRoot, '..', 'luna-kernel', 'luna-web');

module.exports = {
  apps: [
    {
      name: 'nexo-dashboard',
      script: './backend/server.js',
      cwd: dashboardRoot,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // PM2 lifecycle: aguarda process.send('ready') antes de considerar online
      wait_ready: true,
      // Tempo máximo para o processo encerrar gracefulmente (SIGTERM)
      kill_timeout: 5000,
      // Se wait_ready não for emitido em 10s, reinicia
      listen_timeout: 10000,
      // Backoff progressivo para evitar restart loops
      restart_delay: 3000,
      min_uptime: '10s',
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
        PORT: 3456,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3456,
      },
    },
    {
      name: 'luna-server',
      script: './backend/luna-server.js',
      cwd: dashboardRoot,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      wait_ready: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      restart_delay: 3000,
      min_uptime: '10s',
      max_restarts: 10,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
        LUNA_PORT: 3458,
      },
      env_production: {
        NODE_ENV: 'production',
        LUNA_PORT: 3458,
      },
    },
    {
      name: 'telegram-bot',
      script: './agents/telegram-luna-adapter.cjs',
      cwd: dashboardRoot,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      wait_ready: false,
      kill_timeout: 5000,
      restart_delay: 5000,
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'luna-vite',
      script: '/usr/bin/bash',
      args: ['-c', `cd ${lunaWebRoot} && npm run dev -- --host`],
      cwd: lunaWebRoot,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      restart_delay: 5000,
      min_uptime: '10s',
      max_restarts: 3,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
