import { Test, TestingModule } from '@nestjs/testing';
import { TwitchStreamerAuthService } from './twitch-streamer-auth.service';

describe('TwitchStreamerAuthService', () => {
    let service: TwitchStreamerAuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [TwitchStreamerAuthService]
        }).compile();

        service = module.get<TwitchStreamerAuthService>(TwitchStreamerAuthService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
