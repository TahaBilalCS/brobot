import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthenticatedGuard, TwitchUserAuthGuard, TwitchStreamerAuthGuard, TwitchBotAuthGuard } from 'src/auth/guards';
import { noop } from 'rxjs';

@Controller('auth/twitch')
export class AuthController {
    @Get('login3')
    @UseGuards(TwitchBotAuthGuard)
    login3(@Req() req: Request) {
        return req.user;
    }

    @Get('callback3')
    @UseGuards(TwitchBotAuthGuard)
    redirect3(@Req() req: Request, @Res() res: Response) {
        res.redirect(process.env.UI_URL || '');
    }

    @Get('login2')
    @UseGuards(TwitchStreamerAuthGuard)
    login2(@Req() req: Request) {
        return req.user;
    }

    @Get('callback2')
    @UseGuards(TwitchStreamerAuthGuard)
    redirect2(@Req() req: Request, @Res() res: Response) {
        res.redirect(process.env.UI_URL || '');
    }

    @Get('login')
    @UseGuards(TwitchUserAuthGuard)
    login(@Req() req: Request) {
        return req.user;
    }

    @Get('callback')
    @UseGuards(TwitchUserAuthGuard)
    redirect(@Req() req: Request, @Res() res: Response) {
        res.redirect(process.env.UI_URL || '');
    }

    @Get('status')
    @UseGuards(AuthenticatedGuard)
    status(@Req() req: Request) {
        return req.user;
    }

    // todo logout not working error, prisma session: An operation failed because it depends on one or more
    // appears to happen if you logout after login as streamer/bot, seems like session gets updated but doesn't realize it changed
    // need to create new session i believe
    // when logging in from b_robot after logging out after Login Bot, it automatically has us logged in with bot session instead of user session
    @Get('logout')
    logout(@Req() req: Request, @Res() res: Response) {
        // res.clearCookie('connect.sid');
        req.logout(() => {
            // todo find out why we need to do this, if you logout from certain pages in UI, it doesn't work without this
            // probably shouldnt if its stacking sessions
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            delete req.session;
        });
        res.status(200).json({ status: 'Bye!' });
    }
}
