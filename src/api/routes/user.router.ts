/** User router in index.ts | router -> controller -> service*/
import { NextFunction, Request, Response, Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import * as userController from '../controllers/user.controller';
const router = Router();

// Current logged in user
router.get('/api/current_user', (req: Request, res: Response) => {
    // Regardless, send empty object back if user isn't defined
    // res.send(req.session); // Check if session is correct
    res.send(req.user);
});

// Current logged in user
router.get('/api/secret', requireAuth, (req: Request, res: Response) => {
    // Regardless, send empty object back if user isn't defined
    // res.send(req.session); // Check if session is correct
    res.send(req.user);
});

// router.get('/api/users', requireAuth, userController.getUsers);
router.get('/api/users', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    await userController.getUsers(req, res, next);
});

export { router };
