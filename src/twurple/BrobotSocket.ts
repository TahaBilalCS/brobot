/* eslint-disable */
import { Instance } from 'express-ws';
import { IncomingEvents, OutgoingEvents } from './types/EventsInterface.js';
import process from 'process';
import { TwitchBot } from './TwitchBot.js';
import { ApiClient, HelixCreatePredictionData } from '@twurple/api';

// TODO Should make a class to match pluralization, Should setup reconnect logic
export const socketConnect = (TwitchBot: TwitchBot, wsInstance: Instance, apiClient: ApiClient): void => {
    console.log('Setup Server Websocket');
    wsInstance.app.ws('/ashketchum', (ws, req) => {
        const TWITCH_CHANNEL_LISTEN = process.env.TWITCH_CHANNEL_LISTEN || '';
        // On message from client
        ws.on('message', msg => {
            const clientMessage = String(msg);
            // console.log('Raw Message From Client:', clientMessage);
            switch (clientMessage) {
                case IncomingEvents.CREATE_MARKER:
                    console.log('Create Marker');
                    TwitchBot.getTwurpleChatClient().say(TWITCH_CHANNEL_LISTEN, '/marker WOW').then();
                    break;
                case IncomingEvents.CREATE_PREDICTION:
                    console.log('Create Prediction');
                    if (process.env.NODE_ENV === 'development') {
                        console.log('Cant use this in dev');
                        // apiClient.users.getUserById(562338142).then(res => {
                        //     console.log('user', res.displayName);
                        // });
                        // apiClient.predictions.createPrediction(562338142, helixPrediction).then();
                    } else {
                        // rama 699735970 todo add to env
                        const helixPrediction: HelixCreatePredictionData = {
                            autoLockAfter: 90,
                            outcomes: ['Yes', 'No'],
                            title: 'Will Trama Win This Game?'
                        };
                        // todo add scope to dev
                        apiClient.predictions.createPrediction(699735970, helixPrediction).then();
                    }
                    break;
                case IncomingEvents.PLAY_AD:
                    console.log('Play Ad');
                    TwitchBot.getTwurpleChatClient().runCommercial(TWITCH_CHANNEL_LISTEN, 30).then();
                    break;
                case IncomingEvents.VOICEBAN_COMPLETE:
                    TwitchBot.getVoiceBan()._resetUniqueVotedUsers();
                    TwitchBot.getTwurpleChatClient()
                        .say(
                            TWITCH_CHANNEL_LISTEN,
                            `${TWITCH_CHANNEL_LISTEN} is now unmuted. All votes have been reset.`
                        )
                        .then();
                    console.log('Reset Voice Ban', new Date().toLocaleString());
                    break;
                case IncomingEvents.CHATBAN_COMPLETE:
                    TwitchBot.getChatBan()._resetUniqueVotedUsers();
                    TwitchBot.getTwurpleChatClient()
                        .say(TWITCH_CHANNEL_LISTEN, `${TWITCH_CHANNEL_LISTEN} is now free. All votes have been reset.`)
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
