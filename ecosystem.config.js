module.exports = {
    apps: [
        {
            name: 'brobot-api',
            script: 'dist/main.js',
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production'
            }
        }
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
                'npm install && npm run prebuild && npm run build && npx prisma migrate deploy && pm2 startOrRestart ecosystem.config.js --env production'
        }
    }
};
