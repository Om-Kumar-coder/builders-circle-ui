module.exports = {
  apps: [
    {
      name: 'builders-circle-backend',
      script: './backend/dist/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'builders-circle-frontend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      }
    }
  ]
};