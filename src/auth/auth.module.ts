import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth/auth.controller';
import { AuthService } from './services/auth/auth.service';
import { TwitchBotStrategy } from 'src/auth/strategies';
import { DatabaseModule } from 'src/database/database.module';
import { TwitchSessionSerializer } from 'src/auth/utils/TwitchSessionSerializer';
import { PassportModule } from '@nestjs/passport';

console.log('Auth Module Init');
@Module({
    controllers: [AuthController],
    providers: [
        TwitchBotStrategy,
        TwitchSessionSerializer,
        {
            // Makes creating interface types easier
            provide: 'AUTH_SERVICE',
            useClass: AuthService
        }

        // TwitchStreamerStrategy,
        // TwitchUserStrategy
    ],
    imports: [DatabaseModule, PassportModule.register({ session: true })]
})
export class AuthModule {}
