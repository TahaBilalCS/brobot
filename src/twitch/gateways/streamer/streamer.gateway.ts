import {
    BaseWsInstance,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsResponse
} from '@nestjs/websockets';
import { forwardRef, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VoteService } from 'src/twitch/services/vote/vote.service';
import { IncomingEvents } from 'src/twitch/gateways/streamer/IEvents';
import { BotChatService } from 'src/twitch/services/bot-chat/bot-chat.service';
import { StreamerApiService } from 'src/twitch/services/streamer-api/streamer-api.service';
import { HelixCreatePredictionData } from '@twurple/api';
import { PokemonService } from 'src/twitch/services/pokemon/pokemon.service';

interface ExtendedSocket {
    isAlive?: boolean;
    id?: string;
}
@WebSocketGateway({
    path: '/api/ashketchum',
    verifyClient: (info: any, done: any) => {
        const token = info.req.headers.token;
        if (!token) return done(false, 401, 'Unauthorized');
        if (token === process.env.WS_SECRET) return done(true);
        return done(false, 401, 'Unauthorized');
    },
    cors: {
        origin: '*'
    }
})
export class StreamerGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy {
    private readonly logger = new Logger(StreamerGateway.name);
    private totalCreatedConnections = 0;
    private pingInterval?: NodeJS.Timer;

    // Helix
    private TWITCH_STREAMER_CHANNEL_LISTEN: string;
    private authId: string;
    private streamerAuthId: number;
    private helixPrediction: HelixCreatePredictionData;
    //
    @WebSocketServer()
    public server: any;

    constructor(
        private configService: ConfigService,
        @Inject(forwardRef(() => 'ChatBanVote'))
        private readonly chatBanVote: VoteService,
        @Inject(forwardRef(() => 'VoiceBanVote'))
        private readonly voiceBanVote: VoteService,
        @Inject(forwardRef(() => BotChatService))
        private botChatService: BotChatService,
        @Inject(forwardRef(() => StreamerApiService))
        private streamerApiService: StreamerApiService
    ) {
        this.TWITCH_STREAMER_CHANNEL_LISTEN = this.configService.get<string>('TWITCH_STREAMER_CHANNEL_LISTEN') || '';
        this.authId = this.configService.get('TWITCH_STREAMER_OAUTH_ID') || '';
        this.streamerAuthId = parseInt(this.authId);
        this.helixPrediction = {
            autoLockAfter: 90,
            outcomes: ['Yes', 'No'],
            title: 'Will Trama Win This Game?'
        };
    }

    public get getCurrentClientsOnSocket(): number {
        if (!this.server) {
            this.logger.error('Socket Server is null');
            return 0;
        }
        return this.server.clients.size;
    }

    handleConnection(client: any, ...args: any[]): any {
        const req = args[0];
        client.on('pong', () => {
            client.isAlive = true;
        });

        client.on('close', () => {
            this.logger.warn('Streamer Closed Socket Connection');
        });

        this.totalCreatedConnections++;
        client.isAlive = true;
        client.id = `${this.totalCreatedConnections} - ${JSON.stringify(req.socket.address())}`;

        this.logger.warn(`Client Connection Received: ${client.id}`);
        this.logger.warn(`Clients On WSS: ${this.getCurrentClientsOnSocket}`);

        // When server runs behind a proxy like NGINX, de-facto standard is to use the X-Forwarded-For Header to get IP
        if (req.headers['x-forwarded-for']) {
            try {
                const ipString = req.headers['x-forwarded-for'] as string;
                const ip = ipString.split(',')[0].trim();
                this.logger.warn(`Client Connection via Proxy: ${ip}`);
            } catch (err) {
                this.logger.error('Error retrieving Client Proxy IP', err);
            }
        }
    }

    handleDisconnect(client: any): any {
        this.chatBanVote.resetUniqueVotedUsers();
        this.voiceBanVote.resetUniqueVotedUsers();
        const id = client.id ? client.id : '';
        this.logger.warn(`Client WebSocket Closed: ${id}`);
        this.logger.warn(`Clients On WSS: ${this.getCurrentClientsOnSocket}`);
    }

    afterInit(server: any): any {
        this.logger.log('Socket Initialized');
        server.on('error', (err: any) => {
            this.logger.error('Server WS Error', err);
        });
        server.on('close', () => {
            this.logger.warn('WS Server Closed', this.totalCreatedConnections);
            this.totalCreatedConnections = 0;
            if (this.pingInterval) clearInterval(this.pingInterval);
        });

        this.pingInterval = setInterval(() => {
            server.clients.forEach((client: any) => {
                if (!client.isAlive) {
                    this.logger.warn(`CLIENT SOCKET NOT ALIVE, TERMINATE`);
                    client.terminate();
                }
                client.isAlive = false;
                client.ping();
            });
        }, 5000);
    }

    @SubscribeMessage(IncomingEvents.CHATBAN_COMPLETE)
    handleChatBan(client: any, data: any): void {
        this.logger.log('Reset ChatBan', data);
        if (data) this.botChatService.clientSay(`Uhoh, something broke :(`);
        this.botChatService.clientSay(
            `${this.TWITCH_STREAMER_CHANNEL_LISTEN} is now free. All ChatBan votes have been reset.`
        );
        this.chatBanVote.resetUniqueVotedUsers();
    }

    @SubscribeMessage(IncomingEvents.VOICEBAN_COMPLETE)
    handleVoiceBan(client: any, data: any): void {
        this.logger.log('Reset VoiceBan', data);
        if (data) this.botChatService.clientSay(`Uhoh, something broke :(`);
        this.botChatService.clientSay(
            `${this.TWITCH_STREAMER_CHANNEL_LISTEN} is now free. All VoiceBan votes have been reset.`
        );
        this.voiceBanVote.resetUniqueVotedUsers();
    }

    @SubscribeMessage(IncomingEvents.CREATE_MARKER)
    handleCreateMarker(client: any, data: any): void {
        this.logger.log('Create Marker', data);
        this.logger.log('Create Marker', this.streamerApiService.client);
        this.streamerApiService.client?.streams.createStreamMarker(this.streamerAuthId, '').catch(err => {
            this.logger.error('Error creating marker', err);
        });
    }

    @SubscribeMessage(IncomingEvents.CREATE_PREDICTION)
    handleCreatePrediction(client: any, data: any): void {
        this.logger.log('Create Prediction', this.streamerApiService.client);
        this.streamerApiService.client?.predictions
            .createPrediction(this.streamerAuthId, this.helixPrediction)
            .catch(err => {
                this.logger.error('Error creating prediction', err);
            });
    }

    @SubscribeMessage(IncomingEvents.PLAY_AD)
    handlePlayAd(client: any, data: any): void {
        this.logger.log('Play Ad', this.botChatService);
        // Need bot to be editor on streamers channel to run commercial through chat
        // this.botChatService.clientSay('/commercial 30').catch(err => {
        //     this.logger.error('Error playing ad', err);
        // })
        this.botChatService.client?.runCommercial(this.TWITCH_STREAMER_CHANNEL_LISTEN, 30).catch(err => {
            this.logger.error('Error playing ad', err);
        });
    }

    async onModuleDestroy(): Promise<void> {
        this.server.clients.forEach((client: any) => {
            this.logger.log('Terminating Streamer Client', client?.id);
            client.terminate();
        });
    }
}
