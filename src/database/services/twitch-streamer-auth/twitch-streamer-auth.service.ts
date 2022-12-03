import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma } from '@prisma/client';
import { TwitchBotOrStreamerRegisteredIncomplete } from 'src/auth/strategies';
import { TwitchUserWithRegisteredStreamer } from 'src/database/services/twitch-user/twitch-user.service';
import { AccessToken } from '@twurple/auth';

@Injectable()
export class TwitchStreamerAuthService {
    private readonly logger = new Logger(TwitchStreamerAuthService.name);

    constructor(private readonly prisma: PrismaService) {}

    // for authenticating passport
    public async upsertUserAndRegisteredStreamer(
        userDetails: Prisma.TwitchUserCreateInput,
        registeredStreamerDetails: TwitchBotOrStreamerRegisteredIncomplete
    ): Promise<TwitchUserWithRegisteredStreamer> {
        // Need to get user before updating stuff so we know what roles it has when updating roles
        const user = await this.prisma.twitchUser.findUnique({ where: { oauthId: userDetails.oauthId } });
        if (!user) {
            const query: Prisma.TwitchUserCreateArgs = {
                include: { registeredStreamerAuth: true },
                data: {
                    ...userDetails,
                    roles: ['Viewer', 'StreamerAuth'],
                    registeredStreamerAuth: {
                        create: {
                            ...registeredStreamerDetails
                        }
                    }
                }
            };
            return (await this.prisma.twitchUser.create(query)) as TwitchUserWithRegisteredStreamer;
        }
        // If user exists, check if they already have the StreamerAuth role
        // This can happen if a RegisteredStreamer is deleted while its parent User lives on
        const currentUserRoles = [...user.roles];
        if (!currentUserRoles.includes('StreamerAuth')) {
            currentUserRoles.push('StreamerAuth');
        }

        const query: Prisma.TwitchUserUpdateArgs = {
            where: { oauthId: userDetails.oauthId },
            include: { registeredStreamerAuth: true },
            data: {
                displayName: userDetails.displayName,
                roles: currentUserRoles,
                registeredStreamerAuth: {
                    upsert: {
                        create: {
                            ...registeredStreamerDetails
                        },
                        update: {
                            ...registeredStreamerDetails
                        }
                    }
                }
            }
        };
        // todo setup namespace correctly instead of using as
        return (await this.prisma.twitchUser.update(query)) as TwitchUserWithRegisteredStreamer;
    }

    // todo duplicate function in user service, this one for streamer-api service
    async getUniqueTwitchUserWithStreamerAuth(oauthId: string): Promise<TwitchUserWithRegisteredStreamer | null> {
        return this.prisma.twitchUser.findUnique({ where: { oauthId }, include: { registeredStreamerAuth: true } });
    }

    // For refreshing auth provider
    async upsertUserStreamerAuth(
        oauthId: string,
        newTokenData: AccessToken
    ): Promise<TwitchUserWithRegisteredStreamer | null> {
        if (newTokenData.refreshToken === null || newTokenData.expiresIn === null) {
            this.logger.error('New Streamer Token Data has Null Values', newTokenData);
            return null;
        }

        if (newTokenData.refreshToken === '' || newTokenData.accessToken === '' || newTokenData.expiresIn === 0) {
            // todo this should be a warning but tracking for now
            this.logger.error('New Streamer Token Has Empty String or 0', newTokenData);
        }

        const streamerAuth: Prisma.TwitchStreamerAuthUncheckedCreateWithoutTwitchUserInput = {
            accessToken: newTokenData.accessToken,
            refreshToken: newTokenData.refreshToken,
            scope: newTokenData.scope,
            expirySeconds: newTokenData.expiresIn,
            obtainmentEpoch: newTokenData.obtainmentTimestamp
        };

        const query = {
            where: { oauthId },
            include: { registeredStreamerAuth: true },
            data: {
                registeredBotAuth: {
                    upsert: {
                        create: {
                            ...streamerAuth
                        },
                        update: {
                            ...streamerAuth
                        }
                    }
                }
            }
        };
        return (await this.prisma.twitchUser.update(query)) as TwitchUserWithRegisteredStreamer;
    }
}
