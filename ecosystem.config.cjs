require('dotenv').config();

// Default configuration
module.exports = {
    apps: [
        {
            name: 'brobot',
            script: 'dist/src/index.js',
            node_args: "--experimental-modules --es-module-specifier-resolution=node", // So we can remove ".js" extensions from imports
            // args: "",
            // watch: ["src"],
            // watch_delay: 1000,
            // ignore_watch: ["node_modules", "dist", "__tests__"],
            env: {
                NODE_ENV: "development",
                // Add env vars here if you want them to update on restart. Can just kill the daemon
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
            node_args: "--experimental-modules --es-module-specifier-resolution=node",
            env: {
                NODE_ENV: 'production',
                // update environment variables in /etc/environment on EC2 instance. pm2 ain't working correctly
                // pm2 caches environment variables and --update-env [--env aws] doesn't seem to be working
                // Need to delete pm2 instance before starting instance again to update
            },
            'post-deploy':
                'npm install --dev typescript && npm install && npm run build && pm2 startOrRestart ecosystem.config.cjs --env production'
        }
    }
};
