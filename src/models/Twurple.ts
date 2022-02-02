import mongoose from 'mongoose';
const { Schema } = mongoose;

export interface TwurpleInterface {
    user: string;
    accessToken: string;
    refreshToken: string | null;
    scope: string[];
    expiresIn: number | null;
    obtainmentTimestamp: number;
}

// Mongo size limit is 4mb per record
export const twurpleSchema = new Schema<TwurpleInterface>({
    user: String,
    accessToken: String,
    refreshToken: String,
    scope: [String],
    expiresIn: Number,
    obtainmentTimestamp: Number
});

// Don't want to export / require models for testing purposes
// It might assume we are creating multiple mongoose instances when imported multiple times
mongoose.model<TwurpleInterface>('twurple', twurpleSchema); // 2 arguments mean load into mongoose, 1 means load out like in passport.js
