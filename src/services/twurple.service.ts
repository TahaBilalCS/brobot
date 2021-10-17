/* eslint-disable */
import process from 'process';
import mongoose from 'mongoose';
import { TwurpleInterface } from '../models/Twurple.js';
import { Instance } from 'express-ws';

import { AuthProvider, RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient, PrivateMessage } from '@twurple/chat';
import { socketConnect } from './twurple/BrobotSocket.js';
import { TwitchInstance } from './twurple/TwitchChatHandler.js';
// Now, as long as top-level await has not landed in popular runtimes, you need to work around that by placing
// your main routine inside an async function and running it.
export const init = async (wsInstance: Instance): Promise<any> => {
    const Twurple = mongoose.model<TwurpleInterface>('twurple');

    const twurpleOptions = await getOrCreateTwurpleOptions(Twurple);
    if (twurpleOptions) {
        console.log('Twurple Options Obtained', twurpleOptions.obtainmentTimestamp);
        // Create refreshing auto provider in order to stay connected to twurple chat client
        const twurpleRefreshingAuthProvider = await setupTwurpleRefreshingAuthProvider(Twurple, twurpleOptions);
        // Handle twitch chat messages
        const TwitchInstance = await setupTwurpleChatClient(twurpleRefreshingAuthProvider, wsInstance);
        // Handle client websocket messages
        socketConnect(TwitchInstance, wsInstance);
    } else {
        console.log('Error Obtaining Twurple Options');
    }
};

const setupTwurpleChatClient = async (
    twurpleRefreshingAuthProvider: RefreshingAuthProvider,
    wsInstance: Instance
): Promise<TwitchInstance> => {
    const authProvider: AuthProvider = twurpleRefreshingAuthProvider;
    const chatClient = new ChatClient({
        authProvider,
        isAlwaysMod: true, // https://twurple.js.org/reference/chat/interfaces/ChatClientOptions.html#isAlwaysMod
        channels: [process.env.TWITCH_CHANNEL_LISTEN || '']
    });

    // 100 per 30 seconds
    console.log('Connecting To Twurple Chat Client...');
    await chatClient.connect();

    return new TwitchInstance(chatClient, wsInstance);
};

const setupTwurpleRefreshingAuthProvider = async (
    Twurple: mongoose.Model<TwurpleInterface>,
    twurpleOptions: TwurpleInterface
): Promise<RefreshingAuthProvider> => {
    const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
    const TWITCH_SECRET = process.env.TWITCH_SECRET || '';

    const tokenData: TwurpleInterface = {
        accessToken: twurpleOptions.accessToken,
        refreshToken: twurpleOptions.refreshToken,
        scope: twurpleOptions.scope,
        expiresIn: twurpleOptions.expiresIn,
        obtainmentTimestamp: twurpleOptions.obtainmentTimestamp
    };
    return new RefreshingAuthProvider(
        {
            clientId: TWITCH_CLIENT_ID,
            clientSecret: TWITCH_SECRET,
            onRefresh: async newTokenData => {
                // TODO, when updating MongooseError: Query was already executed: twurple.findOneAndUpdate({}
                await Twurple.findOneAndUpdate({}, newTokenData, {}, (err, doc) => {
                    if (err) console.log('Error Update Twurple Options DB:\n', err);
                    console.log('Success Update Twurple Options');
                });
            }
        },
        tokenData
    );
};
const getOrCreateTwurpleOptions = async (
    Twurple: mongoose.Model<TwurpleInterface>
): Promise<TwurpleInterface | null> => {
    const twurpleOptions: TwurpleInterface | null = await Twurple.findOne({}); // TODO query twurple data better
    if (twurpleOptions) return twurpleOptions;

    // If no options found
    console.log('Twurple Options Could Not Be Retreived From DB, Making New One');
    const newTwurpleConfig = {
        accessToken: process.env.BROBOT_ACCESS_TOKEN,
        refreshToken: process.env.BROBOT_REFRESH_TOKEN,
        scope: ['chat:edit', 'chat:read', 'user_read'],
        expiresIn: 0, // 0 will fetch a new token
        obtainmentTimestamp: 0
    };
    return await new Twurple(newTwurpleConfig).save();
};
