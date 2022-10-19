import { Module } from '@nestjs/common';
import { TwitchClientService } from './services/twitch-client/twitch-client.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    providers: [TwitchClientService]
})
export class TwitchModule {}
