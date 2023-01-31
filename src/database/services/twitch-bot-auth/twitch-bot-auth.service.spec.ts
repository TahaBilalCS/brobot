import { Test, TestingModule } from '@nestjs/testing';
import { TwitchBotAuthService } from './twitch-bot-auth.service';

describe('TwitchBotAuthService', () => {
    let service: TwitchBotAuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TwitchBotAuthService]
        }).compile();

        service = module.get<TwitchBotAuthService>(TwitchBotAuthService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
