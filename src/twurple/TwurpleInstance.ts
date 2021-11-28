/* eslint-disable */
import process from 'process';
import mongoose from 'mongoose';
import moment from 'moment-timezone';

import { TwurpleInterface } from '../models/Twurple.js';
import { Instance } from 'express-ws';
import { AuthProvider, RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { socketConnect } from './BrobotSocket.js';
import { TwitchBot } from './TwitchBot.js';

//todo interface for this class?
export class TwitchInstance {
    private _twurpleConfig: mongoose.Model<TwurpleInterface>;

    constructor(private _wsInstance: Instance) {
        this._twurpleConfig = mongoose.model<TwurpleInterface>('twurple');
    }

    // Now, as long as top-level await has not landed in popular runtimes, you need to work around that by placing
    // your main routine inside an async function and running it.
    async init(): Promise<void> {
        // Use config in db or update refresh&auth tokens from environment
        const twurpleOptions = await this._getOrCreateTwurpleOptions();

        // If options were created/retrieved from DB
        if (twurpleOptions) {
            const timeNA_EST = moment.tz(twurpleOptions.obtainmentTimestamp, 'America/New_York').format('ha z');
            console.log(`Twurple Options Obtained: ${timeNA_EST}`);

            // Create refreshing auto provider in order to stay connected to twurple chat client
            const twurpleRefreshingAuthProvider = await this._createTwurpleRefreshingAuthProvider(twurpleOptions);
            // Handle twitch chat messages
            const TwitchChatBot = await this._setupTwurpleChatBot(twurpleRefreshingAuthProvider);
            // Handle client websocket messages
            socketConnect(TwitchChatBot, this._wsInstance);
        } else {
            console.log('Error Obtaining Twurple Options');
        }
    }

    async _getOrCreateTwurpleOptions(): Promise<TwurpleInterface | null> {
        const twurpleOptions: TwurpleInterface | null = await this._twurpleConfig.findOne({}); // TODO query twurple data better
        if (twurpleOptions) return twurpleOptions;

        // If no options found
        console.log('Twurple Options Could Not Be Retrieved From DB, Making New One');
        const newTwurpleConfig = {
            accessToken: process.env.BROBOT_ACCESS_TOKEN,
            refreshToken: process.env.BROBOT_REFRESH_TOKEN,
            scope: ['chat:edit', 'chat:read', 'user_read', 'channel:moderate', 'channel:read:redemptions'],
            expiresIn: 0, // 0 will fetch a new token
            obtainmentTimestamp: 0
        };

        // TODO need to handle what happens when can't save to DB
        return await new this._twurpleConfig(newTwurpleConfig).save();
    }

    // todo not sure if async callback onRefresh is why we need to make this function async
    async _createTwurpleRefreshingAuthProvider(twurpleOptions: TwurpleInterface): Promise<RefreshingAuthProvider> {
        const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
        const TWITCH_SECRET = process.env.TWITCH_SECRET || '';

        return new RefreshingAuthProvider(
            {
                clientId: TWITCH_CLIENT_ID,
                clientSecret: TWITCH_SECRET,
                onRefresh: async newTokenData => {
                    // todo when updating MongooseError: Query was already executed: twurple.findOneAndUpdate({}
                    await this._twurpleConfig.findOneAndUpdate({}, newTokenData, {}, (err, doc) => {
                        if (err) console.log('Error Update Twurple Options DB:\n', err);
                        console.log('Success Update Twurple Options', new Date().toLocaleString());
                    });
                }
            },
            twurpleOptions
        );
    }

    async _setupTwurpleChatBot(twurpleRefreshingAuthProvider: RefreshingAuthProvider): Promise<TwitchBot> {
        const authProvider: AuthProvider = twurpleRefreshingAuthProvider;

        const chatClient = new ChatClient({
            authProvider,
            isAlwaysMod: true, // https://twurple.js.org/reference/chat/interfaces/ChatClientOptions.html#isAlwaysMod
            channels: [process.env.TWITCH_CHANNEL_LISTEN || '']
        });

        // 100 per 30 seconds
        console.log('Connecting To Twurple Chat Client...');
        await chatClient.connect();

        return new TwitchBot(chatClient, this._wsInstance);
    }
}
