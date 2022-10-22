import { Injectable } from '@nestjs/common';
import { AuthenticationProvider } from 'src/auth/services/auth/auth';
import { TwitchUser } from '@prisma/client';
import { TwitchUserService } from 'src/database/services/twitch-user/twitch-user.service';
import { TwitchStreamerAuthService } from 'src/database/services/twitch-streamer-auth/twitch-streamer-auth.service';
import { TwitchBotAuthService } from 'src/database/services/twitch-bot-auth/twitch-bot-auth.service';

@Injectable()
export class AuthService implements AuthenticationProvider {
    constructor(
        private readonly twitchUserService: TwitchUserService,
        private readonly twitchStreamerAuthService: TwitchStreamerAuthService,
        private readonly twitchBotAuthService: TwitchBotAuthService
    ) {}

    async findTwitchUser(oauthId: string): Promise<TwitchUser | null> {
        return this.twitchUserService.getUniqueTwitchUser({ oauthId });
    }

    async validateOrCreateTwitchUser(userDetails: any) {
        console.log('Validate Or Create Twitch USER');
        const user = await this.twitchUserService.getUniqueTwitchUser({ oauthId: userDetails.oauthId });
        if (user) return user;
        return this.createTwitchUser(userDetails);
    }

    async createTwitchUser(userDetails: any) {
        console.log('Creating User');
        return this.twitchUserService.createTwitchUser(userDetails);
    }

    async validateOrCreateTwitchStreamer(userDetails: any) {
        console.log('Validate Or Create Twitch STREAMER');
        const user = await this.twitchStreamerAuthService.getUniqueTwitchStreamer({ oauthId: userDetails.oauthId });
        if (user) return user;
        return this.createTwitchStreamer(userDetails);
    }

    async createTwitchStreamer(userDetails: any) {
        console.log('Creating Twitch Streamer');
        return this.twitchStreamerAuthService.createTwitchStreamer(userDetails);
    }

    async validateOrCreateTwitchBot(userDetails: any) {
        console.log('Validate Or Create Twitch BOT', userDetails);
        const user = await this.twitchBotAuthService.getUniqueTwitchBot({ oauthId: userDetails.oauthId });
        if (user) return user;
        return this.createTwitchBot(userDetails);
    }

    async createTwitchBot(userDetails: any) {
        console.log('Creating Twitch Bot');
        return this.twitchBotAuthService.createTwitchBotAuth(userDetails);
    }
}
