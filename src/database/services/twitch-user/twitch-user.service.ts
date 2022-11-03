import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { TwitchUser, Prisma } from '@prisma/client';

@Injectable()
export class TwitchUserService {
    constructor(private readonly prisma: PrismaService) {}

    async getUniqueTwitchUser(
        twitchUserWhereUniqueInput: Prisma.TwitchUserWhereUniqueInput
    ): Promise<TwitchUser | null> {
        return this.prisma.twitchUser.findUnique({
            where: twitchUserWhereUniqueInput
        });
    }
    async upsertUniqueTwitchUser(
        where: Prisma.TwitchUserWhereUniqueInput,
        update: Prisma.TwitchUserUpdateInput,
        create: Prisma.TwitchUserCreateInput
    ): Promise<TwitchUser> {
        return this.prisma.twitchUser.upsert({
            where,
            update: {
                displayName: update.displayName,
                accountCreated: update.accountCreated,
                email: update.email,
                profileImageUrl: update.profileImageUrl,
                scope: update.scope,
                lastUpdatedTimestamp: update.lastUpdatedTimestamp
            },
            create: create
        });
    }

    // todo unused?
    async createTwitchUser(data: Prisma.TwitchUserCreateInput): Promise<TwitchUser> {
        return this.prisma.twitchUser.create({
            data
        });
    }
}
