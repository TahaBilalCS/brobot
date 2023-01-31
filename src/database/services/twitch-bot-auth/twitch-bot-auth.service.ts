import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma } from '@prisma/client';
import { TwitchBotOrStreamerRegisteredIncomplete } from 'src/auth/strategies';
import { TwitchUserWithRegisteredBot } from 'src/database/services/twitch-user/twitch-user.service';
import { AccessToken } from '@twurple/auth';

@Injectable()
export class TwitchBotAuthService {
    private readonly logger = new Logger(TwitchBotAuthService.name);

    constructor(private readonly prisma: PrismaService) {}

    // for authenticating passport
    public async upsertUserAndRegisteredBot(
        userDetails: Prisma.TwitchUserCreateInput,
        registeredBotDetails: TwitchBotOrStreamerRegisteredIncomplete
    ): Promise<TwitchUserWithRegisteredBot> {
        // Need to get user before updating stuff so we know what roles it has when updating roles
        const user = await this.prisma.twitchUser.findUnique({ where: { oauthId: userDetails.oauthId } });
        if (!user) {
            const query: Prisma.TwitchUserCreateArgs = {
                include: { registeredBotAuth: true },
                data: {
                    ...userDetails,
                    roles: ['Viewer', 'BotAuth'],
                    registeredBotAuth: {
                        create: {
                            ...registeredBotDetails
                        }
                    }
                }
            };
            return (await this.prisma.twitchUser.create(query)) as TwitchUserWithRegisteredBot;
        }

        const currentUserRoles = [...user.roles];
        if (!currentUserRoles.includes('BotAuth')) {
            currentUserRoles.push('BotAuth');
        }

        const query: Prisma.TwitchUserUpdateArgs = {
            where: { oauthId: userDetails.oauthId },
            include: { registeredBotAuth: true },
            data: {
                displayName: userDetails.displayName,
                roles: currentUserRoles,
                registeredBotAuth: {
                    upsert: {
                        create: {
                            ...registeredBotDetails
                        },
                        update: {
                            ...registeredBotDetails
                        }
                    }
                }
            }
        };
        // todo setup namespace correctly instead of using as
        return (await this.prisma.twitchUser.update(query)) as TwitchUserWithRegisteredBot;
    }

    // todo duplicate function in user service, this one for bot-chat service
    async getUniqueTwitchUserWithBotAuth(oauthId: string): Promise<TwitchUserWithRegisteredBot | null> {
        return this.prisma.twitchUser.findUnique({ where: { oauthId }, include: { registeredBotAuth: true } });
    }

    // For refreshing auth provider
    async upsertUserBotAuth(oauthId: string, newTokenData: AccessToken): Promise<TwitchUserWithRegisteredBot | null> {
        if (newTokenData.refreshToken === null || newTokenData.expiresIn === null) {
            this.logger.error('New User Token Data has Null Values', newTokenData);
            return null;
        }

        if (newTokenData.refreshToken === '' || newTokenData.accessToken === '' || newTokenData.expiresIn === 0) {
            // todo this should be a warning but tracking for now
            this.logger.error('New User Token Has Empty String or 0', newTokenData);
        }

        const botAuth: Prisma.TwitchBotAuthUncheckedCreateWithoutTwitchUserInput = {
            accessToken: newTokenData.accessToken,
            refreshToken: newTokenData.refreshToken,
            scope: newTokenData.scope,
            expirySeconds: newTokenData.expiresIn,
            obtainmentEpoch: newTokenData.obtainmentTimestamp
        };

        const query = {
            where: { oauthId },
            include: { registeredBotAuth: true },
            data: {
                registeredBotAuth: {
                    upsert: {
                        create: {
                            ...botAuth
                        },
                        update: {
                            ...botAuth
                        }
                    }
                }
            }
        };
        return (await this.prisma.twitchUser.update(query)) as TwitchUserWithRegisteredBot;
    }
}
