import { Express } from 'express';
import enableWs, { Instance } from 'express-ws';
import { twurpleInstance } from '../twurple/TwurpleInstance.js';
import { appenv } from '../config/appenv.js';
import { IncomingEvents, OutgoingEvents } from '../twurple/types/EventsInterface.js';
import { HelixCreatePredictionData } from '@twurple/api';

/**
 * Express App Starter - Gives access to app ws connection
 */
class ExpressSocket {
    /** Non-null assertion on ws instance */
    private _wsInstance!: Instance;

    get wsInstance(): Instance {
        return this._wsInstance;
    }

    /**
     * Start express websocket app (Not in class constructor to control execution flow)
     */
    public setupSocket(appBase: Express): void {
        this._wsInstance = enableWs(appBase);
    }

    public initSocket(): void {
        console.log('Setup Server Websocket');
        // Init Consts
        const TWITCH_CHANNEL_LISTEN = appenv.TWITCH_CHANNEL_LISTEN;
        const authId = appenv.STREAMER_AUTH_ID;
        const streamerAuthId = parseInt(authId);
        const helixPrediction: HelixCreatePredictionData = {
            autoLockAfter: 90,
            outcomes: ['Yes', 'No'],
            title: 'Will Trama Win This Game?'
        };
        this._wsInstance.app.ws('/ashketchum', (ws, req) => {
            // On message from client
            ws.on('message', msg => {
                const clientMessage = String(msg); // Raw Message From Client
                switch (clientMessage) {
                    case IncomingEvents.CREATE_MARKER:
                        console.log('Create Marker');
                        twurpleInstance.streamerApiClient?.streams.createStreamMarker(streamerAuthId, '').catch(err => {
                            console.log('Error Creating Marker', err);
                        });
                        break;
                    case IncomingEvents.CREATE_PREDICTION:
                        console.log('Create Prediction');
                        twurpleInstance.streamerApiClient?.predictions
                            .createPrediction(streamerAuthId, helixPrediction)
                            .catch(err => {
                                console.log('Error Creating Prediction', err);
                            });

                        break;
                    case IncomingEvents.PLAY_AD:
                        console.log('Play Ad');
                        // Alternative: ChatClient().runCommercial
                        twurpleInstance.botChatClient?.say(TWITCH_CHANNEL_LISTEN, '/commercial 30').catch(err => {
                            console.log('Error Creating Ad', err);
                        });
                        break;
                    case IncomingEvents.VOICEBAN_COMPLETE:
                        console.log('Reset Voice Ban', new Date().toLocaleString());
                        twurpleInstance.twitchBot?.getVoiceBan().resetUniqueVotedUsers();
                        //TODO-BT check what happens if these error out inner callback
                        twurpleInstance.botChatClient?.say(
                            TWITCH_CHANNEL_LISTEN,
                            `${TWITCH_CHANNEL_LISTEN} is now unmuted. All votes have been reset.`
                        );
                        break;
                    case IncomingEvents.CHATBAN_COMPLETE:
                        console.log('Reset Chat Ban', new Date().toLocaleString());
                        twurpleInstance.twitchBot?.getChatBan().resetUniqueVotedUsers();
                        twurpleInstance.botChatClient?.say(
                            TWITCH_CHANNEL_LISTEN,
                            `${TWITCH_CHANNEL_LISTEN} is now free. All votes have been reset.`
                        );
                        break;
                    case IncomingEvents.TRAMA_CONNECTED:
                        console.log('Client Connection Received', new Date().toLocaleString());
                        break;
                    case IncomingEvents.PING:
                        console.log('Trama PING!', new Date().toLocaleString());
                        this._wsInstance.getWss().clients.forEach(localClient => {
                            console.log('Sending PONG!', new Date().toLocaleString());
                            localClient.send(OutgoingEvents.PONG);
                        });
                        break;
                    case 'broke':
                        console.log('Chat/Voice Ban Broke', new Date().toLocaleString());
                        twurpleInstance.botChatClient?.say(TWITCH_CHANNEL_LISTEN, `Uhoh something broke :(`);
                        break;
                    default:
                        console.log('BrobotSocket Received Unknown Message From Client', clientMessage);
                }
            });

            // When client closes connection
            ws.on('close', () => {
                // Remove underscore on these - TODO reset all commands on twitch instance
                twurpleInstance.twitchBot?.getChatBan().resetUniqueVotedUsers();
                twurpleInstance.twitchBot?.getVoiceBan().resetUniqueVotedUsers();
                console.log('Cancelling All Ongoing Events, Client WebSocket Closed', new Date().toLocaleString());
            });

            ws.on('error', (err: Error) => {
                console.log('Server Websocket Error', err);
            });
        });
    }
}

export const expressSocket: ExpressSocket = new ExpressSocket();
