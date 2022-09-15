import { Strategy } from 'passport-twitch-new';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable } from '@nestjs/common';
import { AuthenticationProvider } from 'src/auth/services/auth/auth';

interface TwitchOAuthProfile {
    id: string;
    login: string;
    display_name: string;
    type: string;
    broadcaster_type: string;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    view_count: number;
    email: string;
    created_at: string;
    provider: string;
}
// TODO-BT Separate AUTH for bot & streamer & users
@Injectable()
export class TwitchBotStrategy extends PassportStrategy(Strategy, 'twitch') {
    constructor(@Inject('AUTH_SERVICE') private readonly authService: AuthenticationProvider) {
        super({
            clientID: process.env.TWITCH_CLIENT_ID,
            clientSecret: process.env.TWITCH_CLIENT_SECRET,
            callbackURL: process.env.TWITCH_CALLBACK_URL,
            scope: ['user_read']
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: TwitchOAuthProfile,
        done: (error: any, user?: any) => void
    ) {
        console.log('TWITCH BOT STRATEGY', profile);
        console.log('ACCESS TOKEN', accessToken);
        console.log('REFRESH TOKEN', refreshToken);

        const {
            id,
            created_at,
            email,
            login,
            broadcaster_type,
            type,
            profile_image_url,
            offline_image_url,
            description,
            display_name,
            provider,
            view_count
        } = profile;

        const userDetails = {
            oauthId: id,
            displayName: display_name,
            accountCreated: created_at,
            email: email,
            profileImageUrl: profile_image_url
        };

        return this.authService.validateTwitchUser(userDetails);
        // done(null, user);
    }
}

// @Injectable()
// export class TwitchStreamerStrategy extends PassportStrategy(Strategy, 'twitch') {
//     constructor() {
//         super({
//             clientID: process.env.TWITCH_CLIENT_ID,
//             clientSecret: process.env.TWITCH_CLIENT_SECRET,
//             callbackURL: 'http://localhost:3000/api/auth/twitch/callback',
//             scope: ['user_read']
//         });
//     }
//
//     async validate(accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) {
//         console.log('TWITCH STREAMER STRATEGY', profile);
//
//         const { id, displayName, emails } = profile;
//
//         const user = {
//             twitchId: id,
//             name: displayName,
//             email: emails[0].value
//         };
//
//         done(null, user);
//     }
// }
//
// @Injectable()
// export class TwitchUserStrategy extends PassportStrategy(Strategy, 'twitch') {
//     constructor() {
//         super({
//             clientID: process.env.TWITCH_CLIENT_ID,
//             clientSecret: process.env.TWITCH_CLIENT_SECRET,
//             callbackURL: 'http://localhost:3000/api/auth/twitch/callback',
//             scope: ['user_read']
//         });
//     }
//
//     async validate(accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void) {
//         console.log('TWITCH USER STRATEGY', profile);
//
//         const { id, displayName, emails } = profile;
//
//         const user = {
//             twitchId: id,
//             name: displayName,
//             email: emails[0].value
//         };
//
//         done(null, user);
//     }
// }
// scope: [
//     'user_read',
//     'chat:read',
//     'chat:edit',
//     'channel:moderate',
//     'channel:read:redemptions',
//     'channel:manage:predictions',
//     'channel:manage:redemptions',
//     'channel:edit:commercial',
//     'channel:read:subscriptions',
//     'moderation:read',
//     'channel_subscriptions',
//     'analytics:read:extensions',
//     'analytics:read:games',
//     'bits:read',
//     'channel:manage:broadcast',
//     'channel:manage:extensions',
//     'channel:manage:polls',
//     'channel:manage:schedule',
//     'channel:manage:videos',
//     'channel:read:editors',
//     'channel:read:goals',
//     'channel:read:hype_train',
//     'channel:read:polls',
//     'channel:read:predictions',
//     'channel:read:redemptions',
//     'channel:read:subscriptions',
//     'clips:edit',
//     'moderator:manage:banned_users',
//     'moderator:read:blocked_terms',
//     'moderator:manage:blocked_terms',
//     'moderator:manage:automod',
//     'moderator:read:automod_settings',
//     'moderator:manage:automod_settings',
//     'moderator:read:chat_settings',
//     'moderator:manage:chat_settings',
//     'user:manage:blocked_users',
//     'user:read:blocked_users',
//     'user:read:broadcast',
//     'user:edit:broadcast',
//     'user:read:follows',
//     'user:read:subscriptions'
// ];
