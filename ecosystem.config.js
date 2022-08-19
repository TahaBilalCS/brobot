module.exports = {
  apps: [
    {
      name: 'brobot-api',
      script: 'nest start',
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
      'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js',
    },
  },
};
