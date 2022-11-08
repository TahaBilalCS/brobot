import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ApiClient } from '@twurple/api';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RefreshingAuthProvider } from '@twurple/auth';
import { TwitchStreamerAuthService } from 'src/database/services/twitch-streamer-auth/twitch-streamer-auth.service';
import { TwitchUserWithRegisteredStreamer } from 'src/database/services/twitch-user/twitch-user.service';

/**
 * Stream marker & predictions
 */
@Injectable()
export class StreamerApiService implements OnModuleInit {
    private readonly logger = new Logger(StreamerApiService.name);

    private streamerOauthId: string;

    public client?: ApiClient;

    constructor(private configService: ConfigService, private twitchStreamerAuthService: TwitchStreamerAuthService) {
        console.log(`${StreamerApiService.name} Constructor`);
        this.streamerOauthId = this.configService.get('TWITCH_STREAMER_OAUTH_ID') ?? '';
    }

    onModuleInit(): any {
        console.log('MODULE INIT StreamerApiService');
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
            obtainmentTimestamp: twitchUserStreamerAuth.registeredStreamerAuth.obtainmentEpoch
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
                            `Success Update Twurple Options DB Bot: ${streamerAuth?.accessToken} - ${streamerAuth?.expirySeconds} - ${streamerAuth?.scope}`
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
