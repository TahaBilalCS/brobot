import process from 'process';
import { logger } from './utils/logger'; // Init winston logger singleton
import { appenv } from './config/appenv';
import express, { Express } from 'express';
import cookieSession from 'cookie-session';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';

// Models before Services & Routers
import './api/models/User';
import './api/models/Twurple';
import './api/models/Pokemon';

// Init Twurple & Socket module singletons
import { twurpleInstance } from './twurple/TwurpleInstance';
import { expressSocket } from './ws/ExpressSocket';

// Routers after Models
import { router as loginRouter } from './api/routes/login.router';
import { router as userRouter } from './api/routes/user.router';

// Services after Models
import * as passportService from './api/services/passport.service';
import {
    EventSubChannelBanEvent,
    EventSubChannelRaidEvent,
    EventSubChannelRedemptionAddEvent,
    EventSubChannelUnbanEvent,
    EventSubListener,
    EventSubMiddleware
} from '@twurple/eventsub';

import { NgrokAdapter } from '@twurple/eventsub-ngrok';
import { LogLevel } from '@d-fischer/logger';

/** Base Express App - Start before middlewares */
const appBase: Express = express();
expressSocket.setupSocket(appBase);
const { app } = expressSocket.wsInstance;

// Wait for DB connection
const MONGO_URI = appenv.MONGO_URI;
await (async function (): Promise<void> {
    try {
        await mongoose.connect(MONGO_URI);
        logger.warn('Mongoose Connected');
    } catch (err) {
        logger.error('Mongoose Connection Failed?!');
        logger.error(err);
    }
})();

/**
 * Todo-Note: express.json breaks event subscriptions for twurple. Don't apply globally, use it only in routes that need it
 * Use during PUT/PATCH requests
 */
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());

/**
 * Key difference between cookie-session and express-session is how the keys are stored
 * Cookie Session: Cookie IS the session -> Take user ID, find user, set it on req.session
 * Express Session: Cookie references a session -> Take session ID, then look at server side session store
 * Cookie has a small size limit with cookie-session compared to bucket of data from express-session. Only care about id
 * Passes into req.session. Cookie expires in 30 days, extracts cookie data to be passed into passport
 */
app.use(
    cookieSession({
        maxAge: 30 * 24 * 60 * 60 * 1000,
        keys: [appenv.COOKIE_KEY]
        // secret: appenv.SESSION_SECRET
    })
);

app.use(express.static('public'));
app.use(cors());
app.use(helmet());

/** Service Init */
passportService.init(app);

/** One more level async in order to start up app */
await (async function (): Promise<void> {
    // Twurple setup before routes and ws init
    await twurpleInstance.initTwurple();
    // Setup ws events with twurpleInstance
    expressSocket.initSocket();
    // Routes Init: controller used in router, service used in controller
    app.use(loginRouter);
    app.use(userRouter);

    const PORT = appenv.PORT ? parseInt(appenv.PORT) : 3000;
    const streamerAuthId = parseInt(appenv.STREAMER_AUTH_ID);
    // If in development, setup NgrokAdapter to handle event subscriptions
    if (process.env.NODE_ENV === 'development') {
        const devListener = new EventSubListener({
            logger: { name: 'Dev', minLevel: LogLevel.ERROR },
            apiClient: twurpleInstance.botApiClient,
            adapter: new NgrokAdapter(),
            secret: appenv.TEST_SECRET
        });

        // Delete all previous subscriptions for dev (only use with ngrok), as re-subscribing can cause rate limiting errors
        await twurpleInstance.botApiClient.eventSub.deleteAllSubscriptions();
        await devListener.listen();

        app.listen(PORT, () => {
            logger.info(`Running on ${PORT} ⚡`);
            // Funky syntax to handle linting error: i.e: no-misused-promises
            void (async (): Promise<void> => {
                // Subscribe to unban event
                await devListener.subscribeToChannelUnbanEvents(streamerAuthId, (event: EventSubChannelUnbanEvent) => {
                    const username = event.userDisplayName.trim().toLowerCase();
                    void twurpleInstance.twitchBot?.pokemon.roarUserPokemon(username, event.userId);
                    logger.info(`${event.broadcasterDisplayName} just unbanned ${event.userDisplayName}!`);
                });
                // Subscribe to ban event
                await devListener.subscribeToChannelBanEvents(streamerAuthId, (event: EventSubChannelBanEvent) => {
                    logger.info(`${event.broadcasterDisplayName} just banned ${event.userDisplayName}!`);
                });
            })();
        });
    } else {
        // Prod
        // await twurpleInstance.botApiClient.eventSub.deleteAllSubscriptions(); // Clean up subscriptions
        const middleware = new EventSubMiddleware({
            apiClient: twurpleInstance.botApiClient,
            hostName: appenv.DOMAIN,
            pathPrefix: '/twitch',
            secret: appenv.TEST_SECRET // Note: changing this secret/config requires us to delete all subscriptions
        });

        // Note: We are passing the base express app, not the app returned from the ws instance
        await middleware.apply(appBase);
        app.listen(PORT, () => {
            logger.info(`Running on ${PORT} ⚡`);
            // Funky syntax to handle linting error: i.e: no-misused-promises
            void (async (): Promise<void> => {
                await middleware.markAsReady();
                // Subscribe to all channel point redemption events
                await middleware.subscribeToChannelRedemptionAddEvents(
                    streamerAuthId,
                    (event: EventSubChannelRedemptionAddEvent) => {
                        const username = event.userDisplayName.trim().toLowerCase();
                        logger.info(`@${username} just redeemed ${event.rewardTitle}!`);

                        // Handle redemptions tied to Pokemon
                        if (event.rewardTitle === 'Pokemon Roar') {
                            void twurpleInstance.twitchBot?.pokemon.roarUserPokemon(username, event.userId);
                        } else if (event.rewardTitle === 'Pokemon Level Up') {
                            void twurpleInstance.twitchBot?.pokemon.levelUpUserPokemon(username, event.userId);
                        } else if (event.rewardTitle === 'Pokemon Create') {
                            void twurpleInstance.twitchBot?.pokemon.createOrReplacePokemon(username, event.userId);
                        }
                    }
                );
                // Subscribe to raid events
                await middleware.subscribeToChannelRaidEventsTo(streamerAuthId, (event: EventSubChannelRaidEvent) => {
                    // Shout out the user who raided the stream
                    void twurpleInstance?.botChatClient.say(
                        appenv.TWITCH_CHANNEL_LISTEN,
                        `Check out the MAGNIFICENT ${event.raidingBroadcasterName} at twitch.tv/${event.raidingBroadcasterName}. So cool!`
                    );
                    logger.info(`${event.raidingBroadcasterName} raided ${appenv.TWITCH_CHANNEL_LISTEN}!`);
                });
            })();
        });
    }
})();
