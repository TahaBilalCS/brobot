import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiClient } from '@twurple/api';
import { ClientCredentialsAuthProvider } from '@twurple/auth';
import {
    EventSubChannelBanEvent,
    EventSubChannelRaidEvent,
    EventSubChannelRedemptionAddEvent,
    EventSubChannelUnbanEvent,
    EventSubListener,
    EventSubMiddleware
} from '@twurple/eventsub';
import { LogLevel } from '@d-fischer/logger';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';

// Event subs
@Injectable()
export class TwitchBotApiClientService implements OnModuleInit {
    private readonly logger = new Logger(TwitchBotApiClientService.name);
    public botApiClient: ApiClient;
    public devListener?: EventSubListener;
    public middleware?: EventSubMiddleware;

    constructor(private configService: ConfigService) {
        console.log('Twitch Bot API Client Service Constructor');
        const clientId = this.configService.get('TWITCH_CLIENT_ID');
        const clientSecret = this.configService.get('TWITCH_CLIENT_SECRET');
        // Create app token for bot API
        const botApiAuth = new ClientCredentialsAuthProvider(clientId, clientSecret);
        this.botApiClient = new ApiClient({ authProvider: botApiAuth });
        if (this.configService.get('NODE_ENV') === 'production') {
            this.middleware = new EventSubMiddleware({
                apiClient: this.botApiClient,
                hostName: this.configService.get('DOMAIN') || '',
                pathPrefix: '/twitch',
                secret: this.configService.get('EVENT_SUB_SECRET') || '' // Note: changing this secret/config requires us to delete all subscriptions
            });
        } else {
            this.devListener = new EventSubListener({
                apiClient: this.botApiClient,
                logger: { name: 'Dev', minLevel: LogLevel.ERROR },
                adapter: new NgrokAdapter(),
                secret: process.env.EVENT_SUB_SECRET ?? ''
            });
        }
    }

    public async init() {
        console.log('Async Init Bot Api Event Subs');
        if (this.devListener) {
            await this.botApiClient.eventSub.deleteAllSubscriptions(); // Clean up subscriptions
            await this.devListener.listen();
        }

        // Note: Do this in prod to delete subscriptions
        // await twurpleInstance.botApiClient.eventSub.deleteAllSubscriptions(); // Clean up subscriptions

        console.log('Async Init Completed');
    }

    public async applyMiddleware(app: any): Promise<any> {
        if (this.middleware) {
            console.log('Applying Middleware');
            await this.middleware.apply(app);
        }
    }

    // TODO FINISH UP POKEMON EVENTS
    public async subscribeToEvents() {
        const streamerAuthId = this.configService.get('TWITCH_STREAMER_OAUTH_ID');
        if (this.devListener) {
            // Subscribe to unban event
            await this.devListener.subscribeToChannelUnbanEvents(streamerAuthId, (event: EventSubChannelUnbanEvent) => {
                const username = event.userDisplayName.trim().toLowerCase();
                // void twurpleInstance.twitchBot?.pokemon.roarUserPokemon(username, event.userId);
                console.log(`${event.broadcasterDisplayName} just unbanned ${event.userDisplayName}!`);
            });
            // Subscribe to ban event
            await this.devListener.subscribeToChannelBanEvents(streamerAuthId, (event: EventSubChannelBanEvent) => {
                console.log(`${event.broadcasterDisplayName} just banned ${event.userDisplayName}!`);
            });
        } else if (this.middleware) {
            await this.middleware.markAsReady();
            // Subscribe to all channel point redemption events
            await this.middleware.subscribeToChannelRedemptionAddEvents(
                streamerAuthId,
                (event: EventSubChannelRedemptionAddEvent) => {
                    const username = event.userDisplayName.trim().toLowerCase();
                    console.info(`@${username} just redeemed ${event.rewardTitle}!`);

                    // Handle redemptions tied to Pokemon
                    // if (event.rewardTitle === 'Pokemon Roar') {
                    //     void twurpleInstance.twitchBot?.pokemon.roarUserPokemon(username, event.userId);
                    // } else if (event.rewardTitle === 'Pokemon Level Up') {
                    //     void twurpleInstance.twitchBot?.pokemon.levelUpUserPokemon(username, event.userId);
                    // } else if (event.rewardTitle === 'Pokemon Create') {
                    //     void twurpleInstance.twitchBot?.pokemon.createOrReplacePokemon(username, event.userId);
                    // }
                }
            );
            // Subscribe to raid events
            await this.middleware.subscribeToChannelRaidEventsTo(streamerAuthId, (event: EventSubChannelRaidEvent) => {
                // Shout out the user who raided the stream
                // void twurpleInstance?.botChatClient.say(
                //     appenv.TWITCH_CHANNEL_LISTEN,
                //     `Check out the MAGNIFICENT ${event.raidingBroadcasterName} at twitch.tv/${event.raidingBroadcasterName}. So cool!`
                // );
                console.info(`${event.raidingBroadcasterName} raided ${event.raidedBroadcasterName}!`);
            });
        }
    }

    onModuleInit(): any {
        console.log('MODULE INIT TCS TEST');
    }
}
