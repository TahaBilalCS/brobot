module.exports = {
  apps: [
    {
      name: 'brobot-api',
      script: 'npm run start:prod',
    },
  ],
  deploy: {
    production: {
      user: 'ubuntu',
      host: '3.143.76.120',
      key: '~/.ssh/brobot-api.pem',
      ref: 'origin/nestjs-migration',
      repo: 'git@github.com:TahaBilalCS/brobot.git',
      path: '/home/ubuntu/brobot',
      'post-deploy':
        'npm install && npm run build && pm2 startOrRestart ecosystem.config.js --env production',
    },
  },
};
