// PM2: one app, memory-capped, logs rotated (pm2 install pm2-logrotate).
module.exports = {
  apps: [
    {
      name: 'daybook-api',
      script: 'packages/api/dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: 'logs/daybook-api.out.log',
      error_file: 'logs/daybook-api.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
