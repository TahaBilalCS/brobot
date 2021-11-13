/* eslint-disable */
import { Instance } from 'express-ws';
import { IncomingEvents, OutgoingEvents } from './types/EventsInterface.js';
import process from 'process';
import { TwitchBot } from './TwitchBot.js';

// TODO Should make a class to match pluralization, Should setup reconnect logic
export const socketConnect = (TwitchBot: TwitchBot, wsInstance: Instance): void => {
    console.log('Setup Server Websocket');
    wsInstance.app.ws('/ashketchum', (ws, req) => {
        const TWITCH_CHANNEL_LISTEN = process.env.TWITCH_CHANNEL_LISTEN || '';
        // On message from client
        ws.on('message', msg => {
            const clientMessage = String(msg);
            // console.log('Raw Message From Client:', clientMessage);
            switch (clientMessage) {
                case IncomingEvents.VOICEBAN_COMPLETE:
                    TwitchBot.getVoiceBan()._resetUniqueVotedUsers();
                    TwitchBot.getTwurpleChatClient()
                        .say(
                            TWITCH_CHANNEL_LISTEN,
                            `${process.env.TWITCH_CHANNEL_LISTEN} is now unmuted. All votes have been reset.`
                        )
                        .then();
                    console.log('Reset Voice Ban', new Date().toLocaleString());
                    break;
                case IncomingEvents.CHATBAN_COMPLETE:
                    TwitchBot.getChatBan()._resetUniqueVotedUsers();
                    TwitchBot.getTwurpleChatClient()
                        .say(
                            TWITCH_CHANNEL_LISTEN,
                            `${process.env.TWITCH_CHANNEL_LISTEN} is now free. All votes have been reset.`
                        )
                        .then();
                    console.log('Reset Chat Ban', new Date().toLocaleString());
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
                    TwitchBot.getTwurpleChatClient().say(TWITCH_CHANNEL_LISTEN, `Uhoh something broke :(`).then();
                    console.log('Chat/Voice Ban Broke', new Date().toLocaleString());
                    break;
                default:
                    console.log('BrobotSocket Received Unknown Message From Client', clientMessage);
            }
        });

        // When client closes connection
        ws.on('close', () => {
            // TODO reset all commands on twitch instance
            TwitchBot.getChatBan()._resetUniqueVotedUsers();
            console.log('Cancelling All Ongoing Events, Client WebSocket Closed');
            console.log('Trama Closed Connection', new Date().toLocaleString());
        });

        ws.on('error', (err: Error) => {
            console.log('Server Websocket Error', err);
        });
    });
};
