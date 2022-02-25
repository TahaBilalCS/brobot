import mongoose from 'mongoose';
const { Schema } = mongoose;

export interface TwitchUserInterface {
    displayName: string;
    email: string;
    accountCreatedDate: string;
    profileImageURL: string;
}

// Mongo size limit is 4mb per record
export const TwitchUserSchema = new Schema<TwitchUserInterface>({
    email: String, // If not required
    accountCreatedDate: String,
    profileImageURL: String
});

// Don't want to export / require models for testing purposes
// It might assume we are creating multiple mongoose instances when imported multiple times
// Use mongoose.model<TwitchUserInterface>('users', twitchUserSchema);
