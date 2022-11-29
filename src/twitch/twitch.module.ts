import { Module } from '@nestjs/common';
import { BotChatService } from 'src/twitch/services/bot-chat/bot-chat.service';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { BotApiService } from 'src/twitch/services/bot-api/bot-api.service';
import { DatabaseModule } from 'src/database/database.module';
import { TwitchBotAuthService } from 'src/database/services/twitch-bot-auth/twitch-bot-auth.service';
import { StreamerApiService } from './services/streamer-api/streamer-api.service';
import { TwitchStreamerAuthService } from 'src/database/services/twitch-streamer-auth/twitch-streamer-auth.service';
import { StreamerGateway } from 'src/twitch/gateways/streamer/streamer.gateway';
import { VoteService } from 'src/twitch/services/vote/vote.service';
import { ChessService } from './services/chess/chess.service';
import { HttpModule } from '@nestjs/axios';
import { OutgoingEvents } from 'src/twitch/gateways/streamer/IEvents';
import { PokemonService } from './services/pokemon/pokemon.service';
import { AdminUiGateway } from './gateways/ui/admin-ui.gateway';

const AsyncBotChatServiceProvider = {
    inject: [ConfigService, TwitchBotAuthService, StreamerGateway, StreamerApiService, AdminUiGateway],
    provide: BotChatService,
    useFactory: async (
        configService: ConfigService,
        twitchBotAuthService: TwitchBotAuthService,
        streamerGateway: StreamerGateway,
        streamerApiService: StreamerApiService,
        adminUiGateway: AdminUiGateway
    ) => {
        console.log('BotChatService Factory');
        const tcs = new BotChatService(
            configService,
            twitchBotAuthService,
            streamerGateway,
            streamerApiService,
            adminUiGateway
        );
        await tcs.init();
        return tcs;
    }
};
const AsyncBotApiServiceProvider = {
    inject: [ConfigService, PokemonService, AdminUiGateway, BotChatService],
    provide: BotApiService,
    useFactory: async (
        configService: ConfigService,
        pokemonService: PokemonService,
        adminUiGateway: AdminUiGateway,
        botChatService: BotChatService
    ) => {
        console.log('BotApiService Factory');
        const tcs = new BotApiService(configService, pokemonService, adminUiGateway, botChatService);
        await tcs.init();
        return tcs;
    }
};
const AsyncStreamerApiServiceProvider = {
    inject: [ConfigService, TwitchStreamerAuthService],
    provide: StreamerApiService,
    useFactory: async (configService: ConfigService, twitchStreamerAuthService: TwitchStreamerAuthService) => {
        console.log('StreamerApiService Factory');
        const tcs = new StreamerApiService(configService, twitchStreamerAuthService);
        await tcs.init();
        return tcs;
    }
};
const AsyncChatBanVoteServiceProvider = {
    inject: [ConfigService, BotChatService, StreamerGateway],
    provide: 'ChatBanVote',
    useFactory: async (
        configService: ConfigService,
        botChatService: BotChatService,
        streamerGateway: StreamerGateway
    ) => {
        console.log('ChatBanVote Service Factory');
        const activateVoteThreshold = 1;
        const voteType = OutgoingEvents.CHATBAN;
        return new VoteService(configService, botChatService, streamerGateway, voteType, activateVoteThreshold);
    }
};

const AsyncVoiceBanVoteServiceProvider = {
    inject: [ConfigService, BotChatService, StreamerGateway],
    provide: 'VoiceBanVote',
    useFactory: async (
        configService: ConfigService,
        botChatService: BotChatService,
        streamerGateway: StreamerGateway
    ) => {
        console.log('VoiceBanVote Service Factory');
        const activateVoteThreshold = 1;
        const voteType = OutgoingEvents.VOICEBAN;
        return new VoteService(configService, botChatService, streamerGateway, voteType, activateVoteThreshold);
    }
};
@Module({
    imports: [ConfigModule, DatabaseModule, HttpModule],
    providers: [
        AdminUiGateway,
        AsyncStreamerApiServiceProvider,
        AsyncBotApiServiceProvider,
        AsyncBotChatServiceProvider,
        AsyncChatBanVoteServiceProvider,
        AsyncVoiceBanVoteServiceProvider,
        ChessService,
        StreamerGateway,
        PokemonService
    ],
    exports: [
        AdminUiGateway,
        AsyncStreamerApiServiceProvider,
        AsyncBotApiServiceProvider,
        AsyncBotChatServiceProvider,
        AsyncChatBanVoteServiceProvider,
        AsyncVoiceBanVoteServiceProvider,
        ChessService,
        StreamerGateway,
        PokemonService
    ]
})
export class TwitchModule {}
