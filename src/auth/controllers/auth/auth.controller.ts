import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthenticatedGuard, TwitchUserAuthGuard, TwitchStreamerAuthGuard, TwitchBotAuthGuard } from 'src/auth/guards';
import { noop } from 'rxjs';

@Controller('auth/twitch')
export class AuthController {
    @Get('login3')
    @UseGuards(TwitchBotAuthGuard)
    login3(@Req() req: Request) {
        console.log('BOT LOGIN', req.user);
        return req.user;
    }

    @Get('callback3')
    @UseGuards(TwitchBotAuthGuard)
    redirect3(@Req() req: Request, @Res() res: Response) {
        console.log('BOT CALLBACK', req.user);
        if (process.env.NODE_ENV === 'production') {
            res.redirect('https://admin.brobot.live');
        } else {
            res.redirect('http://localhost:4200/');
        }
    }

    @Get('login2')
    @UseGuards(TwitchStreamerAuthGuard)
    login2(@Req() req: Request) {
        console.log('STREAMER LOGIN', req.user);
        return req.user;
    }

    @Get('callback2')
    @UseGuards(TwitchStreamerAuthGuard)
    redirect2(@Req() req: Request, @Res() res: Response) {
        console.log('STREAMER CALLBACK');
        if (process.env.NODE_ENV === 'production') {
            res.redirect('https://admin.brobot.live');
        } else {
            res.redirect('http://localhost:4200/');
        }
    }

    @Get('login')
    @UseGuards(TwitchUserAuthGuard)
    login(@Req() req: Request) {
        console.log('USER LOGIN');
        return req.user;
    }

    @Get('callback')
    @UseGuards(TwitchUserAuthGuard)
    redirect(@Req() req: Request, @Res() res: Response) {
        console.log('USER CALLBACK');
        if (process.env.NODE_ENV === 'production') {
            res.redirect('https://admin.brobot.live');
        } else {
            res.redirect('http://localhost:4200/');
        }
    }

    @Get('status')
    @UseGuards(AuthenticatedGuard)
    status(@Req() req: Request) {
        console.log('GET STATUS');
        return req.user;
    }

    @Get('logout')
    logout(@Req() req: Request, @Res() res: Response) {
        req.logout(() => noop());
        res.status(200).json({ status: 'Bye!' });
    }
}
