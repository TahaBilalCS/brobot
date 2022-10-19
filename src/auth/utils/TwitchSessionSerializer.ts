import { PassportSerializer } from '@nestjs/passport';
import { Inject, Injectable } from '@nestjs/common';
import { TwitchUserAuthReq } from 'src/auth/strategies';
import { AuthService } from 'src/auth/services/auth/auth.service';
@Injectable()
export class TwitchSessionSerializer extends PassportSerializer {
    constructor(@Inject('AUTH_SERVICE') private readonly authService: AuthService) {
        super();
    }

    serializeUser(user: TwitchUserAuthReq, done: (err: Error | null, user: TwitchUserAuthReq) => void) {
        console.log('SERIALIZE USER', user.displayName);
        done(null, user);
    }

    async deserializeUser(user: TwitchUserAuthReq, done: (err: Error | null, user: any | null) => void): Promise<any> {
        console.log('DESERIALIZE USER', user);
        const userDB = await this.authService.findTwitchUser(user.oauthId);
        return userDB ? done(null, { oauthId: userDB?.oauthId, displayName: userDB?.displayName }) : done(null, null);
    }
}
