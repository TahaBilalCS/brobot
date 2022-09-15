import { PassportSerializer } from '@nestjs/passport';
import { Inject, Injectable } from '@nestjs/common';
import { TwitchUser } from '@prisma/client';
import { AuthService } from 'src/auth/services/auth/auth.service';
@Injectable()
export class TwitchSessionSerializer extends PassportSerializer {
    constructor(@Inject('AUTH_SERVICE') private readonly authService: AuthService) {
        super();
    }

    serializeUser(user: TwitchUser, done: (err: Error | null, user: TwitchUser) => void) {
        // todo-bt user.id?
        done(null, user);
    }

    async deserializeUser(user: TwitchUser, done: (err: Error | null, user: TwitchUser | null) => void): Promise<any> {
        const userDB = await this.authService.findTwitchUser(user.id);
        console.log('DESERIALIZE USER', userDB);
        return userDB ? done(null, userDB) : done(null, null);
    }
}
