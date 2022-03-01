/** Use controllers in router */
import * as userService from '../services/user.service.js';
import { Request, Response, NextFunction } from 'express';

/**
 * Gets list of users
 * @param req
 * @param res
 * @param next
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const users = await userService.getUsers();
        res.send(users);
    } catch (err) {
        console.log('Error getting users', err);
        next(err);
    }
};

/**
 * TODO: Extend typescript typings
 * Gets a user by id
 * @param req
 * @param res
 * @param next
 */
// export const getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//     try {
//         const users = await userService.getUser(req.user?.oauthID as string);
//         res.send(users);
//     } catch (err) {
//         console.log('Error getting user', err);
//         next(err);
//     }
// };
