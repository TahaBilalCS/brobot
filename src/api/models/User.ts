import mongoose from 'mongoose';
const { Schema } = mongoose;
import { TwitchUserInterface, TwitchUserSchema } from './TwitchUser';

export interface UserInterface {
    oauthID: string;
    displayName: string;
    accountCreated?: mongoose.Schema.Types.Date;
    twitch: TwitchUserInterface;
}

// Mongo size limit is 4mb per record
export const userSchema = new Schema<UserInterface>({
    // twitch: { type: Schema.Types.ObjectId, ref: 'TwitchUser' },
    oauthID: { type: String, required: true },
    displayName: { type: String, required: true },
    accountCreated: { type: Date, default: Date.now(), required: true },
    twitch: { type: TwitchUserSchema }
});

// Don't want to export / require models for testing purposes
// It might assume we are creating multiple mongoose instances when imported multiple times
mongoose.model<UserInterface>('user', userSchema); // 2 arguments mean load into mongoose, 1 means load out like in passport.js
