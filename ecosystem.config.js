module.exports = {
  apps: [
    {
      name: 'builders-circle-backend',
      script: 'src/server.ts',
      interpreter: 'node',
      interpreter_args: '--loader ts-node/esm',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      cwd: '/var/www/builders-circle-ui/backend'
    },
    {
      name: 'builders-circle-frontend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      cwd: '/var/www/builders-circle-ui',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};