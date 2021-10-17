/* eslint-disable */
import { Instance } from 'express-ws';
import { ChatClient } from '@twurple/chat';
import { IncomingEvents, OutgoingEvents, OutgoingErrors } from './types/EventsInterface.js';
import process from 'process';
import { TwitchInstance } from './TwitchChatHandler.js';

// TODO Should make a class to match pluralization, Should setup reconnect logic
export const socketConnect = (TwitchInstance: TwitchInstance, wsInstance: Instance): void => {
    console.log('Setup Server Websocket');
    wsInstance.app.ws('/ashketchum', (ws, req) => {
        const TWITCH_CHANNEL_LISTEN = process.env.TWITCH_CHANNEL_LISTEN || '';
        // On message from client
        ws.on('message', msg => {
            const clientMessage = String(msg);
            console.log('Raw Message From Client:', clientMessage);
            switch (clientMessage) {
                case IncomingEvents.CHATBAN_COMPLETE:
                    TwitchInstance.getChatBan().resetUniqueVotedUsers();
                    TwitchInstance.getTwurpleChatClient()
                        .say(
                            TWITCH_CHANNEL_LISTEN,
                            `${process.env.TWITCH_CHANNEL_LISTEN} is now free. All votes have been reset.`
                        )
                        .then();
                    break;
                case IncomingEvents.TRAMA_CONNECTED:
                    console.log('Client Connection Received');
                    break;
                default:
                    console.log('BrobotSocket Received Unknown Message From Client');
            }
        });

        // When client closes connection
        ws.on('close', () => {
            // TODO reset all commands on twitch instance
            TwitchInstance.getChatBan().resetUniqueVotedUsers();
            console.log('Cancelling All Ongoing Events, Client WebSocket Closed');
        });

        ws.on('error', (err: Error) => {
            console.log('Server Websocket Error', err);
        });
    });
};
