/* eslint-disable */
import process from 'process';
import { Router, Request, Response } from 'express';
import passport from 'passport';

/**
// Because of body parser's lack of type, Interface now has all the same properties as Request. Overrides Request.body
interface RequestWithBody extends Request {
    // Body object with some unknown keys that are strings, and their values will either be a string | undefined
    body: { [key: string]: string | undefined };
}
 */

const router = Router();

router.get('/', (req: Request, res: Response) => {
    if (req.session?.passport && req.session.passport.user) {
        // User authenticated
        res.send(`
            <h1>SIGNED IN</h1>
            NODE:${process.env.NODE_ENV}, ${process.env.TWITCH_CLIENT_ID}, NODE:${process.env.TWITCH_CALLBACK_URL},
            MONGO:${process.env.MONGO_URI}
            <a href='/api/logout'>Logout</a>
            <a href='/api/current_user'>Current User</a>
            <a href='/api/secret'>Secret</a>
        `);
    } else {
        res.send(`
        NODE:${process.env.NODE_ENV}, ${process.env.TWITCH_CLIENT_ID}, NODE:${process.env.TWITCH_CALLBACK_URL},
        MONGO:${process.env.MONGO_URI}
        <a href='/auth/twitch'>Login</a>
        <a href='/api/current_user'>Current User</a>
        <a href='/api/secret'>Secret</a>
        `);
    }
});

/** Set route to start OAuth link, this is where you define scopes to request -  'chat:read', 'chat:edit' for brobot */
router.get(
    '/auth/twitch',
    passport.authenticate('twitch', {
        scope: [
            'user_read'
            // todo only for manual admin testing (For twitch channel we listen on only)
            // 'chat:read',
            // 'chat:edit',
            // 'channel:moderate',
            // 'channel:read:redemptions',
            // 'channel:read:subscriptions',
            // 'moderation:read',
            // 'channel_subscriptions'
        ]
    })
);

/** Set route for OAuth redirect */
router.get(
    '/auth/twitch/callback',
    passport.authenticate('twitch', {
        successRedirect: '/',
        failureRedirect: '/fail'
    })
);

/** Log out */
router.get('/api/logout', (req: any, res: Response) => {
    console.log('Logging out:', req.user?.displayName);
    req.logout();
    res.redirect('/');
});

// Curly brace when declaration (const router = Router) and export are not on the same line. It's an already created var
export { router };
