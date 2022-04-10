import { logger } from '../utils/LoggerUtil';
import { TwurpleInterface } from '../api/models/Twurple';
import mongoose, { QueryOptions } from 'mongoose';
import { TwitchBot } from './TwitchBot';
import { appenv } from '../config/appenv';
import { ClientCredentialsAuthProvider, RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { ApiClient } from '@twurple/api';

/**
 * Auth for either bot or streamer credentials
 */
enum AUTH_USER {
    BOT = 'bot',
    STREAMER = 'streamer'
}

/**
 * Initializes and waits for all Twurple related configurations
 */
class TwurpleInstance {
    /**
     * Twurple model from db
     * @private
     */
    private _twurpleConfig = mongoose.model<TwurpleInterface>('twurple');

    /**
     * Bot that incoming commands commands
     * @private
     */
    private _twitchBot!: TwitchBot;

    /**
     * Chat client configured under bot's credentials
     * @private
     */
    private _botChatClient!: ChatClient;

    /**
     * Api client configured under streamer's credentials
     * @private
     */
    private _streamerApiClient!: ApiClient;

    /**
     * Api client configured under bot's credentials
     * @private
     */
    private _botApiClient!: ApiClient;

    /**
     * Bot that handles initializing all chat commands and onMessage listeners
     */
    public get twitchBot(): TwitchBot {
        return this._twitchBot;
    }

    /**
     * Client connection registered under bot's credentials (used primarily to send messages to Twitch chat)
     */
    public get botChatClient(): ChatClient {
        return this._botChatClient;
    }

    /**
     * Api client registered under streamer's credentials for more options (creating markers & predictions)
     */
    public get streamerApiClient(): ApiClient {
        return this._streamerApiClient;
    }

    /**
     * Api client registered under bot's credentials for event sub
     */
    public get botApiClient(): ApiClient {
        return this._botApiClient;
    }

    /**
     * Init all twurple related bots and wait for successful connections
     */
    public async initTwurple(): Promise<void> {
        // Use config in db or update refresh & auth tokens from environment
        const twurpleOptionsBot = await this._getOrCreateTwurpleOptions(AUTH_USER.BOT);
        const twurpleOptionsStreamer = await this._getOrCreateTwurpleOptions(AUTH_USER.STREAMER);
        // If options were created/retrieved from DB
        if (twurpleOptionsBot && twurpleOptionsStreamer) {
            logger.warn(`Twurple Options Obtained`);

            /** Create Auth Credentials */
            // Create app token for bot API
            const botApiAuth = new ClientCredentialsAuthProvider(appenv.TWITCH_CLIENT_ID, appenv.TWITCH_SECRET);
            // Refreshing auth provider (stay connected to bot chat client)
            const botChatRefreshingAuth = this._createTwurpleRefreshingAuthProvider(twurpleOptionsBot, AUTH_USER.BOT);
            // Refreshing auth provider (stay connected to streamer api client)
            const streamerApiRefreshingAuth = this._createTwurpleRefreshingAuthProvider(
                twurpleOptionsStreamer,
                AUTH_USER.STREAMER
            );

            /** Init Clients and Bots */
            // API Client for predictions/markers/etc
            this._streamerApiClient = new ApiClient({ authProvider: streamerApiRefreshingAuth });
            // API client for bot event subscriptions
            this._botApiClient = new ApiClient({ authProvider: botApiAuth });
            // Create and wait for a chat client to be connected and registered
            this._botChatClient = await this._createChatClientAndWaitForConnection(botChatRefreshingAuth);
            // Set to twitch instance
            this._twitchBot = new TwitchBot();
            // Init asynchronous setup for bot commands
            await this._twitchBot.init();
        } else {
            logger.error('Error Obtaining Twurple Options');
        }
    }

    /**
     * Get twurple config from DB
     * @param user
     * @private
     */
    private async _getOrCreateTwurpleOptions(user: string): Promise<TwurpleInterface | null> {
        let twurpleOptions: TwurpleInterface | null = null;
        try {
            twurpleOptions = await this._twurpleConfig.findOne({ user: user });
        } catch (err) {
            logger.error('Error Getting Twurple Options From DB');
            logger.error(err);
        }

        if (twurpleOptions) return twurpleOptions;

        let accessToken, refreshToken;
        if (user === AUTH_USER.BOT) {
            accessToken = appenv.BROBOT_ACCESS_TOKEN;
            refreshToken = appenv.BROBOT_REFRESH_TOKEN;
        } else if (user === AUTH_USER.STREAMER) {
            accessToken = appenv.STREAMER_ACCESS_TOKEN;
            refreshToken = appenv.STREAMER_REFRESH_TOKEN;
        }

        // If no options found
        logger.warn('Twurple Options Could Not Be Retrieved From DB, Creating A New One');
        const newTwurpleConfig = {
            user: user,
            accessToken: accessToken,
            refreshToken: refreshToken,
            scope: [
                'user_read',
                'chat:read',
                'chat:edit',
                'channel:moderate',
                'channel:read:redemptions',
                'channel:manage:predictions',
                'channel:manage:redemptions',
                'channel:edit:commercial',
                'channel:read:subscriptions',
                'moderation:read',
                'channel_subscriptions',
                'analytics:read:extensions',
                'analytics:read:games',
                'bits:read',
                'channel:manage:broadcast',
                'channel:manage:extensions',
                'channel:manage:polls',
                'channel:manage:schedule',
                'channel:manage:videos',
                'channel:read:editors',
                'channel:read:goals',
                'channel:read:hype_train',
                'channel:read:polls',
                'channel:read:predictions',
                'channel:read:redemptions',
                'channel:read:subscriptions',
                'clips:edit',
                'moderator:manage:banned_users',
                'moderator:read:blocked_terms',
                'moderator:manage:blocked_terms',
                'moderator:manage:automod',
                'moderator:read:automod_settings',
                'moderator:manage:automod_settings',
                'moderator:read:chat_settings',
                'moderator:manage:chat_settings',
                'user:manage:blocked_users',
                'user:read:blocked_users',
                'user:read:broadcast',
                'user:edit:broadcast',
                'user:read:follows',
                'user:read:subscriptions'
            ],
            expiresIn: 0, // 0 will fetch a new token
            obtainmentTimestamp: 0
        };

        // Save and return the newly updated config from DB
        try {
            // Using "new" keyword to avoid Typescript compilation errors
            // https://stackoverflow.com/questions/38939507/error-ts2348-value-of-type-typeof-objectid-is-not-callable-did-you-mean-to-i
            return await new this._twurpleConfig(newTwurpleConfig).save();
        } catch (err) {
            logger.error('Error Saving New Twurple Config To DB');
            return null;
        }
    }

    /**
     * Create and return a refreshing auth provider that periodically updates our refresh tokens
     * @param twurpleOptions
     * @param user
     * @private
     */
    private _createTwurpleRefreshingAuthProvider(
        twurpleOptions: TwurpleInterface,
        user: string
    ): RefreshingAuthProvider {
        return new RefreshingAuthProvider(
            {
                clientId: appenv.TWITCH_CLIENT_ID,
                clientSecret: appenv.TWITCH_SECRET,
                onRefresh: (newTokenData): void => {
                    // upsert will create a doc if not found, new will ensure document contains the newest db obj
                    const options: QueryOptions = { upsert: true, new: true };
                    this._twurpleConfig
                        .findOneAndUpdate({ user }, newTokenData, options)
                        .then(() => {
                            logger.warn('Success Update Twurple Options');
                            return null;
                        })
                        .catch(err => {
                            logger.error('Error Update Twurple Options DB');
                            logger.error(err);
                        });
                }
            },
            twurpleOptions
        );
    }

    /**
     * Create and wait on chat client registration
     * @param authProvider
     * @private
     */
    private async _createChatClientAndWaitForConnection(authProvider: RefreshingAuthProvider): Promise<ChatClient> {
        const botChatClient = new ChatClient({
            authProvider,
            isAlwaysMod: true, // https://twurple.js.org/reference/chat/interfaces/ChatClientOptions.html#isAlwaysMod
            channels: [appenv.TWITCH_CHANNEL_LISTEN]
        });
        // 100 requests per 30 seconds
        logger.warn('Connecting To Twurple Chat Client...');
        // connect just makes the WSS connection, registration logs you in
        await botChatClient.connect();

        // Don't return until chat client is registered and connected. TODO: Very dangerous eh
        return new Promise<ChatClient>(resolve => {
            botChatClient.on(botChatClient.onRegister, () => {
                logger.warn('Twitch Bot Registered');
                resolve(botChatClient);
            });
        });
    }
}

export const twurpleInstance: TwurpleInstance = new TwurpleInstance();
