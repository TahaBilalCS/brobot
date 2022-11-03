import { PassportSerializer } from '@nestjs/passport';
import { Inject, Injectable } from '@nestjs/common';
import { TwitchUserAuthReq } from 'src/auth/strategies';
import { AuthService } from 'src/auth/services/auth/auth.service';
import { botScope, streamerScope, userScope } from 'src/auth/strategies';

@Injectable()
export class TwitchSessionSerializer extends PassportSerializer {
    constructor(@Inject('AUTH_SERVICE') private readonly authService: AuthService) {
        super();
    }

    serializeUser(user: TwitchUserAuthReq, done: (err: Error | null, user: TwitchUserAuthReq) => void) {
        console.log('SERIALIZE USER', user.displayName);
        done(null, user);
    }

    // Determine which scope a user is logged in with
    async deserializeUser(user: TwitchUserAuthReq, done: (err: Error | null, user: any | null) => void): Promise<any> {
        console.log('DESERIALIZE USER', user);
        // todo maybe add roles?
        let userDB;
        switch (user.scope.length) {
            case userScope.length:
                userDB = await this.authService.findTwitchUser(user.oauthId);
                break;
            case streamerScope.length:
                userDB = await this.authService.findTwitchStreamerAuth(user.oauthId);
                break;
            case botScope.length:
                userDB = await this.authService.findTwitchBotAuth(user.oauthId);
                break;
            default:
                console.error('Unknown scope', user.scope, user.displayName);
        }

        return userDB
            ? done(null, { oauthId: userDB?.oauthId, displayName: userDB?.displayName, scope: userDB.scope })
            : done(null, null);
    }
}
