import { Module } from '@nestjs/common';
import { TwitchClientService } from './services/twitch-client/twitch-client.service';
import { ConfigService, ConfigModule } from '@nestjs/config';
const AsyncTwitchClientProvider = {
    inject: [ConfigService],
    provide: TwitchClientService,
    useFactory: async (configService: ConfigService) => {
        console.log('Create Factory Twitch CS', configService.get('TWITCH_CLIENT_ID'));
        return await new TwitchClientService(configService).init();
    }
};

@Module({
    imports: [ConfigModule],
    providers: [AsyncTwitchClientProvider],
    exports: [AsyncTwitchClientProvider]
})
export class TwitchModule {}
