import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { TwitchStreamerAuth, Prisma } from '@prisma/client';

@Injectable()
export class TwitchStreamerAuthService {
    constructor(private readonly prisma: PrismaService) {}

    async getUniqueTwitchStreamer(data: Prisma.TwitchStreamerAuthWhereUniqueInput): Promise<TwitchStreamerAuth | null> {
        return this.prisma.twitchStreamerAuth.findUnique({
            where: data
        });
    }

    async createTwitchStreamer(data: Prisma.TwitchStreamerAuthCreateInput): Promise<TwitchStreamerAuth> {
        return this.prisma.twitchStreamerAuth.create({
            data
        });
    }
}
