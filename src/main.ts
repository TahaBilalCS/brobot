import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from 'src/database/services/prisma.service';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import { WsAdapter } from '@nestjs/platform-ws';
import * as session from 'express-session';
import * as passport from 'passport';
import { BotApiService } from 'src/twitch/services/bot-api/bot-api.service';

async function bootstrap() {
    // TODO-BT Create socket from app? Probably setup socket before app.use
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['log', 'error', 'warn'] });
    console.log('Create App Module');
    let origin, domain;
    if (process.env.NODE_ENV === 'production') {
        // cookie-session
        origin = 'https://admin.brobot.live';
        domain = '.brobot.live';
    } else {
        origin = 'http://localhost:4200';
        domain = undefined;
    }
    app.useWebSocketAdapter(new WsAdapter(app));
    app.setGlobalPrefix('api');
    // todo-bt add cors config
    // todo add localhost env var and admin site
    app.enableCors({ origin: [origin], credentials: true });

    const prismaService = app.get(PrismaService);
    await prismaService.enableShutdownHooks(app);
    app.use(
        session({
            cookie: {
                maxAge: 7 * 24 * 60 * 60 * 1000, // ms
                domain: domain // todo-bt be more specific?
            },
            secret: process.env.SESSION_SECRET ?? '',
            resave: true,
            saveUninitialized: true,
            store: new PrismaSessionStore(prismaService, {
                checkPeriod: 2 * 60 * 1000, //ms
                dbRecordIdIsSessionId: true,
                dbRecordIdFunction: undefined
            })
        })
    );
    app.use(passport.initialize());
    app.use(passport.session());
    const botApiClient = app.get(BotApiService);
    if (process.env.NODE_ENV === 'production') {
        const expressInstance = app.get(HttpAdapterHost).httpAdapter.getInstance();
        await botApiClient.applyMiddleware(expressInstance);
    }
    await app.listen(3000, async () => {
        console.log('Listening on port 3000');
        await botApiClient.subscribeToEvents();
    });
}

void bootstrap();
