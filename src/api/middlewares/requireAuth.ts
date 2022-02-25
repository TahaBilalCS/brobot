/* eslint-disable */
import { NextFunction, Request, Response } from 'express';

/**
 * Middleware for requiring authentication
 * @param req
 * @param res
 * @param next
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (req.session?.passport && req.session.passport.user) {
        next();
        return;
    }

    // TODO 401?
    res.status(403).send('Not permitted');
}
