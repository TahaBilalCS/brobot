console.log('pro', process.env);
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
            // todo: Change this ref to main when pushing up migration
            ref: 'origin/nestjs-migration',
            repo: 'git@github.com:TahaBilalCS/brobot.git',
            path: '/home/ubuntu/brobot',
            // remove npx by installing as dependency instead of devDependency
            // Need to kill daemon in order to update any changed environment variables
            'post-deploy':
                'npm install && npm run prebuild && npm run build && npx prisma migrate deploy && pm2 kill && pm2 start ecosystem.config.js --env production --update-env'
        }
    }
};
