import { Module } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { TwitchUserService } from './services/twitch-user/twitch-user.service';

@Module({
    providers: [PrismaService, TwitchUserService],
    controllers: [],
    imports: [],
    exports: [TwitchUserService]
})
export class DatabaseModule {}
