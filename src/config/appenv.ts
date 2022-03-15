import process from 'process';

/**
 * Export environment variables
 * (?? '') used to handle possible undefined env vars
 */
export const appenv = {
    NODE_ENV: process.env.NODE_ENV ?? '',
    TEST_SECRET: process.env.TEST_SECRET ?? '',
    SESSION_SECRET: process.env.SESSION_SECRET ?? '',
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID ?? '',
    TWITCH_SECRET: process.env.TWITCH_SECRET ?? '',
    TWITCH_CALLBACK_URL: process.env.TWITCH_CALLBACK_URL ?? '',
    MONGO_URI: process.env.MONGO_URI ?? '',
    COOKIE_KEY: process.env.COOKIE_KEY ?? '',
    TWITCH_CHANNEL_LISTEN: process.env.TWITCH_CHANNEL_LISTEN ?? '',
    STREAMER_ACCESS_TOKEN: process.env.STREAMER_ACCESS_TOKEN ?? '',
    STREAMER_REFRESH_TOKEN: process.env.STREAMER_REFRESH_TOKEN ?? '',
    STREAMER_AUTH_ID: process.env.STREAMER_AUTH_ID ?? '',
    /** Shared Environment Vars */
    PORT: process.env.PORT ?? '',
    DOMAIN: process.env.DOMAIN ?? '',
    BROBOT_ACCESS_TOKEN: process.env.BROBOT_ACCESS_TOKEN ?? '',
    BROBOT_REFRESH_TOKEN: process.env.BROBOT_REFRESH_TOKEN ?? '',
    RIOT_API_KEY: process.env.RIOT_API_KEY ?? '',
    TWITCH_BOT_USERNAME: process.env.TWITCH_BOT_USERNAME ?? '',
    LICHESS_AUTH_TOKEN: process.env.LICHESS_AUTH_TOKEN ?? '',
    WS_SECRET: process.env.WS_SECRET ?? ''
};
