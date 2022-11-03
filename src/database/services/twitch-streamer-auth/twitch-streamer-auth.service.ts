import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { TwitchStreamerAuth, Prisma } from '@prisma/client';
import { AccessToken } from '@twurple/auth';

@Injectable()
export class TwitchStreamerAuthService {
    constructor(private readonly prisma: PrismaService) {
        console.log('TwitchStreamerAuthService Constructor');
    }

    async getUniqueTwitchStreamer(data: Prisma.TwitchStreamerAuthWhereUniqueInput): Promise<TwitchStreamerAuth | null> {
        return this.prisma.twitchStreamerAuth.findUnique({
            where: data
        });
    }

    async upsertUniqueTwitchStreamer(
        where: Prisma.TwitchStreamerAuthWhereUniqueInput,
        update: Prisma.TwitchStreamerAuthUpdateInput,
        create: Prisma.TwitchStreamerAuthCreateInput
    ): Promise<TwitchStreamerAuth> {
        return this.prisma.twitchStreamerAuth.upsert({
            where,
            update: {
                displayName: update.displayName,
                accessToken: update.accessToken,
                refreshToken: update.refreshToken,
                scope: update.scope,
                lastUpdatedTimestamp: update.lastUpdatedTimestamp
            },
            create: create
        });
    }

    // todo unused?
    async createTwitchStreamer(data: Prisma.TwitchStreamerAuthCreateInput): Promise<TwitchStreamerAuth> {
        return this.prisma.twitchStreamerAuth.create({
            data
        });
    }

    async createOrUpdateUnique(
        where: Prisma.TwitchBotAuthWhereUniqueInput,
        update: AccessToken,
        create: TwitchStreamerAuth
    ): Promise<TwitchStreamerAuth> {
        return this.prisma.twitchStreamerAuth.upsert({
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
                accessToken: create.accessToken,
                refreshToken: create.refreshToken,
                scope: create.scope,
                expiryInMS: create.expiryInMS,
                obtainmentEpoch: create.obtainmentEpoch,
                lastUpdatedTimestamp: new Date().toISOString()
            }
        });
    }
}
