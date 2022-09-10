module.exports = {
    apps: [
        {
            name: 'brobot-api',
            script: 'dist/main.js',
            env: {
                NODE_ENV: 'development'
            },
            env_production: {
                NODE_ENV: 'production',
                TEST: 'test'
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
            // startOrRestart // remove npx
            // env: {
            //     NODE_ENV: 'production'
            // },
            'post-deploy':
                'source /etc/environment && nvm use 16.17.0 && npm install && npm run prebuild && npm run build && npx prisma migrate deploy && pm2 stop brobot-api && pm2 start ecosystem.config.js --env production --update-env'
        }
    }
};
