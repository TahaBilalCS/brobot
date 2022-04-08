require('dotenv').config();

// Default configuration
module.exports = {
    apps: [
        {
            name: 'brobot',
            // Pre-Babel: dist/src/index.js
            script: 'lib/index.js',
            node_args: '--experimental-specifier-resolution=node', // So we can remove ".js" extensions from imports
            env: {
                NODE_ENV: 'development'
                // Add env vars here if you want them to update on restart. Should just kill the daemon
            }
        }
    ],
    deploy: {
        production: {
            user: process.env.AWS_USER,
            host: process.env.AWS_PUBLIC_IP,
            key: process.env.AWS_SSH_KEY,
            ref: 'origin/main',
            repo: 'git@github.com:TahaBilalCS/brobot.git',
            path: process.env.AWS_EC2_PATH,
            node_args: '--experimental-specifier-resolution=node',
            env: {
                NODE_ENV: 'production'
                // update environment variables in /etc/environment on EC2 instance. pm2 ain't working correctly
                // pm2 caches environment variables and --update-env doesn't seem to be working
            },
            // Install dev dependencies since we clone our repo and need to rebuild on the server in production
            'post-deploy': 'npm install --production=false && npm run type-check && npm run build && pm2 startOrRestart ecosystem.config.cjs --env production'
        }
    }
};
