/* eslint-disable */
/** Use service in controller */
import mongoose from 'mongoose';
import { UserInterface } from '../models/User.js';

const User = mongoose.model<UserInterface>('user');

export const getUsers = async (): Promise<any> => {
    return User.find({});
};

export const getUser = async (userID: string | undefined): Promise<any> => {
    return User.findOne({
        oauthID: userID
    });
};

// Delete user, update user
