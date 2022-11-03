import { Test, TestingModule } from '@nestjs/testing';
import { BotApiService } from 'src/twitch/services/bot-api/bot-api.service';

describe('BotApiService', () => {
    let service: BotApiService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [BotApiService]
        }).compile();

        service = module.get<BotApiService>(BotApiService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
