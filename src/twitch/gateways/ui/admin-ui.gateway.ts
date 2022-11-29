import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsResponse
} from '@nestjs/websockets';
import { forwardRef, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventSubChannelRedemptionAddEvent } from '@twurple/eventsub';
import { IncomingEvents, OutgoingEvents } from 'src/twitch/gateways/streamer/IEvents';
import { BotChatService } from 'src/twitch/services/bot-chat/bot-chat.service';
export interface PokemonRoarChatEvent {
    username: string;
    oauthId: string;
}

export interface DebsAlertEvent {
    name: string;
    msg: string;
}

@WebSocketGateway({
    path: '/api/admin-ui',
    verifyClient: (info: any, done: any) => {
        const headers = info.req.headers;
        console.log('UI Socket Headers Connection', headers);
        console.log('UI Socket Headers Connection', headers.origin);
        console.log('UI Socket Headers Connection', headers['user-agent']);
        return done(true);
        // if (!token) return done(false, 401, 'Unauthorized');
        // if (token === process.env.WS_SECRET) return done(true);
        // return done(false, 401, 'Unauthorized');
    },
    cors: {
        origin: process.env.NODE_ENV === 'production' ? 'https://admin.brobot.live' : 'http://localhost:4200'
    }
})
export class AdminUiGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy {
    private readonly logger = new Logger(AdminUiGateway.name);
    private totalCreatedConnections = 0;
    private pingInterval?: NodeJS.Timer;

    @WebSocketServer()
    public server: any;

    constructor(
        @Inject(forwardRef(() => BotChatService))
        private botChatService: BotChatService
    ) {
        this.logger.log('AdminUiGateway Constructor');
    }

    public get getCurrentClientsOnSocket(): number {
        if (!this.server) {
            this.logger.error('Socket Server is null');
            return 0;
        }
        return this.server.clients.size;
    }

    afterInit(server: any): any {
        this.logger.log('UI Socket Initialized');
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
                console.log('Pinging UI Client', client.id);
                if (!client.isAlive) {
                    this.logger.warn(`UI CLIENT SOCKET NOT ALIVE, TERMINATE`);
                    client.terminate();
                }
                client.isAlive = false;
                client.ping();
            });
        }, 5000);
    }

    handleConnection(client: any, ...args: any[]): any {
        const req = args[0];
        client.on('pong', () => {
            console.log('Received Pong From UI');
            client.isAlive = true;
        });

        client.on('close', () => {
            this.logger.warn('CLOSED / HANDLE DISCONNECT');
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
        this.logger.log('UI Client Disconnected');
        // twurpleInstance.twitchBot?.chatBan.resetUniqueVotedUsers();
        // twurpleInstance.twitchBot?.voiceBan.resetUniqueVotedUsers();
        const id = client.id ? client.id : '';
        this.logger.warn(`Client WebSocket Closed: ${id}`);
        this.logger.warn(`Clients On UI WSS: ${this.getCurrentClientsOnSocket}`);
    }

    async onModuleDestroy(): Promise<void> {
        console.log('AdminUIGateway MODULE DESTROY');
        this.server.clients.forEach((client: any) => {
            console.log('Terminating UI Clients', client?.id);
            client.terminate();
        });
    }

    map: any = {};
    public async sendDebsAlert(event: EventSubChannelRedemptionAddEvent | DebsAlertEvent) {
        console.log('DEBS Alert', event);
        let msg = '',
            name = '';
        if (event instanceof EventSubChannelRedemptionAddEvent) {
            msg = event.input;
            name = event.userDisplayName.trim().toLowerCase();
        } else {
            name = event.name.trim().toLowerCase();
            msg = event.msg;
        }
        if (this.getCurrentClientsOnSocket <= 0) {
            this.logger.warn('Streamer Not Connected While Debs Alert');
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
            await this.botChatService.clientSay('Streamer not connected to browser source. You will be refunded');
            return;
        }
        this.server.clients.forEach((client: any) => {
            console.log('DEBS Client', client?.id);
            const wsEvent = JSON.stringify({ event: `${OutgoingEvents.DEBS_ALERT}`, data: { msg, name } });
            this.map[name] = event;
            client.send(wsEvent);
        });
    }

    public async quack() {
        this.server.clients.forEach((client: any) => {
            const wsEvent = JSON.stringify({ event: `${OutgoingEvents.QUACK}`, data: null });
            client.send(wsEvent);
        });
    }
    public async pokemonRoar(
        pokemon: any,
        event: EventSubChannelRedemptionAddEvent | PokemonRoarChatEvent
    ): Promise<void> {
        console.log('Pokemon Roar Socket', pokemon, event);

        const pokemonData = {
            name: pokemon.name,
            color: pokemon.color,
            nameId: pokemon.nameId,
            shiny: pokemon.shiny,
            level: pokemon.level,
            gender: pokemon.gender,
            dexNum: pokemon.dexNum
        };
        if (this.getCurrentClientsOnSocket <= 0) {
            this.logger.warn('Streamer Not Connected While Roaring');
            if (event instanceof EventSubChannelRedemptionAddEvent) await event.updateStatus('CANCELED');
            await this.botChatService.clientSay('Streamer not connected to browser source. You will be refunded');
            return;
        }
        this.server.clients.forEach((client: any) => {
            console.log('Pokemon Roar Client', client?.id);
            const wsEvent = JSON.stringify({ event: `${OutgoingEvents.POKEMON_ROAR}`, data: pokemonData });
            client.send(wsEvent);
        });
    }

    @SubscribeMessage('message')
    handleMessage(client: any, data: any): WsResponse<any> {
        console.log('New Message UI', data);
        return { event: 'message', data: 'Hello world!' };
    }

    // @SubscribeMessage(IncomingEvents.POKEMON_ROAR_COMPLETE)
    // handlePokemonRoar(client: any, data: any): void {
    //     this.logger.log('Pokemon Roar Complete');
    //     if (data) this.botChatService.clientSay(`Uhoh, something broke :(`);
    // }

    @SubscribeMessage(IncomingEvents.DEBS_ALERT_COMPLETE)
    async handleDebsAlert(client: any, data: string): Promise<void> {
        if (this.map[data]) {
            await this.botChatService.clientSay(
                `Max Message Limit Reached. Please way before trying again. ${data}, you will be refunded`
            );
            await this.map[data].updateStatus('CANCELED');
            this.map[data] = undefined;
        }
    }
}
