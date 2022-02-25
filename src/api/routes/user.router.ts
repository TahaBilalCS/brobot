/* eslint-disable */
/** User router in index.ts | router -> controller -> service*/
import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import * as userController from '../controllers/user.controller.js';
const router = Router();

// Current logged in user
router.get('/api/current_user', (req: any, res: any) => {
    // Regardless, send empty object back if user isn't defined
    // res.send(req.session); // Check if session is correct
    res.send(req.user);
});

// Current logged in user
router.get('/api/secret', requireAuth, (req: any, res: any) => {
    // Regardless, send empty object back if user isn't defined
    // res.send(req.session); // Check if session is correct
    res.send(req.user);
});

// router.get('/api/users', requireAuth, userController.getUsers);
router.get('/api/users', requireAuth, async (req: any, res: any, next) => {
    await userController.getUsers(req, res, next);
});

export { router };
