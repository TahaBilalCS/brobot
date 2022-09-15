import { Injectable } from '@nestjs/common';
import { AuthenticationProvider } from 'src/auth/services/auth/auth';
import { TwitchUser } from '@prisma/client';
import { TwitchUserService } from 'src/database/services/twitch-user/twitch-user.service';

@Injectable()
export class AuthService implements AuthenticationProvider {
    constructor(private readonly twitchUserService: TwitchUserService) {
        console.log('Auth Service Init');
    }

    async validateTwitchUser(userDetails: any) {
        console.log('User Details', userDetails);
        const user = await this.twitchUserService.getUniqueTwitchUser({ oauthId: userDetails.oauthId });
        console.log('User', user);
        if (user) return user;
        return this.createTwitchUser(userDetails);
    }

    createTwitchUser(userDetails: any) {
        console.log('Creating User');
        return this.twitchUserService.createTwitchUser(userDetails);
    }

    async findTwitchUser(uuid: string): Promise<TwitchUser | null> {
        return this.twitchUserService.getUniqueTwitchUser({ id: uuid });
    }
}
