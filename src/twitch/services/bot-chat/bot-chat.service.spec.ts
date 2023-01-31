import { Test, TestingModule } from '@nestjs/testing';
import { BotChatService } from 'src/twitch/services/bot-chat/bot-chat.service';

describe('BotChatService ', () => {
    let service: BotChatService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [BotChatService]
        }).compile();

        service = module.get<BotChatService>(BotChatService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
