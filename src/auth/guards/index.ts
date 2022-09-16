import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Used to invoke passport
@Injectable()
export class TwitchAuthGuard extends AuthGuard('twitch') {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        console.log('TwitchAuthGuard');
        const activate = (await super.canActivate(context)) as boolean;
        console.log(activate);
        const request = context.switchToHttp().getRequest();
        // console.log(request);
        await super.logIn(request);
        return activate;
    }
}

@Injectable()
export class AuthenticatedGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        console.log('Is Authenticated?', req.isAuthenticated());
        return req.isAuthenticated();
    }
}
