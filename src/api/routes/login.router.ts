import { logger } from '../../utils/LoggerUtil.js';
import { appenv } from '../../config/appenv.js';
import { Router, Request, Response } from 'express';
import passport from 'passport';

/**
 Because of body parser's lack of type, Interface now has all the same properties as Request. Overrides Request.body
 interface RequestWithBody extends Request {
        Body object with some unknown keys that are strings, and their values will either be a string | undefined
        body: { [key: string]: string | undefined };
    }
 */

const router = Router();

router.get('/', (req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (req.session?.passport && req.session.passport.user) {
        // ${process.env.TWITCH_CLIENT_ID}, NODE:${process.env.TWITCH_CALLBACK_URL}, MONGO:${process.env.MONGO_URI}
        // User authenticated
        res.send(`
            <h1>SIGNED IN</h1>
            NODE:${appenv.NODE_ENV}
            <a href='/api/logout'>Logout</a>
            <a href='/api/current_user'>Current User</a>
            <a href='/api/secret'>Secret</a>
        `);
    } else {
        res.send(`
            NODE:${appenv.NODE_ENV}
            <a href='/auth/twitch'>Login</a>
            <a href='/api/current_user'>Current User</a>
            <a href='/api/secret'>Secret</a>
        `);
    }
});

/** Regular User Auth Route - Also for adding permissions to b_robot and streamer */
router.get(
    '/auth/twitch',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    passport.authenticate('twitch', {
        scope: [
            'user_read',
            'chat:read',
            'chat:edit',
            'channel:moderate',
            'channel:read:redemptions',
            'channel:manage:predictions',
            'channel:manage:redemptions',
            'channel:edit:commercial',
            'channel:read:subscriptions',
            'moderation:read',
            'channel_subscriptions',
            'analytics:read:extensions',
            'analytics:read:games',
            'bits:read',
            'channel:manage:broadcast',
            'channel:manage:extensions',
            'channel:manage:polls',
            'channel:manage:schedule',
            'channel:manage:videos',
            'channel:read:editors',
            'channel:read:goals',
            'channel:read:hype_train',
            'channel:read:polls',
            'channel:read:predictions',
            'channel:read:redemptions',
            'channel:read:subscriptions',
            'clips:edit',
            'moderator:manage:banned_users',
            'moderator:read:blocked_terms',
            'moderator:manage:blocked_terms',
            'moderator:manage:automod',
            'moderator:read:automod_settings',
            'moderator:manage:automod_settings',
            'moderator:read:chat_settings',
            'moderator:manage:chat_settings',
            'user:manage:blocked_users',
            'user:read:blocked_users',
            'user:read:broadcast',
            'user:edit:broadcast',
            'user:read:follows',
            'user:read:subscriptions'
        ]
    })
);

/** Set route for OAuth redirect */
router.get(
    '/auth/twitch/callback',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    passport.authenticate('twitch', {
        successRedirect: '/',
        failureRedirect: '/fail'
    })
);

/** Log out */
router.get('/api/logout', (req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    logger.info(`Logging out: ${req.user?.displayName}`);
    req.logout();
    res.redirect('/');
});

// Curly brace when declaration (const router = Router) and export are not on the same line. It's an already created var
export { router };
