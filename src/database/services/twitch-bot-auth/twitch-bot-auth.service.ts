import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma, TwitchBotAuth } from '@prisma/client';
import { AccessToken } from '@twurple/auth';

@Injectable()
export class TwitchBotAuthService {
    constructor(private readonly prisma: PrismaService) {
        console.log('TwitchBotAuthService Constructor');
    }

    async getUniqueTwitchBot(
        twitchUserWhereUniqueInput: Prisma.TwitchBotAuthWhereUniqueInput
    ): Promise<TwitchBotAuth | null> {
        return this.prisma.twitchBotAuth.findUnique({
            where: twitchUserWhereUniqueInput
        });
    }

    async upsertUniqueTwitchBot(
        where: Prisma.TwitchBotAuthWhereUniqueInput,
        update: Prisma.TwitchBotAuthUpdateInput,
        create: Prisma.TwitchBotAuthCreateInput
    ): Promise<TwitchBotAuth> {
        console.log('DATA2222222222', update);
        return this.prisma.twitchBotAuth.upsert({
            where,
            update: {
                displayName: update.displayName,
                accessToken: update.accessToken,
                refreshToken: update.refreshToken ?? undefined,
                scope: update.scope,
                lastUpdatedTimestamp: update.lastUpdatedTimestamp
            },
            create: {
                oauthId: create.oauthId,
                displayName: create.displayName,
                accessToken: create.accessToken,
                refreshToken: create.refreshToken ?? '',
                scope: create.scope,
                expiryInMS: create.expiryInMS ?? 0,
                obtainmentEpoch: create.obtainmentEpoch,
                lastUpdatedTimestamp: create.lastUpdatedTimestamp
            }
        });
    }

    async createTwitchBotAuth(data: Prisma.TwitchBotAuthCreateInput): Promise<TwitchBotAuth> {
        return this.prisma.twitchBotAuth.create({
            data
        });
    }

    async createOrUpdateUnique(
        where: Prisma.TwitchBotAuthWhereUniqueInput,
        update: AccessToken,
        create: TwitchBotAuth
    ): Promise<TwitchBotAuth> {
        return this.prisma.twitchBotAuth.upsert({
            where,
            update: {
                accessToken: update.accessToken,
                refreshToken: update.refreshToken ?? undefined,
                scope: update.scope,
                expiryInMS: update.expiresIn ?? undefined,
                obtainmentEpoch: update.obtainmentTimestamp,
                lastUpdatedTimestamp: new Date().toISOString()
            },
            create: {
                oauthId: create.oauthId,
                displayName: create.displayName,
                accessToken: update.accessToken,
                refreshToken: update.refreshToken ?? '',
                scope: update.scope,
                expiryInMS: update.expiresIn ?? 0,
                obtainmentEpoch: update.obtainmentTimestamp,
                lastUpdatedTimestamp: new Date().toISOString()
            }
        });
    }
}
