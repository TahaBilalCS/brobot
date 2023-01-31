/** Use controllers in router */
import { logger } from '../../utils/LoggerUtil.js';
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
        logger.error('Error getting users');
        logger.error(err);
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
//         logger.error('Error getting user');
//         logger.error(err);
//         next(err);
//     }
// };
