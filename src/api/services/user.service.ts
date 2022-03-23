/** Use service in controller */
import mongoose from 'mongoose';
import { UserInterface } from '../models/User';

const User = mongoose.model<UserInterface>('user');

export const getUsers = async (): Promise<UserInterface[] | null> => {
    return User.find({});
};

export const getUser = async (userID: string | undefined): Promise<UserInterface | null> => {
    return User.findOne({
        oauthID: userID
    });
};

// Delete user, update user
