import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthenticatedGuard, TwitchAuthGuard } from 'src/auth/guards';
import { noop } from 'rxjs';

@Controller('auth/twitch')
export class AuthController {
    @Get('login')
    @UseGuards(TwitchAuthGuard)
    login(@Req() req: Request) {
        console.log('LOGIN');
        return req.user;
    }

    @Get('callback')
    @UseGuards(TwitchAuthGuard)
    redirect(@Req() req: Request, @Res() res: Response) {
        console.log('REQ', req.headers);
        // /api/auth/twitch/status
        // res.redirect('http://localhost:4200/');
        res.redirect('https://tahabilalcs.github.io/brobot-admin-ui/');
        // res.sendStatus(200);
    }

    @Get('status')
    @UseGuards(AuthenticatedGuard)
    status(@Req() req: Request) {
        console.log('STATUS', req.user);
        return req.user;
    }

    @Get('logout')
    logout(@Req() req: Request, @Res() res: Response) {
        req.logout(() => noop());
        res.redirect('/');
    }
}
