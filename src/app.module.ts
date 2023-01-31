import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { TwitchModule } from './twitch/twitch.module';
import { JsonBodyParserMiddleware } from 'src/JsonBodyParser.middleware';

@Module({
    providers: [AppService],
    controllers: [AppController],
    imports: [DatabaseModule, AuthModule, ConfigModule.forRoot(), TwitchModule], // Socket Module
    exports: []
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // todo need a better way to configure routes
        consumer
            .apply(JsonBodyParserMiddleware)
            .forRoutes({ path: '/updateRewardsStatus', method: RequestMethod.POST });
    }
}
