/* eslint-disable */
import process from 'process';
import express, { Express } from 'express';
import cookieSession from 'cookie-session';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import enableWs from 'express-ws';

// Models before usage in Services and Routers
import './models/User.js';
import './models/Twurple.js';
import './models/Pokemon.js';

// Routers after Models
import { router as loginRouter } from './routes/login.router.js'; // TODO need to figure out why we need .js
import { router as userRouter } from './routes/user.router.js';

// Services after Models
import * as passportService from './services/passport.service.js';
import { TwitchInstance } from './twurple/TwurpleInstance.js';
import { EventSubListener, EventSubMiddleware } from '@twurple/eventsub';
import { ClientCredentialsAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';

const MONGO_URI = process.env.MONGO_URI;
await (async function mongooseConnect() {
    if (MONGO_URI) {
        try {
            await mongoose.connect(MONGO_URI); // void or empty .then()
            console.log('Mongoose Connected');
        } catch (err) {
            console.log('Mongoose Failed?!', err);
        }
    }
})();

const appBase: Express = express(); // Start express before middlewares
const wsInstance = enableWs(appBase);
const { app } = wsInstance;
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

/**
 * Order matters
 * Use .urlencoded, .json, session, etc, before app.use(router) -> Our routes setup
 * Calling urlencoded & json to handle the Request Object from POST requests
 * todo express.json messes with subscriptions for twurple down below.
 * Need to not do it globally, and use it only in routes that need it
 */
// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());

/**
 * Key difference between cookie-session and express-session is how the keys are stored
 * Cookie Session: Cookie IS the session -> Take user ID, find user, set it on req.session
 * Express Session: Cookie references a session -> Take session ID, then look at server side session store
 * Cookie has a small size limit with cookie-sesion compared to bucket of data from express-session. Only care about id
 * Passes into req.session. Cookie expires in 30 days, extracts cookie data to be passed into passport
 */
app.use(
    cookieSession({
        maxAge: 30 * 24 * 60 * 60 * 1000,
        keys: [process.env.COOKIE_KEY || '']
        // secret: SESSION_SECRET
    })
);

app.use(express.static('public'));
app.use(cors());
app.use(helmet());

/** Service Init */
passportService.init(app);

// Twurple Setup
const TwurpleInstance = new TwitchInstance(wsInstance);
// TODO Probably shouldn't block app starting?
await (async function () {
    await TwurpleInstance.init();
})();

/**
 * Routes Init
 * controller used in router, service used in controller
 */
app.use(loginRouter);
app.use(userRouter);

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_SECRET = process.env.TWITCH_SECRET || '';
const authProvider = new ClientCredentialsAuthProvider(TWITCH_CLIENT_ID, TWITCH_SECRET);
const apiClient = new ApiClient({ authProvider });

let devListener: EventSubListener;
(async function () {
    if (process.env.NODE_ENV === 'development') {
        devListener = new EventSubListener({
            apiClient,
            adapter: new NgrokAdapter(),
            secret: 'somesecret' // todo add different secret env
        });
        // Delete all previous subscriptions for dev (only use with ngrok), as re-subscribing can cause rate limiting errors
        await apiClient.eventSub.deleteAllSubscriptions();
        await devListener.listen();
        app.listen(PORT, async () => {
            console.log(`Running on ${PORT} ⚡`);
            await devListener.subscribeToChannelUnbanEvents(562338142, event => {
                const username = event.userDisplayName.trim().toLowerCase();
                TwurpleInstance.twitchBot?.Pokemon.roarUserPokemon(username);
                console.log(`${event.broadcasterDisplayName} just unbanned ${event.userDisplayName}!`);
            });
        });
    } else {
        // Prod
        const middleware = new EventSubMiddleware({
            apiClient,
            hostName: 'brobot.xyz',
            pathPrefix: '/twitch',
            secret: 'somesecret2' // todo add different secret env
        });
        // @ts-ignore
        await middleware.apply(app);
        app.listen(PORT, async () => {
            console.log(`Running on ${PORT} ⚡`);
            await middleware.markAsReady();
            // todo clean up subscriptions
            // await apiClient.eventSub.deleteAllSubscriptions();
            // rama oauth id 699735970
            await middleware.subscribeToChannelRedemptionAddEvents(699735970, event => {
                const username = event.userDisplayName.trim().toLowerCase();
                console.log(`${username} just redeemed ${event.rewardTitle}!`);

                if (event.rewardTitle === 'Pokemon Roar') {
                    TwurpleInstance.twitchBot?.Pokemon.roarUserPokemon(username);
                } else if (event.rewardTitle === 'Pokemon Level Up') {
                    TwurpleInstance.twitchBot?.Pokemon.levelUpUserPokemon(username);
                } else if (event.rewardTitle === 'Pokemon Create') {
                    TwurpleInstance.twitchBot?.Pokemon.createOrChangePokemon(username);
                }
            });
            await middleware.subscribeToChannelFollowEvents(562338142, event => {
                console.log(`${event.userDisplayName} just followed ${event.broadcasterDisplayName}!`);
            });
        });
    }
})();
