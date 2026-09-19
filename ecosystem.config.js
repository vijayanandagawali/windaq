// PM2 Production Process Manager Configuration for WinDaq Platform (daqwon.in)
module.exports = {
  apps: [
    {
      name: 'windaq-backend',
      script: './server/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        DOMAIN: 'daqwon.in'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/backend_error.log',
      out_file: './logs/backend_out.log',
      merge_logs: true
    },
    {
      name: 'windaq-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
