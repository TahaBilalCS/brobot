import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from 'src/database/services/prisma.service';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import * as session from 'express-session';
import * as passport from 'passport';
import { Response } from 'express';

async function bootstrap() {
    // TODO-BT Create socket from app? Probably setup socket before app.use
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.use(function (req: any, res: Response, next: any) {
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH');
        res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
        next();
    });
    app.setGlobalPrefix('api');
    // todo-bt add cors config
    app.enableCors({ origin: 'https://admin.brobot.live', credentials: true });

    const prismaService = app.get(PrismaService);
    await prismaService.enableShutdownHooks(app);
    app.use(
        session({
            cookie: {
                maxAge: 7 * 24 * 60 * 60 * 1000, // ms
                domain: '*.brobot.live'
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
    await app.listen(3000);
}

void bootstrap();
