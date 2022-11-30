import { Strategy } from 'passport-twitch-new';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthenticationProvider } from 'src/auth/services/auth/auth';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

/**
 * Event Subs Bot Api
 * channel:moderate
 * moderation:read
 */
// TODO Revoke scopes? https://codepen.io/Alca/full/BaLrORm

// BotChatService
// channel:edit:commercial (commercial)
// channel:manage:broadcast (timeout users) Now streamer Api does it
// TODO MAKE SURE SCOPE CHANGES ARE ACTUALLY WORKING WHEN RESTARTING, SOMETHING FUNKY, IS REFRESH/APP UPDATING?
// TODO LOGGING OUT AFTER DOUBLE LOGIN BREAKS SESSION
export const botScope = [
    'user_read', // Old scope for reading user info (email, profileImage, etc)
    'chat:read',
    'chat:edit',
    'channel:edit:commercial', // (commercial)
    'channel:moderate'
];
// StreamerApiService
// Event subs go here? Kinda between bot and streamer
export const streamerScope = [
    'user_read', // Old scope for reading user info (email, profileImage, etc)
    'chat:read',
    'channel:manage:broadcast', // create marker
    'channel:manage:predictions', // predictions
    'moderator:manage:banned_users', // ban/timeout users
    'channel:manage:polls', // polls ('channel:read:polls' can be added later)
    'channel:read:redemptions', // retrieve channel point rewards
    'channel:manage:redemptions' // create/update channel point rewards
];

// Regular users
export const userScope = ['user_read'];

export interface TwitchUserAuthReq {
    oauthId: string;
    displayName: string;
    scope?: string[];
    roles: string[];
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
    email?: string; // Todo Some of these fields are actually undefined
    created_at: string;
    provider: string;
}

export interface TwitchUserRegisteredIncomplete {
    // no twitch user
    email?: string;
    profileImageUrl: string;
    scope: string[];
    originDate: string; // String date
}

export interface TwitchBotOrStreamerRegisteredIncomplete {
    // no twitch user
    accessToken: string;
    refreshToken: string;
    scope: string[];
    obtainmentEpoch: number;
    expirySeconds: number;
}

@Injectable()
export class TwitchUserStrategy extends PassportStrategy(Strategy, 'twitch') {
    private readonly logger = new Logger(PassportStrategy.name);

    constructor(@Inject('AUTH_SERVICE') private readonly authService: AuthenticationProvider) {
        super({
            clientID: process.env.TWITCH_CLIENT_ID,
            clientSecret: process.env.TWITCH_CLIENT_SECRET,
            callbackURL: process.env.TWITCH_CALLBACK_URL_USER,
            scope: userScope
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: TwitchOAuthProfile): Promise<TwitchUserAuthReq> {
        this.logger.log('Login User');
        const { id, created_at, email, profile_image_url, display_name } = profile;

        const userDetails: Prisma.TwitchUserCreateInput = {
            oauthId: id,
            displayName: display_name
        };

        const registeredUserDetails: TwitchUserRegisteredIncomplete = {
            email: email,
            profileImageUrl: profile_image_url,
            scope: userScope,
            originDate: created_at
        };

        const user = await this.authService.validateOrCreateTwitchUser(userDetails, registeredUserDetails);

        if (!user.registeredUser?.scope) {
            this.logger.error('User does not have scope', user);
        }
        // Store these in req.user with passport in order to keep session when logging into other strategies
        return {
            oauthId: user.oauthId,
            displayName: user.displayName,
            scope: user.registeredUser?.scope,
            roles: user.roles
        };
    }
}

@Injectable()
export class TwitchStreamerStrategy extends PassportStrategy(Strategy, 'twitch-streamer') {
    private readonly logger = new Logger(PassportStrategy.name);

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
        this.logger.log('Login Streamer');
        // TODO: Better way than manual check
        if (profile.id !== this.configService.get('TWITCH_STREAMER_OAUTH_ID')) {
            this.logger.error('Reject this user abuser', profile.id);
            throw new UnauthorizedException();
        }
        const { id, display_name } = profile;

        const userStreamerDetails: Prisma.TwitchUserCreateInput = {
            oauthId: id,
            displayName: display_name
        };

        const registeredUserStreamerAuthDetails: TwitchBotOrStreamerRegisteredIncomplete = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            scope: streamerScope,
            obtainmentEpoch: 0,
            expirySeconds: 0
        };

        const user = await this.authService.validateOrCreateTwitchStreamer(
            userStreamerDetails,
            registeredUserStreamerAuthDetails
        );

        if (!user.registeredStreamerAuth?.scope) {
            this.logger.error('Streamer does not have scope', user);
        }

        return {
            oauthId: user.oauthId,
            displayName: user.displayName,
            scope: user.registeredStreamerAuth?.scope,
            roles: user.roles
        };
    }
}

@Injectable()
export class TwitchBotStrategy extends PassportStrategy(Strategy, 'twitch-bot') {
    private readonly logger = new Logger(PassportStrategy.name);

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
        this.logger.log('Login Bot');
        if (profile.id !== this.configService.get('TWITCH_BOT_OAUTH_ID')) {
            this.logger.error('Reject this user abuser', profile.id);
            throw new UnauthorizedException();
        }
        const { id, display_name } = profile;

        const userBotDetails: Prisma.TwitchUserCreateInput = {
            oauthId: id,
            displayName: display_name
        };

        const registeredUserBotAuthDetails: TwitchBotOrStreamerRegisteredIncomplete = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            scope: botScope,
            obtainmentEpoch: 0,
            expirySeconds: 0
        };

        const user = await this.authService.validateOrCreateTwitchBot(userBotDetails, registeredUserBotAuthDetails);

        if (!user.registeredBotAuth?.scope) {
            this.logger.error('Bot does not have scope', user);
        }

        return {
            oauthId: user.oauthId,
            displayName: user.displayName,
            scope: user.registeredBotAuth?.scope,
            roles: user.roles
        };
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
