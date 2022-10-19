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
            user: process.env.AWS_USER,
            host: process.env.AWS_PUBLIC_IP,
            key: process.env.AWS_SSH_KEY,
            // todo: Change this ref to main when pushing up migration
            ref: 'origin/nestjs-migration',
            repo: 'git@github.com:TahaBilalCS/brobot.git',
            path: process.env.AWS_EC2_PATH,
            // remove npx by installing as dependency instead of devDependency
            // Need to kill daemon in order to update any changed environment variables
            'post-deploy':
                'npm install && npm run prebuild && npm run build && npx prisma migrate deploy && pm2 kill && pm2 start ecosystem.config.js --env production --update-env'
        }
    }
};
