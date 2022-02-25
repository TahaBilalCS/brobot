import { TwurpleInterface } from '../api/models/Twurple.js';
import mongoose, { QueryOptions } from 'mongoose';
import { TwitchBot } from './TwitchBot.js';
import moment from 'moment-timezone';
import { appenv } from '../config/appenv.js';
import { ClientCredentialsAuthProvider, RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { ApiClient } from '@twurple/api';

class TwurpleInstance {
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

    get twitchBot(): TwitchBot {
        return this._twitchBot;
    }

    get botChatClient(): ChatClient {
        return this._botChatClient;
    }

    get streamerApiClient(): ApiClient {
        return this._streamerApiClient;
    }

    get botApiClient(): ApiClient {
        return this._botApiClient;
    }

    public async initTwurple(): Promise<void> {
        // Use config in db or update refresh & auth tokens from environment
        const twurpleOptionsBot = await this._getOrCreateTwurpleOptions('bot');
        const twurpleOptionsStreamer = await this._getOrCreateTwurpleOptions('streamer');
        // If options were created/retrieved from DB
        if (twurpleOptionsBot && twurpleOptionsStreamer) {
            const timeNA_EST = moment.tz(twurpleOptionsBot.obtainmentTimestamp, 'America/New_York').format('ha z');
            console.log(`Twurple Options Obtained: ${timeNA_EST}`);

            /** Create Auth Credentials */
            // Create app token for bot API
            const botApiAuth = new ClientCredentialsAuthProvider(appenv.TWITCH_CLIENT_ID, appenv.TWITCH_SECRET);
            // Create refreshing auth provider in order to stay connected to twurple chat client
            const botChatRefreshingAuth = this._createTwurpleRefreshingAuthProvider(twurpleOptionsBot, 'bot');
            // Create refreshing auth provider in order to stay connected to twurple api client
            const streamerApiRefreshingAuth = this._createTwurpleRefreshingAuthProvider(
                twurpleOptionsStreamer,
                'streamer'
            );

            /** Init Clients and Bots */
            // TODO warning: Can't use chat client to say anything when init.
            // API Client for predictions/etc
            this._streamerApiClient = new ApiClient({ authProvider: streamerApiRefreshingAuth });
            // Handle twitch chat messages and api client
            this._botChatClient = await TwurpleInstance._createChatClient(botChatRefreshingAuth);
            // API client for bot event subscriptions
            this._botApiClient = new ApiClient({ authProvider: botApiAuth });
            // Set to twitch instance
            this._twitchBot = new TwitchBot();
            // Wait for chat bot to be registered
            await this._twitchBot.init();
        } else {
            console.log('Error Obtaining Twurple Options');
        }
    }

    private async _getOrCreateTwurpleOptions(user: string): Promise<TwurpleInterface | null> {
        const twurpleOptions: TwurpleInterface | null = await this._twurpleConfig.findOne({ user: user });
        if (twurpleOptions) return twurpleOptions;

        let accessToken, refreshToken;
        // Todo Note: Running ads requires the streamer tokens for the chat client
        if (user === 'bot') {
            accessToken = appenv.BROBOT_ACCESS_TOKEN;
            refreshToken = appenv.BROBOT_REFRESH_TOKEN;
        } else if (user === 'streamer') {
            accessToken = appenv.STREAMER_ACCESS_TOKEN;
            refreshToken = appenv.STREAMER_REFRESH_TOKEN;
        }

        // If no options found
        console.log('Twurple Options Could Not Be Retrieved From DB, Making New One');
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
            console.log('Error Saving New Twurple Config To DB');
            return null;
        }
    }

    // todo not sure if async callback onRefresh is why we need to make this function async
    private _createTwurpleRefreshingAuthProvider(
        twurpleOptions: TwurpleInterface,
        user: string
    ): RefreshingAuthProvider {
        return new RefreshingAuthProvider(
            {
                clientId: appenv.TWITCH_CLIENT_ID,
                clientSecret: appenv.TWITCH_SECRET,
                onRefresh: async (newTokenData): Promise<void> => {
                    // upsert will create a doc if not found, new will ensure newPokeDoc contains the newest db obj
                    const options: QueryOptions = { upsert: true, new: true };

                    // todo when updating MongooseError: Query was already executed: twurple.findOneAndUpdate({}
                    await this._twurpleConfig
                        .findOneAndUpdate({ user }, newTokenData, options)
                        .then(() => {
                            console.log('Success Update Twurple Options', new Date().toLocaleString());
                        })
                        .catch(err => {
                            console.log('Error Update Twurple Options DB:\n', err);
                        });
                }
            },
            twurpleOptions
        );
    }

    private static async _createChatClient(authProvider: RefreshingAuthProvider): Promise<ChatClient> {
        const botChatClient = new ChatClient({
            authProvider,
            isAlwaysMod: true, // https://twurple.js.org/reference/chat/interfaces/ChatClientOptions.html#isAlwaysMod
            channels: [appenv.TWITCH_CHANNEL_LISTEN]
        });
        // 100 requests per 30 seconds
        console.log('Connecting To Twurple Chat Client...');
        await botChatClient.connect();

        return botChatClient;
    }
}

export const twurpleInstance: TwurpleInstance = new TwurpleInstance();
