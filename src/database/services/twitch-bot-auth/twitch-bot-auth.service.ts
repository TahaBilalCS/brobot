import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma, TwitchBotAuth } from '@prisma/client';

@Injectable()
export class TwitchBotAuthService {
    constructor(private readonly prisma: PrismaService) {}

    async getUniqueTwitchBot(
        twitchUserWhereUniqueInput: Prisma.TwitchBotAuthWhereUniqueInput
    ): Promise<TwitchBotAuth | null> {
        return this.prisma.twitchBotAuth.findUnique({
            where: twitchUserWhereUniqueInput
        });
    }

    async createTwitchBotAuth(data: Prisma.TwitchBotAuthCreateInput): Promise<TwitchBotAuth> {
        return this.prisma.twitchBotAuth.create({
            data
        });
    }
}
