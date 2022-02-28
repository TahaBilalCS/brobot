/* eslint-disable */
import process from 'process';
import { appenv } from './config/appenv.js';
import express, { Express } from 'express';
import cookieSession from 'cookie-session';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';

// Models before Services and Routers
import './api/models/User.js';
import './api/models/Twurple.js';
import './api/models/Pokemon.js';

// Initialize Twurple and Socket modules
import { twurpleInstance } from './twurple/TwurpleInstance.js';
import { expressSocket } from './ws/ExpressSocket.js';

// Routers after Models
import { router as loginRouter } from './api/routes/login.router.js';
import { router as userRouter } from './api/routes/user.router.js';

// Services after Models
import * as passportService from './api/services/passport.service.js';
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
await (async function () {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Mongoose Connected');
    } catch (err) {
        console.log('Mongoose Connection Failed?!', err);
    }
})();

/**
 * Order matters
 * Use .urlencoded, .json, session, etc, before app.use(router) -> Our routes setup
 * Calling urlencoded & json to handle the Request Object from POST requests
 * todo express.json messes with subscriptions for twurple down below. No global, use it only in routes that need it
 *
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
        // secret: SESSION_SECRET
    })
);

app.use(express.static('public'));
app.use(cors());
app.use(helmet());

/** Service Init */
passportService.init(app);

/** Only other usage of top level async in order to start up app */
await (async function () {
    // Twurple setup before routes and ws init
    await twurpleInstance.initTwurple();
    // Setup ws events with twurpleInstance
    expressSocket.initSocket();

    /** Routes Init -controller used in router, service used in controller */
    app.use(loginRouter);
    app.use(userRouter);

    const PORT = appenv.PORT ? parseInt(appenv.PORT) : 3000;
    const streamerAuthId = parseInt(appenv.STREAMER_AUTH_ID);

    if (process.env.NODE_ENV === 'development') {
        const devListener = new EventSubListener({
            logger: { name: 'Dev Logger', minLevel: LogLevel.DEBUG },
            apiClient: twurpleInstance.botApiClient,
            adapter: new NgrokAdapter(),
            secret: appenv.TEST_SECRET
        });
        // Delete all previous subscriptions for dev (only use with ngrok), as re-subscribing can cause rate limiting errors
        await twurpleInstance.botApiClient.eventSub.deleteAllSubscriptions();
        await devListener.listen();

        app.listen(PORT, async () => {
            console.log(`Running on ${PORT} ⚡`);
            await devListener.subscribeToChannelUnbanEvents(streamerAuthId, (event: EventSubChannelUnbanEvent) => {
                const username = event.userDisplayName.trim().toLowerCase();
                twurpleInstance.twitchBot?.Pokemon.roarUserPokemon(username);
                console.log(`${event.broadcasterDisplayName} just unbanned ${event.userDisplayName}!`);
            });
            await devListener.subscribeToChannelBanEvents(streamerAuthId, (event: EventSubChannelBanEvent) => {
                console.log(`${event.broadcasterDisplayName} just banned ${event.userDisplayName}!`);
            });
        });
    } else {
        // Prod
        // await twurpleInstance.botApiClient.eventSub.deleteAllSubscriptions(); // clean up subscriptions
        const middleware = new EventSubMiddleware({
            apiClient: twurpleInstance.botApiClient,
            hostName: appenv.DOMAIN,
            pathPrefix: '/twitch',
            secret: appenv.TEST_SECRET // Changing this secret/config requires us to delete all subscriptions
        });
        // @ts-ignore
        await middleware.apply(app);
        app.listen(PORT, async () => {
            console.log(`Running on ${PORT} ⚡`);
            await middleware.markAsReady();
            await middleware.subscribeToChannelRedemptionAddEvents(
                streamerAuthId,
                (event: EventSubChannelRedemptionAddEvent) => {
                    const username = event.userDisplayName.trim().toLowerCase();
                    console.log(`${username} just redeemed ${event.rewardTitle}!`);

                    if (event.rewardTitle === 'Pokemon Roar') {
                        twurpleInstance.twitchBot?.Pokemon.roarUserPokemon(username);
                    } else if (event.rewardTitle === 'Pokemon Level Up') {
                        twurpleInstance.twitchBot?.Pokemon.levelUpUserPokemon(username);
                    } else if (event.rewardTitle === 'Pokemon Create') {
                        twurpleInstance.twitchBot?.Pokemon.createOrChangePokemon(username);
                    }
                }
            );

            await middleware.subscribeToChannelRaidEventsTo(streamerAuthId, async (event: EventSubChannelRaidEvent) => {
                try {
                    console.log(
                        `Check out the MAGNIFICENT ${event.raidingBroadcasterName} at twitch.tv/${event.raidingBroadcasterName}. So cool!`
                    );
                    await twurpleInstance?.botChatClient.say(
                        appenv.TWITCH_CHANNEL_LISTEN,
                        `Check out the MAGNIFICENT ${event.raidingBroadcasterName} at twitch.tv/${event.raidingBroadcasterName}. So cool!`
                    );
                } catch (err) {
                    console.log('Error Incoming Raid', err);
                }
            });
        });
    }
})();
