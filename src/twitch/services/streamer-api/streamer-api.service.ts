import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ApiClient } from '@twurple/api';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RefreshingAuthProvider } from '@twurple/auth';
import { TwitchStreamerAuthService } from 'src/database/services/twitch-streamer-auth/twitch-streamer-auth.service';
import { TwitchUserWithRegisteredStreamer } from 'src/database/services/twitch-user/twitch-user.service';
import { HelixCustomReward } from '@twurple/api/lib/api/helix/channelPoints/HelixCustomReward';

/**
 * Stream marker & predictions
 */
@Injectable()
export class StreamerApiService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(StreamerApiService.name);

    private streamerOauthId: string;

    public client?: ApiClient;
    private channelPointRewards: HelixCustomReward[] = [];

    constructor(private configService: ConfigService, private twitchStreamerAuthService: TwitchStreamerAuthService) {
        this.streamerOauthId = this.configService.get('TWITCH_STREAMER_OAUTH_ID') ?? '';
    }

    onModuleInit(): any {
        //
    }

    async onModuleDestroy(): Promise<void> {
        // use a for loop to loop through all pokemon rewards+
        try {
            await this.updateCustomRewards(true);
        } catch (err) {}
    }

    /**
     * When server goes down, remove channel point redeems from Stream to prevent users from wasting points
     * @param isPaused
     */
    public async updateCustomRewards(isPaused: boolean) {
        let errored = false;
        if (this.channelPointRewards.length === 0) {
            this.logger.error('No Channel Point Rewards to update');
            throw new Error('No Channel Point Rewards to update');
        }
        for (let i = 0; i < this.channelPointRewards.length; i++) {
            const reward = this.channelPointRewards[i];
            this.logger.warn(`${isPaused ? 'Pausing' : 'Resuming'} ${reward.title}`);
            try {
                await this.client?.channelPoints.updateCustomReward(this.streamerOauthId, reward.id, { isPaused });
            } catch (err) {
                this.logger.error(`Error updating reward: ${reward.title}`, err);
                errored = true;
            }
        }
        if (errored) {
            throw new Error('Some channel redemption failed');
        }
    }

    public async createChannelPointRedeems() {
        if (this.channelPointRewards.length !== 0) {
            this.logger.error('Cannot create channel point rewards, rewards already exist');
            throw new Error('Cannot create channel point rewards, rewards already exist');
        }

        let pokemonRoar, pokemonLevelUp, pokemonCreate, debsAlert, timeoutUser, enableQuack;
        try {
            pokemonRoar = await this.client?.channelPoints.createCustomReward(this.streamerOauthId, {
                title: 'Pokemon Roar',
                cost: 500,
                prompt: 'Your starter pokemon (slot 1) will appear on stream and let out a mighty roar, hopefully startling Rama',
                isEnabled: true,
                backgroundColor: '#007b94'
            });

            pokemonLevelUp = await this.client?.channelPoints.createCustomReward(this.streamerOauthId, {
                title: 'Pokemon Level Up',
                cost: 1250,
                prompt: 'Level up your pokemon in slot 1. Failed level ups will be automatically refunded. NO REFUNDS FOR SUCCESSFUL LEVEL UPS',
                isEnabled: true,
                backgroundColor: '#911b00'
            });

            pokemonCreate = await this.client?.channelPoints.createCustomReward(this.streamerOauthId, {
                title: 'Pokemon Create',
                cost: 10,
                prompt: 'Choose a slot number between 1-6 to create a Pokemon on your team. THIS WILL REPLACE A POKEMON ALREADY IN THAT SLOT. Failed creations will be automatically refunded',
                isEnabled: true,
                backgroundColor: '#379c02',
                userInputRequired: true
            });

            debsAlert = await this.client?.channelPoints.createCustomReward(this.streamerOauthId, {
                title: 'DEBS Alert',
                cost: 2500,
                prompt: 'A message of your choosing will appear on stream like a news alert',
                isEnabled: true,
                backgroundColor: '#e87800',
                userInputRequired: true
            });

            timeoutUser = await this.client?.channelPoints.createCustomReward(this.streamerOauthId, {
                title: 'Timeout User',
                cost: 5000,
                prompt: 'Timeout any user for 3 minutes (including Mods) by typing their username. Capitalization and spacing does not matter',
                isEnabled: true,
                backgroundColor: '#0e0801',
                userInputRequired: true
            });

            enableQuack = await this.client?.channelPoints.createCustomReward(this.streamerOauthId, {
                title: 'Enable Quacks',
                cost: 5000,
                prompt: 'Enables the command: "!quack" for everyone to spam. This is difficult to disable...',
                isEnabled: true,
                backgroundColor: '#e5d406'
            });
        } catch (err) {
            this.logger.error('Error Creating Rewards', err);
            throw new Error('Error Creating Rewards');
        }

        if (!pokemonRoar || !pokemonLevelUp || !pokemonCreate || !debsAlert || !timeoutUser || !enableQuack) {
            this.logger.error('Error creating channel point rewards');
            throw new Error('Error creating channel point rewards');
        }
        // Create the rewards
        this.channelPointRewards.push(pokemonRoar, pokemonLevelUp, pokemonCreate, debsAlert, timeoutUser, enableQuack);
    }

    private async getChannelPointRewards(): Promise<void> {
        const onlyManageable = true;
        try {
            const channelPointRewards = await this.client?.channelPoints.getCustomRewards(
                this.streamerOauthId,
                onlyManageable
            );
            if (!channelPointRewards) {
                this.logger.error('No Channel Point Rewards Retrieved');
                return;
            }
            this.channelPointRewards = channelPointRewards;
            this.channelPointRewards.forEach(reward => {
                console.log('Deleting');
                this.client?.channelPoints.deleteCustomReward(this.streamerOauthId, reward.id);
            });
            this.logger.log('Retrieved Channel Point Rewards', this.channelPointRewards.length);
        } catch (err) {
            // This will typically error out if streamer did not authorize scopes or is not affiliate
            this.logger.error('Error Getting Channel Point Rewards', err);
        }
    }

    async init() {
        this.logger.warn('StreamerApiService Init Async');
        const twitchStreamerAuth = await this.getTwurpleOptions(this.streamerOauthId);
        if (!twitchStreamerAuth) {
            this.logger.error('No Streamer Auth, StreamerApiClient cannot be created');
            return;
        }
        const refreshingAuthProvider = this.createTwurpleRefreshingAuthProvider(twitchStreamerAuth);
        if (!refreshingAuthProvider) {
            this.logger.error('No RefreshingAuthProvider, StreamerApiClient cannot be created');
            return;
        }
        this.client = new ApiClient({ authProvider: refreshingAuthProvider });
        // Get current rewards
        await this.getChannelPointRewards();
    }

    private createTwurpleRefreshingAuthProvider(
        twitchUserStreamerAuth: TwitchUserWithRegisteredStreamer
    ): RefreshingAuthProvider | null {
        if (!twitchUserStreamerAuth?.registeredStreamerAuth) {
            this.logger.error('No Streamer Auth Found');
            return null;
        }
        const currentAccessToken: AccessToken = {
            accessToken: twitchUserStreamerAuth.registeredStreamerAuth.accessToken,
            refreshToken: twitchUserStreamerAuth.registeredStreamerAuth.refreshToken,
            scope: twitchUserStreamerAuth.registeredStreamerAuth.scope,
            expiresIn: twitchUserStreamerAuth.registeredStreamerAuth.expirySeconds,
            obtainmentTimestamp: Number(twitchUserStreamerAuth.registeredStreamerAuth.obtainmentEpoch)
        };

        return new RefreshingAuthProvider(
            {
                clientId: this.configService.get('TWITCH_CLIENT_ID') ?? '',
                clientSecret: this.configService.get('TWITCH_CLIENT_SECRET') ?? '',
                onRefresh: async (newTokenData: AccessToken) => {
                    this.logger.warn('New Streamer Access Token', newTokenData.accessToken, newTokenData.scope);
                    try {
                        const user = await this.twitchStreamerAuthService.upsertUserStreamerAuth(
                            twitchUserStreamerAuth.oauthId,
                            newTokenData
                        );

                        if (!user) {
                            this.logger.error('Could Not Update User Streamer Auth');
                            return;
                        }
                        const streamerAuth = user.registeredStreamerAuth;
                        this.logger.warn(
                            `Success Update Twurple Options DB Streamer: ${streamerAuth?.accessToken} - ${streamerAuth?.expirySeconds} - ${streamerAuth?.scope}`
                        );
                    } catch (err) {
                        this.logger.error('Error Upserting User Streamer Auth', err);
                    }
                }
            },
            currentAccessToken
        );
    }

    private async getTwurpleOptions(oauthId: string): Promise<TwitchUserWithRegisteredStreamer | null> {
        try {
            const twitchUserStreamerAuth = await this.twitchStreamerAuthService.getUniqueTwitchUserWithStreamerAuth(
                oauthId
            );
            if (!twitchUserStreamerAuth) {
                this.logger.error('No User Found For Streamer Auth', twitchUserStreamerAuth);
                return null;
            }

            if (!twitchUserStreamerAuth.registeredStreamerAuth) {
                this.logger.error('No Registered Streamer Auth for User', oauthId);
                return null;
            }

            return twitchUserStreamerAuth;
        } catch (err) {
            this.logger.error('Error Getting Streamer Options From DB', err);
        }

        return null;
    }
}
