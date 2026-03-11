module.exports = {
  apps: [
    {
      name: 'builders-circle-backend',
      script: './backend/src/server.ts',
      interpreter: 'node',
      interpreter_args: '--loader ts-node/esm --experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      cwd: '/var/www/builders-circle-ui',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
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