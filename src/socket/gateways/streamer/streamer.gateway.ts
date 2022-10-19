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
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
export class StreamerGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    private readonly logger = new Logger(StreamerGateway.name);
    private totalCreatedConnections = 0;
    private pingInterval?: NodeJS.Timer;

    @WebSocketServer()
    public server: any;

    constructor(private configService: ConfigService) {}

    public get getCurrentClientsOnSocket(): number {
        return this.server.clients.size;
    }

    handleConnection(client: any, ...args: any[]): any {
        const req = args[0];
        client.on('pong', () => {
            client.isAlive = true;
        });

        client.on('close', () => {
            this.logger.warn('CLOSED / HANDLE DISCONNECT');
        });
        // // Init Consts (TODO DOESNT GO HERE)
        // const TWITCH_CHANNEL_LISTEN = appenv.TWITCH_CHANNEL_LISTEN;
        // const authId = appenv.STREAMER_AUTH_ID;
        // const streamerAuthId = parseInt(authId);
        // const helixPrediction: HelixCreatePredictionData = {
        //     autoLockAfter: 90,
        //     outcomes: ['Yes', 'No'],
        //     title: 'Will Trama Win This Game?'
        // };

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
        this.logger.log('Client Disconnected');
        // twurpleInstance.twitchBot?.chatBan.resetUniqueVotedUsers();
        // twurpleInstance.twitchBot?.voiceBan.resetUniqueVotedUsers();
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

    @SubscribeMessage('message')
    handleEvent(client: any, data: any): WsResponse<any> {
        console.log('New message', data);
        // console.log('Client', client);
        return { event: 'message', data: 'Hello world!' };
    }
}
