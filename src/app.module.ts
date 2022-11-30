import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { TwitchModule } from './twitch/twitch.module';

@Module({
    providers: [AppService],
    controllers: [AppController],
    imports: [DatabaseModule, AuthModule, ConfigModule.forRoot(), TwitchModule], // Socket Module
    exports: []
})
export class AppModule {}

@Module({
    providers: [],
    controllers: [],
    imports: [], // Socket Module
    exports: []
})
export class TestAppModule {}
