import { TwitchBotOrStreamerRegisteredIncomplete, TwitchUserRegisteredIncomplete } from 'src/auth/strategies';
import { Prisma } from '@prisma/client';
import {
    TwitchUserWithRegistered,
    TwitchUserWithRegisteredStreamer,
    TwitchUserWithRegisteredBot
} from 'src/database/services/twitch-user/twitch-user.service';

export interface AuthenticationProvider {
    findTwitchUserWithRegistered(oauthId: string): Promise<TwitchUserWithRegistered | null>;
    findTwitchUserWithBotAuth(oauthId: string): Promise<TwitchUserWithRegisteredBot | null>;
    findTwitchUserWithStreamerAuth(oauthId: string): Promise<TwitchUserWithRegisteredStreamer | null>;
    validateOrCreateTwitchUser(
        userDetails: Prisma.TwitchUserCreateInput,
        registeredUserDetails: TwitchUserRegisteredIncomplete
    ): Promise<TwitchUserWithRegistered>;
    validateOrCreateTwitchStreamer(
        userDetails: Prisma.TwitchUserCreateInput,
        registeredStreamerDetails: TwitchBotOrStreamerRegisteredIncomplete
    ): Promise<TwitchUserWithRegisteredStreamer>;
    validateOrCreateTwitchBot(
        userDetails: Prisma.TwitchUserCreateInput,
        registeredBotDetails: TwitchBotOrStreamerRegisteredIncomplete
    ): Promise<TwitchUserWithRegisteredBot>;
}
