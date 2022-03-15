import { Express } from 'express';
import enableWs, { Instance, Options } from 'express-ws';
import { twurpleInstance } from '../twurple/TwurpleInstance.js';
import { appenv } from '../config/appenv.js';
import { IncomingEvents, OutgoingEvents } from '../twurple/types/EventsInterface.js';
import { HelixCreatePredictionData } from '@twurple/api';
import { getCurrentDateEST } from '../utils/TimeUtil.js';

/**
 * Express App Starter - Gives access to app ws connection
 */
class ExpressSocket {
    /** Non-null assertion on ws instance */
    private _wsInstance!: Instance;

    public get wsInstance(): Instance {
        return this._wsInstance;
    }

    /**
     * Start express websocket app (Not in class constructor to control execution flow)
     */
    public setupSocket(appBase: Express): void {
        const wsOptions: Options = {
            wsOptions: {
                // Authenticate client before establishing connection
                verifyClient: (info, done) => {
                    const token = info.req.headers.token;
                    if (!token) {
                        done(false, 401, 'Unauthorized');
                    } else {
                        if (token === appenv.WS_SECRET) {
                            done(true);
                        } else {
                            done(false, 401, 'Unauthorized');
                        }
                    }
                }
            }
        };
        this._wsInstance = enableWs(appBase, undefined, wsOptions);
    }

    /**
     * Get the number of clients listening on socket
     */
    public getListeningClientsOnSocket(): number {
        return this._wsInstance.getWss().clients.size;
    }

    public initSocket(): void {
        console.log('Init Server Websocket');
        // Init Consts
        const TWITCH_CHANNEL_LISTEN = appenv.TWITCH_CHANNEL_LISTEN;
        const authId = appenv.STREAMER_AUTH_ID;
        const streamerAuthId = parseInt(authId);
        const helixPrediction: HelixCreatePredictionData = {
            autoLockAfter: 90,
            outcomes: ['Yes', 'No'],
            title: 'Will Trama Win This Game?'
        };
        this._wsInstance.app.ws('/ashketchum', (ws /*, req*/) => {
            // On message from client
            ws.on('message', msg => {
                const clientMessage = String(msg); // Raw Message From Client
                switch (clientMessage) {
                    case IncomingEvents.CREATE_MARKER:
                        console.log('Create Marker');
                        // Can't use try catch since we can't await this promise
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
                        // Note: Running ads requires the streamer tokens for the chat client
                        twurpleInstance.botChatClient?.say(TWITCH_CHANNEL_LISTEN, '/commercial 30').catch(err => {
                            console.log('Error Creating Ad', err);
                        });
                        break;
                    case IncomingEvents.VOICEBAN_COMPLETE:
                        console.log('Reset Voice Ban', getCurrentDateEST());
                        twurpleInstance.twitchBot?.voiceBan.resetUniqueVotedUsers();
                        twurpleInstance.botChatClient?.say(
                            TWITCH_CHANNEL_LISTEN,
                            `${TWITCH_CHANNEL_LISTEN} is free from VoiceBan. All votes have been reset.`
                        );
                        break;
                    case IncomingEvents.CHATBAN_COMPLETE:
                        console.log('Reset Chat Ban', getCurrentDateEST());
                        twurpleInstance.twitchBot?.chatBan.resetUniqueVotedUsers();
                        twurpleInstance.botChatClient?.say(
                            TWITCH_CHANNEL_LISTEN,
                            `${TWITCH_CHANNEL_LISTEN} is free from ChatBan. All votes have been reset.`
                        );
                        break;
                    case IncomingEvents.TRAMA_CONNECTED:
                        console.log('Client Connection Received', getCurrentDateEST());
                        break;
                    case IncomingEvents.PING:
                        console.log('Trama PING!', getCurrentDateEST());
                        this._wsInstance.getWss().clients.forEach(localClient => {
                            console.log('Sending PONG!', getCurrentDateEST());
                            localClient.send(OutgoingEvents.PONG);
                        });
                        break;
                    case 'broke':
                        console.log('Chat/Voice Ban Broke', getCurrentDateEST());
                        twurpleInstance.botChatClient?.say(TWITCH_CHANNEL_LISTEN, `Uhoh something broke :(`);
                        break;
                    default:
                        console.log('BrobotSocket Received Unknown Message From Client', clientMessage);
                }
            });

            // When client closes connection
            ws.on('close', () => {
                twurpleInstance.twitchBot?.chatBan.resetUniqueVotedUsers();
                twurpleInstance.twitchBot?.voiceBan.resetUniqueVotedUsers();
                console.log('Cancelling All Ongoing Events, Client WebSocket Closed', getCurrentDateEST());
            });

            ws.on('error', (err: Error) => {
                console.log('Server Websocket Error', err);
            });
        });
    }
}

export const expressSocket: ExpressSocket = new ExpressSocket();
