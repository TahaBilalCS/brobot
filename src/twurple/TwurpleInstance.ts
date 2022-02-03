/* eslint-disable */
import process from 'process';
import mongoose, { QueryOptions } from 'mongoose';
import moment from 'moment-timezone';

import { TwurpleInterface } from '../models/Twurple.js';
import { Instance } from 'express-ws';
import { AuthProvider, RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { socketConnect } from './BrobotSocket.js';
import { TwitchBot } from './TwitchBot.js';
import { ApiClient } from '@twurple/api';

//todo interface for this class?
export class TwitchInstance {
    private _twurpleConfig: mongoose.Model<TwurpleInterface>;
    public twitchBot: TwitchBot | undefined;
    constructor(private _wsInstance: Instance) {
        this._twurpleConfig = mongoose.model<TwurpleInterface>('twurple');
    }

    // Now, as long as top-level await has not landed in popular runtimes, you need to work around that by placing
    // your main routine inside an async function and running it.
    async init(): Promise<void> {
        // Use config in db or update refresh & auth tokens from environment
        const twurpleOptionsBot = await this._getOrCreateTwurpleOptions('bot');
        const twurpleOptionsStreamer = await this._getOrCreateTwurpleOptions('streamer');
        // If options were created/retrieved from DB
        if (twurpleOptionsBot && twurpleOptionsStreamer) {
            // TODO warning, cant use twurple chat client to say anything when init, has to be in setTimeout.
            const timeNA_EST = moment.tz(twurpleOptionsBot.obtainmentTimestamp, 'America/New_York').format('ha z');
            console.log(`Twurple Options Obtained: ${timeNA_EST}`);
            // Create refreshing auto provider in order to stay connected to twurple chat client
            const twurpleBotRefreshingAuthProvider = await this._createTwurpleRefreshingAuthProvider(
                twurpleOptionsBot,
                'bot'
            );
            // Create refreshing auto provider in order to stay connected to twurple api client
            const twurpleStreamerRefreshingAuthProvider = await this._createTwurpleRefreshingAuthProvider(
                twurpleOptionsStreamer,
                'streamer'
            );

            // Handle twitch chat messages and api client
            const TwitchChatBot = await this._setupTwurpleChatBot(
                twurpleBotRefreshingAuthProvider,
                twurpleStreamerRefreshingAuthProvider
            );
            // Wait for chat bot to be registered
            await TwitchChatBot.init();
            // Set to twitch instance
            this.twitchBot = TwitchChatBot;
            // Handle client websocket messages
            socketConnect(TwitchChatBot, this._wsInstance);
        } else {
            console.log('Error Obtaining Twurple Options');
        }
    }

    async _getOrCreateTwurpleOptions(user: string): Promise<TwurpleInterface | null> {
        const twurpleOptions: TwurpleInterface | null = await this._twurpleConfig.findOne({ user: user });
        if (twurpleOptions) return twurpleOptions;

        let accessToken, refreshToken;
        // Todo Note: Running ads requires the streamer tokens for the chat client
        if (user === 'bot') {
            accessToken = process.env.BROBOT_ACCESS_TOKEN;
            refreshToken = process.env.BROBOT_REFRESH_TOKEN;
        } else if (user === 'streamer') {
            accessToken = process.env.STREAMER_ACCESS_TOKEN;
            refreshToken = process.env.STREAMER_REFRESH_TOKEN;
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
    async _createTwurpleRefreshingAuthProvider(
        twurpleOptions: TwurpleInterface,
        user: string
    ): Promise<RefreshingAuthProvider> {
        const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
        const TWITCH_SECRET = process.env.TWITCH_SECRET || '';

        return new RefreshingAuthProvider(
            {
                clientId: TWITCH_CLIENT_ID,
                clientSecret: TWITCH_SECRET,
                onRefresh: async newTokenData => {
                    // upsert will create a doc if not found, new will ensure newPokeDoc contains the newest db obj
                    const options: QueryOptions = { upsert: true, new: true };

                    // todo when updating MongooseError: Query was already executed: twurple.findOneAndUpdate({}
                    await this._twurpleConfig
                        .findOneAndUpdate({ user: user }, newTokenData, options)
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

    async _setupTwurpleChatBot(
        twurpleBotRefreshingAuthProvider: RefreshingAuthProvider,
        twurpleStreamerRefreshingAuthProvider: RefreshingAuthProvider
    ): Promise<TwitchBot> {
        const authProvider: AuthProvider = twurpleBotRefreshingAuthProvider;

        const chatClient = new ChatClient({
            authProvider,
            isAlwaysMod: true, // https://twurple.js.org/reference/chat/interfaces/ChatClientOptions.html#isAlwaysMod
            channels: [process.env.TWITCH_CHANNEL_LISTEN || '']
        });

        // API Client for predictions/etc
        const apiClient = new ApiClient({ authProvider: twurpleStreamerRefreshingAuthProvider });

        // 100 per 30 seconds
        console.log('Connecting To Twurple Chat Client...');
        await chatClient.connect();

        return new TwitchBot(chatClient, this._wsInstance, apiClient);
    }
}
