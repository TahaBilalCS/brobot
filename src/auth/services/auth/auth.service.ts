import { Injectable } from '@nestjs/common';
import { AuthenticationProvider } from 'src/auth/services/auth/auth';
import { Prisma } from '@prisma/client';
import {
    TwitchUserService,
    TwitchUserWithRegistered,
    TwitchUserWithRegisteredBot,
    TwitchUserWithRegisteredStreamer
} from 'src/database/services/twitch-user/twitch-user.service';
import { TwitchStreamerAuthService } from 'src/database/services/twitch-streamer-auth/twitch-streamer-auth.service';
import { TwitchBotAuthService } from 'src/database/services/twitch-bot-auth/twitch-bot-auth.service';
import { TwitchBotOrStreamerRegisteredIncomplete, TwitchUserRegisteredIncomplete } from 'src/auth/strategies';

@Injectable()
export class AuthService implements AuthenticationProvider {
    constructor(
        private readonly twitchUserService: TwitchUserService,
        private readonly twitchStreamerAuthService: TwitchStreamerAuthService,
        private readonly twitchBotAuthService: TwitchBotAuthService
    ) {}

    async findTwitchUserWithRegistered(oauthId: string): Promise<TwitchUserWithRegistered | null> {
        return this.twitchUserService.getUniqueTwitchUserWithRegistered({ oauthId });
    }

    async findTwitchUserWithBotAuth(oauthId: string): Promise<TwitchUserWithRegisteredBot | null> {
        return this.twitchUserService.getUniqueTwitchUserWithBotAuth({ oauthId });
    }

    async findTwitchUserWithStreamerAuth(oauthId: string): Promise<TwitchUserWithRegisteredStreamer | null> {
        return this.twitchUserService.getUniqueTwitchUserWithStreamerAuth({ oauthId });
    }

    async validateOrCreateTwitchUser(
        userDetails: Prisma.TwitchUserCreateInput,
        registeredUserDetails: TwitchUserRegisteredIncomplete
    ) {
        console.log('Validate Or Create Twitch USER');
        return this.twitchUserService.upsertUserAndRegisteredUser(userDetails, registeredUserDetails);
    }

    async validateOrCreateTwitchStreamer(
        userDetails: Prisma.TwitchUserCreateInput,
        registeredStreamerDetails: TwitchBotOrStreamerRegisteredIncomplete
    ) {
        console.log('Validate Or Create Twitch STREAMER');
        return this.twitchStreamerAuthService.upsertUserAndRegisteredStreamer(userDetails, registeredStreamerDetails);
    }

    async validateOrCreateTwitchBot(
        userDetails: Prisma.TwitchUserCreateInput,
        registeredBotDetails: TwitchBotOrStreamerRegisteredIncomplete
    ) {
        console.log('Validate Or Create Twitch BOT', userDetails);
        return this.twitchBotAuthService.upsertUserAndRegisteredBot(userDetails, registeredBotDetails);
    }
}
