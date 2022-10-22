import { Strategy } from 'passport-twitch-new';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticationProvider } from 'src/auth/services/auth/auth';
import { ConfigService } from '@nestjs/config';

const botScope = ['user_read'];
const streamerScope = ['user_read', 'chat:read'];
const userScope = ['user_read'];

export interface TwitchUserAuthReq {
    oauthId: string;
    displayName: string;
}

export interface TwitchOAuthProfile {
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

@Injectable()
export class TwitchUserStrategy extends PassportStrategy(Strategy, 'twitch') {
    constructor(@Inject('AUTH_SERVICE') private readonly authService: AuthenticationProvider) {
        super({
            clientID: process.env.TWITCH_CLIENT_ID,
            clientSecret: process.env.TWITCH_CLIENT_SECRET,
            callbackURL: process.env.TWITCH_CALLBACK_URL_USER,
            scope: userScope
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: TwitchOAuthProfile): Promise<TwitchUserAuthReq> {
        console.log('Twitch User Strategy Validate', refreshToken);
        const { id, created_at, email, profile_image_url, display_name } = profile;

        const userDetails = {
            oauthId: id,
            displayName: display_name,
            accountCreated: created_at,
            email: email,
            profileImageUrl: profile_image_url,
            lastUpdatedTimestamp: new Date().toISOString()
        };

        const { oauthId, displayName } = await this.authService.validateOrCreateTwitchUser(userDetails);
        // Store these in req.user with passport in order to keep session when logging into other strategies
        return { oauthId, displayName };
    }
}

@Injectable()
export class TwitchStreamerStrategy extends PassportStrategy(Strategy, 'twitch-streamer') {
    constructor(
        @Inject('AUTH_SERVICE') private readonly authService: AuthenticationProvider,
        private configService: ConfigService
    ) {
        super({
            clientID: process.env.TWITCH_CLIENT_ID,
            clientSecret: process.env.TWITCH_CLIENT_SECRET,
            callbackURL: process.env.TWITCH_CALLBACK_URL_STREAMER,
            scope: streamerScope
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: TwitchOAuthProfile): Promise<TwitchUserAuthReq> {
        console.log('Twitch Streamer Strategy Validate', refreshToken);
        // TODO: Better way than manual check
        if (profile.id !== this.configService.get('TWITCH_STREAMER_OAUTH_ID')) {
            console.log('Reject this user abuser', profile.id);
            throw new UnauthorizedException();
        }
        const { id, display_name } = profile;

        const streamerDetails = {
            oauthId: id,
            displayName: display_name,
            accessToken,
            refreshToken,
            scope: streamerScope,
            expiryInMS: 0,
            obtainmentEpoch: 0,
            lastUpdatedTimestamp: new Date().toISOString()
        };

        const { oauthId, displayName } = await this.authService.validateOrCreateTwitchStreamer(streamerDetails);
        return { oauthId, displayName };
    }
}

@Injectable()
export class TwitchBotStrategy extends PassportStrategy(Strategy, 'twitch-bot') {
    constructor(
        @Inject('AUTH_SERVICE') private authService: AuthenticationProvider,
        private configService: ConfigService
    ) {
        super({
            clientID: process.env.TWITCH_CLIENT_ID,
            clientSecret: process.env.TWITCH_CLIENT_SECRET,
            callbackURL: process.env.TWITCH_CALLBACK_URL_BOT,
            scope: botScope
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: TwitchOAuthProfile): Promise<TwitchUserAuthReq> {
        console.log('Twitch Bot Strategy Validate', refreshToken);
        if (profile.id !== this.configService.get('TWITCH_BOT_OAUTH_ID')) {
            console.log('Reject this user abuser', profile.id);
            throw new UnauthorizedException();
        }
        const { id, display_name } = profile;

        const botDetails = {
            oauthId: id,
            displayName: display_name,
            accessToken: accessToken,
            refreshToken: refreshToken,
            scope: botScope,
            expiryInMS: 0,
            obtainmentEpoch: 0,
            lastUpdatedTimestamp: new Date().toISOString()
        };

        const { oauthId, displayName } = await this.authService.validateOrCreateTwitchBot(botDetails);
        return { oauthId, displayName };
    }
}

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
