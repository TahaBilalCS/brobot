import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth/auth.controller';
import { AuthService } from './services/auth/auth.service';
import { TwitchUserStrategy, TwitchStreamerStrategy, TwitchBotStrategy } from 'src/auth/strategies';
import { DatabaseModule } from 'src/database/database.module';
import { TwitchSessionSerializer } from 'src/auth/utils/TwitchSessionSerializer';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';

console.log('Auth Module Init');
@Module({
    controllers: [AuthController],
    providers: [
        TwitchUserStrategy,
        TwitchStreamerStrategy,
        TwitchBotStrategy,
        TwitchSessionSerializer,
        {
            // Makes creating interface types easier
            provide: 'AUTH_SERVICE',
            useClass: AuthService
        }
    ],
    imports: [DatabaseModule, ConfigModule, PassportModule.register({ session: true })]
})
export class AuthModule {}
