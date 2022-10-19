declare module 'passport-twitch-new' {
    import { Strategy as BaseStrategy } from 'passport-oauth2';
    import { Request } from 'express';

    export interface StrategyOptions {
        clientID: string;
        clientSecret: string;
        callbackURL: string;
        scope?: string | string[];
        state?: string;
        passReqToCallback?: boolean;
    }

    export interface StrategyOptionsWithRequest extends StrategyOptions {
        passReqToCallback: true;
    }

    export interface VerifyFunction {
        (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: any) => void): void;
    }

    export interface VerifyFunctionWithRequest {
        (
            req: Request,
            accessToken: string,
            refreshToken: string,
            profile: any,
            done: (error: any, user?: any) => void
        ): void;
    }

    export class Strategy extends BaseStrategy {
        constructor(options: StrategyOptions, verify: VerifyFunction);
        constructor(options: StrategyOptionsWithRequest, verify: VerifyFunctionWithRequest);
        name: string;
        authenticate(req: Request, options?: object): void;
    }
}
