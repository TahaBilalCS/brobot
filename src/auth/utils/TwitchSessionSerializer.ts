import { PassportSerializer, PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TwitchUserAuthReq } from 'src/auth/strategies';
import { AuthService } from 'src/auth/services/auth/auth.service';

@Injectable()
export class TwitchSessionSerializer extends PassportSerializer {
    private readonly logger = new Logger(PassportSerializer.name);

    constructor(@Inject('AUTH_SERVICE') private readonly authService: AuthService) {
        super();
    }

    serializeUser(user: TwitchUserAuthReq, done: (err: Error | null, user: TwitchUserAuthReq) => void) {
        // todo figure this all out
        done(null, user);
    }

    // Determine which scope a user is logged in with
    async deserializeUser(user: TwitchUserAuthReq, done: (err: Error | null, user: any | null) => void): Promise<any> {
        let userDB;
        let scope;
        if (user.roles.includes('StreamerAuth')) {
            userDB = await this.authService.findTwitchUserWithStreamerAuth(user.oauthId);
            scope = userDB?.registeredStreamerAuth?.scope;
        } else if (user.roles.includes('BotAuth')) {
            userDB = await this.authService.findTwitchUserWithBotAuth(user.oauthId);
            scope = userDB?.registeredBotAuth?.scope;
        } else if (user.roles.includes('Viewer')) {
            userDB = await this.authService.findTwitchUserWithRegistered(user.oauthId);
            scope = userDB?.registeredUser?.scope;
        } else {
            this.logger.error('Unknown Role', user);
        }

        return userDB
            ? done(null, {
                  oauthId: userDB?.oauthId,
                  displayName: userDB?.displayName,
                  scope: scope,
                  roles: userDB.roles
              })
            : done(null, null);
    }
}
