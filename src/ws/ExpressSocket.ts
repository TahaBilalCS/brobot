import { Express } from 'express';
import enableWs, { Instance, Options } from 'express-ws';
import { twurpleInstance } from '../twurple/TwurpleInstance.js';
import { appenv } from '../config/appenv.js';
import { IncomingEvents } from '../twurple/types/EventsInterface.js';
import { HelixCreatePredictionData } from '@twurple/api';
import { logger } from '../utils/LoggerUtil.js';
import WebSocket from 'ws';

interface ExtWebsocket extends WebSocket.WebSocket {
    isAlive?: boolean;
    id?: string;
}

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

    /** Client connection count */
    private countClientConnected = 0;

    /** The interval responsible for pinging client connections */
    private pingInterval?: NodeJS.Timer;

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

        this.pingInterval = setInterval(() => {
            this._wsInstance.getWss().clients.forEach((clientWs: ExtWebsocket) => {
                if (!clientWs.isAlive) {
                    logger.warn(`CLIENT SOCKET NOT ALIVE, TERMINATE`);
                    clientWs.terminate();
                }
                clientWs.isAlive = false;
                clientWs.ping();
            });
        }, 5000);

        /** This really shouldn't happen */
        this._wsInstance.getWss().on('close', () => {
            logger.error('Server Socket Closed');
            this.countClientConnected = 0;
            if (this.pingInterval) clearInterval(this.pingInterval);
        });

        /** When client connects to this route, setup the client-server events */
        this._wsInstance.app.ws('/ashketchum', (ws: ExtWebsocket, req) => {
            // Execute and append the following listeners when client connects
            this.countClientConnected++;
            ws.isAlive = true;
            ws.id = `${this.countClientConnected} - ${JSON.stringify(req.socket.address())}`;
            logger.warn(`Client Connection Received: ${ws.id}`);
            logger.warn(`Clients On WSS: ${this.getListeningClientsOnSocket()}`);
            // When server runs behind a proxy like NGINX, de-facto standard is to use the X-Forwarded-For Header to get IP
            if (req.headers['x-forwarded-for']) {
                try {
                    const ipString = req.headers['x-forwarded-for'] as string;
                    const ip = ipString.split(',')[0].trim();
                    logger.warn(`Client Connection via Proxy: ${ip}`);
                } catch (err) {
                    logger.error('Error retrieving Client Proxy IP', err);
                }
            }

            // On pong from client
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            // When client closes connection
            ws.on('close', () => {
                twurpleInstance.twitchBot?.chatBan.resetUniqueVotedUsers();
                twurpleInstance.twitchBot?.voiceBan.resetUniqueVotedUsers();
                const id = ws.id ? ws.id : '';
                logger.warn(`Client WebSocket Closed: ${id}`);
                logger.warn(`Clients On WSS: ${this.getListeningClientsOnSocket()}`);
                // Don't clear interval on individual closed sockets
            });

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
                    case 'broke':
                        logger.info('Chat/Voice Ban Broke');
                        void twurpleInstance.botChatClient?.say(TWITCH_CHANNEL_LISTEN, `Uhoh something broke :(`);
                        break;
                    default:
                        logger.info('BrobotSocket Received Unknown Message From Client', clientMessage);
                }
            });

            // On error from client
            ws.on('error', (err: Error) => {
                logger.error('Client Websocket Error?');
                logger.error(err);
            });
        });
    }
}

export const expressSocket: ExpressSocket = new ExpressSocket();
