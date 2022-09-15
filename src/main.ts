import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from 'src/database/services/prisma.service';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
    // TODO-BT Create socket from app? Probably setup socket before app.use
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.setGlobalPrefix('api');
    app.enableCors();

    const prismaService = app.get(PrismaService);
    await prismaService.enableShutdownHooks(app);
    app.use(
        session({
            cookie: {
                maxAge: 7 * 24 * 60 * 60 * 1000 // ms
            },
            secret: 'a santa at nasa',
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
