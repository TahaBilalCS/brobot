/* eslint-disable */
import { Instance } from 'express-ws';
import { IncomingEvents, OutgoingEvents } from './types/EventsInterface.js';
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
            // console.log('Raw Message From Client:', clientMessage);
            switch (clientMessage) {
                case IncomingEvents.CHATBAN_COMPLETE:
                    TwitchInstance.getChatBan().resetUniqueVotedUsers();
                    TwitchInstance.getTwurpleChatClient()
                        .say(
                            TWITCH_CHANNEL_LISTEN,
                            `${process.env.TWITCH_CHANNEL_LISTEN} is now free. All votes have been reset.`
                        )
                        .then();
                    console.log('Reset chat ban', new Date().toLocaleString());
                    break;
                case IncomingEvents.TRAMA_CONNECTED:
                    console.log('Client Connection Received', new Date().toLocaleString());
                    break;
                case IncomingEvents.PING:
                    console.log('Trama PING!', new Date().toLocaleString());
                    wsInstance.getWss().clients.forEach(localClient => {
                        console.log('Sending PONG!', new Date().toLocaleString());
                        localClient.send(OutgoingEvents.PONG);
                    });
                    break;
                case 'broke':
                    TwitchInstance.getTwurpleChatClient().say(TWITCH_CHANNEL_LISTEN, `Chat ban broke :(`).then();
                    console.log('Chat ban broke', new Date().toLocaleString());
                    break;
                default:
                    console.log('BrobotSocket Received Unknown Message From Client', clientMessage);
            }
        });

        // When client closes connection
        ws.on('close', () => {
            // TODO reset all commands on twitch instance
            TwitchInstance.getChatBan().resetUniqueVotedUsers();
            console.log('Cancelling All Ongoing Events, Client WebSocket Closed');
            console.log('Trama Closed Connection', new Date().toLocaleString());
        });

        ws.on('error', (err: Error) => {
            console.log('Server Websocket Error', err);
        });
    });
};
