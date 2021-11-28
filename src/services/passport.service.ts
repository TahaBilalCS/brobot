/* eslint-disable */
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
import { OAuth2Strategy } from 'passport-oauth';
import request from 'request';
import passport from 'passport';
import process from 'process';
import { Application } from 'express';
import mongoose from 'mongoose';
import type { UserInterface } from '../models/User.js';

export const init = (app: Application) => {
    const User = mongoose.model<UserInterface>('user');

    const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
    const TWITCH_SECRET = process.env.TWITCH_SECRET;
    const TWITCH_CALLBACK_URL = process.env.TWITCH_CALLBACK_URL;

    app.use(passport.initialize());
    app.use(passport.session());

    // Create cookie with user to generate identifying info
    passport.serializeUser((user: any, done: any) => {
        // Stuff into cookie. Pick the one thing to associate user. Not twitch profile id, but mongoose object id.
        done(null, user.id);
    });

    // Take identifying piece of info from cookie (object id), and turn it into a user
    passport.deserializeUser(async (id: any, done: any) => {
        const deserializedUser = await User.findById(id);
        done(null, deserializedUser);
    });

    // Override passport profile function to get user profile from Twitch API
    OAuth2Strategy.prototype.userProfile = function (accessToken: any, done: any): any {
        const options = {
            url: 'https://api.twitch.tv/helix/users',
            method: 'GET',
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                Accept: 'application/vnd.twitchtv.v5+json',
                Authorization: 'Bearer ' + accessToken
            }
        };

        request(options, function (error: any, response: any, body: any): any {
            if (response && response.statusCode === 200) {
                done(null, JSON.parse(body));
            } else {
                done(JSON.parse(body));
            }
        });
    };

    /**
     * Twitch Strategy
     * Authenticate users in our app
     */
    passport.use(
        'twitch',
        new OAuth2Strategy(
            {
                authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
                tokenURL: 'https://id.twitch.tv/oauth2/token',
                clientID: TWITCH_CLIENT_ID,
                clientSecret: TWITCH_SECRET,
                callbackURL: TWITCH_CALLBACK_URL,
                state: true
            },
            async (accessToken: any, refreshToken: any, profile: any, done: any) => {
                // TODO Tokens used FOR twurple bot - do something with them
                // console.log('ACCESS', accessToken);
                // console.log('REFRESH', refreshToken);

                // Profile information stored in this response
                const userProfile = profile.data[0];

                const user = await User.findOne({ oauthID: userProfile.id });

                // If user already exists
                if (user) {
                    console.log(`Existing User Login: ${userProfile.display_name}`);
                    done(null, user);
                } else {
                    // TODO try/catch with done(errorObject,newUser)
                    // Create new user
                    const newUser = await new User({
                        oauthID: userProfile.id,
                        displayName: userProfile.display_name,
                        twitch: {
                            email: userProfile.email,
                            accountCreatedDate: userProfile.created_at,
                            profileImageURL: userProfile.profile_image_url
                        }
                    }).save();
                    done(null, newUser);
                    console.log(`New User Login: ${userProfile.display_name}`);
                }
            }
        )
    );

    console.log('Passport Initialized');
};
