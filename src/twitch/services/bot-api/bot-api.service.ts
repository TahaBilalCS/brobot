import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
import { PokemonService } from 'src/twitch/services/pokemon/pokemon.service';
import { AdminUiGateway } from 'src/twitch/gateways/ui/admin-ui.gateway';
import { StreamerApiService } from 'src/twitch/services/streamer-api/streamer-api.service';
import { HelixBanUserRequest } from '@twurple/api/lib/api/helix/moderation/HelixModerationApi';
import { BotChatService } from 'src/twitch/services/bot-chat/bot-chat.service';

/**
 * EventSub subscriptions will continue to be active, even after the token used to create them has expired
 * (So don't use a Refreshing Auth Provider)
 * Event/Pubsub doesn't require Oauth, only for the user (b_robot?)
 */
// Event subs
@Injectable()
export class BotApiService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(BotApiService.name);
    public client: ApiClient;
    public devListener?: EventSubListener;
    public middleware?: EventSubMiddleware;
    private readonly streamerAuthId: string;

    constructor(
        private configService: ConfigService,
        private pokemonService: PokemonService,
        private adminUiGateway: AdminUiGateway,
        private botChatService: BotChatService
    ) {
        this.streamerAuthId = this.configService.get<string>('TWITCH_STREAMER_OAUTH_ID') || '';
        const clientId = this.configService.get('TWITCH_CLIENT_ID');
        const clientSecret = this.configService.get('TWITCH_CLIENT_SECRET');
        // Create app token for bot API
        const botApiAuth = new ClientCredentialsAuthProvider(clientId, clientSecret);
        this.client = new ApiClient({ authProvider: botApiAuth });
        if (this.configService.get('NODE_ENV') === 'production') {
            this.middleware = new EventSubMiddleware({
                apiClient: this.client,
                hostName: this.configService.get('DOMAIN') || '',
                pathPrefix: '/twitch',
                // Note: changing this secret/config requires us to delete all subscriptions
                secret: this.configService.get('EVENT_SUB_SECRET') || '',
                strictHostCheck: true
            });
        } else {
            this.devListener = new EventSubListener({
                apiClient: this.client,
                logger: { name: 'Dev', minLevel: LogLevel.ERROR },
                adapter: new NgrokAdapter(),
                secret: process.env.EVENT_SUB_SECRET ?? ''
                // strictHostCheck: true
            });
        }
    }

    public async init() {
        try {
            if (this.devListener) {
                await this.client.eventSub.deleteAllSubscriptions(); // Clean up subscriptions on dev
                await this.devListener.listen();
            }
        } catch (err) {
            this.logger.error('Error init event subs', err);
        }

        this.logger.log('Async Init Completed Event Subs');
        // TODO-Note: Do this in prod to delete subscriptions
        // await twurpleInstance.botApiClient.eventSub.deleteAllSubscriptions(); // Clean up subscriptions
    }

    public async applyMiddleware(app: any): Promise<any> {
        try {
            // Used in prod
            if (this.middleware) {
                this.logger.warn('Applying Middleware');
                await this.middleware.apply(app);
            }
        } catch (err) {
            this.logger.error('Error applying middleware for Event Subs', err);
        }
    }

    // TODO FINISH UP POKEMON EVENTS
    public async subscribeToEvents() {
        const streamerAuthId = this.configService.get('TWITCH_STREAMER_OAUTH_ID');
        // If in dev
        if (this.devListener) {
            this.logger.warn('Subscribing to dev event subs');
            // Subscribe to unban event
            await this.devListener.subscribeToChannelUnbanEvents(streamerAuthId, (event: EventSubChannelUnbanEvent) => {
                // void twurpleInstance.twitchBot?.pokemon.roarUserPokemon(username, event.userId);
                this.logger.warn(`${event.broadcasterDisplayName} just unbanned ${event.userDisplayName}!`);
            });
            // Subscribe to ban event
            await this.devListener.subscribeToChannelBanEvents(streamerAuthId, (event: EventSubChannelBanEvent) => {
                this.logger.warn(`${event.broadcasterDisplayName} just banned ${event.userDisplayName}!`);
            });

            // Test same as prod
            await this.devListener.subscribeToChannelRedemptionAddEvents(
                streamerAuthId,
                (event: EventSubChannelRedemptionAddEvent) => {
                    const username = event.userDisplayName.trim().toLowerCase();
                    this.logger.warn(`@${username} just redeemed ${event.rewardTitle}!`);
                }
            );
            await this.devListener.subscribeToChannelRaidEventsTo(streamerAuthId, (event: EventSubChannelRaidEvent) => {
                this.logger.warn(`${event.raidingBroadcasterName} raided ${event.raidedBroadcasterName}!`);
            });
        }
        // If in prod
        else if (this.middleware) {
            // todo NOW
            // this.middleware.onRevoke()
            // this.middleware.onVerify()
            await this.middleware.markAsReady();
            this.logger.warn('Subscribing to ChannelRedemptionAddEvents');
            // Subscribe to all channel point redemption events
            await this.middleware.subscribeToChannelRedemptionAddEvents(
                streamerAuthId,
                async (event: EventSubChannelRedemptionAddEvent) => {
                    // const username = event.userDisplayName.trim().toLowerCase();
                    console.info(`@${event.userDisplayName} just redeemed ${event.rewardTitle}!`);
                    // Handle redemptions tied to Pokemon
                    if (event.rewardTitle === 'Pokemon Roar') {
                        await this.pokemonService.redeemPokemonRoar(event);
                    } else if (event.rewardTitle === 'Pokemon Level Up') {
                        await this.pokemonService.redeemLevelUp(event);
                    } else if (event.rewardTitle === 'Pokemon Create') {
                        await this.pokemonService.redeemPokemonCreate(event);
                    } else if (event.rewardTitle === 'DEBS Alert') {
                        await this.adminUiGateway.sendDebsAlert(event);
                    } else if (event.rewardTitle === 'Timeout User') {
                        await this.botChatService.redeemTimeoutUser(event);
                    }
                }
            );
            // no auth needed
            // Subscribe to raid events
            const channelRaid = await this.middleware.subscribeToChannelRaidEventsTo(
                streamerAuthId,
                (event: EventSubChannelRaidEvent) => {
                    // Shout out the user who raided the stream
                    this.botChatService.clientSay(
                        `Check out the MAGNIFICENT ${event.raidingBroadcasterName} at twitch.tv/${event.raidingBroadcasterName}. So cool!`
                    );
                    console.info(`${event.raidingBroadcasterName} raided ${event.raidedBroadcasterName}!`);
                }
            );
        }
    }

    onModuleInit(): any {
        //
    }

    async onModuleDestroy(): Promise<void> {
        //
    }
}
