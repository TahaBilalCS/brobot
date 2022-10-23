import { Test, TestingModule } from '@nestjs/testing';
import { TwitchBotApiClientService } from './twitch-bot-api-client.service';

describe('TwitchBotApiClientService', () => {
    let service: TwitchBotApiClientService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TwitchBotApiClientService]
        }).compile();

        service = module.get<TwitchBotApiClientService>(TwitchBotApiClientService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
