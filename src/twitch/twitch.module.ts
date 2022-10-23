import { Module } from '@nestjs/common';
import { TwitchClientService } from './services/twitch-client/twitch-client.service';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { TwitchBotApiClientService } from './services/twitch-bot-api-client/twitch-bot-api-client.service';
// const AsyncTwitchClientProvider = {
//     inject: [ConfigService],
//     provide: TwitchClientService,
//     useFactory: async (configService: ConfigService) => {
//         console.log('Create Factory Twitch CS', configService.get('TWITCH_CLIENT_ID'));
//         const tcs = new TwitchClientService(configService);
//         await tcs.init();
//         return tcs;
//     }
// };
const AsyncTwitchBotApiClientProvider = {
    inject: [ConfigService],
    provide: TwitchBotApiClientService,
    useFactory: async (configService: ConfigService) => {
        console.log('Create Factory API Client CS', configService.get('TWITCH_CLIENT_ID'));
        const tcs = new TwitchBotApiClientService(configService);
        await tcs.init();
        return tcs;
    }
};
@Module({
    imports: [ConfigModule],
    providers: [AsyncTwitchBotApiClientProvider],
    exports: [AsyncTwitchBotApiClientProvider]
})
export class TwitchModule {}
