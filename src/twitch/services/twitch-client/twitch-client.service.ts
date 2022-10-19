import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwitchClientService implements OnModuleInit {
    private readonly logger = new Logger(TwitchClientService.name);
    constructor(private configService: ConfigService) {
        console.log('Twitch Client Service Init');
    }

    onModuleInit() {
        console.log('Twitch Client Service Init', this.configService.get('TWITCH_CLIENT_ID'));
    }

    /**
     * Get twurple config from DB
     * @param user
     * @private
     */
    // private async _getOrCreateTwurpleOptions(user: string): Promise<TwurpleInterface | null> {
    //     let twurpleOptions: TwurpleInterface | null = null;
    //     try {
    //         twurpleOptions = await this._twurpleConfig.findOne({ user: user });
    //     } catch (err) {
    //         this.logger.error('Error Getting Twurple Options From DB');
    //         this.logger.error(err);
    //     }
    //
    //     if (twurpleOptions) return twurpleOptions;
    //
    //     let accessToken, refreshToken;
    //     if (user === AUTH_USER.BOT) {
    //         accessToken = appenv.BROBOT_ACCESS_TOKEN;
    //         refreshToken = appenv.BROBOT_REFRESH_TOKEN;
    //     } else if (user === AUTH_USER.STREAMER) {
    //         accessToken = appenv.STREAMER_ACCESS_TOKEN;
    //         refreshToken = appenv.STREAMER_REFRESH_TOKEN;
    //     }
    //
    //     // If no options found
    //     this.logger.warn('Twurple Options Could Not Be Retrieved From DB, Creating A New One');
    //     const newTwurpleConfig = {
    //         user: user,
    //         accessToken: accessToken,
    //         refreshToken: refreshToken,
    //         scope: [
    //             'user_read',
    //             'chat:read',
    //             'chat:edit',
    //             'channel:moderate',
    //             'channel:read:redemptions',
    //             'channel:manage:predictions',
    //             'channel:manage:redemptions',
    //             'channel:edit:commercial',
    //             'channel:read:subscriptions',
    //             'moderation:read',
    //             'channel_subscriptions',
    //             'analytics:read:extensions',
    //             'analytics:read:games',
    //             'bits:read',
    //             'channel:manage:broadcast',
    //             'channel:manage:extensions',
    //             'channel:manage:polls',
    //             'channel:manage:schedule',
    //             'channel:manage:videos',
    //             'channel:read:editors',
    //             'channel:read:goals',
    //             'channel:read:hype_train',
    //             'channel:read:polls',
    //             'channel:read:predictions',
    //             'channel:read:redemptions',
    //             'channel:read:subscriptions',
    //             'clips:edit',
    //             'moderator:manage:banned_users',
    //             'moderator:read:blocked_terms',
    //             'moderator:manage:blocked_terms',
    //             'moderator:manage:automod',
    //             'moderator:read:automod_settings',
    //             'moderator:manage:automod_settings',
    //             'moderator:read:chat_settings',
    //             'moderator:manage:chat_settings',
    //             'user:manage:blocked_users',
    //             'user:read:blocked_users',
    //             'user:read:broadcast',
    //             'user:edit:broadcast',
    //             'user:read:follows',
    //             'user:read:subscriptions'
    //         ],
    //         expiresIn: 0, // 0 will fetch a new token
    //         obtainmentTimestamp: 0
    //     };
    //
    //     // Save and return the newly updated config from DB
    //     try {
    //         // Using "new" keyword to avoid Typescript compilation errors
    //         // https://stackoverflow.com/questions/38939507/error-ts2348-value-of-type-typeof-objectid-is-not-callable-did-you-mean-to-i
    //         return await new this._twurpleConfig(newTwurpleConfig).save();
    //     } catch (err) {
    //         logger.error('Error Saving New Twurple Config To DB');
    //         return null;
    //     }
    // }
}
