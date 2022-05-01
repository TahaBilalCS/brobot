import { Express } from 'express';
import enableWs, { Instance, Options } from 'express-ws';
import { twurpleInstance } from '../twurple/TwurpleInstance.js';
import { appenv } from '../config/appenv.js';
import { IncomingEvents, OutgoingEvents } from '../twurple/types/EventsInterface.js';
import { HelixCreatePredictionData } from '@twurple/api';
import { logger } from '../utils/LoggerUtil.js';

/**
 * Express App Starter - Gives access to app ws connection
 */
class ExpressSocket {
    /** Non-null assertion on ws instance */
    private _wsInstance!: Instance;

    /** This modules websocket instance */
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

    /**
     * Create socket connection and handle incoming messages
     */
    public initSocket(): void {
        logger.warn('Init Server Websocket');
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
                        logger.info('Create Marker');
                        // Can't use try catch since we can't await this promise
                        twurpleInstance.streamerApiClient?.streams.createStreamMarker(streamerAuthId, '').catch(err => {
                            logger.error('Error Creating Marker');
                            logger.error(err);
                        });
                        break;
                    case IncomingEvents.CREATE_PREDICTION:
                        logger.info('Create Prediction');
                        twurpleInstance.streamerApiClient?.predictions
                            .createPrediction(streamerAuthId, helixPrediction)
                            .catch(err => {
                                logger.error('Error Creating Prediction');
                                logger.error(err);
                            });

                        break;
                    case IncomingEvents.PLAY_AD:
                        logger.info('Play Ad');
                        // Alternative: ChatClient().runCommercial
                        // Note: Running ads requires the streamer tokens for the chat client
                        twurpleInstance.botChatClient?.say(TWITCH_CHANNEL_LISTEN, '/commercial 30').catch(err => {
                            logger.error('Error Creating Ad');
                            logger.error(err);
                        });
                        break;
                    case IncomingEvents.VOICEBAN_COMPLETE:
                        logger.info('Reset Voice Ban');
                        twurpleInstance.twitchBot?.voiceBan.resetUniqueVotedUsers();
                        void twurpleInstance.botChatClient?.say(
                            TWITCH_CHANNEL_LISTEN,
                            `${TWITCH_CHANNEL_LISTEN} is now free. All VoiceBan votes have been reset.`
                        );
                        break;
                    case IncomingEvents.CHATBAN_COMPLETE:
                        logger.info('Reset Chat Ban');
                        twurpleInstance.twitchBot?.chatBan.resetUniqueVotedUsers();
                        void twurpleInstance.botChatClient?.say(
                            TWITCH_CHANNEL_LISTEN,
                            `${TWITCH_CHANNEL_LISTEN} is now free. All ChatBan votes have been reset.`
                        );
                        break;
                    case IncomingEvents.TRAMA_CONNECTED:
                        logger.warn('Client Connection Received');
                        logger.warn(`Clients On Socket: ${this.getListeningClientsOnSocket()}`);
                        break;
                    case IncomingEvents.PING:
                        logger.warn('Trama PING!');
                        // Respond with PONG when pinged
                        this._wsInstance.getWss().clients.forEach(localClient => {
                            logger.warn('Sending PONG!');
                            localClient.send(OutgoingEvents.PONG);
                        });
                        break;
                    case 'broke':
                        logger.info('Chat/Voice Ban Broke');
                        void twurpleInstance.botChatClient?.say(TWITCH_CHANNEL_LISTEN, `Uhoh something broke :(`);
                        break;
                    default:
                        logger.info('BrobotSocket Received Unknown Message From Client', clientMessage);
                }
            });

            // When client closes connection
            ws.on('close', () => {
                twurpleInstance.twitchBot?.chatBan.resetUniqueVotedUsers();
                twurpleInstance.twitchBot?.voiceBan.resetUniqueVotedUsers();
                logger.warn('Cancelling All Ongoing Events, Client WebSocket Closed');
                logger.warn(`Clients On Socket: ${this.getListeningClientsOnSocket()}`);
            });

            ws.on('error', (err: Error) => {
                logger.error('Server Websocket Error');
                logger.error(err);
            });
        });
    }
}

export const expressSocket: ExpressSocket = new ExpressSocket();
