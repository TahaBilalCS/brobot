import { Module } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { TwitchUserService } from './services/twitch-user/twitch-user.service';
import { TwitchBotAuthService } from './services/twitch-bot-auth/twitch-bot-auth.service';
import { TwitchStreamerAuthService } from './services/twitch-streamer-auth/twitch-streamer-auth.service';
import { TwitchPokemonService } from './services/twitch-pokemon/twitch-pokemon.service';

@Module({
    providers: [
        PrismaService,
        TwitchUserService,
        TwitchBotAuthService,
        TwitchStreamerAuthService,
        TwitchPokemonService
    ],
    controllers: [],
    imports: [],
    exports: [TwitchUserService, TwitchBotAuthService, TwitchStreamerAuthService, TwitchPokemonService]
})
export class DatabaseModule {}
