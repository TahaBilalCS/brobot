import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ApiClient } from '@twurple/api';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RefreshingAuthProvider } from '@twurple/auth';
import { TwitchStreamerAuth } from '@prisma/client';
import { TwitchStreamerAuthService } from 'src/database/services/twitch-streamer-auth/twitch-streamer-auth.service';

/**
 * Stream marker & predictions
 */
@Injectable()
export class StreamerApiService implements OnModuleInit {
    private readonly logger = new Logger(StreamerApiService.name);
    public client?: ApiClient;

    constructor(private configService: ConfigService, private twitchStreamerAuthService: TwitchStreamerAuthService) {
        console.log(`${StreamerApiService.name} Constructor`);
    }

    onModuleInit(): any {
        console.log('MODULE INIT StreamerApiService');
    }

    async init() {
        this.logger.warn('StreamerApiService Init Async');
        const twitchStreamerAuth = await this.getTwurpleOptions(
            this.configService.get('TWITCH_STREAMER_OAUTH_ID') ?? ''
        );
        if (!twitchStreamerAuth) {
            this.logger.error('No Streamer Auth, StreamerApiClient cannot be created');
            return;
        }
        const refreshingAuthProvider = this.createTwurpleRefreshingAuthProvider(twitchStreamerAuth);
        this.client = new ApiClient({ authProvider: refreshingAuthProvider });
    }

    private createTwurpleRefreshingAuthProvider(twitchStreamerAuth: TwitchStreamerAuth): RefreshingAuthProvider {
        const currentAccessToken: AccessToken = {
            accessToken: twitchStreamerAuth.accessToken,
            refreshToken: twitchStreamerAuth.refreshToken,
            scope: twitchStreamerAuth.scope,
            expiresIn: twitchStreamerAuth.expiryInMS,
            obtainmentTimestamp: twitchStreamerAuth.obtainmentEpoch
        };

        return new RefreshingAuthProvider(
            {
                clientId: this.configService.get('TWITCH_CLIENT_ID') ?? '',
                clientSecret: this.configService.get('TWITCH_CLIENT_SECRET') ?? '',
                onRefresh: async (newTokenData: AccessToken) => {
                    this.logger.warn(
                        'New Streamer Access Token',
                        newTokenData.accessToken,
                        newTokenData.refreshToken,
                        newTokenData.scope
                    );
                    this.twitchStreamerAuthService
                        .createOrUpdateUnique({ oauthId: twitchStreamerAuth.oauthId }, newTokenData, twitchStreamerAuth)
                        .then(updatedToken => {
                            this.logger.warn('Success Update Twurple Options Streamer');
                        })
                        .catch(err => {
                            this.logger.error('Error Update Twurple Options DB Streamer', err);
                        });
                }
            },
            currentAccessToken
        );
    }

    private async getTwurpleOptions(oauthId: string): Promise<TwitchStreamerAuth | null> {
        let twitchStreamerAuth: TwitchStreamerAuth | null = null;
        try {
            twitchStreamerAuth = await this.twitchStreamerAuthService.getUniqueTwitchStreamer({ oauthId });
            if (twitchStreamerAuth) return twitchStreamerAuth;
            this.logger.error('Error Getting Streamer Options From DB, DID YOU SIGN UP BOT IN UI?');
        } catch (err) {
            this.logger.error('Error Getting Streamer Options From DB');
            this.logger.error(err);
        }

        return null;
    }
}
