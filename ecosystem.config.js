module.exports = {
  apps: [{
    name: 'brobot-api',
    script: './index.js'
  }],
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'ec2-3-142-186-251.us-east-2.compute.amazonaws.com',
      key: '~/.ssh/brobot-api.pem',
      ref: 'origin/nestjs-migration',
      repo: 'git@github.com:TahaBilalCS/brobot.git',
      path: '/home/ubuntu/brobot',
      'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js'
    }
  }
}
