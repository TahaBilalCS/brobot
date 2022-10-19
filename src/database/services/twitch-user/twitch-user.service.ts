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

    async createTwitchUser(data: Prisma.TwitchUserCreateInput): Promise<TwitchUser> {
        return this.prisma.twitchUser.create({
            data
        });
    }
}
